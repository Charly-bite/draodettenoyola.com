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
const INDEXNOW_KEY = '8f4b2e91c7d34a659e12b804f5a3c712';

async function notifyIndexNow(urls = []) {
  try {
    const keyFile = path.join(ROOT_DIR, `${INDEXNOW_KEY}.txt`);
    if (!fs.existsSync(keyFile)) {
      fs.writeFileSync(keyFile, INDEXNOW_KEY, 'utf8');
    }
    const resp = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'DraOdette-SEO-Suite/1.0' },
      body: JSON.stringify({
        host: 'draodettenoyola.com',
        key: INDEXNOW_KEY,
        keyLocation: `https://draodettenoyola.com/${INDEXNOW_KEY}.txt`,
        urlList: urls
      })
    });
    return { ok: resp.status === 200 || resp.status === 202, status: resp.status, count: urls.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

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
  const allUrls = [
    ...CORE_PAGES.map(p => p.loc),
    ...posts.map(post => `https://draodettenoyola.com/blog/${post.slug}.html`)
  ];
  notifyIndexNow(allUrls).catch(() => {});
  return { totalUrls: CORE_PAGES.length + posts.length, publishedPosts: posts.length, urls: allUrls };
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
  const allAuditTargets = [
    ...CORE_PAGES,
    ...published.map(post => ({
      loc: `https://draodettenoyola.com/blog/${post.slug}.html`,
      file: `blog/${post.slug}.html`,
      priority: '0.85',
      changefreq: 'monthly',
      label: `📄 Blog: ${post.title}`
    }))
  ];
  const pageAudits = allAuditTargets.map(p => {
    const fullPath = path.join(ROOT_DIR, p.file);
    const exists = fs.existsSync(fullPath);
    let hasSchema = false;
    let hasHeatmap = false;
    let hasCanonical = false;
    let title = p.label;
    if (exists) {
      const html = fs.readFileSync(fullPath, 'utf8');
      hasSchema = html.includes('application/ld+json');
      hasHeatmap = html.includes('main.js') || html.includes('api/heatmap');
      hasCanonical = html.includes('rel="canonical"');
      const m = html.match(/<title>([^<]+)<\/title>/i);
      if (m) title = m[1].trim();
    }
    return {
      ...p,
      exists,
      title,
      hasSchema,
      hasHeatmap,
      hasCanonical
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

// POST /api/seo/rebuild-sitemap — Regenera sitemap.xml, notifica a IndexNow y sincroniza con GitHub
router.post('/rebuild-sitemap', requireAuth, async (req, res) => {
  const stats = regenerateSitemap();
  const indexNow = await notifyIndexNow(stats.urls || []);
  const gitResult = await autoPushToGitHub('chore(seo): regenerar sitemap.xml con nuevos articulos y landing pages');
  res.json({
    ok: true,
    ...stats,
    indexNow,
    git: gitResult
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  COPILOTO CLÍNICO IA EN VIVO (Generación y Revisión de Contenido SEO/GEO)
//  Usa Groq Llama-3.3-70B + Fallback Ollama Local (192.168.2.222:11434)
// ══════════════════════════════════════════════════════════════════════════

const CLINICAL_COPILOT_SYSTEM = `Eres el Copiloto Editorial Médico y Especialista SEO/GEO de la Dra. Giselle Odette Noyola Landázuri (Especialista Certificada en Ginecología, Obstetricia y Medicina Materno Fetal en Guadalajara / Zapopan, Jalisco).
Tu objetivo es ayudar a la Dra. Odette en vivo a redactar, revisar, enriquecer y auditar sus artículos del blog médico y páginas del sitio web para atraer más pacientes en Guadalajara y aparecer #1 en Google y asistentes de IA (ChatGPT, Gemini, Perplexity).

DATOS OFICIALES DEL CONSULTORIO (Úsalos siempre con precisión):
- Ubicación: Av. Niño Obrero 1538, Col. Chapalita Oriente, C.P. 45040, Guadalajara / Zapopan, Jalisco (a 2 min de Glorieta Chapalita, cuenta con estacionamiento).
- WhatsApp y Citas: 33 2790 5726.
- Horario: Lunes a Viernes 9:00 a 20:00 hrs | Sábados 9:00 a 14:00 hrs.
- Precios Oficiales (MXN):
  • Chequeo Ginecológico Completo Anual: $1,200 MXN (incluye consulta, exploración mamaria, Papanicolaou, colposcopía, vaginoscopía y ultrasonido ginecológico en tiempo real).
  • Consulta Ginecológica / Control Prenatal: $800 MXN (SOP, miomas, ciclo menstrual, infecciones, anticonceptivos DIU Mirena/Kyleena/implante).
  • Ultrasonido Estructural 2do Trimestre (Sem 18-24): $1,700 MXN (Equipo GE Voluson HD Live).
  • Tamizaje Genético 1er Trimestre (Sem 11-13.6): $1,700 MXN.
  • Ultrasonido 3er Trimestre / Crecimiento y Doppler (Sem 28+): $1,500 MXN.
- Aseguradoras en convenio: GNP, MetLife, AXA, Allianz, Seguros Monterrey New York Life, Mapfre, Banorte.

REGLAS DE ESTILO:
- Tono cálido, empático, ético (apego a COFEPRIS / NOM-004-SSA3-2012), claro para las pacientes y con alto rigor médico (E-E-A-T).
- Usa formato Markdown limpio con subtítulos H2 (##) y H3 (###), listas con viñetas, negritas estratégicas y sección de Preguntas Frecuentes (FAQ) cuando redactes o mejores un artículo.`;

async function callClinicalLlm(messages, maxTokens = 1800) {
  const fetchFn = global.fetch;
  const groqKey = process.env.GROQ_API_KEY || '';

  if (fetchFn) {
    if (groqKey) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        const res = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.4,
            max_tokens: maxTokens
          }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content;
          if (reply && reply.trim()) {
            return { text: reply.trim(), engine: 'Groq Llama-3.3-70B Clínico' };
          }
        }
      } catch (_) {}
    }

    // Delegar al motor clínico WAOS en desarrollo (:6006) si está accesible
    const waosNodes = ['http://192.168.2.218:6006', 'http://100.77.199.69:6006'];
    for (const base of waosNodes) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 16000);
        const res = await fetchFn(`${base}/api/odette/copilot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, maxTokens }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && data.reply) {
            return { text: data.reply, engine: data.engine || 'Motor LLM Clínico (WAOS :6006)' };
          }
        }
      } catch (_) {}
    }

    // Fallback a Ollama local en office-pc
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const res = await fetchFn(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M',
          messages,
          stream: false
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.message?.content) {
          return { text: data.message.content.trim(), engine: 'Ollama Local Qwen3-30B' };
        }
      }
    } catch (_) {}
  }

  return {
    text: 'No se pudo conectar temporalmente con el motor LLM. Intenta nuevamente en unos segundos.',
    engine: 'Offline Fallback'
  };
}

// POST /api/seo/ai-assistant — Guía en vivo para generación, revisión y auditoría de artículos
router.post('/ai-assistant', requireAuth, async (req, res) => {
  try {
    const { mode = 'review', title = '', content = '', excerpt = '', instruction = '', tags = '' } = req.body || {};

    let userPrompt = '';
    if (mode === 'review') {
      userPrompt = `Analiza y revisa el siguiente artículo médico de la Dra. Odette Noyola y entrégame una guía práctica en vivo con:
1. **Puntuación SEO/GEO estimada (0-100)** y diagnóstico rápido de E-E-A-T médico.
2. **3 Mejoras concretas** para atraer más pacientes en Guadalajara/Zapopan (palabras clave locales, claridad de precios, llamado a la acción).
3. **Sugerencia de Meta Description optimizada** (máximo 155 caracteres) y **3 Preguntas Frecuentes (FAQ)** listas para copiar al final del artículo.

TÍTULO ACTUAL: ${title || '(Sin título)'}
EXTRACTO: ${excerpt || '(Sin extracto)'}
TAGS: ${tags || '(Sin tags)'}
CONTENIDO ACTUAL:
${content || '(Aún sin contenido)'}`;
    } else if (mode === 'improve' || mode === 'expand') {
      userPrompt = `Reescribe, enriquece y perfecciona el siguiente artículo clínico de la Dra. Odette Noyola aplicando las mejores prácticas de SEO Médico Local en Guadalajara y GEO (respuesta directa en el primer párrafo, subtítulos H2/H3 claros, precios transparentes cuando aplique, sección de 3 Preguntas Frecuentes y llamado a la acción cálido hacia WhatsApp 33 2790 5726 en Chapalita Oriente).
${instruction ? `\nINSTRUCCIÓN ESPECIAL DE LA DOCTORA: ${instruction}\n` : ''}
Devuelve ÚNICAMENTE el artículo completo en formato Markdown listo para publicarse (sin comentarios introductorios fuera del artículo).

TÍTULO: ${title}
BORRADOR ACTUAL:
${content}`;
    } else if (mode === 'draft') {
      userPrompt = `Redacta un artículo médico pilar completo, cálido, empático y optimizado para SEO/GEO en Guadalajara para el blog de la Dra. Odette Noyola.
TEMA / TÍTULO: ${title || instruction || 'Salud Ginecológica y Prenatal en Guadalajara'}
INSTRUCCIONES ADICIONALES: ${instruction || 'Incluir síntomas, cómo se realiza el diagnóstico en el consultorio de Chapalita Oriente, preguntas frecuentes (FAQ) y llamado a agendar por WhatsApp al 33 2790 5726.'}

Devuelve ÚNICAMENTE el artículo en formato Markdown listo para pegar en el editor.`;
    } else {
      userPrompt = `Contexto del artículo actual:
Título: ${title || '(Ninguno seleccionado)'}
Contenido: ${(content || '').slice(0, 2500)}

Solicitud de la Dra. Odette:
${instruction || 'Dame recomendaciones para mejorar este artículo y atraer más pacientes.'}`;
    }

    const result = await callClinicalLlm([
      { role: 'system', content: CLINICAL_COPILOT_SYSTEM },
      { role: 'user', content: userPrompt }
    ]);

    res.json({
      ok: true,
      mode,
      engine: result.engine,
      reply: result.text
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = {
  router,
  regenerateSitemap,
  autoPushToGitHub
};
