import { test } from 'node:test';
import assert from 'node:assert';

// Test the splitIncomplete function logic
function splitIncomplete(text: string): { clean: string; remainder: string } {
  // Check for new format <|...|> first
  const lastOpenNew = text.lastIndexOf('<|');
  if (lastOpenNew !== -1) {
    const afterOpenNew = text.indexOf('|>', lastOpenNew);
    if (afterOpenNew === -1) {
      return { clean: text.slice(0, lastOpenNew), remainder: text.slice(lastOpenNew) };
    }
    const nextOpenNew = text.indexOf('<|', afterOpenNew + 2);
    if (nextOpenNew !== -1) {
      const tail = splitIncomplete(text.slice(nextOpenNew));
      if (tail.remainder) {
        return { clean: text.slice(0, nextOpenNew) + tail.clean, remainder: tail.remainder };
      }
    }
  }

  // Also check for legacy format {{...}} for backward compatibility
  const lastOpen = text.lastIndexOf('{{');
  if (lastOpen === -1) return { clean: text, remainder: '' };

  const afterOpen = text.indexOf('}}', lastOpen);
  if (afterOpen !== -1) {
    const nextOpen = text.indexOf('{{', afterOpen + 2);
    if (nextOpen === -1) return { clean: text, remainder: '' };
    const tail = splitIncomplete(text.slice(nextOpen));
    if (tail.remainder) {
      return { clean: text.slice(0, nextOpen) + tail.clean, remainder: tail.remainder };
    }
    return { clean: text, remainder: '' };
  }

  return { clean: text.slice(0, lastOpen), remainder: text.slice(lastOpen) };
}

test('splitIncomplete: complete placeholder passes through', () => {
  const result = splitIncomplete('Hello <|PG:PHONE_1|> world');
  assert.strictEqual(result.clean, 'Hello <|PG:PHONE_1|> world');
  assert.strictEqual(result.remainder, '');
});

test('splitIncomplete: incomplete placeholder is buffered', () => {
  const result = splitIncomplete('Hello <|PG:PHO');
  assert.strictEqual(result.clean, 'Hello ');
  assert.strictEqual(result.remainder, '<|PG:PHO');
});

test('splitIncomplete: mixed complete and incomplete', () => {
  const result = splitIncomplete('Hello <|PG:PHONE_1|> and <|PG:EM');
  assert.strictEqual(result.clean, 'Hello <|PG:PHONE_1|> and ');
  assert.strictEqual(result.remainder, '<|PG:EM');
});

test('splitIncomplete: no placeholder', () => {
  const result = splitIncomplete('No placeholder here');
  assert.strictEqual(result.clean, 'No placeholder here');
  assert.strictEqual(result.remainder, '');
});

test('splitIncomplete: legacy format complete', () => {
  const result = splitIncomplete('Legacy {{PG:PHONE_1}} works');
  assert.strictEqual(result.clean, 'Legacy {{PG:PHONE_1}} works');
  assert.strictEqual(result.remainder, '');
});

test('splitIncomplete: legacy format incomplete', () => {
  const result = splitIncomplete('Legacy {{PG:PHO');
  assert.strictEqual(result.clean, 'Legacy ');
  assert.strictEqual(result.remainder, '{{PG:PHO');
});

test('splitIncomplete: multiple complete placeholders', () => {
  const result = splitIncomplete('<|PG:A_1|> and <|PG:B_1|> done');
  assert.strictEqual(result.clean, '<|PG:A_1|> and <|PG:B_1|> done');
  assert.strictEqual(result.remainder, '');
});

test('splitIncomplete: only opening delimiter', () => {
  const result = splitIncomplete('text <|');
  assert.strictEqual(result.clean, 'text ');
  assert.strictEqual(result.remainder, '<|');
});
