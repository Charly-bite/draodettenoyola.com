/**
 * Dra. Odette Noyola — Express Server
 * Hardened static allowlist + canonical 301 redirects + security headers + admin panel + API
 */
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9996;
const CANONICAL_ORIGIN = 'https://draodettenoyola.com';

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Global crash prevention for background server resilience
process.on('uncaughtException', (err) => {
  console.error('[!] Uncaught Exception prevented crash:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[!] Unhandled Rejection prevented crash:', reason?.message || reason);
});

// ─── Body parsers ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Security Headers Middleware ───
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.path === '/admin' || req.path.startsWith('/admin/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// ─── Canonical 301 Redirects (Host/Proto + Path in 1 hop) ───
const PATH_REDIRECTS = new Map([
  ['/index.html', '/'],
  ['/blog', '/blog/'],
  ['/blog/index.html', '/blog/'],
  ['/chequeo-ginecologico-guadalajara', '/chequeo-ginecologico-guadalajara.html'],
  ['/consulta-ginecologica-guadalajara', '/consulta-ginecologica-guadalajara.html'],
  ['/ultrasonido-estructural', '/ultrasonido-estructural.html'],
  ['/aviso-de-privacidad', '/aviso-de-privacidad.html'],
  ['/blog/ginecologa-en-guadalajara-chequeo-integral.html', '/chequeo-ginecologico-guadalajara.html'],
  ['/blog/ginecologa-en-guadalajara-chequeo-integral', '/chequeo-ginecologico-guadalajara.html']
]);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/api') return next();

  const rawHost = (req.headers.host || '').toLowerCase();
  const hostNoPort = rawHost.split(':')[0];
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const isWwwProd = hostNoPort === 'www.draodettenoyola.com';
  const isHttpProd = hostNoPort === 'draodettenoyola.com' && forwardedProto === 'http';

  const qIndex = req.originalUrl.indexOf('?');
  const queryString = qIndex >= 0 ? req.originalUrl.slice(qIndex) : '';
  const targetPath = PATH_REDIRECTS.get(req.path);

  if (isWwwProd || isHttpProd) {
    const destPath = targetPath || req.path;
    return res.redirect(301, `${CANONICAL_ORIGIN}${destPath}${queryString}`);
  }

  if (targetPath && (req.method === 'GET' || req.method === 'HEAD')) {
    return res.redirect(301, `${targetPath}${queryString}`);
  }

  next();
});

// ─── Explicit Blocklist for Sensitive Files & Internal Paths ───
const BLOCKED_PATH_RE = /^\/(\.|server\.js$|package(-lock)?\.json$|render\.yaml$|OBJETIVOS_SEO\.md$|plantilla_terminos\.pdf$|start-dev\.ps1$|odette_server\.log$|data(\/|$)|_source(\/|$)|consultorio(\/|$)|update18(\/|$)|node_modules(\/|$)|Nuevas_fotos(\/|$)|logos(\/|$)|AC[A-F0-9]+\.jpg$)/i;
const BLOCKED_EXT_RE = /\.(md|env|ps1|log|bak|sql|sqlite|db)$/i;

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/api') return next();
  if (BLOCKED_PATH_RE.test(req.path) || BLOCKED_EXT_RE.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  next();
});

// ─── CORS headers for API ───
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Heatmap-Key, X-Odette-Bridge-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── API Routes ───
const authRoutes = require('./api/auth');
const contentRoutes = require('./api/content');
const blogRoutes = require('./api/blog');
const contactRoutes = require('./api/contact');
const heatmapRoutes = require('./api/heatmap');
const waosRoutes = require('./api/waos');
const { router: seoRoutes } = require('./api/seo');

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/waos', waosRoutes);
app.use('/api/seo', seoRoutes);

// Keep JSON 404 for unmatched /api/* routes (also blocks /api/*.js fallthrough)
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint no encontrado' });
});

// ─── Admin Panel (served from /admin) ───
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
  index: 'index.html',
  dotfiles: 'deny'
}));

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ─── Public Static Subdirectories (Strict Allowlist) ───
app.use('/img', express.static(path.join(__dirname, 'img'), {
  maxAge: '365d',
  immutable: true,
  dotfiles: 'deny'
}));
app.use('/css', express.static(path.join(__dirname, 'css'), {
  maxAge: '1d',
  dotfiles: 'deny'
}));
app.use('/js', express.static(path.join(__dirname, 'js'), {
  maxAge: '1d',
  dotfiles: 'deny'
}));

// ─── Strict Root File Allowlist ───
const ALLOWED_ROOT_HTML = new Set([
  'index.html',
  'chequeo-ginecologico-guadalajara.html',
  'consulta-ginecologica-guadalajara.html',
  'ultrasonido-estructural.html',
  'aviso-de-privacidad.html',
  '404.html'
]);

const ALLOWED_ROOT_ASSETS = new Set([
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'manifest.json',
  '8f4b2e91c7d34a659e12b804f5a3c712.txt',
  'favicon.ico',
  'apple-touch-icon.png'
]);

// ─── Live Canvas Bridge Injector Middleware (Allowlisted HTML only) ───
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && req.query.canvas) {
    let targetFile = null;
    if (req.path === '/') {
      targetFile = path.join(__dirname, 'index.html');
    } else if (req.path === '/blog/') {
      targetFile = path.join(__dirname, 'blog', 'index.html');
    } else if (req.path.startsWith('/') && !req.path.slice(1).includes('/')) {
      const name = req.path.slice(1);
      if (ALLOWED_ROOT_HTML.has(name)) {
        targetFile = path.join(__dirname, name);
      }
    }

    if (targetFile && fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      let html = fs.readFileSync(targetFile, 'utf-8');
      const bridgeScript = '\n<!-- CANVAS_BRIDGE_START -->\n<script id="canvas-bridge-script" src="/admin/js/canvas-bridge.js"></script>\n<!-- CANVAS_BRIDGE_END -->\n</body>';
      html = html.replace('</body>', bridgeScript);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
  }
  next();
});

// ─── Public /blog/* Static Directory (no extensionless duplicates) ───
app.use('/blog', express.static(path.join(__dirname, 'blog'), {
  index: 'index.html',
  dotfiles: 'deny'
}));

// ─── Serve Allowlisted Root Pages & Assets ───
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  const file = req.params.file;
  if (ALLOWED_ROOT_HTML.has(file)) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.sendFile(path.join(__dirname, file));
  }
  if (ALLOWED_ROOT_ASSETS.has(file)) {
    const cacheHeader = /\.(ico|png)$/i.test(file)
      ? 'public, max-age=2592000'
      : 'public, max-age=3600';
    res.setHeader('Cache-Control', cacheHeader);
    return res.sendFile(path.join(__dirname, file));
  }
  next();
});

// ─── Branded 404 Fallback for Unmatched Non-API Routes ───
app.use((req, res) => {
  const notFoundPage = path.join(__dirname, '404.html');
  res.status(404);
  if (fs.existsSync(notFoundPage)) {
    return res.sendFile(notFoundPage);
  }
  res.type('text/plain').send('Not found');
});

// ─── Start ───
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   Dra. Odette Noyola — Server Running                ║
╠═══════════════════════════════════════════════════════╣
║   🌐 Public site:  http://localhost:${PORT}/             ║
║   🔐 Admin panel:  http://localhost:${PORT}/admin        ║
║   📡 API:          http://localhost:${PORT}/api          ║
╚═══════════════════════════════════════════════════════╝
  `);
});
