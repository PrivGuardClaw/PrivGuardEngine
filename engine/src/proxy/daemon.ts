/**
 * Daemon mode: start proxy as a detached background process.
 * PID is written to .privguard/proxy.pid for management.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getPidFile(projectDir: string = process.cwd()): string {
  return join(projectDir, '.privguard', 'proxy.pid');
}

export function getLogFile(projectDir: string = process.cwd()): string {
  return join(projectDir, '.privguard', 'proxy.log');
}

export function readPid(projectDir: string = process.cwd()): number | null {
  const pidFile = getPidFile(projectDir);
  if (!existsSync(pidFile)) return null;
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

export function isProxyRunning(projectDir: string = process.cwd()): boolean {
  const pid = readPid(projectDir);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch { return false; }
}

export function stopDaemon(projectDir: string = process.cwd()): boolean {
  const pid = readPid(projectDir);
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch { return false; }
}

export interface DaemonOptions {
  port?: number;
  rulesDir?: string;
  projectDir?: string;
}

export function startDaemon(options: DaemonOptions = {}): { pid: number; logFile: string } {
  const projectDir = options.projectDir || process.cwd();
  const pidFile = getPidFile(projectDir);
  const logFile = getLogFile(projectDir);

  const privguardDir = dirname(pidFile);
  if (!existsSync(privguardDir)) {
    mkdirSync(privguardDir, { recursive: true });
  }

  if (isProxyRunning(projectDir)) {
    const pid = readPid(projectDir)!;
    return { pid, logFile };
  }

  const scriptPath = resolve(__dirname, 'cli.js');
  const args: string[] = [];
  if (options.port) args.push('--port', String(options.port));
  if (options.rulesDir) args.push('--rules-dir', options.rulesDir);

  const logFd = openSync(logFile, 'a');

  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });

  child.unref();

  const pid = child.pid!;
  writeFileSync(pidFile, String(pid) + '\n', 'utf-8');

  return { pid, logFile };
}
