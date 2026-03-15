/**
 * Minimal YAML parser — just enough to parse PrivGuard rule files.
 * Handles: scalars, arrays, objects, quoted strings, comments.
 * Does NOT handle: anchors, aliases, multi-doc, flow style, complex keys.
 *
 * Zero dependencies. ~100 lines. Good enough for .privguard/rules/*.yml.
 */

export function parseYaml(text: string): unknown {
  const lines = text.split('\n');
  return parseBlock(lines, 0, -1).value;
}

interface ParseResult {
  value: unknown;
  nextLine: number;
}

function parseBlock(lines: string[], start: number, parentIndent: number): ParseResult {
  let i = start;

  // Skip empty/comment lines to find first meaningful line
  while (i < lines.length && isEmptyOrComment(lines[i])) i++;
  if (i >= lines.length) return { value: null, nextLine: i };

  const indent = getIndent(lines[i]);
  if (indent <= parentIndent && start !== 0) return { value: null, nextLine: start };

  const line = lines[i].trim();

  // Array item?
  if (line.startsWith('- ')) {
    return parseArray(lines, i, indent);
  }

  // Key-value?
  if (line.includes(':')) {
    return parseObject(lines, i, indent);
  }

  // Scalar
  return { value: parseScalar(line), nextLine: i + 1 };
}

function parseArray(lines: string[], start: number, indent: number): ParseResult {
  const arr: unknown[] = [];
  let i = start;

  while (i < lines.length) {
    while (i < lines.length && isEmptyOrComment(lines[i])) i++;
    if (i >= lines.length) break;

    const currentIndent = getIndent(lines[i]);
    if (currentIndent < indent) break;
    if (currentIndent > indent) break;

    const line = lines[i].trim();
    if (!line.startsWith('- ')) break;

    const after = line.slice(2).trim();

    if (after === '' || after === '[]') {
      if (after === '[]') { arr.push([]); i++; continue; }
      // Nested block under array item
      i++;
      const nested = parseBlock(lines, i, indent);
      arr.push(nested.value);
      i = nested.nextLine;
    } else if (after.includes(':') && !after.startsWith("'") && !after.startsWith('"')) {
      // Inline object start: "- type: PHONE"
      // Collect all key-value pairs at deeper indent
      const obj: Record<string, unknown> = {};
      const colonIdx = after.indexOf(':');
      const key = after.slice(0, colonIdx).trim();
      const val = after.slice(colonIdx + 1).trim();
      obj[key] = val === '' ? null : parseScalar(val);
      i++;

      // Continue reading keys at deeper indent
      while (i < lines.length) {
        while (i < lines.length && isEmptyOrComment(lines[i])) i++;
        if (i >= lines.length) break;
        const ci = getIndent(lines[i]);
        if (ci <= indent) break;

        const l = lines[i].trim();
        if (l.startsWith('- ')) {
          // Nested array
          const k2 = findLastKey(obj);
          if (k2 && obj[k2] === null) {
            const arrResult = parseArray(lines, i, ci);
            obj[k2] = arrResult.value;
            i = arrResult.nextLine;
          } else break;
        } else if (l.includes(':')) {
          const ci2 = l.indexOf(':');
          const k = l.slice(0, ci2).trim();
          const v = l.slice(ci2 + 1).trim();
          if (v === '' || v === null) {
            i++;
            // Check if next line is array or nested object
            const next = parseBlock(lines, i, ci);
            obj[k] = next.value;
            i = next.nextLine;
          } else {
            obj[k] = parseScalar(v);
            i++;
          }
        } else {
          i++;
        }
      }
      arr.push(obj);
    } else {
      arr.push(parseScalar(after));
      i++;
    }
  }

  return { value: arr, nextLine: i };
}

function parseObject(lines: string[], start: number, indent: number): ParseResult {
  const obj: Record<string, unknown> = {};
  let i = start;

  while (i < lines.length) {
    while (i < lines.length && isEmptyOrComment(lines[i])) i++;
    if (i >= lines.length) break;

    const currentIndent = getIndent(lines[i]);
    if (currentIndent < indent) break;
    if (currentIndent > indent) break;

    const line = lines[i].trim();
    if (line.startsWith('- ')) break; // Array at same level = different context

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (val === '' || val === null) {
      i++;
      const nested = parseBlock(lines, i, indent);
      obj[key] = nested.value;
      i = nested.nextLine;
    } else {
      obj[key] = parseScalar(val);
      i++;
    }
  }

  return { value: obj, nextLine: i };
}

function parseScalar(s: string): string | number | boolean | null | string[] {
  if (s === 'null' || s === '~' || s === '') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;

  // Quoted string
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }

  // Inline array: [a, b, c]
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((item) => {
      const t = item.trim();
      return parseScalar(t) as string;
    }) as string[];
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  // Strip trailing comment
  const commentIdx = s.indexOf(' #');
  if (commentIdx > 0) return parseScalar(s.slice(0, commentIdx).trim());

  return s;
}

function getIndent(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

function isEmptyOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function findLastKey(obj: Record<string, unknown>): string | undefined {
  const keys = Object.keys(obj);
  return keys[keys.length - 1];
}
