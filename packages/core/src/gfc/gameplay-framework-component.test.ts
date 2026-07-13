import { describe, expect, it, vi } from 'vitest';

import { createGameplayEvent } from '../events/gameplay-event.js';
import { RuleEngine } from '../engine/rule-engine.js';
import { GameplayNotImplementedError } from './errors.js';
import { GfcComponentType } from './gfc-component-type.js';
import { GameplayFrameworkComponent } from './gameplay-framework-component.js';

describe('GameplayFrameworkComponent', () => {
  it('probe 1: createEntityWithGfc registers a GFC component', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player-1');

    expect(gfc).toBeInstanceOf(GameplayFrameworkComponent);
    expect(gfc.entityId).toBe('player-1');
    expect(engine.getGfc('player-1')).toBe(gfc);
    expect(engine.gameWorld.hasComponent('player-1', GfcComponentType)).toBe(true);
  });

  it('probe 2: tag state is isolated per GFC', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const enemy = engine.createEntityWithGfc('enemy');
    const marked = engine.tagManager.resolve('Status.Marked');

    player.addTag(marked);

    expect(player.hasTag(marked)).toBe(true);
    expect(enemy.hasTag(marked)).toBe(false);
  });

  it('probe 3: gfc dispatch reaches subscribers on shared eventSystem', () => {
    const engine = RuleEngine.create();
    const publisher = engine.createEntityWithGfc('publisher');
    const listener = engine.createEntityWithGfc('listener');
    const handler = vi.fn();
    const combat = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));

    listener.subscribe({ channel: combat, handler });
    publisher.dispatch(
      combat,
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('GameplayEvent.Combat')],
        payload: { entityId: 'publisher' },
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('probe 4: dispose stops gfc subscriptions', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('listener');
    const handler = vi.fn();

    gfc.subscribe({ handler });
    gfc.dispose();

    engine.eventSystem.dispatch(createGameplayEvent(engine.tagManager));
    expect(handler).not.toHaveBeenCalled();
  });

  it('probe 5: getAttribute throws not implemented', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');

    expect(() => gfc.getAttribute('Combat', 'Health')).toThrow(GameplayNotImplementedError);
  });

  it('probe 6: toJSON includes entityId and tags only', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.addTag(engine.tagManager.resolve('Status.Marked'), 2);

    expect(gfc.toJSON()).toEqual({
      entityId: 'player',
      tags: [{ name: 'Status.Marked', count: 2 }],
    });
  });

  it('probe 7: grantAbility returns handle and revoke is safe', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    const handle = gfc.grantAbility({ id: 'passive.equip' });

    expect(handle).toMatch(/^ability-\d+$/);
    expect(() => gfc.revokeAbility(handle)).not.toThrow();
  });

  it('rejects duplicate GFC on same entity', () => {
    const engine = RuleEngine.create();
    engine.createEntityWithGfc('player');

    expect(() => engine.createEntityWithGfc('player')).toThrow(/already exists/);
  });

  it('engine.dispose disposes all gfc listeners', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('listener');
    const handler = vi.fn();

    gfc.subscribe({ handler });
    engine.dispose();

    engine.eventSystem.dispatch(createGameplayEvent(engine.tagManager));
    expect(handler).not.toHaveBeenCalled();
  });
});
