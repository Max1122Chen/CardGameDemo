import { describe, expect, it } from 'vitest';

import { composeFrameBuffer, paintBufferedFrame, splitFrameLines } from './frame-buffer.js';
import { stripAnsi, style, ANSI } from './ansi.js';
import { renderScrollZone } from './widgets/scroll-zone.js';

describe('frame-buffer', () => {
  it('pads short frames to fixed rows and cols', () => {
    const buffer = composeFrameBuffer('a\nb', 4, 3);
    const lines = buffer.split('\n');
    expect(lines).toHaveLength(3);
    expect(stripAnsi(lines[0]!)).toBe('a   ');
    expect(stripAnsi(lines[1]!)).toBe('b   ');
    expect(stripAnsi(lines[2]!)).toBe('    ');
  });

  it('truncates taller content so a short next frame cannot leave ghosts', () => {
    const tall = composeFrameBuffer(['one', 'two', 'three', 'four'].join('\n'), 5, 2);
    expect(tall.split('\n')).toHaveLength(2);
    expect(stripAnsi(tall)).toBe('one  \ntwo  ');
  });

  it('preserves ansi when padding', () => {
    const colored = style('HP', ANSI.fg.red);
    const line = composeFrameBuffer(colored, 6, 1);
    expect(line.startsWith(colored)).toBe(true);
    expect(stripAnsi(line)).toBe('HP    ');
  });

  it('paintBufferedFrame homes cursor then eraseBelow before buffer', () => {
    const painted = paintBufferedFrame('hi', { cols: 4, rows: 1 });
    expect(painted.startsWith('\u001b[H\u001b[J')).toBe(true);
    expect(stripAnsi(painted.slice('\u001b[H\u001b[J'.length))).toBe('hi  ');
  });

  it('splitFrameLines drops trailing newline only', () => {
    expect(splitFrameLines('a\nb\n')).toEqual(['a', 'b']);
    expect(splitFrameLines('a\nb')).toEqual(['a', 'b']);
  });
});

describe('scroll-zone', () => {
  it('auto-tails to the newest lines by default', () => {
    const lines = ['a', 'b', 'c', 'd', 'e'];
    expect(renderScrollZone({ lines, viewportHeight: 3 })).toEqual(['c', 'd', 'e']);
  });

  it('supports manual offset when autoTail is off', () => {
    const lines = ['a', 'b', 'c', 'd'];
    expect(renderScrollZone({ lines, viewportHeight: 2, autoTail: false, scrollOffset: 1 })).toEqual([
      'b',
      'c',
    ]);
  });
});
