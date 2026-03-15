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

const VERSION = '0.2.0';

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
    diff: generateDiff(input, result.sanitized, result.mappings),
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

// ── Diff generation (word-level for better readability) ──

function generateDiff(original: string, sanitized: string, mappings: MappingEntry[]): string {
  if (mappings.length === 0) return '';

  const lines: string[] = ['--- original', '+++ sanitized', ''];

  // Build a reverse map: placeholder → originalValue
  const phMap = new Map<string, string>();
  for (const m of mappings) phMap.set(m.placeholder, m.originalValue);

  const origLines = original.split('\n');
  const sanLines = sanitized.split('\n');
  const maxLines = Math.max(origLines.length, sanLines.length);

  for (let i = 0; i < maxLines; i++) {
    const orig = origLines[i] ?? '';
    const san = sanLines[i] ?? '';
    if (orig === san) continue;

    lines.push(`@@ line ${i + 1} @@`);
    lines.push(`- ${orig}`);
    lines.push(`+ ${san}`);

    // Show inline replacements for this line
    const placeholderRe = /\{\{PG:[A-Z0-9_]+_\d+\}\}/g;
    let pm: RegExpExecArray | null;
    while ((pm = placeholderRe.exec(san)) !== null) {
      const ph = pm[0];
      const origVal = phMap.get(ph);
      if (origVal) {
        lines.push(`  ^ ${origVal} → ${ph}`);
      }
    }
  }

  return lines.join('\n');
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
