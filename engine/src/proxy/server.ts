/**
 * PrivGuard Proxy Server
 *
 * A local HTTP proxy that sits between AI agent CLIs and LLM APIs.
 * Intercepts requests to sanitize PII before it leaves the machine,
 * and restores placeholders in responses.
 *
 * Architecture:
 *   Agent CLI → PrivGuard Proxy (localhost) → [sanitize] → Real API
 *   Real API → PrivGuard Proxy → [restore] → Agent CLI
 *
 * Supports:
 *   - Anthropic Messages API (Claude Code)
 *   - OpenAI Chat Completions API (OpenCode, OpenClaw, Cursor, etc.)
 *   - Streaming (SSE) responses with real-time restoration
 *
 * Fixes applied:
 *   - #1: Upstream URL auto-detected from saved agent config
 *   - #2: Per-request registry isolation (no cross-request leaks)
 *   - #3: Streaming placeholder buffering (handles truncated placeholders)
 *   - #4: tool_use input scanning
 */
import { createServer, request as httpRequest, IncomingMessage, ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import { PrivGuardEngine } from '../engine.js';
import type { Rule } from '../types.js';
import {
  detectFormat,
  extractRequestTexts,
  rewriteRequestTexts,
  extractResponseTexts,
  type ApiFormat,
} from './adapters.js';
import { displaySanitizeEvent, displayError, displayInfo } from './display.js';
import { detectUpstreamUrl } from './config.js';

export interface ProxyConfig {
  port: number;
  rules: Rule[];
  /** If set, all requests are forwarded here. Otherwise, auto-detect from saved agent config. */
  upstreamBaseUrl?: string;
  /** Show verbose logging */
  verbose?: boolean;
  /** Strict mode: never show partial original values in terminal */
  strict?: boolean;
}

/**
 * Start the PrivGuard proxy server.
 * Returns a handle to stop it.
 */
export function startProxy(config: ProxyConfig): { stop: () => void } {
  // Fix #1: Auto-detect upstream from saved agent config if not explicitly set
  if (!config.upstreamBaseUrl) {
    const detected = detectUpstreamUrl();
    if (detected) {
      config.upstreamBaseUrl = detected;
      displayInfo(`Auto-detected upstream: ${detected}`);
    }
  }

  // Fix #5: Use a single engine instance per proxy session so mappings persist
  // across multiple requests (e.g., Claude Code sends multiple API calls per turn).
  // Per-request isolation was causing restoration failures when placeholders from
  // request N appeared in the response of request N+1.
  const engine = new PrivGuardEngine({
    mode: 'auto',
    rules: config.rules,
    placeholderPrefix: 'PG',
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await handleRequest(req, res, config, engine);
    } catch (err: any) {
      displayError(`Proxy error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PrivGuard proxy error', detail: err.message }));
      }
    }
  });

  server.listen(config.port, '127.0.0.1', () => {
    // Banner is printed by CLI
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      displayError(`Port ${config.port} is already in use. Try: PRIVGUARD_PORT=19821 npx privguard-proxy`);
      process.exit(1);
    }
    displayError(`Server error: ${err.message}`);
  });

  return {
    stop: () => {
      server.close();
    },
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: ProxyConfig,
  engine: PrivGuardEngine,
): Promise<void> {

  // Read request body
  const bodyBuf = await readBody(req);
  const bodyStr = bodyBuf.toString('utf-8');

  let body: any;
  try {
    body = JSON.parse(bodyStr);
  } catch {
    // Not JSON — pass through as-is
    return forwardRaw(req, res, bodyBuf, config);
  }

  const urlPath = req.url || '/';
  const format = detectFormat(urlPath, body);
  const isStreaming = body?.stream === true;

  // ── Step 1: Sanitize request ──
  const segments = extractRequestTexts(body, format);
  const sanitizeItems: Array<{ type: string; original: string; placeholder: string }> = [];

  for (const seg of segments) {
    const result = await engine.sanitize(seg.text);
    if (result.report.totalSanitized > 0) {
      seg.text = result.sanitized;
      for (const entry of result.mappings) {
        sanitizeItems.push({
          type: entry.type,
          original: entry.originalValue,
          placeholder: entry.placeholder,
        });
      }
    }
  }

  // Rewrite body with sanitized text
  if (sanitizeItems.length > 0) {
    rewriteRequestTexts(body, segments);

    displaySanitizeEvent({
      direction: 'request',
      format: format,
      totalDetected: sanitizeItems.length,
      totalSanitized: sanitizeItems.length,
      types: [...new Set(sanitizeItems.map(i => i.type))],
      items: config.strict
        ? sanitizeItems.map(i => ({ ...i, original: '****' }))
        : sanitizeItems,
    });
  }

  const sanitizedBody = JSON.stringify(body);

  // ── Step 2: Forward to upstream ──
  if (isStreaming) {
    await forwardStreaming(req, res, sanitizedBody, engine, format, config);
  } else {
    await forwardAndRestore(req, res, sanitizedBody, engine, format, config);
  }
}

/** Forward non-streaming request, restore placeholders in response */
async function forwardAndRestore(
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
  engine: PrivGuardEngine,
  format: ApiFormat,
  config: ProxyConfig,
): Promise<void> {
  const upstream = resolveUpstream(req, config);
  const responseData = await makeRequest(upstream, req.method || 'POST', req.headers, body);

  // Try to parse and restore response
  let responseBody: string;
  try {
    const respJson = JSON.parse(responseData.body);
    const respSegments = extractResponseTexts(respJson, format);
    let restoredCount = 0;

    for (const seg of respSegments) {
      const result = engine.restore(seg.text);
      if (result.restored !== seg.text) {
        seg.text = result.restored;
        restoredCount++;
      }
    }

    if (restoredCount > 0) {
      rewriteRequestTexts(respJson, respSegments); // reuse — same set/get logic
      displaySanitizeEvent({
        direction: 'response',
        format,
        totalDetected: restoredCount,
        totalSanitized: restoredCount,
        types: ['restored'],
        items: [],
      });
    }

    responseBody = JSON.stringify(respJson);
  } catch {
    // Not JSON response — pass through
    responseBody = responseData.body;
  }

  // Forward response headers
  for (const [key, value] of Object.entries(responseData.headers)) {
    if (key.toLowerCase() === 'transfer-encoding') continue;
    if (key.toLowerCase() === 'content-length') continue;
    if (value) res.setHeader(key, value);
  }
  res.setHeader('content-length', Buffer.byteLength(responseBody));
  res.writeHead(responseData.statusCode);
  res.end(responseBody);
}

/**
 * Fix #3: Forward streaming (SSE) request with placeholder buffering.
 * Handles truncated placeholders that span multiple SSE chunks by
 * buffering incomplete `{{PG:...` sequences until they close with `}}`.
 */
async function forwardStreaming(
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
  engine: PrivGuardEngine,
  format: ApiFormat,
  config: ProxyConfig,
): Promise<void> {
  const upstream = resolveUpstream(req, config);
  const url = new URL(upstream);
  const isHttps = url.protocol === 'https:';
  const reqFn = isHttps ? httpsRequest : httpRequest;

  const headers = buildForwardHeaders(req.headers, url.hostname, body);

  const proxyReq = reqFn(
    {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: req.method || 'POST',
      headers,
    },
    (proxyRes) => {
      // Forward status and headers
      const respHeaders = { ...proxyRes.headers };
      delete respHeaders['content-length']; // Streaming — no fixed length
      res.writeHead(proxyRes.statusCode || 200, respHeaders);

      // Stream data through, restoring placeholders in SSE events
      let eventBuffer = '';
      // Fix #3: Track incomplete placeholder across SSE events
      let pendingText = '';

      proxyRes.on('data', (chunk: Buffer) => {
        const raw = chunk.toString('utf-8');
        if (config.verbose) {
          process.stderr.write(`[VERBOSE SSE RAW] ${JSON.stringify(raw)}\n`);
        }
        eventBuffer += raw;

        // Process complete SSE events (lines ending with \n\n)
        const events = eventBuffer.split('\n\n');
        eventBuffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const event of events) {
          if (config.verbose) {
            process.stderr.write(`[VERBOSE SSE EVENT] ${JSON.stringify(event)}\n`);
          }
          const restored = restoreSSEEvent(event, engine, format, pendingText, config.verbose);
          pendingText = restored.pending;
          res.write(restored.text + '\n\n');
        }
      });

      proxyRes.on('end', () => {
        if (eventBuffer) {
          const restored = restoreSSEEvent(eventBuffer, engine, format, pendingText, config.verbose);
          res.write(restored.text);
        }
        res.end();
      });

      proxyRes.on('error', (err) => {
        displayError(`Upstream response error: ${err.message}`);
        res.end();
      });
    },
  );

  proxyReq.on('error', (err) => {
    displayError(`Upstream request error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream connection failed', detail: err.message }));
    }
  });

  proxyReq.write(body);
  proxyReq.end();
}

interface RestoreSSEResult {
  text: string;
  /** Incomplete placeholder fragment to carry over to next chunk */
  pending: string;
}

/**
 * Fix #3: Restore placeholders in a single SSE event, handling truncated placeholders.
 * If a placeholder like `{{PG:PHONE_1}}` is split across chunks, the incomplete
 * `{{PG:PHO` part is held in `pending` and prepended to the next chunk.
 */
function restoreSSEEvent(
  event: string,
  engine: PrivGuardEngine,
  format: ApiFormat,
  pendingFromPrev: string,
  verbose?: boolean,
): RestoreSSEResult {
  const lines = event.split('\n');
  const restored: string[] = [];
  let pending = '';

  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      const jsonStr = line.slice(6);
      try {
        const data = JSON.parse(jsonStr);
        if (verbose) {
          const deltaType = data.delta?.type ?? 'n/a';
          const deltaText = data.delta?.text ?? data.delta?.thinking ?? '';
          process.stderr.write(`[VERBOSE PARSED] type=${data.type} delta_type=${deltaType} text=${JSON.stringify(deltaText.slice(0, 40))}\n`);
        }
        const segments = extractResponseTexts(data, format);
        if (verbose) {
          process.stderr.write(`[VERBOSE SEGMENTS] count=${segments.length} paths=${segments.map(s => s.path).join(',')}\n`);
        }
        for (const seg of segments) {
          // Prepend any pending text from previous chunk
          const fullText = pendingFromPrev + seg.text;
          pendingFromPrev = ''; // Only use once

          // Check for incomplete placeholder at end of text
          const { clean, remainder } = splitIncomplete(fullText);
          pending = remainder;

          if (verbose && clean.includes('<|PG:')) {
            process.stderr.write(`[VERBOSE RESTORE] found placeholder in: ${JSON.stringify(clean)}\n`);
            process.stderr.write(`[VERBOSE RESTORE] registry size: ${engine.getMappings().length}\n`);
          }
          const result = engine.restore(clean);
          if (verbose && result.restored !== clean) {
            process.stderr.write(`[VERBOSE RESTORE] restored: ${JSON.stringify(result.restored)}\n`);
          }
          seg.text = result.restored;
        }
        rewriteRequestTexts(data, segments);
        restored.push('data: ' + JSON.stringify(data));
      } catch {
        restored.push(line); // Not JSON, pass through
      }
    } else {
      restored.push(line);
    }
  }

  return { text: restored.join('\n'), pending };
}

/**
 * Fix #3: Split text at an incomplete placeholder boundary.
 * If text ends with an unclosed `<|PG:...` (no closing `|>`),
 * split it so the incomplete part is buffered for the next chunk.
 * Also supports legacy `{{PG:...` format for backward compatibility.
 */
function splitIncomplete(text: string): { clean: string; remainder: string } {
  // Check for new format <|...|> first
  const lastOpenNew = text.lastIndexOf('<|');
  if (lastOpenNew !== -1) {
    const afterOpenNew = text.indexOf('|>', lastOpenNew);
    if (afterOpenNew === -1) {
      // No closing |> found after the last <| — this is incomplete
      return { clean: text.slice(0, lastOpenNew), remainder: text.slice(lastOpenNew) };
    }
    // Found closing — check if there's another unclosed one after
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
    // Found closing — check if there's another unclosed one after
    const nextOpen = text.indexOf('{{', afterOpen + 2);
    if (nextOpen === -1) return { clean: text, remainder: '' };
    // Recurse on the tail
    const tail = splitIncomplete(text.slice(nextOpen));
    if (tail.remainder) {
      return { clean: text.slice(0, nextOpen) + tail.clean, remainder: tail.remainder };
    }
    return { clean: text, remainder: '' };
  }

  // No closing `}}` found after the last `{{` — this is incomplete
  return { clean: text.slice(0, lastOpen), remainder: text.slice(lastOpen) };
}

/** Forward raw (non-JSON) request */
async function forwardRaw(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
  config: ProxyConfig,
): Promise<void> {
  const upstream = resolveUpstream(req, config);
  const url = new URL(upstream);
  const isHttps = url.protocol === 'https:';
  const reqFn = isHttps ? httpsRequest : httpRequest;

  const headers = { ...req.headers };
  headers.host = url.host;

  const proxyReq = reqFn(
    {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || '') + (req.url || ''),
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    displayError(`Forward error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end('Upstream error');
    }
  });

  proxyReq.write(body);
  proxyReq.end();
}

// ── Helpers ──

/**
 * Fix #1: Resolve upstream URL.
 * Priority: explicit config > x-privguard-upstream header > saved agent config > Anthropic default
 */
function resolveUpstream(req: IncomingMessage, config: ProxyConfig): string {
  if (config.upstreamBaseUrl) {
    const base = config.upstreamBaseUrl.replace(/\/$/, '');
    return base + (req.url || '');
  }

  // Check custom header (set by some agent adapters)
  const forwardedHost = req.headers['x-privguard-upstream'] as string;
  if (forwardedHost) {
    return forwardedHost + (req.url || '');
  }

  // Default: Anthropic API (most common case for Claude Code)
  return 'https://api.anthropic.com' + (req.url || '');
}

function buildForwardHeaders(
  originalHeaders: IncomingMessage['headers'],
  targetHost: string,
  body: string,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(originalHeaders)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    // Skip hop-by-hop headers
    if (lower === 'host' || lower === 'connection' || lower === 'transfer-encoding') continue;
    if (lower === 'x-privguard-upstream') continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  headers['host'] = targetHost;
  headers['content-length'] = String(Buffer.byteLength(body));

  return headers;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function makeRequest(
  url: string,
  method: string,
  originalHeaders: IncomingMessage['headers'],
  body: string,
): Promise<{ statusCode: number; headers: Record<string, any>; body: string }> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const reqFn = isHttps ? httpsRequest : httpRequest;
  const headers = buildForwardHeaders(originalHeaders, parsed.hostname, body);

  return new Promise((resolve, reject) => {
    const proxyReq = reqFn(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 200,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
        res.on('error', reject);
      },
    );

    proxyReq.on('error', reject);
    proxyReq.write(body);
    proxyReq.end();
  });
}
