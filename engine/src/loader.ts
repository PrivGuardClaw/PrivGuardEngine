import type { Rule, RuleSet } from './types.js';
import { parseYaml } from './yaml-lite.js';

/**
 * Load rules from YAML text content.
 * Works in any environment — just pass the file content as string.
 * The caller is responsible for reading the file (fs, fetch, etc.).
 */
export function loadRulesFromYaml(yamlText: string): Rule[] {
  const parsed = parseYaml(yamlText) as RuleSet | null;
  if (!parsed?.rules || !Array.isArray(parsed.rules)) return [];

  return parsed.rules
    .filter((r): r is Rule => !!r && typeof r === 'object' && 'type' in r && 'pattern' in r)
    .map((r) => ({
      type: String(r.type),
      name: String(r.name ?? r.type),
      pattern: String(r.pattern),
      confidence: validateConfidence(r.confidence),
      ...(r.validate && { validate: String(r.validate) }),
      ...(r.context_hint && { context_hint: String(r.context_hint) }),
      ...(r.skip_values && { skip_values: toStringArray(r.skip_values) }),
      ...(r.capture_group != null && { capture_group: Number(r.capture_group) }),
      ...(r.multiline && { multiline: Boolean(r.multiline) }),
      ...(r.examples && { examples: r.examples }),
    }));
}

/**
 * Load rules from multiple YAML texts.
 * Convenience for loading zh-CN + en-US + common + custom at once.
 */
export function loadAllRules(yamlTexts: string[]): Rule[] {
  return yamlTexts.flatMap(loadRulesFromYaml);
}

function validateConfidence(v: unknown): 'high' | 'medium' | 'low' {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return [v];
  return [];
}
