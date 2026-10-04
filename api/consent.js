/**
 * API Route: Registro de Consentimiento Legal (LFPDPPP)
 * Dra. Odette Noyola — Ginecología y Medicina Materno Fetal
 *
 * TASK-002 [P0]: Almacenamiento auditado de consentimiento
 * ─────────────────────────────────────────────────────────
 * Guarda: { email, timestamp, ip, version, userAgent, page }
 * Archivo: data/consent_log.json (respaldo local persistente)
 *
 * El frontend también guarda en localStorage como segundo respaldo.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CONSENT_FILE = path.join(__dirname, '..', 'data', 'consent_log.json');

// ─── Rate limiting para evitar abuso (máx 10 por IP en 15 min) ───
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_PER_WINDOW = 10;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count++;
  return false;
}

// Limpieza periódica cada 30 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.start > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 30 * 60 * 1000);

// ─── Utilidad: leer/escribir archivo de consentimientos ───
function readConsentLog() {
  try {
    if (fs.existsSync(CONSENT_FILE)) {
      const raw = fs.readFileSync(CONSENT_FILE, 'utf-8');
      return JSON.parse(raw || '[]');
    }
  } catch (err) {
    console.error('[Consent] Error al leer archivo:', err.message);
  }
  return [];
}

function writeConsentLog(data) {
  try {
    // Asegurar que exista el directorio data/
    const dir = path.dirname(CONSENT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONSENT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Consent] Error al escribir archivo:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/consent — Registrar consentimiento
// ══════════════════════════════════════════════════════════════
router.post('/', (req, res) => {
  // Obtener IP real (compatible con proxies como Cloudflare / Render)
  const clientIp = req.headers['cf-connecting-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.ip
    || 'unknown';

  // Rate limiting
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes. Intente en unos minutos.'
    });
  }

  // Validar campos requeridos
  const { email, version, page, termsAccepted, privacyAccepted } = req.body;

  if (!email || !version) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos: email, version'
    });
  }

  // Validar formato de email básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de correo electrónico no válido.'
    });
  }

  // Construir registro auditado
  const consentRecord = {
    id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    email: email.trim().toLowerCase(),
    timestamp: new Date().toISOString(),
    ip: clientIp,
    version: version,
    page: page || 'unknown',
    termsAccepted: !!termsAccepted,
    privacyAccepted: !!privacyAccepted,
    userAgent: (req.headers['user-agent'] || '').substring(0, 200)
  };

  // Guardar en archivo JSON
  const log = readConsentLog();
  log.unshift(consentRecord);

  // Limitar a 2000 registros máximos en el archivo local
  if (log.length > 2000) log.length = 2000;

  writeConsentLog(log);

  console.log(`[Consent] ✅ Registrado: ${consentRecord.email} | v${consentRecord.version} | ${consentRecord.ip}`);

  return res.status(201).json({
    success: true,
    consentId: consentRecord.id,
    timestamp: consentRecord.timestamp
  });
});

// ══════════════════════════════════════════════════════════════
// GET /api/consent/verify — Verificar si un email ya dio consentimiento
// (útil para el admin panel)
// ══════════════════════════════════════════════════════════════
router.get('/verify', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Parámetro email requerido.' });
  }

  const log = readConsentLog();
  const found = log.find(r => r.email === email.trim().toLowerCase());

  return res.json({
    success: true,
    hasConsent: !!found,
    record: found || null
  });
});

module.exports = router;
