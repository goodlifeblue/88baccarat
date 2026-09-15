import 'dotenv/config';
import { readFile } from 'node:fs/promises';
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
if (!base || !token) throw new Error('Set DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN in .env or the shell');
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const messages = details.errors?.map((error) => error.message).join('; ') || response.statusText;
    throw new Error(`${method} ${path}: HTTP ${response.status} — ${messages}`);
  }
  return response.status === 204 ? null : (await response.json()).data;
}
const schema = JSON.parse(await readFile(new URL('./schema.json', import.meta.url), 'utf8'));
const collections = await api('/collections');
if (collections.some((item) => item.collection === 'articles')) {
  const fields = await api('/fields/articles');
  if (fields.some((item) => item.field === 'description') && !fields.some((item) => item.field === 'excerpt')) {
    throw new Error('Legacy articles schema detected. Back up and migrate description/cover/publishedAt/updatedAt/seoTitle/seoDescription to the new field names before setup; no changes were made.');
  }
}
for (const collection of schema.collections) {
  const fields = schema.fields.filter((field) => field.collection === collection.collection);
  if (!collections.some((item) => item.collection === collection.collection)) {
    await api('/collections', 'POST', { ...collection, schema: {}, fields });
  } else {
    const existing = await api(`/fields/${collection.collection}`);
    for (const field of fields) {
      if (!existing.some((item) => item.field === field.field)) await api(`/fields/${collection.collection}`, 'POST', field);
    }
  }
}
const relations = await api('/relations');
for (const relation of schema.relations) {
  if (!relations.some((item) => item.collection === relation.collection && item.field === relation.field)) {
    await api('/relations', 'POST', relation);
  }
}
console.log('Article fields and relations ready. Existing field definitions and content were preserved.');

const policyName = '文章行銷（草稿與送審）';
const policies = await api(`/policies?${new URLSearchParams({ 'filter[name][_eq]': policyName })}`);
if (policies.length) {
  console.log('Marketing policy already exists; review it against marketing-permissions.json. Existing permissions were preserved.');
} else {
  const policy = await api('/policies', 'POST', { name: policyName, icon: 'edit_note', admin_access: false, app_access: true });
  const permissions = JSON.parse(await readFile(new URL('./marketing-permissions.json', import.meta.url), 'utf8'));
  for (const permission of permissions) await api('/permissions', 'POST', { ...permission, policy: policy.id });
  console.log('Marketing policy created. Assign it to the marketing role; configure media-folder permissions separately.');
}
