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

  it('opens settings on escape when no overlay and no card preview', () => {
    const actions = routeInput(base, parseKeypress('\u001b'));
    expect(actions).toEqual([{ type: 'toggle_settings' }]);
  });

  it('cancels card preview on escape when preview is active', () => {
    const withPreview = { ...base, previewActive: true };
    const actions = routeInput(withPreview, parseKeypress('\u001b'));
    expect(actions).toEqual([{ type: 'cancel_card_preview' }]);
  });

  it('routes x to cancel card preview in gameplay', () => {
    const actions = routeInput(base, parseKeypress('x'));
    expect(actions).toEqual([{ type: 'cancel_card_preview' }]);
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

  it('routes f to end turn in gameplay', () => {
    const actions = routeInput(base, parseKeypress('f'));
    expect(actions).toEqual([{ type: 'end_turn' }]);
  });

  it('routes p and e to stats overlays in gameplay', () => {
    expect(routeInput(base, parseKeypress('p'))).toEqual([{ type: 'toggle_player_stats' }]);
    expect(routeInput(base, parseKeypress('e'))).toEqual([{ type: 'toggle_enemy_stats' }]);
  });

  it('closes stats overlay on escape', () => {
    const withStats = { ...base, statsOverlay: 'player' as const };
    expect(routeInput(withStats, parseKeypress('\u001b'))).toEqual([{ type: 'close_stats_overlay' }]);
  });

  it('routes inventory discard on d when inventory overlay is focused', () => {
    const withOverlay = {
      ...base,
      overlay: 'inventory' as const,
      focusLayer: 'inventory' as const,
      inventorySlots: [
        {
          slotIndex: 0,
          entryId: 'bag-1',
          itemId: 'gold_coin',
          name: 'Gold Coin',
          quantity: 1,
          sellValue: 1,
          label: 'Gold Coin x1',
          x: 0,
          y: 0,
          rotation: 0 as const,
          width: 1,
          height: 1,
        },
      ],
    };
    expect(routeInput(withOverlay, parseKeypress('d'))).toEqual([{ type: 'discard_selected_inventory_slot' }]);
  });

  it('routes pickup on p when inventory overlay is focused', () => {
    const withOverlay = {
      ...base,
      overlay: 'inventory' as const,
      focusLayer: 'inventory' as const,
      pendingLoot: [{ lootIndex: 0, itemId: 'gold_coin', name: 'Gold Coin', quantity: 1, sellValue: 1, label: 'Gold Coin x1' }],
    };
    expect(routeInput(withOverlay, parseKeypress('p'))).toEqual([{ type: 'pickup_selected_loot' }]);
  });

  it('routes tidy on t when inventory overlay is focused', () => {
    const withOverlay = { ...base, overlay: 'inventory' as const, focusLayer: 'inventory' as const };
    expect(routeInput(withOverlay, parseKeypress('t'))).toEqual([{ type: 'tidy_inventory' }]);
  });

  it('routes place digits into inventory place input', () => {
    const withOverlay = { ...base, overlay: 'inventory' as const, focusLayer: 'inventory' as const };
    expect(routeInput(withOverlay, parseKeypress('1'))).toEqual([{ type: 'inventory_place_append', char: '1' }]);
    expect(routeInput(withOverlay, parseKeypress('\r'))).toEqual([{ type: 'inventory_place_submit' }]);
  });

  it('routes console typing only when console is focused', () => {
    const consoleState = { ...base, overlay: 'console' as const, focusLayer: 'console' as const };
    expect(routeInput(consoleState, parseKeypress('s'))).toEqual([{ type: 'console_append', char: 's' }]);
    expect(routeInput(base, parseKeypress('s'))).toEqual([]);
  });
});
