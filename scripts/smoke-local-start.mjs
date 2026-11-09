import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const child = spawn(process.execPath, ['scripts/start-local-production.mjs'], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port) },
});
const exited = once(child, 'exit');
let started = false;
try {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Local server exited before its health check');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
      if (response.status === 200) { started = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!started) throw new Error('Local /health did not return 200 within 60 seconds');
  console.log('Local production server /health returned 200');
} finally {
  child.kill();
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}
