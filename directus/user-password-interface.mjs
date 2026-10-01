// Directus stores `directus_users.password` as a one-way hash. System-field
// metadata is intentionally not writable through the REST Fields API, so the
// deployment migration applies this record directly to `directus_fields`.
export const passwordPreviewField = {
  collection: 'directus_users',
  field: 'password',
  special: 'hash,conceal',
  interface: 'password-preview',
  options: {},
  readonly: false,
  hidden: false,
  sort: 4,
  width: 'half',
  note: '輸入新密碼時可按「顯示」確認本次輸入。已儲存的密碼為不可逆雜湊，無法預覽。',
  required: false,
  searchable: true,
};
