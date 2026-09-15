import type { Loader } from 'astro/loaders';
import { loadEnv } from 'vite';

export function directusLoader(): Loader {
  return {
    name: 'directus-articles',
    async load({ collection, store, parseData, renderMarkdown }) {
      const env = { ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), ''), ...process.env };
      const base = env.DIRECTUS_URL?.replace(/\/$/, '');
      if (!base) throw new Error('CONTENT_SOURCE=directus requires DIRECTUS_URL');
      const entries = [];
      for (let offset = 0; ; offset += 100) {
        const query = new URLSearchParams({
          'filter[status][_eq]': 'published', 'filter[category][_eq]': collection,
          fields: '*,related.related_id', limit: '100', offset: String(offset), sort: 'id',
        });
        const response = await fetch(`${base}/items/articles?${query}`, {
          headers: env.DIRECTUS_API_TOKEN ? { Authorization: `Bearer ${env.DIRECTUS_API_TOKEN}` } : {},
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Directus ${collection}: HTTP ${response.status}`);
        const { data } = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid Directus articles response');
        entries.push(...data);
        if (data.length < 100) break;
      }
      const prepared = [];
      const slugs = new Set<string>();
      for (const entry of entries) {
        if (entry.status !== 'published' || entry.category !== collection) continue;
        const id = entry.slug;
        if (typeof id !== 'string' || !/^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u.test(id)) {
          throw new Error(`Invalid article slug: ${id}`);
        }
        if (slugs.has(id)) throw new Error(`Duplicate article URL: /${collection}/${id}/`);
        slugs.add(id);
        const asset = (value: string | null) => {
          if (!value) return undefined;
          if (/^[0-9a-f-]{36}$/i.test(value)) return `${base}/assets/${value}`;
          if (value.startsWith('/') && !value.startsWith('//')) return value;
          if (/^https?:\/\//i.test(value)) return value;
          throw new Error(`Invalid image URL in article ${id}`);
        };
        const data = await parseData({ id, data: {
          ...Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== null)),
          relatedArticles: entry.related?.length ? entry.related.map((relation: { related_id: string }) => relation.related_id) : (entry.relatedArticles || []),
          description: entry.excerpt ?? entry.description,
          publishedAt: entry.published_at ?? entry.publishedAt,
          updatedAt: entry.updated_at ?? entry.updatedAt ?? undefined,
          seoTitle: entry.seo_title ?? entry.seoTitle ?? undefined,
          seoDescription: entry.seo_description ?? entry.seoDescription ?? undefined,
          canonicalUrl: undefined,
          noindex: entry.noindex ?? false,
          image: asset(entry.cover_image || entry.cover || entry.image), ogImage: asset(entry.ogImage),
          cmsId: String(entry.id),
        } });
        if (typeof entry.content !== 'string') throw new Error(`Missing content: ${id}`);
        const rendered = await renderMarkdown(entry.content);
        prepared.push({ id, data, body: entry.content, rendered });
      }
      store.clear();
      for (const entry of prepared) store.set(entry);
    },
  };
}
