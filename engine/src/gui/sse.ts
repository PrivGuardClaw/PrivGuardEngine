import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';

const HEARTBEAT_INTERVAL_MS = 30_000;

interface SSEConnection {
  id: string;
  response: ServerResponse;
}

export class SSEManager {
  private connections: Map<string, SSEConnection> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    // Allow process to exit even if timer is active
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  addConnection(res: ServerResponse): string {
    const id = randomUUID();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // Send initial connection event
    res.write(`event: connected\ndata: {"id":"${id}"}\n\n`);

    res.on('close', () => this.removeConnection(id));
    res.on('error', () => this.removeConnection(id));

    this.connections.set(id, { id, response: res });
    return id;
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, conn] of this.connections) {
      try {
        conn.response.write(payload);
      } catch {
        this.connections.delete(id);
      }
    }
  }

  sendHeartbeat(): void {
    this.broadcast('heartbeat', { ts: Date.now() });
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const conn of this.connections.values()) {
      try { conn.response.end(); } catch { /* ignore */ }
    }
    this.connections.clear();
  }

  connectionCount(): number {
    return this.connections.size;
  }
}
