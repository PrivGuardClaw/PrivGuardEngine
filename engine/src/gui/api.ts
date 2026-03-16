import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthModule } from './auth.js';
import type { RecordStore } from './record-store.js';
import type { RuleManager } from './rule-manager.js';
import type { SSEManager } from './sse.js';
import type { ProxyStatus } from './types.js';
import { SESSION_COOKIE_NAME } from './auth.js';
import { parseQueryString, readBody } from './utils.js';

export interface ApiContext {
  auth: AuthModule;
  records: RecordStore;
  rules: RuleManager;
  sse: SSEManager;
  proxyStatus: () => ProxyStatus;
  startProxy: () => boolean;
}

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function getSessionId(req: IncomingMessage, auth: AuthModule): string | undefined {
  return auth.getSessionIdFromCookie(req.headers.cookie);
}

function requireAuth(req: IncomingMessage, res: ServerResponse, auth: AuthModule): string | null {
  const sid = getSessionId(req, auth);
  if (!sid || !auth.validateSession(sid)) {
    json(res, 401, { error: 'Unauthorized' });
    return null;
  }
  auth.touchSession(sid);
  return sid;
}

export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ApiContext,
): Promise<boolean> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // ── SSE ──
  if (method === 'GET' && url === '/api/events') {
    if (!requireAuth(req, res, ctx.auth)) return true;
    ctx.sse.addConnection(res);
    return true;
  }

  // ── Auth ──
  if (method === 'POST' && url === '/api/login') {
    const body = await readBody(req);
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { parsed = {}; }
    if (ctx.auth.validatePassword(parsed.password ?? '')) {
      const session = ctx.auth.createSession();
      res.setHeader('Set-Cookie',
        `${SESSION_COOKIE_NAME}=${session.id}; HttpOnly; SameSite=Strict; Path=/`);
      json(res, 200, { success: true });
    } else {
      json(res, 401, { error: 'Invalid password' });
    }
    return true;
  }

  if (method === 'POST' && url === '/api/logout') {
    const sid = getSessionId(req, ctx.auth);
    if (sid) ctx.auth.destroySession(sid);
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    json(res, 200, { success: true });
    return true;
  }

  // All routes below require auth
  if (!url.startsWith('/api/')) return false;
  if (!requireAuth(req, res, ctx.auth)) return true;

  // ── Records ──
  if (method === 'GET' && url.startsWith('/api/records')) {
    const idMatch = url.match(/^\/api\/records\/([^?]+)/);
    if (idMatch) {
      const record = ctx.records.get(idMatch[1]);
      if (!record) { json(res, 404, { error: 'Record not found' }); return true; }
      json(res, 200, record);
      return true;
    }
    const q = parseQueryString(url);
    const result = ctx.records.query({
      page: q.page ? parseInt(q.page) : undefined,
      pageSize: q.pageSize ? parseInt(q.pageSize) : undefined,
      type: q.type || undefined,
      startTime: q.startTime ? parseInt(q.startTime) : undefined,
      endTime: q.endTime ? parseInt(q.endTime) : undefined,
    });
    json(res, 200, result);
    return true;
  }

  // ── Rules ──
  if (method === 'GET' && url === '/api/rules') {
    json(res, 200, ctx.rules.loadAll());
    return true;
  }

  if (method === 'POST' && url === '/api/rules/test') {
    const body = await readBody(req);
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { parsed = {}; }
    const validation = ctx.rules.validatePattern(parsed.pattern ?? '');
    if (!validation.valid) {
      json(res, 400, { error: 'Invalid regex pattern', detail: validation.error });
      return true;
    }
    const matches = ctx.rules.testRule(parsed.pattern, parsed.text ?? '');
    json(res, 200, { matches });
    return true;
  }

  if (method === 'POST' && url === '/api/rules/reload') {
    const { system, custom } = ctx.rules.loadAll();
    if (ctx.rules.onReload) ctx.rules.onReload([...system, ...custom]);
    json(res, 200, { success: true, count: system.length + custom.length });
    return true;
  }

  if (method === 'POST' && url === '/api/rules/custom') {
    const body = await readBody(req);
    let rule: any;
    try { rule = JSON.parse(body); } catch { json(res, 400, { error: 'Invalid JSON' }); return true; }
    const v = ctx.rules.validatePattern(rule.pattern ?? '');
    if (!v.valid) { json(res, 400, { error: 'Invalid regex pattern', detail: v.error }); return true; }
    try {
      ctx.rules.addCustomRule(rule);
      json(res, 200, { success: true });
    } catch (e: any) {
      json(res, 500, { error: e.message });
    }
    return true;
  }

  const putMatch = url.match(/^\/api\/rules\/custom\/(\d+)$/);
  if (putMatch) {
    const index = parseInt(putMatch[1]);
    if (method === 'PUT') {
      const body = await readBody(req);
      let rule: any;
      try { rule = JSON.parse(body); } catch { json(res, 400, { error: 'Invalid JSON' }); return true; }
      const v = ctx.rules.validatePattern(rule.pattern ?? '');
      if (!v.valid) { json(res, 400, { error: 'Invalid regex pattern', detail: v.error }); return true; }
      try {
        ctx.rules.updateCustomRule(index, rule);
        json(res, 200, { success: true });
      } catch (e: any) {
        json(res, 404, { error: e.message });
      }
      return true;
    }
    if (method === 'DELETE') {
      try {
        ctx.rules.deleteCustomRule(index);
        json(res, 200, { success: true });
      } catch (e: any) {
        json(res, 404, { error: e.message });
      }
      return true;
    }
  }

  if (method === 'GET' && url === '/api/rules/changelog') {
    json(res, 200, ctx.rules.getChangeLogs());
    return true;
  }

  // ── Proxy Status ──
  if (method === 'GET' && url === '/api/proxy/status') {
    json(res, 200, ctx.proxyStatus());
    return true;
  }

  if (method === 'POST' && url === '/api/proxy/start') {
    const started = ctx.startProxy();
    json(res, 200, { success: started });
    return true;
  }

  // Not matched
  json(res, 404, { error: 'Not found' });
  return true;
}
