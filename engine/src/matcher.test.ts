import { test } from 'node:test';
import assert from 'node:assert';
import { match } from './matcher.js';
import type { Rule } from './types.js';

const phoneRule: Rule = {
  type: 'PHONE',
  name: 'Chinese Phone',
  pattern: '(?<!\\d)(1[3-9]\\d{9})(?!\\d)',
  confidence: 'high',
};

const emailRule: Rule = {
  type: 'EMAIL',
  name: 'Email',
  pattern: '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
  confidence: 'high',
};

const apiKeyRule: Rule = {
  type: 'API_KEY',
  name: 'API Key',
  pattern: '(sk-[a-zA-Z0-9]{32,})',
  confidence: 'high',
};

test('match: finds phone number', () => {
  const candidates = match('我的手机号是13812345678', [phoneRule]);
  
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].type, 'PHONE');
  assert.strictEqual(candidates[0].value, '13812345678');
});

test('match: finds email', () => {
  const candidates = match('邮箱: test@example.com', [emailRule]);
  
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].type, 'EMAIL');
  assert.strictEqual(candidates[0].value, 'test@example.com');
});

test('match: finds multiple matches', () => {
  const candidates = match('手机13812345678，邮箱test@example.com', [phoneRule, emailRule]);
  
  assert.strictEqual(candidates.length, 2);
  const types = candidates.map(c => c.type).sort();
  assert.deepStrictEqual(types, ['EMAIL', 'PHONE']);
});

test('match: returns empty for no matches', () => {
  const candidates = match('这是普通文本', [phoneRule, emailRule]);
  assert.strictEqual(candidates.length, 0);
});

test('match: includes position info', () => {
  const text = '手机13812345678';
  const candidates = match(text, [phoneRule]);
  
  assert.strictEqual(candidates[0].start, 2);
  assert.strictEqual(candidates[0].end, 13);
  assert.strictEqual(text.slice(candidates[0].start, candidates[0].end), '13812345678');
});

test('match: finds API key', () => {
  const candidates = match('key: sk-abcdefghijklmnopqrstuvwxyz123456', [apiKeyRule]);
  
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].type, 'API_KEY');
});

test('match: handles invalid regex gracefully', () => {
  const badRule: Rule = {
    type: 'BAD',
    name: 'Bad Rule',
    pattern: '([invalid',
    confidence: 'high',
  };
  
  // Should not throw, just skip the bad rule
  const candidates = match('test', [badRule, phoneRule]);
  // Only phone rule should work
  assert.ok(Array.isArray(candidates));
});
