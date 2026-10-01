import { asset, fetchCMS } from './site-content.mjs';
import { cmsArticleEntry, displayArticleCategories, loadPublishedCMSArticles } from './cms-articles.mjs';
const order = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.id).localeCompare(String(b.id));
export function prepareHomepageBlocks(rows, automaticArticles, settings) {
  return rows.filter(row => row.enabled === true).sort(order).flatMap(row => {
    const section = { ...row, anchor: row.anchor || `homepage-${row.id}`, cards: row.cards || [], asset };
    if (row.type !== 'articles') return [section];
    const articles = row.article_source === 'manual'
      ? [...(row.articles || [])].sort(order).map(link => link.article_id)
      : automaticArticles.filter(article => (!row.category || row.category === 'all' || article.category === row.category) && (!row.featured || article.featured)).slice(0, row.limit || 3);
    const seen = new Set();
    section.selectedArticles = articles.filter(article => {
      if (!article || article.status !== 'published' || !displayArticleCategories.includes(article.category) || seen.has(article.id)) return false;
      seen.add(article.id); return true;
    }).map(article => cmsArticleEntry(article, settings));
    return section.selectedArticles.length ? [section] : [];
  });
}
export async function loadHomepageBlocks() {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchCMS('homepage_blocks', '*,articles.id,articles.sort,articles.article_id.*', { 'filter[enabled][_eq]': 'true', sort: 'sort,id', limit: '100', offset: String(offset), 'deep[articles][_limit]': '-1', 'deep[articles][_sort]': 'sort,id' });
    if (!Array.isArray(page)) throw new Error('Invalid homepage blocks response');
    rows.push(...page);
    if (page.length < 100) break;
  }
  const settings = await fetchCMS('site_settings', 'organization,default_cover');
  const automatic = rows.some(row => row.enabled && row.type === 'articles' && row.article_source === 'auto') ? await loadPublishedCMSArticles() : [];
  return prepareHomepageBlocks(rows, automatic, settings);
}
