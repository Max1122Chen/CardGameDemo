import { describe, expect, it } from 'vitest';

import { createBootstrappedShell, handleKeypress, renderBootFrame } from './app-shell.js';
import { parseKeypress } from './input/key-events.js';

describe('app-shell', () => {
  it('renders a battle boot frame with explore Map and Room panes', () => {
    const frame = renderBootFrame({ mode: 'battle', seed: 42, scenarioId: 'probe' });
    expect(frame).toContain('Player');
    expect(frame).toContain('Map');
    expect(frame).toContain('Room');
    expect(frame).toMatch(/confirm|fight/i);
  });

  it('opens inventory overlay immediately after b key', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle' });
    const next = handleKeypress(state, controller, parseKeypress('b'));
    expect(next.overlay).toBe('inventory');
  });

  it('opens console overlay immediately after backtick', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle' });
    const next = handleKeypress(state, controller, parseKeypress('`'));
    expect(next.overlay).toBe('console');
    expect(next.focusLayer).toBe('console');
  });

  it('Enter confirms combat from BattleOnly explore', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle' });
    expect(state.pendingCombat).toBe(true);
    const next = handleKeypress(state, controller, parseKeypress('\r'));
    expect(next.sessionPhase).toBe('adventure_combat');
    expect(next.hand.length).toBeGreaterThan(0);
    expect(next.enemies[0]?.name).toMatch(/Slime|Orc/i);
  });
});
