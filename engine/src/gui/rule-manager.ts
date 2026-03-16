import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadRulesFromYaml } from '../loader.js';
import type { Rule } from '../types.js';
import type { RuleLoadResult, RuleChangeLog } from './types.js';

const SYSTEM_FILES = ['zh-CN.yml', 'en-US.yml', 'common.yml'];
const CUSTOM_FILE = 'custom.yml';
const MAX_CHANGE_LOGS = 100;

export class RuleManager {
  private rulesDir: string;
  private changeLogs: RuleChangeLog[] = [];
  onReload?: (rules: Rule[]) => void;

  constructor(rulesDir: string) {
    this.rulesDir = rulesDir;
  }

  loadAll(): RuleLoadResult {
    const system: Rule[] = [];
    for (const file of SYSTEM_FILES) {
      const path = join(this.rulesDir, file);
      if (existsSync(path)) {
        try {
          system.push(...loadRulesFromYaml(readFileSync(path, 'utf-8')));
        } catch {
          // skip unreadable files
        }
      }
    }

    const customPath = join(this.rulesDir, CUSTOM_FILE);
    let custom: Rule[] = [];
    if (existsSync(customPath)) {
      try {
        custom = loadRulesFromYaml(readFileSync(customPath, 'utf-8'));
      } catch {
        custom = [];
      }
    }

    return { system, custom };
  }

  saveCustomRules(rules: Rule[]): void {
    const path = join(this.rulesDir, CUSTOM_FILE);
    const yaml = serializeRulesToYaml(rules);
    writeFileSync(path, yaml, 'utf-8');
    if (this.onReload) {
      const { system, custom } = this.loadAll();
      this.onReload([...system, ...custom]);
    }
  }

  addCustomRule(rule: Rule): void {
    const { custom } = this.loadAll();
    custom.push(rule);
    this.saveCustomRules(custom);
    this.logChange('add', rule);
  }

  updateCustomRule(index: number, rule: Rule): void {
    const { custom } = this.loadAll();
    if (index < 0 || index >= custom.length) {
      throw new Error(`Rule index ${index} out of bounds`);
    }
    const old = custom[index];
    custom[index] = rule;
    this.saveCustomRules(custom);
    this.logChange('update', old);
  }

  deleteCustomRule(index: number): void {
    const { custom } = this.loadAll();
    if (index < 0 || index >= custom.length) {
      throw new Error(`Rule index ${index} out of bounds`);
    }
    const [removed] = custom.splice(index, 1);
    this.saveCustomRules(custom);
    this.logChange('delete', removed);
  }

  validatePattern(pattern: string): { valid: boolean; error?: string } {
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }

  testRule(pattern: string, text: string): string[] {
    try {
      const re = new RegExp(pattern, 'g');
      return Array.from(text.matchAll(re), m => m[0]);
    } catch {
      return [];
    }
  }

  getChangeLogs(): RuleChangeLog[] {
    return [...this.changeLogs];
  }

  private logChange(action: RuleChangeLog['action'], rule: Rule): void {
    this.changeLogs.unshift({
      timestamp: Date.now(),
      action,
      ruleName: rule.name,
      ruleType: rule.type,
    });
    if (this.changeLogs.length > MAX_CHANGE_LOGS) {
      this.changeLogs = this.changeLogs.slice(0, MAX_CHANGE_LOGS);
    }
  }
}

/** Serialize rules array to YAML string */
export function serializeRulesToYaml(rules: Rule[]): string {
  if (rules.length === 0) return 'rules: []\n';

  const lines: string[] = ['rules:'];
  for (const rule of rules) {
    lines.push(`  - type: ${rule.type}`);
    lines.push(`    name: ${quoteYaml(rule.name)}`);
    lines.push(`    pattern: '${rule.pattern.replace(/'/g, "''")}'`);
    lines.push(`    confidence: ${rule.confidence}`);
    if (rule.validate) lines.push(`    validate: ${rule.validate}`);
    if (rule.context_hint) lines.push(`    context_hint: '${rule.context_hint.replace(/'/g, "''")}'`);
    if (rule.skip_values?.length) {
      lines.push(`    skip_values: [${rule.skip_values.map(v => `'${v}'`).join(', ')}]`);
    }
    if (rule.capture_group != null) lines.push(`    capture_group: ${rule.capture_group}`);
    if (rule.multiline) lines.push(`    multiline: true`);
  }
  return lines.join('\n') + '\n';
}

function quoteYaml(s: string): string {
  // Quote if contains special chars
  if (/[:#\[\]{},&*?|<>=!%@`]/.test(s) || s.includes("'") || s.includes('"')) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
