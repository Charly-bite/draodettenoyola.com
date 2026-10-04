/**
 * Blog API Routes
 * Full CRUD for blog posts with Markdown support and static HTML generation
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const slugify = require('slugify');
const multer = require('multer');
const { requireAuth } = require('./middleware');

const router = express.Router();

// ─── File paths ───
const POSTS_FILE = path.join(__dirname, '..', 'data', 'blog-posts.json');
const BLOG_DIR = path.join(__dirname, '..', 'blog');
const TEMPLATE_FILE = path.join(__dirname, '..', 'templates', 'blog-post.html');
const BLOG_INDEX_TEMPLATE = path.join(__dirname, '..', 'templates', 'blog-index.html');
const BLOG_UPLOAD_DIR = path.join(__dirname, '..', 'img', 'blog');

// ─── Ensure directories exist ───
[path.dirname(POSTS_FILE), BLOG_DIR, BLOG_UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Multer for blog cover images ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BLOG_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

// ─── Helpers ───
function readPosts() {
  try {
    return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
}

function generateSlug(title) {
  return slugify(title, { lower: true, strict: true, locale: 'es' });
}

// Configure marked for safe HTML output
marked.setOptions({
  breaks: true,
  gfm: true
});

// ═══════════════════════════════════════
//  CRUD Operations
// ═══════════════════════════════════════

// GET /api/blog/posts — List all posts
router.get('/posts', requireAuth, (req, res) => {
  const posts = readPosts();
  // Return summary (no full content) for list view
  const summaries = posts.map(({ content, ...rest }) => ({
    ...rest,
    contentLength: content ? content.length : 0
  }));
  res.json(summaries);
});

// GET /api/blog/posts/:slug — Get a single post with full content
router.get('/posts/:slug', requireAuth, (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  if (!post) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }
  res.json(post);
});

// POST /api/blog/posts — Create a new post
router.post('/posts', requireAuth, upload.single('coverImage'), (req, res) => {
  const posts = readPosts();
  const { title, excerpt, content, tags, metaDescription, metaKeywords } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Título y contenido son requeridos' });
  }

  let slug = generateSlug(title);

  // Ensure unique slug
  let slugCounter = 1;
  let originalSlug = slug;
  while (posts.find(p => p.slug === slug)) {
    slug = `${originalSlug}-${slugCounter++}`;
  }

  const newPost = {
    slug,
    title,
    excerpt: excerpt || '',
    content,
    coverImage: req.file ? `img/blog/${req.file.filename}` : '',
    tags: tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [],
    metaDescription: metaDescription || excerpt || '',
    metaKeywords: metaKeywords || '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null
  };

  posts.push(newPost);
  writePosts(posts);

  res.status(201).json({ success: true, post: newPost });
});

// PUT /api/blog/posts/:slug — Update a post
router.put('/posts/:slug', requireAuth, upload.single('coverImage'), (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.slug === req.params.slug);

  if (idx === -1) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  const { title, excerpt, content, tags, metaDescription, metaKeywords } = req.body;

  if (title) posts[idx].title = title;
  if (excerpt !== undefined) posts[idx].excerpt = excerpt;
  if (content !== undefined) posts[idx].content = content;
  if (metaDescription !== undefined) posts[idx].metaDescription = metaDescription;
  if (metaKeywords !== undefined) posts[idx].metaKeywords = metaKeywords;
  if (tags) {
    posts[idx].tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
  }
  if (req.file) {
    posts[idx].coverImage = `img/blog/${req.file.filename}`;
  }

  posts[idx].updatedAt = new Date().toISOString();
  writePosts(posts);

  // If published, regenerate static HTML
  if (posts[idx].status === 'published') {
    generateStaticPost(posts[idx]);
    generateBlogIndex(posts);
  }

  res.json({ success: true, post: posts[idx] });
});

// DELETE /api/blog/posts/:slug — Delete a post
router.delete('/posts/:slug', requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.slug === req.params.slug);

  if (idx === -1) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  const post = posts[idx];

  // Remove static HTML if it exists
  const htmlPath = path.join(BLOG_DIR, `${post.slug}.html`);
  if (fs.existsSync(htmlPath)) {
    fs.unlinkSync(htmlPath);
  }

  // Remove cover image if in blog uploads
  if (post.coverImage && post.coverImage.startsWith('img/blog/')) {
    const imgPath = path.join(__dirname, '..', post.coverImage);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  posts.splice(idx, 1);
  writePosts(posts);
  generateBlogIndex(posts);

  res.json({ success: true });
});

// ═══════════════════════════════════════
//  Publish / Unpublish
// ═══════════════════════════════════════

// POST /api/blog/posts/:slug/publish
router.post('/posts/:slug/publish', requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.slug === req.params.slug);

  if (idx === -1) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  posts[idx].status = 'published';
  posts[idx].publishedAt = posts[idx].publishedAt || new Date().toISOString();
  posts[idx].updatedAt = new Date().toISOString();

  writePosts(posts);

  // Generate static HTML
  generateStaticPost(posts[idx]);
  generateBlogIndex(posts);

  res.json({ success: true, post: posts[idx] });
});

// POST /api/blog/posts/:slug/unpublish
router.post('/posts/:slug/unpublish', requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.slug === req.params.slug);

  if (idx === -1) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  posts[idx].status = 'draft';
  posts[idx].updatedAt = new Date().toISOString();

  // Remove static HTML
  const htmlPath = path.join(BLOG_DIR, `${posts[idx].slug}.html`);
  if (fs.existsSync(htmlPath)) {
    fs.unlinkSync(htmlPath);
  }

  writePosts(posts);
  generateBlogIndex(posts);

  res.json({ success: true, post: posts[idx] });
});

// ═══════════════════════════════════════
//  Static HTML Generation
// ═══════════════════════════════════════

function generateStaticPost(post) {
  try {
    let template;
    if (fs.existsSync(TEMPLATE_FILE)) {
      template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
    } else {
      template = getDefaultTemplate();
    }

    const htmlContent = marked.parse(post.content);
    const publishDate = post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString('es-MX', {
          year: 'numeric', month: 'long', day: 'numeric'
        })
      : '';

    let html = template
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{metaDescription\}\}/g, post.metaDescription || post.excerpt)
      .replace(/\{\{metaKeywords\}\}/g, post.metaKeywords || '')
      .replace(/\{\{slug\}\}/g, post.slug)
      .replace(/\{\{excerpt\}\}/g, post.excerpt)
      .replace(/\{\{content\}\}/g, htmlContent)
      .replace(/\{\{coverImage\}\}/g, post.coverImage ? `../${post.coverImage}` : '../img/hero-portrait.jpg')
      .replace(/\{\{publishDate\}\}/g, publishDate)
      .replace(/\{\{tags\}\}/g, post.tags.map(t => `<span class="blog-tag">${t}</span>`).join(' '));

    const outputPath = path.join(BLOG_DIR, `${post.slug}.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`✅ Generated: blog/${post.slug}.html`);
  } catch (err) {
    console.error('Error generating static post:', err);
  }
}

function generateBlogIndex(posts) {
  try {
    const published = posts
      .filter(p => p.status === 'published')
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    let template;
    if (fs.existsSync(BLOG_INDEX_TEMPLATE)) {
      template = fs.readFileSync(BLOG_INDEX_TEMPLATE, 'utf-8');
    } else {
      template = getDefaultBlogIndexTemplate();
    }

    const cardsHTML = published.map(post => {
      const date = new Date(post.publishedAt).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      return `
      <article class="blog-card">
        <a href="${post.slug}.html" class="blog-card__link">
          ${post.coverImage ? `<img src="../${post.coverImage}" alt="${post.title}" class="blog-card__img" loading="lazy">` : ''}
          <div class="blog-card__body">
            <time class="blog-card__date">${date}</time>
            <h2 class="blog-card__title">${post.title}</h2>
            <p class="blog-card__excerpt">${post.excerpt}</p>
            <div class="blog-card__tags">${post.tags.map(t => `<span class="blog-tag">${t}</span>`).join(' ')}</div>
            <span class="blog-card__read">Leer artículo →</span>
          </div>
        </a>
      </article>`;
    }).join('\n');

    const html = template.replace('{{blogCards}}', cardsHTML);
    const outputPath = path.join(BLOG_DIR, 'index.html');
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`✅ Generated: blog/index.html (${published.length} posts)`);
  } catch (err) {
    console.error('Error generating blog index:', err);
  }
}

// ─── Default templates (fallback) ───
function getDefaultTemplate() {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} | Dra. Odette Noyola</title>
  <meta name="description" content="{{metaDescription}}">
  <meta name="keywords" content="{{metaKeywords}}">
  <meta name="author" content="Dra. Odette Noyola Landázuri">
  <link rel="canonical" href="https://draodettenoyola.com/blog/{{slug}}.html">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{metaDescription}}">
  <meta property="og:image" content="{{coverImage}}">
  <link rel="icon" type="image/svg+xml" href="../img/favicon.svg?v=3.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #04080F; --surface: #0B1827; --border: #1a2d44;
      --text: #e8edf3; --muted: #8a9bb5; --teal: #14A8A1; --rose: #E489A2;
      --font-display: 'Plus Jakarta Sans', sans-serif; --font-body: 'Inter', sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: var(--bg); color: var(--text); line-height: 1.7; }
    .blog-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 0; }
    .blog-header__inner { max-width: 800px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .blog-header__back { color: var(--teal); text-decoration: none; font-weight: 600; }
    .blog-header__back:hover { text-decoration: underline; }
    .blog-hero { max-width: 800px; margin: 3rem auto 0; padding: 0 1.5rem; }
    .blog-hero__cover { width: 100%; border-radius: 16px; margin-bottom: 2rem; }
    .blog-hero__date { color: var(--teal); font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .blog-hero__title { font-family: var(--font-display); font-size: clamp(1.75rem, 4vw, 2.75rem); font-weight: 800; line-height: 1.2; margin: 0.75rem 0 1rem; }
    .blog-hero__excerpt { color: var(--muted); font-size: 1.125rem; line-height: 1.6; }
    .blog-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
    .blog-tag { background: rgba(20, 168, 161, 0.15); color: var(--teal); padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 500; }
    .blog-content { max-width: 800px; margin: 2rem auto 4rem; padding: 0 1.5rem; }
    .blog-content h2 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; color: var(--teal); }
    .blog-content h3 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
    .blog-content p { margin-bottom: 1rem; color: var(--text); }
    .blog-content ul, .blog-content ol { margin: 1rem 0 1rem 1.5rem; }
    .blog-content li { margin-bottom: 0.5rem; }
    .blog-content blockquote { border-left: 3px solid var(--teal); padding: 1rem 1.5rem; margin: 1.5rem 0; background: rgba(20, 168, 161, 0.05); border-radius: 0 8px 8px 0; }
    .blog-content img { max-width: 100%; border-radius: 12px; margin: 1.5rem 0; }
    .blog-content strong { color: var(--teal); }
    .blog-content a { color: var(--teal); }
    .blog-footer { background: var(--surface); border-top: 1px solid var(--border); padding: 2rem 0; text-align: center; }
    .blog-footer__inner { max-width: 800px; margin: 0 auto; padding: 0 1.5rem; }
    .blog-footer a { color: var(--teal); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <header class="blog-header">
    <div class="blog-header__inner">
      <a href="../index.html" class="blog-header__back">← Inicio</a>
      <a href="index.html" class="blog-header__back">Blog</a>
    </div>
  </header>
  <main>
    <div class="blog-hero">
      <img src="{{coverImage}}" alt="{{title}}" class="blog-hero__cover">
      <time class="blog-hero__date">{{publishDate}}</time>
      <h1 class="blog-hero__title">{{title}}</h1>
      <p class="blog-hero__excerpt">{{excerpt}}</p>
      <div class="blog-tags">{{tags}}</div>
    </div>
    <article class="blog-content">
      {{content}}
    </article>
  </main>
  <footer class="blog-footer">
    <div class="blog-footer__inner">
      <p>Dra. Odette Noyola Landázuri · <a href="https://wa.me/523327905726">Agendar Cita</a></p>
    </div>
  </footer>
</body>
</html>`;
}

function getDefaultBlogIndexTemplate() {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog Clínico | Dra. Odette Noyola Landázuri</title>
  <meta name="description" content="Artículos médicos y guías de diagnóstico prenatal por la Dra. Odette Noyola.">
  <link rel="icon" type="image/svg+xml" href="../img/favicon.svg?v=3.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #04080F; --surface: #0B1827; --border: #1a2d44;
      --text: #e8edf3; --muted: #8a9bb5; --teal: #14A8A1; --rose: #E489A2;
      --font-display: 'Plus Jakarta Sans', sans-serif; --font-body: 'Inter', sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: var(--bg); color: var(--text); line-height: 1.7; }
    .blog-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 0; }
    .blog-header__inner { max-width: 1000px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .blog-header__back { color: var(--teal); text-decoration: none; font-weight: 600; }
    .blog-index { max-width: 1000px; margin: 3rem auto; padding: 0 1.5rem; }
    .blog-index__title { font-family: var(--font-display); font-size: 2.25rem; font-weight: 800; margin-bottom: 0.5rem; }
    .blog-index__subtitle { color: var(--muted); margin-bottom: 2.5rem; }
    .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .blog-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; transition: transform 0.3s, box-shadow 0.3s; }
    .blog-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
    .blog-card__link { text-decoration: none; color: inherit; display: block; }
    .blog-card__img { width: 100%; height: 200px; object-fit: cover; }
    .blog-card__body { padding: 1.25rem; }
    .blog-card__date { color: var(--teal); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .blog-card__title { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; margin: 0.5rem 0; line-height: 1.3; }
    .blog-card__excerpt { color: var(--muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 0.75rem; }
    .blog-card__tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .blog-tag { background: rgba(20, 168, 161, 0.15); color: var(--teal); padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
    .blog-card__read { color: var(--teal); font-weight: 600; font-size: 0.9rem; }
  </style>
</head>
<body>
  <header class="blog-header">
    <div class="blog-header__inner">
      <a href="../index.html" class="blog-header__back">← Inicio</a>
    </div>
  </header>
  <main class="blog-index">
    <h1 class="blog-index__title">Blog Clínico</h1>
    <p class="blog-index__subtitle">Artículos médicos y guías de diagnóstico prenatal</p>
    <div class="blog-grid">
      {{blogCards}}
    </div>
  </main>
</body>
</html>`;
}

module.exports = router;
