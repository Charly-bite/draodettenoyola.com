/**
 * Dra. Odette Noyola — Express Server
 * Serves the public site + admin panel + API
 */
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9996;

// ─── Body parsers ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── CORS headers for API (same-origin in production) ───
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── API Routes ───
const authRoutes = require('./api/auth');
const contentRoutes = require('./api/content');
const blogRoutes = require('./api/blog');

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/blog', blogRoutes);

// ─── Admin Panel (served from /admin) ───
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
  index: 'index.html',
  extensions: ['html']
}));

// ─── Public Static Site ───
// Cache headers for assets
app.use('/img', express.static(path.join(__dirname, 'img'), {
  maxAge: '365d',
  immutable: true
}));
app.use('/css', express.static(path.join(__dirname, 'css'), {
  maxAge: '1d'
}));
app.use('/js', express.static(path.join(__dirname, 'js'), {
  maxAge: '1d'
}));

// ─── Live Canvas Bridge Injector Middleware ───
const fs = require('fs');
app.use((req, res, next) => {
  if (req.query.canvas && (req.path === '/' || req.path.endsWith('.html') || !req.path.includes('.'))) {
    let relPath = req.path === '/' ? 'index.html' : req.path.replace(/^\//, '');
    if (!relPath.endsWith('.html') && !relPath.includes('.')) relPath += '.html';
    const filePath = path.join(__dirname, relPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      let html = fs.readFileSync(filePath, 'utf-8');
      const bridgeScript = '\n<!-- CANVAS_BRIDGE_START -->\n<script id="canvas-bridge-script" src="/admin/js/canvas-bridge.js"></script>\n<!-- CANVAS_BRIDGE_END -->\n</body>';
      html = html.replace('</body>', bridgeScript);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
  }
  next();
});

// Serve remaining static files (HTML, favicon, manifest, etc.)
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

// ─── Fallback: SPA admin routes ───
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ─── Start ───
app.listen(PORT, () => {
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
