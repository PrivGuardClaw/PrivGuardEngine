// ── Rule Definition ──

export interface Rule {
  type: string;              // e.g. "PHONE", "SSN", "API_KEY"
  name: string;              // Human-readable name
  pattern: string;           // Regex pattern string
  confidence: 'high' | 'medium' | 'low';
  validate?: string;         // Validation algorithm: "luhn" | "idcard_checksum" | "ssn_format"
  context_hint?: string;     // Regex — only match when context contains this
  skip_values?: string[];    // Values to ignore even if pattern matches
  capture_group?: number;    // Only sanitize this capture group
  multiline?: boolean;       // Pattern spans multiple lines
  examples?: RuleExample[];
}

export interface RuleExample {
  input: string;
  match: string | null;
}

export interface RuleSet {
  rules: Rule[];
}

// ── Detection ──

export interface Candidate {
  type: string;
  value: string;             // The matched sensitive value
  start: number;             // Start position in original text
  end: number;               // End position in original text
  confidence: 'high' | 'medium' | 'low';
  ruleId: string;            // "type:name" for traceability
}

// ── Resolution ──

export type DecisionAction = 'sanitize' | 'skip' | 'whitelist';

export interface Decision {
  value: string;
  type: string;
  action: DecisionAction;
  userOverrideType?: string; // User says "this is not PHONE, it's ORDER_ID"
  timestamp: number;
}

// ── Registry ──

export interface MappingEntry {
  placeholder: string;       // e.g. "{{PG:PHONE_1}}"
  type: string;
  originalValue: string;
}

// ── Engine Config ──

export type EngineMode = 'auto' | 'confirm';

export interface EngineConfig {
  mode: EngineMode;
  placeholderPrefix: string;  // Default: "PG"
  rules: Rule[];
  decisions?: Decision[];     // Pre-loaded user decisions
}

// ── Engine Events (for UI integration) ──

export interface ConfirmRequest {
  candidates: Candidate[];
  resolve: (decisions: Decision[]) => void;
}

export type OnConfirmRequest = (req: ConfirmRequest) => void;
export type OnReport = (report: SanitizeReport) => void;

// ── Output ──

export interface SanitizeResult {
  sanitized: string;
  mappings: MappingEntry[];
  report: SanitizeReport;
}

export interface RestoreResult {
  restored: string;
  codeBlocksPreserved: number; // Count of placeholders kept in code blocks
}

export interface SanitizeReport {
  totalDetected: number;
  totalSanitized: number;
  totalSkipped: number;
  types: string[];
  items: SanitizeReportItem[];
}

export interface SanitizeReportItem {
  type: string;
  placeholder: string;
  masked: string;             // e.g. "138****5678"
  action: DecisionAction;
}
