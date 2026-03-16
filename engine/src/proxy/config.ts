/**
 * Auto-detect installed AI agents, read their configs, and configure proxy.
 * Supports: Claude Code, OpenCode, OpenClaw.
 *
 * Each agent has:
 * - Detection: check if CLI binary exists
 * - Config read: find and parse the agent's config file
 * - Config write: inject proxy base URL into the config
 * - Skill install: copy AGENTS.md / CLAUDE.md / rules into the right place
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';

export interface AgentInfo {
  name: string;
  detected: boolean;
  configured: boolean;
  configPath: string | null;
  currentBaseUrl: string | null;
  instructions: string;
}

export interface ConfigureResult {
  agent: string;
  success: boolean;
  message: string;
  backupPath?: string;
}

const DEFAULT_PORT = 19820;

export function getPort(): number {
  const envPort = process.env.PRIVGUARD_PORT;
  if (envPort) {
    const p = parseInt(envPort, 10);
    if (!isNaN(p) && p > 0 && p < 65536) return p;
  }
  return DEFAULT_PORT;
}

function homeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '~';
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Agent Detection ──

export function detectAgents(): AgentInfo[] {
  const port = getPort();
  const proxyUrl = `http://localhost:${port}`;
  return [
    detectClaudeCode(proxyUrl),
    detectOpenCode(proxyUrl),
    detectOpenClaw(proxyUrl),
  ];
}

// ── Claude Code ──

function getClaudeConfigPath(): string {
  return join(homeDir(), '.claude', 'settings.json');
}

function detectClaudeCode(proxyUrl: string): AgentInfo {
  const detected = commandExists('claude');
  const configPath = getClaudeConfigPath();
  let configured = false;
  let currentBaseUrl: string | null = null;

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      currentBaseUrl = config?.env?.ANTHROPIC_BASE_URL || null;
      configured = currentBaseUrl === proxyUrl;
    } catch { /* ignore parse errors */ }
  }

  return {
    name: 'Claude Code',
    detected,
    configured,
    configPath: detected ? configPath : null,
    currentBaseUrl,
    instructions: [
      `# Option 1: Auto-configure (recommended)`,
      `privguard-proxy configure`,
      ``,
      `# Option 2: Manual — add to ~/.claude/settings.json:`,
      `{`,
      `  "env": {`,
      `    "ANTHROPIC_BASE_URL": "${proxyUrl}"`,
      `  }`,
      `}`,
      ``,
      `# Option 3: Environment variable (per-session)`,
      `export ANTHROPIC_BASE_URL=${proxyUrl}`,
    ].join('\n'),
  };
}

export function configureClaudeCode(proxyUrl: string): ConfigureResult {
  const configPath = getClaudeConfigPath();
  const configDir = dirname(configPath);

  try {
    // Ensure directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Read existing config or create new
    let config: any = {};
    let backupPath: string | undefined;

    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8');
      config = JSON.parse(raw);

      // Backup existing config
      backupPath = configPath + '.privguard-backup';
      writeFileSync(backupPath, raw, 'utf-8');
    }

    // Set proxy URL, preserving original base URL for upstream forwarding
    if (!config.env) config.env = {};
    const currentUrl = config.env.ANTHROPIC_BASE_URL;
    if (currentUrl && currentUrl !== proxyUrl && !config.env._PRIVGUARD_ORIGINAL_BASE_URL) {
      config.env._PRIVGUARD_ORIGINAL_BASE_URL = currentUrl;
    }
    config.env.ANTHROPIC_BASE_URL = proxyUrl;

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    const originalNote = config.env._PRIVGUARD_ORIGINAL_BASE_URL
      ? ` (original: ${config.env._PRIVGUARD_ORIGINAL_BASE_URL})`
      : '';

    return {
      agent: 'Claude Code',
      success: true,
      message: `Configured ANTHROPIC_BASE_URL in ${configPath}${originalNote}`,
      backupPath,
    };
  } catch (err: any) {
    return {
      agent: 'Claude Code',
      success: false,
      message: `Failed to configure: ${err.message}`,
    };
  }
}

export function unconfigureClaudeCode(): ConfigureResult {
  const configPath = getClaudeConfigPath();

  try {
    if (!existsSync(configPath)) {
      return { agent: 'Claude Code', success: true, message: 'No config file found, nothing to undo.' };
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config?.env) {
      const originalUrl = config.env._PRIVGUARD_ORIGINAL_BASE_URL;
      if (originalUrl) {
        // Restore original base URL
        config.env.ANTHROPIC_BASE_URL = originalUrl;
        delete config.env._PRIVGUARD_ORIGINAL_BASE_URL;
      } else {
        delete config.env.ANTHROPIC_BASE_URL;
      }
      if (Object.keys(config.env).length === 0) delete config.env;
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    }

    return { agent: 'Claude Code', success: true, message: `Restored ANTHROPIC_BASE_URL in ${configPath}` };
  } catch (err: any) {
    return { agent: 'Claude Code', success: false, message: `Failed: ${err.message}` };
  }
}

// ── OpenCode ──

function getOpenCodeConfigPath(): string {
  return join(homeDir(), '.config', 'opencode', 'opencode.json');
}

function detectOpenCode(proxyUrl: string): AgentInfo {
  const detected = commandExists('opencode');
  const configPath = getOpenCodeConfigPath();
  let configured = false;
  let currentBaseUrl: string | null = null;

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      // Check all providers for our proxy URL
      if (config?.provider) {
        for (const [, prov] of Object.entries(config.provider) as any) {
          if (prov?.options?.baseURL === proxyUrl) {
            configured = true;
            currentBaseUrl = proxyUrl;
            break;
          }
        }
      }
    } catch { /* ignore */ }
  }

  return {
    name: 'OpenCode',
    detected,
    configured,
    configPath: detected ? configPath : null,
    currentBaseUrl,
    instructions: [
      `# Option 1: Auto-configure (recommended)`,
      `privguard-proxy configure`,
      ``,
      `# Option 2: Manual — in ~/.config/opencode/opencode.json:`,
      `{`,
      `  "provider": {`,
      `    "anthropic": {`,
      `      "options": { "baseURL": "${proxyUrl}" }`,
      `    }`,
      `  }`,
      `}`,
    ].join('\n'),
  };
}

export function configureOpenCode(proxyUrl: string): ConfigureResult {
  const configPath = getOpenCodeConfigPath();
  const configDir = dirname(configPath);

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    let config: any = {};
    let backupPath: string | undefined;

    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8');
      config = JSON.parse(raw);
      backupPath = configPath + '.privguard-backup';
      writeFileSync(backupPath, raw, 'utf-8');
    }

    // Inject proxy into all existing providers, or create anthropic provider
    if (!config.provider) config.provider = {};

    // For each existing provider, wrap its baseURL
    let injected = false;
    for (const prov of Object.values(config.provider) as any[]) {
      if (prov?.options?.baseURL && prov.options.baseURL !== proxyUrl) {
        // Save original URL as a header so proxy can forward to it
        if (!prov.options._originalBaseURL) {
          prov.options._originalBaseURL = prov.options.baseURL;
        }
        prov.options.baseURL = proxyUrl;
        injected = true;
      }
    }

    // If no providers were modified, add anthropic provider
    if (!injected) {
      if (!config.provider.anthropic) config.provider.anthropic = {};
      if (!config.provider.anthropic.options) config.provider.anthropic.options = {};
      config.provider.anthropic.options.baseURL = proxyUrl;
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    return {
      agent: 'OpenCode',
      success: true,
      message: `Configured baseURL in ${configPath}`,
      backupPath,
    };
  } catch (err: any) {
    return { agent: 'OpenCode', success: false, message: `Failed: ${err.message}` };
  }
}

export function unconfigureOpenCode(): ConfigureResult {
  const configPath = getOpenCodeConfigPath();

  try {
    if (!existsSync(configPath)) {
      return { agent: 'OpenCode', success: true, message: 'No config file found.' };
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config?.provider) {
      for (const [, prov] of Object.entries(config.provider) as any) {
        if (prov?.options?._originalBaseURL) {
          prov.options.baseURL = prov.options._originalBaseURL;
          delete prov.options._originalBaseURL;
        }
      }
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return { agent: 'OpenCode', success: true, message: `Restored original baseURL in ${configPath}` };
  } catch (err: any) {
    return { agent: 'OpenCode', success: false, message: `Failed: ${err.message}` };
  }
}

// ── OpenClaw ──

function getOpenClawConfigPath(): string {
  // OpenClaw uses ~/.config/openclaw/ or OPENCLAW_CONFIG_PATH
  const envPath = process.env.OPENCLAW_CONFIG_PATH;
  if (envPath) return envPath;
  return join(homeDir(), '.config', 'openclaw', 'config.json');
}

function detectOpenClaw(proxyUrl: string): AgentInfo {
  const detected = commandExists('openclaw');
  const configPath = getOpenClawConfigPath();
  let configured = false;
  let currentBaseUrl: string | null = null;

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      currentBaseUrl = config?.baseURL || config?.api?.baseURL || null;
      configured = currentBaseUrl === proxyUrl;
    } catch { /* ignore */ }
  }

  return {
    name: 'OpenClaw',
    detected,
    configured,
    configPath: detected ? configPath : null,
    currentBaseUrl,
    instructions: [
      `# Option 1: Auto-configure (recommended)`,
      `privguard-proxy configure`,
      ``,
      `# Option 2: Manual — set base URL in OpenClaw config to:`,
      `# ${proxyUrl}`,
    ].join('\n'),
  };
}

export function configureOpenClaw(proxyUrl: string): ConfigureResult {
  const configPath = getOpenClawConfigPath();
  const configDir = dirname(configPath);

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    let config: any = {};
    let backupPath: string | undefined;

    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8');
      config = JSON.parse(raw);
      backupPath = configPath + '.privguard-backup';
      writeFileSync(backupPath, raw, 'utf-8');
    }

    if (!config.api) config.api = {};
    if (config.api.baseURL && config.api.baseURL !== proxyUrl) {
      config.api._originalBaseURL = config.api.baseURL;
    }
    config.api.baseURL = proxyUrl;

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    return { agent: 'OpenClaw', success: true, message: `Configured baseURL in ${configPath}`, backupPath };
  } catch (err: any) {
    return { agent: 'OpenClaw', success: false, message: `Failed: ${err.message}` };
  }
}

export function unconfigureOpenClaw(): ConfigureResult {
  const configPath = getOpenClawConfigPath();

  try {
    if (!existsSync(configPath)) {
      return { agent: 'OpenClaw', success: true, message: 'No config file found.' };
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config?.api?._originalBaseURL) {
      config.api.baseURL = config.api._originalBaseURL;
      delete config.api._originalBaseURL;
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return { agent: 'OpenClaw', success: true, message: `Restored original baseURL in ${configPath}` };
  } catch (err: any) {
    return { agent: 'OpenClaw', success: false, message: `Failed: ${err.message}` };
  }
}

// ── Read saved upstream URLs ──

/** Get the original upstream URL for Claude Code (saved during configure) */
export function getClaudeOriginalUpstream(): string | undefined {
  const configPath = getClaudeConfigPath();
  if (!existsSync(configPath)) return undefined;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config?.env?._PRIVGUARD_ORIGINAL_BASE_URL || undefined;
  } catch { return undefined; }
}

/** Get the original upstream URL for OpenCode (saved during configure) */
export function getOpenCodeOriginalUpstream(): string | undefined {
  const configPath = getOpenCodeConfigPath();
  if (!existsSync(configPath)) return undefined;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (config?.provider) {
      for (const [, prov] of Object.entries(config.provider) as any) {
        if (prov?.options?._originalBaseURL) return prov.options._originalBaseURL;
      }
    }
  } catch { /* ignore */ }
  return undefined;
}

/** Get the original upstream URL for OpenClaw (saved during configure) */
export function getOpenClawOriginalUpstream(): string | undefined {
  const configPath = getOpenClawConfigPath();
  if (!existsSync(configPath)) return undefined;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config?.api?._originalBaseURL || undefined;
  } catch { return undefined; }
}

/** Auto-detect the best upstream URL from configured agents */
export function detectUpstreamUrl(): string | undefined {
  return getClaudeOriginalUpstream() || getOpenCodeOriginalUpstream() || getOpenClawOriginalUpstream();
}

// ── Unified configure/unconfigure ──

export function configureAll(port?: number): ConfigureResult[] {
  const proxyUrl = `http://localhost:${port || getPort()}`;
  const results: ConfigureResult[] = [];

  if (commandExists('claude')) results.push(configureClaudeCode(proxyUrl));
  if (commandExists('opencode')) results.push(configureOpenCode(proxyUrl));
  if (commandExists('openclaw')) results.push(configureOpenClaw(proxyUrl));

  if (results.length === 0) {
    results.push({
      agent: 'none',
      success: false,
      message: 'No supported agents detected. Install Claude Code, OpenCode, or OpenClaw first.',
    });
  }

  return results;
}

export function unconfigureAll(): ConfigureResult[] {
  const results: ConfigureResult[] = [];
  results.push(unconfigureClaudeCode());
  results.push(unconfigureOpenCode());
  results.push(unconfigureOpenClaw());
  return results;
}

// ── Print helpers ──

export function printSetupInstructions(agents: AgentInfo[]): void {
  const detected = agents.filter(a => a.detected);
  if (detected.length === 0) {
    console.log('  No known AI agents detected.');
    return;
  }

  for (const agent of detected) {
    const status = agent.configured ? '✅ configured' : '⚠️  not configured';
    console.log(`  📌 ${agent.name} (${status})`);
    if (agent.currentBaseUrl) {
      console.log(`     Current base URL: ${agent.currentBaseUrl}`);
    }
    if (!agent.configured) {
      console.log('');
      for (const line of agent.instructions.split('\n')) {
        console.log(`     ${line}`);
      }
    }
    console.log('');
  }
}
