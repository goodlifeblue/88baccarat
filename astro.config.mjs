import cloudflareRedirects from './scripts/cloudflare-redirects.mjs';
import cmsDevPages from './scripts/cms-dev-pages.mjs';
import { readEnvironment } from './scripts/environment.mjs';
import releaseMetadata from './scripts/release-metadata.mjs';
import { directusMarkdownImages } from './src/lib/directus-assets.mjs';
import { defineConfig } from 'astro/config';
import articleMarkdown from './scripts/article-markdown.mjs';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

const env = readEnvironment();
const imagePlugins = env.CONTENT_SOURCE === 'directus' ? [[directusMarkdownImages, { base: env.DIRECTUS_URL, legacyBases: (env.DIRECTUS_LEGACY_URLS || '').split(',').filter(Boolean) }]] : [];

export default defineConfig({
  site: env.SITE_URL,
  output: 'static',
  markdown: { remarkPlugins: [...imagePlugins, articleMarkdown] },
  server: {
    host: '127.0.0.1',
    port: 4388,
    allowedHosts: [new URL(env.SITE_URL).hostname],
  },
  experimental: {
    chromeDevtoolsWorkspace: true,
  },
  integrations: [mdx(), cmsDevPages({ liveArticles: env.CONTENT_SOURCE === 'directus' }), cloudflareRedirects(env), releaseMetadata(env)],
  vite: { server: { strictPort: true, allowedHosts: [new URL(env.SITE_URL).hostname] }, preview: { strictPort: true }, plugins: [tailwindcss()], define: { 'import.meta.env.APP_ENV': JSON.stringify(env.APP_ENV), 'import.meta.env.SITE_URL': JSON.stringify(env.SITE_URL) } },
});
