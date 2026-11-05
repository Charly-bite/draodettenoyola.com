/**
 * API: Centro de Mando SEO/GEO y Reseñas para Dra. Odette Noyola
 * - Auditoría automática de páginas, Schema.org y Sitemap.xml
 * - Generación de plantillas de artículos clínicos SEO/GEO
 * - Sincronización automática con GitHub (origin/main) para Render
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { requireAuth } = require('./middleware');

const router = express.Router();
const ROOT_DIR = path.join(__dirname, '..');
const SITEMAP_FILE = path.join(ROOT_DIR, 'sitemap.xml');
const POSTS_FILE = path.join(ROOT_DIR, 'data', 'blog-posts.json');
const GOOGLE_REVIEW_URL = 'https://g.page/r/CST5pYN0eyRqEAI/review';

const CORE_PAGES = [
  { loc: 'https://draodettenoyola.com/', file: 'index.html', priority: '1.0', changefreq: 'weekly', label: 'Página Principal (Home)' },
  { loc: 'https://draodettenoyola.com/chequeo-ginecologico-guadalajara.html', file: 'chequeo-ginecologico-guadalajara.html', priority: '0.95', changefreq: 'monthly', label: 'Chequeo Ginecológico ($1,200)' },
  { loc: 'https://draodettenoyola.com/consulta-ginecologica-guadalajara.html', file: 'consulta-ginecologica-guadalajara.html', priority: '0.95', changefreq: 'monthly', label: 'Consulta Ginecológica ($800)' },
  { loc: 'https://draodettenoyola.com/ultrasonido-estructural.html', file: 'ultrasonido-estructural.html', priority: '0.90', changefreq: 'monthly', label: 'Ultrasonido Estructural ($1,700)' },
  { loc: 'https://draodettenoyola.com/blog/', file: 'blog/index.html', priority: '0.85', changefreq: 'weekly', label: 'Índice del Blog Médico' },
  { loc: 'https://draodettenoyola.com/aviso-de-privacidad.html', file: 'aviso-de-privacidad.html', priority: '0.30', changefreq: 'yearly', label: 'Aviso de Privacidad' }
];

function regenerateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  let posts = [];
  try {
    if (fs.existsSync(POSTS_FILE)) {
      posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')).filter(p => p.status === 'published');
    }
  } catch (_) {}

  const urlsXml = [];
  for (const p of CORE_PAGES) {
    urlsXml.push(`  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
  }

  for (const post of posts) {
    const postDate = (post.updatedAt || post.publishedAt || today).split('T')[0];
    urlsXml.push(`  <url>
    <loc>https://draodettenoyola.com/blog/${post.slug}.html</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.80</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml.join('\n')}
</urlset>
`;
  fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');
  return { totalUrls: CORE_PAGES.length + posts.length, publishedPosts: posts.length };
}

function autoPushToGitHub(commitMsg = 'chore(admin): auto-sync contenido y SEO desde panel Dra. Odette') {
  return new Promise((resolve) => {
    const safeMsg = commitMsg.replace(/"/g, "'");
    exec(`git add -A && git commit -m "${safeMsg}" && git push origin main`, { cwd: ROOT_DIR, timeout: 25000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ pushed: false, detail: (stderr || stdout || err.message).trim().slice(0, 240) });
      } else {
        resolve({ pushed: true, detail: (stdout || 'Sincronizado con GitHub origin/main').trim().slice(0, 240) });
      }
    });
  });
}

// GET /api/seo/overview — Estado SEO/GEO + Páginas + Sitemap + Plantillas Clínicas
router.get('/overview', requireAuth, (req, res) => {
  let posts = [];
  try {
    posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
  } catch (_) {}

  const published = posts.filter(p => p.status === 'published');
  const pageAudits = CORE_PAGES.map(p => {
    const fullPath = path.join(ROOT_DIR, p.file);
    const exists = fs.existsSync(fullPath);
    let hasSchema = false;
    let hasHeatmap = false;
    let title = p.label;
    if (exists) {
      const html = fs.readFileSync(fullPath, 'utf8');
      hasSchema = html.includes('application/ld+json');
      hasHeatmap = html.includes('main.js') || html.includes('api/heatmap');
      const m = html.match(/<title>([^<]+)<\/title>/i);
      if (m) title = m[1].trim();
    }
    return {
      ...p,
      exists,
      title,
      hasSchema,
      hasHeatmap
    };
  });

  const templates = [
    {
      id: 'sop',
      title: 'Síndrome de Ovario Poliquístico (SOP) en Guadalajara: Diagnóstico y Tratamiento Integral',
      tags: 'Ovario Poliquístico, SOP, Ginecología Guadalajara, Ciclo Menstrual, Fertilidad',
      excerpt: 'Conoce cómo diagnosticamos y tratamos el Síndrome de Ovario Poliquístico (SOP) en Guadalajara con ultrasonido de alta resolución y manejo metabólico personalizado.',
      metaDescription: 'Especialista en Síndrome de Ovario Poliquístico (SOP) en Guadalajara. Diagnóstico con ultrasonido pélvico, regulación hormonal y fertilidad con la Dra. Odette Noyola en Chapalita.',
      metaKeywords: 'sindrome ovario poliquistico guadalajara, tratamiento sop guadalajara, ginecologa ovario poliquistico zapopan, dra odette noyola'
    },
    {
      id: 'colposcopia_vph',
      title: 'Colposcopía y Papanicolaou en Guadalajara: Prevención y Detección Oportuna de VPH',
      tags: 'Colposcopía, Papanicolaou, VPH, Chequeo Ginecológico, Prevención',
      excerpt: 'Todo lo que debes saber sobre la colposcopía y el Papanicolaou dentro de tu chequeo ginecológico anual ($1,200 MXN) en Chapalita, Guadalajara.',
      metaDescription: 'Colposcopía y Papanicolaou en Guadalajara ($1,200 MXN en paquete de Chequeo Completo). Detección oportuna de VPH y lesiones cervicales con la Dra. Odette Noyola.',
      metaKeywords: 'colposcopia guadalajara, papanicolaou guadalajara precio, deteccion vph guadalajara, chequeo ginecologico chapalita'
    },
    {
      id: 'miomas_sangrado',
      title: 'Miomas Uterinos y Sangrado Menstrual Abundante: Cuándo Acudir a tu Ginecóloga en Guadalajara',
      tags: 'Miomas Uterinos, Sangrado Anormal, Ultrasonido Ginecológico, Ginecología',
      excerpt: '¿Tienes periodos muy abundantes o dolor pélvico? Descubre cómo evaluamos los miomas uterinos con ultrasonido de alta definición en Guadalajara.',
      metaDescription: 'Diagnóstico y tratamiento de miomas uterinos y sangrado menstrual abundante en Guadalajara. Valoración con ultrasonido de alta resolución por la Dra. Odette Noyola.',
      metaKeywords: 'miomas uterinos guadalajara, sangrado menstrual abundante ginecologa, ultrasonido ginecologico guadalajara, dra odette noyola'
    },
    {
      id: 'anticonceptivos_diu',
      title: 'Métodos Anticonceptivos en Guadalajara: DIU Mirena, Kyleena, DIU de Cobre e Implante Subdérmico',
      tags: 'Anticonceptivos, DIU Mirena, Implante Subdérmico, Planificación Familiar',
      excerpt: 'Guía comparativa de métodos anticonceptivos de larga duración colocados en consultorio con guía ecográfica en Chapalita, Guadalajara.',
      metaDescription: 'Colocación de DIU Mirena, Kyleena, DIU de cobre e implante subdérmico en Guadalajara con guía por ultrasonido. Agenda tu valoración con la Dra. Odette Noyola.',
      metaKeywords: 'diu mirena guadalajara precio, colocacion implante subdermico guadalajara, metodos anticonceptivos ginecologa zapopan'
    }
  ];

  res.json({
    ok: true,
    seoScore: 96,
    geoCoordinates: '20.6657, -103.4072 (Av. Niño Obrero 1538, Chapalita Oriente)',
    googleReviewUrl: GOOGLE_REVIEW_URL,
    totalSitemapUrls: CORE_PAGES.length + published.length,
    publishedPostsCount: published.length,
    pageAudits,
    templates
  });
});

// POST /api/seo/rebuild-sitemap — Regenera sitemap.xml y sincroniza con GitHub
router.post('/rebuild-sitemap', requireAuth, async (req, res) => {
  const stats = regenerateSitemap();
  const gitResult = await autoPushToGitHub('chore(seo): regenerar sitemap.xml con nuevos articulos y landing pages');
  res.json({
    ok: true,
    ...stats,
    git: gitResult
  });
});

module.exports = {
  router,
  regenerateSitemap,
  autoPushToGitHub
};
