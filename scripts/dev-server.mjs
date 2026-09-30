import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const host = '127.0.0.1';
const port = 4388;
const address = `http://${host}:${port}`;
const stop = process.argv[2] === '--stop';
if (process.argv.slice(2).some(arg => arg !== '--stop')) {
  throw new Error('本專案固定使用 4388。請執行 npm run dev 或 npm run dev:stop。');
}

async function occupied() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => error.code === 'EADDRINUSE' ? resolve(true) : reject(error));
    server.listen(port, host, () => server.close(() => resolve(false)));
  });
}

function owners() {
  const result = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return [];
  return [...new Set(result.stdout.trim().split(/\s+/).map(Number))].filter(pid => Number.isInteger(pid) && pid > 1);
}

function belongsToProject(pid) {
  const cwd = spawnSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
  const command = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return cwd.status === 0 && command.status === 0 && cwd.stdout.split('\n').includes(`n${root}`)
    && [`${root}/node_modules/.bin/astro dev`, `${root}/node_modules/astro/astro.js dev`].some(expected => command.stdout.includes(expected));
}

if (await occupied()) {
  const pids = owners();
  if (pids.length !== 1 || !belongsToProject(pids[0])) {
    console.error(`4388 被其他或無法確認身分的程序占用；未停止任何程序，也不會自動換埠。`);
    process.exitCode = 1;
  } else if (!stop) {
    console.log(`88baccarat 已在執行：${address}\n不需重複啟動。需要重啟時，先執行 npm run dev:stop，再執行 npm run dev。`);
  } else {
    // Recheck identity immediately before signaling; never kill arbitrary port owners.
    if (!belongsToProject(pids[0])) throw new Error('程序身分已改變，未停止任何程序。');
    process.kill(pids[0], 'SIGTERM');
    for (let attempt = 0; attempt < 30 && await occupied(); attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    if (await occupied()) throw new Error('4388 尚未釋放，請檢查原本的終端機；未強制終止程序。');
    console.log('已停止本專案開發站；其他專案與 Directus 保持運作。');
  }
} else if (stop) {
  console.log('本專案開發站目前沒有占用 4388。');
} else {
  const child = spawn(process.execPath, [`${root}/node_modules/astro/astro.js`, 'dev', '--host', host, '--port', String(port)], { cwd: root, stdio: 'inherit', env: process.env });
  const forward = signal => { if (!child.killed) child.kill(signal); };
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1); });
}
