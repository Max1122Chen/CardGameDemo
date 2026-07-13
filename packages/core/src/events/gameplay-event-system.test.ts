import { describe, expect, it, vi } from 'vitest';

import { TraceBuffer } from '../trace/trace.js';
import { GameplayTagManager, NATIVE_GAMEPLAY_TAGS } from '../tags/index.js';
import {
  createGameplayEvent,
  GameplayEventError,
  GameplayEventSystem,
} from './index.js';

function createSystem(sink?: TraceBuffer): {
  manager: GameplayTagManager;
  system: GameplayEventSystem;
} {
  const manager = GameplayTagManager.fromDefinitions({ native: NATIVE_GAMEPLAY_TAGS });
  const system = new GameplayEventSystem({ manager, sink });
  return { manager, system };
}

describe('GameplayEventSystem', () => {
  it('probe 1: bare dispatch routes to the default channel', () => {
    const { manager, system } = createSystem();
    const handler = vi.fn();

    system.subscribe({ channel: system.defaultChannel, handler });
    system.dispatch(
      createGameplayEvent(manager, {
        tags: [manager.resolve('Character.Player')],
        payload: { note: 'default' },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.payload).toEqual({ note: 'default' });
  });

  it('probe 2: listeners on other channels are not invoked', () => {
    const { manager, system } = createSystem();
    const combat = system.channel(manager.resolve('Combat'));
    const dungeon = system.channel(manager.resolve('Dungeon'));
    const combatHandler = vi.fn();
    const dungeonHandler = vi.fn();

    system.subscribe({ channel: combat, handler: combatHandler });
    system.subscribe({ channel: dungeon, handler: dungeonHandler });

    system.dispatch(
      combat,
      createGameplayEvent(manager, { tags: [manager.resolve('GameplayEvent.Combat')] }),
    );

    expect(combatHandler).toHaveBeenCalledTimes(1);
    expect(dungeonHandler).not.toHaveBeenCalled();
  });

  it('probe 3: requiredAll and requiredAny filter on event tags', () => {
    const { manager, system } = createSystem();
    const channel = system.channel(manager.resolve('Combat'));
    const matched = vi.fn();
    const missed = vi.fn();

    system.subscribe({
      channel,
      requiredAll: [manager.resolve('Status.Marked')],
      handler: matched,
    });
    system.subscribe({
      channel,
      requiredAny: [manager.resolve('Character.Player')],
      handler: missed,
    });

    system.dispatch(
      channel,
      createGameplayEvent(manager, {
        tags: [manager.resolve('Status.Marked'), manager.resolve('Character.Enemy')],
      }),
    );

    expect(matched).toHaveBeenCalledTimes(1);
    expect(missed).not.toHaveBeenCalled();
  });

  it('probe 4: unrestricted tag namespaces can coexist on one event', () => {
    const { manager, system } = createSystem();
    const channel = system.channel(manager.resolve('Combat'));
    const handler = vi.fn();

    system.subscribe({
      channel,
      requiredAll: [
        manager.resolve('GameplayEvent.Combat'),
        manager.resolve('Character.Enemy.Orc'),
        manager.resolve('Status.Debuff.Vulnerable'),
      ],
      handler,
    });

    system.dispatch(
      channel,
      createGameplayEvent(manager, {
        tags: [
          manager.resolve('GameplayEvent.Combat'),
          manager.resolve('Character.Enemy.Orc'),
          manager.resolve('Status.Debuff.Vulnerable'),
        ],
        payload: { amount: 3 },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.payload).toEqual({ amount: 3 });
  });

  it('probe 5: higher priority runs before lower; ties use registration order', () => {
    const { manager, system } = createSystem();
    const channel = system.channel(manager.resolve('Combat'));
    const order: string[] = [];

    system.subscribe({
      channel,
      listenerId: 'low',
      priority: 0,
      handler: () => {
        order.push('low');
      },
    });
    system.subscribe({
      channel,
      listenerId: 'high',
      priority: 10,
      handler: () => {
        order.push('high');
      },
    });
    system.subscribe({
      channel,
      listenerId: 'first',
      priority: 0,
      handler: () => {
        order.push('first');
      },
    });

    system.dispatch(channel, createGameplayEvent(manager));

    expect(order).toEqual(['high', 'low', 'first']);
  });

  it('probe 6: re-entrant dispatch beyond max depth throws', () => {
    const { manager, system } = createSystem();
    const shallow = new GameplayEventSystem({ manager, maxDispatchDepth: 2 });
    const channel = shallow.channel(manager.resolve('Combat'));

    shallow.subscribe({
      channel,
      handler: () => {
        shallow.dispatch(channel, createGameplayEvent(manager));
      },
    });

    expect(() => shallow.dispatch(channel, createGameplayEvent(manager))).toThrow(GameplayEventError);
  });

  it('probe 7: mutating publisher tags after dispatch does not affect handlers', () => {
    const { manager, system } = createSystem();
    const channel = system.channel(manager.resolve('Combat'));
    const event = createGameplayEvent(manager, {
      tags: [manager.resolve('Status.Marked')],
    });
    let seenMarked = false;

    system.subscribe({
      channel,
      handler: (dispatched) => {
        seenMarked = dispatched.tags.has(manager.resolve('Status.Marked'));
      },
    });

    system.dispatch(channel, event);
    event.tags.remove(manager.resolve('Status.Marked'));

    expect(seenMarked).toBe(true);
    expect(event.tags.has(manager.resolve('Status.Marked'))).toBe(false);
  });

  it('probe 8: emits event.dispatch trace with channel and tag names', () => {
    const trace = new TraceBuffer();
    const { manager, system } = createSystem(trace);
    const channel = system.channel(manager.resolve('Combat'));

    system.dispatch(
      channel,
      createGameplayEvent(manager, {
        tags: [manager.resolve('Status.Marked')],
        payload: { sourceId: 'p1', amount: 5 },
      }),
    );

    expect(trace.entries).toEqual([
      {
        kind: 'event.dispatch',
        t: 0,
        channel: 'Combat',
        tags: ['Status.Marked'],
        payloadKeys: ['sourceId', 'amount'],
      },
    ]);
  });

  it('allows duplicate listener ids to be rejected', () => {
    const { manager, system } = createSystem();
    const channel = system.channel(manager.resolve('Combat'));

    system.subscribe({ channel, listenerId: 'dup', handler: () => undefined });
    expect(() =>
      system.subscribe({ channel, listenerId: 'dup', handler: () => undefined }),
    ).toThrow(GameplayEventError);
  });

  it('unsubscribe removes a listener', () => {
    const { manager, system } = createSystem();
    const channel = system.channel(manager.resolve('Combat'));
    const handler = vi.fn();
    const listenerId = system.subscribe({ channel, handler });

    expect(system.unsubscribe(listenerId)).toBe(true);
    system.dispatch(channel, createGameplayEvent(manager));
    expect(handler).not.toHaveBeenCalled();
  });
});
