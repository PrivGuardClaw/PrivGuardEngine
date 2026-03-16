import { randomUUID } from 'node:crypto';
import type { Session } from './types.js';

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_COOKIE_NAME = 'privguard_session';

export class AuthModule {
  private password: string;
  private sessions: Map<string, Session> = new Map();

  constructor(password: string) {
    this.password = password;
  }

  validatePassword(input: string): boolean {
    return input === this.password;
  }

  createSession(): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      createdAt: now,
      lastActivity: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  validateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (Date.now() - session.lastActivity > SESSION_MAX_AGE) {
      this.sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > SESSION_MAX_AGE) {
        this.sessions.delete(id);
      }
    }
  }

  /** Extract session ID from Cookie header */
  getSessionIdFromCookie(cookieHeader: string | undefined): string | undefined {
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return match?.[1];
  }
}
