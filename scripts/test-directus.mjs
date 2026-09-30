import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const permissions = JSON.parse(await readFile(new URL('../directus/marketing-permissions.json', import.meta.url), 'utf8'));
const update = permissions.find((rule) => rule.collection === 'articles' && rule.action === 'update');
for (const field of ['slug', 'published_at', 'updated_at', 'canonical', 'noindex', 'created_by']) assert.ok(!update.fields.includes(field));
assert.deepEqual(update.validation.status._in, ['draft', 'review']);
assert.deepEqual(update.permissions.status._in, ['draft', 'review']);
const schema = JSON.parse(await readFile(new URL('../directus/schema.json', import.meta.url), 'utf8'));
assert.deepEqual(schema.fields.find((field) => field.field === 'created_by').meta.special, ['user-created']);
assert.deepEqual(schema.fields.find((field) => field.field === 'updated_at').meta.special, ['date-updated']);
const dir = await mkdtemp(join(tmpdir(), 'baccarat-cms-'));
const siteSettings = JSON.parse(await readFile(new URL('../directus/seeds/site-settings.json', import.meta.url), 'utf8'));
siteSettings.footer_description = 'CMS footer description';
const pages = JSON.parse(await readFile(new URL('../directus/seeds/pages.json', import.meta.url), 'utf8'));
pages.push({ path: '/campaign/example/', title: 'CMS landing', description: 'CMS landing description', page_type: 'single_page', status: 'published', content: '# Extra H1\n\n## CMS landing section\n\n<script>alert(999)</script>', faq: [], sections: [] });
pages.push({ ...pages.at(-1), path: '/draft-page/', status: 'draft' });
const article = {
  id: 'a', slug: 'cms-test', category: 'guide', status: 'published', title: 'CMS H1',
  excerpt: 'CMS description', seo_title: 'Custom SEO title', seo_description: 'Custom SEO description',
  canonical: 'https://untrusted.example/override', noindex: true,
  published_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', author: 'Marketing',
  content: '# Extra heading\n\n## Section two\n\n### Section three\n\n![Example alt](/images/xx.png)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(123)</script>',
  faq: [{ question: 'Question?', answer: 'Answer </script><script>alert(456)</script>' }],
  related: [{ related_id: 'b' }, { related_id: 'draft' }],
};
article.cover_image = '12345678-1234-1234-1234-123456789abc';
article.content += '\n\n![CMS image](/assets/12345678-1234-1234-1234-123456789abc?width=800)';
const second = { ...article, id: 'b', slug: 'related-test', category: 'tips', faq: [], related: [] };
const draft = { ...article, id: 'draft', slug: 'draft-secret', status: 'draft' };
const review = { ...article, id: 'review', slug: 'review-secret', status: 'review' };
pages.find(page => page.path === '/').homepage_blocks_enabled = true;
let fail = false;
const requests = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  requests.push(url);
  assert.equal(req.headers.authorization, 'Bearer test-build-token');
  res.setHeader('Content-Type', 'application/json');
  if (fail) { res.writeHead(503); res.end('{}'); return; }
  if (url.pathname === '/items/site_settings') { res.end(JSON.stringify({ data: siteSettings })); return; }
  if (url.pathname === '/items/homepage_blocks') {
    assert.equal(url.searchParams.get('filter[enabled][_eq]'), 'true');
    res.end(JSON.stringify({ data: [
      { id: 'selected', title: 'CMS selected articles', type: 'articles', article_source: 'manual', enabled: true, sort: 1, articles: [
        { id: 'one', sort: 2, article_id: article }, { id: 'two', sort: 1, article_id: second }, { id: 'draft', sort: 0, article_id: draft },
      ] },
      { id: 'hidden', title: 'Hidden homepage block', type: 'articles', article_source: 'manual', enabled: false, articles: [] },
    ] })); return;
  }
  if (url.pathname === '/items/pages') {
    assert.equal(url.searchParams.get('filter[status][_eq]'), 'published');
    res.end(JSON.stringify({ data: pages })); return;
  }
  if (url.pathname === '/items/navbar_settings') { res.end(JSON.stringify({ data: { brand_label: 'CMS Brand', brand_symbol: '♠', brand_href: '/' } })); return; }
  if (url.pathname === '/items/navigation') {
    assert.equal(url.searchParams.get('filter[status][_eq]'), 'published');
    assert.equal(url.searchParams.get('sort'), 'sort,id');
    res.end(JSON.stringify({ data: [
      { id: 'nav1', label: 'CMS Menu', href: '/old-manual-link/', link_type: 'page', page: { path: '/guide/cms-test/', status: 'published' }, status: 'published', open_in_new_tab: true },
      { id: 'nav2', label: 'Hidden draft menu', href: '/draft-menu/', status: 'draft' },
    ] })); return;
  }
  if (url.pathname === '/items/redirects') { res.end(JSON.stringify({data:[{old_path:'/old-guide/',new_path:'/guide/cms-test/',status_code:301,enabled:true}]})); return; }
  const category = url.searchParams.get('filter[category][_eq]');
  const offset = Number(url.searchParams.get('offset'));
  // Return a full first page to verify pagination; the second page contains the real article.
  const data = category === 'guide' && offset === 0
    ? Array.from({ length: 100 }, (_, i) => ({ ...article, id: `p${i}`, slug: `page-${i}`, faq: [], related: [] }))
    : [article, second, draft, review].filter((item) => item.category === category);
  res.end(JSON.stringify({ data }));
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
async function build() {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['node_modules/astro/astro.js', 'build', '--outDir', dir], {
      env: { ...process.env, SITE_URL: 'https://example.com', CONTENT_SOURCE: 'directus', DIRECTUS_URL: `http://127.0.0.1:${server.address().port}`, DIRECTUS_API_TOKEN: 'test-build-token' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout.on('data', (chunk) => output += chunk);
    proc.stderr.on('data', (chunk) => output += chunk);
    proc.on('close', (code) => resolve({ code, output }));
  });
}
try {
  const result = await build();
  assert.equal(result.code, 0, result.output);
  const homepage = await readFile(join(dir, 'index.html'), 'utf8');
  assert.match(homepage, /CMS selected articles/);
  const selectedHTML = homepage.slice(homepage.indexOf('data-homepage-block="selected"'));
  assert.ok(selectedHTML.indexOf('/tips/related-test/') < selectedHTML.indexOf('/guide/cms-test/'));
  assert.ok(!homepage.includes('Hidden homepage block'));
  assert.ok(!homepage.includes('draft-secret'));
  assert.match(await readFile(join(dir, '_redirects'), 'utf8'), /\/old-guide\/ \/guide\/cms-test\/ 301/);
  const html = await readFile(join(dir, 'guide/cms-test/index.html'), 'utf8');
  assert.ok(html.includes('CMS Brand'));
  assert.ok(html.includes('CMS Menu'));
  assert.ok(html.includes('CMS footer description'));
  assert.ok(!html.includes('/old-manual-link/'));
  assert.ok(!html.includes('Hidden draft menu'));
  assert.match(html, /href="\/guide\/cms-test\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  const landing = await readFile(join(dir, 'campaign/example/index.html'), 'utf8');
  assert.equal((landing.match(/<h1\b/g) || []).length, 1);
  assert.match(landing, /CMS landing section/);
  assert.ok(!landing.includes('<script>alert(999)'));
  await assert.rejects(readFile(join(dir, 'draft-page/index.html'), 'utf8'));
  assert.ok(html.includes(`http://127.0.0.1:${server.address().port}/assets/${article.cover_image}?width=800`));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const pattern of [/<h2[^>]*>Section two/, /<h3[^>]*>Section three/, /<table>/, /alt="Example alt"/, /<title>Custom SEO title<\/title>/, /content="Custom SEO description"/, /href="\/tips\/related-test\/"/, /2026-02-01T00:00:00.000Z/]) assert.match(html, pattern);
  assert.ok(!html.includes('<script>alert('));
  assert.ok(!html.includes('/guide/draft-secret/'));
  assert.ok(!html.includes('/guide/review-secret/'));
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.ok(!html.includes('untrusted.example'));
  assert.match(html, /rel="canonical" href="https:\/\/example.com\/guide\/cms-test\/"/);
  const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
  assert.equal(schemas.find((item) => item['@type'] === 'Article').headline, article.title);
  assert.equal(schemas.find((item) => item['@type'] === 'FAQPage').mainEntity[0].acceptedAnswer.text, article.faq[0].answer);
  const relatedHTML = await readFile(join(dir, 'tips/related-test/index.html'), 'utf8');
  assert.ok(!relatedHTML.includes('FAQPage'));
  assert.ok(!relatedHTML.includes('id="faq-title"'));
  const rss = await readFile(join(dir, 'rss.xml'), 'utf8');
  assert.ok(rss.includes('/guide/cms-test/'));
  assert.ok(!rss.includes('draft-secret'));
  assert.ok(requests.some((url) => url.searchParams.get('offset') === '100'));
  fail = true;
  assert.notEqual((await build()).code, 0, 'CMS outage must fail build');
  console.log('PASS: CMS rendering, pagination, draft exclusion, relations, SEO, safe JSON-LD, FAQ omission, RSS, and outage failure');
} finally {
  server.close();
  await rm(dir, { recursive: true, force: true });
}
