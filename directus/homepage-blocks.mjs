import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { guardedMeta } from './content-guard-settings.mjs';

export async function configureHomepageBlocks(api, { migrate = true } = {}) {
  const schema = JSON.parse(await readFile(new URL('./schema.json', import.meta.url), 'utf8'));
  const names = ['homepage_blocks', 'homepage_block_articles'];
  const existing = await api('/collections');
  for (const name of names) {
    const collection = schema.collections.find(c => c.collection === name);
    const fields = schema.fields.filter(f => f.collection === name);
    if (!existing.some(c => c.collection === name)) await api('/collections', 'POST', { ...collection, schema: {}, fields });
    else {
      const current = await api('/fields/' + name);
      for (const field of fields) if (!current.some(f => f.field === field.field)) await api('/fields/' + name, 'POST', field);
    }
    await api('/collections/' + name, 'PATCH', { meta: collection.meta });
    for (const field of fields) await api(`/fields/${name}/${field.field}`, 'PATCH', { meta: { ...field.meta, ...guardedMeta(field) } });
  }
  const relations = await api('/relations');
  for (const relation of schema.relations.filter(r => names.includes(r.collection))) {
    const found = relations.find(r => r.collection === relation.collection && r.field === relation.field);
    if (!found) await api('/relations', 'POST', relation);
    else await api(`/relations/${relation.collection}/${relation.field}`, 'PATCH', { meta: relation.meta });
  }
  const presets = await api('/presets?filter[collection][_eq]=homepage_blocks&limit=-1');
  if (!presets.some(p => !p.user && !p.role && !p.bookmark)) await api('/presets', 'POST', { collection: 'homepage_blocks', layout: 'tabular', layout_query: { tabular: { fields: ['title', 'enabled', 'type', 'article_source', 'sort'], sort: ['sort'] } } });

  const policies = await api('/policies?limit=-1');
  const editable = schema.fields.filter(f => f.collection === 'homepage_blocks' && f.field !== 'id').map(f => f.field);
  for (const policy of policies) {
    const build = policy.name === '網站建置：已發布文章唯讀';
    const manager = policy.name === '行銷主管';
    const editor = ['文章編輯', '文章行銷（草稿與送審）'].includes(policy.name);
    const reader = policy.name === '唯讀人員';
    if (!build && !manager && !editor && !reader) continue;
    const permissions = await api(`/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
    const rules = [
      { collection: 'homepage_blocks', action: 'read', fields: ['*'], permissions: build ? { enabled: { _eq: true } } : {} },
      { collection: 'homepage_block_articles', action: 'read', fields: ['*'], permissions: build ? { _and: [{ block_id: { enabled: { _eq: true } } }, { article_id: { status: { _eq: 'published' }, category: { _in: ['baccarat', 'strategy', 'guide', 'tips', 'comparison'] } } }] } : {} },
    ];
    if (manager || editor) for (const action of ['create', 'update', 'delete']) {
      rules.push({ collection: 'homepage_blocks', action, fields: editable, permissions: editor && action !== 'create' ? { enabled: { _eq: false } } : {}, ...(editor ? { validation: { enabled: { _eq: false } }, presets: { enabled: false } } : {}) });
      rules.push({ collection: 'homepage_block_articles', action, fields: ['block_id', 'article_id', 'sort'], permissions: editor && action !== 'create' ? { block_id: { enabled: { _eq: false } } } : {}, ...(editor ? { validation: { block_id: { enabled: { _eq: false } } } } : {}) });
    }
    for (const rule of rules) if (!permissions.some(p => p.collection === rule.collection && p.action === rule.action)) await api('/permissions', 'POST', { ...rule, policy: policy.id });
  }
  const pageFields = await api('/fields/pages');
  if (!pageFields.some(f => f.field === 'homepage_blocks_enabled')) await api('/fields/pages', 'POST', schema.fields.find(f => f.collection === 'pages' && f.field === 'homepage_blocks_enabled'));
  if (migrate) {
    const home = (await api('/items/pages?filter[path][_eq]=/&limit=1'))[0];
    if (home && !home.homepage_blocks_enabled) {
      const rows = await api('/items/homepage_blocks?limit=-1');
      for (const [index, section] of (home.sections || []).entries()) {
        const hex = createHash('sha256').update(`homepage-block:${home.id}:${index}`).digest('hex');
        const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
        if (!rows.some(row => row.id === id)) await api('/items/homepage_blocks', 'POST', { ...section, id, sort: index + 1, enabled: section.enabled !== false, article_source: 'auto' });
      }
      await api(`/items/pages/${home.id}`, 'PATCH', { homepage_blocks_enabled: true });
    }
  }
  const field = await api('/fields/pages/sections');
  const conditions = (field.meta.conditions || []).filter(c => c.name !== '首頁改用區塊管理');
  await api('/fields/pages/sections', 'PATCH', { meta: { note: '首頁區塊請至左側「首頁區塊」新增、挑選文章與排序。其他頁面繼續在此編輯。', conditions: [...conditions, { name: '首頁改用區塊管理', rule: { path: { _eq: '/' } }, hidden: true }] } });
}
