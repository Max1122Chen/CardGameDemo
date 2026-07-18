import { describe, expect, it } from 'vitest';

import { stripAnsi } from '../ansi.js';
import { renderBox, renderTwinBoxes } from './box.js';

describe('renderBox', () => {
  it('wraps long lines to the inner width', () => {
    const lines = renderBox('T', ['abcdefghijklmnopqrstuvwxyz'], 12);
    // outer 12 → inner 8; body rows between title and bottom border
    const body = lines.slice(1, -1).map((line) => stripAnsi(line));
    expect(body.every((row) => row.length === 12)).toBe(true);
    expect(body.length).toBeGreaterThan(1);
    expect(body.join('')).toContain('abcdefgh');
  });
});

describe('renderTwinBoxes', () => {
  it('wraps left pane so twin row stays aligned', () => {
    const rows = renderTwinBoxes(
      'L',
      ['one two three four five six'],
      14,
      'R',
      ['ok'],
      10,
    );
    const widths = rows.map((row) => stripAnsi(row).length);
    expect(new Set(widths).size).toBe(1);
  });
});
