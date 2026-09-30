import 'dotenv/config';
import { assertLocalMaintenance } from '../scripts/environment.mjs';
assertLocalMaintenance();
const base = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const token = process.env.DIRECTUS_ADMIN_TOKEN;
if (!base || !token) throw new Error('Set DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN');
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Hero migration: ${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
const pages = await api('/items/pages?filter[custom_template][_eq]=home&limit=-1');
for (const page of pages) {
  if (Array.isArray(page.sections) && page.sections.some(section => section.enabled == null)) {
    await api(`/items/pages/${page.id}`, 'PATCH', { sections: page.sections.map(section => ({ ...section, enabled: section.enabled ?? true })) });
  }
  const existing = await api(`/items/hero_slides?filter[page][_eq]=${page.id}&limit=1`);
  if (existing.length || (!page.hero_video && !page.hero_image)) { console.log(`Preserved ${page.path}`); continue; }
  await api('/items/hero_slides', 'POST', {
    page: page.id, sort: 1, enabled: true, media_type: page.hero_video ? 'video' : 'image',
    video: page.hero_video || null, image: page.hero_image || null, poster: page.hero_image || null,
    title: page.title, badge: page.hero_badge, description: page.hero_description,
    button_label: page.hero_button_label, button_href: page.hero_button_href,
  });
  console.log(`Migrated existing Hero into first slide: ${page.path}`);
}
