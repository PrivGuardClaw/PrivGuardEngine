#!/usr/bin/env node
/**
 * PrivGuard CLI — single-file entry point for skill integration.
 *
 * Usage:
 *   node privguard.cjs sanitize --input "text with PII"
 *   node privguard.cjs sanitize --file input.txt
 *   node privguard.cjs restore  --input "text with {{PG:...}}" --mappings mappings.json
 *   node privguard.cjs detect   --input "text with PII"
 *   echo "text" | node privguard.cjs sanitize --stdin
 *
 * All commands accept --rules-dir to specify custom rules directory.
 * Output is JSON for easy parsing by agents.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PrivGuardEngine } from './engine.js';
import { loadAllRules } from './loader.js';
import type { Rule, MappingEntry } from './types.js';

const VERSION = '0.3.0';

// ── Parse CLI args ──
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

function exitError(msg: string): never {
  console.error(JSON.stringify({ error: msg }));
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function loadRules(rulesDir?: string): Rule[] {
  const dir = rulesDir ?? findRulesDir();
  if (!dir) exitError('No rules directory found. Use --rules-dir or place rules in .privguard/rules/');

  const yamls: string[] = [];
  for (const file of ['zh-CN.yml', 'en-US.yml', 'common.yml', 'custom.yml']) {
    const path = join(dir, file);
    if (existsSync(path)) yamls.push(readFileSync(path, 'utf-8'));
  }

  if (yamls.length === 0) exitError(`No rule files found in ${dir}`);
  return loadAllRules(yamls);
}

function findRulesDir(): string | undefined {
  // 1. Check --rules-dir (handled by caller)
  // 2. Search upward from cwd for .privguard/rules/
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.privguard', 'rules');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  // 3. Check skill's own references/rules/ (for global skill installs)
  const skillRules = resolve(__dirname, '..', 'references', 'rules');
  if (existsSync(skillRules)) return skillRules;
  return undefined;
}

async function getInput(): Promise<string> {
  const inputArg = getArg('input');
  if (inputArg) return inputArg;

  const fileArg = getArg('file');
  if (fileArg) {
    if (!existsSync(fileArg)) exitError(`File not found: ${fileArg}`);
    return readFileSync(fileArg, 'utf-8');
  }

  if (hasFlag('stdin') || !process.stdin.isTTY) return readStdin();

  exitError('No input provided. Use --input, --file, or pipe via stdin');
}

// ── Commands ──

async function doSanitize() {
  const input = await getInput();
  const rules = loadRules(getArg('rules-dir'));
  const mode = (getArg('mode') as 'auto' | 'confirm') ?? 'auto';

  const engine = new PrivGuardEngine({ mode, rules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize(input);

  const diffs = generateAllDiffs(input, result.sanitized, result.mappings);

  console.log(JSON.stringify({
    sanitized: result.sanitized,
    mappings: result.mappings,
    report: {
      totalDetected: result.report.totalDetected,
      totalSanitized: result.report.totalSanitized,
      types: result.report.types,
      items: result.report.items.map(i => ({
        type: i.type,
        placeholder: i.placeholder,
        masked: i.masked,
        action: i.action,
      })),
    },
    diff: diffs.plain,
    diffAnsi: diffs.ansi,
    diffMarkdown: diffs.markdown,
  }, null, 2));
}

async function doRestore() {
  const input = await getInput();
  const mappingsFile = getArg('mappings');
  if (!mappingsFile) exitError('restore requires --mappings <file.json>');
  if (!existsSync(mappingsFile)) exitError(`Mappings file not found: ${mappingsFile}`);

  const mappingsData: MappingEntry[] = JSON.parse(readFileSync(mappingsFile, 'utf-8'));
  const rules = loadRules(getArg('rules-dir'));
  const engine = new PrivGuardEngine({ mode: 'auto', rules, placeholderPrefix: 'PG' });

  // Directly load mappings into registry (no re-sanitizing needed)
  engine.loadMappings(mappingsData);

  const result = engine.restore(input);
  console.log(JSON.stringify({
    restored: result.restored,
    codeBlocksPreserved: result.codeBlocksPreserved,
  }, null, 2));
}

async function doDetect() {
  const input = await getInput();
  const rules = loadRules(getArg('rules-dir'));
  const engine = new PrivGuardEngine({ mode: 'auto', rules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize(input);

  console.log(JSON.stringify({
    detected: result.report.totalDetected,
    items: result.report.items.map(i => ({
      type: i.type,
      masked: i.masked,
      action: i.action,
    })),
    types: result.report.types,
    summary: engine.formatReport(result.report),
  }, null, 2));
}

// ── ANSI color codes ──
const ANSI = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  strikethrough: '\x1b[9m',
};

// ── Diff generation ──

interface DiffOutput {
  plain: string;
  ansi: string;
  markdown: string;
}

function buildReplacementMap(mappings: MappingEntry[]): Map<string, MappingEntry> {
  const map = new Map<string, MappingEntry>();
  for (const m of mappings) map.set(m.placeholder, m);
  return map;
}

function generateAllDiffs(original: string, sanitized: string, mappings: MappingEntry[]): DiffOutput {
  if (mappings.length === 0) return { plain: '', ansi: '', markdown: '' };

  const phMap = buildReplacementMap(mappings);
  const origLines = original.split('\n');
  const sanLines = sanitized.split('\n');
  const maxLines = Math.max(origLines.length, sanLines.length);

  const plain: string[] = ['--- original', '+++ sanitized', ''];
  const ansi: string[] = [
    `${ANSI.bold}🛡️ PrivGuard Diff${ANSI.reset}`,
    `${ANSI.dim}${'─'.repeat(60)}${ANSI.reset}`,
  ];
  const md: string[] = ['🛡️ **PrivGuard Diff**', '', '```diff'];

  for (let i = 0; i < maxLines; i++) {
    const orig = origLines[i] ?? '';
    const san = sanLines[i] ?? '';
    if (orig === san) continue;

    // Plain
    plain.push(`@@ line ${i + 1} @@`);
    plain.push(`- ${orig}`);
    plain.push(`+ ${san}`);

    // ANSI — inline highlight: color the changed parts within the line
    ansi.push(`${ANSI.dim}@@ line ${i + 1} @@${ANSI.reset}`);
    ansi.push(`${ANSI.red}- ${highlightOriginalAnsi(orig, san, phMap)}${ANSI.reset}`);
    ansi.push(`${ANSI.green}+ ${highlightSanitizedAnsi(san, phMap)}${ANSI.reset}`);

    // Markdown
    md.push(`@@ line ${i + 1} @@`);
    md.push(`- ${orig}`);
    md.push(`+ ${san}`);

    // Inline annotations
    const placeholderRe = /\{\{PG:[A-Z0-9_]+_\d+\}\}/g;
    let pm: RegExpExecArray | null;
    while ((pm = placeholderRe.exec(san)) !== null) {
      const ph = pm[0];
      const entry = phMap.get(ph);
      if (entry) {
        plain.push(`  ^ ${entry.originalValue} → ${ph}`);
        ansi.push(`  ${ANSI.cyan}↳${ANSI.reset} ${ANSI.red}${ANSI.strikethrough}${entry.originalValue}${ANSI.reset} → ${ANSI.green}${ANSI.bold}${ph}${ANSI.reset} ${ANSI.dim}[${entry.type}]${ANSI.reset}`);
      }
    }
  }

  md.push('```', '');

  // Markdown replacement table
  md.push('| 原始值 | 占位符 | 类型 |');
  md.push('|--------|--------|------|');
  for (const m of mappings) {
    md.push(`| ~~${m.originalValue}~~ | \`${m.placeholder}\` | ${m.type} |`);
  }

  // ANSI summary
  ansi.push(`${ANSI.dim}${'─'.repeat(60)}${ANSI.reset}`);
  ansi.push(`${ANSI.bold}${mappings.length} 项替换${ANSI.reset}:`);
  for (const m of mappings) {
    ansi.push(`  ${ANSI.red}${ANSI.strikethrough}${m.originalValue}${ANSI.reset} → ${ANSI.green}${m.placeholder}${ANSI.reset} ${ANSI.dim}[${m.type}]${ANSI.reset}`);
  }

  return {
    plain: plain.join('\n'),
    ansi: ansi.join('\n'),
    markdown: md.join('\n'),
  };
}

/** Highlight original sensitive values in red+bold within the original line */
function highlightOriginalAnsi(origLine: string, sanLine: string, phMap: Map<string, MappingEntry>): string {
  let result = origLine;
  // Find all original values that were replaced, highlight them
  for (const [, entry] of phMap) {
    const val = entry.originalValue;
    if (origLine.includes(val)) {
      result = result.split(val).join(`${ANSI.bold}${ANSI.bgRed} ${val} ${ANSI.reset}${ANSI.red}`);
    }
  }
  return result;
}

/** Highlight placeholders in green+bold within the sanitized line */
function highlightSanitizedAnsi(sanLine: string, phMap: Map<string, MappingEntry>): string {
  let result = sanLine;
  for (const [ph] of phMap) {
    if (sanLine.includes(ph)) {
      result = result.split(ph).join(`${ANSI.bold}${ANSI.bgGreen} ${ph} ${ANSI.reset}${ANSI.green}`);
    }
  }
  return result;
}

// ── Main ──

function printUsage() {
  console.log(JSON.stringify({
    name: 'PrivGuard Engine CLI',
    version: VERSION,
    commands: {
      sanitize: 'Replace PII with placeholders. Returns JSON with sanitized text, mappings, and diff.',
      detect: 'Detect PII without replacing. Returns JSON with detection report.',
      restore: 'Restore placeholders to original values using a mappings file.',
    },
    options: {
      '--rules-dir <path>': 'Path to rules directory (default: .privguard/rules/ or skill references/rules/)',
      '--mode <auto|confirm>': 'Engine mode (default: auto)',
      '--input <text>': 'Input text directly',
      '--file <path>': 'Read input from file',
      '--stdin': 'Read input from stdin',
      '--mappings <file>': 'Mappings JSON file (restore command only)',
      '--version': 'Show version',
    },
  }, null, 2));
}

switch (command) {
  case 'sanitize':
    doSanitize().catch(e => { exitError(String(e)); });
    break;
  case 'restore':
    doRestore().catch(e => { exitError(String(e)); });
    break;
  case 'detect':
    doDetect().catch(e => { exitError(String(e)); });
    break;
  case '--version':
  case 'version':
    console.log(JSON.stringify({ version: VERSION }));
    break;
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
