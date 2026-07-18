import { describe, expect, it } from 'vitest';

import { AdventureSession } from './adventure-session.js';
import { normalizeLevelAsset } from './level-geometry.js';
import { loadLevelFromRepo } from './load-level.js';

describe('DUNGEON-F04 Civ-style fog (known layout + door vision)', () => {
  it('start: known includes door-neighbors; wall-only not known', () => {
    const level = loadLevelFromRepo('level.probe');
    const session = AdventureSession.start(level);
    const snap = session.getSnapshot();

    expect(snap.visitedRoomIds).toEqual(['start']);
    expect(snap.knownRoomIds).toEqual(expect.arrayContaining(['start', 'hall_a']));
    expect(snap.visionRoomIds).toContain('hall_a');
    expect(snap.mappedRoomIds).toEqual(snap.knownRoomIds);
    expect(snap.knownRoomIds).not.toContain('hall_b');
  });

  it('wall-adjacent without door is not known', () => {
    const level = normalizeLevelAsset({
      id: 'level.fog_wall',
      source: 'wire',
      startRoomId: 'a',
      rooms: {
        a: { id: 'a', kind: 'safe', rect: { x: 0, y: 0, w: 1, h: 1 } },
        b: {
          id: 'b',
          kind: 'normal',
          rect: { x: 1, y: 0, w: 1, h: 1 },
          encounter: { characterId: 'slime' },
        },
      },
      doors: [],
    });
    const session = AdventureSession.start(level);
    expect(session.getKnownRoomIds()).toEqual(['a']);
    expect(session.getVisionRoomIds()).toEqual(['a']);
  });

  it('glimpsed unvisited room stays known after leaving vision', () => {
    // a connected to b and c; start at a sees b; move to c without entering b
    const level = normalizeLevelAsset({
      id: 'level.fog_glimpse',
      source: 'wire',
      startRoomId: 'a',
      rooms: {
        a: { id: 'a', kind: 'safe', rect: { x: 1, y: 0, w: 1, h: 1 } },
        b: {
          id: 'b',
          kind: 'normal',
          rect: { x: 0, y: 0, w: 1, h: 1 },
          encounter: { characterId: 'slime' },
        },
        c: { id: 'c', kind: 'normal', rect: { x: 2, y: 0, w: 1, h: 1 } },
      },
      doors: [
        { a: { x: 1, y: 0 }, b: { x: 0, y: 0 }, cost: 1 },
        { a: { x: 1, y: 0 }, b: { x: 2, y: 0 }, cost: 1 },
      ],
    });
    const session = AdventureSession.start(level);
    expect(session.getVisitedRoomIds()).toEqual(['a']);
    expect(session.getKnownRoomIds()).toEqual(['a', 'b', 'c']);
    expect(session.getVisionRoomIds()).toEqual(['a', 'b', 'c']);

    session.applyAction({ type: 'Move', direction: 'east' }); // into c, never visit b
    expect(session.getCurrentRoomId()).toBe('c');
    expect(session.getVisitedRoomIds()).toEqual(['a', 'c']);
    expect(session.getVisitedRoomIds()).not.toContain('b');
    expect(session.getKnownRoomIds()).toContain('b'); // still on map
    expect(session.getVisionRoomIds()).not.toContain('b'); // no interior
    expect(session.getVisionRoomIds()).toEqual(['a', 'c']);
  });

  it('door-glimpse of hall_b from hall_a persists after returning to start', () => {
    const level = loadLevelFromRepo('level.probe');
    const session = AdventureSession.start(level);

    session.applyAction({ type: 'Move', direction: 'east' });
    expect(session.getKnownRoomIds()).toContain('hall_b');
    session.applyAction({ type: 'ConfirmCombat' });
    session.resolveCombatVictory([]);
    session.applyAction({ type: 'Move', direction: 'west' });

    expect(session.getCurrentRoomId()).toBe('start');
    expect(session.getVisionRoomIds()).not.toContain('hall_b');
    expect(session.getKnownRoomIds()).toContain('hall_b');
    expect(session.getMappedRoomIds()).toContain('hall_b');
  });
});
