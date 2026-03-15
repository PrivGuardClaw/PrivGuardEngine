/**
 * Protocol adapters for extracting and rewriting message content
 * from different LLM API formats (Anthropic Messages API, OpenAI Chat API).
 *
 * Each adapter knows how to:
 * 1. Extract all text content from a request body
 * 2. Rewrite text content in-place (for sanitization)
 * 3. Extract text content from a response body (for restoration)
 */

export interface TextSegment {
  /** Pointer path to this text in the JSON structure, e.g. "messages.0.content" */
  path: string;
  /** The text content */
  text: string;
}

export type ApiFormat = 'anthropic' | 'openai' | 'unknown';

/** Detect API format from request path or body shape */
export function detectFormat(urlPath: string, body: any): ApiFormat {
  // Anthropic: POST /v1/messages
  if (urlPath.includes('/messages') && body?.model && Array.isArray(body?.messages)) {
    // Anthropic has "messages" with role/content, and may have "system" as top-level string
    if (typeof body.system === 'string' || body.messages?.[0]?.content !== undefined) {
      // Could be either — check for OpenAI-specific fields
      if (body.messages?.some((m: any) => m.role === 'system' && typeof m.content === 'string') && !body.system) {
        return 'openai';
      }
      // Anthropic uses top-level "system" or content blocks
      if (body.system !== undefined || body.messages?.some((m: any) => Array.isArray(m.content))) {
        return 'anthropic';
      }
    }
  }

  // OpenAI: POST /v1/chat/completions
  if (urlPath.includes('/chat/completions')) {
    return 'openai';
  }

  // Anthropic: POST /v1/messages (fallback)
  if (urlPath.includes('/messages')) {
    return 'anthropic';
  }

  return 'unknown';
}

/** Extract all text segments from a request body */
export function extractRequestTexts(body: any, format: ApiFormat): TextSegment[] {
  if (format === 'anthropic') return extractAnthropicRequest(body);
  if (format === 'openai') return extractOpenAIRequest(body);
  // Unknown: try both
  const segments = extractAnthropicRequest(body);
  if (segments.length > 0) return segments;
  return extractOpenAIRequest(body);
}

/** Rewrite text segments back into the body (mutates body) */
export function rewriteRequestTexts(body: any, segments: TextSegment[]): void {
  for (const seg of segments) {
    setByPath(body, seg.path, seg.text);
  }
}

/** Extract text from a response body (for restoring placeholders) */
export function extractResponseTexts(body: any, format: ApiFormat): TextSegment[] {
  if (format === 'anthropic') return extractAnthropicResponse(body);
  if (format === 'openai') return extractOpenAIResponse(body);
  const segments = extractAnthropicResponse(body);
  if (segments.length > 0) return segments;
  return extractOpenAIResponse(body);
}

// ── Anthropic Messages API ──

function extractAnthropicRequest(body: any): TextSegment[] {
  const segments: TextSegment[] = [];

  // System prompt (string or array of content blocks)
  if (typeof body.system === 'string' && body.system) {
    segments.push({ path: 'system', text: body.system });
  } else if (Array.isArray(body.system)) {
    body.system.forEach((block: any, i: number) => {
      if (block.type === 'text' && block.text) {
        segments.push({ path: `system.${i}.text`, text: block.text });
      }
    });
  }

  // Messages
  if (Array.isArray(body.messages)) {
    body.messages.forEach((msg: any, mi: number) => {
      if (typeof msg.content === 'string') {
        segments.push({ path: `messages.${mi}.content`, text: msg.content });
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach((block: any, bi: number) => {
          if (block.type === 'text' && block.text) {
            segments.push({ path: `messages.${mi}.content.${bi}.text`, text: block.text });
          }
          // Fix #4: tool_use input — scan all string values in the input object
          if (block.type === 'tool_use' && block.input && typeof block.input === 'object') {
            extractObjectStrings(block.input, `messages.${mi}.content.${bi}.input`, segments);
          }
          // Tool result content
          if (block.type === 'tool_result' && typeof block.content === 'string') {
            segments.push({ path: `messages.${mi}.content.${bi}.content`, text: block.content });
          }
          if (block.type === 'tool_result' && Array.isArray(block.content)) {
            block.content.forEach((tb: any, ti: number) => {
              if (tb.type === 'text' && tb.text) {
                segments.push({ path: `messages.${mi}.content.${bi}.content.${ti}.text`, text: tb.text });
              }
            });
          }
        });
      }
    });
  }

  return segments;
}

/**
 * Fix #4: Recursively extract all string values from an object.
 * Used to scan tool_use input for PII in any nested field.
 */
function extractObjectStrings(obj: any, basePath: string, segments: TextSegment[]): void {
  if (typeof obj === 'string' && obj.length > 0) {
    segments.push({ path: basePath, text: obj });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      extractObjectStrings(item, `${basePath}.${i}`, segments);
    });
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      extractObjectStrings(value, `${basePath}.${key}`, segments);
    }
  }
}

function extractAnthropicResponse(body: any): TextSegment[] {
  const segments: TextSegment[] = [];
  if (Array.isArray(body.content)) {
    body.content.forEach((block: any, i: number) => {
      if (block.type === 'text' && block.text) {
        segments.push({ path: `content.${i}.text`, text: block.text });
      }
    });
  }
  return segments;
}

// ── OpenAI Chat Completions API ──

function extractOpenAIRequest(body: any): TextSegment[] {
  const segments: TextSegment[] = [];
  if (Array.isArray(body.messages)) {
    body.messages.forEach((msg: any, mi: number) => {
      if (typeof msg.content === 'string') {
        segments.push({ path: `messages.${mi}.content`, text: msg.content });
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach((part: any, pi: number) => {
          if (part.type === 'text' && part.text) {
            segments.push({ path: `messages.${mi}.content.${pi}.text`, text: part.text });
          }
        });
      }
    });
  }
  return segments;
}

function extractOpenAIResponse(body: any): TextSegment[] {
  const segments: TextSegment[] = [];
  if (Array.isArray(body.choices)) {
    body.choices.forEach((choice: any, ci: number) => {
      if (choice.message?.content) {
        segments.push({ path: `choices.${ci}.message.content`, text: choice.message.content });
      }
      // Streaming delta
      if (choice.delta?.content) {
        segments.push({ path: `choices.${ci}.delta.content`, text: choice.delta.content });
      }
    });
  }
  return segments;
}

// ── Utility: get/set by dot path ──

function setByPath(obj: any, path: string, value: string): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? parseInt(parts[i], 10) : parts[i];
    current = current[key];
    if (current == null) return;
  }
  const lastKey = /^\d+$/.test(parts[parts.length - 1])
    ? parseInt(parts[parts.length - 1], 10)
    : parts[parts.length - 1];
  current[lastKey] = value;
}
