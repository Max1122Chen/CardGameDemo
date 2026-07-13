import { describe, expect, it, vi } from 'vitest';

import { createGameplayEvent } from '../events/gameplay-event.js';
import { ProbeComponentType } from './types.js';
import { RuleEngine } from './rule-engine.js';

describe('RuleEngine', () => {
  it('probe 1: wires tagManager, eventSystem, and gameWorld', () => {
    const engine = RuleEngine.create();

    expect(engine.tagManager).toBeDefined();
    expect(engine.eventSystem).toBeDefined();
    expect(engine.gameWorld).toBeDefined();
    expect(engine.tagManager.resolve('Channel.Default').name).toBe('Channel.Default');
  });

  it('probe 6: supports custom entity ids', () => {
    const engine = RuleEngine.create();
    const id = engine.gameWorld.createEntity('player-1');

    expect(engine.gameWorld.hasEntity('player-1')).toBe(true);
    expect(id).toBe('player-1');
  });

  it('probe 5: shared eventSystem dispatches to subscribers', () => {
    const engine = RuleEngine.create();
    const handler = vi.fn();

    engine.eventSystem.subscribe({
      channel: engine.eventSystem.defaultChannel,
      handler,
    });

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Character.Player')],
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stores probe components on gameWorld', () => {
    const engine = RuleEngine.create();
    const id = engine.gameWorld.createEntity();
    engine.gameWorld.addComponent(id, ProbeComponentType, { value: 3 });

    expect(engine.gameWorld.requireComponent(id, ProbeComponentType).value).toBe(3);
  });
});
