// PrivGuard Engine — Zero-dependency PII sanitization
// Public API

export { PrivGuardEngine } from './engine.js';
export { loadRulesFromYaml, loadAllRules } from './loader.js';
export { registerValidator } from './validators.js';
export { parseYaml } from './yaml-lite.js';

export type {
  Rule,
  RuleSet,
  RuleExample,
  Candidate,
  Decision,
  DecisionAction,
  MappingEntry,
  EngineMode,
  EngineConfig,
  ConfirmRequest,
  OnConfirmRequest,
  OnReport,
  SanitizeResult,
  RestoreResult,
  SanitizeReport,
  SanitizeReportItem,
} from './types.js';
