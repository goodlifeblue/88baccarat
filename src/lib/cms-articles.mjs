import { fetchCMS, asset } from './site-content.mjs';
export const displayArticleCategories = ['baccarat', 'strategy', 'guide', 'tips', 'comparison'];
export function cmsArticleEntry(row, settings) {
  return {
    id: row.slug, collection: row.category, body: row.content || '',
    data: {
      cmsId: row.id, title: row.title, description: row.excerpt,
      publishedAt: new Date(row.published_at), updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
      author: row.author || settings.organization,
      image: asset(row.cover_image || row.image || settings.default_cover), imageAlt: row.imageAlt || '',
      ogImage: asset(row.ogImage), seoTitle: row.seo_title || undefined, seoDescription: row.seo_description || undefined,
      noindex: row.noindex === true, featured: row.featured === true, faq: row.faq || [],
      relatedArticles: row.related?.length ? row.related.map(r => r.related_id) : row.relatedArticles || [],
    },
  };
}
export async function loadPublishedCMSArticles(extra = {}) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await fetchCMS('articles', '*,related.related_id', { 'filter[status][_eq]': 'published', 'filter[category][_in]': displayArticleCategories.join(','), limit: '100', offset: String(offset), sort: '-published_at,id', ...extra });
    if (!Array.isArray(page)) throw new Error('Invalid Directus articles response');
    rows.push(...page.filter(r => r.status === 'published' && displayArticleCategories.includes(r.category)));
    if (page.length < 100) return rows;
  }
}
