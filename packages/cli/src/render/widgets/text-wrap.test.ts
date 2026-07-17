import { describe, expect, it } from 'vitest';

import { ANSI, stripAnsi, style, visibleLength } from '../ansi.js';
import { wrapAllVisible, wrapVisible } from './text-wrap.js';

describe('wrapVisible', () => {
  it('returns a single line when text fits', () => {
    expect(wrapVisible('hello', 10)).toEqual(['hello']);
  });

  it('hard-wraps when there are no spaces', () => {
    expect(wrapVisible('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('prefers breaking on spaces', () => {
    expect(wrapVisible('hello world friends', 10)).toEqual(['hello', 'world', 'friends']);
  });

  it('preserves ansi color across wrapped segments', () => {
    const colored = style('bright red message here', ANSI.fg.brightRed);
    const lines = wrapVisible(colored, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(10);
    }
    expect(stripAnsi(lines.join(' ')).replace(/\s+/g, ' ')).toContain('bright');
    expect(lines.some((line) => line.includes(ANSI.fg.brightRed))).toBe(true);
  });

  it('wraps each source line independently', () => {
    expect(wrapAllVisible(['aaa bbb', 'ccc'], 3)).toEqual(['aaa', 'bbb', 'ccc']);
  });
});
