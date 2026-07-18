import { describe, expect, it } from 'vitest';

import { AdventureSession } from './adventure-session.js';
import { LevelParseError } from './errors.js';
import { createVirtualBattleLevel, generateLevel } from './generate-level.js';
import { loadLevelFromRepo, resolveRepoDataRoot } from './load-level.js';
import { parseLevelDefinition } from './parse-level.js';

describe('DUNGEON-F01 level parse and load', () => {
  it('parses level.probe from repo', () => {
    const level = loadLevelFromRepo('level.probe');
    expect(level.id).toBe('level.probe');
    expect(level.startRoomId).toBe('start');
    expect(level.rooms.start?.kind).toBe('safe');
    expect(level.rooms.hall_a?.encounter?.characterId).toBe('slime');
    expect(level.rooms.exit?.kind).toBe('exit');
    expect(resolveRepoDataRoot()).toMatch(/data$/);
  });

  it('rejects unknown exit targets', () => {
    expect(() =>
      parseLevelDefinition({
        id: 'bad',
        startRoomId: 'a',
        rooms: [{ id: 'a', exits: { east: 'missing' } }],
      }),
    ).toThrow(LevelParseError);
  });
});

describe('DUNGEON-F01 generator', () => {
  it('produces a connected door-graph and is seed-stable', () => {
    const profile = {
      seed: 42,
      width: 8,
      height: 6,
      roomCount: 6,
      fillerWallRooms: 0,
      encounterTable: [
        { characterId: 'slime', weight: 2 },
        { characterId: 'orc_brute', weight: 1 },
      ],
      exitRoom: true,
    };
    const a = generateLevel(profile);
    const b = generateLevel(profile);
    expect(a).toEqual(b);
    expect(Object.keys(a.rooms).length).toBe(6);
    expect(a.rooms[a.startRoomId]?.kind).toBe('safe');
    expect(a.startPosition).toBeDefined();
    expect(a.doors.length).toBeGreaterThan(0);

    const exitRooms = Object.values(a.rooms).filter((room) => room.kind === 'exit');
    expect(exitRooms.length).toBe(1);

    // Every room reachable from start via BFS on doors.
    const visited = new Set<string>();
    const queue = [a.startRoomId];
    const adj = new Map<string, Set<string>>();
    for (const id of Object.keys(a.rooms)) {
      adj.set(id, new Set());
    }
    for (const door of a.doors) {
      const ra = a.occupancy[`${door.a.x},${door.a.y}`]!;
      const rb = a.occupancy[`${door.b.x},${door.b.y}`]!;
      adj.get(ra)!.add(rb);
      adj.get(rb)!.add(ra);
    }
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);
      for (const n of adj.get(id) ?? []) {
        queue.push(n);
      }
    }
    expect(visited.size).toBe(Object.keys(a.rooms).length);
  });
});

describe('DUNGEON-F01 AdventureSession', () => {
  it('pauses for ConfirmCombat when entering encounter room', () => {
    const level = loadLevelFromRepo('level.probe');
    const session = AdventureSession.start(level);

    expect(session.getSnapshot().pendingCombat).toBe(false);
    session.applyAction({ type: 'Move', direction: 'east' });

    const snap = session.getSnapshot();
    expect(snap.currentRoomId).toBe('hall_a');
    expect(snap.pendingCombat).toBe(true);
    expect(snap.legalActions).toEqual([{ type: 'ConfirmCombat' }]);
    expect(snap.log.some((line) => line.includes('confirm to fight'))).toBe(true);

    expect(() => session.applyAction({ type: 'Move', direction: 'east' })).toThrow(
      /Confirm combat/,
    );

    session.applyAction({ type: 'ConfirmCombat' });
    expect(session.getPhase()).toBe('combat');
  });

  it('clears pending after victory and allows move again', () => {
    const level = loadLevelFromRepo('level.probe');
    const session = AdventureSession.start(level);
    session.applyAction({ type: 'Move', direction: 'east' });
    session.applyAction({ type: 'ConfirmCombat' });
    session.resolveCombatVictory([{ itemId: 'gold_coin', quantity: 2 }]);

    expect(session.getPhase()).toBe('explore');
    expect(session.isPendingCombat()).toBe(false);
    expect(session.getRoomState('hall_a').loot).toEqual([
      { itemId: 'gold_coin', quantity: 2 },
    ]);
    expect(session.getRoomState('hall_a').cleared).toBe(true);

    const taken = session.takeLoot(0);
    expect(taken.itemId).toBe('gold_coin');
    expect(session.getRoomState('hall_a').loot).toHaveLength(0);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getCurrentRoomId()).toBe('hall_b');
    expect(session.isPendingCombat()).toBe(true);
  });

  it('virtual BattleOnly level starts pending confirm', () => {
    const level = createVirtualBattleLevel('orc_brute');
    const session = AdventureSession.start(level);
    expect(session.isPendingCombat()).toBe(true);
    expect(session.legalActions()).toEqual([{ type: 'ConfirmCombat' }]);
  });

  it('can leave from exit after clearing path', () => {
    const level = loadLevelFromRepo('level.probe');
    const session = AdventureSession.start(level);

    session.applyAction({ type: 'Move', direction: 'east' });
    session.applyAction({ type: 'ConfirmCombat' });
    session.resolveCombatVictory([]);

    session.applyAction({ type: 'Move', direction: 'east' });
    session.applyAction({ type: 'ConfirmCombat' });
    session.resolveCombatVictory([]);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getCurrentRoom().kind).toBe('exit');
    expect(session.legalActions().some((a) => a.type === 'LeaveLevel')).toBe(true);
    session.applyAction({ type: 'LeaveLevel' });
    expect(session.getPhase()).toBe('victory');
  });
});
