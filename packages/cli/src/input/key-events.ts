export type ParsedKey =
  | { kind: 'char'; char: string }
  | { kind: 'escape' }
  | { kind: 'enter' }
  | { kind: 'backspace' }
  | { kind: 'up' }
  | { kind: 'down' }
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'ctrl_c' }
  | { kind: 'unknown' };

export function parseKeypress(chunk: string): ParsedKey {
  if (chunk === '\u0003') {
    return { kind: 'ctrl_c' };
  }

  if (chunk === '\u001b') {
    return { kind: 'escape' };
  }

  if (chunk === '\r' || chunk === '\n') {
    return { kind: 'enter' };
  }

  if (chunk === '\u007f' || chunk === '\b') {
    return { kind: 'backspace' };
  }

  // Tab is outside printable range but used by inventory focus cycling.
  if (chunk === '\t') {
    return { kind: 'char', char: '\t' };
  }

  if (chunk === '\u001b[A') {
    return { kind: 'up' };
  }

  if (chunk === '\u001b[B') {
    return { kind: 'down' };
  }

  if (chunk === '\u001b[C') {
    return { kind: 'right' };
  }

  if (chunk === '\u001b[D') {
    return { kind: 'left' };
  }

  if (chunk.length === 1 && chunk >= ' ' && chunk <= '~') {
    return { kind: 'char', char: chunk };
  }

  return { kind: 'unknown' };
}
