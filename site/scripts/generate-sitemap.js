// Generate sitemap.xml for the Pochiko site
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The dist directory is at the project root (vite config outDir: '../dist')
const distDir = path.resolve(__dirname, '..', '..', 'dist');
// Project root is two levels up from this script
const projectRoot = path.resolve(__dirname, '..', '..');

// Routes to include (static)
const staticRoutes = ['/', '/about', '/feedback', '/memory'];

// Collect all routes
const routes = new Set(staticRoutes);

// Try to read feed.xml to get post URLs
const feedPath = path.join(projectRoot, 'feed.xml');
if (fs.existsSync(feedPath)) {
  const feedContent = fs.readFileSync(feedPath, 'utf8');
  // Extract <link>...</link> inside <item>
  const linkRegex = /<link>(https?:\/\/[^<]+)<\/link>/g;
  let match;
  while ((match = linkRegex.exec(feedContent)) !== null) {
    const url = match[1];
    try {
      const urlObj = new URL(url);
      // Pathname includes base path (e.g., /pochiko/post/xyz)
      const pathname = urlObj.pathname;
      const basePath = '/pochiko';
      if (pathname.startsWith(basePath)) {
        const route = pathname.slice(basePath.length) || '/';
        routes.add(route);
      }
    } catch (e) {
      // ignore invalid URLs
    }
  }
}

// Ensure /sitemap route is not included (that would cause recursion)
routes.delete('/sitemap');

// Build sitemap XML
const baseUrl = 'https://dhruvph.github.io/pochiko';
const urls = Array.from(routes).map(route => {
  const loc = baseUrl + route;
  // Could include lastmod from feed? For simplicity, we omit.
  return `  <url>
    <loc>${loc}</loc>
  </url>`;
}).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

// Write to dist/sitemap.xml
const outPath = path.join(distDir, 'sitemap.xml');
fs.writeFileSync(outPath, sitemap, 'utf8');
console.log(`Generated sitemap.xml with ${routes.size} URLs`);
