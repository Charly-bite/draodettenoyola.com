/**
 * Content API Routes
 * Manages editable text sections and images for the public site
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAuth } = require('./middleware');

const router = express.Router();

// ─── File paths ───
const CONTENT_FILE = path.join(__dirname, '..', 'data', 'content.json');
const IMAGES_FILE = path.join(__dirname, '..', 'data', 'images.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'img', 'uploads');

// ─── Ensure directories exist ───
if (!fs.existsSync(path.dirname(CONTENT_FILE))) {
  fs.mkdirSync(path.dirname(CONTENT_FILE), { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Multer config for image uploads ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpg, png, webp, svg, gif)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ─── Helper: Read/Write JSON ───
function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ═══════════════════════════════════════
//  SECTIONS (Text Content)
// ═══════════════════════════════════════

// GET /api/content/sections — Get all editable content
router.get('/sections', requireAuth, (req, res) => {
  const content = readJSON(CONTENT_FILE);
  if (!content) {
    return res.status(500).json({ error: 'No se pudo leer el archivo de contenido' });
  }
  res.json(content);
});

// GET /api/content/sections/:sectionId — Get one section
router.get('/sections/:sectionId', requireAuth, (req, res) => {
  const content = readJSON(CONTENT_FILE);
  if (!content) {
    return res.status(500).json({ error: 'No se pudo leer el archivo de contenido' });
  }
  const section = content[req.params.sectionId];
  if (!section) {
    return res.status(404).json({ error: 'Sección no encontrada' });
  }
  res.json(section);
});

// PUT /api/content/sections/:sectionId — Update a section
router.put('/sections/:sectionId', requireAuth, (req, res) => {
  const content = readJSON(CONTENT_FILE);
  if (!content) {
    return res.status(500).json({ error: 'No se pudo leer el archivo de contenido' });
  }

  const sectionId = req.params.sectionId;
  if (!content[sectionId]) {
    return res.status(404).json({ error: 'Sección no encontrada' });
  }

  // Merge updates
  content[sectionId] = { ...content[sectionId], ...req.body };
  content[sectionId]._updatedAt = new Date().toISOString();

  writeJSON(CONTENT_FILE, content);

  // Regenerate index.html with updated content
  try {
    applyContentToHTML(content);
  } catch (err) {
    console.error('Error applying content to HTML:', err);
  }

  res.json({ success: true, section: content[sectionId] });
});

// ═══════════════════════════════════════
//  IMAGES
// ═══════════════════════════════════════

// GET /api/content/images — List all registered images
router.get('/images', requireAuth, (req, res) => {
  const images = readJSON(IMAGES_FILE) || [];
  res.json(images);
});

// POST /api/content/images — Upload a new image
router.post('/images', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }

  const images = readJSON(IMAGES_FILE) || [];
  const newImage = {
    id: `img-${Date.now()}`,
    filename: req.file.filename,
    path: `img/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
    alt: req.body.alt || '',
    section: req.body.section || 'general',
    uploadedAt: new Date().toISOString()
  };

  images.push(newImage);
  writeJSON(IMAGES_FILE, images);

  res.json({ success: true, image: newImage });
});

// PUT /api/content/images/:imageId — Replace an existing image
router.put('/images/:imageId', requireAuth, upload.single('image'), (req, res) => {
  const images = readJSON(IMAGES_FILE) || [];
  const idx = images.findIndex(img => img.id === req.params.imageId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  // Delete old file if it's in uploads/
  const oldPath = path.join(__dirname, '..', images[idx].path);
  if (images[idx].path.startsWith('img/uploads/') && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }

  if (req.file) {
    images[idx].filename = req.file.filename;
    images[idx].path = `img/uploads/${req.file.filename}`;
    images[idx].originalName = req.file.originalname;
    images[idx].size = req.file.size;
  }

  if (req.body.alt) images[idx].alt = req.body.alt;
  if (req.body.section) images[idx].section = req.body.section;
  images[idx].updatedAt = new Date().toISOString();

  writeJSON(IMAGES_FILE, images);
  res.json({ success: true, image: images[idx] });
});

// DELETE /api/content/images/:imageId — Delete an image
router.delete('/images/:imageId', requireAuth, (req, res) => {
  const images = readJSON(IMAGES_FILE) || [];
  const idx = images.findIndex(img => img.id === req.params.imageId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Imagen no encontrada' });
  }

  // Delete file if it's in uploads/
  const filePath = path.join(__dirname, '..', images[idx].path);
  if (images[idx].path.startsWith('img/uploads/') && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  images.splice(idx, 1);
  writeJSON(IMAGES_FILE, images);
  res.json({ success: true });
});

// ═══════════════════════════════════════
//  LIVE CANVAS API
// ═══════════════════════════════════════

// GET /api/content/page-list — Returns list of editable pages
router.get('/page-list', requireAuth, (req, res) => {
  const pages = [
    { id: 'index.html', title: 'Página Principal (Inicio)', url: '/?canvas=1', path: 'index.html' },
    { id: 'ultrasonido-estructural.html', title: 'Ultrasonido Estructural', url: '/ultrasonido-estructural.html?canvas=1', path: 'ultrasonido-estructural.html' },
    { id: 'blog/index.html', title: 'Blog Principal', url: '/blog/?canvas=1', path: 'blog/index.html' }
  ];
  res.json(pages);
});

// POST /api/content/canvas-save — Saves edited HTML from Live Canvas
router.post('/canvas-save', requireAuth, (req, res) => {
  try {
    const { page, html } = req.body;
    if (!page || !html) {
      return res.status(400).json({ error: 'Parámetros "page" y "html" requeridos' });
    }

    // Safety: prevent directory traversal
    const safePage = path.normalize(page).replace(/^(\.\.[\/\\])+/, '');
    const targetPath = path.join(__dirname, '..', safePage);

    // Ensure target path is inside project root
    const projectRoot = path.resolve(__dirname, '..');
    if (!path.resolve(targetPath).startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Ruta no permitida' });
    }

    // Clean up canvas-specific artifacts from the HTML
    let cleanHtml = html
      // Remove contenteditable attributes
      .replace(/\s*contenteditable="true"/gi, '')
      .replace(/\s*contenteditable="false"/gi, '')
      .replace(/\s*contenteditable=""/gi, '')
      .replace(/\s*contenteditable/gi, '')
      .replace(/\s*spellcheck="false"/gi, '')
      // Remove canvas selection / hover classes
      .replace(/\bcanvas-selected\b/g, '')
      .replace(/\bcanvas-hover\b/g, '')
      .replace(/\bcanvas-editing\b/g, '')
      // Clean up empty class attributes
      .replace(/class="\s*"/g, '')
      .replace(/class=""/g, '')
      // Remove canvas bridge scripts / styles if any were injected
      .replace(/<!-- CANVAS_BRIDGE_START -->[\s\S]*?<!-- CANVAS_BRIDGE_END -->/gi, '')
      .replace(/<script[^>]*id="canvas-bridge-script"[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*id="canvas-bridge-style"[^>]*>[\s\S]*?<\/style>/gi, '')
      .trim();

    // Write file
    fs.writeFileSync(targetPath, cleanHtml, 'utf-8');

    console.log(`✅ Live Canvas saved: ${safePage} (${cleanHtml.length} bytes)`);
    res.json({ success: true, message: `Página "${safePage}" guardada y publicada exitosamente` });
  } catch (err) {
    console.error('Error saving canvas page:', err);
    res.status(500).json({ error: 'Error al guardar la página: ' + err.message });
  }
});

// ═══════════════════════════════════════
//  HTML Content Application
// ═══════════════════════════════════════

/**
 * Apply content.json changes to index.html
 * Uses data-editable attributes to find and replace content
 */
function applyContentToHTML(content) {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');

  if (content.hero) {
    if (content.hero.titleAccent) {
      html = html.replace(
        /(<span class="hero__title-accent">)(.*?)(<\/span>)/s,
        `$1${content.hero.titleAccent}$3`
      );
    }
    if (content.hero.titleSuffix) {
      html = html.replace(
        /(<span class="hero__title-accent">.*?<\/span><br>\s*)([\s\S]*?)(\s*<\/h1>)/,
        `$1${content.hero.titleSuffix}\n$3`
      );
    }
    if (content.hero.name) {
      html = html.replace(
        /(<p class="hero__name reveal">)(.*?)(<\/p>)/s,
        `$1${content.hero.name}$3`
      );
    }
  }

  if (content.promo) {
    if (content.promo.text) {
      html = html.replace(
        /(<div class="promo-banner"[^>]*>\s*<p>)([\s\S]*?)(<\/p>)/,
        `$1${content.promo.text}$3`
      );
    }
  }

  if (content.about) {
    if (content.about.name) {
      html = html.replace(
        /(<h2 class="about__name">)(.*?)(<\/h2>)/s,
        `$1${content.about.name}$3`
      );
    }
    if (content.about.specialty) {
      html = html.replace(
        /(<p class="about__specialty">)(.*?)(<\/p>)/s,
        `$1${content.about.specialty}$3`
      );
    }
  }

  fs.writeFileSync(htmlPath, html, 'utf-8');
}

module.exports = router;
