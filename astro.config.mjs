import { loadEnv } from 'vite';
import { directusMarkdownImages } from './src/lib/directus-assets.mjs';
import { defineConfig } from 'astro/config';
import articleMarkdown from './scripts/article-markdown.mjs';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const env = { ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), ''), ...process.env };
const imagePlugins = env.CONTENT_SOURCE === 'directus' ? [[directusMarkdownImages, { base: env.DIRECTUS_URL, legacyBases: (env.DIRECTUS_LEGACY_URLS || '').split(',').filter(Boolean) }]] : [];

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  output: 'static',
  markdown: { remarkPlugins: [...imagePlugins, articleMarkdown] },
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  experimental: {
    chromeDevtoolsWorkspace: true,
  },
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
