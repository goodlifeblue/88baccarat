import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  output: 'static',
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
