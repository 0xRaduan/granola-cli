#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const binDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(binDir);
const srcEntry = join(rootDir, 'src', 'cli.ts');
const distEntry = join(rootDir, 'dist', 'cli.js');
const args = process.argv.slice(2);

function hasCommand(cmd) {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

if (existsSync(srcEntry) && hasCommand('bun')) {
  const result = spawnSync('bun', [srcEntry, ...args], {
    stdio: 'inherit',
    env: { ...process.env, GRANOLA_MANAGED_BY_BUN: '1' },
  });
  process.exit(result.status ?? 0);
}

if (existsSync(distEntry)) {
  const nodeResult = spawnSync('node', [distEntry, ...args], {
    stdio: 'inherit',
    env: { ...process.env, GRANOLA_MANAGED_BY_NPM: '1' },
  });
  process.exit(nodeResult.status ?? 0);
}

process.stderr.write('No build found. Run "bun run build" or use bun to run src/cli.ts.\n');
process.exit(1);
