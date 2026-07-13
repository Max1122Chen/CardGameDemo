import { describe, expect, it } from 'vitest';

import { TraceBuffer } from '../trace/trace.js';
import { GameplayTagContainer, GameplayTagManager, NATIVE_GAMEPLAY_TAGS } from './index.js';

function createProbeManager(): GameplayTagManager {
  return GameplayTagManager.fromDefinitions({ native: NATIVE_GAMEPLAY_TAGS });
}

describe('GameplayTagContainer', () => {
  it('probe 2: child tag satisfies parent query via has()', () => {
    const manager = createProbeManager();
    const container = new GameplayTagContainer({ manager });
    const vulnerable = manager.resolve('Status.Debuff.Vulnerable');
    const debuff = manager.resolve('Status.Debuff');
    const player = manager.resolve('Character.Player');

    container.add(vulnerable);

    expect(container.has(vulnerable)).toBe(true);
    expect(container.has(debuff)).toBe(true);
    expect(container.has(player)).toBe(false);
  });

  it('probe 3: hasAll and hasAny follow GA-style all/any semantics', () => {
    const manager = createProbeManager();
    const container = new GameplayTagContainer({ manager });

    container.add(manager.resolve('Character.Enemy.Orc'));
    container.add(manager.resolve('Status.Debuff.Vulnerable'));

    const requiredAll = [
      manager.resolve('Character.Enemy'),
      manager.resolve('Status.Debuff'),
    ];
    const blockedAny = [manager.resolve('Status.Debuff.Vulnerable')];
    const missingAny = [manager.resolve('Character.Player')];

    expect(container.hasAll(requiredAll)).toBe(true);
    expect(container.hasAny(blockedAny)).toBe(true);
    expect(container.hasAny(missingAny)).toBe(false);
    expect(container.hasAll([...requiredAll, manager.resolve('Character.Player')])).toBe(false);
  });

  it('probe 4: count stacking survives partial remove', () => {
    const manager = createProbeManager();
    const container = new GameplayTagContainer({ manager });
    const vulnerable = manager.resolve('Status.Debuff.Vulnerable');

    container.add(vulnerable);
    container.add(vulnerable);
    expect(container.getCount(vulnerable)).toBe(2);
    expect(container.has(vulnerable)).toBe(true);

    container.remove(vulnerable);
    expect(container.getCount(vulnerable)).toBe(1);
    expect(container.has(vulnerable)).toBe(true);

    container.remove(vulnerable);
    expect(container.getCount(vulnerable)).toBe(0);
    expect(container.has(vulnerable)).toBe(false);
  });

  it('emits tag.add and tag.remove trace entries when sink is attached', () => {
    const manager = createProbeManager();
    const trace = new TraceBuffer();
    const container = new GameplayTagContainer({
      manager,
      entityId: 'hero-1',
      sink: trace,
    });
    const vulnerable = manager.resolve('Status.Debuff.Vulnerable');

    container.add(vulnerable);
    container.remove(vulnerable);

    expect(trace.entries).toEqual([
      {
        kind: 'tag.add',
        t: 0,
        entity: 'hero-1',
        tag: 'Status.Debuff.Vulnerable',
        count: 1,
      },
      {
        kind: 'tag.remove',
        t: 1,
        entity: 'hero-1',
        tag: 'Status.Debuff.Vulnerable',
        count: 0,
      },
    ]);
  });

  it('clone copies explicit tag counts without re-tracing', () => {
    const manager = createProbeManager();
    const trace = new TraceBuffer();
    const source = new GameplayTagContainer({ manager, sink: trace });
    const vulnerable = manager.resolve('Status.Debuff.Vulnerable');

    source.add(vulnerable, 2);
    trace.clear();

    const cloned = source.clone();
    expect(cloned.getCount(vulnerable)).toBe(2);
    expect(trace.entries).toEqual([]);
  });
});
