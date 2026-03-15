/**
 * Terminal display for real-time sanitization feedback.
 * Shows colorful diffs when PII is detected and sanitized.
 */

const ANSI = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  strikethrough: '\x1b[9m',
};

export interface SanitizeEvent {
  direction: 'request' | 'response';
  format: string;
  totalDetected: number;
  totalSanitized: number;
  types: string[];
  items: Array<{
    type: string;
    original: string;
    placeholder: string;
  }>;
  /** Fix #6: If true, original values are already masked as '****' */
  strict?: boolean;
}

export function displayBanner(port: number, targetUrl: string): void {
  console.log('');
  console.log(`${ANSI.bold}${ANSI.green}🛡️  PrivGuard Proxy${ANSI.reset}`);
  console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
  console.log(`${ANSI.cyan}  Listening:${ANSI.reset}  http://localhost:${port}`);
  console.log(`${ANSI.cyan}  Upstream:${ANSI.reset}   ${targetUrl || 'auto-detect from request'}`);
  console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
  console.log(`${ANSI.dim}  All PII in requests will be sanitized before forwarding.${ANSI.reset}`);
  console.log(`${ANSI.dim}  Placeholders in responses will be restored automatically.${ANSI.reset}`);
  console.log('');
}

export function displaySanitizeEvent(event: SanitizeEvent): void {
  if (event.totalDetected === 0) return;

  const arrow = event.direction === 'request'
    ? `${ANSI.yellow}→ REQUEST${ANSI.reset}`
    : `${ANSI.cyan}← RESPONSE${ANSI.reset}`;

  console.log('');
  console.log(`${ANSI.bold}🛡️  ${arrow}  ${ANSI.dim}[${event.format}]${ANSI.reset}`);
  console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);

  for (const item of event.items) {
    const masked = maskValue(item.original);
    if (event.direction === 'request') {
      console.log(
        `  ${ANSI.red}${ANSI.strikethrough}${masked}${ANSI.reset}` +
        ` → ${ANSI.green}${ANSI.bold}${item.placeholder}${ANSI.reset}` +
        ` ${ANSI.dim}[${item.type}]${ANSI.reset}`
      );
    } else {
      console.log(
        `  ${ANSI.green}${item.placeholder}${ANSI.reset}` +
        ` → ${ANSI.cyan}${masked}${ANSI.reset}` +
        ` ${ANSI.dim}[restored]${ANSI.reset}`
      );
    }
  }

  console.log(
    `${ANSI.dim}  Total: ${event.totalDetected} detected, ` +
    `${event.totalSanitized} ${event.direction === 'request' ? 'sanitized' : 'restored'}` +
    ` (${event.types.join(', ')})${ANSI.reset}`
  );
}

export function displayError(msg: string): void {
  console.error(`${ANSI.red}${ANSI.bold}✗${ANSI.reset} ${msg}`);
}

export function displayInfo(msg: string): void {
  console.log(`${ANSI.dim}  ${msg}${ANSI.reset}`);
}

/** Mask a value for terminal display: "13812345678" → "138****5678" */
function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  if (value.length <= 8) return value.slice(0, 2) + '****' + value.slice(-2);
  const showLen = Math.min(3, Math.floor(value.length / 4));
  return value.slice(0, showLen) + '****' + value.slice(-showLen);
}
