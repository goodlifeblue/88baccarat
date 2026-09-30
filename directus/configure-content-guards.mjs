import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
import { configureContentGuards } from './content-guard-settings.mjs';
import { configureArticleDrafts } from './article-drafts.mjs';
assertLocalMaintenance();
const schema = JSON.parse(await readFile(new URL('./schema.json', import.meta.url)));
const base = process.env.DIRECTUS_URL;
async function api(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  return r.status === 204 ? null : (await r.json()).data;
}
await configureContentGuards(api, schema);
await configureArticleDrafts(api);
console.log('Content guard guidance applied to all eight content collections.');
