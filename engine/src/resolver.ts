import type { Candidate, Decision, DecisionAction, EngineMode, ConfirmRequest } from './types.js';

/**
 * Resolver: decides what to do with each candidate.
 * In auto mode, everything gets sanitized.
 * In confirm mode, new values trigger a callback for user confirmation.
 */
export class Resolver {
  private mode: EngineMode;
  private decisions = new Map<string, Decision>();  // value → decision
  private onConfirm?: (req: ConfirmRequest) => void;

  constructor(mode: EngineMode, preloaded?: Decision[]) {
    this.mode = mode;
    if (preloaded) {
      for (const d of preloaded) {
        this.decisions.set(d.value, d);
      }
    }
  }

  setMode(mode: EngineMode): void {
    this.mode = mode;
  }

  setOnConfirm(fn: (req: ConfirmRequest) => void): void {
    this.onConfirm = fn;
  }

  /**
   * Resolve a batch of candidates.
   * Returns only the candidates that should be sanitized.
   * May call onConfirm callback for new values in confirm mode.
   */
  async resolve(candidates: Candidate[]): Promise<{ toSanitize: Candidate[]; toSkip: Candidate[] }> {
    const toSanitize: Candidate[] = [];
    const toSkip: Candidate[] = [];
    const needConfirm: Candidate[] = [];

    for (const c of candidates) {
      const existing = this.decisions.get(c.value);

      if (existing) {
        // Already decided
        if (existing.action === 'sanitize') {
          // Apply type override if user changed it
          if (existing.userOverrideType) {
            toSanitize.push({ ...c, type: existing.userOverrideType });
          } else {
            toSanitize.push(c);
          }
        } else {
          toSkip.push(c);
        }
        continue;
      }

      if (this.mode === 'auto') {
        // Auto mode: sanitize everything, record decision
        this.decisions.set(c.value, {
          value: c.value,
          type: c.type,
          action: 'sanitize',
          timestamp: Date.now(),
        });
        toSanitize.push(c);
      } else {
        // Confirm mode: collect for user confirmation
        needConfirm.push(c);
      }
    }

    // If there are candidates needing confirmation, ask the user
    if (needConfirm.length > 0 && this.onConfirm) {
      const userDecisions = await new Promise<Decision[]>((resolve) => {
        this.onConfirm!({ candidates: needConfirm, resolve });
      });

      for (const d of userDecisions) {
        this.decisions.set(d.value, d);
        const candidate = needConfirm.find((c) => c.value === d.value);
        if (!candidate) continue;

        if (d.action === 'sanitize') {
          if (d.userOverrideType) {
            toSanitize.push({ ...candidate, type: d.userOverrideType });
          } else {
            toSanitize.push(candidate);
          }
        } else {
          toSkip.push(candidate);
        }
      }
    } else if (needConfirm.length > 0 && !this.onConfirm) {
      // No confirm handler — default to sanitize
      for (const c of needConfirm) {
        this.decisions.set(c.value, {
          value: c.value,
          type: c.type,
          action: 'sanitize',
          timestamp: Date.now(),
        });
        toSanitize.push(c);
      }
    }

    return { toSanitize, toSkip };
  }

  /** Export all decisions (for persistence) */
  exportDecisions(): Decision[] {
    return Array.from(this.decisions.values());
  }

  /** Manually add a decision */
  addDecision(value: string, action: DecisionAction, type: string, overrideType?: string): void {
    this.decisions.set(value, {
      value,
      type,
      action,
      userOverrideType: overrideType,
      timestamp: Date.now(),
    });
  }
}
