import { execFileSync } from "node:child_process";
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REF !== "refs/heads/main"
)
  throw new Error("Promotion check must run on main in GitHub Actions");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const stagingSHA = git("rev-parse", "origin/develop");
if (
  git("rev-parse", "HEAD^{tree}") !== git("rev-parse", "origin/develop^{tree}")
)
  throw new Error(
    "Production code differs from develop; validate the exact code on staging first",
  );
const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
async function api(path) {
  const r = await fetch(base + path, {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`GitHub API: ${r.status}`);
  return r.json();
}
const runs = await api(
  "/actions/workflows/release.yml/runs?branch=develop&status=success&per_page=50",
);
const run = runs.workflow_runs.find(
  (run) =>
    run.head_sha === stagingSHA &&
    ["push", "workflow_dispatch"].includes(run.event),
);
if (!run)
  throw new Error("No successful staging release for the develop commit");
const artifacts = await api(`/actions/runs/${run.id}/artifacts`);
if (
  !artifacts.artifacts.some(
    (item) => item.name === `release-staging-${stagingSHA}` && !item.expired,
  )
)
  throw new Error("Missing checked staging artifact");
console.log("Production tree matches the successfully deployed staging tree.");
