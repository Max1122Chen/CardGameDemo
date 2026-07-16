import { padVisible, ANSI } from './ansi.js';

export type TerminalSize = {
  cols: number;
  rows: number;
};

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export function resolveTerminalSize(source?: {
  columns?: number;
  rows?: number;
}): TerminalSize {
  const cols = source?.columns && source.columns > 0 ? source.columns : DEFAULT_COLS;
  const rows = source?.rows && source.rows > 0 ? source.rows : DEFAULT_ROWS;
  return { cols, rows };
}

/** Split content into lines and drop a single trailing empty line from a final `\n`. */
export function splitFrameLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/**
 * Fixed terminal framebuffer: exactly `rows` lines, each padded/truncated to `cols`
 * (ANSI-aware). Prevents ghosting when a shorter frame overwrites a taller one.
 */
export function composeFrameBuffer(content: string, cols: number, rows: number): string {
  const source = splitFrameLines(content);
  const out: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    out.push(padVisible(source[row] ?? '', cols));
  }
  return out.join('\n');
}

/** Home cursor + full fixed buffer (no eraseBelow — every cell is rewritten). */
export function paintBufferedFrame(content: string, size: TerminalSize): string {
  return `${ANSI.home}${composeFrameBuffer(content, size.cols, size.rows)}`;
}
