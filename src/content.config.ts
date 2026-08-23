import { defineCollection, z } from 'astro:content';
const article = defineCollection({
  type: 'content',
  schema: z.object({ title: z.string(), description: z.string(), publishedAt: z.coerce.date(), updatedAt: z.coerce.date().optional(), author: z.string().default('百家樂攻略誌編輯部'), image: z.string().optional(), imageAlt: z.string().optional(), featured: z.boolean().default(false), faq: z.array(z.object({ question: z.string(), answer: z.string() })).default([]) }),
});
export const collections = { baccarat: article, strategy: article, guide: article, tips: article, comparison: article, faq: article };
