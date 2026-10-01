export const collectionGuidance = {
  homepage_blocks: '拖曳調整首頁區塊順序，數字較小排前面。手動文章區塊須選入已發布文章才會顯示；未選文章、只有草稿或未啟用的區塊，即使排第一也不會出現在前台。',
  homepage_block_articles: '區塊內拖曳排序；移除項目只取消選取，不刪除文章。',
  articles: '新增文章預設為「暫存文章（草稿）」；未填完也可按右上角儲存，稍後從文章清單開啟繼續編輯。暫存不會顯示在前台；發布前須補齊必要資料。已發布文章請使用內容版本編輯，勿改成草稿以免下架。',
  pages: '發布前檢查頁面類型、摘要、區塊及輪播。首頁不可下架；已發布頁面須先處理引用才可下架或改網址。',
  navigation: '連結頁面須先發布；自訂網址使用 HTTPS 或站內路徑。至少保留一個已發布導覽。',
  navbar_settings: '品牌名称及首頁連結不可留白；修改會影響全站。',
  site_settings: '全站共用內容。必要文字與圖片不可清空；清單需完整填寫；未完成的浮動按鈕請先關閉啟用。',
  hero_slides: '啟用前選擇正確圖片或影片。按鈕文字與網址需成對填寫；未完成的輪播請先停用。',
  redirects: '僅支援站內 301 轉址。來源不可仍是已發布頁面，不可重複、指向自己或形成循環。',
  article_relations: '選擇已儲存的文章，不可關聯自己。',
};
const guidance = {
  status: '草稿可逐步編輯；發布時檢查必要資料。被使用的頁面須先處理引用才能下架。',
  slug: '使用中英文字、數字、- 或 _，不可含空白或 /；同分類不得重複。已發布文章改網址會自動轉址。',
  path: '例：/guide/。須以 / 開頭及結尾，不可重複或使用系統保留路徑；已發布頁面不可直接改網址。',
  published_at: '發布前必填有效日期。此欄是文章顯示日期，不是排程發布開關。',
  description: '頁面發布前須有摘要；全站摘要不可留白。',
  page_type: '文章列表須選分類；自訂頁面須選既有模板。',
  article_category: '文章列表發布前須選擇有效分類或 all。',
  custom_template: '自訂頁面發布前選擇 home、faq 或 standard。',
  faq: '每組問答都需填寫問題與答案。未完成請留在草稿，或關閉頁面的 FAQ 區塊。',
  sections: '啟用區塊需選類型；錨點不可重複；文章數量為 1～100；按鈕文字與網址要成對填寫。',
  carousel_slides: '每張圖片都要填替代文字、大標與說明。啟用前至少新增兩張，且必須從「網站公開素材」選圖片；按鈕文字與網址需成對填寫。',
  carousel_interval: '請填 2000～30000 毫秒；例如 5000 代表每 5 秒切換。使用者可在前台隨時暫停或播放。',
  hero_interval: '輪播間隔為 2000～30000 毫秒（2～30 秒），不可填 0 或小數。',
  hero_slides: '新增前先儲存頁面；圖片輪播選圖片，影片輪播選影片；未完成時先停用該張輪播。',
  media_type: '啟用前，圖片模式必須選圖片，影片模式必須選影片。',
  page: '選擇既有頁面；導覽要發布時，連結的頁面也必須已發布。',
  link_type: 'Directus 頁面：選擇頁面；自訂網址：填寫 HTTPS 或站內路徑。',
  old_path: '原站內路徑，不可含參數、錨點或萬用字元；不可與已發布內容衝突。',
  new_path: '目的站內路徑，不可指回自己或形成循環；刪除目的內容前須先調整轉址。',
  status_code: '固定使用 301 永久轉址。',
  footer_groups: '群組需填標題，每個連結需填文字及有效網址；不使用的項目請移除。',
  categories: '分類代碼不可重複；名稱、網址及圖示需填妥。',
  floating_buttons: '啟用前填寫名稱、圖示與有效網址；尚未完成請關閉該按鈕的啟用。',
};
export function guardedMeta(field) {
  const { collection, field: name, type } = field;
  if (!collectionGuidance[collection]) return null;
  const meta = field.meta || {};
  const audit = ['id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'canonical'].includes(name);
  let hint = guidance[name];
  if (collection === 'homepage_blocks' && name === 'sort') hint = '排序儲存後，本機前台重新整理即可更新。手動文章區塊若未選入已發布文章，整個區塊會隱藏，調整排序也不會顯示。正式站須重新建置發布。';
  if (collection === 'articles' && ['title', 'slug', 'content', 'excerpt', 'category'].includes(name)) hint = '暫存可留白，發布前必填。' + (name === 'slug' ? '使用中英文字、數字、- 或 _；留白網址儲存後須由管理員補填，沿用現有網址編輯權限。' : name === 'content' ? '按「插入圖片」可從檔案庫選取或直接上傳，系統會自動插入圖片 Markdown；請填寫替代文字。未完成時請保持「暫存文章（草稿）」並按右上角儲存。' : '未完成時請保持「暫存文章（草稿）」並按右上角儲存。');
  if (collection === 'articles' && name === 'status') hint = '選「暫存文章（草稿）」後按右上角儲存即可保存未完成文章；不會顯示在前台。行銷可送審，發布仍由審核者操作。';
  if (audit) hint = '由系統自動維護，請勿手動修改。';
  if (!hint && (name.endsWith('_href') || name === 'href')) hint = '使用完整 HTTPS 網址或以 / 開頭的站內路徑，不可含空白；按鈕請同時填寫文字與網址。';
  if (!hint && (meta.special?.includes('file') || /^(cover_image|og_image|favicon|inner_banner|default_cover|hero_image|hero_video|poster|image|video)$/.test(name))) hint = '圖片每張上限 5 MB，超過請先壓縮；影片不適用此圖片限制。請選正確媒體類型；正在使用的檔案不可刪除，請先更換內容中的引用。';
  if (!hint) hint = type === 'boolean' ? '開啟後才會顯示或生效，啟用前請確認相關內容已填妥。' : meta.required ? '必要欄位，請勿留白。儲存時若有錯誤會指出需修改的欄位。' : '儲存前請確認內容。錯誤格式會被阻擋；發布前請先預覽前台。';
  const original = (meta.note || '').split('\n【防呆提醒】')[0];
  return { note: `${original}${original ? '\n' : ''}【防呆提醒】${hint}`, ...(audit ? { readonly: true } : {}) };
}
export async function configureContentGuards(api, schema) {
  for (const collection of schema.collections) if (collectionGuidance[collection.collection]) {
    await api(`/collections/${collection.collection}`, 'PATCH', { meta: { note: collectionGuidance[collection.collection] } });
  }
  for (const field of schema.fields) {
    const meta = guardedMeta(field);
    if (meta) await api(`/fields/${field.collection}/${field.field}`, 'PATCH', { meta });
  }
}
