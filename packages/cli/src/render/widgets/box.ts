import { padVisible, style, ANSI } from '../ansi.js';
import { theme } from '../theme.js';
import { wrapAllVisible } from './text-wrap.js';

/** Bordered pane; `width` is total outer width including borders. Lines wrap to inner width. */
export function renderBox(title: string, lines: string[], width: number): string[] {
  const safeWidth = Math.max(width, 8);
  const inner = safeWidth - 4;
  const wrapped = wrapAllVisible(lines, inner);
  const border = style('+', ANSI.dim);
  const output = [`${border} ${padVisible(theme.paneTitle(title), safeWidth - 3)}+`];
  for (const line of wrapped) {
    output.push(`${border} ${padVisible(line, inner)} ${border}`);
  }
  output.push(`${border}${style('-'.repeat(safeWidth - 2), ANSI.dim)}+`);
  return output;
}

/**
 * Two panes sharing one vertical divider (single line between cells).
 * Outer widths are as-if-standalone box widths; joined total = left + right - 1.
 * Content is wrapped to each pane's inner width, then padded to equal height.
 */
export function renderTwinBoxes(
  leftTitle: string,
  leftLines: readonly string[],
  leftOuterWidth: number,
  rightTitle: string,
  rightLines: readonly string[],
  rightOuterWidth: number,
): string[] {
  const leftW = Math.max(leftOuterWidth, 8);
  const rightW = Math.max(rightOuterWidth, 8);
  const leftInner = leftW - 4;
  const rightInner = rightW - 4;

  const leftPad = wrapAllVisible(leftLines, leftInner);
  const rightPad = wrapAllVisible(rightLines, rightInner);
  const height = Math.max(leftPad.length, rightPad.length, 1);
  while (leftPad.length < height) {
    leftPad.push('');
  }
  while (rightPad.length < height) {
    rightPad.push('');
  }

  const corner = style('+', ANSI.dim);
  const edge = style('|', ANSI.dim);
  const rule = (n: number) => style('-'.repeat(Math.max(0, n)), ANSI.dim);

  const top = `${corner} ${padVisible(theme.paneTitle(leftTitle), leftW - 3)}${corner} ${padVisible(theme.paneTitle(rightTitle), rightW - 3)}${corner}`;
  const bottom = `${corner}${rule(leftW - 2)}${corner}${rule(rightW - 2)}${corner}`;

  const body = leftPad.map((leftLine, index) => {
    const rightLine = rightPad[index] ?? '';
    return `${edge} ${padVisible(leftLine, leftInner)} ${edge} ${padVisible(rightLine, rightInner)} ${edge}`;
  });

  return [top, ...body, bottom];
}
