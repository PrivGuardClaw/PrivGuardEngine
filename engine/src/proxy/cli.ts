#!/usr/bin/env node
/**
 * PrivGuard Proxy CLI
 *
 * Usage:
 *   privguard-proxy                    Start proxy (auto-detect rules)
 *   privguard-proxy init               One-click: install skills + configure agents + start
 *   privguard-proxy configure          Auto-configure detected agents to use proxy
 *   privguard-proxy teardown           Remove proxy config from all agents
 *   privguard-proxy setup              Show setup instructions
 *   privguard-proxy --help             Show help
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllRules } from '../loader.js';
import type { Rule } from '../types.js';
import { startProxy } from './server.js';
import { displayBanner, displayError, displayInfo } from './display.js';
import { detectAgents, printSetupInstructions, getPort, configureAll } from './config.js';
import { setup, teardown } from './setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// ── Route commands ──

switch (command) {
  case 'init':
    handleInit();
    break;
  case 'configure':
    handleConfigure();
    break;
  case 'teardown':
  case 'uninstall':
    teardown();
    process.exit(0);
    break;
  case 'setup':
  case 'detect':
    handleSetup();
    break;
  case '--help':
  case '-h':
  case 'help':
    printUsage();
    process.exit(0);
    break;
  case '--version':
  case 'version':
    console.log('0.2.0');
    process.exit(0);
    break;
  default:
    handleStart();
    break;
}

// ── Command handlers ──

function handleInit(): void {
  const port = parseInt(getArg('port') || '', 10) || getPort();

  // Step 1 & 2: Install skills + configure agents
  const result = setup({
    projectDir: process.cwd(),
    port,
    skipSkills: hasFlag('skip-skills'),
    skipConfigure: hasFlag('skip-configure'),
  });

  // Step 3: Start proxy
  if (!hasFlag('no-start')) {
    console.log('\n  Starting proxy...\n');
    const rules = loadRules(getArg('rules-dir') || result.rulesDir);
    displayBanner(port, 'auto');
    displayInfo(`Loaded ${rules.length} detection rules.\n`);

    const handle = startProxy({ port, rules });
    setupShutdown(handle);
  }
}

function handleConfigure(): void {
  const port = parseInt(getArg('port') || '', 10) || getPort();
  const proxyUrl = `http://localhost:${port}`;

  console.log(`\n🛡️  Configuring agents to use proxy at ${proxyUrl}\n`);

  const results = configureAll(port);
  for (const r of results) {
    const icon = r.success ? '✅' : '✗';
    console.log(`  ${icon} ${r.agent}: ${r.message}`);
    if (r.backupPath) console.log(`     Backup: ${r.backupPath}`);
  }
  console.log('');
}

function handleSetup(): void {
  const agents = detectAgents();
  console.log('\n🛡️  PrivGuard Proxy — Agent Status\n');
  printSetupInstructions(agents);
}

function handleStart(): void {
  // If first arg looks like a flag, it's the start command (default)
  if (command && !command.startsWith('-')) {
    displayError(`Unknown command: ${command}. Run privguard-proxy --help for usage.`);
    process.exit(1);
  }

  const port = parseInt(getArg('port') || '', 10) || getPort();
  const upstream = getArg('upstream');
  const rulesDir = getArg('rules-dir');
  const verbose = hasFlag('verbose');

  const rules = loadRules(rulesDir);
  if (rules.length === 0) {
    displayError('No rules loaded. Run `privguard-proxy init` to set up.');
    displayInfo('Or specify rules with --rules-dir\n');
  }

  displayBanner(port, upstream || 'auto');

  // Show agent status
  const agents = detectAgents();
  const configured = agents.filter(a => a.configured);
  const detected = agents.filter(a => a.detected);

  if (configured.length > 0) {
    displayInfo(`Agents configured: ${configured.map(a => a.name).join(', ')} ✅`);
  } else if (detected.length > 0) {
    displayInfo(`Agents detected but not configured: ${detected.map(a => a.name).join(', ')}`);
    displayInfo(`Run \`privguard-proxy configure\` to auto-configure.\n`);
  }

  displayInfo(`Loaded ${rules.length} detection rules.\n`);

  const handle = startProxy({ port, rules, upstreamBaseUrl: upstream, verbose, strict: hasFlag('strict') });
  setupShutdown(handle);
}

// ── Helpers ──

function setupShutdown(handle: { stop: () => void }): void {
  process.on('SIGINT', () => {
    console.log('\n🛡️  PrivGuard Proxy stopped.');
    handle.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    handle.stop();
    process.exit(0);
  });
}

function loadRules(rulesDir?: string): Rule[] {
  const dir = rulesDir || findRulesDir();
  if (!dir) {
    displayInfo('No rules directory found. Using built-in rules.');
    return loadBuiltinRules();
  }

  const yamls: string[] = [];
  for (const file of ['zh-CN.yml', 'en-US.yml', 'common.yml', 'custom.yml']) {
    const path = join(dir, file);
    if (existsSync(path)) yamls.push(readFileSync(path, 'utf-8'));
  }

  if (yamls.length === 0) {
    displayInfo(`No rule files in ${dir}. Using built-in rules.`);
    return loadBuiltinRules();
  }

  return loadAllRules(yamls);
}

function findRulesDir(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.privguard', 'rules');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  const bundled = resolve(__dirname, '..', '..', 'rules');
  if (existsSync(bundled)) return bundled;
  const pkgRules = resolve(__dirname, '..', 'rules');
  if (existsSync(pkgRules)) return pkgRules;
  return undefined;
}

function loadBuiltinRules(): Rule[] {
  return [
    { type: 'EMAIL', name: 'Email', pattern: '([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})', confidence: 'high' },
    { type: 'PHONE', name: 'Phone (CN)', pattern: '(?<!\\d)(1[3-9]\\d{9})(?!\\d)', confidence: 'high', validate: 'length_11' },
    { type: 'API_KEY', name: 'API Key', pattern: '(?i)((?:sk|ak|key|token|secret|password|api[_-]?key)[-_][a-zA-Z0-9_-]{20,})', confidence: 'high' },
    { type: 'JWT', name: 'JWT', pattern: '(eyJ[a-zA-Z0-9_-]{10,}\\.eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,})', confidence: 'high' },
    { type: 'SSN', name: 'SSN', pattern: '(?<!\\d)(\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4})(?!\\d)', confidence: 'high', validate: 'ssn_format' },
    { type: 'PRIVATE_KEY', name: 'Private Key', pattern: '(-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\\s\\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----)', confidence: 'high', multiline: true },
  ];
}

function printUsage(): void {
  console.log(`
🛡️  PrivGuard Proxy — Protect PII before it reaches LLM APIs

Commands:
  privguard-proxy              Start the proxy server
  privguard-proxy init         One-click setup: install skills + configure agents + start
  privguard-proxy configure    Auto-configure detected agents to use proxy
  privguard-proxy teardown     Remove proxy config from all agents
  privguard-proxy setup        Show agent detection status and instructions

Options:
  --port <number>       Proxy port (default: 19820, or PRIVGUARD_PORT env)
  --upstream <url>      Upstream API URL (default: auto-detect)
  --rules-dir <path>    Path to rules directory
  --verbose             Show detailed logging
  --skip-skills         (init) Skip skill file installation
  --skip-configure      (init) Skip agent configuration
  --no-start            (init) Don't start proxy after setup

How it works:
  1. privguard-proxy init       # Install skills, configure agents, start proxy
  2. Use your agent as usual    # PII is sanitized transparently
  3. privguard-proxy teardown   # Undo everything when done

Workflow:
  User prompt → Agent CLI → PrivGuard Proxy → [sanitize PII] → LLM API
  LLM response → PrivGuard Proxy → [restore placeholders] → Agent CLI → User
`);
}
