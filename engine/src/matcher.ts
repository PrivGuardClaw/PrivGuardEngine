import type { Rule, Candidate } from './types.js';
import { getValidator } from './validators.js';

/**
 * Matcher: takes text + rules, outputs candidates.
 * Handles confidence levels, validation, context_hint, skip_values, capture_group.
 */
export function match(text: string, rules: Rule[]): Candidate[] {
  const candidates: Candidate[] = [];

  for (const rule of rules) {
    // Low confidence: only match when context_hint is present
    if (rule.confidence === 'low' && rule.context_hint) {
      const hintRe = new RegExp(rule.context_hint, 'i');
      if (!hintRe.test(text)) continue;
    }

    // Handle inline flags like (?i) — JS RegExp doesn't support them,
    // so we extract them and pass as RegExp flags
    let pattern = rule.pattern;
    let extraFlags = '';
    const inlineFlagMatch = pattern.match(/^\(\?([gimsuy]+)\)/);
    if (inlineFlagMatch) {
      extraFlags = inlineFlagMatch[1];
      pattern = pattern.slice(inlineFlagMatch[0].length);
    }

    let flags = 'g' + (rule.multiline ? 'ms' : 'm');
    if (extraFlags.includes('i')) flags += 'i';

    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      // Invalid regex in rule — skip silently
      continue;
    }

    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // Determine which value to extract
      const captureIdx = rule.capture_group ?? 1;
      const value = m[captureIdx] ?? m[0];

      // skip_values check
      if (rule.skip_values?.includes(value)) continue;

      // Skip EMAIL matches that are inside a URL password position
      // e.g. postgres://admin:SuperSecret123@db.prod.internal
      if (rule.type === 'EMAIL') {
        const before = text.substring(Math.max(0, m.index - 200), m.index);
        if (/:[/][/][^@]*:$/.test(before)) continue;
      }

      // Validation check
      if (rule.validate) {
        const validator = getValidator(rule.validate);
        if (validator && !validator(value)) continue;
      }

      // Calculate position of the captured value in original text
      let start: number;
      let end: number;
      if (rule.capture_group != null && m[rule.capture_group] != null) {
        // Find the start of the specific capture group
        start = findCaptureStart(m, rule.capture_group);
        end = start + value.length;
      } else if (m[1] != null) {
        start = findCaptureStart(m, 1);
        end = start + value.length;
      } else {
        start = m.index;
        end = start + m[0].length;
      }

      candidates.push({
        type: rule.type,
        value,
        start,
        end,
        confidence: rule.confidence,
        ruleId: `${rule.type}:${rule.name}`,
      });
    }
  }

  // Deduplicate: same value + same type at same position
  return dedup(candidates);
}

/**
 * Find the start index of a capture group within the full match.
 * RegExp doesn't give us group positions directly, so we search
 * for the captured string within the full match.
 */
function findCaptureStart(m: RegExpExecArray, groupIdx: number): number {
  const fullMatch = m[0];
  const captured = m[groupIdx];
  if (!captured) return m.index;

  const offset = fullMatch.indexOf(captured);
  return m.index + (offset >= 0 ? offset : 0);
}

/** Remove duplicate candidates (same type + value + position) */
function dedup(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.type}|${c.value}|${c.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
