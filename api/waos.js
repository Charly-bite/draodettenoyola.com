/**
 * API: WAOS Bridge & CRM Proxy para Dra. Odette (draodettenoyola.com/admin)
 * Conecta el panel de la Dra. Odette con el motor WAOS en desarrollo (:6006)
 * y mantiene un caché en memoria/disco para que incluso desde Render (nube)
 * la Dra. Odette vea su QR en vivo, estatus de WhatsApp y tabla de pacientes.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./middleware');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'waos-bridge-cache.json');
const BRIDGE_KEY = process.env.ODETTE_BRIDGE_KEY || 'odette-waos-bridge-2026';
const WAOS_URLS = [
  process.env.ODETTE_WAOS_URL || 'http://100.89.1.27:6006',
  'http://100.77.199.69:6006',
  'http://192.168.2.218:6006'
];

let bridgeState = {
  waState: {
    status: 'qr_ready_wait',
    connected: false,
    qr: null,
    phone: null,
    pushname: 'Consultorio Dra. Odette Noyola',
    aiAutoReplyEnabled: true,
    updatedAt: Date.now()
  },
  leads: [],
  syncedAt: null
};

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (parsed && parsed.waState) bridgeState = parsed;
    }
  } catch (_) {}
}
loadCache();

function saveCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(bridgeState, null, 2), 'utf8');
  } catch (_) {}
}

async function fetchFromWaosNode(endpoint, options = {}) {
  const fetchFn = global.fetch;
  if (!fetchFn) return null;
  for (const base of WAOS_URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetchFn(`${base}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
  }
  return null;
}

// POST /api/waos/bridge-sync — Recibe push cada 20s o en eventos QR desde desarrollo (:6006)
router.post('/bridge-sync', (req, res) => {
  const key = req.headers['x-odette-bridge-key'] || '';
  if (key !== BRIDGE_KEY) {
    return res.status(403).json({ ok: false, error: 'Invalid bridge key' });
  }
  const { waState, leads, syncedAt } = req.body || {};
  if (waState) bridgeState.waState = waState;
  if (Array.isArray(leads)) bridgeState.leads = leads;
  bridgeState.syncedAt = syncedAt || new Date().toISOString();
  saveCache();
  res.json({ ok: true });
});

// POST /api/waos/lead-intake — Público (para el Cotizador y Pre-Triage Web de index.html)
router.post('/lead-intake', async (req, res) => {
  const body = req.body || {};
  const remote = await fetchFromWaosNode('/api/odette/lead-intake', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  // También guardar en caché local por si viene desde Render
  const cleanPhone = String(body.phone || 'web').replace(/\D/g, '') || `web_${Date.now()}`;
  const newLead = {
    contact_id: `${cleanPhone}@web.lead`,
    patient_name: body.patientName || 'Paciente Web (Cotizador)',
    phone: cleanPhone,
    service_requested: body.serviceRequested || 'Consulta / Ultrasonido',
    gestational_weeks: body.gestationalWeeks || null,
    insurance_carrier: body.insuranceCarrier || 'Particular',
    appointment_status: 'pre_triage_web',
    last_contact_at: new Date().toISOString(),
    message_count: 1
  };
  bridgeState.leads = [newLead, ...(bridgeState.leads || []).filter(l => l.contact_id !== newLead.contact_id)].slice(0, 60);
  saveCache();

  res.json({ ok: true, syncedToMssql: Boolean(remote && remote.ok) });
});

// GET /api/waos/status — Estado completo + QR + Leads para draodettenoyola.com/admin
router.get('/status', requireAuth, async (req, res) => {
  const liveStatus = await fetchFromWaosNode('/api/odette/status');
  const liveLeads = await fetchFromWaosNode('/api/odette/leads');
  if (liveStatus && liveStatus.waState) {
    bridgeState.waState = liveStatus.waState;
    bridgeState.syncedAt = new Date().toISOString();
  }
  if (liveLeads && Array.isArray(liveLeads.leads)) {
    bridgeState.leads = liveLeads.leads;
  }
  saveCache();
  res.json({
    ok: true,
    waState: bridgeState.waState,
    leads: bridgeState.leads || [],
    syncedAt: bridgeState.syncedAt,
    tables: ['dbo.odette_conversations', 'dbo.odette_patients_leads']
  });
});

// POST /api/waos/toggle-ai — Activar/Pausar respuestas automáticas IA
router.post('/toggle-ai', requireAuth, async (req, res) => {
  const remote = await fetchFromWaosNode('/api/odette/toggle-ai', {
    method: 'POST',
    body: JSON.stringify(req.body || {})
  });
  if (remote && typeof remote.aiAutoReplyEnabled === 'boolean') {
    bridgeState.waState.aiAutoReplyEnabled = remote.aiAutoReplyEnabled;
  } else {
    bridgeState.waState.aiAutoReplyEnabled = !bridgeState.waState.aiAutoReplyEnabled;
  }
  saveCache();
  res.json({ ok: true, aiAutoReplyEnabled: bridgeState.waState.aiAutoReplyEnabled });
});

// POST /api/waos/send-review — Enviar solicitud de reseña Google Maps a paciente
router.post('/send-review', requireAuth, async (req, res) => {
  const { phone, patientName } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Teléfono requerido' });

  const remote = await fetchFromWaosNode('/api/odette/send-review', {
    method: 'POST',
    body: JSON.stringify({ phone, patientName })
  });

  if (remote && remote.ok) {
    return res.json(remote);
  }

  const digits = String(phone).replace(/\D/g, '').slice(-10);
  const greeting = patientName ? `Hola *${patientName}*` : 'Hola';
  const reviewText = `${greeting}, fue un gusto atenderte en el consultorio de la *Dra. Odette Noyola* 🩺✨.\n\nPara nosotros tu bienestar y tu opinión son muy valiosos. ¿Nos ayudarías compartiendo tu experiencia en Google Maps? Toma menos de 30 segundos:\n👉 https://g.page/r/CST5pYN0eyRqEAI/review\n\n¡Muchas gracias por tu confianza!`;

  res.json({
    ok: true,
    sentViaBot: false,
    waMeFallback: `https://wa.me/52${digits}?text=${encodeURIComponent(reviewText)}`,
    message: 'Enlace directo de reseña generado (escanee el QR para envío automático directo)'
  });
});

// POST /api/waos/logout — Reiniciar sesión / Generar nuevo QR
router.post('/logout', requireAuth, async (req, res) => {
  const remote = await fetchFromWaosNode('/api/odette/logout', { method: 'POST' });
  res.json(remote || { ok: true, message: 'Solicitando nuevo código QR al motor WAOS...' });
});

module.exports = router;
