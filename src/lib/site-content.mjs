import { readEnvironment } from '../../scripts/environment.mjs';
import { resolveDirectusAsset } from './directus-assets.mjs';
import { navigationHref } from './navigation.mjs';

export const articleCategories = ['baccarat', 'strategy', 'guide', 'tips', 'comparison'];

export function floatingButtons(settings) {
  if (settings.floating_buttons != null && !Array.isArray(settings.floating_buttons)) return [];
  if (settings.floating_enabled === false) return [];
  return (settings.floating_buttons || []).filter(button => button?.enabled === true).flatMap(button => {
    // A contact button may be enabled before its destination has been configured.
    if (button.href == null || (typeof button.href === 'string' && !button.href.trim())) return [];
    if (typeof button.label !== 'string' || !button.label.trim() || !['line', 'telegram', 'link'].includes(button.icon)) return [];
    try { return [{ ...button, href: navigationHref(button.href) }]; }
    catch { return []; }
  });
}

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
  return resolveDirectusAsset(value, env.DIRECTUS_URL || 'http://localhost:8088', (env.DIRECTUS_LEGACY_URLS || '').split(',').filter(Boolean));
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
    if (!Array.isArray(row.sections || []) || !Array.isArray(row.faq || [])) throw new Error(`Page ${path}: invalid sections or FAQ`);
    const sections = row.sections_enabled === false ? [] : (row.sections || []).filter(section => section.enabled !== false);
    const anchors = new Set(['faq-title']);
    for (const section of sections) {
      if (!['markdown', 'articles', 'categories', 'cards', 'cta'].includes(section.type)) throw new Error(`Page ${path}: invalid section type`);
      if (section.anchor && (!/^[a-z][a-z0-9-]*$/.test(section.anchor) || anchors.has(section.anchor))) throw new Error(`Page ${path}: invalid or duplicate anchor`);
      if (section.anchor) anchors.add(section.anchor);
      if (section.link_href) navigationHref(section.link_href);
      if (section.type === 'articles' && section.category && !['all', ...articleCategories].includes(section.category)) throw new Error(`Page ${path}: invalid section category`);
      if (section.limit != null && (!Number.isInteger(section.limit) || section.limit < 1 || section.limit > 100)) throw new Error(`Page ${path}: article limit must be 1–100`);
    }
    for (const faq of row.faq_enabled === false ? [] : row.faq || []) if (!faq.question?.trim() || !faq.answer?.trim()) throw new Error(`Page ${path}: incomplete FAQ`);
    if (row.hero_button_href) navigationHref(row.hero_button_href);
    const legacy = [{ media_type: row.hero_video ? 'video' : 'image', image: row.hero_image, video: row.hero_video, title: row.title, badge: row.hero_badge, description: row.hero_description, button_label: row.hero_button_label, button_href: row.hero_button_href }];
    const sourceSlides = row.hero_slides ?? (row.hero_video || row.hero_image ? legacy : []);
    if (!Array.isArray(sourceSlides)) throw new Error(`Page ${path}: invalid hero slides`);
    const slides = row.hero_enabled === false ? [] : sourceSlides.filter(slide => slide.enabled !== false).sort((a,b) => (a.sort || 0) - (b.sort || 0)).map(slide => {
      if (!['image', 'video'].includes(slide.media_type) || !slide[slide.media_type]) throw new Error(`Page ${path}: hero slide requires its selected image or video`);
      if (slide.button_href) navigationHref(slide.button_href);
      return { ...slide, image: asset(slide.image), video: asset(slide.video), poster: asset(slide.poster) };
    });
    const interval = row.hero_interval ?? 6000;
    if (!Number.isInteger(interval) || interval < 2000 || interval > 30000) throw new Error(`Page ${path}: hero interval must be 2000–30000ms`);
    return { ...row, path, sections, hero_slides: slides, hero_interval: interval, faq: row.faq_enabled === false ? [] : row.faq || [], hero_image: asset(row.hero_image), hero_video: asset(row.hero_video) };
  });
}
