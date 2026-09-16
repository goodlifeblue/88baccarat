import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { checkSite } from "./seo-check.mjs";
import {
  readEnvironment,
  assertLocalMaintenance,
  publicUrl,
} from "./environment.mjs";

const origin = "https://seo.acme-company.com";
const env = {
  APP_ENV: "production",
  SITE_URL: origin,
  DIRECTUS_URL: "https://cms.acme-company.com",
  CONTENT_SOURCE: "directus",
};
const policy = { allowedNoindexPaths: ["/404.html"], externalImageOrigins: [] };
const baseline = {
  approved: true,
  siteUrl: origin,
  routes: ["/", "/guide/one/"],
};
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "seo-guards-"));
  await mkdir(join(dir, "guide/one"), { recursive: true });
  await writeFile(
    join(dir, "cover.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  const hashes = {};
  for (const [path, file] of [
    ["/", "index.html"],
    ["/guide/one/", "guide/one/index.html"],
    ["/404.html", "404.html"],
  ]) {
    const schemas = [
      { "@context": "https://schema.org", "@type": "WebSite", url: origin },
    ];
    if (path.includes("/guide/"))
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Article",
        mainEntityOfPage: origin + path,
        author: { name: "Editor" },
        image: origin + "/cover.svg",
        datePublished: "2026-01-01",
        dateModified: "2026-01-01",
      });
    const html = `<!doctype html><html><head><title>Test ${path}</title><meta name="description" content="A description"><link rel="canonical" href="${origin + path}">${path === "/404.html" ? '<meta name="robots" content="noindex, nofollow">' : ""}${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("")}</head><body><h1>Title</h1><a href="/guide/one/">Article</a><img src="/cover.svg" alt="Cover"></body></html>`;
    await writeFile(join(dir, file), html);
    hashes[path] = createHash("sha256").update(html).digest("hex");
  }
  await writeFile(
    join(dir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`,
  );
  await writeFile(
    join(dir, "sitemap-index.xml"),
    `<sitemapindex><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>`,
  );
  await writeFile(
    join(dir, "sitemap-0.xml"),
    `<urlset>${baseline.routes.map((p) => `<url><loc>${origin + p}</loc></url>`).join("")}</urlset>`,
  );
  await writeFile(join(dir, "_redirects"), "");
  await writeFile(
    join(dir, "release-manifest.json"),
    JSON.stringify({ environment: "production", siteUrl: origin, hashes }),
  );
  return dir;
}
const check = (directory) => checkSite({ directory, env, policy, baseline });
test("production and remote maintenance are denied on local machine", () => {
  assert.throws(
    () => readEnvironment({ APP_ENV: "production", SITE_URL: origin }),
    /deployment|Production|public/i,
  );
  assert.throws(
    () =>
      assertLocalMaintenance({ DIRECTUS_URL: "https://cms.acme-company.com" }),
    /local-only/,
  );
  assert.throws(
    () =>
      readEnvironment({
        APP_ENV: "local",
        CONTENT_SOURCE: "directus",
        DIRECTUS_URL: "https://cms.acme-company.com",
      }),
    /local-only/,
  );
  for (const url of [
    "http://seo.acme-company.com",
    "https://localhost",
    "https://example.com",
    "https://127.0.0.1",
  ])
    assert.throws(() => publicUrl(url));
});
test("valid production artifact passes", async () => {
  const dir = await fixture();
  try {
    const report = await check(dir);
    assert.deepEqual(report.errors, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
for (const [name, mutate, pattern] of [
  [
    "noindex",
    (s) =>
      s.replace("<title>", '<meta name="robots" content="noindex"><title>'),
    /blocks indexing/,
  ],
  [
    "canonical",
    (s) => s.replace(`href="${origin}/"`, 'href="http://localhost:4321/"'),
    /canonical/,
  ],
  ["missing H1", (s) => s.replace("<h1>Title</h1>", ""), /H1/],
  [
    "missing description",
    (s) => s.replace('<meta name="description" content="A description">', ""),
    /description/,
  ],
  [
    "invalid schema",
    (s) => s.replace('"@type":"WebSite"', "broken-json"),
    /JSON-LD/,
  ],
  [
    "missing image",
    (s) => s.replace('src="/cover.svg"', 'src="/missing.svg"'),
    /missing image/,
  ],
  [
    "local image",
    (s) =>
      s.replace('src="/cover.svg"', 'src="http://localhost:8055/assets/image"'),
    /public HTTPS/,
  ],
  [
    "broken link",
    (s) => s.replace('href="/guide/one/"', 'href="/removed/"'),
    /broken internal link/,
  ],
])
  test(`blocks ${name}`, async () => {
    const dir = await fixture();
    try {
      const file = join(dir, "index.html");
      await writeFile(file, mutate(await readFile(file, "utf8")));
      assert.ok((await check(dir)).errors.some((e) => pattern.test(e)));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
test("blocks old URL removal unless a valid 301 resolves to a page", async () => {
  const dir = await fixture();
  try {
    const options = {
      directory: dir,
      env,
      policy,
      baseline: { ...baseline, routes: [...baseline.routes, "/old/"] },
    };
    assert.ok(
      (await checkSite(options)).errors.some((e) =>
        e.includes("Existing URL removed"),
      ),
    );
    await writeFile(join(dir, "_redirects"), "/old/ /guide/one/ 301\n");
    assert.deepEqual((await checkSite(options)).errors, []);
    await writeFile(join(dir, "_redirects"), "/old/ /missing/ 301\n");
    assert.ok(
      (await checkSite(options)).errors.some((e) =>
        e.includes("Redirect target"),
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("blocks malformed sitemap and unapproved baseline", async () => {
  const dir = await fixture();
  try {
    await writeFile(join(dir, "sitemap-0.xml"), "<urlset>");
    const report = await checkSite({
      directory: dir,
      env,
      policy,
      baseline: { ...baseline, approved: false },
    });
    assert.ok(report.errors.some((e) => e.includes("Malformed XML")));
    assert.ok(report.errors.some((e) => e.includes("baseline")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("staging requires noindex HTML, robots, and response headers", async () => {
  const dir = await fixture();
  try {
    const options = {
      directory: dir,
      env: { ...env, APP_ENV: "staging" },
      policy,
      baseline: { ...baseline, approved: false },
    };
    assert.ok(
      (await checkSite(options)).errors.some(
        (e) => e.includes("non-production") || e.includes("Non-production"),
      ),
    );
    const hashes = {};
    for (const [path, file] of [
      ["/", "index.html"],
      ["/guide/one/", "guide/one/index.html"],
      ["/404.html", "404.html"],
    ]) {
      let html = await readFile(join(dir, file), "utf8");
      if (path !== "/404.html")
        html = html.replace(
          "<title>",
          '<meta name="robots" content="noindex, nofollow"><title>',
        );
      await writeFile(join(dir, file), html);
      hashes[path] = createHash("sha256").update(html).digest("hex");
    }
    await writeFile(join(dir, "robots.txt"), "User-agent: *\nDisallow: /\n");
    await writeFile(
      join(dir, "_headers"),
      "/*\n  X-Robots-Tag: noindex, nofollow\n",
    );
    await writeFile(
      join(dir, "release-manifest.json"),
      JSON.stringify({ environment: "staging", siteUrl: origin, hashes }),
    );
    assert.deepEqual((await checkSite(options)).errors, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
