import 'dotenv/config';
import { assertLocalMaintenance } from './environment.mjs';
assertLocalMaintenance();
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const prefix = `redirect-check-${randomUUID()}`;
const ids = [];
const base = process.env.DIRECTUS_URL;
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : (await response.json()).data;
}
const rules = () => api('/items/redirects?' + new URLSearchParams({'filter[old_path][_starts_with]':`/guide/${prefix}`,limit:'-1'}));
try {
  const article = await api('/items/articles','POST',{title:'Temporary redirect verification',slug:prefix+'-a',category:'guide',status:'published',excerpt:'Temporary test',content:'Test',published_at:new Date().toISOString()});
  ids.push(article.id);
  await api(`/items/articles/${article.id}`,'PATCH',{slug:prefix+'-b'});
  assert.equal((await rules())[0]?.new_path,`/guide/${prefix}-b/`);
  await api(`/items/articles/${article.id}`,'PATCH',{slug:prefix+'-c'});
  assert.equal((await rules()).length,2);
  assert.ok((await rules()).every(rule=>rule.new_path===`/guide/${prefix}-c/`));
  await api(`/items/articles/${article.id}`,'PATCH',{slug:prefix+'-a'});
  assert.ok((await rules()).every(rule=>rule.old_path!==`/guide/${prefix}-a/` && rule.new_path===`/guide/${prefix}-a/`));
  const other = await api('/items/articles','POST',{title:'Temporary collision test',slug:prefix+'-occupied',category:'guide',status:'draft',excerpt:'Test',content:'Test'});
  ids.push(other.id);
  await assert.rejects(()=>api(`/items/articles/${article.id}`,'PATCH',{slug:prefix+'-occupied'}));
  assert.equal((await api(`/items/articles/${article.id}`)).slug,prefix+'-a');
  assert.ok(!(await rules()).some(rule=>rule.old_path===`/guide/${prefix}-a/`));
  console.log('PASS: live slug rename, multiple renames, slug reversion, and transaction rollback');
} finally {
  for (const rule of await rules()) await api(`/items/redirects/${rule.id}`,'DELETE');
  for (const id of ids) await api(`/items/articles/${id}`,'DELETE');
}
