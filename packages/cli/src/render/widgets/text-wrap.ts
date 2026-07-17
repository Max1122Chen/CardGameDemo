import { ANSI, sliceVisible, visibleLength } from '../ansi.js';

/**
 * Wrap text to `width` visible columns, preserving ANSI codes.
 * Breaks on spaces when possible; otherwise hard-wraps.
 */
export function wrapVisible(text: string, width: number): string[] {
  if (width <= 0) {
    return [];
  }
  if (visibleLength(text) === 0) {
    return [text];
  }
  if (visibleLength(text) <= width) {
    return [text];
  }

  const lines: string[] = [];
  let remaining = text;

  while (visibleLength(remaining) > width) {
    const breakAt = findBreakVisibleIndex(remaining, width);
    const take = sliceVisible(remaining, breakAt);
    remaining = dropVisiblePrefix(remaining, breakAt);
    remaining = dropLeadingVisibleSpace(remaining);
    lines.push(ensureAnsiClosed(take));
  }

  if (visibleLength(remaining) > 0 || remaining.includes('\u001b')) {
    lines.push(remaining);
  }
  return lines.length > 0 ? lines : [''];
}

export function wrapAllVisible(lines: readonly string[], width: number): string[] {
  return lines.flatMap((line) => wrapVisible(line, width));
}

function ensureAnsiClosed(text: string): string {
  if (text.includes('\u001b[') && !text.endsWith(ANSI.reset)) {
    return `${text}${ANSI.reset}`;
  }
  return text;
}

/** Visible length to take for the next wrapped line (excludes a trailing break space). */
function findBreakVisibleIndex(text: string, width: number): number {
  let visible = 0;
  let lastSpaceVisible: number | undefined;
  let i = 0;
  while (i < text.length && visible < width) {
    if (text[i] === '\u001b' && text[i + 1] === '[') {
      const end = text.indexOf('m', i + 2);
      if (end < 0) {
        break;
      }
      i = end + 1;
      continue;
    }
    if (text[i] === ' ') {
      lastSpaceVisible = visible;
    }
    visible += 1;
    i += 1;
  }
  if (lastSpaceVisible !== undefined && lastSpaceVisible > 0) {
    return lastSpaceVisible;
  }
  return width;
}

function dropVisiblePrefix(text: string, count: number): string {
  if (count <= 0) {
    return text;
  }
  let visible = 0;
  let i = 0;
  let openCodes = '';
  while (i < text.length && visible < count) {
    if (text[i] === '\u001b' && text[i + 1] === '[') {
      const end = text.indexOf('m', i + 2);
      if (end < 0) {
        return '';
      }
      openCodes = text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    visible += 1;
    i += 1;
  }
  const rest = text.slice(i);
  if (openCodes && rest.length > 0 && !rest.startsWith('\u001b')) {
    return `${openCodes}${rest}`;
  }
  return rest;
}

function dropLeadingVisibleSpace(text: string): string {
  let i = 0;
  let prefix = '';
  while (i < text.length) {
    if (text[i] === '\u001b' && text[i + 1] === '[') {
      const end = text.indexOf('m', i + 2);
      if (end < 0) {
        break;
      }
      prefix += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (text[i] === ' ') {
      i += 1;
      return prefix + text.slice(i);
    }
    break;
  }
  return text;
}
