import seed from '../../directus/seeds/site-settings.json';
import { readEnvironment } from '../../scripts/environment.mjs';
import { fetchCMS, asset } from '../lib/site-content.mjs';
import { navigationHref } from '../lib/navigation.mjs';

type Site = typeof seed & { url: string; labels: Record<string, string> };
let cached: Promise<Site> | undefined;
async function load(): Promise<Site> {
  const env = readEnvironment();
  const data: typeof seed = env.CONTENT_SOURCE === 'directus' ? await fetchCMS('site_settings') : structuredClone(seed);
  if (!data?.name || !data.description || !data.organization || !Array.isArray(data.categories) || !Array.isArray(data.footer_groups)) throw new Error('Complete Directus site settings before building');
  for (const key of ['og_image', 'favicon', 'inner_banner', 'default_cover'] as const) {
    if (!data[key]) throw new Error(`Missing site asset: ${key}`);
    data[key] = asset(data[key])!;
  }
  data.categories = data.categories.map(category => ({ ...category, href: navigationHref(category.href), icon: asset(category.icon)! }));
  for (const group of data.footer_groups) for (const link of group.links) navigationHref(link.href);
  navigationHref(data.cta_href);
  return { ...data, url: env.SITE_URL!, labels: Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith('ui_')).map(([key, value]) => [key.slice(3), String(value)])) };
}
export function getSite() {
  return import.meta.env.PROD ? cached ??= load() : load();
}
