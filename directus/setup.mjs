import 'dotenv/config';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
assertLocalMaintenance();
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
await api('/collections/articles', 'PATCH', { meta: { versioning: true } });
// Navigation can now point to a managed page instead of a manually entered URL.
await api('/fields/navigation/href', 'PATCH', { schema: { is_nullable: true }, meta: { required: false, note: '自訂網址才需填寫；選擇 Directus 頁面會自動使用該頁網址。' } });
console.log('Article fields and relations ready. Existing field definitions and content were preserved.');

const policyName = '文章行銷（草稿與送審）';
const policies = await api(`/policies?${new URLSearchParams({ 'filter[name][_eq]': policyName })}`);
if (policies.length) {
  console.log('Marketing policy already exists; review it against marketing-permissions.json. Existing permissions were preserved.');
  const permissions = JSON.parse(await readFile(new URL('./marketing-permissions.json', import.meta.url), 'utf8'));
  for (const policy of policies) {
    const existing = await api(`/permissions?${new URLSearchParams({ 'filter[policy][_eq]': policy.id, limit: '-1' })}`);
    for (const permission of permissions.filter(item => ['navigation', 'navbar_settings', 'pages', 'site_settings'].includes(item.collection))) {
      const found = existing.find(item => item.collection === permission.collection && item.action === permission.action);
      if (!found) {
        await api('/permissions', 'POST', { ...permission, policy: policy.id });
      } else if (permission.collection === 'navigation' && !found.fields.includes('*')) {
        await api(`/permissions/${found.id}`, 'PATCH', { fields: [...new Set([...found.fields, 'page', 'link_type'])] });
      } else if (['navbar_settings', 'site_settings'].includes(permission.collection) && permission.action === 'update') {
        const fields = found.fields.includes('*') ? permission.fields : found.fields.filter(field => field !== 'id');
        await api(`/permissions/${found.id}`, 'PATCH', { fields });
      }
    }
  }
} else {
  const policy = await api('/policies', 'POST', { name: policyName, icon: 'edit_note', admin_access: false, app_access: true });
  const permissions = JSON.parse(await readFile(new URL('./marketing-permissions.json', import.meta.url), 'utf8'));
  for (const permission of permissions) await api('/permissions', 'POST', { ...permission, policy: policy.id });
  console.log('Marketing policy created. Assign it to the marketing role; configure media-folder permissions separately.');
}

// Extend the existing website build policy without granting write access.
const buildPolicies = await api(`/policies?${new URLSearchParams({ 'filter[name][_eq]': '網站建置：已發布文章唯讀' })}`);
for (const policy of buildPolicies) {
  const existing = await api(`/permissions?${new URLSearchParams({ 'filter[policy][_eq]': policy.id, 'filter[collection][_eq]': 'redirects', 'filter[action][_eq]': 'read' })}`);
  if (!existing.length) await api('/permissions', 'POST', { policy: policy.id, collection: 'redirects', action: 'read', fields: ['old_path', 'new_path', 'status_code', 'enabled'], permissions: { enabled: { _eq: true } } });
  for (const rule of [
    { collection: 'navigation', fields: ['id', 'label', 'href', 'sort', 'status', 'open_in_new_tab', 'page', 'link_type'], permissions: { status: { _eq: 'published' } } },
    { collection: 'navbar_settings', fields: ['id', 'brand_label', 'brand_symbol', 'brand_href'], permissions: {} },
    { collection: 'pages', fields: ['*'], permissions: { status: { _eq: 'published' } } },
    { collection: 'site_settings', fields: ['*'], permissions: {} },
  ]) {
    const found = await api(`/permissions?${new URLSearchParams({ 'filter[policy][_eq]': policy.id, 'filter[collection][_eq]': rule.collection, 'filter[action][_eq]': 'read' })}`);
    if (!found.length) await api('/permissions', 'POST', { ...rule, policy: policy.id, action: 'read' });
    else if (rule.collection === 'navigation' && !found[0].fields.includes('*')) await api(`/permissions/${found[0].id}`, 'PATCH', { fields: [...new Set([...found[0].fields, 'page', 'link_type'])] });
  }
}
