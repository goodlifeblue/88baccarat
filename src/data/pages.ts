import seed from '../../directus/seeds/pages.json';
import { readEnvironment } from '../../scripts/environment.mjs';
import { fetchCMS, validatePages } from '../lib/site-content.mjs';

let cached: Promise<any[]> | undefined;
async function load(): Promise<any[]> {
  const env = readEnvironment();
  if (env.CONTENT_SOURCE !== 'directus') return validatePages(seed);
  const entries = [];
  for (let offset = 0; ; offset += 100) {
    const rows = await fetchCMS('pages', '*', { 'filter[status][_eq]': 'published', sort: 'path', limit: '100', offset: String(offset) });
    if (!Array.isArray(rows)) throw new Error('Invalid Directus pages response');
    entries.push(...rows);
    if (rows.length < 100) break;
  }
  const pages = validatePages(entries);
  if (!pages.some((page: any) => page.path === '/')) throw new Error('Publish the homepage before building');
  return pages;
}
export function getPages() {
  return import.meta.env.PROD ? cached ??= load() : load();
}
