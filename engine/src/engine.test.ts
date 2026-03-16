import { test } from 'node:test';
import assert from 'node:assert';
import { PrivGuardEngine } from './engine.js';
import type { Rule } from './types.js';

const testRules: Rule[] = [
  {
    type: 'PHONE',
    name: 'Chinese Phone',
    pattern: '(?<!\\d)(1[3-9]\\d{9})(?!\\d)',
    confidence: 'high',
  },
  {
    type: 'EMAIL',
    name: 'Email',
    pattern: '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
    confidence: 'high',
  },
  {
    type: 'SSN',
    name: 'US SSN',
    pattern: '(?<!\\d)(\\d{3}-\\d{2}-\\d{4})(?!\\d)',
    confidence: 'high',
  },
];

test('PrivGuardEngine: sanitize detects phone number', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize('我的手机号是13812345678');
  
  assert.ok(result.sanitized.includes('<|PG:PHONE_1|>'));
  assert.ok(!result.sanitized.includes('13812345678'));
  assert.strictEqual(result.report.totalSanitized, 1);
});

test('PrivGuardEngine: sanitize detects email', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize('联系邮箱: test@example.com');
  
  assert.ok(result.sanitized.includes('<|PG:EMAIL_1|>'));
  assert.ok(!result.sanitized.includes('test@example.com'));
});

test('PrivGuardEngine: sanitize detects multiple PII types', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize('手机13812345678，邮箱test@example.com');
  
  assert.ok(result.sanitized.includes('<|PG:PHONE_1|>'));
  assert.ok(result.sanitized.includes('<|PG:EMAIL_1|>'));
  assert.strictEqual(result.mappings.length, 2);
});

test('PrivGuardEngine: same value gets same placeholder', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize('手机13812345678，再次13812345678');
  
  // Same phone number should get same placeholder
  const matches = result.sanitized.match(/<\|PG:PHONE_1\|>/g);
  assert.strictEqual(matches?.length, 2);
  assert.strictEqual(result.mappings.length, 1); // Only one unique mapping
});

test('PrivGuardEngine: restore replaces placeholders', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  
  // First sanitize
  await engine.sanitize('手机13812345678');
  
  // Then restore
  const result = engine.restore('你的手机是<|PG:PHONE_1|>');
  assert.strictEqual(result.restored, '你的手机是13812345678');
});

test('PrivGuardEngine: restore preserves code blocks', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  
  await engine.sanitize('手机13812345678');
  
  const text = '手机是<|PG:PHONE_1|>，代码：```const phone = "<|PG:PHONE_1|>"```';
  const result = engine.restore(text);
  
  // Outside code block should be restored
  assert.ok(result.restored.includes('手机是13812345678'));
  // Inside code block should be preserved
  assert.ok(result.restored.includes('<|PG:PHONE_1|>'));
  assert.strictEqual(result.codeBlocksPreserved, 1);
});

test('PrivGuardEngine: no PII returns original text', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  const result = await engine.sanitize('这是一段普通文本，没有敏感信息');
  
  assert.strictEqual(result.sanitized, '这是一段普通文本，没有敏感信息');
  assert.strictEqual(result.mappings.length, 0);
  assert.strictEqual(result.report.totalDetected, 0);
});

test('PrivGuardEngine: loadMappings allows restore without sanitize', () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  
  // Load mappings directly
  engine.loadMappings([
    { placeholder: '<|PG:PHONE_1|>', type: 'PHONE', originalValue: '13812345678' },
  ]);
  
  const result = engine.restore('手机<|PG:PHONE_1|>');
  assert.strictEqual(result.restored, '手机13812345678');
});

test('PrivGuardEngine: resetSession clears mappings', async () => {
  const engine = new PrivGuardEngine({ mode: 'auto', rules: testRules, placeholderPrefix: 'PG' });
  
  await engine.sanitize('手机13812345678');
  assert.strictEqual(engine.getMappings().length, 1);
  
  engine.resetSession();
  assert.strictEqual(engine.getMappings().length, 0);
});
