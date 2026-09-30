import { compileRedirects, validatePath } from './rules.mjs';
import { validateFloatingButtons } from './floating-validation.mjs';
import { readFileSync } from 'node:fs';
const fieldRules = JSON.parse(readFileSync(new URL('./field-rules.json', import.meta.url), 'utf8'));

export const collections = ['articles', 'article_relations', 'pages', 'hero_slides', 'navigation', 'navbar_settings', 'site_settings', 'redirects', 'homepage_blocks', 'homepage_block_articles'];
const categories = ['baccarat', 'strategy', 'guide', 'tips', 'comparison', 'faq'];
const statuses = ['draft', 'review', 'published', 'archived'];
const jsonFields = ['faq', 'relatedArticles', 'sections', 'cards', 'categories', 'footer_groups', 'floating_buttons'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invalid(field, message) {
  const labels = Object.assign({}, ...Object.values(fieldRules).map(fields => Object.fromEntries(Object.entries(fields).filter(([key, rule]) => rule.label !== key).map(([key, rule]) => [key, rule.label]))));
  for (const key of Object.keys(labels).sort((a, b) => b.length - a.length)) if (labels[key] !== key) message = message.replaceAll(key, labels[key]);
  const error = new Error(message);
  Object.assign(error, { name: 'DirectusError', code: 'INVALID_PAYLOAD', status: 400, extensions: { field, reason: message } });
  throw error;
}
const text = (value, field) => { if (typeof value !== 'string' || !value.trim()) invalid(field, `「${field}」不可留白，請填寫後再儲存或發布。`); };
const choice = (value, values, field) => { if (!values.includes(value)) invalid(field, `「${field}」請選擇有效選項：${values.join('、')}。`); };
const list = (value, field) => { if (value == null) return []; if (!Array.isArray(value) || value.some(x => !x || typeof x !== 'object' || Array.isArray(x))) invalid(field, `「${field}」必須是完整的項目清單，請移除空白項目。`); return value; };
export function safeLink(value, field) {
  text(value, field);
  let valid = !/[\s\\\u0000-\u001f\u007f]/u.test(value);
  if (!(value.startsWith('/') && !value.startsWith('//'))) {
    try { const u = new URL(value); valid &&= /^https:\/\//i.test(value) && u.protocol === 'https:' && !u.username && !u.password; } catch { valid = false; }
  }
  if (!valid) invalid(field, `「${field}」請填完整 HTTPS 網址或以 / 開頭的站內路徑，不可含空白、帳密或程式碼。`);
}
function asset(value, field, required = false) {
  if (!value && !required) return;
  text(value, field);
  if (uuid.test(value)) return;
  // Preserve existing local Directus HTTP asset URLs; other external assets require HTTPS.
  if (/^https?:\/\//.test(value)) {
    try { const u = new URL(value); if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) && !u.username && !u.password && !/\s/.test(value)) return; } catch {}
  }
  safeLink(value, field);
  const path = value.replace(/^https?:\/\/[^/]+/, '');
  if (path.startsWith('/assets/') && !uuid.test(path.slice(8).split(/[/?#]/)[0])) invalid(field, `「${field}」檔案網址不完整，請重新選取媒體。`);
}
function pair(row, label, href) {
  if (row[label] || row[href]) { text(row[label], label); safeLink(row[href], href); }
}
function faq(value, required) {
  for (const [i, item] of list(value, 'faq').entries()) if (required) { text(item.question, `faq 第 ${i + 1} 項問題`); text(item.answer, `faq 第 ${i + 1} 項答案`); }
}
export function decodeRow(row) {
  const result = { ...row };
  for (const field of jsonFields) if (typeof result[field] === 'string') {
    try { result[field] = JSON.parse(result[field]); } catch { invalid(field, `「${field}」資料格式錯誤，請重新編輯清單。`); }
  }
  for (const [k, v] of Object.entries(result)) if ((k.endsWith('_enabled') || ['enabled', 'featured', 'noindex', 'open_in_new_tab', 'hero_autoplay'].includes(k)) && [0, 1].includes(v)) result[k] = Boolean(v);
  for (const [k, v] of Object.entries(result)) if (k.endsWith('_at') && (typeof v === 'number' || v instanceof Date) && Number.isFinite(new Date(v).valueOf())) result[k] = new Date(v).toISOString();
  return result;
}
export function validateContent(collection, row) {
  const live = row.status === 'published';
  for (const [field, rule] of Object.entries(fieldRules[collection] || {})) {
    const value = row[field];
    if (value == null) continue;
    if (collection === 'homepage_block_articles' && field === 'article_id' && typeof value === 'object' && !Array.isArray(value)) continue;
    if (['string', 'text', 'uuid'].includes(rule.type) && typeof value !== 'string') invalid(field, `「${rule.label}」請輸入文字或選取既有項目。`);
    if (rule.type === 'integer' && !Number.isInteger(value)) invalid(field, `「${rule.label}」必須是整數。`);
    if (rule.type === 'timestamp' && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) invalid(field, `「${rule.label}」請填寫有效日期。`);
  }
  for (const [field, value] of Object.entries(row)) {
    if (value != null && (field.endsWith('_enabled') || ['enabled', 'featured', 'noindex', 'open_in_new_tab', 'hero_autoplay'].includes(field)) && typeof value !== 'boolean') invalid(field, `「${field}」請使用開關選項。`);
  }
  if (['articles', 'pages', 'navigation'].includes(collection)) choice(row.status ?? 'draft', statuses, 'status');
  if (collection === 'homepage_blocks') {
    text(row.title, 'title');
    choice(row.type ?? 'articles', ['articles', 'markdown', 'categories', 'cards', 'cta'], 'type');
    choice(row.article_source ?? 'manual', ['manual', 'auto'], 'article_source');
    validateContent('pages', { path: '/', title: row.title, description: '首頁區塊', page_type: 'single_page', status: row.enabled ? 'published' : 'draft', sections: [row] });
  }
  if (['homepage_blocks', 'homepage_block_articles'].includes(collection) && row.sort != null && (!Number.isInteger(row.sort) || row.sort < 0)) invalid('sort', '排序請使用不小於 0 的整數，或在清單拖曳排序。');
  if (collection === 'articles') {
    if (row.slug != null && row.slug !== '' && !/^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u.test(row.slug)) invalid('slug', '文章網址只能使用中英文字、數字、連字號或底線，不可含空白或斜線。');
    if (row.category != null && row.category !== '') choice(row.category, categories, 'category');
    if (live) { for (const f of ['title', 'slug', 'category', 'excerpt', 'content']) text(row[f], f); if (!row.published_at || !Number.isFinite(Date.parse(row.published_at))) invalid('published_at', '發布文章前請填寫有效的發布日期。'); }
    faq(row.faq, live);
    if (row.relatedArticles != null && (!Array.isArray(row.relatedArticles) || row.relatedArticles.some(x => typeof x !== 'string'))) invalid('relatedArticles', '相關文章必須是文章識別碼清單。');
    for (const f of ['image', 'ogImage', 'cover_image']) asset(row[f], f);
  }
  if (collection === 'pages') {
    if (row.path != null && (typeof row.path !== 'string' || (row.path !== '/' && !/^\/(?:[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*\/)+$/u.test(row.path)) || /^\/(?:404|assets|_astro|admin|rss.xml|sitemap[^/]*)(?:\/|$)/.test(row.path) || /^\/(?:baccarat|strategy|guide|tips|comparison|faq)\/.+/.test(row.path))) invalid('path', '頁面網址須以 / 開頭及結尾，不可使用系統保留路徑或文章網址。');
    choice(row.page_type ?? 'single_page', ['single_page', 'article_list', 'custom_page'], 'page_type');
    if (live) { for (const f of ['title', 'path', 'description']) text(row[f], f); if (row.page_type === 'article_list') choice(row.article_category, ['all', ...categories.filter(x => x !== 'faq')], 'article_category'); if (row.page_type === 'custom_page') choice(row.custom_template, ['home', 'faq', 'standard'], 'custom_template'); }
    if (row.hero_interval != null && (!Number.isInteger(row.hero_interval) || row.hero_interval < 2000 || row.hero_interval > 30000)) invalid('hero_interval', '輪播間隔請填 2000～30000 毫秒（2～30 秒）的整數。');
    faq(row.faq, live && row.faq_enabled !== false);
    const anchors = new Set(['faq-title']);
    for (const [i, section] of list(row.sections, 'sections').entries()) {
      if (section.enabled === false || row.sections_enabled === false) continue;
      const f = `sections 第 ${i + 1} 區塊`;
      for (const name of ['title', 'description', 'content', 'anchor', 'link_label', 'link_href']) if (section[name] != null && typeof section[name] !== 'string') invalid('sections', `${f}：${name} 請填文字。`);
      choice(section.type, ['markdown', 'articles', 'categories', 'cards', 'cta'], f);
      if (section.anchor && (!/^[a-z][a-z0-9-]*$/.test(section.anchor) || anchors.has(section.anchor))) invalid('sections', `${f}：錨點須以小寫英文開頭，且不可重複或使用 faq-title。`);
      if (section.anchor) anchors.add(section.anchor);
      if (section.limit != null && (!Number.isInteger(section.limit) || section.limit < 1 || section.limit > 100)) invalid('sections', `${f}：文章數量須為 1～100 的整數。`);
      if (section.category) choice(section.category, ['all', ...categories.filter(x => x !== 'faq')], f);
      if (section.link_href) safeLink(section.link_href, f + '網址');
      if (live) { pair(section, 'link_label', 'link_href'); if (section.type === 'cta') { text(section.link_label, f + '按鈕文字'); safeLink(section.link_href, f + '按鈕網址'); } }
      for (const card of list(section.cards, f + '卡片')) if (live) { text(card.title, f + '卡片標題'); text(card.content, f + '卡片內容'); }
    }
    if (row.hero_button_href) safeLink(row.hero_button_href, 'hero_button_href');
    for (const f of ['hero_image', 'hero_video']) asset(row[f], f);
  }
  if (collection === 'hero_slides') {
    if (row.media_type != null) choice(row.media_type, ['image', 'video'], 'media_type');
    if (row.enabled !== false) { text(typeof row.page === 'object' ? row.page?.id : row.page, 'page'); choice(row.media_type, ['image', 'video'], 'media_type'); asset(row[row.media_type], row.media_type, true); pair(row, 'button_label', 'button_href'); }
    if (row.button_href) safeLink(row.button_href, 'button_href');
    for (const f of ['image', 'video', 'poster']) asset(row[f], f);
  }
  if (collection === 'navigation') {
    choice(row.link_type ?? 'url', ['url', 'page'], 'link_type');
    if (row.href) safeLink(row.href, 'href');
    if (live) { text(row.label, 'label'); if (row.link_type === 'page') text(typeof row.page === 'object' ? row.page?.id : row.page, 'page'); else safeLink(row.href, 'href'); }
  }
  if (collection === 'navbar_settings') { text(row.brand_label, 'brand_label'); safeLink(row.brand_href, 'brand_href'); }
  if (collection === 'site_settings') {
    for (const f of ['name', 'description', 'organization', 'locale', 'footer_brand', 'not_found_title', 'not_found_button', 'cta_title', 'cta_label']) text(row[f], f);
    for (const f of ['og_image', 'favicon', 'inner_banner', 'default_cover']) asset(row[f], f, true);
    safeLink(row.cta_href, 'cta_href');
    if (!Array.isArray(row.categories) || !Array.isArray(row.footer_groups)) invalid('categories', '分類與頁尾連結必須保留清單格式；不使用時請移除清單項目，不可清空為其他格式。');
    const keys = new Set();
    for (const category of list(row.categories, 'categories')) { choice(category.key, categories, 'categories 分類代碼'); if (keys.has(category.key)) invalid('categories', '分類代碼不可重複。'); keys.add(category.key); text(category.title, 'categories 分類名稱'); safeLink(category.href, 'categories 網址'); asset(category.icon, 'categories 圖示', true); }
    for (const group of list(row.footer_groups, 'footer_groups')) { text(group.title, 'footer_groups 群組標題'); if (!Array.isArray(group.links)) invalid('footer_groups', '頁尾群組須保留連結清單，不使用的群組請整組移除。'); for (const link of list(group.links, 'footer_groups 連結')) { text(link.label, 'footer_groups 連結文字'); safeLink(link.href, 'footer_groups 網址'); } }
    validateFloatingButtons(row.floating_buttons);
  }
  if (collection === 'redirects') {
    for (const f of ['old_path', 'new_path']) { try { validatePath(row[f]); } catch { invalid(f, '轉址請使用站內路徑，不可含參數、錨點、萬用字元或空白。'); } }
    if (row.old_path === row.new_path) invalid('new_path', '轉址來源與目的地不可相同。');
    if (Number(row.status_code ?? 301) !== 301) invalid('status_code', '目前僅支援 301 永久轉址。');
  }
  if (collection === 'article_relations' && row.article_id && row.article_id === row.related_id) invalid('related_id', '相關文章不可選擇文章自己。');
}

const keyOf = value => typeof value === 'object' ? value?.id : value;
const fileFields = { articles: { cover_image: 'image', image: 'image', ogImage: 'image' }, pages: { hero_image: 'image', hero_video: 'video' }, hero_slides: { image: 'image', poster: 'image', video: 'video' }, site_settings: { og_image: 'image', favicon: 'image', inner_banner: 'image', default_cover: 'image' } };
export async function validateReferences(db, collection, row, previous = {}) {
  if (collection === 'homepage_blocks' && row.enabled && row.anchor && await db('homepage_blocks').where({ enabled: true, anchor: row.anchor }).whereNot('id', row.id || '').first()) invalid('anchor', '首頁已使用相同錨點，請改用其他英文名稱。');
  if (collection === 'homepage_block_articles') {
    if (!row.block_id || !await db('homepage_blocks').where({ id: row.block_id }).first()) invalid('block_id', '請先選擇或儲存首頁區塊。');
    let article = typeof row.article_id === 'object' ? row.article_id : null;
    const id = keyOf(row.article_id);
    if (id) {
      const stored = await db('articles').where({ id }).first();
      if (!stored) invalid('article_id', '所選文章不存在，請重新選取。');
      article = { ...stored, ...article };
      if (await db('homepage_block_articles').where({ block_id: row.block_id, article_id: id }).whereNot('id', row.id || '').first()) invalid('article_id', '此文章已加入區塊，請勿重複選取。');
    }
    if (!article) invalid('article_id', '請選取文章或新增文章。');
    if (article.category === 'faq') invalid('article_id', 'FAQ 為問答資料，沒有獨立文章頁；請選擇其他分類的文章。');
  }
  const media = Object.entries(fileFields[collection] || {}).map(([field, type]) => [field, type, row[field]]);
  if (collection === 'site_settings') for (const [i, category] of (row.categories || []).entries()) media.push([`categories 第 ${i + 1} 項圖示`, 'image', category.icon]);
  for (const [field, type, value] of media) {
    if (!value) continue;
    const id = typeof value === 'string' && (uuid.test(value) ? value : value.match(/\/assets\/([0-9a-f-]{36})/i)?.[1]);
    if (id) { const file = await db('directus_files').where({ id }).first(); if (!file || !file.type?.startsWith(type + '/')) invalid(field, `「${field}」請選擇存在的${type === 'video' ? '影片' : '圖片'}檔案。`); }
  }
  if (collection === 'navigation' && row.status === 'published' && row.link_type === 'page') {
    const page = await db('pages').where({ id: keyOf(row.page) }).first();
    if (!page || page.status !== 'published') invalid('page', '導覽所連結的頁面尚未發布或已刪除；請先發布頁面再啟用導覽。');
  }
  if (collection === 'hero_slides' && row.page && !await db('pages').where({ id: keyOf(row.page) }).first()) invalid('page', '請先儲存所屬頁面，再新增輪播。');
  if (collection === 'pages') {
    if (previous.path === '/' && (row.path !== '/' || row.status !== 'published')) invalid('path', '首頁不可改網址、下架或刪除；請直接編輯首頁內容。');
    if (previous.status === 'published' && row.path !== previous.path) invalid('path', '已發布頁面不可直接改網址。請先處理引用連結並下架，再改網址及設定 301 轉址。');
    if (previous.status === 'published' && row.status !== 'published') await assertUnreferenced(db, collection, [previous]);
    if (row.path && await db('pages').where({ path: row.path }).whereNot('id', row.id || '').first()) invalid('path', '此頁面網址已使用，請改用不同網址。');
    if (row.status === 'published' && row.hero_enabled !== false) for (const slide of await db('hero_slides').where({ page: row.id || '' })) { const decoded = decodeRow(slide); validateContent('hero_slides', decoded); await validateReferences(db, 'hero_slides', decoded); }
  }
  if (collection === 'articles' && row.slug && row.category && await db('articles').where({ slug: row.slug, category: row.category }).whereNot('id', row.id || '').first()) invalid('slug', '此分類已有相同文章網址，請修改 slug。');
  if (collection === 'article_relations') for (const f of ['article_id', 'related_id']) { if (!row[f] || !await db('articles').where({ id: keyOf(row[f]) }).first()) invalid(f, '相關文章不存在，請先儲存文章再建立關聯。'); }
  if (collection === 'redirects' && row.enabled !== false) {
    const existing = await db('redirects').whereNot('id', row.id || '');
    try { compileRedirects([...existing, row]); } catch (e) { invalid('new_path', '轉址重複、形成循環或超過上限，請檢查來源與目的地。'); }
    if (await db('pages').where({ path: row.old_path, status: 'published' }).first()) invalid('old_path', '轉址來源仍是已發布頁面，請先處理該頁面。');
    for (const a of await db('articles').where({ status: 'published' }).select('category', 'slug')) if (`/${a.category}/${a.slug}/` === row.old_path) invalid('old_path', '轉址來源仍是已發布文章，請先處理該文章。');
  }
}

async function assertUnreferenced(db, collection, rows) {
  if (['site_settings', 'navbar_settings'].includes(collection)) invalid('id', '全站設定不可刪除，請編輯內容。');
  for (const row of rows) {
    if (collection === 'articles' && await db('homepage_block_articles').where({ article_id: row.id }).first()) invalid('id', '此文章仍被首頁區塊選取，請先從區塊移除；移除選取不會刪除文章。');
    if (collection === 'pages' && row.path === '/') invalid('path', '首頁不可下架或刪除。');
    if (collection === 'pages') {
      const navigation = await db('navigation').where({ page: row.id, status: 'published' }).first();
      if (navigation) invalid('status', `此頁面正被導覽「${navigation.label}」使用，請先修改或下架該導覽。`);
    }
    const target = collection === 'pages' ? row.path : collection === 'articles' ? `/${row.category}/${row.slug}/` : row.id;
    if (!target) continue;
    if (['pages', 'articles'].includes(collection) && await db('redirects').where({ new_path: target, enabled: true }).first()) invalid('id', '此內容是啟用中轉址的目的地，請先調整轉址。');
    for (const c of collections) {
      if (c === 'redirects' || c === 'article_relations') continue;
      for (const ref of await db(c).select('*')) {
        if (c === collection && rows.some(r => r.id === ref.id)) continue;
        const serialized = JSON.stringify(ref);
        if ((collection === 'directus_files' && serialized.includes(target)) || (['pages', 'articles'].includes(collection) && (serialized.includes(JSON.stringify(target)) || serialized.includes(`(${target})`)))) invalid('id', `此內容仍被「${c}」的「${ref.title || ref.name || ref.label || ref.id}」引用，請先更換引用。`);
      }
    }
  }
}

export function registerContentValidation(filter, database) {
  for (const collection of collections) {
    filter(`${collection}.items.create`, async (payload, _meta, context) => {
      const defaults = Object.fromEntries(Object.entries(fieldRules[collection] || {}).filter(([, rule]) => Object.hasOwn(rule, 'default')).map(([field, rule]) => [field, rule.default]));
      if (collection === 'articles' && payload.slug === '') payload = { ...payload, slug: null };
      const row = decodeRow({ ...defaults, ...payload });
      validateContent(collection, row);
      await validateReferences(context?.database || database, collection, row);
      return payload;
    });
    filter(`${collection}.items.update`, async (payload, meta, context) => {
      const db = context?.database || database;
      if (collection === 'articles' && payload.slug === '') payload = { ...payload, slug: null };
      if (Object.hasOwn(payload, 'id')) invalid('id', '資料識別碼不可變更。');
      const rows = await db(collection).whereIn('id', meta.keys).select('*');
      if (rows.length > 1 && ((collection === 'pages' && payload.path) || (collection === 'articles' && payload.slug))) invalid('id', '網址不可批次設為同一值，請逐筆修改。');
      if (collection === 'homepage_blocks' && rows.length > 1 && payload.anchor) invalid('anchor', '首頁區塊錨點不可批次設為同一值。');
      if (collection === 'redirects') {
        try { compileRedirects((await db('redirects').select('*')).map(row => meta.keys.includes(row.id) ? { ...row, ...payload } : row)); }
        catch { invalid('new_path', '此批次修改會造成重複或循環轉址。'); }
      }
      for (const previous of rows) {
        const row = decodeRow({ ...previous, ...payload });
        validateContent(collection, row);
        await validateReferences(db, collection, row, previous);
      }
      if (collection === 'navigation' && payload.status && payload.status !== 'published' && rows.some(r => r.status === 'published') && !await db('navigation').where({ status: 'published' }).whereNotIn('id', meta.keys).first()) invalid('status', '至少保留一個已發布導覽項目，請先新增替代項目。');
      return payload;
    });
    filter(`${collection}.items.delete`, async (keys, _meta, context) => {
      const db = context?.database || database;
      const rows = await db(collection).whereIn('id', keys).select('*');
      await assertUnreferenced(db, collection, rows);
      if (collection === 'navigation' && rows.some(r => r.status === 'published') && !await db('navigation').where({ status: 'published' }).whereNotIn('id', keys).first()) invalid('id', '至少保留一個已發布導覽項目。');
      return keys;
    });
  }
  filter('files.delete', async (keys, _meta, context) => {
    await assertUnreferenced(context?.database || database, 'directus_files', keys.map(id => ({ id })));
    return keys;
  });
  filter('files.update', async (payload, meta, context) => {
    if (Object.hasOwn(payload, 'type')) {
      const db = context?.database || database;
      const files = await db('directus_files').whereIn('id', meta.keys).select('*');
      await assertUnreferenced(db, 'directus_files', files.filter(file => file.type !== payload.type));
    }
    return payload;
  });
}
