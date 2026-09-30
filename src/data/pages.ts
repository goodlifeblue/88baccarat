import seed from '../../directus/seeds/pages.json';
import { readEnvironment } from '../../scripts/environment.mjs';
import { fetchCMS, validatePages } from '../lib/site-content.mjs';
import { loadHomepageBlocks } from '../lib/homepage-blocks.mjs';

let cached: Promise<any[]> | undefined;
async function load(): Promise<any[]> {
  const env = readEnvironment();
  if (env.CONTENT_SOURCE !== 'directus') return validatePages(seed);
  const entries = [];
  for (let offset = 0; ; offset += 100) {
    const rows = await fetchCMS('pages', '*,hero_slides.*', { 'filter[status][_eq]': 'published', sort: 'path', limit: '100', offset: String(offset), 'deep[hero_slides][_limit]': '-1', 'deep[hero_slides][_sort]': 'sort,id' });
    if (!Array.isArray(rows)) throw new Error('Invalid Directus pages response');
    entries.push(...rows);
    if (rows.length < 100) break;
  }
  const homepage = entries.find(page => page.path === '/' && page.homepage_blocks_enabled);
  if (homepage) homepage.sections = homepage.sections_enabled === false ? [] : await loadHomepageBlocks();
  const pages = validatePages(entries);
  if (!pages.some((page: any) => page.path === '/')) throw new Error('Publish the homepage before building');
  return pages;
}
export function getPages() {
  return import.meta.env.PROD ? cached ??= load() : load();
}
