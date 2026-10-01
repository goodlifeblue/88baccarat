import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

export function publicUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /(^|\.)(localhost|local|test|invalid|example\.com|example\.org|example\.net)$/.test(
      url.hostname,
    ) ||
    /^[\d.:\[\]]+$/.test(url.hostname) ||
    !url.hostname.includes(".")
  )
    throw new Error(`Expected a public HTTPS hostname: ${value}`);
  return url.href.replace(/\/$/, "");
}

/** @returns {Record<string, string | undefined>} */
export function readEnvironment(input = process.env) {
  const mode = input.APP_ENV || "local";
  if (!["local", "staging", "production"].includes(mode))
    throw new Error("APP_ENV must be local, staging, or production");
  // Remote builds never inherit credentials or values from the local .env files.
  let env = {};
  if (mode === "local")
    for (const file of [".env", ".env.local"])
      if (existsSync(file)) Object.assign(env, parse(readFileSync(file)));
  env = { ...env, ...input, APP_ENV: mode };
  env.SITE_URL ||= "http://localhost:4388";
  env.CONTENT_SOURCE ||= "local";
  if (!["local", "directus"].includes(env.CONTENT_SOURCE))
    throw new Error("Invalid CONTENT_SOURCE");
  if (mode === "local" && env.CONTENT_SOURCE === "directus")
    assertLocalMaintenance(env);
  if (mode !== "local") {
    const targets = JSON.parse(
      // Astro bundles this module while rendering static routes. Resolve from
      // the project working directory so the config is available both before
      // and during that bundled build.
      readFileSync(resolve(process.cwd(), "config/deployment.json")),
    );
    const target = targets[mode];
    const other = targets[mode === "production" ? "staging" : "production"];
    if (!target.siteUrl || !target.directusUrl)
      throw new Error(`Configure the ${mode} deployment target before remote builds`);
    // A noindex staging-only deployment does not require production URLs.
    // Production still requires a separately reviewed staging target.
    if (mode === "production" && (!other.siteUrl || !other.directusUrl || !other.pagesProject))
      throw new Error("Configure both deployment targets before production builds");
    if (other.siteUrl && other.directusUrl)
      for (const key of ["siteUrl", "directusUrl"]) {
        if (publicUrl(target[key]) === publicUrl(other[key]))
          throw new Error(`Staging and production must use separate ${key}`);
      }
    if (
      new URL(target.siteUrl).pathname !== "/" ||
      (other.siteUrl && new URL(other.siteUrl).pathname !== "/")
    )
      throw new Error("SITE_URL must be a site root");
    if (mode === "production" && target.pagesProject === other.pagesProject)
      throw new Error("Use separate Cloudflare Pages projects");
    if (
      publicUrl(env.SITE_URL) !== publicUrl(target.siteUrl) ||
      publicUrl(env.DIRECTUS_URL) !== publicUrl(target.directusUrl)
    )
      throw new Error(
        "Environment URLs do not match the reviewed deployment configuration",
      );
    if (env.CONTENT_SOURCE !== "directus" || !env.DIRECTUS_API_TOKEN)
      throw new Error(
        "Remote builds require Directus and a read-only API token",
      );
    if (env.DIRECTUS_ADMIN_TOKEN || env.DIRECTUS_ADMIN_PASSWORD)
      throw new Error(
        "Do not expose Directus admin credentials to website builds",
      );
  }
  if (
    mode === "production" &&
    (env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REF !== "refs/heads/main" ||
      !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME))
  ) {
    throw new Error(
      "Production builds are restricted to the main branch in GitHub Actions",
    );
  }
  return env;
}

export function assertLocalMaintenance(env = process.env) {
  const url = new URL(env.DIRECTUS_URL || "http://localhost:8088");
  if (
    (env.APP_ENV || "local") !== "local" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "This maintenance script is local-only; remote changes require a reviewed maintenance procedure",
    );
  }
}
