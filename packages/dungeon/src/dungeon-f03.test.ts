import { describe, expect, it } from 'vitest';

import { AdventureSession } from './adventure-session.js';
import { AdventureError } from './errors.js';
import { normalizeLevelAsset } from './level-geometry.js';
import { AdventureLifecycleBus } from './lifecycle.js';
import { loadLevelFromRepo } from './load-level.js';

describe('DUNGEON-F03 explore round / AP', () => {
  it('starts round 1 with full AP', () => {
    const session = AdventureSession.start(loadLevelFromRepo('level.probe'));
    expect(session.getRound()).toBe(1);
    expect(session.getExploreAp()).toBe(3);
    expect(session.getMaxExploreAp()).toBe(3);
    expect(session.getSnapshot().log.some((l) => l.includes('Round 1'))).toBe(true);
  });

  it('door moves spend AP; intra-room moves do not', () => {
    const level = normalizeLevelAsset({
      id: 'level.ap',
      source: 'wire',
      startRoomId: 'hall',
      startPosition: { x: 0, y: 0 },
      rooms: {
        hall: { id: 'hall', kind: 'safe', rect: { x: 0, y: 0, w: 3, h: 1 } },
        side: { id: 'side', kind: 'normal', rect: { x: 3, y: 0, w: 1, h: 1 } },
      },
      doors: [{ a: { x: 2, y: 0 }, b: { x: 3, y: 0 }, cost: 1 }],
    });
    const session = AdventureSession.start(level, { maxExploreAp: 2 });
    expect(session.getExploreAp()).toBe(2);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getExploreAp()).toBe(2);
    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getExploreAp()).toBe(2);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getCurrentRoomId()).toBe('side');
    expect(session.getExploreAp()).toBe(1);
  });

  it('blocks door move when AP is insufficient', () => {
    const level = normalizeLevelAsset({
      id: 'level.noap',
      source: 'wire',
      startRoomId: 'a',
      rooms: {
        a: { id: 'a', kind: 'safe', rect: { x: 0, y: 0, w: 1, h: 1 } },
        b: { id: 'b', kind: 'normal', rect: { x: 1, y: 0, w: 1, h: 1 } },
      },
      doors: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, cost: 1 }],
    });
    const session = AdventureSession.start(level, { maxExploreAp: 0 });
    expect(session.getMovementCost('east')).toBeUndefined();
    expect(() => session.applyAction({ type: 'Move', direction: 'east' })).toThrow(
      AdventureError,
    );
    expect(session.legalActions().some((a) => a.type === 'EndRound')).toBe(true);
  });

  it('EndRound emits lifecycle and refills AP', () => {
    const bus = new AdventureLifecycleBus();
    const types: string[] = [];
    bus.subscribe((e) => types.push(e.type));

    const session = AdventureSession.start(loadLevelFromRepo('level.probe'), { lifecycle: bus });
    expect(types.filter((t) => t === 'RoundStart')).toHaveLength(1);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getExploreAp()).toBe(2);

    session.applyAction({ type: 'ConfirmCombat' });
    session.resolveCombatVictory([]);

    session.applyAction({ type: 'EndRound' });
    expect(types).toContain('RoundEnd');
    expect(types.filter((t) => t === 'RoundStart')).toHaveLength(2);
    expect(session.getRound()).toBe(2);
    expect(session.getExploreAp()).toBe(3);
  });
});
