const fs = require('fs');
const path = require('path');
const b = require('./api/blog');
const s = require('./api/seo');

// 1. Generate static blog posts and blog index
const posts = b.readPosts();
posts.filter(p => p.status === 'published').forEach(p => b.generateStaticPost(p));
b.generateBlogIndex(posts);

// 2. Ensure standalone pages include main.js?v=5.6 (for Heatmap Tracker v2)
const standalonePages = [
  'chequeo-ginecologico-guadalajara.html',
  'consulta-ginecologica-guadalajara.html',
  'ultrasonido-estructural.html'
];

standalonePages.forEach(file => {
  const fp = path.join(__dirname, file);
  if (fs.existsSync(fp)) {
    let html = fs.readFileSync(fp, 'utf-8');
    // Fix gtag hostname guard if raw gtag config exists
    if (html.includes("gtag('config', 'G-B7F9R5S2P3');") && !html.includes('draodettenoyola.com')) {
      html = html.replace(
        "gtag('config', 'G-B7F9R5S2P3');",
        "if (location.hostname === 'draodettenoyola.com' || location.hostname === 'www.draodettenoyola.com') { gtag('config', 'G-B7F9R5S2P3'); }"
      );
    }
    if (!html.includes('js/main.js')) {
      html = html.replace('</body>', '  <script src="js/main.js?v=5.6" defer></script>\n</body>');
    } else {
      html = html.replace(/js\/main\.js(\?v=[0-9.]+)?/g, 'js/main.js?v=5.6');
    }
    fs.writeFileSync(fp, html, 'utf-8');
    console.log('✅ Updated standalone page:', file);
  }
});

// 3. Regenerate sitemap.xml
const count = s.regenerateSitemap();
console.log('✅ Sitemap regenerated with URLs:', count);
