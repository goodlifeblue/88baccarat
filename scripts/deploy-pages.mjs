import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readEnvironment } from "./environment.mjs";
import { checkSite } from "./seo-check.mjs";
const env = readEnvironment();
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  !["staging", "production"].includes(env.APP_ENV)
)
  throw new Error("Deployment is CI-only");
const branch = env.APP_ENV === "production" ? "main" : "develop";
if (process.env.GITHUB_REF !== `refs/heads/${branch}`)
  throw new Error("Deployment branch mismatch");
const load = async (path) => JSON.parse(await readFile(path, "utf8"));
const report = await checkSite({
  directory: "dist",
  env,
  policy: await load("config/seo-policy.json"),
  baseline: await load("config/url-baseline.json"),
});
if (!report.passed) throw new Error(report.errors.join("\n"));
const manifest = await load("dist/release-manifest.json");
if (!process.env.GITHUB_SHA || manifest.commit !== process.env.GITHUB_SHA)
  throw new Error("Artifact commit mismatch");
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
  throw new Error("Missing CI deployment credentials");
const target = (await load("config/deployment.json"))[env.APP_ENV];
const result = spawnSync(
  "npx",
  [
    "--yes",
    "wrangler@4.132.0",
    "pages",
    "deploy",
    "dist",
    "--project-name",
    target.pagesProject,
    "--branch",
    branch,
    "--commit-hash",
    process.env.GITHUB_SHA,
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
