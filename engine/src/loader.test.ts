import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRulesFromYaml } from './loader.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('loadRulesFromYaml', () => {
  it('should parse zh-CN rules file', () => {
    const yaml = readFileSync(resolve('..', '.privguard', 'rules', 'zh-CN.yml'), 'utf-8');
    const rules = loadRulesFromYaml(yaml);
    assert.ok(rules.length > 0, 'should have rules');

    const phone = rules.find((r) => r.type === 'PHONE');
    assert.ok(phone, 'should have PHONE rule');
    assert.equal(phone!.confidence, 'high');
    assert.equal(phone!.validate, 'length_11');
  });

  it('should parse en-US rules file', () => {
    const yaml = readFileSync(resolve('..', '.privguard', 'rules', 'en-US.yml'), 'utf-8');
    const rules = loadRulesFromYaml(yaml);

    const ssn = rules.find((r) => r.type === 'SSN');
    assert.ok(ssn, 'should have SSN rule');
    assert.equal(ssn!.validate, 'ssn_format');
  });

  it('should parse common rules file', () => {
    const yaml = readFileSync(resolve('..', '.privguard', 'rules', 'common.yml'), 'utf-8');
    const rules = loadRulesFromYaml(yaml);

    const email = rules.find((r) => r.type === 'EMAIL');
    assert.ok(email, 'should have EMAIL rule');

    const ipv4 = rules.find((r) => r.type === 'IPV4');
    assert.ok(ipv4, 'should have IPV4 rule');
    assert.ok(ipv4!.skip_values, 'IPV4 should have skip_values');
    assert.ok(ipv4!.skip_values!.includes('127.0.0.1'));

    const pwd = rules.find((r) => r.type === 'PASSWORD_IN_URL');
    assert.ok(pwd, 'should have PASSWORD_IN_URL rule');
    assert.equal(pwd!.capture_group, 2);
  });

  it('should handle empty custom rules file', () => {
    const yaml = readFileSync(resolve('..', '.privguard', 'rules', 'custom.yml'), 'utf-8');
    const rules = loadRulesFromYaml(yaml);
    assert.equal(rules.length, 0);
  });

  it('should parse inline rules', () => {
    const yaml = `
rules:
  - type: TEST
    name: Test Rule
    pattern: '(test\\\\d+)'
    confidence: high
`;
    const rules = loadRulesFromYaml(yaml);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].type, 'TEST');
  });
});
