import { writeFile, access } from 'node:fs/promises';
import { compileRedirects } from '../directus/hooks/redirects/rules.mjs';

export default function cloudflareRedirects(env) {
  return { name: 'directus-cloudflare-redirects', hooks: {
    'astro:build:done': async ({ dir, pages, logger }) => {
      if (env.CONTENT_SOURCE !== 'directus') return;
      const rows = [];
      for (let offset = 0; ; offset += 100) {
        const query = new URLSearchParams({ 'filter[enabled][_eq]': 'true', fields: 'old_path,new_path,status_code,enabled', limit: '100', offset: String(offset), sort: 'old_path' });
        const response = await fetch(`${env.DIRECTUS_URL.replace(/\/$/, '')}/items/redirects?${query}`, {
          headers: env.DIRECTUS_API_TOKEN ? { Authorization: `Bearer ${env.DIRECTUS_API_TOKEN}` } : {}, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Directus redirects: HTTP ${response.status}`);
        const { data } = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid Directus redirects response');
        rows.push(...data);
        if (data.length < 100) break;
      }
      const rules = compileRedirects(rows);
      const paths = new Set(pages.map(page => `/${page.pathname.replace(/^\//, '')}`.replace(/\/$/, '') || '/'));
      for (const row of rules) {
        if (paths.has(row.old_path.replace(/\/$/, '') || '/')) throw new Error(`Redirect source is an existing page: ${row.old_path}`);
      }
      const file = new URL('_redirects', dir);
      try { await access(file); throw new Error('Existing _redirects file: consolidate rules in Directus before building'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await writeFile(file, '# Generated from Directus; edit rules in the CMS.\n' + rules.map(row => `${row.old_path} ${row.new_path} 301`).join('\n') + '\n');
      logger.info(`Exported ${rules.length} redirect rules`);
    },
  } };
}
