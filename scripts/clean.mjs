import { rm } from 'node:fs/promises';

const targets = { build: ['.next'], install: ['node_modules', '.next'] }[process.argv[2]];
if (!targets) throw new Error('Usage: node scripts/clean.mjs build|install');
// INVARIANT: dependency cleanup preserves the reviewed lockfile and local configuration.
for (const target of targets) await rm(target, { recursive: true, force: true });
