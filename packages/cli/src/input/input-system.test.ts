import { describe, expect, it } from 'vitest';

import { IA } from './input-action.js';
import { activeContextsForState } from './bindings/active-contexts.js';
import { resolveInput } from './input-system.js';
import { createInitialAppState } from './input-router.js';
import { parseKeypress } from './key-events.js';

describe('input-system IMC resolve', () => {
  const base = createInitialAppState({ runtimeMode: 'battle' });

  it('console context consumes b so inventory toggle does not fire', () => {
    const consoleState = { ...base, overlay: 'console' as const, focusLayer: 'console' as const };
    const triggered = resolveInput(activeContextsForState(consoleState), parseKeypress('b'));
    expect(triggered).toEqual([{ id: IA.ConsoleChar, char: 'b' }]);
  });

  it('backtick toggles console even while console is focused', () => {
    const consoleState = { ...base, overlay: 'console' as const, focusLayer: 'console' as const };
    const triggered = resolveInput(activeContextsForState(consoleState), parseKeypress('`'));
    expect(triggered).toEqual([{ id: IA.ToggleConsole }]);
  });

  it('inventory tidy consumes t before global trace toggle', () => {
    const inv = { ...base, overlay: 'inventory' as const, focusLayer: 'inventory' as const };
    const triggered = resolveInput(activeContextsForState(inv), parseKeypress('t'));
    expect(triggered).toEqual([{ id: IA.TidyInventory }]);
  });

  it('stats IMC steals escape before gameplay/global', () => {
    const withStats = { ...base, statsOverlay: 'player' as const };
    const triggered = resolveInput(activeContextsForState(withStats), parseKeypress('\u001b'));
    expect(triggered).toEqual([{ id: IA.Escape }]);
  });
});
