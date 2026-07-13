import { describe, expect, it } from 'vitest';

import { createInitialAppState, routeInput } from './input-router.js';
import { parseKeypress } from './key-events.js';

describe('routeInput', () => {
  const base = createInitialAppState({ runtimeMode: 'battle' });

  it('toggles inventory immediately on b without enter', () => {
    const actions = routeInput(base, parseKeypress('b'));
    expect(actions).toEqual([{ type: 'toggle_inventory' }]);
  });

  it('toggles console on backtick', () => {
    const actions = routeInput(base, parseKeypress('`'));
    expect(actions).toEqual([{ type: 'toggle_console' }]);
  });

  it('opens settings on escape when no overlay is open', () => {
    const actions = routeInput(base, parseKeypress('\u001b'));
    expect(actions).toEqual([{ type: 'toggle_settings' }]);
  });

  it('closes overlay on escape when overlay is open', () => {
    const withOverlay = { ...base, overlay: 'inventory' as const, focusLayer: 'inventory' as const };
    const actions = routeInput(withOverlay, parseKeypress('\u001b'));
    expect(actions).toEqual([{ type: 'close_overlay' }]);
  });

  it('routes number keys to immediate hand selection in gameplay', () => {
    const actions = routeInput(base, parseKeypress('2'));
    expect(actions).toEqual([{ type: 'select_hand', index: 1 }]);
  });

  it('routes e to end turn in gameplay', () => {
    const actions = routeInput(base, parseKeypress('e'));
    expect(actions).toEqual([{ type: 'end_turn' }]);
  });

  it('routes console typing only when console is focused', () => {
    const consoleState = { ...base, overlay: 'console' as const, focusLayer: 'console' as const };
    expect(routeInput(consoleState, parseKeypress('s'))).toEqual([{ type: 'console_append', char: 's' }]);
    expect(routeInput(base, parseKeypress('s'))).toEqual([]);
  });
});
