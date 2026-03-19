/**
 * Zero-dependency interactive checkbox prompt.
 * Space = toggle, Enter = confirm, ↑↓ = navigate, Ctrl+C = cancel.
 */

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const DIM    = '\x1b[2m';
const CLEAR_LINE = '\x1b[2K\x1b[G';

export interface CheckboxItem {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
}

/**
 * Show an interactive checkbox list.
 * Returns the indices of selected items, or null if cancelled.
 */
export async function checkbox(
  title: string,
  items: CheckboxItem[],
): Promise<number[] | null> {
  if (!process.stdin.isTTY) {
    return items.map((it, i) => ({ it, i })).filter(x => x.it.checked && !x.it.disabled).map(x => x.i);
  }

  let cursor = 0;
  // Skip leading disabled items for initial cursor position
  while (cursor < items.length && items[cursor].disabled) cursor++;

  const checked = new Set(items.map((it, i) => it.checked ? i : -1).filter(i => i >= 0));

  // Each render outputs exactly: 1 (title) + 1 (hint) + 1 (blank) + N (items) lines
  const RENDER_LINES = 3 + items.length;

  const render = () => {
    const lines: string[] = [];
    lines.push(`${BOLD}${title}${RESET}`);
    lines.push(`${DIM}↑↓ 移动  空格 选择  回车 确认  Ctrl+C 取消${RESET}`);
    lines.push('');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isCursor = i === cursor;
      const isChecked = checked.has(i);
      const circle = isChecked ? `${GREEN}◉${RESET}` : `○`;
      const arrow = isCursor ? `${CYAN}❯${RESET}` : ' ';
      const label = item.disabled
        ? `${DIM}${item.label}${RESET}`
        : isCursor ? `${BOLD}${item.label}${RESET}` : item.label;
      const hint = item.hint ? ` ${DIM}${item.hint}${RESET}` : '';
      lines.push(`  ${arrow} ${circle}  ${label}${hint}`);
    }
    process.stdout.write('\x1b[?25l');
    process.stdout.write(lines.join('\n') + '\n');
  };

  const clearRender = () => {
    // Move up RENDER_LINES lines and clear each
    for (let i = 0; i < RENDER_LINES; i++) {
      process.stdout.write('\x1b[1A\x1b[2K');
    }
  };

  // Print a blank line before the prompt so clearRender doesn't eat previous output
  process.stdout.write('\n');
  render();

  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf-8');

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\x1b[?25h');
    };

    const onData = (key: string) => {
      const UP     = '\x1b[A';
      const DOWN   = '\x1b[B';
      const SPACE  = ' ';
      const ENTER  = '\r';
      const CTRL_C = '\x03';

      if (key === CTRL_C) {
        clearRender();
        cleanup();
        process.stdout.write('\n');
        resolve(null);
        return;
      }

      if (key === UP) {
        let next = (cursor - 1 + items.length) % items.length;
        while (items[next].disabled && next !== cursor) next = (next - 1 + items.length) % items.length;
        if (!items[next].disabled) cursor = next;
      } else if (key === DOWN) {
        let next = (cursor + 1) % items.length;
        while (items[next].disabled && next !== cursor) next = (next + 1) % items.length;
        if (!items[next].disabled) cursor = next;
      } else if (key === SPACE) {
        if (!items[cursor].disabled) {
          if (checked.has(cursor)) checked.delete(cursor);
          else checked.add(cursor);
        }
      } else if (key === ENTER) {
        clearRender();
        cleanup();
        process.stdout.write('\n');
        resolve([...checked]);
        return;
      }

      clearRender();
      render();
    };

    stdin.on('data', onData);
  });
}
