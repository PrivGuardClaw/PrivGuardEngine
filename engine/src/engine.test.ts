import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrivGuardEngine } from './engine.js';
import { loadRulesFromYaml } from './loader.js';

const ZH_RULES_YAML = `
rules:
  - type: PHONE
    name: 中国大陆手机号
    pattern: '(?<!\\\\d)(1[3-9]\\\\d{9})(?!\\\\d)'
    confidence: high
    validate: length_11
  - type: IDCARD
    name: 身份证号
    pattern: '(?<!\\\\d)([1-9]\\\\d{5}(?:19|20)\\\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\\\d|3[01])\\\\d{3}[\\\\dXx])(?!\\\\d)'
    confidence: high
    validate: idcard_checksum
`;

const COMMON_RULES_YAML = `
rules:
  - type: EMAIL
    name: Email Address
    pattern: '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,})'
    confidence: high
  - type: IPV4
    name: IPv4 Address
    pattern: '((?:25[0-5]|2[0-4]\\\\d|1\\\\d{2}|[1-9]?\\\\d)(?:\\\\.(?:25[0-5]|2[0-4]\\\\d|1\\\\d{2}|[1-9]?\\\\d)){3})'
    confidence: medium
    skip_values: ["127.0.0.1", "0.0.0.0"]
`;

// Use simpler inline rules to avoid YAML parsing edge cases
const PHONE_RULE = {
  type: 'PHONE',
  name: '中国大陆手机号',
  pattern: '(1[3-9]\\d{9})',
  confidence: 'high' as const,
  validate: 'length_11',
};

const EMAIL_RULE = {
  type: 'EMAIL',
  name: 'Email Address',
  pattern: '([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})',
  confidence: 'high' as const,
};

const IPV4_RULE = {
  type: 'IPV4',
  name: 'IPv4 Address',
  pattern: '((?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)){3})',
  confidence: 'medium' as const,
  skip_values: ['127.0.0.1', '0.0.0.0'],
};

const SSN_RULE = {
  type: 'SSN',
  name: 'Social Security Number',
  pattern: '(\\d{3}-\\d{2}-\\d{4})',
  confidence: 'high' as const,
  validate: 'ssn_format',
};

describe('PrivGuardEngine', () => {
  it('should detect and sanitize phone numbers', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE],
      placeholderPrefix: 'PG',
    });

    const result = await engine.sanitize('请联系13812345678');
    assert.ok(result.sanitized.includes('{{PG:PHONE_1}}'));
    assert.ok(!result.sanitized.includes('13812345678'));
    assert.equal(result.report.totalSanitized, 1);
    assert.deepEqual(result.report.types, ['PHONE']);
  });

  it('should handle multiple types', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE, EMAIL_RULE],
      placeholderPrefix: 'PG',
    });

    const result = await engine.sanitize('手机13812345678，邮箱test@example.com');
    assert.ok(result.sanitized.includes('{{PG:PHONE_1}}'));
    assert.ok(result.sanitized.includes('{{PG:EMAIL_1}}'));
    assert.equal(result.report.totalSanitized, 2);
  });

  it('should be idempotent — same value gets same placeholder', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE],
      placeholderPrefix: 'PG',
    });

    const result = await engine.sanitize('A: 13812345678, B: 13812345678, C: 13999887766');
    // Two distinct phone numbers → two distinct placeholders
    assert.ok(result.sanitized.includes('{{PG:PHONE_1}}'));
    assert.ok(result.sanitized.includes('{{PG:PHONE_2}}'));
    // The repeated value (13812345678) should map to the same placeholder
    // Find which placeholder maps to 13812345678
    const mapping = result.mappings.find((m) => m.originalValue === '13812345678');
    assert.ok(mapping);
    const ph = mapping!.placeholder;
    const count = (result.sanitized.match(new RegExp(ph.replace(/[{}]/g, '\\$&'), 'g')) || []).length;
    assert.equal(count, 2, 'same value should produce same placeholder twice');
  });

  it('should skip values in skip_values list', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [IPV4_RULE],
      placeholderPrefix: 'PG',
    });

    const result = await engine.sanitize('Server: 192.168.1.100, localhost: 127.0.0.1');
    assert.ok(result.sanitized.includes('{{PG:IPV4_1}}'));
    assert.ok(result.sanitized.includes('127.0.0.1')); // Not sanitized
  });

  it('should validate SSN format', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [SSN_RULE],
      placeholderPrefix: 'PG',
    });

    // Valid SSN
    const r1 = await engine.sanitize('SSN: 123-45-6789');
    assert.ok(r1.sanitized.includes('{{PG:SSN_1}}'));

    // Invalid SSN (000 prefix)
    const engine2 = new PrivGuardEngine({
      mode: 'auto',
      rules: [SSN_RULE],
      placeholderPrefix: 'PG',
    });
    const r2 = await engine2.sanitize('SSN: 000-12-3456');
    assert.ok(r2.sanitized.includes('000-12-3456')); // Not sanitized
  });

  it('should restore placeholders in output', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE, EMAIL_RULE],
      placeholderPrefix: 'PG',
    });

    await engine.sanitize('手机13812345678，邮箱test@example.com');

    const agentOutput = '用户手机是{{PG:PHONE_1}}，邮箱是{{PG:EMAIL_1}}';
    const { restored } = engine.restore(agentOutput);
    assert.ok(restored.includes('13812345678'));
    assert.ok(restored.includes('test@example.com'));
  });

  it('should NOT restore placeholders inside code blocks', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE],
      placeholderPrefix: 'PG',
    });

    await engine.sanitize('手机13812345678');

    const agentOutput = '手机是{{PG:PHONE_1}}\n\n```python\nphone = "{{PG:PHONE_1}}"\n```';
    const { restored, codeBlocksPreserved } = engine.restore(agentOutput);
    assert.ok(restored.includes('13812345678')); // Restored outside code
    assert.ok(restored.includes('{{PG:PHONE_1}}')); // Kept inside code block
    assert.equal(codeBlocksPreserved, 1);
  });

  it('should return empty report when no PII found', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE],
      placeholderPrefix: 'PG',
    });

    const result = await engine.sanitize('Hello world, no PII here');
    assert.equal(result.sanitized, 'Hello world, no PII here');
    assert.equal(result.report.totalDetected, 0);
  });

  it('should format report correctly', async () => {
    const engine = new PrivGuardEngine({
      mode: 'auto',
      rules: [PHONE_RULE, EMAIL_RULE],
      placeholderPrefix: 'PG',
    });

    const result = await engine.sanitize('13812345678 test@example.com');
    const report = engine.formatReport(result.report);
    assert.ok(report.includes('🛡️ PrivGuard'));
    assert.ok(report.includes('PHONE'));
    assert.ok(report.includes('EMAIL'));
  });
});
