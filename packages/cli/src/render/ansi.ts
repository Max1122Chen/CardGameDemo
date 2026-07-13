export const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  inverse: '\u001b[7m',
  clearScreen: '\u001b[2J',
  home: '\u001b[H',
  eraseBelow: '\u001b[J',
  hideCursor: '\u001b[?25l',
  showCursor: '\u001b[?25h',
  altScreenOn: '\u001b[?1049h',
  altScreenOff: '\u001b[?1049l',
  fg: {
    black: '\u001b[30m',
    red: '\u001b[31m',
    green: '\u001b[32m',
    yellow: '\u001b[33m',
    blue: '\u001b[34m',
    magenta: '\u001b[35m',
    cyan: '\u001b[36m',
    white: '\u001b[37m',
    brightRed: '\u001b[91m',
    brightGreen: '\u001b[92m',
    brightYellow: '\u001b[93m',
    brightCyan: '\u001b[96m',
    brightWhite: '\u001b[97m',
  },
} as const;

// eslint-disable-next-line no-control-regex -- ANSI escape sequences must be stripped for layout width
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

export function padVisible(text: string, width: number): string {
  const visible = stripAnsi(text);
  if (visible.length >= width) {
    return visible.slice(0, width);
  }
  return `${text}${' '.repeat(width - visible.length)}`;
}

export function style(text: string, ...codes: string[]): string {
  if (codes.length === 0) {
    return text;
  }
  return `${codes.join('')}${text}${ANSI.reset}`;
}

/** Initial full paint when entering the alternate screen. */
export function paintInitialFrame(content: string): string {
  return `${ANSI.home}${content}${ANSI.eraseBelow}`;
}

/** Low-flicker repaint: move home, overwrite, erase tail. Avoid full-screen clear. */
export function paintFrame(content: string): string {
  return `${ANSI.home}${content}${ANSI.eraseBelow}`;
}

export function enterTuiScreen(): string {
  return `${ANSI.altScreenOn}${ANSI.hideCursor}`;
}

export function exitTuiScreen(): string {
  return `${ANSI.altScreenOff}${ANSI.showCursor}`;
}
