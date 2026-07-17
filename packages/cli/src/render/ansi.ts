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
  bg: {
    black: '\u001b[40m',
    red: '\u001b[41m',
    green: '\u001b[42m',
    yellow: '\u001b[43m',
    blue: '\u001b[44m',
    magenta: '\u001b[45m',
    cyan: '\u001b[46m',
    white: '\u001b[47m',
    brightCyan: '\u001b[106m',
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

/**
 * Take the first `maxVisible` visible characters, preserving ANSI sequences.
 * Appends reset only if truncation cut through styled text.
 */
export function sliceVisible(text: string, maxVisible: number): string {
  if (maxVisible <= 0) {
    return '';
  }
  let visible = 0;
  let i = 0;
  let result = '';
  let sawAnsi = false;
  while (i < text.length && visible < maxVisible) {
    if (text[i] === '\u001b' && text[i + 1] === '[') {
      const end = text.indexOf('m', i + 2);
      if (end < 0) {
        result += text.slice(i);
        break;
      }
      sawAnsi = true;
      result += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    result += text[i];
    visible += 1;
    i += 1;
  }
  if (sawAnsi && i < text.length && !result.endsWith(ANSI.reset)) {
    result += ANSI.reset;
  }
  return result;
}

/** Pad or truncate to `width` visible columns without stripping color codes. */
export function padVisible(text: string, width: number): string {
  const len = visibleLength(text);
  if (len > width) {
    return sliceVisible(text, width);
  }
  if (len === width) {
    return text;
  }
  return `${text}${' '.repeat(width - len)}`;
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
