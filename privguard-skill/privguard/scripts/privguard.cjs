#!/usr/bin/env node
"use strict";

// src/cli.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// src/validators.ts
function luhn(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 12) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}
function idcardChecksum(value) {
  const cleaned = value.replace(/\s/g, "");
  if (cleaned.length !== 18) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkMap = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const digit = parseInt(cleaned[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * weights[i];
  }
  const expected = checkMap[sum % 11];
  return cleaned[17].toUpperCase() === expected;
}
function ssnFormat(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return false;
  const area = parseInt(digits.substring(0, 3), 10);
  const group = parseInt(digits.substring(3, 5), 10);
  const serial = parseInt(digits.substring(5, 9), 10);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0) return false;
  if (serial === 0) return false;
  return true;
}
function length11(value) {
  return value.replace(/\D/g, "").length === 11;
}
var validators = {
  luhn,
  idcard_checksum: idcardChecksum,
  ssn_format: ssnFormat,
  length_11: length11
};
function getValidator(name) {
  return validators[name];
}

// src/matcher.ts
function match(text, rules) {
  const candidates = [];
  for (const rule of rules) {
    if (rule.confidence === "low" && rule.context_hint) {
      const hintRe = new RegExp(rule.context_hint, "i");
      if (!hintRe.test(text)) continue;
    }
    let pattern = rule.pattern;
    let extraFlags = "";
    const inlineFlagMatch = pattern.match(/^\(\?([gimsuy]+)\)/);
    if (inlineFlagMatch) {
      extraFlags = inlineFlagMatch[1];
      pattern = pattern.slice(inlineFlagMatch[0].length);
    }
    let flags = "g" + (rule.multiline ? "ms" : "m");
    if (extraFlags.includes("i")) flags += "i";
    let re;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      continue;
    }
    let m;
    while ((m = re.exec(text)) !== null) {
      const captureIdx = rule.capture_group ?? 1;
      const value = m[captureIdx] ?? m[0];
      if (rule.skip_values?.includes(value)) continue;
      if (rule.type === "EMAIL") {
        const before = text.substring(Math.max(0, m.index - 200), m.index);
        if (/:[/][/][^@]*:$/.test(before)) continue;
      }
      if (rule.validate) {
        const validator = getValidator(rule.validate);
        if (validator && !validator(value)) continue;
      }
      let start;
      let end;
      if (rule.capture_group != null && m[rule.capture_group] != null) {
        start = findCaptureStart(m, rule.capture_group);
        end = start + value.length;
      } else if (m[1] != null) {
        start = findCaptureStart(m, 1);
        end = start + value.length;
      } else {
        start = m.index;
        end = start + m[0].length;
      }
      candidates.push({
        type: rule.type,
        value,
        start,
        end,
        confidence: rule.confidence,
        ruleId: `${rule.type}:${rule.name}`
      });
    }
  }
  return dedup(candidates);
}
function findCaptureStart(m, groupIdx) {
  const fullMatch = m[0];
  const captured = m[groupIdx];
  if (!captured) return m.index;
  const offset = fullMatch.indexOf(captured);
  return m.index + (offset >= 0 ? offset : 0);
}
function dedup(candidates) {
  const seen = /* @__PURE__ */ new Set();
  return candidates.filter((c) => {
    const key = `${c.type}|${c.value}|${c.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// src/registry.ts
var Registry = class {
  // type → count
  constructor(prefix = "PG") {
    this.forward = /* @__PURE__ */ new Map();
    // value → entry
    this.reverse = /* @__PURE__ */ new Map();
    // placeholder → entry
    this.counters = /* @__PURE__ */ new Map();
    this.prefix = prefix;
  }
  /** Get or create a placeholder for a value */
  getOrCreate(type, value) {
    const existing = this.forward.get(value);
    if (existing) return existing.placeholder;
    const count = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, count);
    const placeholder = `{{${this.prefix}:${type}_${count}}}`;
    const entry = { placeholder, type, originalValue: value };
    this.forward.set(value, entry);
    this.reverse.set(placeholder, entry);
    return placeholder;
  }
  /** Look up original value by placeholder */
  resolve(placeholder) {
    return this.reverse.get(placeholder)?.originalValue;
  }
  /** Check if a value is already registered */
  has(value) {
    return this.forward.has(value);
  }
  /** Get all mappings (for reporting) */
  entries() {
    return Array.from(this.forward.values());
  }
  /** Reset all mappings (new session) */
  clear() {
    this.forward.clear();
    this.reverse.clear();
    this.counters.clear();
  }
  /** Number of registered mappings */
  get size() {
    return this.forward.size;
  }
};

// src/resolver.ts
var Resolver = class {
  constructor(mode, preloaded) {
    this.decisions = /* @__PURE__ */ new Map();
    this.mode = mode;
    if (preloaded) {
      for (const d of preloaded) {
        this.decisions.set(d.value, d);
      }
    }
  }
  setMode(mode) {
    this.mode = mode;
  }
  setOnConfirm(fn) {
    this.onConfirm = fn;
  }
  /**
   * Resolve a batch of candidates.
   * Returns only the candidates that should be sanitized.
   * May call onConfirm callback for new values in confirm mode.
   */
  async resolve(candidates) {
    const toSanitize = [];
    const toSkip = [];
    const needConfirm = [];
    for (const c of candidates) {
      const existing = this.decisions.get(c.value);
      if (existing) {
        if (existing.action === "sanitize") {
          if (existing.userOverrideType) {
            toSanitize.push({ ...c, type: existing.userOverrideType });
          } else {
            toSanitize.push(c);
          }
        } else {
          toSkip.push(c);
        }
        continue;
      }
      if (this.mode === "auto") {
        this.decisions.set(c.value, {
          value: c.value,
          type: c.type,
          action: "sanitize",
          timestamp: Date.now()
        });
        toSanitize.push(c);
      } else {
        needConfirm.push(c);
      }
    }
    if (needConfirm.length > 0 && this.onConfirm) {
      const userDecisions = await new Promise((resolve2) => {
        this.onConfirm({ candidates: needConfirm, resolve: resolve2 });
      });
      for (const d of userDecisions) {
        this.decisions.set(d.value, d);
        const candidate = needConfirm.find((c) => c.value === d.value);
        if (!candidate) continue;
        if (d.action === "sanitize") {
          if (d.userOverrideType) {
            toSanitize.push({ ...candidate, type: d.userOverrideType });
          } else {
            toSanitize.push(candidate);
          }
        } else {
          toSkip.push(candidate);
        }
      }
    } else if (needConfirm.length > 0 && !this.onConfirm) {
      for (const c of needConfirm) {
        this.decisions.set(c.value, {
          value: c.value,
          type: c.type,
          action: "sanitize",
          timestamp: Date.now()
        });
        toSanitize.push(c);
      }
    }
    return { toSanitize, toSkip };
  }
  /** Export all decisions (for persistence) */
  exportDecisions() {
    return Array.from(this.decisions.values());
  }
  /** Manually add a decision */
  addDecision(value, action, type, overrideType) {
    this.decisions.set(value, {
      value,
      type,
      action,
      userOverrideType: overrideType,
      timestamp: Date.now()
    });
  }
};

// src/engine.ts
var PrivGuardEngine = class {
  constructor(config) {
    this.rules = config.rules;
    this.registry = new Registry(config.placeholderPrefix ?? "PG");
    this.resolver = new Resolver(config.mode, config.decisions);
  }
  // ── Configuration ──
  /** Switch between auto and confirm mode at runtime */
  setMode(mode) {
    this.resolver.setMode(mode);
  }
  /** Register a callback for confirm mode — UI layer implements this */
  onConfirm(fn) {
    this.resolver.setOnConfirm(fn);
  }
  /** Add rules at runtime (e.g., user adds custom rules) */
  addRules(rules) {
    this.rules.push(...rules);
  }
  /** Replace all rules */
  setRules(rules) {
    this.rules = rules;
  }
  /** Manually add a decision (e.g., loaded from persisted decisions file) */
  addDecision(value, action, type, overrideType) {
    this.resolver.addDecision(value, action, type, overrideType);
  }
  // ── Core: Sanitize ──
  async sanitize(text) {
    const candidates = match(text, this.rules);
    if (candidates.length === 0) {
      return {
        sanitized: text,
        mappings: [],
        report: emptyReport()
      };
    }
    const { toSanitize, toSkip } = await this.resolver.resolve(candidates);
    const deduped = removeOverlapping(toSanitize);
    const sorted = deduped.sort((a, b) => b.start - a.start);
    let result = text;
    const reportItems = [];
    for (const c of sorted) {
      const placeholder = this.registry.getOrCreate(c.type, c.value);
      result = result.slice(0, c.start) + placeholder + result.slice(c.end);
      reportItems.push({
        type: c.type,
        placeholder,
        masked: maskValue(c.value),
        action: "sanitize"
      });
    }
    for (const c of toSkip) {
      reportItems.push({
        type: c.type,
        placeholder: "",
        masked: maskValue(c.value),
        action: "skip"
      });
    }
    const types = [...new Set(toSanitize.map((c) => c.type))];
    return {
      sanitized: result,
      mappings: this.registry.entries(),
      report: {
        totalDetected: candidates.length,
        totalSanitized: toSanitize.length,
        totalSkipped: toSkip.length,
        types,
        items: reportItems
      }
    };
  }
  // ── Core: Restore ──
  restore(text) {
    let restored = text;
    let codeBlocksPreserved = 0;
    const codeBlocks = findCodeBlocks(text);
    const placeholderRe = /\{\{PG:[A-Z_]+_\d+\}\}/g;
    const entries = this.registry.entries();
    if (entries.length === 0) {
      return { restored: text, codeBlocksPreserved: 0 };
    }
    const prefix = entries[0]?.placeholder.match(/\{\{(\w+):/)?.[1] ?? "PG";
    const re = new RegExp(`\\{\\{${prefix}:[A-Z0-9_]+_\\d+\\}\\}`, "g");
    let m;
    const replacements = [];
    while ((m = re.exec(restored)) !== null) {
      const placeholder = m[0];
      const original = this.registry.resolve(placeholder);
      if (!original) continue;
      const inCode = codeBlocks.some((b) => m.index >= b.start && m.index < b.end);
      replacements.push({
        start: m.index,
        end: m.index + placeholder.length,
        placeholder,
        original,
        inCode
      });
    }
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      if (r.inCode) {
        codeBlocksPreserved++;
        continue;
      }
      restored = restored.slice(0, r.start) + r.original + restored.slice(r.end);
    }
    return { restored, codeBlocksPreserved };
  }
  // ── Utilities ──
  /** Get the formatted report string */
  formatReport(report) {
    if (report.totalDetected === 0) return "";
    return `\u{1F6E1}\uFE0F PrivGuard: detected ${report.totalDetected} sensitive item(s) (types: ${report.types.join(", ")}), sanitized ${report.totalSanitized} during processing.`;
  }
  /** Export decisions for persistence */
  exportDecisions() {
    return this.resolver.exportDecisions();
  }
  /** Get current registry entries */
  getMappings() {
    return this.registry.entries();
  }
  /** Reset session (clear mappings, keep rules and decisions) */
  resetSession() {
    this.registry.clear();
  }
};
function emptyReport() {
  return { totalDetected: 0, totalSanitized: 0, totalSkipped: 0, types: [], items: [] };
}
function removeOverlapping(candidates) {
  if (candidates.length <= 1) return candidates;
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });
  const result = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];
    if (curr.start < prev.end) {
      const confOrder = { high: 3, medium: 2, low: 1 };
      const prevConf = confOrder[prev.confidence] ?? 0;
      const currConf = confOrder[curr.confidence] ?? 0;
      if (currConf > prevConf || currConf === prevConf && curr.end - curr.start > prev.end - prev.start) {
        result[result.length - 1] = curr;
      }
    } else {
      result.push(curr);
    }
  }
  return result;
}
function maskValue(value) {
  if (value.length <= 4) return "****";
  if (value.length <= 8) return value.slice(0, 2) + "****" + value.slice(-2);
  const showLen = Math.min(3, Math.floor(value.length / 4));
  return value.slice(0, showLen) + "****" + value.slice(-showLen);
}
function findCodeBlocks(text) {
  const blocks = [];
  const re = /```[\s\S]*?```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length });
  }
  const inlineRe = /`[^`]+`/g;
  while ((m = inlineRe.exec(text)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}

// src/yaml-lite.ts
function parseYaml(text) {
  const lines = text.split("\n");
  return parseBlock(lines, 0, -1).value;
}
function parseBlock(lines, start, parentIndent) {
  let i = start;
  while (i < lines.length && isEmptyOrComment(lines[i])) i++;
  if (i >= lines.length) return { value: null, nextLine: i };
  const indent = getIndent(lines[i]);
  if (indent <= parentIndent && start !== 0) return { value: null, nextLine: start };
  const line = lines[i].trim();
  if (line.startsWith("- ")) {
    return parseArray(lines, i, indent);
  }
  if (line.includes(":")) {
    return parseObject(lines, i, indent);
  }
  return { value: parseScalar(line), nextLine: i + 1 };
}
function parseArray(lines, start, indent) {
  const arr = [];
  let i = start;
  while (i < lines.length) {
    while (i < lines.length && isEmptyOrComment(lines[i])) i++;
    if (i >= lines.length) break;
    const currentIndent = getIndent(lines[i]);
    if (currentIndent < indent) break;
    if (currentIndent > indent) break;
    const line = lines[i].trim();
    if (!line.startsWith("- ")) break;
    const after = line.slice(2).trim();
    if (after === "" || after === "[]") {
      if (after === "[]") {
        arr.push([]);
        i++;
        continue;
      }
      i++;
      const nested = parseBlock(lines, i, indent);
      arr.push(nested.value);
      i = nested.nextLine;
    } else if (after.includes(":") && !after.startsWith("'") && !after.startsWith('"')) {
      const obj = {};
      const colonIdx = after.indexOf(":");
      const key = after.slice(0, colonIdx).trim();
      const val = after.slice(colonIdx + 1).trim();
      obj[key] = val === "" ? null : parseScalar(val);
      i++;
      while (i < lines.length) {
        while (i < lines.length && isEmptyOrComment(lines[i])) i++;
        if (i >= lines.length) break;
        const ci = getIndent(lines[i]);
        if (ci <= indent) break;
        const l = lines[i].trim();
        if (l.startsWith("- ")) {
          const k2 = findLastKey(obj);
          if (k2 && obj[k2] === null) {
            const arrResult = parseArray(lines, i, ci);
            obj[k2] = arrResult.value;
            i = arrResult.nextLine;
          } else break;
        } else if (l.includes(":")) {
          const ci2 = l.indexOf(":");
          const k = l.slice(0, ci2).trim();
          const v = l.slice(ci2 + 1).trim();
          if (v === "" || v === null) {
            i++;
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
function parseObject(lines, start, indent) {
  const obj = {};
  let i = start;
  while (i < lines.length) {
    while (i < lines.length && isEmptyOrComment(lines[i])) i++;
    if (i >= lines.length) break;
    const currentIndent = getIndent(lines[i]);
    if (currentIndent < indent) break;
    if (currentIndent > indent) break;
    const line = lines[i].trim();
    if (line.startsWith("- ")) break;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val === "" || val === null) {
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
function parseScalar(s) {
  if (s === "null" || s === "~" || s === "") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (s.startsWith("'") && s.endsWith("'") || s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => {
      const t = item.trim();
      return parseScalar(t);
    });
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const commentIdx = s.indexOf(" #");
  if (commentIdx > 0) return parseScalar(s.slice(0, commentIdx).trim());
  return s;
}
function getIndent(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}
function isEmptyOrComment(line) {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}
function findLastKey(obj) {
  const keys = Object.keys(obj);
  return keys[keys.length - 1];
}

// src/loader.ts
function loadRulesFromYaml(yamlText) {
  const parsed = parseYaml(yamlText);
  if (!parsed?.rules || !Array.isArray(parsed.rules)) return [];
  return parsed.rules.filter((r) => !!r && typeof r === "object" && "type" in r && "pattern" in r).map((r) => ({
    type: String(r.type),
    name: String(r.name ?? r.type),
    pattern: String(r.pattern),
    confidence: validateConfidence(r.confidence),
    ...r.validate && { validate: String(r.validate) },
    ...r.context_hint && { context_hint: String(r.context_hint) },
    ...r.skip_values && { skip_values: toStringArray(r.skip_values) },
    ...r.capture_group != null && { capture_group: Number(r.capture_group) },
    ...r.multiline && { multiline: Boolean(r.multiline) },
    ...r.examples && { examples: r.examples }
  }));
}
function loadAllRules(yamlTexts) {
  return yamlTexts.flatMap(loadRulesFromYaml);
}
function validateConfidence(v) {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}
function toStringArray(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

// src/cli.ts
var args = process.argv.slice(2);
var command = args[0];
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return void 0;
  return args[idx + 1];
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
function loadRules(rulesDir) {
  const dir = rulesDir ?? findRulesDir();
  if (!dir) {
    console.error(JSON.stringify({ error: "No rules directory found. Use --rules-dir or place rules in .privguard/rules/" }));
    process.exit(1);
  }
  const yamls = [];
  for (const file of ["zh-CN.yml", "en-US.yml", "common.yml", "custom.yml"]) {
    const path = (0, import_node_path.join)(dir, file);
    if ((0, import_node_fs.existsSync)(path)) {
      yamls.push((0, import_node_fs.readFileSync)(path, "utf-8"));
    }
  }
  if (yamls.length === 0) {
    console.error(JSON.stringify({ error: `No rule files found in ${dir}` }));
    process.exit(1);
  }
  return loadAllRules(yamls);
}
function findRulesDir() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = (0, import_node_path.join)(dir, ".privguard", "rules");
    if ((0, import_node_fs.existsSync)(candidate)) return candidate;
    const parent = (0, import_node_path.resolve)(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return void 0;
}
async function getInput() {
  const inputArg = getArg("input");
  if (inputArg) return inputArg;
  const fileArg = getArg("file");
  if (fileArg) return (0, import_node_fs.readFileSync)(fileArg, "utf-8");
  if (hasFlag("stdin")) return readStdin();
  if (!process.stdin.isTTY) return readStdin();
  console.error(JSON.stringify({ error: "No input provided. Use --input, --file, or --stdin" }));
  process.exit(1);
}
async function doSanitize() {
  const input = await getInput();
  const rules = loadRules(getArg("rules-dir"));
  const mode = getArg("mode") ?? "auto";
  const engine = new PrivGuardEngine({ mode, rules, placeholderPrefix: "PG" });
  const result = await engine.sanitize(input);
  const output = {
    sanitized: result.sanitized,
    mappings: result.mappings,
    report: {
      totalDetected: result.report.totalDetected,
      totalSanitized: result.report.totalSanitized,
      types: result.report.types,
      items: result.report.items.map((i) => ({
        type: i.type,
        placeholder: i.placeholder,
        masked: i.masked,
        action: i.action
      }))
    },
    diff: generateDiff(input, result.sanitized, result.mappings)
  };
  console.log(JSON.stringify(output, null, 2));
}
async function doRestore() {
  const input = await getInput();
  const mappingsFile = getArg("mappings");
  if (!mappingsFile) {
    console.error(JSON.stringify({ error: "restore requires --mappings <file.json>" }));
    process.exit(1);
  }
  const mappingsData = JSON.parse((0, import_node_fs.readFileSync)(mappingsFile, "utf-8"));
  const rules = loadRules(getArg("rules-dir"));
  const engine = new PrivGuardEngine({ mode: "auto", rules, placeholderPrefix: "PG" });
  for (const m of mappingsData) {
    await engine.sanitize(m.originalValue);
  }
  const result = engine.restore(input);
  console.log(JSON.stringify({
    restored: result.restored,
    codeBlocksPreserved: result.codeBlocksPreserved
  }, null, 2));
}
async function doDetect() {
  const input = await getInput();
  const rules = loadRules(getArg("rules-dir"));
  const engine = new PrivGuardEngine({ mode: "auto", rules, placeholderPrefix: "PG" });
  const result = await engine.sanitize(input);
  const output = {
    detected: result.report.totalDetected,
    items: result.report.items.map((i) => ({
      type: i.type,
      masked: i.masked,
      action: i.action
    })),
    types: result.report.types,
    summary: engine.formatReport(result.report)
  };
  console.log(JSON.stringify(output, null, 2));
}
function generateDiff(original, sanitized, mappings) {
  if (mappings.length === 0) return "";
  const lines = ["--- original", "+++ sanitized"];
  const origLines = original.split("\n");
  const sanLines = sanitized.split("\n");
  const maxLines = Math.max(origLines.length, sanLines.length);
  for (let i = 0; i < maxLines; i++) {
    const orig = origLines[i] ?? "";
    const san = sanLines[i] ?? "";
    if (orig !== san) {
      lines.push(`- ${orig}`);
      lines.push(`+ ${san}`);
    }
  }
  return lines.join("\n");
}
function printUsage() {
  console.log(`PrivGuard Engine CLI

Usage:
  privguard sanitize  --input <text> | --file <path> | --stdin
  privguard detect    --input <text> | --file <path> | --stdin
  privguard restore   --input <text> --mappings <file.json>

Options:
  --rules-dir <path>   Path to rules directory (default: .privguard/rules/)
  --mode <auto|confirm> Engine mode (default: auto)
  --input <text>       Input text directly
  --file <path>        Read input from file
  --stdin              Read input from stdin

Output: JSON`);
}
switch (command) {
  case "sanitize":
    doSanitize().catch((e) => {
      console.error(JSON.stringify({ error: String(e) }));
      process.exit(1);
    });
    break;
  case "restore":
    doRestore().catch((e) => {
      console.error(JSON.stringify({ error: String(e) }));
      process.exit(1);
    });
    break;
  case "detect":
    doDetect().catch((e) => {
      console.error(JSON.stringify({ error: String(e) }));
      process.exit(1);
    });
    break;
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
