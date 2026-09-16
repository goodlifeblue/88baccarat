import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { XMLValidator, XMLParser } from "fast-xml-parser";
import { readPages, attr, text, robotsOf, elements } from "./html-pages.mjs";
import { readEnvironment, publicUrl } from "./environment.mjs";
import { compileRedirects } from "../directus/hooks/redirects/rules.mjs";

const key = (path) => decodeURI(path).replace(/\/$/, "") || "/";
const loadJSON = async (path) => JSON.parse(await readFile(path, "utf8"));
export async function checkSite({ directory, env, policy, baseline }) {
  const errors = [],
    warnings = [];
  const fail = (message) => errors.push(message);
  const production = env.APP_ENV === "production";
  const base = new URL(env.SITE_URL);
  const pages = await readPages(directory);
  const routes = new Map(pages.map((page) => [key(page.route), page]));
  if (!pages.length) fail("No HTML pages generated");
  if (!routes.has("/404.html")) fail("Missing 404 page");
  const allowed = new Set(policy.allowedNoindexPaths.map(key));
  let redirects = [];
  try {
    const content = await readFile(join(directory, "_redirects"), "utf8");
    const rows = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const columns = line.trim().split(/\s+/);
        if (columns.length !== 3) throw new Error("Malformed _redirects line");
        return {
          old_path: columns[0],
          new_path: columns[1],
          status_code: Number(columns[2]),
          enabled: true,
        };
      });
    redirects = compileRedirects(rows);
  } catch (error) {
    if (error.code !== "ENOENT" || env.CONTENT_SOURCE === "directus")
      fail(`Redirects: ${error.message}`);
  }
  const redirectMap = new Map(
    redirects.map((row) => [key(row.old_path), key(row.new_path)]),
  );
  for (const row of redirects) {
    if (routes.has(key(row.old_path)))
      fail(`Redirect replaces an existing page: ${row.old_path}`);
    if (!routes.has(key(row.new_path)) || key(row.new_path) === "/404.html")
      fail(`Redirect target is missing: ${row.new_path}`);
  }
  async function resourceExists(path) {
    const decoded = decodeURIComponent(path);
    const file = resolve(directory, "." + decoded);
    if (!file.startsWith(resolve(directory) + "/")) return false;
    try {
      return (await stat(file)).isFile();
    } catch {
      return false;
    }
  }
  const canonicals = new Set();
  for (const page of pages) {
    const prefix = page.route;
    const nodes = page.nodes;
    const titles = nodes.filter((n) => n.tagName === "title");
    const descriptions = nodes.filter(
      (n) => n.tagName === "meta" && attr(n, "name") === "description",
    );
    const canonical = nodes.filter(
      (n) =>
        n.tagName === "link" &&
        attr(n, "rel")?.split(/\s+/).includes("canonical"),
    );
    const h1 = nodes.filter((n) => n.tagName === "h1");
    if (titles.length !== 1 || !text(titles[0]).trim())
      fail(`${prefix}: missing/duplicate/empty title`);
    if (descriptions.length !== 1 || !attr(descriptions[0], "content")?.trim())
      fail(`${prefix}: missing/duplicate/empty description`);
    if (h1.length !== 1 || !text(h1[0]).trim())
      fail(`${prefix}: expected one non-empty H1`);
    const expected = new URL(page.route, base).href;
    if (canonical.length !== 1 || attr(canonical[0], "href") !== expected)
      fail(`${prefix}: canonical must equal ${expected}`);
    if (canonical.length === 1) {
      const value = attr(canonical[0], "href");
      if (canonicals.has(value)) fail(`${prefix}: duplicate canonical`);
      canonicals.add(value);
    }
    const robots = robotsOf(page);
    if (
      production &&
      !allowed.has(key(page.route)) &&
      /noindex|nofollow|none/i.test(robots)
    )
      fail(`${prefix}: production page blocks indexing`);
    if (!production && !/noindex/i.test(robots))
      fail(`${prefix}: non-production page must be noindex`);
    const schemas = [];
    for (const node of nodes.filter(
      (n) =>
        n.tagName === "script" && attr(n, "type") === "application/ld+json",
    )) {
      try {
        const schema = JSON.parse(text(node));
        if (schema["@context"] !== "https://schema.org" || !schema["@type"])
          fail(`${prefix}: incomplete JSON-LD context/type`);
        schemas.push(schema);
      } catch {
        fail(`${prefix}: invalid JSON-LD`);
      }
    }
    if (!schemas.some((schema) => schema["@type"] === "WebSite"))
      fail(`${prefix}: missing WebSite schema`);
    const isArticle =
      /^\/(baccarat|strategy|guide|tips|comparison)\/[^/]+\/$/.test(page.route);
    const article = schemas.find((schema) => schema["@type"] === "Article");
    if (
      isArticle &&
      (!article ||
        article.mainEntityOfPage !== expected ||
        !article.headline ||
        !article.author?.name ||
        !article.image ||
        !Number.isFinite(Date.parse(article.datePublished)) ||
        !Number.isFinite(Date.parse(article.dateModified)))
    )
      fail(`${prefix}: incomplete Article schema`);
    const faqSection = nodes.find(
      (n) =>
        n.tagName === "section" && attr(n, "aria-labelledby") === "faq-title",
    );
    const visibleFAQ = faqSection
      ? elements(faqSection)
          .filter((n) => n.tagName === "details")
          .map((detail) => {
            const children = elements(detail);
            return {
              question: text(
                children.find((n) => n.tagName === "summary") || {},
              ),
              answer: text(children.find((n) => n.tagName === "p") || {}),
            };
          })
      : [];
    const faq = schemas.find((schema) => schema["@type"] === "FAQPage");
    if (isArticle && (visibleFAQ.length || faq)) {
      const actual = Array.isArray(faq?.mainEntity)
        ? faq.mainEntity.map((q) => ({
            question: q.name,
            answer: q.acceptedAnswer?.text,
          }))
        : [];
      if (
        !visibleFAQ.length ||
        JSON.stringify(actual) !== JSON.stringify(visibleFAQ)
      )
        fail(`${prefix}: FAQ schema differs from visible content`);
    }
    for (const node of nodes) {
      if (node.tagName === "a") {
        const href = attr(node, "href");
        if (!href || /^(mailto:|tel:)/i.test(href)) continue;
        let url;
        try {
          url = new URL(href, expected);
        } catch {
          fail(`${prefix}: invalid link ${href}`);
          continue;
        }
        if (!["http:", "https:"].includes(url.protocol)) {
          fail(`${prefix}: unsupported link protocol`);
          continue;
        }
        if (url.origin === base.origin) {
          const target =
            routes.get(key(url.pathname)) ||
            routes.get(redirectMap.get(key(url.pathname)));
          if (!target && !(await resourceExists(url.pathname)))
            fail(`${prefix}: broken internal link ${href}`);
          if (
            target &&
            url.hash &&
            !target.nodes.some(
              (n) => attr(n, "id") === decodeURIComponent(url.hash.slice(1)),
            )
          )
            fail(`${prefix}: missing anchor ${href}`);
        } else if (production) {
          try {
            publicUrl(url.origin);
          } catch {
            fail(`${prefix}: link points to local/placeholder host`);
          }
        }
      }
      const imageValues = [];
      if (node.tagName === "img") {
        if (attr(node, "alt") === undefined)
          fail(`${prefix}: image missing alt attribute`);
        imageValues.push(attr(node, "src"));
      }
      if (
        node.tagName === "meta" &&
        ["og:image", "twitter:image"].includes(
          attr(node, "property") || attr(node, "name"),
        )
      )
        imageValues.push(attr(node, "content"));
      for (const value of imageValues) {
        if (!value) {
          fail(`${prefix}: empty image URL`);
          continue;
        }
        let url;
        try {
          url = new URL(value, expected);
        } catch {
          fail(`${prefix}: invalid image URL`);
          continue;
        }
        if (url.searchParams.has("access_token"))
          fail(`${prefix}: image URL contains token`);
        if (url.origin === base.origin) {
          if (!(await resourceExists(url.pathname)))
            fail(`${prefix}: missing image ${url.pathname}`);
        } else if (production) {
          try {
            publicUrl(url.origin);
          } catch {
            fail(`${prefix}: image must use public HTTPS`);
          }
          const origins = [
            new URL(env.DIRECTUS_URL).origin,
            ...policy.externalImageOrigins,
          ];
          if (!origins.includes(url.origin))
            fail(`${prefix}: unapproved image origin ${url.origin}`);
        }
      }
    }
  }
  try {
    const robots = await readFile(join(directory, "robots.txt"), "utf8");
    if (
      production &&
      (/Disallow:\s*\/\s*$/im.test(robots) ||
        /noindex/i.test(robots) ||
        !robots.includes(
          `Sitemap: ${env.SITE_URL.replace(/\/$/, "")}/sitemap-index.xml`,
        ))
    )
      fail("Production robots.txt blocks crawling or has incorrect sitemap");
    if (!production && !/Disallow:\s*\/\s*$/im.test(robots))
      fail("Non-production robots.txt must disallow crawling");
    const headers = await readFile(join(directory, "_headers"), "utf8").catch(
      () => "",
    );
    if (production && /X-Robots-Tag:.*(?:noindex|none)/i.test(headers))
      fail("Production headers contain noindex");
    if (!production && !/X-Robots-Tag:.*noindex/i.test(headers))
      fail("Non-production headers must contain noindex");
    const parser = new XMLParser();
    const indexXML = await readFile(
      join(directory, "sitemap-index.xml"),
      "utf8",
    );
    const pageXML = await readFile(join(directory, "sitemap-0.xml"), "utf8");
    if (
      XMLValidator.validate(indexXML) !== true ||
      XMLValidator.validate(pageXML) !== true
    )
      throw new Error("Malformed XML");
    const index = parser.parse(indexXML);
    const map = parser.parse(pageXML);
    if (
      index.sitemapindex?.sitemap?.loc !== new URL("/sitemap-0.xml", base).href
    )
      fail("Incorrect sitemap index");
    const entries = map.urlset?.url ? [map.urlset.url].flat() : [];
    const actual = entries.map((entry) => entry.loc).sort();
    const expected = pages
      .filter(
        (p) =>
          p.route !== "/404.html" &&
          (!production || !robotsOf(p).includes("noindex")),
      )
      .map((p) => new URL(p.route, base).href)
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      fail("Sitemap URLs differ from generated indexable pages");
  } catch (error) {
    fail(`Sitemap/robots: ${error.message}`);
  }
  for (const path of baseline.routes) {
    if (!routes.has(key(path)) && !routes.has(redirectMap.get(key(path))))
      fail(`Existing URL removed without a valid 301: ${path}`);
  }
  if (
    production &&
    (!baseline.approved || baseline.siteUrl !== env.SITE_URL.replace(/\/$/, ""))
  )
    fail("Production URL baseline must be reviewed and approved for this site");
  try {
    const manifest = await loadJSON(join(directory, "release-manifest.json"));
    if (
      manifest.environment !== env.APP_ENV ||
      manifest.siteUrl !== env.SITE_URL.replace(/\/$/, "")
    )
      fail("Build manifest environment mismatch");
    for (const page of pages)
      if (
        manifest.hashes[page.route] !==
        createHash("sha256").update(page.html).digest("hex")
      )
        fail(`HTML changed since build: ${page.route}`);
  } catch (error) {
    fail(`Missing/invalid release manifest: ${error.message}`);
  }
  warnings.push(
    "External image/link availability is not probed; URL origins and local files are checked.",
  );
  return {
    passed: !errors.length,
    environment: env.APP_ENV,
    pageCount: pages.length,
    redirectCount: redirects.length,
    errors,
    warnings,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const report = await checkSite({
      directory: resolve("dist"),
      env: readEnvironment(),
      policy: await loadJSON("config/seo-policy.json"),
      baseline: await loadJSON("config/url-baseline.json"),
    });
    await mkdir(".artifacts", { recursive: true });
    await writeFile(
      ".artifacts/seo-report.json",
      JSON.stringify(report, null, 2),
    );
    console.log(
      `SEO ${report.passed ? "PASS" : "FAIL"}: ${report.pageCount} pages, ${report.redirectCount} redirects`,
    );
    for (const error of report.errors) console.error(`- ${error}`);
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
