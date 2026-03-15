#!/usr/bin/env node
/**
 * PrivGuard CLI — single-file entry point for skill integration.
 *
 * Usage:
 *   node privguard.js sanitize --input "text with PII"
 *   node privguard.js sanitize --file input.txt
 *   node privguard.js restore  --input "text with {{PG:...}}" --mappings mappings.json
 *   node privguard.js detect   --input "text with PII"
 *   echo "text" | node privguard.js sanitize --stdin
 *
 * All commands accept --rules-dir to specify custom rules directory.
 * Output is JSON for easy parsing by agents.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PrivGuardEngine } from './engine.js';
import { loadAllRules } from './loader.js';
import type { Rule } from './types.js';

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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function loadRules(rulesDir?: string): Rule[] {
  const dir = rulesDir ?? findRulesDir();
  if (!dir) {
    console.error(JSON.stringify({ error: 'No rules directory found. Use --rules-dir or place rules in .privguard/rules/' }));
    process.exit(1);
  }

  const yamls: string[] = [];
  for (const file of ['zh-CN.yml', 'en-US.yml', 'common.yml', 'custom.yml']) {
    const path = join(dir, file);
    if (existsSync(path)) {
      yamls.push(readFileSync(path, 'utf-8'));
    }
  }

  if (yamls.length === 0) {
    console.error(JSON.stringify({ error: `No rule files found in ${dir}` }));
    process.exit(1);
  }

  return loadAllRules(yamls);
}

function findRulesDir(): string | undefined {
  // Search upward for .privguard/rules/
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.privguard', 'rules');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

async function getInput(): Promise<string> {
  const inputArg = getArg('input');
  if (inputArg) return inputArg;

  const fileArg = getArg('file');
  if (fileArg) return readFileSync(fileArg, 'utf-8');

  if (hasFlag('stdin')) return readStdin();

  // Try stdin if not a TTY
  if (!process.stdin.isTTY) return readStdin();

  console.error(JSON.stringify({ error: 'No input provided. Use --input, --file, or --stdin' }));
  process.exit(1);
}

// ── Commands ──

async function doSanitize() {
  const input = await getInput();
  const rules = loadRules(getArg('rules-dir'));
  const mode = (getArg('mode') as 'auto' | 'confirm') ?? 'auto';

  const engine = new PrivGuardEngine({ mode, rules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize(input);

  const output = {
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
  };

  console.log(JSON.stringify(output, null, 2));
}

async function doRestore() {
  const input = await getInput();
  const mappingsFile = getArg('mappings');
  if (!mappingsFile) {
    console.error(JSON.stringify({ error: 'restore requires --mappings <file.json>' }));
    process.exit(1);
  }

  const mappingsData = JSON.parse(readFileSync(mappingsFile, 'utf-8'));
  const rules = loadRules(getArg('rules-dir'));
  const engine = new PrivGuardEngine({ mode: 'auto', rules, placeholderPrefix: 'PG' });

  // Rebuild registry from mappings
  for (const m of mappingsData) {
    // We need to sanitize the original values first to rebuild the registry
    await engine.sanitize(m.originalValue);
  }

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

  const output = {
    detected: result.report.totalDetected,
    items: result.report.items.map(i => ({
      type: i.type,
      masked: i.masked,
      action: i.action,
    })),
    types: result.report.types,
    summary: engine.formatReport(result.report),
  };

  console.log(JSON.stringify(output, null, 2));
}

// ── Diff generation ──

interface MappingEntry { placeholder: string; type: string; originalValue: string }

function generateDiff(original: string, sanitized: string, mappings: MappingEntry[]): string {
  if (mappings.length === 0) return '';

  const lines: string[] = ['--- original', '+++ sanitized'];
  // Simple line-by-line diff
  const origLines = original.split('\n');
  const sanLines = sanitized.split('\n');
  const maxLines = Math.max(origLines.length, sanLines.length);

  for (let i = 0; i < maxLines; i++) {
    const orig = origLines[i] ?? '';
    const san = sanLines[i] ?? '';
    if (orig !== san) {
      lines.push(`- ${orig}`);
      lines.push(`+ ${san}`);
    }
  }

  return lines.join('\n');
}

// ── Main ──

function printUsage() {
  console.log(`PrivGuard Engine CLI

Usage:
  privguard sanitize  --input <text> | --file <path> | --stdin
  privguard detect    --input <text> | --file <path> | --stdin
  privguard restore   --input <text> --mappings <file.json>

Options:
  --rules-dir <path>   Path to rules directory (default: .privguard/rules/)
  --mode <auto|confirm> Engine mode (default: auto)
  --input <text>       Input text directly
  --file <path>        Read input from file
  --stdin              Read input from stdin

Output: JSON`);
}

switch (command) {
  case 'sanitize':
    doSanitize().catch(e => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); });
    break;
  case 'restore':
    doRestore().catch(e => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); });
    break;
  case 'detect':
    doDetect().catch(e => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); });
    break;
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
