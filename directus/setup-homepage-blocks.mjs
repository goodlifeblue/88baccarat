import 'dotenv/config';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
import { configureHomepageBlocks } from './homepage-blocks.mjs';
assertLocalMaintenance();
async function api(path, method = 'GET', body) {
  const response = await fetch(process.env.DIRECTUS_URL + path, { method, headers: { Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.errors)}`);
  return json.data;
}
await configureHomepageBlocks(api);
console.log('Homepage blocks, article picker, sorting, permissions and existing content migration ready.');
