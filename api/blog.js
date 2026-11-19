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
const SITE_URL = 'https://draodettenoyola.com';
const ASSET_VERSION = '6.0';

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

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSeoTitle(post) {
  if (post.seoTitle && post.seoTitle.trim().length <= 60) {
    return post.seoTitle.trim();
  }
  const suffix = ' | Dra. Odette';
  const base = (post.title || '').trim();
  if (base.length + suffix.length <= 60) {
    return `${base}${suffix}`;
  }
  return `${base.slice(0, 60 - suffix.length - 1).trim()}…${suffix}`;
}

function buildMetaDescription(post) {
  const raw = (post.metaDescription || post.excerpt || '').replace(/\s+/g, ' ').trim();
  if (raw.length <= 155) return raw;
  return `${raw.slice(0, 152).trim()}...`;
}

function resolveCoverPaths(coverImage) {
  const clean = (coverImage || 'img/hero-portrait.jpg')
    .replace(/^https?:\/\/draodettenoyola\.com\//i, '')
    .replace(/^\.\.\//, '')
    .replace(/^\/+/, '');
  return {
    relSrc: `../${clean}`,
    absUrl: `${SITE_URL}/${clean}`
  };
}

function stripMarkdownToText(md) {
  return String(md || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/(^|\s)\*([^*]+)\*/g, '$1$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s*/gm, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFaqEntries(markdown) {
  const faqEntries = [];
  const faqRegex = /^#{2,3}\s+(¿[^\n?]+\?)\s*\r?\n+([\s\S]*?)(?=\r?\n#{1,6}\s|\r?\n>\s|$)/gim;
  let fm;
  while ((fm = faqRegex.exec(markdown || '')) !== null) {
    const q = fm[1].trim();
    const a = stripMarkdownToText(fm[2]);
    if (q && a && a.length >= 25) {
      faqEntries.push({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      });
    }
  }
  return faqEntries;
}

function isMaternoFetalPost(post) {
  const hay = `${post.slug || ''} ${post.title || ''} ${(post.tags || []).join(' ')}`.toLowerCase();
  return /ultrasonido|tamizaje|embarazo|alto-riesgo|materno|prenatal|fetal|preeclampsia/.test(hay);
}

function buildContextualServicesHtml(post) {
  const isMfm = isMaternoFetalPost(post);
  const cards = isMfm
    ? [
        {
          href: '/ultrasonido-estructural.html',
          title: 'Ultrasonido Estructural Fetal ($1,700 MXN)',
          desc: 'Evaluación anatómica órgano por órgano (semanas 18–24) con GE Voluson HDlive y certificación FMF.'
        },
        {
          href: '/consulta-ginecologica-guadalajara.html',
          title: 'Consulta Ginecológica y Control Prenatal ($800 MXN)',
          desc: 'Seguimiento de embarazo de bajo y alto riesgo en Chapalita Oriente, Guadalajara / Zapopan.'
        },
        {
          href: '/chequeo-ginecologico-guadalajara.html',
          title: 'Chequeo Ginecológico Completo ($1,200 MXN)',
          desc: 'Consulta, Papanicolaou, colposcopía, vaginoscopía, ultrasonido pélvico y revisión mamaria.'
        }
      ]
    : [
        {
          href: '/chequeo-ginecologico-guadalajara.html',
          title: 'Chequeo Ginecológico Completo ($1,200 MXN)',
          desc: 'Consulta especializada, Papanicolaou, colposcopía, vaginoscopía, ultrasonido pélvico y mamas en una sola cita.'
        },
        {
          href: '/consulta-ginecologica-guadalajara.html',
          title: 'Consulta Ginecológica Integral ($800 MXN)',
          desc: 'Diagnóstico y tratamiento personalizado de SOP, miomas, infecciones, anticoncepción y control hormonal.'
        },
        {
          href: '/ultrasonido-estructural.html',
          title: 'Ultrasonido Estructural y Medicina Materno Fetal ($1,700 MXN)',
          desc: 'Diagnóstico prenatal avanzado con tecnología GE Voluson HDlive en Chapalita Oriente.'
        }
      ];

  return `
      <aside class="related-services-box" aria-label="Servicios médicos relacionados">
        <h2>Servicios Relacionados en Nuestro Consultorio</h2>
        <div class="related-services-grid">
          ${cards
            .map(
              c => `<a href="${c.href}" class="related-service-card">
            <strong>${c.title}</strong>
            <span>${c.desc}</span>
          </a>`
            )
            .join('\n          ')}
        </div>
      </aside>`;
}

function buildStrictGtagSnippet() {
  return `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-KT9E760LFF"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    if (/^(www\\.)?draodettenoyola\\.com$/i.test(window.location.hostname)) {
      gtag('js', new Date());
      gtag('config', 'G-KT9E760LFF');
    }
  </script>`;
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
  const { title, seoTitle, excerpt, content, tags, metaDescription, metaKeywords, ctaTopic } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Título y contenido son requeridos' });
  }

  let slug = generateSlug(title);
  let slugCounter = 1;
  const originalSlug = slug;
  while (posts.find(p => p.slug === slug)) {
    slug = `${originalSlug}-${slugCounter++}`;
  }

  const newPost = {
    slug,
    title,
    seoTitle: seoTitle || '',
    excerpt: excerpt || '',
    content,
    coverImage: req.file ? `img/blog/${req.file.filename}` : '',
    tags: tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [],
    metaDescription: metaDescription || excerpt || '',
    metaKeywords: metaKeywords || '',
    ctaTopic: ctaTopic || '',
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

  const { title, seoTitle, excerpt, content, tags, metaDescription, metaKeywords, ctaTopic } = req.body;

  if (title) posts[idx].title = title;
  if (seoTitle !== undefined) posts[idx].seoTitle = seoTitle;
  if (excerpt !== undefined) posts[idx].excerpt = excerpt;
  if (content !== undefined) posts[idx].content = content;
  if (metaDescription !== undefined) posts[idx].metaDescription = metaDescription;
  if (metaKeywords !== undefined) posts[idx].metaKeywords = metaKeywords;
  if (ctaTopic !== undefined) posts[idx].ctaTopic = ctaTopic;
  if (tags) {
    posts[idx].tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
  }
  if (req.file) {
    posts[idx].coverImage = `img/blog/${req.file.filename}`;
  }

  posts[idx].updatedAt = new Date().toISOString();
  writePosts(posts);

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
  const htmlPath = path.join(BLOG_DIR, `${post.slug}.html`);
  if (fs.existsSync(htmlPath)) {
    fs.unlinkSync(htmlPath);
  }

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
  generateStaticPost(posts[idx]);
  generateBlogIndex(posts);

  res.json({ success: true, post: posts[idx] });
});

router.post('/posts/:slug/unpublish', requireAuth, (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.slug === req.params.slug);

  if (idx === -1) {
    return res.status(404).json({ error: 'Post no encontrado' });
  }

  posts[idx].status = 'draft';
  posts[idx].updatedAt = new Date().toISOString();

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

    const htmlContent = marked.parse(post.content || '');
    const publishDate = post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : '';

    const seoTitle = buildSeoTitle(post);
    const metaDesc = buildMetaDescription(post);
    const { relSrc, absUrl } = resolveCoverPaths(post.coverImage);
    const ctaTopic = post.ctaTopic || post.title;
    const waText = encodeURIComponent(
      `Hola Dra. Odette, leí su guía sobre ${ctaTopic} y me gustaría agendar una cita en Chapalita.`
    );
    const waUrl = `https://wa.me/523327905726?text=${waText}`;
    const relatedServicesHtml = buildContextualServicesHtml(post);

    let html = template
      .replace(/\{\{seoTitle\}\}/g, escapeAttr(seoTitle))
      .replace(/\{\{title\}\}/g, post.title)
      .replace(/\{\{titleAttr\}\}/g, escapeAttr(post.title))
      .replace(/\{\{metaDescription\}\}/g, escapeAttr(metaDesc))
      .replace(/\{\{metaKeywords\}\}/g, escapeAttr(post.metaKeywords || ''))
      .replace(/\{\{slug\}\}/g, post.slug)
      .replace(/\{\{excerpt\}\}/g, post.excerpt || '')
      .replace(/\{\{content\}\}/g, htmlContent)
      .replace(/\{\{coverImage\}\}/g, relSrc)
      .replace(/\{\{coverImageAbs\}\}/g, absUrl)
      .replace(/\{\{publishDate\}\}/g, publishDate)
      .replace(/\{\{waUrl\}\}/g, waUrl)
      .replace(/\{\{ctaTopic\}\}/g, ctaTopic)
      .replace(/\{\{relatedServices\}\}/g, relatedServicesHtml)
      .replace(/\{\{tags\}\}/g, (post.tags || []).map(t => `<span class="blog-tag">${t}</span>`).join(' '));

    const faqEntries = extractFaqEntries(post.content || '');
    const postUrl = `${SITE_URL}/blog/${post.slug}.html`;

    const graphNodes = [
      {
        '@type': ['BlogPosting', 'MedicalWebPage'],
        '@id': `${postUrl}#article`,
        headline: post.title,
        description: metaDesc,
        image: absUrl,
        url: postUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
        inLanguage: 'es-MX',
        datePublished: post.publishedAt || new Date().toISOString(),
        dateModified: post.updatedAt || new Date().toISOString(),
        author: { '@id': `${SITE_URL}/#physician` },
        publisher: { '@id': `${SITE_URL}/#clinic` }
      },
      {
        '@type': 'Physician',
        '@id': `${SITE_URL}/#physician`,
        name: 'Dra. Odette Noyola Landázuri',
        alternateName: 'Dra. Giselle Odette Noyola Landázuri',
        url: `${SITE_URL}/`,
        image: `${SITE_URL}/img/dra-odette-noyola-ginecologa-guadalajara.jpg`,
        telephone: '+523327905726',
        medicalSpecialty: [
          'https://schema.org/Gynecologic',
          'https://schema.org/Obstetric'
        ],
        hasCredential: [
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Cédula Profesional SEP', identifier: '13408368' },
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Cédula Especialidad Ginecología y Obstetricia SEP', identifier: '14815515' },
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Cédula Subespecialidad Medicina Materno Fetal SEP', identifier: '15692501' },
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Certificación CMGO y Fetal Medicine Foundation (FMF)' }
        ],
        worksFor: { '@id': `${SITE_URL}/#clinic` }
      },
      {
        '@type': 'MedicalClinic',
        '@id': `${SITE_URL}/#clinic`,
        name: 'Consultorio Dra. Odette Noyola Landázuri · Ginecología y Medicina Materno Fetal',
        url: `${SITE_URL}/`,
        telephone: '+523327905726',
        priceRange: '$800 - $1,700 MXN',
        areaServed: ['Guadalajara', 'Zapopan', 'Chapalita', 'Chapalita Oriente'],
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Av. Niño Obrero 1538, Chapalita Oriente',
          addressLocality: 'Zapopan',
          addressRegion: 'Jalisco',
          postalCode: '45040',
          addressCountry: 'MX'
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 20.665716,
          longitude: -103.407222
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog Médico', item: `${SITE_URL}/blog/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: postUrl }
        ]
      }
    ];

    if (faqEntries.length > 0) {
      graphNodes.push({
        '@type': 'FAQPage',
        '@id': `${postUrl}#faq`,
        mainEntity: faqEntries
      });
    }

    const schemaJsonLd = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@graph': graphNodes
      },
      null,
      2
    );

    if (!html.includes('G-KT9E760LFF')) {
      html = html.replace('<head>', `<head>\n${buildStrictGtagSnippet()}`);
    }

    if (!html.includes('application/ld+json')) {
      html = html.replace('</head>', `  <script type="application/ld+json">\n${schemaJsonLd}\n  </script>\n</head>`);
    }

    if (!html.includes('main.js')) {
      html = html.replace('</body>', `  <script src="../js/main.js?v=${ASSET_VERSION}" defer></script>\n</body>`);
    }

    const outputPath = path.join(BLOG_DIR, `${post.slug}.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`✅ Generated: blog/${post.slug}.html (FAQs: ${faqEntries.length})`);
  } catch (err) {
    console.error('Error generating static post:', err);
  }
}

function generateBlogIndex(posts, options = {}) {
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

    const cardsHTML = published
      .map(post => {
        const date = new Date(post.publishedAt).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const { relSrc } = resolveCoverPaths(post.coverImage);
        return `
      <article class="blog-card">
        <a href="/blog/${post.slug}.html" class="blog-card__link">
          <img src="${relSrc}" alt="${escapeAttr(post.title)}" class="blog-card__img" width="600" height="400" loading="lazy">
          <div class="blog-card__body">
            <time class="blog-card__date">${date}</time>
            <h2 class="blog-card__title">${post.title}</h2>
            <p class="blog-card__excerpt">${post.excerpt}</p>
            <div class="blog-card__tags">${(post.tags || []).map(t => `<span class="blog-tag">${t}</span>`).join(' ')}</div>
            <span class="blog-card__read">Leer guía médica →</span>
          </div>
        </a>
      </article>`;
      })
      .join('\n');

    const html = template.replace('{{blogCards}}', cardsHTML);
    const outputPath = path.join(BLOG_DIR, 'index.html');

    // Write blog/index.html FIRST, then regenerate sitemap and optionally push
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`✅ Generated: blog/index.html (${published.length} posts)`);

    try {
      const { regenerateSitemap, autoPushToGitHub } = require('./seo');
      regenerateSitemap();
      if (process.env.SKIP_GIT_PUSH !== '1' && !options.skipAutoPush) {
        autoPushToGitHub('chore(blog): actualizar articulos y sitemap.xml').catch(() => {});
      }
    } catch (_) {}
  } catch (err) {
    console.error('Error generating blog index:', err);
  }
}

// ─── Default templates (fallback) ───
function getDefaultTemplate() {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
${buildStrictGtagSnippet()}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{seoTitle}}</title>
  <meta name="description" content="{{metaDescription}}">
  <meta name="keywords" content="{{metaKeywords}}">
  <meta name="author" content="Dra. Giselle Odette Noyola Landázuri">
  <meta name="robots" content="index, follow">
  <meta name="geo.region" content="MX-JAL">
  <meta name="geo.placename" content="Guadalajara, Zapopan">
  <link rel="canonical" href="https://draodettenoyola.com/blog/{{slug}}.html">
  <meta property="og:url" content="https://draodettenoyola.com/blog/{{slug}}.html">
  <meta property="og:locale" content="es_MX">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{{seoTitle}}">
  <meta property="og:description" content="{{metaDescription}}">
  <meta property="og:image" content="{{coverImageAbs}}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{seoTitle}}">
  <meta name="twitter:description" content="{{metaDescription}}">
  <meta name="twitter:image" content="{{coverImageAbs}}">
  <link rel="icon" type="image/svg+xml" href="../img/favicon.svg?v=${ASSET_VERSION}">
  <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32x32.png?v=${ASSET_VERSION}">
  <link rel="shortcut icon" href="../favicon.ico?v=${ASSET_VERSION}">
  <link rel="apple-touch-icon" sizes="180x180" href="../img/apple-touch-icon.png?v=${ASSET_VERSION}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #04080F; --surface: #0B1827; --border: #1a2d44;
      --text: #e8edf3; --muted: #98abc4; --teal: #14A8A1; --rose: #E489A2;
      --wa-green: #25D366; --wa-green-hover: #1EBE5D;
      --font-display: 'Plus Jakarta Sans', sans-serif; --font-body: 'Inter', sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: var(--bg); color: var(--text); line-height: 1.72; }
    .blog-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 0; position: sticky; top: 0; z-index: 100; }
    .blog-header__inner { max-width: 860px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .blog-header__nav { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .blog-header__back { color: var(--teal); text-decoration: none; font-weight: 600; font-size: 0.92rem; }
    .blog-header__back:hover { text-decoration: underline; }
    .blog-header__cta { background: var(--wa-green); color: #04130a; text-decoration: none; font-weight: 700; font-size: 0.86rem; padding: 0.48rem 1rem; border-radius: 999px; }
    .blog-hero { max-width: 860px; margin: 2.5rem auto 0; padding: 0 1.5rem; }
    .blog-hero__cover { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 16px; margin-bottom: 1.75rem; display: block; }
    .blog-hero__date { color: var(--teal); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .blog-hero__title { font-family: var(--font-display); font-size: clamp(1.7rem, 4vw, 2.5rem); font-weight: 800; line-height: 1.2; margin: 0.65rem 0 1rem; }
    .blog-hero__excerpt { color: var(--muted); font-size: 1.08rem; line-height: 1.62; }
    .blog-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
    .blog-tag { background: rgba(20, 168, 161, 0.15); color: var(--teal); padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 500; }
    .blog-content { max-width: 860px; margin: 2rem auto 4rem; padding: 0 1.5rem; }
    .blog-content h2 { font-family: var(--font-display); font-size: 1.45rem; font-weight: 700; margin: 2.1rem 0 0.85rem; color: var(--teal); }
    .blog-content h3 { font-family: var(--font-display); font-size: 1.18rem; font-weight: 600; margin: 1.5rem 0 0.65rem; color: #f4f7fb; }
    .blog-content p { margin-bottom: 1rem; color: var(--text); }
    .blog-content ul, .blog-content ol { margin: 0.9rem 0 1.15rem 1.5rem; }
    .blog-content li { margin-bottom: 0.5rem; }
    .blog-content blockquote { border-left: 3px solid var(--teal); padding: 1rem 1.4rem; margin: 1.5rem 0; background: rgba(20, 168, 161, 0.08); border-radius: 0 10px 10px 0; }
    .blog-content img { max-width: 100%; height: auto; border-radius: 12px; margin: 1.5rem 0; }
    .blog-content strong { color: #7cece5; }
    .blog-content a { color: var(--teal); text-decoration: underline; }
    .article-wa-cta {
      margin: 2.4rem 0; padding: 1.6rem; border-radius: 16px;
      background: linear-gradient(135deg, rgba(20, 168, 161, 0.16), rgba(37, 211, 102, 0.12));
      border: 1px solid rgba(20, 168, 161, 0.4);
    }
    .article-wa-cta h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: #fff; }
    .article-wa-cta p { margin-bottom: 1.1rem; color: var(--text); font-size: 0.96rem; }
    .article-wa-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
    .btn-wa-article {
      display: inline-flex; align-items: center; gap: 0.45rem; background: var(--wa-green); color: #04130a !important;
      text-decoration: none !important; font-weight: 800; padding: 0.75rem 1.35rem; border-radius: 999px; font-size: 0.94rem;
    }
    .btn-wa-article:hover { background: var(--wa-green-hover); }
    .btn-tel-article {
      display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(255,255,255,0.08); color: #fff !important;
      text-decoration: none !important; font-weight: 600; padding: 0.75rem 1.2rem; border-radius: 999px; font-size: 0.9rem; border: 1px solid var(--border);
    }
    .related-services-box { margin: 2.2rem 0; padding: 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; }
    .related-services-box h2 { margin: 0 0 1rem; font-size: 1.2rem; color: #fff; }
    .related-services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.9rem; }
    .related-service-card {
      display: block; padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border);
      border-radius: 12px; text-decoration: none !important; transition: border-color 0.2s, transform 0.2s;
    }
    .related-service-card:hover { border-color: var(--teal); transform: translateY(-2px); }
    .related-service-card strong { display: block; color: var(--teal); font-size: 0.95rem; margin-bottom: 0.35rem; }
    .related-service-card span { display: block; color: var(--muted); font-size: 0.85rem; line-height: 1.45; }
    .author-box {
      margin-top: 2.2rem; padding: 1.4rem; background: var(--surface); border: 1px solid var(--border);
      border-left: 4px solid var(--rose); border-radius: 12px;
    }
    .author-box__label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--rose); margin-bottom: 0.3rem; }
    .author-box__name { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.35rem; }
    .author-box__bio { font-size: 0.88rem; color: var(--muted); margin-bottom: 0.65rem; }
    .author-box__cedulas { display: flex; flex-wrap: wrap; gap: 0.45rem; font-size: 0.78rem; }
    .author-box__cedulas span { background: rgba(20, 168, 161, 0.14); color: #b9f5f0; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 600; }
    .blog-footer { background: var(--surface); border-top: 1px solid var(--border); padding: 2rem 0; text-align: center; font-size: 0.9rem; color: var(--muted); }
    .blog-footer__inner { max-width: 860px; margin: 0 auto; padding: 0 1.5rem; }
    .blog-footer a { color: var(--teal); text-decoration: none; font-weight: 600; }
    .mobile-sticky-cta { display: none; }
    @media (max-width: 768px) {
      body { padding-bottom: 72px; }
      .mobile-sticky-cta {
        display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 0.5rem;
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 1001;
        background: rgba(9, 25, 44, 0.97); backdrop-filter: blur(10px);
        border-top: 1px solid rgba(255, 255, 255, 0.14);
        padding: 0.55rem 0.75rem calc(0.55rem + env(safe-area-inset-bottom));
      }
      .mobile-sticky-cta a {
        display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem;
        min-height: 44px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;
        text-decoration: none; color: #fff; background: rgba(255, 255, 255, 0.12);
      }
      .mobile-sticky-cta a.cta-wa { background: var(--wa-green); color: #04130a; }
    }
  </style>
</head>
<body>
  <header class="blog-header">
    <div class="blog-header__inner">
      <nav class="blog-header__nav" aria-label="Navegación del blog">
        <a href="/" class="blog-header__back">← Inicio</a>
        <a href="/blog/" class="blog-header__back">Blog Médico</a>
        <a href="/chequeo-ginecologico-guadalajara.html" class="blog-header__back">Chequeo $1,200</a>
        <a href="/ultrasonido-estructural.html" class="blog-header__back">Ultrasonido Estructural</a>
      </nav>
      <a href="{{waUrl}}" class="blog-header__cta" target="_blank" rel="noopener noreferrer">Agendar Cita</a>
    </div>
  </header>
  <main>
    <div class="blog-hero">
      <img src="{{coverImage}}" alt="{{titleAttr}}" class="blog-hero__cover" width="1200" height="675">
      <time class="blog-hero__date">{{publishDate}}</time>
      <h1 class="blog-hero__title">{{title}}</h1>
      <p class="blog-hero__excerpt">{{excerpt}}</p>
      <div class="blog-tags">{{tags}}</div>
    </div>
    <article class="blog-content">
      {{content}}

      <section class="article-wa-cta" aria-label="Agendar consulta en Guadalajara">
        <h2>¿Deseas una valoración médica en Guadalajara o Zapopan?</h2>
        <p>Atención en consultorio privado en <strong>Av. Niño Obrero 1538, Col. Chapalita Oriente, C.P. 45040</strong>. Agenda tu cita directamente por WhatsApp o llamada.</p>
        <div class="article-wa-actions">
          <a href="{{waUrl}}" class="btn-wa-article" target="_blank" rel="noopener noreferrer">💬 Agendar por WhatsApp (33 2790 5726)</a>
          <a href="tel:+523327905726" class="btn-tel-article">📞 Llamar al Consultorio</a>
          <a href="https://maps.app.goo.gl/hC2AvsH8k1GJ1PmG7" class="btn-tel-article" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>
        </div>
      </section>

      {{relatedServices}}

      <section class="author-box" aria-label="Revisión clínica y credenciales médicas">
        <div class="author-box__label">Revisión Clínica · Medicina Basada en Evidencia</div>
        <div class="author-box__name">Dra. Giselle Odette Noyola Landázuri</div>
        <p class="author-box__bio">Médica Cirujana por la Universidad de Guadalajara (UDG), Especialista en Ginecología y Obstetricia y Subespecialista en Medicina Materno Fetal por la UMAE Hospital de Gineco-Obstetricia CMNO (IMSS). Certificada por el Consejo Mexicano de Ginecología y Obstetricia (CMGO) y la Fetal Medicine Foundation (FMF).</p>
        <div class="author-box__cedulas">
          <span>Céd. Prof. SEP: 13408368</span>
          <span>Céd. Esp. SEP: 14815515</span>
          <span>Céd. Subesp. Materno-Fetal: 15692501</span>
          <span>Certificada CMGO · FMF</span>
        </div>
      </section>
    </article>
  </main>
  <footer class="blog-footer">
    <div class="blog-footer__inner">
      <p>Dra. Giselle Odette Noyola Landázuri · Av. Niño Obrero 1538, Chapalita Oriente, Zapopan / Guadalajara · <a href="{{waUrl}}" target="_blank" rel="noopener noreferrer">Agendar Cita</a> · <a href="/aviso-de-privacidad.html">Aviso de Privacidad</a></p>
    </div>
  </footer>
  <nav class="mobile-sticky-cta" aria-label="Acciones rápidas de cita">
    <a href="{{waUrl}}" class="cta-wa" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
    <a href="tel:+523327905726">📞 Llamar</a>
    <a href="https://maps.app.goo.gl/hC2AvsH8k1GJ1PmG7" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>
  </nav>
</body>
</html>`;
}

function getDefaultBlogIndexTemplate() {
  const indexSchema = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${SITE_URL}/blog/#collection`,
          name: 'Blog de Ginecología y Materno Fetal GDL | Dra. Odette',
          description:
            'Guías médicas de ginecología, chequeo anual, SOP, VPH y ultrasonido estructural en Guadalajara y Zapopan por la Dra. Odette Noyola. Citas: 33 2790 5726.',
          url: `${SITE_URL}/blog/`,
          inLanguage: 'es-MX',
          author: { '@id': `${SITE_URL}/#physician` },
          publisher: { '@id': `${SITE_URL}/#clinic` }
        },
        {
          '@type': 'Physician',
          '@id': `${SITE_URL}/#physician`,
          name: 'Dra. Odette Noyola Landázuri',
          alternateName: 'Dra. Giselle Odette Noyola Landázuri',
          url: `${SITE_URL}/`,
          telephone: '+523327905726'
        },
        {
          '@type': 'MedicalClinic',
          '@id': `${SITE_URL}/#clinic`,
          name: 'Consultorio Dra. Odette Noyola Landázuri · Ginecología y Medicina Materno Fetal',
          url: `${SITE_URL}/`,
          telephone: '+523327905726'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Blog Médico', item: `${SITE_URL}/blog/` }
          ]
        }
      ]
    },
    null,
    2
  );

  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
${buildStrictGtagSnippet()}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog de Ginecología y Materno Fetal GDL | Dra. Odette</title>
  <meta name="description" content="Guías médicas de ginecología, chequeo anual, SOP, VPH y ultrasonido estructural en Guadalajara y Zapopan por la Dra. Odette Noyola. Citas: 33 2790 5726.">
  <meta name="author" content="Dra. Giselle Odette Noyola Landázuri">
  <meta name="robots" content="index, follow">
  <meta name="geo.region" content="MX-JAL">
  <meta name="geo.placename" content="Guadalajara, Zapopan">
  <link rel="canonical" href="https://draodettenoyola.com/blog/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Blog de Ginecología y Materno Fetal GDL | Dra. Odette">
  <meta property="og:description" content="Guías médicas de ginecología, chequeo anual, SOP, VPH y ultrasonido estructural en Guadalajara y Zapopan por la Dra. Odette Noyola.">
  <meta property="og:url" content="https://draodettenoyola.com/blog/">
  <meta property="og:image" content="https://draodettenoyola.com/img/dra-odette-noyola-ginecologa-guadalajara.jpg">
  <meta property="og:locale" content="es_MX">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Blog de Ginecología y Materno Fetal GDL | Dra. Odette">
  <meta name="twitter:description" content="Guías clínicas de ginecología preventiva, SOP, miomas, VPH y diagnóstico prenatal en Guadalajara y Zapopan.">
  <meta name="twitter:image" content="https://draodettenoyola.com/img/dra-odette-noyola-ginecologa-guadalajara.jpg">
  <link rel="icon" type="image/svg+xml" href="../img/favicon.svg?v=${ASSET_VERSION}">
  <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32x32.png?v=${ASSET_VERSION}">
  <link rel="shortcut icon" href="../favicon.ico?v=${ASSET_VERSION}">
  <link rel="apple-touch-icon" sizes="180x180" href="../img/apple-touch-icon.png?v=${ASSET_VERSION}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <script type="application/ld+json">
${indexSchema}
  </script>
  <style>
    :root {
      --bg: #04080F; --surface: #0B1827; --border: #1a2d44;
      --text: #e8edf3; --muted: #98abc4; --teal: #14A8A1; --rose: #E489A2;
      --wa-green: #25D366;
      --font-display: 'Plus Jakarta Sans', sans-serif; --font-body: 'Inter', sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: var(--bg); color: var(--text); line-height: 1.7; }
    .blog-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 0; position: sticky; top: 0; z-index: 100; }
    .blog-header__inner { max-width: 1040px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .blog-header__nav { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .blog-header__back { color: var(--teal); text-decoration: none; font-weight: 600; font-size: 0.92rem; }
    .blog-header__back:hover { text-decoration: underline; }
    .blog-header__cta { background: var(--wa-green); color: #04130a; text-decoration: none; font-weight: 700; font-size: 0.86rem; padding: 0.48rem 1rem; border-radius: 999px; }
    .blog-index { max-width: 1040px; margin: 3rem auto; padding: 0 1.5rem; }
    .blog-index__title { font-family: var(--font-display); font-size: clamp(1.75rem, 3.8vw, 2.35rem); font-weight: 800; line-height: 1.2; margin-bottom: 0.65rem; }
    .blog-index__subtitle { color: var(--muted); margin-bottom: 2.25rem; max-width: 720px; }
    .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .blog-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; transition: transform 0.3s, box-shadow 0.3s; }
    .blog-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); border-color: var(--teal); }
    .blog-card__link { text-decoration: none; color: inherit; display: block; }
    .blog-card__img { width: 100%; height: 200px; object-fit: cover; display: block; }
    .blog-card__body { padding: 1.25rem; }
    .blog-card__date { color: var(--teal); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .blog-card__title { font-family: var(--font-display); font-size: 1.18rem; font-weight: 700; margin: 0.5rem 0; line-height: 1.3; }
    .blog-card__excerpt { color: var(--muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 0.75rem; }
    .blog-card__tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .blog-tag { background: rgba(20, 168, 161, 0.15); color: var(--teal); padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
    .blog-card__read { color: var(--teal); font-weight: 600; font-size: 0.9rem; }
    .mobile-sticky-cta { display: none; }
    @media (max-width: 768px) {
      body { padding-bottom: 72px; }
      .mobile-sticky-cta {
        display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 0.5rem;
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 1001;
        background: rgba(9, 25, 44, 0.97); backdrop-filter: blur(10px);
        border-top: 1px solid rgba(255, 255, 255, 0.14);
        padding: 0.55rem 0.75rem calc(0.55rem + env(safe-area-inset-bottom));
      }
      .mobile-sticky-cta a {
        display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem;
        min-height: 44px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;
        text-decoration: none; color: #fff; background: rgba(255, 255, 255, 0.12);
      }
      .mobile-sticky-cta a.cta-wa { background: var(--wa-green); color: #04130a; }
    }
  </style>
</head>
<body>
  <header class="blog-header">
    <div class="blog-header__inner">
      <nav class="blog-header__nav" aria-label="Navegación principal">
        <a href="/" class="blog-header__back">← Inicio</a>
        <a href="/chequeo-ginecologico-guadalajara.html" class="blog-header__back">Chequeo $1,200</a>
        <a href="/consulta-ginecologica-guadalajara.html" class="blog-header__back">Consulta $800</a>
        <a href="/ultrasonido-estructural.html" class="blog-header__back">Ultrasonido Estructural</a>
      </nav>
      <a href="https://wa.me/523327905726?text=Hola%20Dra.%20Odette%2C%20quisiera%20agendar%20una%20cita%20en%20Chapalita." class="blog-header__cta" target="_blank" rel="noopener noreferrer">Agendar Cita</a>
    </div>
  </header>
  <main class="blog-index">
    <h1 class="blog-index__title">Blog de Ginecología y Medicina Materno Fetal en Guadalajara y Zapopan</h1>
    <p class="blog-index__subtitle">Guías clínicas elaboradas por la Dra. Giselle Odette Noyola Landázuri (CMGO · FMF) sobre salud femenina, chequeo preventivo, control prenatal y diagnóstico fetal en Chapalita Oriente.</p>
    <div class="blog-grid">
      {{blogCards}}
    </div>
  </main>
  <nav class="mobile-sticky-cta" aria-label="Acciones rápidas de cita">
    <a href="https://wa.me/523327905726?text=Hola%20Dra.%20Odette%2C%20quisiera%20agendar%20una%20cita%20en%20Chapalita." class="cta-wa" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
    <a href="tel:+523327905726">📞 Llamar</a>
    <a href="https://maps.app.goo.gl/hC2AvsH8k1GJ1PmG7" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>
  </nav>
  <script src="../js/main.js?v=${ASSET_VERSION}" defer></script>
</body>
</html>`;
}

module.exports = router;
module.exports.generateStaticPost = generateStaticPost;
module.exports.generateBlogIndex = generateBlogIndex;
module.exports.readPosts = readPosts;
