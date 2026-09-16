/** Permit root-relative website links and credential-free HTTPS links only. */
export function navigationHref(value) {
  if (typeof value !== 'string' || !value || /[\s\\\u0000-\u001f\u007f]/u.test(value))
    throw new Error('Navigation: invalid link');
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Navigation: links must use a site-relative path or HTTPS');
  return value;
}

function label(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Navigation: missing label');
  return value.trim();
}

/** @param {Record<string, string | undefined>} env */
export async function loadNavigation(env) {
  const base = env.DIRECTUS_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Navigation: DIRECTUS_URL is required');
  async function api(collection, params) {
    const response = await fetch(`${base}/items/${collection}?${new URLSearchParams(params)}`, {
      headers: env.DIRECTUS_API_TOKEN ? { Authorization: `Bearer ${env.DIRECTUS_API_TOKEN}` } : {},
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Directus ${collection}: HTTP ${response.status}`);
    return (await response.json()).data;
  }
  const settings = await api('navbar_settings', { fields: 'brand_label,brand_symbol,brand_href' });
  if (!settings || Array.isArray(settings)) throw new Error('Navigation: missing navbar settings');
  const brand = {
    brand_label: label(settings.brand_label),
    brand_symbol: typeof settings.brand_symbol === 'string' ? settings.brand_symbol : '',
    brand_href: navigationHref(settings.brand_href),
  };
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const rows = await api('navigation', {
      fields: 'id,label,href,sort,status,open_in_new_tab,link_type,page.path,page.status',
      'filter[status][_eq]': 'published', sort: 'sort,id', limit: '100', offset: String(offset),
    });
    if (!Array.isArray(rows)) throw new Error('Navigation: invalid items response');
    for (const row of rows) {
      if (row.status !== 'published') continue;
      if (row.link_type === 'page' && (!row.page || row.page.status !== 'published')) throw new Error('Navigation: linked page is missing or unpublished');
      items.push({ label: label(row.label), href: navigationHref(row.link_type === 'page' ? row.page.path : row.href), open_in_new_tab: row.open_in_new_tab === true });
    }
    if (rows.length < 100) break;
  }
  if (!items.length) throw new Error('Navigation: publish at least one item before building');
  return { brand, items };
}
