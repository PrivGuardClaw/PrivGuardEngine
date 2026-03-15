import type { MappingEntry } from './types.js';

/**
 * Registry: bidirectional mapping between original values and placeholders.
 * Session-scoped — create a new instance per session.
 */
export class Registry {
  private prefix: string;
  private forward = new Map<string, MappingEntry>();   // value → entry
  private reverse = new Map<string, MappingEntry>();   // placeholder → entry
  private counters = new Map<string, number>();         // type → count

  constructor(prefix = 'PG') {
    this.prefix = prefix;
  }

  /** Get or create a placeholder for a value */
  getOrCreate(type: string, value: string): string {
    const existing = this.forward.get(value);
    if (existing) return existing.placeholder;

    const count = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, count);

    const placeholder = `{{${this.prefix}:${type}_${count}}}`;
    const entry: MappingEntry = { placeholder, type, originalValue: value };

    this.forward.set(value, entry);
    this.reverse.set(placeholder, entry);

    return placeholder;
  }

  /** Look up original value by placeholder */
  resolve(placeholder: string): string | undefined {
    return this.reverse.get(placeholder)?.originalValue;
  }

  /** Check if a value is already registered */
  has(value: string): boolean {
    return this.forward.has(value);
  }

  /** Get all mappings (for reporting) */
  entries(): MappingEntry[] {
    return Array.from(this.forward.values());
  }

  /** Reset all mappings (new session) */
  clear(): void {
    this.forward.clear();
    this.reverse.clear();
    this.counters.clear();
  }

  /** Number of registered mappings */
  get size(): number {
    return this.forward.size;
  }
}
