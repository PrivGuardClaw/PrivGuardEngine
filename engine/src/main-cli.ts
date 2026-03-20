#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uninstall } from './proxy/setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const args = process.argv.slice(2);
const command = args[0];
const passthroughArgs = args.slice(1);
const knownCommands = ['setup', 'gui', 'start', 'stop', 'status', 'teardown', 'uninstall', 'sanitize', 'detect', 'restore'];

const version = loadVersion();

function loadVersion(): string {
  try {
    const packagePath = resolve(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version?: string };
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printUsage(): void {
  process.stdout.write(`
🛡️  PrivGuard CLI v${version}

Usage:
  privguard <command> [options]

Commands:
  setup       One-click setup: install rules + configure agents + start proxy
  gui         Start Web GUI (can also start proxy)
  start       Start proxy server only
  stop        Stop background proxy (daemon mode)
  status      Show agent detection and configuration status
  teardown    Remove proxy config from all agents
  uninstall   Fully remove PrivGuard (configs + local files)
  --help      Show help
  --version   Show version

Examples:
  npx -y @privguard/engine setup
  npx -y @privguard/engine gui
  npx -y @privguard/engine teardown
  npx -y @privguard/engine uninstall
`);
}

function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function suggestCommand(input: string): string | undefined {
  let best: { cmd: string; dist: number } | undefined;
  for (const cmd of knownCommands) {
    const dist = editDistance(input, cmd);
    if (!best || dist < best.dist) best = { cmd, dist };
  }
  if (!best) return undefined;
  return best.dist <= 3 ? best.cmd : undefined;
}

function runNodeScript(scriptPath: string, scriptArgs: string[] = []): never {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], { stdio: 'inherit' });
  if (result.error) {
    process.stderr.write(`Failed to run ${scriptPath}: ${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

function runProxyCli(scriptArgs: string[] = []): never {
  const proxyCliPath = resolve(__dirname, 'proxy', 'cli.js');
  return runNodeScript(proxyCliPath, scriptArgs);
}

function runGuiCli(scriptArgs: string[] = []): never {
  const guiCliPath = resolve(__dirname, 'privguard-gui.cjs');
  return runNodeScript(guiCliPath, scriptArgs);
}

switch (command) {
  case 'sanitize':
  case 'detect':
  case 'restore':
    runNodeScript(resolve(__dirname, 'cli.js'), [command, ...passthroughArgs]);
    break;
  case 'setup':
    runProxyCli(['init', ...passthroughArgs]);
    break;
  case 'gui':
    runGuiCli(passthroughArgs);
    break;
  case 'start':
    runProxyCli(passthroughArgs);
    break;
  case 'stop':
    import('./proxy/daemon.js').then(({ isProxyRunning, stopDaemon }) => {
      if (!isProxyRunning()) {
        process.stderr.write('No proxy is running in background.\n');
        process.exit(1);
      }
      const stopped = stopDaemon();
      if (stopped) {
        process.stdout.write('🛡️  Proxy stopped.\n');
        process.exit(0);
      } else {
        process.stderr.write('Failed to stop proxy.\n');
        process.exit(1);
      }
    }).catch(err => {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    });
    break;
  case 'status':
    runProxyCli(['setup', ...passthroughArgs]);
    break;
  case 'teardown':
    runProxyCli(['teardown', ...passthroughArgs]);
    break;
  case 'uninstall':
    uninstall(process.cwd()).then(() => process.exit(0)).catch(err => {
      process.stderr.write(`Uninstall failed: ${err.message}\n`);
      process.exit(1);
    });
    break;
  case '--version':
  case 'version':
    process.stdout.write(`${version}\n`);
    process.exit(0);
    break;
  case '--help':
  case '-h':
  case 'help':
  case undefined:
    printUsage();
    process.exit(0);
    break;
  case 'init':
    process.stderr.write('Deprecated: `privguard init` is replaced by `privguard setup`.\n');
    runProxyCli(['init', ...passthroughArgs]);
    break;
  case 'configure':
    process.stderr.write('Deprecated: `privguard configure` is replaced by `privguard setup`.\n');
    runProxyCli(['configure', ...passthroughArgs]);
    break;
  default:
    {
      const suggested = suggestCommand(command);
      if (suggested) {
        process.stderr.write(`Unknown command: ${command}. Did you mean \`privguard ${suggested}\`?\n`);
      } else {
        process.stderr.write(`Unknown command: ${command}. Run \`privguard --help\` for usage.\n`);
      }
    }
    process.exit(1);
    break;
}
