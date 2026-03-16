import { test } from 'node:test';
import assert from 'node:assert';
import { Registry } from './registry.js';

test('Registry: creates placeholder with correct format', () => {
  const registry = new Registry('PG');
  const placeholder = registry.getOrCreate('PHONE', '13812345678');
  
  assert.strictEqual(placeholder, '<|PG:PHONE_1|>');
});

test('Registry: same value returns same placeholder', () => {
  const registry = new Registry('PG');
  const p1 = registry.getOrCreate('PHONE', '13812345678');
  const p2 = registry.getOrCreate('PHONE', '13812345678');
  
  assert.strictEqual(p1, p2);
  assert.strictEqual(registry.size, 1);
});

test('Registry: different values get incremented placeholders', () => {
  const registry = new Registry('PG');
  const p1 = registry.getOrCreate('PHONE', '13812345678');
  const p2 = registry.getOrCreate('PHONE', '13900001111');
  
  assert.strictEqual(p1, '<|PG:PHONE_1|>');
  assert.strictEqual(p2, '<|PG:PHONE_2|>');
  assert.strictEqual(registry.size, 2);
});

test('Registry: resolve returns original value', () => {
  const registry = new Registry('PG');
  registry.getOrCreate('PHONE', '13812345678');
  
  const original = registry.resolve('<|PG:PHONE_1|>');
  assert.strictEqual(original, '13812345678');
});

test('Registry: resolve returns undefined for unknown placeholder', () => {
  const registry = new Registry('PG');
  const original = registry.resolve('<|PG:PHONE_99|>');
  assert.strictEqual(original, undefined);
});

test('Registry: has checks if value exists', () => {
  const registry = new Registry('PG');
  registry.getOrCreate('PHONE', '13812345678');
  
  assert.strictEqual(registry.has('13812345678'), true);
  assert.strictEqual(registry.has('unknown'), false);
});

test('Registry: entries returns all mappings', () => {
  const registry = new Registry('PG');
  registry.getOrCreate('PHONE', '13812345678');
  registry.getOrCreate('EMAIL', 'test@example.com');
  
  const entries = registry.entries();
  assert.strictEqual(entries.length, 2);
});

test('Registry: clear removes all mappings', () => {
  const registry = new Registry('PG');
  registry.getOrCreate('PHONE', '13812345678');
  registry.clear();
  
  assert.strictEqual(registry.size, 0);
  assert.strictEqual(registry.has('13812345678'), false);
});

test('Registry: loadMappings restores state', () => {
  const registry = new Registry('PG');
  registry.loadMappings([
    { placeholder: '<|PG:PHONE_5|>', type: 'PHONE', originalValue: '13812345678' },
  ]);
  
  assert.strictEqual(registry.resolve('<|PG:PHONE_5|>'), '13812345678');
  
  // Next placeholder should be PHONE_6
  const next = registry.getOrCreate('PHONE', '13900001111');
  assert.strictEqual(next, '<|PG:PHONE_6|>');
});

test('Registry: custom prefix works', () => {
  const registry = new Registry('CUSTOM');
  const placeholder = registry.getOrCreate('PHONE', '13812345678');
  
  assert.strictEqual(placeholder, '<|CUSTOM:PHONE_1|>');
});
