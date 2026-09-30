import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
assertLocalMaintenance();
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
if (!base || !token) throw new Error('Set DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN');
async function api(path, method = 'GET', body) {
  const form = body instanceof FormData;
  const response = await fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(!form ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? form ? body : JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Site import ${method} ${path}: HTTP ${response.status}: ${error.errors?.map(item => item.message).join('; ') || ''}`);
  }
  return response.status === 204 ? null : (await response.json()).data;
}
async function find(collection, field, value) {
  return api(`/${collection}?${new URLSearchParams({ [`filter[${field}][_eq]`]: value, limit: '-1' })}`);
}
const folderName = '網站公開素材';
let [folder] = await find('folders', 'name', folderName);
folder ||= await api('/folders', 'POST', { name: folderName });
const policies = await api('/policies?limit=-1');
const publicPolicy = policies.find(policy => policy.name === '$t:public_label');
if (!publicPolicy) throw new Error('Public policy not found; configure folder-scoped media read access before importing');
const publicRules = await api(`/permissions?${new URLSearchParams({ 'filter[policy][_eq]': publicPolicy.id, 'filter[collection][_eq]': 'directus_files', 'filter[action][_eq]': 'read' })}`);
if (!publicRules.length) await api('/permissions', 'POST', { policy: publicPolicy.id, collection: 'directus_files', action: 'read', fields: ['*'], permissions: { folder: { _eq: folder.id } } });
// Only this explicitly public folder is exposed; do not broaden custom existing rules.
for (const policy of policies.filter(policy => ['文章行銷（草稿與送審）', '網站建置：已發布文章唯讀'].includes(policy.name))) {
  const existing = await api(`/permissions?${new URLSearchParams({ 'filter[policy][_eq]': policy.id, limit: '-1' })}`);
  const rules = [
    { collection: 'directus_files', action: 'read', fields: ['*'], permissions: { folder: { _eq: folder.id } } },
    { collection: 'directus_folders', action: 'read', fields: ['id', 'name', 'parent'], permissions: { id: { _eq: folder.id } } },
  ];
  if (policy.name === '文章行銷（草稿與送審）') rules.push({ collection: 'directus_files', action: 'create', fields: ['filename_download', 'title', 'description', 'folder', 'type', 'storage'], permissions: {}, presets: { folder: folder.id }, validation: { folder: { _eq: folder.id } } });
  for (const rule of rules) if (!existing.some(item => item.collection === rule.collection && item.action === rule.action)) await api('/permissions', 'POST', { ...rule, policy: policy.id });
}
const paths = ['/favicon.svg', '/og-image.svg', '/poker.mp4', ...(await readdir(new URL('../public/images/', import.meta.url))).filter(name => /\.(png|jpg|jpeg|svg|webp)$/i.test(name)).map(name => `/images/${name}`)];
const media = {};
for (const path of paths) {
  const marker = `site-import:${path}`;
  let [file] = await find('files', 'description', marker);
  if (!file) {
    const bytes = await readFile(new URL(`../public${path}`, import.meta.url));
    const types = { '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
    const form = new FormData();
    form.append('folder', folder.id); form.append('title', basename(path)); form.append('description', marker);
    form.append('file', new Blob([bytes], { type: types[extname(path).toLowerCase()] }), basename(path));
    file = await api('/files', 'POST', form);
    console.log(`Uploaded ${path}`);
  }
  media[path] = file.id;
  const probe = await fetch(`${base}/assets/${file.id}`, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
  if (!probe.ok) throw new Error(`Public asset inaccessible (${probe.status}): ${path}. Review existing public folder permissions.`);
}
function rewrite(value) {
  if (typeof value === 'string') {
    if (media[value]) return media[value];
    return value.replace(/\/images\/[\w.-]+/g, path => media[path] ? `/assets/${media[path]}` : path);
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
  return value;
}
const settings = await api('/items/site_settings');
if (!settings?.id) {
  const seed = JSON.parse(await readFile(new URL('./seeds/site-settings.json', import.meta.url), 'utf8'));
  await api('/items/site_settings', 'PATCH', rewrite(seed));
  console.log('Imported site settings');
} else console.log('Preserved existing site settings');
const seeds = JSON.parse(await readFile(new URL('./seeds/pages.json', import.meta.url), 'utf8'));
for (const seed of seeds) {
  const existing = await find('items/pages', 'path', seed.path);
  if (existing.length) { console.log(`Preserved page ${seed.path}`); continue; }
  await api('/items/pages', 'POST', rewrite(seed));
  console.log(`Imported page ${seed.path}`);
}
// Bind existing URL navigation to its matching managed page, preserving labels and sort.
const pages = await api('/items/pages?fields=id,path&limit=-1');
const navigation = await api('/items/navigation?limit=-1');
for (const item of navigation) {
  const page = pages.find(page => page.path === item.href);
  if (page && !item.page) await api(`/items/navigation/${item.id}`, 'PATCH', { link_type: 'page', page: page.id });
}
// Preserve all editorial changes; only replace legacy local media references.
const articles = await api('/items/articles?fields=id,image,ogImage,content&limit=-1');
for (const article of articles) {
  const patch = {};
  for (const key of ['image', 'ogImage', 'content']) {
    const value = rewrite(article[key]);
    if (value !== article[key]) patch[key] = value;
  }
  if (Object.keys(patch).length) await api(`/items/articles/${article.id}`, 'PATCH', patch);
}
console.log(`Site migration complete: ${pages.length} pages, ${Object.keys(media).length} media files. Existing editorial text preserved.`);
await import('./migrate-hero.mjs');
