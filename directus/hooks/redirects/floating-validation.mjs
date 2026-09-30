export function validateFloatingButtons(value) {
  const fail = (message) => {
    const error = new Error(message);
    // Directus recognizes this public error shape and returns it to Data Studio.
    error.name = 'DirectusError';
    error.code = 'INVALID_PAYLOAD';
    error.status = 400;
    error.extensions = { field: 'floating_buttons', reason: message };
    throw error;
  };
  if (value == null) return;
  if (!Array.isArray(value)) fail('浮動功能按鈕必須是清單。');
  for (const [index, button] of value.entries()) {
    const prefix = `第 ${index + 1} 個浮動按鈕：`;
    if (!button || typeof button !== 'object' || Array.isArray(button)) fail(prefix + '設定格式不正確。');
    if (button.enabled !== true) continue;
    if (typeof button.label !== 'string' || !button.label.trim()) fail(prefix + '啟用前請填寫按鈕名稱。');
    if (!['line', 'telegram', 'link'].includes(button.icon)) fail(prefix + '請選擇 LINE、Telegram 或一般連結圖示。');
    const href = button.href;
    if (typeof href !== 'string' || !href.trim()) fail(prefix + '啟用前請填寫連結網址；尚未準備好時請關閉此按鈕的「啟用」。');
    let valid = !/[\s\\\u0000-\u001f\u007f]/u.test(href);
    if (!(href.startsWith('/') && !href.startsWith('//'))) {
      try {
        const url = new URL(href);
        valid &&= url.protocol === 'https:' && !url.username && !url.password;
      } catch { valid = false; }
    }
    if (!valid) fail(prefix + '網址須使用完整 HTTPS（例如 https://line.me/ti/p/帳號）或站內路徑（例如 /guide/），不可含空白。');
  }
}

export function registerFloatingValidation(filter, database) {
  filter('site_settings.items.create', payload => {
    validateFloatingButtons(payload.floating_buttons);
    return payload;
  });
  filter('site_settings.items.update', async (payload, meta, context) => {
    if (Object.hasOwn(payload, 'floating_buttons')) validateFloatingButtons(payload.floating_buttons);
    else if (payload.floating_enabled === true) {
      const db = context?.database || database;
      const rows = await db('site_settings').whereIn('id', meta.keys).select('floating_buttons');
      for (const row of rows) validateFloatingButtons(typeof row.floating_buttons === 'string' ? JSON.parse(row.floating_buttons) : row.floating_buttons);
    }
    return payload;
  });
}
