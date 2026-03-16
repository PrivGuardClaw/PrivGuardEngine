import { randomBytes } from 'node:crypto';

/**
 * Mask a sensitive value for display.
 * Values longer than 4 chars: keep first 2 and last 2, replace middle with ****
 * Shorter values: replace entirely with ****
 */
export function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

/**
 * Generate a random 8-character alphanumeric password.
 */
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

/**
 * Format a Unix timestamp (ms) to a human-readable local time string.
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Parse query string from a URL path like /api/records?page=1&type=PHONE
 */
export function parseQueryString(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const qs = url.slice(idx + 1);
  const result: Record<string, string> = {};
  for (const part of qs.split('&')) {
    const [key, val] = part.split('=');
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(val ?? '');
  }
  return result;
}

/**
 * Read the full body of an IncomingMessage as a string.
 */
export async function readBody(req: { [Symbol.asyncIterator](): AsyncIterator<Buffer> }): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Truncate a string to maxLen, appending '...' if truncated.
 */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '...';
}
