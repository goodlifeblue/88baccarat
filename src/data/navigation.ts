import { readEnvironment } from '../../scripts/environment.mjs';
import { loadNavigation } from '../lib/navigation.mjs';
import seed from '../../directus/navigation-seed.json';

let buildNavigation: ReturnType<typeof loadNavigation> | undefined;

// Local Markdown mode is an explicit offline fixture, never a CMS error fallback.
export async function getNavigation() {
  const env = readEnvironment();
  if (env.CONTENT_SOURCE !== 'directus') {
    return { brand: seed.brand, items: seed.items.map(item => ({ ...item, open_in_new_tab: false })) };
  }
  // One snapshot per static build; dev requests fetch again so a refresh sees CMS edits.
  if (import.meta.env.PROD) return buildNavigation ??= loadNavigation(env);
  return loadNavigation(env);
}
