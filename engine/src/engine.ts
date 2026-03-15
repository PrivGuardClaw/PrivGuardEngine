import type {
  Rule,
  EngineConfig,
  EngineMode,
  SanitizeResult,
  RestoreResult,
  SanitizeReport,
  SanitizeReportItem,
  OnConfirmRequest,
  Decision,
  DecisionAction,
} from './types.js';
import { match } from './matcher.js';
import { Registry } from './registry.js';
import { Resolver } from './resolver.js';

/**
 * PrivGuard Engine
 *
 * Zero-dependency PII detection and sanitization engine.
 * Designed to be embedded in any shell: CLI, Kiro hook, MCP server,
 * browser extension, VS Code extension, etc.
 *
 * Usage:
 *   const engine = new PrivGuardEngine({ mode: 'auto', rules });
 *   const { sanitized } = await engine.sanitize(text);
 *   // ... send sanitized text to LLM ...
 *   const { restored } = engine.restore(llmOutput);
 */
export class PrivGuardEngine {
  private rules: Rule[];
  private registry: Registry;
  private resolver: Resolver;

  constructor(config: EngineConfig) {
    this.rules = config.rules;
    this.registry = new Registry(config.placeholderPrefix ?? 'PG');
    this.resolver = new Resolver(config.mode, config.decisions);
  }

  // ── Configuration ──

  /** Switch between auto and confirm mode at runtime */
  setMode(mode: EngineMode): void {
    this.resolver.setMode(mode);
  }

  /** Register a callback for confirm mode — UI layer implements this */
  onConfirm(fn: OnConfirmRequest): void {
    this.resolver.setOnConfirm(fn);
  }

  /** Add rules at runtime (e.g., user adds custom rules) */
  addRules(rules: Rule[]): void {
    this.rules.push(...rules);
  }

  /** Replace all rules */
  setRules(rules: Rule[]): void {
    this.rules = rules;
  }

  /** Manually add a decision (e.g., loaded from persisted decisions file) */
  addDecision(value: string, action: DecisionAction, type: string, overrideType?: string): void {
    this.resolver.addDecision(value, action, type, overrideType);
  }

  // ── Core: Sanitize ──

  async sanitize(text: string): Promise<SanitizeResult> {
    // Step 1-2: Match
    const candidates = match(text, this.rules);

    if (candidates.length === 0) {
      return {
        sanitized: text,
        mappings: [],
        report: emptyReport(),
      };
    }

    // Step 3: Resolve (auto or confirm)
    const { toSanitize, toSkip } = await this.resolver.resolve(candidates);

    // Step 4: Replace — remove overlapping candidates, then process end-to-start
    const deduped = removeOverlapping(toSanitize);
    const sorted = deduped.sort((a, b) => b.start - a.start);
    let result = text;
    const reportItems: SanitizeReportItem[] = [];

    for (const c of sorted) {
      const placeholder = this.registry.getOrCreate(c.type, c.value);
      result = result.slice(0, c.start) + placeholder + result.slice(c.end);

      reportItems.push({
        type: c.type,
        placeholder,
        masked: maskValue(c.value),
        action: 'sanitize',
      });
    }

    // Add skipped items to report
    for (const c of toSkip) {
      reportItems.push({
        type: c.type,
        placeholder: '',
        masked: maskValue(c.value),
        action: 'skip',
      });
    }

    const types = [...new Set(toSanitize.map((c) => c.type))];

    return {
      sanitized: result,
      mappings: this.registry.entries(),
      report: {
        totalDetected: candidates.length,
        totalSanitized: toSanitize.length,
        totalSkipped: toSkip.length,
        types,
        items: reportItems,
      },
    };
  }

  // ── Core: Restore ──

  restore(text: string): RestoreResult {
    let restored = text;
    let codeBlocksPreserved = 0;

    // Find code blocks to protect them
    const codeBlocks = findCodeBlocks(text);

    // Find all placeholders
    const placeholderRe = /\{\{PG:[A-Z_]+_\d+\}\}/g;
    // Also support custom prefix
    const entries = this.registry.entries();
    if (entries.length === 0) {
      return { restored: text, codeBlocksPreserved: 0 };
    }

    // Build a general placeholder regex from registry prefix
    const prefix = entries[0]?.placeholder.match(/\{\{(\w+):/)?.[1] ?? 'PG';
    const re = new RegExp(`\\{\\{${prefix}:[A-Z0-9_]+_\\d+\\}\\}`, 'g');

    let m: RegExpExecArray | null;
    const replacements: Array<{ start: number; end: number; placeholder: string; original: string; inCode: boolean }> = [];

    while ((m = re.exec(restored)) !== null) {
      const placeholder = m[0];
      const original = this.registry.resolve(placeholder);
      if (!original) continue;

      const inCode = codeBlocks.some((b) => m!.index >= b.start && m!.index < b.end);

      replacements.push({
        start: m.index,
        end: m.index + placeholder.length,
        placeholder,
        original,
        inCode,
      });
    }

    // Replace from end to start
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      if (r.inCode) {
        codeBlocksPreserved++;
        continue; // Don't restore inside code blocks
      }
      restored = restored.slice(0, r.start) + r.original + restored.slice(r.end);
    }

    return { restored, codeBlocksPreserved };
  }

  // ── Utilities ──

  /** Get the formatted report string */
  formatReport(report: SanitizeReport): string {
    if (report.totalDetected === 0) return '';
    return `🛡️ PrivGuard: detected ${report.totalDetected} sensitive item(s) (types: ${report.types.join(', ')}), sanitized ${report.totalSanitized} during processing.`;
  }

  /** Export decisions for persistence */
  exportDecisions(): Decision[] {
    return this.resolver.exportDecisions();
  }

  /** Get current registry entries */
  getMappings() {
    return this.registry.entries();
  }

  /** Reset session (clear mappings, keep rules and decisions) */
  resetSession(): void {
    this.registry.clear();
  }
}

// ── Helpers ──

function emptyReport(): SanitizeReport {
  return { totalDetected: 0, totalSanitized: 0, totalSkipped: 0, types: [], items: [] };
}

/**
 * Remove overlapping candidates — when multiple rules match the same text region,
 * keep the one with highest confidence, or the longest match.
 */
function removeOverlapping(candidates: Array<{ type: string; value: string; start: number; end: number; confidence: string }>): typeof candidates {
  if (candidates.length <= 1) return candidates;

  // Sort by start position, then by length descending
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const result: typeof candidates = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];

    if (curr.start < prev.end) {
      // Overlapping — keep the one with higher confidence or longer match
      const confOrder = { high: 3, medium: 2, low: 1 };
      const prevConf = confOrder[prev.confidence as keyof typeof confOrder] ?? 0;
      const currConf = confOrder[curr.confidence as keyof typeof confOrder] ?? 0;
      if (currConf > prevConf || (currConf === prevConf && (curr.end - curr.start) > (prev.end - prev.start))) {
        result[result.length - 1] = curr;
      }
      // Otherwise keep prev (already in result)
    } else {
      result.push(curr);
    }
  }

  return result;
}

/** Mask a value for display: "13812345678" → "138****5678" */
function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  if (value.length <= 8) return value.slice(0, 2) + '****' + value.slice(-2);
  const showLen = Math.min(3, Math.floor(value.length / 4));
  return value.slice(0, showLen) + '****' + value.slice(-showLen);
}

/** Find code block ranges (``` ... ```) in text */
function findCodeBlocks(text: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const re = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length });
  }
  // Also handle inline code
  const inlineRe = /`[^`]+`/g;
  while ((m = inlineRe.exec(text)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}
