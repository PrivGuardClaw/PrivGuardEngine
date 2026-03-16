import type { Rule } from '../types.js';

// ── Intercept Records ──

export interface InterceptRecord {
  id: string;
  timestamp: number;
  direction: 'request' | 'response';
  apiFormat: 'anthropic' | 'openai' | 'unknown';
  detectedCount: number;
  sanitizedCount: number;
  piiTypes: string[];
  items: Array<{
    type: string;
    masked: string;
    placeholder: string;
  }>;
  originalPreview?: string;
  sanitizedPreview?: string;
}

export interface RecordQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  startTime?: number;
  endTime?: number;
}

export interface RecordQueryResult {
  records: InterceptRecord[];
  total: number;
}

// ── Auth / Session ──

export interface Session {
  id: string;
  createdAt: number;
  lastActivity: number;
}

// ── Proxy Status ──

export interface ProxyStatus {
  running: boolean;
  port?: number;
  upstreamUrl?: string;
  requestCount: number;
  lastActivity?: number;
}

// ── Rule Change Log ──

export interface RuleChangeLog {
  timestamp: number;
  action: 'add' | 'update' | 'delete';
  ruleName: string;
  ruleType: string;
}

// ── Web Server ──

export interface WebServerConfig {
  port: number;
  password: string;
  rulesDir: string;
  proxyPort?: number;
}

export interface WebServerHandle {
  stop: () => void;
  getPort: () => number;
}

// ── Rule Manager ──

export interface RuleLoadResult {
  system: Rule[];
  custom: Rule[];
}

export type { Rule };
