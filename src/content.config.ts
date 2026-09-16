import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { readEnvironment } from '../scripts/environment.mjs';
import { directusLoader } from './lib/directus-loader';
const env = readEnvironment();
const source = env.CONTENT_SOURCE || 'local';
if (!['local', 'directus'].includes(source)) throw new Error('CONTENT_SOURCE must be local or directus');
const schema = z.object({
  title: z.string().min(1), description: z.string().min(1),
  publishedAt: z.coerce.date(), updatedAt: z.coerce.date().optional(),
  author: z.string().default('百家樂攻略誌編輯部'),
  image: z.string().default('/images/xx.png'), imageAlt: z.string().default('文章封面'),
  noindex: z.boolean().default(false),
  featured: z.boolean().default(false),
  faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]),
  seoTitle: z.string().optional(), seoDescription: z.string().optional(),
  ogImage: z.string().optional(), canonicalUrl: z.string().url().regex(/^https?:\/\//).optional(),
  cmsId: z.string().optional(), relatedArticles: z.array(z.string()).default([]),
});
function article(category: string) {
  return defineCollection({
    loader: source === 'directus' ? directusLoader() : glob({ pattern: '**/*.md', base: `./src/content/${category}` }),
    schema,
  });
}
export const collections = {
  baccarat: article('baccarat'), strategy: article('strategy'), guide: article('guide'),
  tips: article('tips'), comparison: article('comparison'), faq: article('faq'),
};
