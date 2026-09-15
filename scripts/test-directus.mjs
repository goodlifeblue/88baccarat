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
const article = {
  id: 'a', slug: 'cms-test', category: 'guide', status: 'published', title: 'CMS H1',
  excerpt: 'CMS description', seo_title: 'Custom SEO title', seo_description: 'Custom SEO description',
  canonical: 'https://untrusted.example/override', noindex: true,
  published_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', author: 'Marketing',
  content: '# Extra heading\n\n## Section two\n\n### Section three\n\n![Example alt](/images/xx.png)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(123)</script>',
  faq: [{ question: 'Question?', answer: 'Answer </script><script>alert(456)</script>' }],
  related: [{ related_id: 'b' }, { related_id: 'draft' }],
};
const second = { ...article, id: 'b', slug: 'related-test', category: 'tips', faq: [], related: [] };
const draft = { ...article, id: 'draft', slug: 'draft-secret', status: 'draft' };
const review = { ...article, id: 'review', slug: 'review-secret', status: 'review' };
let fail = false;
const requests = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  requests.push(url);
  assert.equal(req.headers.authorization, 'Bearer test-build-token');
  res.setHeader('Content-Type', 'application/json');
  if (fail) { res.writeHead(503); res.end('{}'); return; }
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
  const html = await readFile(join(dir, 'guide/cms-test/index.html'), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const pattern of [/<h2[^>]*>Section two/, /<h3[^>]*>Section three/, /<table>/, /alt="Example alt"/, /<title>Custom SEO title<\/title>/, /content="Custom SEO description"/, /href="\/tips\/related-test\/"/, /2026-02-01T00:00:00.000Z/]) assert.match(html, pattern);
  assert.ok(!html.includes('<script>alert('));
  assert.ok(!html.includes('/guide/draft-secret/'));
  assert.ok(!html.includes('/guide/review-secret/'));
  assert.match(html, /name="robots" content="noindex, follow"/);
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
