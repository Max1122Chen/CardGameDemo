import { describe, expect, it } from 'vitest';

import { ANSI, padVisible, sliceVisible, stripAnsi, style } from '../ansi.js';
import { renderTwinBoxes } from './box.js';
import { splitSharedPairWidths } from './columns.js';
import { formatField } from './field.js';

describe('field', () => {
  it('uses colon without a following space', () => {
    expect(formatField('HP', '30/30')).toBe('HP:30/30');
  });
});

describe('ansi visible pad/slice', () => {
  it('preserves color when truncating to visible width', () => {
    const colored = style('ABCDEF', ANSI.fg.red);
    const sliced = sliceVisible(colored, 3);
    expect(stripAnsi(sliced)).toBe('ABC');
    expect(sliced).toContain(ANSI.fg.red);
    expect(sliced.endsWith(ANSI.reset)).toBe(true);
  });

  it('preserves color when padding exact-width lines', () => {
    const colored = style('HP', ANSI.fg.red);
    const padded = padVisible(colored, 2);
    expect(padded).toBe(colored);
    expect(stripAnsi(padVisible(colored, 5))).toBe('HP   ');
    expect(padVisible(colored, 5)).toContain(ANSI.fg.red);
  });
});

describe('shared twin boxes', () => {
  it('uses a single shared vertical divider', () => {
    const lines = renderTwinBoxes('Player', ['a', 'b', 'c'], 20, 'Enemies', ['x'], 20);
    expect(lines).toHaveLength(5); // top + 3 body + bottom (equalized)
    const body = stripAnsi(lines[1]!);
    // One shared | between cells: | a | x |
    expect(body.match(/\|/g)?.length).toBe(3);
  });

  it('equalizes pane height to the taller side', () => {
    const lines = renderTwinBoxes('L', ['1', '2', '3'], 16, 'R', ['only'], 16);
    expect(lines).toHaveLength(5);
    expect(stripAnsi(lines[3]!)).toContain('3');
  });
});

describe('splitSharedPairWidths', () => {
  it('splits so left+right-1 equals total width', () => {
    const { left, right } = splitSharedPairWidths(80, 0.65);
    expect(left + right - 1).toBe(80);
    expect(left).toBeGreaterThan(right);
  });
});
