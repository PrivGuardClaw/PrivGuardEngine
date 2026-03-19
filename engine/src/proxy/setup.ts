/**
 * One-click setup: install skills + configure proxy for all detected agents.
 *
 * What it does:
 * 1. Detect installed agents (Claude Code, OpenCode, OpenClaw)
 * 2. Install skill files (AGENTS.md, CLAUDE.md, rules) into the current project
 * 3. Configure each agent's base URL to point at the PrivGuard proxy
 * 4. Start the proxy
 *
 * The user runs: npx -y @privguard/engine setup
 * And everything is set up automatically.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureAll, unconfigureAll, detectAgents, getPort, type ConfigureResult } from './config.js';
import { checkbox } from './interactive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ANSI = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

export interface SetupOptions {
  /** Project root directory (default: cwd) */
  projectDir?: string;
  /** Port for the proxy (default: 19820) */
  port?: number;
  /** Skip skill installation */
  skipSkills?: boolean;
  /** Skip agent configuration */
  skipConfigure?: boolean;
}

export interface SetupResult {
  skillsInstalled: boolean;
  agentResults: ConfigureResult[];
  rulesDir: string;
}

export function setup(options: SetupOptions = {}): SetupResult {
  const projectDir = options.projectDir || process.cwd();
  const port = options.port || getPort();

  console.log('');
  console.log(`${ANSI.bold}${ANSI.green}🛡️  PrivGuard — One-Click Setup${ANSI.reset}`);
  console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);

  // Step 1: Install skill files
  let skillsInstalled = false;
  if (!options.skipSkills) {
    console.log(`\n${ANSI.bold}Step 1: Installing skill files${ANSI.reset}`);
    skillsInstalled = installSkills(projectDir);
  }

  // Step 2: Configure agents
  let agentResults: ConfigureResult[] = [];
  if (!options.skipConfigure) {
    console.log(`\n${ANSI.bold}Step 2: Configuring agents${ANSI.reset}`);
    const agents = detectAgents();
    const detected = agents.filter(a => a.detected);

    if (detected.length === 0) {
      console.log(`  ${ANSI.yellow}No supported agents detected.${ANSI.reset}`);
      console.log(`  ${ANSI.dim}Install Claude Code, OpenCode, or OpenClaw first.${ANSI.reset}`);
    } else {
      agentResults = configureAll(port);
      for (const r of agentResults) {
        const icon = r.success ? `${ANSI.green}✅` : `${ANSI.red}✗`;
        console.log(`  ${icon} ${r.agent}${ANSI.reset}: ${r.message}`);
        if (r.backupPath) {
          console.log(`     ${ANSI.dim}Backup: ${r.backupPath}${ANSI.reset}`);
        }
      }
    }
  }

  // Step 3: Summary
  const rulesDir = join(projectDir, '.privguard', 'rules');
  console.log(`\n${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.green}✅ Setup complete!${ANSI.reset}\n`);
  console.log(`  ${ANSI.cyan}Proxy port:${ANSI.reset}  ${port}`);
  console.log(`  ${ANSI.cyan}Rules dir:${ANSI.reset}   ${rulesDir}`);
  console.log(`  ${ANSI.cyan}Custom rules:${ANSI.reset} ${join(rulesDir, 'custom.yml')}`);
  console.log('');
  console.log(`  ${ANSI.bold}Next step:${ANSI.reset} Run ${ANSI.cyan}privguard start${ANSI.reset} to start the proxy.`);
  console.log(`  ${ANSI.bold}Undo:${ANSI.reset}      Run ${ANSI.cyan}privguard teardown${ANSI.reset} to remove all configs.\n`);

  return { skillsInstalled, agentResults, rulesDir };
}

export function teardown(): void {
  console.log('');
  console.log(`${ANSI.bold}${ANSI.yellow}🛡️  PrivGuard — Teardown${ANSI.reset}`);
  console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}\n`);

  const results = unconfigureAll();
  for (const r of results) {
    const icon = r.success ? `${ANSI.green}✅` : `${ANSI.red}✗`;
    console.log(`  ${icon} ${r.agent}${ANSI.reset}: ${r.message}`);
  }

  console.log(`\n  ${ANSI.dim}Skill files in your project (.privguard/, AGENTS.md) were not removed.${ANSI.reset}`);
  console.log(`  ${ANSI.dim}Delete them manually if you no longer need PrivGuard.${ANSI.reset}`);
  console.log(`  ${ANSI.dim}To fully uninstall: run ${ANSI.reset}${ANSI.cyan}privguard uninstall${ANSI.reset}\n`);
}

export async function uninstall(projectDir: string = process.cwd()): Promise<void> {
  console.log('');
  console.log(`${ANSI.bold}${ANSI.red}🛡️  PrivGuard — Uninstall${ANSI.reset}`);
  console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}\n`);

  const privguardDir = join(projectDir, '.privguard');

  const items = [
    {
      label: 'Remove agent proxy configurations',
      hint: '(Claude Code / OpenCode / OpenClaw)',
      checked: true,
    },
    {
      label: 'Delete .privguard/ directory',
      hint: existsSync(privguardDir) ? '(rules, settings)' : '(not found, will skip)',
      checked: true,
    },
    {
      label: 'Uninstall npm package',
      hint: '(runs: npm uninstall -g @privguard/engine)',
      checked: false,
    },
  ];

  const selected = await checkbox('Select what to remove:', items);

  if (selected === null || selected.length === 0) {
    console.log('\n  Cancelled. Nothing was removed.\n');
    return;
  }

  console.log('');

  if (selected.includes(0)) {
    console.log(`${ANSI.bold}Removing agent configurations${ANSI.reset}`);
    const results = unconfigureAll();
    for (const r of results) {
      const icon = r.success ? `${ANSI.green}✅` : `${ANSI.red}✗`;
      console.log(`  ${icon} ${r.agent}${ANSI.reset}: ${r.message}`);
    }
    console.log('');
  }

  if (selected.includes(1)) {
    console.log(`${ANSI.bold}Deleting local files${ANSI.reset}`);
    removeIfExists(privguardDir);
    console.log('');
  }

  if (selected.includes(2)) {
    console.log(`${ANSI.bold}Uninstalling npm package${ANSI.reset}`);
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync('npm', ['uninstall', '-g', '@privguard/engine'], { stdio: 'inherit' });
    if (result.status === 0) {
      console.log(`\n  ${ANSI.green}✅${ANSI.reset} @privguard/engine uninstalled.\n`);
    } else {
      console.log(`\n  ${ANSI.red}✗${ANSI.reset} npm uninstall failed. Run manually:\n`);
      console.log(`  ${ANSI.cyan}npm uninstall -g @privguard/engine${ANSI.reset}\n`);
    }
  } else {
    console.log(`${ANSI.dim}To remove the CLI: npm uninstall -g @privguard/engine${ANSI.reset}\n`);
  }
}

function removeIfExists(targetPath: string): void {
  if (!existsSync(targetPath)) {
    console.log(`  ${ANSI.dim}— ${targetPath} (not found, skipped)${ANSI.reset}`);
    return;
  }
  try {
    rmSync(targetPath, { recursive: true, force: true });
    console.log(`  ${ANSI.green}✅${ANSI.reset} Removed: ${targetPath}`);
  } catch (err: any) {
    console.log(`  ${ANSI.red}✗${ANSI.reset} Failed to remove ${targetPath}: ${err.message}`);
  }
}

// ── Skill Installation ──

function installSkills(projectDir: string): boolean {
  try {
    const rulesDir = join(projectDir, '.privguard', 'rules');
    mkdirSync(rulesDir, { recursive: true });

    // Find bundled rules (relative to this module)
    const bundledRulesDir = findBundledRules();

    if (bundledRulesDir) {
      // Copy rule files
      for (const file of ['zh-CN.yml', 'en-US.yml', 'common.yml']) {
        const src = join(bundledRulesDir, file);
        const dst = join(rulesDir, file);
        if (existsSync(src)) {
          copyFileSync(src, dst);
          console.log(`  ${ANSI.green}✅${ANSI.reset} ${file} → .privguard/rules/`);
        }
      }

      // custom.yml: only create if not exists
      const customSrc = join(bundledRulesDir, 'custom.yml');
      const customDst = join(rulesDir, 'custom.yml');
      if (!existsSync(customDst) && existsSync(customSrc)) {
        copyFileSync(customSrc, customDst);
        console.log(`  ${ANSI.green}✅${ANSI.reset} custom.yml → .privguard/rules/ (template)`);
      } else if (existsSync(customDst)) {
        console.log(`  ${ANSI.yellow}⚠️${ANSI.reset}  custom.yml already exists, preserved.`);
      }
    } else {
      console.log(`  ${ANSI.yellow}⚠️${ANSI.reset}  Bundled rules not found, creating minimal rules.`);
      createMinimalRules(rulesDir);
    }

    // Install AGENTS.md (universal skill file)
    installAgentsMd(projectDir);

    // Install CLAUDE.md (Claude Code specific)
    installClaudeMd(projectDir);

    return true;
  } catch (err: any) {
    console.log(`  ${ANSI.red}✗${ANSI.reset} Failed to install skills: ${err.message}`);
    return false;
  }
}

function findBundledRules(): string | undefined {
  // Check multiple possible locations
  const candidates = [
    resolve(__dirname, '..', '..', 'rules'),       // dist/../rules (npm package)
    resolve(__dirname, '..', 'rules'),              // dist/rules
    resolve(__dirname, '..', '..', '..', 'rules'),  // development
  ];
  return candidates.find(p => existsSync(join(p, 'common.yml')));
}

function createMinimalRules(rulesDir: string): void {
  const commonYml = `# PrivGuard Common Rules (minimal)
rules:
  - type: EMAIL
    name: Email Address
    pattern: '([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})'
    confidence: high

  - type: API_KEY
    name: API Key / Secret Key
    pattern: '(?i)((?:sk|ak|key|token|secret|password|api[_-]?key)[-_][a-zA-Z0-9_-]{20,})'
    confidence: high

  - type: JWT
    name: JSON Web Token
    pattern: '(eyJ[a-zA-Z0-9_-]{10,}\\.eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,})'
    confidence: high
`;
  writeFileSync(join(rulesDir, 'common.yml'), commonYml, 'utf-8');
  console.log(`  ${ANSI.green}✅${ANSI.reset} common.yml (minimal) → .privguard/rules/`);
}

function installAgentsMd(projectDir: string): void {
  const dst = join(projectDir, 'AGENTS.md');
  if (existsSync(dst)) {
    // Check if it already has PrivGuard section
    const content = readFileSync(dst, 'utf-8');
    if (content.includes('PrivGuard')) {
      console.log(`  ${ANSI.yellow}⚠️${ANSI.reset}  AGENTS.md already contains PrivGuard section, skipped.`);
      return;
    }
    // Append PrivGuard section
    const section = getPrivGuardAgentsSection();
    writeFileSync(dst, content + '\n\n' + section, 'utf-8');
    console.log(`  ${ANSI.green}✅${ANSI.reset} Appended PrivGuard section to existing AGENTS.md`);
  } else {
    writeFileSync(dst, getPrivGuardAgentsSection(), 'utf-8');
    console.log(`  ${ANSI.green}✅${ANSI.reset} AGENTS.md created`);
  }
}

function installClaudeMd(projectDir: string): void {
  const dst = join(projectDir, 'CLAUDE.md');
  if (existsSync(dst)) {
    const content = readFileSync(dst, 'utf-8');
    if (content.includes('PrivGuard')) {
      console.log(`  ${ANSI.yellow}⚠️${ANSI.reset}  CLAUDE.md already contains PrivGuard section, skipped.`);
      return;
    }
    const section = '\n\n## PrivGuard\n\nSee `AGENTS.md` for PrivGuard sensitive information sanitization procedures.\n';
    writeFileSync(dst, content + section, 'utf-8');
    console.log(`  ${ANSI.green}✅${ANSI.reset} Appended PrivGuard reference to existing CLAUDE.md`);
  } else {
    const content = `# Project Instructions\n\nSee \`AGENTS.md\` for complete project conventions and the PrivGuard skill.\n\n## PrivGuard\n\nWhen processing any text that might contain PII, follow the PrivGuard procedure in AGENTS.md.\nRule definitions are in \`.privguard/rules/*.yml\`.\n`;
    writeFileSync(dst, content, 'utf-8');
    console.log(`  ${ANSI.green}✅${ANSI.reset} CLAUDE.md created`);
  }
}

function getPrivGuardAgentsSection(): string {
  return `# PrivGuard — Sensitive Information Sanitizer

> When any text you process might contain sensitive information (PII, secrets, credentials),
> follow the procedures below to sanitize before external transmission and restore after.

## Activation Triggers

Apply PrivGuard procedures when ANY of these conditions are true:
- Text contains patterns matching rules in \`.privguard/rules/*.yml\`
- User mentions: 脱敏, sanitize, redact, protect, privacy, 隐私
- Task involves sending data to external APIs, LLMs, or services
- Processing files that might contain PII (config files, logs, databases, CSVs)

## Procedure

### Step 1: Load Rules
Read all \`.yml\` files from \`.privguard/rules/\` directory.

### Step 2: Scan
Apply each rule's regex pattern to the text. For rules with \`validate\` field,
perform additional validation (Luhn, checksum, etc.).

### Step 3: Replace
Replace each detected entity with \`<|PG:TYPE_N|>\` placeholder:
- Same value → same placeholder (idempotent)
- Different values of same type → increment N

### Step 4: Process
Use sanitized text for all external operations. The mapping table exists only in working memory.

### Step 5: Restore
In final output to user, replace all placeholders back to original values.
Exception: code blocks — use environment variables instead.

### Step 6: Report
Inform the user: "🛡️ PrivGuard: detected N sensitive items, sanitized during processing."

## Constraints

1. NEVER send original sensitive values to external services
2. Mapping table MUST only exist in local memory
3. ALWAYS restore placeholders in final output (except code blocks)
4. Use \`<|PG:TYPE_N|>\` format, not \`[REDACTED]\` or \`{{...}}\`
5. When uncertain, err on the side of sanitizing
6. NEVER overwrite \`.privguard/rules/custom.yml\` during upgrades
`;
}
