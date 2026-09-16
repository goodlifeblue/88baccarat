import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationHref, loadNavigation } from '../src/lib/navigation.mjs';

test('navigation rejects executable, ambiguous and credential-bearing URLs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//evil.test', '/\\evil.test', 'https://user:password@site.com', '/path\n', '', 'relative/path'])
    assert.throws(() => navigationHref(value));
  assert.equal(navigationHref('/guide/?sort=1#intro'), '/guide/?sort=1#intro');
  assert.equal(navigationHref('https://directus.io/'), 'https://directus.io/');
});

test('navigation paginates, excludes unpublished items and fails closed', async (t) => {
  let mode = 'normal';
  const offsets = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (mode === 'outage') return new Response('{}', { status: 503 });
    if (url.pathname.endsWith('navbar_settings')) return Response.json({ data: { brand_label: 'Brand', brand_symbol: '♠', brand_href: '/' } });
    assert.equal(url.searchParams.get('sort'), 'sort,id');
    assert.equal(url.searchParams.get('filter[status][_eq]'), 'published');
    const offset = Number(url.searchParams.get('offset'));
    offsets.push(offset);
    const item = { label: 'Nav', href: '/guide/', status: 'published', open_in_new_tab: true };
    if (mode === 'linked') return Response.json({ data: [{ ...item, link_type: 'page', page: { path: '/campaign/', status: 'published' } }] });
    if (mode === 'draft-page') return Response.json({ data: [{ ...item, link_type: 'page', page: { path: '/campaign/', status: 'draft' } }] });
    if (mode === 'missing-page') return Response.json({ data: [{ ...item, link_type: 'page', page: null }] });
    return Response.json({ data: mode === 'empty' ? [] : mode === 'unsafe' ? [{ ...item, href: 'javascript:alert(1)' }] : offset === 0 ? Array.from({ length: 100 }, () => item) : [item, { ...item, status: 'draft' }, { ...item, status: 'review' }, { ...item, status: 'archived' }] });
  });
  const env = { DIRECTUS_URL: 'http://localhost:8055', DIRECTUS_API_TOKEN: 'test-token' };
  const result = await loadNavigation(env);
  assert.equal(result.items.length, 101);
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(result.items[0].open_in_new_tab, true);
  mode = 'linked';
  assert.equal((await loadNavigation(env)).items[0].href, '/campaign/');
  mode = 'draft-page';
  await assert.rejects(loadNavigation(env), /unpublished/);
  mode = 'missing-page';
  await assert.rejects(loadNavigation(env), /missing/);
  mode = 'empty';
  await assert.rejects(loadNavigation(env), /publish at least one/);
  mode = 'unsafe';
  await assert.rejects(loadNavigation(env), /links must/);
  mode = 'outage';
  await assert.rejects(loadNavigation(env), /HTTP 503/);
});
