import { describe, expect, it } from 'vitest';

import { padVisible, paintFrame, stripAnsi, style, ANSI } from './ansi.js';
import { formatPlayerStats } from './theme.js';

describe('ansi helpers', () => {
  it('strips ansi codes for visible width', () => {
    const text = style('HP', ANSI.bold, ANSI.fg.red);
    expect(stripAnsi(text)).toBe('HP');
    expect(padVisible(text, 6)).toBe(`${text}    `);
  });

  it('paints frames with home cursor instead of full clear', () => {
    expect(paintFrame('line')).toBe('\u001b[Hline\u001b[J');
  });
});

describe('theme', () => {
  it('colors health block and ap segments', () => {
    const line = formatPlayerStats(30, 5, 3);
    expect(stripAnsi(line)).toContain('HP');
    expect(stripAnsi(line)).toContain('30');
    expect(stripAnsi(line)).toContain('Block');
    expect(stripAnsi(line)).toContain('AP');
  });
});
