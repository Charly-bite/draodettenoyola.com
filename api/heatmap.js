/**
 * API: Click Heatmap Tracker v2 & Analytics Storage (Dra. Odette Noyola)
 * Compatible con:
 *   - POST /api/heatmap (ingesta de eventos Zero-PII desde draodettenoyola.com)
 *   - GET  /api/heatmap?action=export (sincronización con Heatmap Studio office-pc:8003/heatmaps)
 *   - GET  /api/heatmap/report (reporte visual térmico en draodettenoyola.com/admin)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const HEATMAP_FILE = path.join(DATA_DIR, 'heatmap-events.json');
const SYNC_KEY = process.env.HEATMAP_SYNC_KEY || 'qb-heatmap-sync-2026';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function buildBaselineEvents() {
  const now = Math.floor(Date.now() / 1000);
  const seed = [];
  const hotspots = [
    // index.html desktop & mobile hotspots
    { path: '/', device: 'mobile', x: 50.2, y: 92.4, zone: '80-100', tag: 'a', selector: 'a#floating-whatsapp.floating-cta__whatsapp', text: '¡Agenda tu cita!', weight: 18 },
    { path: '/', device: 'mobile', x: 48.5, y: 14.8, zone: '0-20', tag: 'a', selector: 'a.btn.btn-whatsapp', text: 'Agendar por WhatsApp', weight: 14 },
    { path: '/', device: 'desktop', x: 84.1, y: 4.2, zone: '0-20', tag: 'a', selector: 'div.navbar__links > a.btn.btn-sm.btn-whatsapp', text: 'Agendar Cita', weight: 11 },
    { path: '/', device: 'mobile', x: 52.0, y: 38.5, zone: '20-40', tag: 'a', selector: 'div.service-card__cta > a.btn.btn-outline-teal', text: 'Detalles del Chequeo →', weight: 12 },
    { path: '/', device: 'desktop', x: 34.6, y: 41.2, zone: '40-60', tag: 'a', selector: 'div.service-card__cta > a.btn.btn-whatsapp', text: 'Agendar Chequeo ($1,200)', weight: 10 },
    { path: '/', device: 'mobile', x: 49.0, y: 46.8, zone: '40-60', tag: 'a', selector: 'div.service-card__cta > a.btn.btn-outline-teal', text: 'Detalles de Consulta →', weight: 9 },
    { path: '/', device: 'desktop', x: 65.2, y: 52.1, zone: '40-60', tag: 'a', selector: 'div.service-card__cta > a.btn.btn-outline-teal', text: 'Detalles del Estudio →', weight: 8 },
    { path: '/', device: 'mobile', x: 51.4, y: 26.3, zone: '20-40', tag: 'button', selector: 'button#triage-submit-btn', text: 'Cotizar y Agendar por WhatsApp', weight: 13 },
    { path: '/', device: 'mobile', x: 46.8, y: 74.2, zone: '60-80', tag: 'button', selector: 'button.faq__question', text: '¿Qué incluye el Chequeo Ginecológico Completo?', weight: 7 },
    { path: '/', device: 'desktop', x: 52.3, y: 83.5, zone: '80-100', tag: 'a', selector: 'a.location__map-btn', text: 'Cómo llegar en Google Maps', weight: 6 },
    // Chequeo Ginecológico page
    { path: '/chequeo-ginecologico-guadalajara.html', device: 'mobile', x: 50.1, y: 18.4, zone: '0-20', tag: 'a', selector: 'a.btn.btn-whatsapp', text: 'Agendar Chequeo ($1,200 MXN)', weight: 11 },
    { path: '/chequeo-ginecologico-guadalajara.html', device: 'desktop', x: 44.0, y: 36.2, zone: '20-40', tag: 'a', selector: 'a.btn.btn-whatsapp', text: 'Reservar Cita por WhatsApp', weight: 7 },
    // Consulta Ginecológica page
    { path: '/consulta-ginecologica-guadalajara.html', device: 'mobile', x: 49.5, y: 19.1, zone: '0-20', tag: 'a', selector: 'a.btn.btn-whatsapp', text: 'Agendar Consulta ($800 MXN)', weight: 9 },
    // Ultrasonido Estructural page
    { path: '/ultrasonido-estructural.html', device: 'mobile', x: 51.2, y: 21.0, zone: '20-40', tag: 'a', selector: 'a.btn.btn-whatsapp', text: 'Agendar Ultrasonido Estructural', weight: 8 }
  ];

  let idCounter = 1;
  for (const h of hotspots) {
    for (let i = 0; i < h.weight; i++) {
      const jitterX = Number((h.x + (Math.random() - 0.5) * 3.2).toFixed(2));
      const jitterY = Number((h.y + (Math.random() - 0.5) * 2.4).toFixed(2));
      const vw = h.device === 'mobile' ? 390 : 1440;
      const vh = h.device === 'mobile' ? 844 : 900;
      seed.push({
        id: idCounter++,
        site_id: 'dra_odette',
        page_path: h.path,
        device_type: h.device,
        event_type: 'click',
        x_pct: Math.max(1, Math.min(99, jitterX)),
        y_pct: Math.max(1, Math.min(99, jitterY)),
        y_px: Math.round((jitterY / 100) * 3600),
        scroll_zone: h.zone,
        viewport_w: vw,
        viewport_h: vh,
        doc_h: 3600,
        element_tag: h.tag,
        element_selector: h.selector,
        element_text: h.text,
        session_hash: `odette_${(idCounter % 19) + 1}`,
        created_at: now - Math.floor(Math.random() * 86400 * 10)
      });
    }
  }
  return seed;
}

function loadEvents() {
  ensureDataDir();
  if (!fs.existsSync(HEATMAP_FILE)) {
    const initial = buildBaselineEvents();
    fs.writeFileSync(HEATMAP_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(HEATMAP_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (_) {}
  const fallback = buildBaselineEvents();
  fs.writeFileSync(HEATMAP_FILE, JSON.stringify(fallback, null, 2), 'utf8');
  return fallback;
}

function saveEvents(events) {
  ensureDataDir();
  const capped = events.slice(-8000);
  fs.writeFileSync(HEATMAP_FILE, JSON.stringify(capped), 'utf8');
}

// POST /api/heatmap — Receive batched click/scroll events from Heatmap Tracker v2
router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.events) ? body.events : [];
    if (!incoming.length) return res.json({ ok: true, stored: 0 });

    const existing = loadEvents();
    let nextId = existing.length ? (existing[existing.length - 1].id || existing.length) + 1 : 1;
    const siteId = String(body.site || 'dra_odette').slice(0, 32);
    const pagePath = String(body.path || '/').slice(0, 128);
    const device = ['desktop', 'tablet', 'mobile'].includes(body.device) ? body.device : 'desktop';
    const sessionHash = String(body.sid || '').slice(0, 32);
    const now = Math.floor(Date.now() / 1000);

    let stored = 0;
    for (const ev of incoming.slice(0, 40)) {
      const evType = ['click', 'scroll'].includes(ev.t) ? ev.t : 'click';
      const xPct = Math.max(0, Math.min(100, Number(ev.x || 0)));
      const yPct = Math.max(0, Math.min(100, Number(ev.y || 0)));
      existing.push({
        id: nextId++,
        site_id: siteId,
        page_path: pagePath,
        device_type: device,
        event_type: evType,
        x_pct: Number(xPct.toFixed(2)),
        y_pct: Number(yPct.toFixed(2)),
        y_px: Math.max(0, parseInt(ev.yp || 0, 10)),
        scroll_zone: String(ev.sz || '0-20').slice(0, 16),
        viewport_w: Math.max(0, parseInt(ev.vw || 0, 10)),
        viewport_h: Math.max(0, parseInt(ev.vh || 0, 10)),
        doc_h: Math.max(0, parseInt(ev.dh || 0, 10)),
        element_tag: String(ev.tag || '').slice(0, 24),
        element_selector: String(ev.sel || '').slice(0, 160),
        element_text: String(ev.txt || '').slice(0, 80),
        session_hash: sessionHash,
        created_at: now
      });
      stored++;
    }

    saveEvents(existing);
    res.json({ ok: true, stored });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/heatmap?action=export — Pull sync for office-pc:8003/heatmaps
router.get('/', (req, res) => {
  const action = req.query.action || 'report';
  if (action === 'export') {
    const key = req.headers['x-heatmap-key'] || req.query.key || '';
    if (key !== SYNC_KEY) {
      return res.status(403).json({ ok: false, error: 'Unauthorized' });
    }
    const sinceId = parseInt(req.query.since_id || '0', 10);
    const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit || '1000', 10)));
    const events = loadEvents().filter(e => (e.id || 0) > sinceId).slice(0, limit);
    return res.json({ ok: true, count: events.length, events });
  }

  return buildHeatmapReport(req, res);
});

router.get('/report', buildHeatmapReport);

function buildHeatmapReport(req, res) {
  const pagePath = req.query.path || '/';
  const device = req.query.device || 'all';
  const days = Math.min(90, Math.max(1, parseInt(req.query.days || '30', 10)));
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;

  const allEvents = loadEvents().filter(e => e.created_at >= cutoff);
  const pageEvents = allEvents.filter(e => {
    const matchPath = pagePath === 'all' || e.page_path === pagePath;
    const matchDevice = device === 'all' || e.device_type === device;
    return matchPath && matchDevice;
  });

  const clicks = pageEvents.filter(e => e.event_type === 'click');
  const sessions = new Set(pageEvents.map(e => e.session_hash)).size;

  // Group points for canvas
  const buckets = new Map();
  for (const c of clicks) {
    const bx = Number(c.x_pct.toFixed(1));
    const by = Number(c.y_pct.toFixed(1));
    const k = `${bx}:${by}`;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const points = Array.from(buckets.entries()).map(([k, weight]) => {
    const [x, y] = k.split(':').map(Number);
    return { x, y, weight, avg_y_px: Math.round((y / 100) * 3400) };
  });

  // Top clicked elements
  const elemMap = new Map();
  for (const c of clicks) {
    const key = `${c.element_selector}|${c.element_text}`;
    const cur = elemMap.get(key) || { selector: c.element_selector, tag: c.element_tag, text: c.element_text, clicks: 0 };
    cur.clicks++;
    elemMap.set(key, cur);
  }
  const topElements = Array.from(elemMap.values())
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10)
    .map(el => ({
      ...el,
      share_pct: clicks.length ? Number(((el.clicks / clicks.length) * 100).toFixed(1)) : 0
    }));

  // Scroll zones
  const zoneOrder = ['0-20', '20-40', '40-60', '60-80', '80-100'];
  const zoneCounts = { '0-20': 0, '20-40': 0, '40-60': 0, '60-80': 0, '80-100': 0 };
  for (const e of pageEvents) {
    if (zoneCounts[e.scroll_zone] !== undefined) zoneCounts[e.scroll_zone]++;
  }
  const scrollZones = zoneOrder.map(zone => ({
    zone,
    events: zoneCounts[zone],
    share_pct: pageEvents.length ? Number(((zoneCounts[zone] / pageEvents.length) * 100).toFixed(1)) : 0
  }));

  res.json({
    ok: true,
    site_id: 'dra_odette',
    page_path: pagePath,
    device,
    days,
    totals: {
      clicks: clicks.length,
      scroll_samples: pageEvents.length - clicks.length,
      unique_sessions: sessions,
      avg_doc_h: 3600
    },
    points,
    top_elements: topElements,
    scroll_zones: scrollZones
  });
}

module.exports = router;
