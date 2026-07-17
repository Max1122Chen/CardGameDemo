import { describe, expect, it } from 'vitest';

import { createBootstrappedShell, handleKeypress } from '../app-shell.js';
import { parseKeypress } from '../input/key-events.js';
import { stripAnsi } from './ansi.js';
import { renderFrame } from './frame-renderer.js';
import { formatPlayerStats } from './theme.js';

describe('combat main layout CLI-F04', () => {
  it('places player and enemies on one row and hand with log below', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const plain = stripAnsi(renderFrame(state, controller, { cols: 100 }));
    expect(plain).toContain('Player');
    expect(plain).toContain('Enemies');
    expect(plain).toContain('Hand');
    expect(plain).toContain('Combat Log');

    const lines = plain.split('\n').filter((line) => line.length > 0);
    const topRow = lines.find((line) => line.includes('Player') && line.includes('Enemies'));
    expect(topRow).toBeDefined();
    const bottomRow = lines.find((line) => line.includes('Hand') && line.includes('Combat Log'));
    expect(bottomRow).toBeDefined();
  });

  it('shows player stats in the player pane without a floating stats box', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const withStats = handleKeypress(state, controller, parseKeypress('p'));
    expect(withStats.statsOverlay).toBe('player');
    const plain = stripAnsi(renderFrame(withStats, controller, { cols: 100 }));
    expect(plain).toMatch(/Str:\d+/);
    expect(plain).toContain('Esc closes stats');
    // Floating duplicate title should be gone.
    expect(plain.match(/Player Stats/g) ?? []).toHaveLength(0);
  });

  it('formats vitals as Label:Value without space after colon', () => {
    expect(stripAnsi(formatPlayerStats(30, 5, 3))).toContain('HP:');
    expect(stripAnsi(formatPlayerStats(30, 5, 3))).not.toContain('HP: ');
    expect(stripAnsi(formatPlayerStats(30, 5, 3))).toContain('Block:');
  });

  it('keeps themed colors in the combat frame', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const frame = renderFrame(state, controller, { cols: 100 });
    expect(frame).toContain('\u001b[');
    expect(frame).toMatch(/\u001b\[3[1-6]m|\u001b\[9[1-7]m/);
  });

  it('caps Combat Log viewport so a long log does not inflate the hand|log row', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const longLog = Array.from({ length: 40 }, (_, i) => `log line ${i} ${'x'.repeat(80)}`);
    const bloated = { ...state, combatLog: longLog };
    const plain = stripAnsi(renderFrame(bloated, controller, { cols: 100 }));
    const lines = plain.split('\n');
    const titleIdx = lines.findIndex((line) => line.includes('Hand') && line.includes('Combat Log'));
    expect(titleIdx).toBeGreaterThanOrEqual(0);

    let body = 0;
    for (let i = titleIdx + 1; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      // Twin-box bottom border is +----+----+ (dim dashes), no title text.
      if (/^\+[\-+]+\+$/.test(line.trim()) || (line.includes('+') && line.includes('-') && !line.includes('|'))) {
        break;
      }
      if (line.includes('|')) {
        body += 1;
      }
    }
    // Cap is 8; hand is typically smaller, so body should stay near that range (not ~40+).
    expect(body).toBeLessThanOrEqual(12);
    expect(body).toBeGreaterThanOrEqual(1);
  });
});
