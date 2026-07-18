import { describe, expect, it } from 'vitest';

import { AdventureSession } from './adventure-session.js';
import { generateLevel } from './generate-level.js';
import { normalizeLevelAsset, sharedWallPairs } from './level-geometry.js';
import { AdventureLifecycleBus } from './lifecycle.js';
import type { LevelAsset } from './types.js';

describe('DUNGEON-F02 spatial generator', () => {
  const profile = {
    seed: 42,
    width: 12,
    height: 10,
    roomCount: 8,
    fillerWallRooms: 2,
    encounterTable: [
      { characterId: 'slime', weight: 2 },
      { characterId: 'orc_brute', weight: 1 },
    ],
    exitRoom: true,
  };

  it('is seed-stable', () => {
    const a = generateLevel(profile);
    const b = generateLevel(profile);
    expect(a).toEqual(b);
  });

  it('places rect rooms with occupancy and doors', () => {
    const level = generateLevel(profile);
    expect(Object.keys(level.rooms).length).toBeGreaterThanOrEqual(8);
    expect(level.rooms[level.startRoomId]?.kind).toBe('safe');
    expect(level.occupancy[`${level.startPosition.x},${level.startPosition.y}`]).toBe(
      level.startRoomId,
    );
    expect(level.doors.length).toBeGreaterThan(0);

    const sizes = Object.values(level.rooms).map((r) => r.rect.w * r.rect.h);
    expect(sizes.some((s) => s > 1)).toBe(true);
  });

  it('keeps door-graph connected from start for rooms with doors', () => {
    const level = generateLevel(profile);
    const visited = new Set<string>();
    const queue = [level.startRoomId];
    const adj = new Map<string, Set<string>>();
    for (const id of Object.keys(level.rooms)) {
      adj.set(id, new Set());
    }
    for (const door of level.doors) {
      const ra = level.occupancy[`${door.a.x},${door.a.y}`]!;
      const rb = level.occupancy[`${door.b.x},${door.b.y}`]!;
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
    for (const id of Object.keys(level.rooms)) {
      const degree = adj.get(id)?.size ?? 0;
      if (degree > 0) {
        expect(visited.has(id)).toBe(true);
      }
    }
    expect(visited.has(level.startRoomId)).toBe(true);
  });

  it('can have spatially adjacent rooms without a door', () => {
    const level = generateLevel({ ...profile, seed: 7, fillerWallRooms: 3 });
    const roomList = Object.values(level.rooms);
    let foundAdjacentNoDoor = false;
    for (let i = 0; i < roomList.length; i += 1) {
      for (let j = i + 1; j < roomList.length; j += 1) {
        const a = roomList[i]!;
        const b = roomList[j]!;
        const pairs = sharedWallPairs(a.rect, b.rect);
        if (pairs.length === 0) {
          continue;
        }
        const hasDoor = pairs.some(([c1, c2]) =>
          level.doors.some(
            (d) =>
              (d.a.x === c1.x && d.a.y === c1.y && d.b.x === c2.x && d.b.y === c2.y) ||
              (d.a.x === c2.x && d.a.y === c2.y && d.b.x === c1.x && d.b.y === c1.y),
          ),
        );
        if (!hasDoor) {
          foundAdjacentNoDoor = true;
        }
      }
    }
    expect(foundAdjacentNoDoor).toBe(true);
  });
});

describe('DUNGEON-F02 cell movement', () => {
  function wideHallLevel(): LevelAsset {
    return normalizeLevelAsset({
      id: 'level.wide',
      source: 'wire',
      startRoomId: 'hall',
      startPosition: { x: 0, y: 0 },
      rooms: {
        hall: {
          id: 'hall',
          kind: 'safe',
          rect: { x: 0, y: 0, w: 3, h: 1 },
        },
        side: {
          id: 'side',
          kind: 'normal',
          rect: { x: 3, y: 0, w: 1, h: 1 },
          encounter: { characterId: 'slime' },
        },
      },
      doors: [{ a: { x: 2, y: 0 }, b: { x: 3, y: 0 }, cost: 1 }],
    });
  }

  it('intra-room move costs 0; door costs 1', () => {
    const session = AdventureSession.start(wideHallLevel());
    expect(session.getMovementCost('east')).toBe(0);
    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getPosition()).toEqual({ x: 1, y: 0 });
    expect(session.getCurrentRoomId()).toBe('hall');

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getPosition()).toEqual({ x: 2, y: 0 });
    expect(session.getMovementCost('east')).toBe(1);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getCurrentRoomId()).toBe('side');
    expect(session.getPosition()).toEqual({ x: 3, y: 0 });
    expect(session.isPendingCombat()).toBe(true);
  });

  it('triggers pending combat on room entry without walking to a special cell', () => {
    const level = normalizeLevelAsset({
      id: 'level.big_foe',
      source: 'wire',
      startRoomId: 'safe',
      startPosition: { x: 0, y: 0 },
      rooms: {
        safe: {
          id: 'safe',
          kind: 'safe',
          rect: { x: 0, y: 0, w: 1, h: 1 },
        },
        lair: {
          id: 'lair',
          kind: 'normal',
          rect: { x: 1, y: 0, w: 3, h: 2 },
          encounter: { characterId: 'orc_brute' },
        },
      },
      doors: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, cost: 1 }],
    });
    const session = AdventureSession.start(level);
    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getPosition()).toEqual({ x: 1, y: 0 });
    expect(session.getCurrentRoomId()).toBe('lair');
    expect(session.isPendingCombat()).toBe(true);
    expect(session.legalActions()).toEqual([{ type: 'ConfirmCombat' }]);
  });

  it('emits lifecycle EnterLevel / EnterCombat / EndCombat / LeaveLevel', () => {
    const bus = new AdventureLifecycleBus();
    const types: string[] = [];
    bus.subscribe((e) => types.push(e.type));

    const level = normalizeLevelAsset({
      id: 'level.life',
      source: 'wire',
      startRoomId: 'start',
      rooms: {
        start: {
          id: 'start',
          kind: 'safe',
          rect: { x: 0, y: 0, w: 1, h: 1 },
        },
        exit: {
          id: 'exit',
          kind: 'exit',
          rect: { x: 1, y: 0, w: 1, h: 1 },
        },
      },
      doors: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, cost: 1 }],
    });

    const fightLevel = normalizeLevelAsset({
      id: 'level.fight',
      source: 'wire',
      startRoomId: 'arena',
      rooms: {
        arena: {
          id: 'arena',
          kind: 'normal',
          rect: { x: 0, y: 0, w: 1, h: 1 },
          encounter: { characterId: 'slime' },
        },
      },
      doors: [],
    });
    const fight = AdventureSession.start(fightLevel, bus);
    expect(types).toContain('EnterLevel');
    fight.applyAction({ type: 'ConfirmCombat' });
    expect(types).toContain('EnterCombat');
    fight.resolveCombatVictory([]);
    expect(types).toContain('EndCombat');

    const leave = AdventureSession.start(level, bus);
    leave.applyAction({ type: 'Move', direction: 'east' });
    leave.applyAction({ type: 'LeaveLevel' });
    expect(types).toContain('LeaveLevel');
  });
});
