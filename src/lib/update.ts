import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const VERSION_FILENAME = 'version.json';
const LATEST_RELEASE_URL = 'https://api.github.com/repos/0xRaduan/granola-cli/releases/latest';

interface VersionInfo {
  latest_version: string;
  last_checked_at: string;
}

function versionFilePath(): string {
  return join(homedir(), '.granola', VERSION_FILENAME);
}

function readVersionInfo(): VersionInfo | null {
  try {
    const raw = readFileSync(versionFilePath(), 'utf8');
    return JSON.parse(raw) as VersionInfo;
  } catch {
    return null;
  }
}

function writeVersionInfo(info: VersionInfo): void {
  const filePath = versionFilePath();
  mkdirSync(join(homedir(), '.granola'), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(info)}\n`);
}

function parseVersion(v: string): [number, number, number] | null {
  const clean = v.trim().replace(/^v/, '');
  const parts = clean.split('.');
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return [nums[0], nums[1], nums[2]];
}

function isNewer(latest: string, current: string): boolean | null {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c) return null;
  if (l[0] !== c[0]) return l[0] > c[0];
  if (l[1] !== c[1]) return l[1] > c[1];
  if (l[2] !== c[2]) return l[2] > c[2];
  return false;
}

function shouldRefresh(info: VersionInfo | null): boolean {
  if (!info) return true;
  const last = Date.parse(info.last_checked_at);
  if (Number.isNaN(last)) return true;
  return Date.now() - last > 1000 * 60 * 60 * 20;
}

export async function maybeCheckForUpdates(currentVersion: string): Promise<void> {
  if (process.env.GRANOLA_DISABLE_UPDATE_CHECK) return;
  const existing = readVersionInfo();
  if (!shouldRefresh(existing)) {
    if (existing && isNewer(existing.latest_version, currentVersion)) {
      reportUpdate(existing.latest_version, currentVersion);
    }
    return;
  }

  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { 'User-Agent': 'granola-cli' },
    });
    if (!response.ok) return;
    const data = (await response.json()) as { tag_name?: string };
    const latestTag = data.tag_name;
    if (!latestTag) return;
    const latestVersion = latestTag.replace(/^v/, '');
    writeVersionInfo({ latest_version: latestVersion, last_checked_at: new Date().toISOString() });
    if (isNewer(latestVersion, currentVersion)) {
      reportUpdate(latestVersion, currentVersion);
    }
  } catch {
    return;
  }
}

function reportUpdate(latest: string, current: string): void {
  const updateCommand = getUpdateCommandString();
  const message = updateCommand
    ? `Update available ${current} -> ${latest}. Run \`${updateCommand}\`.`
    : `Update available ${current} -> ${latest}.`;
  process.stderr.write(`${message}\n`);
}

export function getUpdateCommandString(): string | null {
  const action = getUpdateAction();
  if (!action) return null;
  return [action.command, ...action.args].join(' ');
}

export function getUpdateAction(): { command: string; args: string[] } | null {
  if (process.env.GRANOLA_MANAGED_BY_NPM) {
    return { command: 'npm', args: ['install', '-g', '@0xraduan/granola-cli'] };
  }
  if (process.env.GRANOLA_MANAGED_BY_BUN) {
    return { command: 'bun', args: ['install', '-g', '@0xraduan/granola-cli'] };
  }

  if (hasCommand('bun')) {
    return { command: 'bun', args: ['install', '-g', '@0xraduan/granola-cli'] };
  }
  if (hasCommand('npm')) {
    return { command: 'npm', args: ['install', '-g', '@0xraduan/granola-cli'] };
  }
  return null;
}

export function runUpdateCommand(): number {
  const action = getUpdateAction();
  if (!action) {
    process.stderr.write('No supported package manager found. Install bun or npm.\n');
    return 1;
  }
  const result = spawnSync(action.command, action.args, { stdio: 'inherit' });
  return result.status ?? 1;
}

function hasCommand(cmd: string): boolean {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}
