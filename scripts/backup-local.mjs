import "dotenv/config";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assertLocalMaintenance } from "./environment.mjs";
assertLocalMaintenance();
function run(command, args, capture = false) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (r.status !== 0) throw new Error(`${command} failed`);
  return r.stdout?.trim();
}
await access("directus/database/data.db");
process.umask(0o077);
await mkdir("backups", { recursive: true, mode: 0o700 });
const name = `backups/directus-${new Date().toISOString().replaceAll(":", "-")}.tar.gz`;
const running = Boolean(
  run(
    "docker",
    ["compose", "ps", "--status", "running", "-q", "directus"],
    true,
  ),
);
try {
  if (running) run("docker", ["compose", "stop", "directus"]);
  run("tar", [
    "-czf",
    name,
    "directus/database",
    "directus/uploads",
    "directus/schema.json",
    "directus/hooks",
    "docker-compose.yml",
  ]);
  run("tar", ["-tzf", name], true);
  const hash = createHash("sha256")
    .update(await readFile(name))
    .digest("hex");
  await writeFile(name + ".sha256", `${hash}  ${name}\n`, { mode: 0o600 });
  console.log(
    `Backup created: ${name} (.env excluded; database still contains sensitive account data)`,
  );
} finally {
  if (running) run("docker", ["compose", "start", "directus"]);
}
