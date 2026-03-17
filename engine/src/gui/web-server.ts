import { createServer } from 'node:http';
import { AuthModule, SESSION_COOKIE_NAME } from './auth.js';
import { RecordStore } from './record-store.js';
import { RuleManager } from './rule-manager.js';
import { SSEManager } from './sse.js';
import { handleApi } from './api.js';
import type { WebServerConfig, WebServerHandle, ProxyStatus } from './types.js';

// Static assets — imported as text strings.
// esbuild resolves these via the inline-static plugin (loader: 'text').
// In non-bundled (dev) mode, the plugin is absent and these fall back to disk reads.
// @ts-ignore - resolved by esbuild inline-static plugin
import indexHtml from './static/index.html';
// @ts-ignore - resolved by esbuild inline-static plugin
import loginHtml from './static/login.html';
// @ts-ignore - resolved by esbuild inline-static plugin
import styleCss from './static/style.css';
// @ts-ignore - resolved by esbuild inline-static plugin
import appJs from './static/app.js';

const STATIC_FILES: Record<string, { content: string; mime: string }> = {
  '/index.html': { content: indexHtml, mime: 'text/html; charset=utf-8' },
  '/login.html': { content: loginHtml, mime: 'text/html; charset=utf-8' },
  '/style.css':  { content: styleCss,  mime: 'text/css; charset=utf-8' },
  '/app.js':     { content: appJs,     mime: 'application/javascript; charset=utf-8' },
};

export interface WebServerDeps {
  auth: AuthModule;
  records: RecordStore;
  rules: RuleManager;
  sse: SSEManager;
  proxyStatus: () => ProxyStatus;
  startProxy: () => boolean;
}

export function startWebServer(
  config: WebServerConfig,
  deps: WebServerDeps,
): WebServerHandle {
  const staticFiles = STATIC_FILES;

  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';

    // ── API routes ──
    if (url.startsWith('/api/')) {
      const handled = await handleApi(req, res, {
        auth: deps.auth,
        records: deps.records,
        rules: deps.rules,
        sse: deps.sse,
        proxyStatus: deps.proxyStatus,
        startProxy: deps.startProxy,
      });
      if (handled) return;
    }

    // ── Auth check for non-API routes ──
    const sid = deps.auth.getSessionIdFromCookie(req.headers.cookie);
    const isAuthenticated = sid ? deps.auth.validateSession(sid) : false;

    if (!isAuthenticated && url !== '/login.html') {
      res.writeHead(302, { Location: '/login.html' });
      res.end();
      return;
    }

    // ── Static files ──
    const filePath = url === '/' ? '/index.html' : url.split('?')[0];
    const file = staticFiles[filePath];

    if (file) {
      res.writeHead(200, { 'Content-Type': file.mime });
      res.end(file.content);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(config.port, '127.0.0.1', () => {
    process.stdout.write(
      `\n🛡️  PrivGuard GUI 已启动\n` +
      `   访问地址: http://localhost:${config.port}\n\n`
    );
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(
        `错误: GUI 端口 ${config.port} 已被占用。请使用 --port 指定其他端口。\n`
      );
      process.exit(1);
    }
    process.stderr.write(`Web 服务器错误: ${err.message}\n`);
  });

  return {
    stop: () => {
      deps.sse.stop();
      server.close();
    },
    getPort: () => config.port,
  };
}
