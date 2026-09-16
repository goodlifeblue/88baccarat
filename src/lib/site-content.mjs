import { readEnvironment } from '../../scripts/environment.mjs';
import { resolveDirectusAsset } from './directus-assets.mjs';
import { navigationHref } from './navigation.mjs';

export const articleCategories = ['baccarat', 'strategy', 'guide', 'tips', 'comparison'];

export function pagePath(value) {
  if (typeof value !== 'string' || (value !== '/' && !/^\/(?:[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*\/)+$/u.test(value)))
    throw new Error('Page path must be / or a root-relative path with a trailing slash');
  if (/^\/(?:404|assets|_astro|admin)(?:\/|$)/.test(value) || /^\/(baccarat|strategy|guide|tips|comparison)\/.+/.test(value))
    throw new Error(`Reserved page path: ${value}`);
  return value;
}

export async function fetchCMS(collection, fields = '*', filter = {}) {
  const env = readEnvironment();
  const response = await fetch(`${env.DIRECTUS_URL?.replace(/\/$/, '')}/items/${collection}?${new URLSearchParams({ fields, ...filter })}`, {
    headers: env.DIRECTUS_API_TOKEN ? { Authorization: `Bearer ${env.DIRECTUS_API_TOKEN}` } : {},
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Directus ${collection}: HTTP ${response.status}`);
  return (await response.json()).data;
}

export function asset(value) {
  if (!value) return undefined;
  const env = readEnvironment();
  return resolveDirectusAsset(value, env.DIRECTUS_URL || 'http://localhost:8055', (env.DIRECTUS_LEGACY_URLS || '').split(',').filter(Boolean));
}

export function validatePages(rows) {
  const paths = new Set();
  return rows.filter(row => row.status === 'published').map(row => {
    const path = pagePath(row.path);
    if (paths.has(path)) throw new Error(`Duplicate page path: ${path}`);
    paths.add(path);
    if (!row.title?.trim() || !row.description?.trim()) throw new Error(`Page ${path}: title and description required`);
    if (!['single_page', 'article_list', 'custom_page'].includes(row.page_type)) throw new Error(`Page ${path}: unknown page type`);
    if (row.page_type === 'article_list' && !['all', ...articleCategories].includes(row.article_category)) throw new Error(`Page ${path}: invalid article category`);
    if (row.page_type === 'custom_page' && !['home', 'faq', 'standard'].includes(row.custom_template)) throw new Error(`Page ${path}: unknown template`);
    const sections = row.sections || [];
    if (!Array.isArray(sections) || !Array.isArray(row.faq || [])) throw new Error(`Page ${path}: invalid sections or FAQ`);
    const anchors = new Set(['faq-title']);
    for (const section of sections) {
      if (!['markdown', 'articles', 'categories', 'cards', 'cta'].includes(section.type)) throw new Error(`Page ${path}: invalid section type`);
      if (section.anchor && (!/^[a-z][a-z0-9-]*$/.test(section.anchor) || anchors.has(section.anchor))) throw new Error(`Page ${path}: invalid or duplicate anchor`);
      if (section.anchor) anchors.add(section.anchor);
      if (section.link_href) navigationHref(section.link_href);
      if (section.type === 'articles' && section.category && !['all', ...articleCategories].includes(section.category)) throw new Error(`Page ${path}: invalid section category`);
      if (section.limit != null && (!Number.isInteger(section.limit) || section.limit < 1 || section.limit > 100)) throw new Error(`Page ${path}: article limit must be 1–100`);
    }
    for (const faq of row.faq || []) if (!faq.question?.trim() || !faq.answer?.trim()) throw new Error(`Page ${path}: incomplete FAQ`);
    if (row.hero_button_href) navigationHref(row.hero_button_href);
    return { ...row, path, sections, faq: row.faq || [], hero_image: asset(row.hero_image), hero_video: asset(row.hero_video) };
  });
}
