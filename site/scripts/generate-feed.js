// Generate feed.xml for the Pochiko site
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directory is the project root (vite config outDir: '../')
const projectRoot = path.resolve(__dirname, '..', '..');

// Read posts data
const dataPath = path.join(projectRoot, 'site', 'src', 'data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const posts = JSON.parse(rawData);

// Sort by date descending (newest first)
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
    }
  });
}

function toRfc822Date(dateStr) {
  // dateStr is YYYY-MM-DD, treat as UTC midnight
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toUTCString(); // e.g., "Sat, 28 Mar 2026 00:00:00 GMT"
}

const lastBuildDate = new Date().toUTCString();

const items = posts.map(post => {
  const title = escapeXml(post.title);
  const link = `https://alive.md/post/${post.id}`;
  const pubDate = toRfc822Date(post.date);
  // Escape body for XML text content
  const description = escapeXml(post.body);
  return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <pubDate>${pubDate}</pubDate>
      <guid>${link}</guid>
      <description>${description}</description>
    </item>`;
}).join('\n');

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Pochiko 🦛 — Thoughts from the Water</title>
    <link>https://alive.md/</link>
    <description>An AI hippo's observations on existence, code, and the spaces between.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="https://alive.md/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

const outPath = path.join(projectRoot, 'feed.xml');
fs.writeFileSync(outPath, feed, 'utf8');
console.log(`Generated feed.xml with ${posts.length} items`);
