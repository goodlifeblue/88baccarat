import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePages, pagePath } from '../src/lib/site-content.mjs';
import { renderPageMarkdown } from '../src/lib/page-markdown.mjs';
import cmsDevPages from './cms-dev-pages.mjs';

const base = { path: '/', status: 'published', title: 'Home', description: 'Home description', page_type: 'single_page', faq: [], sections: [] };
test('CMS dynamic routes are live only in dev; deployment builds remain static', () => {
  for (const command of ['dev', 'build']) {
    const integration = cmsDevPages();
    integration.hooks['astro:config:setup']({ command });
    const route = { component: 'src/pages/[...page].astro', prerender: true };
    integration.hooks['astro:route:setup']({ route });
    assert.equal(route.prerender, command !== 'dev');
    const article = { component: 'src/pages/guide/[slug].astro', prerender: true };
    integration.hooks['astro:route:setup']({ route: article });
    assert.equal(article.prerender, true);
  }
});
test('managed pages reject reserved, duplicate and malformed paths', () => {
  for (const path of ['//evil.test/', '/guide/my-page/', '/404/', '/assets/file/', '/hello', '/a/../b/', '/a%2fb/', '/a/?b=1']) assert.throws(() => pagePath(path));
  assert.equal(pagePath('/campaign/example/'), '/campaign/example/');
  assert.throws(() => validatePages([base, base]), /Duplicate/);
  assert.equal(validatePages([{...base, status: 'draft'}, {...base, status: 'review'}]).length, 0);
});
test('page types, template and section data fail closed', () => {
  assert.throws(() => validatePages([{...base, page_type: 'unknown'}]), /unknown page type/);
  assert.throws(() => validatePages([{...base, page_type: 'article_list', article_category: 'unknown'}]), /invalid article category/);
  assert.throws(() => validatePages([{...base, page_type: 'custom_page', custom_template: 'script'}]), /unknown template/);
  assert.throws(() => validatePages([{...base, sections: [{type:'markdown', link_href:'javascript:alert(1)'}]}]));
  assert.throws(() => validatePages([{...base, sections: [{type:'articles', limit:-1}]}]), /limit/);
  assert.throws(() => validatePages([{...base, sections: [{type:'markdown', anchor:'same'}, {type:'markdown', anchor:'same'}]}]), /anchor/);
  assert.throws(() => validatePages([{...base, faq:[{question:'?',answer:''}]}]), /FAQ/);
  for (const page_type of ['single_page','article_list','custom_page']) assert.equal(validatePages([{...base, page_type, article_category:'all', custom_template:'standard'}]).length, 1);
});
test('managed page Markdown preserves safe structure without executing HTML', async () => {
  const html = await renderPageMarkdown('# Extra H1\n\n## Heading\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1))');
  assert.ok(!html.includes('<h1'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('<h2'));
});
