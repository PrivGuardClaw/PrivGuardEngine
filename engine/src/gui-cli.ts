#!/usr/bin/env node
/**
 * PrivGuard GUI CLI — starts the Web management interface alongside the proxy.
 *
 * Usage:
 *   privguard-gui [options]
 *   node privguard-gui.cjs [options]
 *
 * Options:
 *   --port <number>      Web GUI port (default: 19821)
 *   --proxy-port <num>   Proxy server port (default: 19820)
 *   --password <string>  Access password (auto-generated if omitted)
 *   --rules-dir <path>   Rules directory (default: auto-detect)
 *   --no-proxy           Start GUI only, without proxy server
 */
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AuthModule } from './gui/auth.js';
import { RecordStore } from './gui/record-store.js';
import { RuleManager } from './gui/rule-manager.js';
import { SSEManager } from './gui/sse.js';
import { startWebServer } from './gui/web-server.js';
import { generatePassword } from './gui/utils.js';
import { startProxy } from './proxy/server.js';
import { loadAllRules } from './loader.js';
import { readFileSync } from 'node:fs';
import type { ProxyStatus } from './gui/types.js';

const GUI_VERSION = '0.1.0';

// ── Parse args ──
const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

if (hasFlag('help') || hasFlag('h') || args.includes('-h')) {
  process.stdout.write(`
🛡️  PrivGuard GUI — Web 管理界面

Usage:
  privguard-gui [options]

Options:
  --port <number>        Web GUI 端口 (默认: 19821)
  --proxy-port <number>  代理服务器端口 (默认: 19820)
  --password <string>    访问密码 (未指定则自动生成)
  --rules-dir <path>     规则目录路径 (默认: 自动检测)
  --no-proxy             仅启动 GUI，不启动代理服务器
  --version              显示版本号
  --help                 显示此帮助信息

Examples:
  privguard-gui                              # 默认启动，自动生成密码
  privguard-gui --password mypass            # 指定密码
  privguard-gui --port 8080                  # 指定 GUI 端口
  privguard-gui --no-proxy                   # 仅 GUI，不启动代理
  privguard-gui --rules-dir .privguard/rules # 指定规则目录

启动后:
  1. 浏览器打开终端输出的地址 (默认 http://localhost:19821)
  2. 输入密码登录
  3. 查看拦截记录、管理保护规则、监控代理状态
  4. Ctrl+C 停止服务
`);
  process.exit(0);
}

if (hasFlag('version') || hasFlag('-v')) {
  process.stdout.write(`privguard-gui v${GUI_VERSION}\n`);
  process.exit(0);
}

const GUI_PORT = parseInt(getArg('port') ?? '19821', 10);
const PROXY_PORT = parseInt(getArg('proxy-port') ?? '19820', 10);
const NO_PROXY = hasFlag('no-proxy');

// ── Password ──
let password = getArg('password');
let passwordGenerated = false;
if (!password) {
  password = generatePassword();
  passwordGenerated = true;
}

// ── Rules directory ──
function findRulesDir(): string {
  const explicit = getArg('rules-dir');
  if (explicit) return explicit;

  // Search upward from cwd
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.privguard', 'rules');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: skill references/rules next to this binary
  const skillRules = resolve(__dirname, '..', 'references', 'rules');
  if (existsSync(skillRules)) return skillRules;

  // Last resort: create .privguard/rules in cwd
  return join(process.cwd(), '.privguard', 'rules');
}

const rulesDir = findRulesDir();

// ── Load initial rules ──
function loadRules() {
  const files = ['zh-CN.yml', 'en-US.yml', 'common.yml', 'custom.yml'];
  const yamls: string[] = [];
  for (const f of files) {
    const p = join(rulesDir, f);
    if (existsSync(p)) {
      try { yamls.push(readFileSync(p, 'utf-8')); } catch { /* skip */ }
    }
  }
  return loadAllRules(yamls);
}

// ── Shared state ──
const records = new RecordStore();
const auth = new AuthModule(password);
const rules = new RuleManager(rulesDir);
const sse = new SSEManager();

// Proxy state
let proxyHandle: { stop: () => void } | null = null;
let proxyRequestCount = 0;
let proxyLastActivity: number | undefined;
let currentRules = loadRules();

// ── Rule hot-reload ──
rules.onReload = (newRules) => {
  currentRules = newRules;
  sse.broadcast('rule-change', { timestamp: Date.now() });
};

// ── Proxy status ──
function getProxyStatus(): ProxyStatus {
  return {
    running: proxyHandle !== null,
    port: NO_PROXY ? undefined : PROXY_PORT,
    upstreamUrl: undefined,
    requestCount: proxyRequestCount,
    lastActivity: proxyLastActivity,
  };
}

// ── Start proxy ──
function doStartProxy(): boolean {
  if (proxyHandle) return true;
  try {
    proxyHandle = startProxy({
      port: PROXY_PORT,
      rules: currentRules,
      recordStore: records,
      onError: (err: Error) => {
        const isInUse = (err as any).code === 'EADDRINUSE';
        if (isInUse) {
          process.stdout.write(
            `\n⚠️  代理端口 ${PROXY_PORT} 已被占用（可能已有代理在运行）\n` +
            `   GUI 仍可正常使用，拦截记录将由已运行的代理产生\n` +
            `   如需使用新代理，请先停止现有代理或使用 --proxy-port 指定其他端口\n\n`
          );
        } else {
          process.stderr.write(`代理服务器错误: ${err.message}\n`);
        }
        proxyHandle = null;
      },
    });
    // Broadcast status update
    sse.broadcast('proxy-status', getProxyStatus());
    return true;
  } catch {
    return false;
  }
}

// ── Subscribe to new records → push via SSE ──
records.subscribe((record) => {
  proxyRequestCount++;
  proxyLastActivity = record.timestamp;
  sse.broadcast('record', record);
  sse.broadcast('proxy-status', getProxyStatus());
});

// ── Start proxy unless --no-proxy ──
if (!NO_PROXY) {
  doStartProxy();
}

// ── Start Web server ──
const webHandle = startWebServer(
  { port: GUI_PORT, password, rulesDir, proxyPort: PROXY_PORT },
  { auth, records, rules, sse, proxyStatus: getProxyStatus, startProxy: doStartProxy },
);

// ── Print banner ──
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

process.stdout.write(
  `\n${BOLD}🛡️  PrivGuard GUI v${GUI_VERSION}${RESET}\n` +
  `${'─'.repeat(40)}\n` +
  `${CYAN}  管理界面:${RESET}  ${BOLD}http://localhost:${GUI_PORT}${RESET}\n` +
  (NO_PROXY ? '' : `${GREEN}  代理地址:${RESET}  http://localhost:${PROXY_PORT}\n`) +
  `${YELLOW}  访问密码:${RESET}  ${BOLD}${password}${RESET}` +
  (passwordGenerated ? `  ${DIM}(自动生成，请妥善保存)${RESET}` : '') +
  `\n${'─'.repeat(40)}\n` +
  `${DIM}按 Ctrl+C 停止服务${RESET}\n\n`
);

// ── Graceful shutdown ──
function shutdown() {
  process.stdout.write('\n正在关闭服务...\n');
  webHandle.stop();
  if (proxyHandle) proxyHandle.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
