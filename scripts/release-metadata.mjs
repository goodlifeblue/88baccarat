import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readPages, robotsOf } from "./html-pages.mjs";
export default function releaseMetadata(env) {
  return {
    name: "release-metadata",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const pages = await readPages(fileURLToPath(dir));
        const production = env.APP_ENV === "production";
        const root = env.SITE_URL.replace(/\/$/, "");
        const routes = pages
          .filter(
            (p) =>
              p.route !== "/404.html" &&
              (!production || !robotsOf(p).includes("noindex")),
          )
          .map((p) => p.route);
        const escape = (value) =>
          value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll('"', "&quot;");
        await writeFile(
          new URL("sitemap-0.xml", dir),
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((path) => `<url><loc>${escape(new URL(path, root).href)}</loc></url>`).join("")}</urlset>`,
        );
        await writeFile(
          new URL("sitemap-index.xml", dir),
          `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${escape(root)}/sitemap-0.xml</loc></sitemap></sitemapindex>`,
        );
        if (!production)
          await writeFile(
            new URL("_headers", dir),
            "/*\n  X-Robots-Tag: noindex, nofollow\n",
          );
        const hashes = Object.fromEntries(
          await Promise.all(
            pages.map(async (page) => [
              page.route,
              createHash("sha256")
                .update(await readFile(page.file))
                .digest("hex"),
            ]),
          ),
        );
        await writeFile(
          new URL("release-manifest.json", dir),
          JSON.stringify(
            {
              environment: env.APP_ENV,
              siteUrl: root,
              commit: env.GITHUB_SHA || null,
              builtAt: new Date().toISOString(),
              routes: pages.map((p) => p.route),
              hashes,
            },
            null,
            2,
          ),
        );
      },
    },
  };
}
