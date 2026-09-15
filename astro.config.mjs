import { defineConfig } from 'astro/config';
import articleMarkdown from './scripts/article-markdown.mjs';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  output: 'static',
  markdown: { remarkPlugins: [articleMarkdown] },
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
