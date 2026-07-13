import { describe, expect, it } from 'vitest';

import { createBootstrappedShell, handleKeypress, renderBootFrame } from './app-shell.js';
import { parseKeypress } from './input/key-events.js';

describe('app-shell', () => {
  it('renders a battle boot frame with player and hand panes', () => {
    const frame = renderBootFrame({ mode: 'battle', seed: 42, scenarioId: 'probe' });
    expect(frame).toContain('Player');
    expect(frame).toContain('Hand');
    expect(frame).toContain('Slime');
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
});
