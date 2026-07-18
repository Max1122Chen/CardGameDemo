import { describe, expect, it } from 'vitest';

import { createBootstrappedShell, handleKeypress } from '../app-shell.js';
import { createInitialAppState } from '../input/input-router.js';
import { parseKeypress } from '../input/key-events.js';
import { createSessionController, type SessionController } from '../session/session-controller.js';
import type { AppState } from '../types.js';
import { stripAnsi } from './ansi.js';
import { renderFrame } from './frame-renderer.js';
import { formatPlayerStats } from './theme.js';

function confirmIntoCombat(
  controller: SessionController,
  state: AppState,
): AppState {
  const next = handleKeypress(state, controller, parseKeypress('\r'));
  expect(next.sessionPhase).toBe('adventure_combat');
  return next;
}

describe('explore layout DUNGEON-F01 S06', () => {
  it('battle boot shows Map + Room explore panes before confirm', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    expect(state.sessionPhase).toBe('adventure_explore');
    expect(state.pendingCombat).toBe(true);
    const plain = stripAnsi(renderFrame(state, controller, { cols: 100 }));
    expect(plain).toContain('Player');
    expect(plain).toContain('Map');
    expect(plain).toContain('Room');
    expect(plain).toContain('Explore Log');
    expect(plain).toMatch(/confirm|Enter\/C|fight/i);
  });

  it('dungeon boot shows generated level map', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'dungeon', seed: 42 });
    expect(state.sessionPhase).toBe('adventure_explore');
    expect(state.pendingCombat).toBe(false);
    expect(state.currentRoomId).toBeTruthy();
    expect(state.position).toBeDefined();
    const plain = stripAnsi(renderFrame(state, controller, { cols: 100 }));
    expect(plain).toContain('Map');
    expect(plain).toContain('Room');
    expect(plain).toMatch(/@|You:/);
  });
});

describe('combat main layout CLI-F04', () => {
  it('places player and enemies on one row and hand with log below', () => {
    const { controller, state: boot } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const state = confirmIntoCombat(controller, boot);
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
    const { controller, state: boot } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const state = confirmIntoCombat(controller, boot);
    const withStats = handleKeypress(state, controller, parseKeypress('p'));
    expect(withStats.statsOverlay).toBe('player');
    const plain = stripAnsi(renderFrame(withStats, controller, { cols: 100 }));
    expect(plain).toMatch(/Str:\d+/);
    expect(plain).toContain('Esc closes stats');
    expect(plain.match(/Player Stats/g) ?? []).toHaveLength(0);
  });

  it('formats vitals as Label:Value without space after colon', () => {
    expect(stripAnsi(formatPlayerStats(30, 5, 3))).toContain('HP:');
    expect(stripAnsi(formatPlayerStats(30, 5, 3))).not.toContain('HP: ');
    expect(stripAnsi(formatPlayerStats(30, 5, 3))).toContain('Block:');
  });

  it('keeps themed colors in the combat frame', () => {
    const { controller, state: boot } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const state = confirmIntoCombat(controller, boot);
    const frame = renderFrame(state, controller, { cols: 100 });
    expect(frame).toContain('\u001b[');
    expect(frame).toMatch(/\u001b\[3[1-6]m|\u001b\[9[1-7]m/);
  });

  it('caps Combat Log viewport so a long log does not inflate the hand|log row', () => {
    const { controller, state: boot } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const state = confirmIntoCombat(controller, boot);
    const longLog = Array.from({ length: 40 }, (_, i) => `log line ${i} ${'x'.repeat(80)}`);
    const bloated = { ...state, combatLog: longLog };
    const plain = stripAnsi(renderFrame(bloated, controller, { cols: 100 }));
    const lines = plain.split('\n');
    const titleIdx = lines.findIndex((line) => line.includes('Hand') && line.includes('Combat Log'));
    expect(titleIdx).toBeGreaterThanOrEqual(0);

    let body = 0;
    for (let i = titleIdx + 1; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      if (/^\+[\-+]+\+$/.test(line.trim()) || (line.includes('+') && line.includes('-') && !line.includes('|'))) {
        break;
      }
      if (line.includes('|')) {
        body += 1;
      }
    }
    expect(body).toBeLessThanOrEqual(12);
    expect(body).toBeGreaterThanOrEqual(1);
  });
});

describe('post-combat + inventory layout CLI-F05', () => {
  it('shows centered VICTORY in Enemies pane and Loot in the hand pane', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const victory = {
      ...state,
      sessionPhase: 'standalone_combat' as const,
      combatResult: 'victory' as const,
      pendingLoot: [
        {
          lootIndex: 0,
          itemId: 'item_potion',
          name: 'Potion',
          quantity: 1,
          sellValue: 5,
          label: 'Potion x1',
        },
      ],
      selectedLootIndex: 0,
      overlay: 'none' as const,
      focusLayer: 'gameplay' as const,
      mapLines: [],
      roomLoot: [],
    };
    const plain = stripAnsi(renderFrame(victory, controller, { cols: 100 }));
    expect(plain).toContain('VICTORY');
    expect(plain).toContain('Loot');
    expect(plain).toMatch(/\[1\].*Potion/);
    const bottom = plain.split('\n').find((line) => line.includes('Loot') && line.includes('Combat Log'));
    expect(bottom).toBeDefined();
  });

  it('shows DEFEAT in Enemies pane without opening loot', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const defeat = {
      ...state,
      sessionPhase: 'standalone_combat' as const,
      combatResult: 'defeat' as const,
      pendingLoot: [],
      overlay: 'none' as const,
      mapLines: [],
      roomLoot: [],
    };
    const plain = stripAnsi(renderFrame(defeat, controller, { cols: 100 }));
    expect(plain).toContain('DEFEAT');
    expect(plain).toContain('Hand');
  });

  it('replaces top row with Equipment|Grid when bag opens; bottom stays Room|Log in explore', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const withBag = handleKeypress(state, controller, parseKeypress('b'));
    expect(withBag.overlay).toBe('inventory');
    expect(withBag.inventoryFocus).toBe('equipment');
    const plain = stripAnsi(renderFrame(withBag, controller, { cols: 100 }));
    const top = plain.split('\n').find((line) => line.includes('Equipment') && line.includes('Grid'));
    expect(top).toBeDefined();
    const bottom = plain.split('\n').find((line) => line.includes('Room') && line.includes('Explore Log'));
    expect(bottom).toBeDefined();
  });

  it('keeps an empty Loot pane after all loot is claimed (standalone)', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const cleared = {
      ...state,
      sessionPhase: 'standalone_combat' as const,
      combatResult: 'victory' as const,
      pendingLoot: [],
      overlay: 'none' as const,
      mapLines: [],
      roomLoot: [],
    };
    const plain = stripAnsi(renderFrame(cleared, controller, { cols: 100 }));
    expect(plain).toContain('Loot');
    expect(plain).toContain('(empty)');
  });

  it('highlights selected backpack cells with a background fill', () => {
    const { controller, state } = createBootstrappedShell({ mode: 'battle', seed: 42 });
    const withBag = {
      ...state,
      overlay: 'inventory' as const,
      focusLayer: 'inventory' as const,
      inventoryFocus: 'backpack' as const,
      inventoryGrid: [
        [
          { glyph: 'A', entryId: 'e1', selected: true },
          { glyph: 'A', entryId: 'e1', selected: true },
          { glyph: '.', selected: false },
        ],
      ],
      inventoryWidth: 3,
      inventoryHeight: 1,
      inventorySlots: [
        {
          slotIndex: 0,
          entryId: 'e1',
          itemId: 'x',
          name: 'X',
          quantity: 1,
          sellValue: 1,
          label: 'X',
          x: 0,
          y: 0,
          rotation: 0 as const,
          width: 2,
          height: 1,
        },
      ],
    };
    const frame = renderFrame(withBag, controller, { cols: 100 });
    expect(frame).toContain('\u001b[106m');
  });

  it('selects loot with digit keys after victory without opening bag (standalone)', () => {
    const controller = createSessionController({});
    let state = controller.syncViewState(
      createInitialAppState({
        runtimeMode: 'battle',
        sessionPhase: 'standalone_combat',
      }),
    );
    controller.pendingLoot = {
      entries: [
        { lootIndex: 0, itemId: 'gold_coin', quantity: 1 },
        { lootIndex: 1, itemId: 'healing_herb', quantity: 1 },
      ],
    };
    controller.lootSpawned = true;
    state = {
      ...controller.syncViewState({
        ...state,
        combatResult: 'victory' as const,
        overlay: 'none' as const,
        focusLayer: 'gameplay' as const,
      }),
      combatResult: 'victory' as const,
      sessionPhase: 'standalone_combat',
    };
    expect(state.pendingLoot.length).toBeGreaterThanOrEqual(1);
    const next = handleKeypress(state, controller, parseKeypress('2'));
    expect(next.overlay).toBe('none');
    expect(next.selectedLootIndex).toBe(1);
  });
});
