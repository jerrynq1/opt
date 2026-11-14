import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const port = 19_000 + Math.floor(Math.random() * 1_000);
const child = spawn(process.execPath, [path.join(dir, 'home-proxy.mjs')], {
  cwd: path.dirname(dir),
  env: { ...process.env, PORT: String(port), ALLOWED_ORIGINS: '*' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk.toString(); });
child.stderr.on('data', chunk => { logs += chunk.toString(); });
const base = `http://127.0.0.1:${port}`;

try {
  let health = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`home-proxy exited early: ${logs}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) { health = await response.json(); break; }
    } catch {}
    await delay(100);
  }
  assert.deepEqual(health, { ok: true, proxy: 'Binance Equity Stock Options', assets: ['QQQ', 'GLD'] });

  const statusResponse = await fetch(`${base}/api/spot/status`);
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json();
  assert.equal(status.ok, true);
  assert.equal(status.feed.state, 'idle', 'status endpoint should not open a Binance socket before a price is requested');

  const invalid = await fetch(`${base}/api/spot?symbol=BAD`);
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).ok, false);
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2_000)]);
}

console.log('Node home-proxy HTTP integration tests: passed');
