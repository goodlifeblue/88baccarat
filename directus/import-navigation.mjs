import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
assertLocalMaintenance();
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
if (!base || !token) throw new Error('Set DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN');
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Navigation import: ${method} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : (await response.json()).data;
}
const seed = JSON.parse(await readFile(new URL('./navigation-seed.json', import.meta.url), 'utf8'));
const brand = await api('/items/navbar_settings');
if (!brand?.id) {
  await api('/items/navbar_settings', 'PATCH', seed.brand);
  console.log('Initialized navbar settings');
} else console.log('Preserved existing navbar settings');
const existing = await api('/items/navigation?fields=id&limit=1');
if (existing.length) console.log('Preserved existing navigation; seed is only imported into an empty collection');
else {
  await api('/items/navigation', 'POST', seed.items.map((item, index) => ({ ...item, sort: index + 1, status: 'published', open_in_new_tab: false })));
  console.log(`Imported ${seed.items.length} navigation items`);
}
