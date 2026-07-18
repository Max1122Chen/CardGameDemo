import { describe, expect, it } from 'vitest';

import { AdventureLifecycleBus } from './lifecycle.js';
import { AdventureSession, seedForLevel } from './adventure-session.js';
import { normalizeLevelAsset } from './level-geometry.js';
import type { LevelAsset } from './types.js';

function exitOnlyLevel(id: string): LevelAsset {
  return normalizeLevelAsset({
    id,
    source: 'virtual',
    startRoomId: 'exit',
    startPosition: { x: 0, y: 0 },
    rooms: {
      exit: {
        id: 'exit',
        kind: 'exit',
        rect: { x: 0, y: 0, w: 1, h: 1 },
      },
    },
    doors: [],
  });
}

describe('DUNGEON-F05 multi-level AdventureSession', () => {
  it('seedForLevel is stable and varies by index', () => {
    expect(seedForLevel(42, 0)).toBe(seedForLevel(42, 0));
    expect(seedForLevel(42, 0)).not.toBe(seedForLevel(42, 1));
  });

  it('startRun descends then evacuates with one LeaveLevel action', () => {
    const types: string[] = [];
    const bus = new AdventureLifecycleBus();
    bus.subscribe((e) => types.push(e.type));

    const floors = [exitOnlyLevel('L0'), exitOnlyLevel('L1')];
    const session = AdventureSession.startRun({
      runSeed: 7,
      levelCount: 2,
      lifecycle: bus,
      levelFactory: (index) => floors[index]!,
    });

    expect(types).toContain('EnterDungeon');
    expect(types).toContain('EnterLevel');
    expect(session.getLevelIndex()).toBe(0);
    expect(session.getLevelCount()).toBe(2);
    expect(session.getLevel().id).toBe('L0');

    session.applyAction({ type: 'LeaveLevel' });
    expect(session.getPhase()).toBe('explore');
    expect(session.getLevelIndex()).toBe(1);
    expect(session.getLevel().id).toBe('L1');
    expect(session.getRound()).toBe(1);
    expect(types.filter((t) => t === 'LeaveLevel')).toHaveLength(1);
    expect(types.filter((t) => t === 'EnterLevel')).toHaveLength(2);

    session.applyAction({ type: 'LeaveLevel' });
    expect(session.getPhase()).toBe('victory');
    expect(types).toContain('LeaveDungeon');
    expect(types.filter((t) => t === 'LeaveLevel')).toHaveLength(2);
  });

  it('startFromLevel evacuates on first LeaveLevel', () => {
    const types: string[] = [];
    const bus = new AdventureLifecycleBus();
    bus.subscribe((e) => types.push(e.type));

    const session = AdventureSession.startFromLevel(exitOnlyLevel('solo'), { lifecycle: bus });
    expect(session.getLevelCount()).toBe(1);
    session.applyAction({ type: 'LeaveLevel' });
    expect(session.getPhase()).toBe('victory');
    expect(types).toContain('LeaveDungeon');
  });

  it('start(level) remains single-floor compatible', () => {
    const session = AdventureSession.start(exitOnlyLevel('compat'));
    expect(session.getLevelCount()).toBe(1);
    session.applyAction({ type: 'LeaveLevel' });
    expect(session.getPhase()).toBe('victory');
  });
});
