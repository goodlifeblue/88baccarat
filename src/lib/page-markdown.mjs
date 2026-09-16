import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import articleMarkdown from '../../scripts/article-markdown.mjs';
import { directusMarkdownImages } from './directus-assets.mjs';
import { readEnvironment } from '../../scripts/environment.mjs';

let cached;
let cachedKey;
export async function renderPageMarkdown(content) {
  if (!content) return '';
  const env = readEnvironment();
  const key = JSON.stringify([env.CONTENT_SOURCE, env.DIRECTUS_URL, env.DIRECTUS_LEGACY_URLS]);
  if (key !== cachedKey) {
    cachedKey = key;
    cached = createMarkdownProcessor({ remarkPlugins: [
      ...(env.CONTENT_SOURCE === 'directus' ? [[directusMarkdownImages, { base: env.DIRECTUS_URL, legacyBases: (env.DIRECTUS_LEGACY_URLS || '').split(',').filter(Boolean) }]] : []),
      articleMarkdown,
    ] });
  }
  const processor = await cached;
  return (await processor.render(content)).code;
}
