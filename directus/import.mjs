import 'dotenv/config';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
assertLocalMaintenance();
import { readdir, readFile } from 'node:fs/promises';
import { parseFrontmatter } from '@astrojs/markdown-remark';
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
if (!base || !token) throw new Error('Set DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN');
async function api(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Import HTTP ${response.status}`);
  return (await response.json()).data;
}
for (const category of ['baccarat', 'strategy', 'guide', 'tips', 'comparison', 'faq']) {
  const directory = new URL(`../src/content/${category}/`, import.meta.url);
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.md')) continue;
    const slug = file.slice(0, -3);
    const existing = await api(`/items/articles?${new URLSearchParams({ 'filter[slug][_eq]': slug, limit: '1' })}`);
    if (existing.length) { console.log(`Skip existing ${category}/${slug}`); continue; }
    const { frontmatter, content } = parseFrontmatter(await readFile(new URL(file, directory), 'utf8'));
    const { description, publishedAt, updatedAt, seoTitle, seoDescription, canonicalUrl, ...rest } = frontmatter;
    await api('/items/articles', {
      ...rest, excerpt: description, published_at: publishedAt, updated_at: updatedAt,
      seo_title: seoTitle, seo_description: seoDescription,
      content, slug, category, status: 'published',
    });
    console.log(`Imported ${category}/${slug}`);
  }
}
