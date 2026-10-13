import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// INVARIANT: Next standalone output omits public and static assets; copy them before serving.
try {
  await cp('public', '.next/standalone/public', { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
await import(pathToFileURL(resolve('.next/standalone/server.js')).href);
