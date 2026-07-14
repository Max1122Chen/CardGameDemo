import { describe, expect, it, vi } from 'vitest';

import { createGameplayEvent } from '../events/gameplay-event.js';
import { RuleEngine } from '../engine/rule-engine.js';
import { TraceBuffer } from '../trace/trace.js';
import { GfcComponentType } from './gfc-component-type.js';
import { GameplayFrameworkComponent } from './gameplay-framework-component.js';
import type { GameplayEffectDefinition } from './types.js';

function createEffect(effect: GameplayEffectDefinition): GameplayEffectDefinition {
  return effect;
}

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

  it('probe 4: setAttributeBase initializes base/current state', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');

    gfc.setAttributeBase('Health', 12);

    expect(gfc.getAttribute('Health')).toEqual({
      baseValue: 12,
      currentValue: 12,
    });
  });

  it('probe 5: instant GE updates base immediately and does not stay active', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.setAttributeBase('Strength', 10);

    const effectId = gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.instant.strength',
        duration: { kind: 'Instant' },
        modifiers: [{ attribute: 'Strength', op: 'Add', magnitude: 3 }],
      }),
    );

    expect(effectId).toMatch(/^effect-\d+$/);
    expect(gfc.getAttribute('Strength')).toEqual({
      baseValue: 13,
      currentValue: 13,
    });
    expect(gfc.listActiveEffects()).toEqual([]);
  });

  it('probe 6: infinite GE recomputes current value and removal restores it', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.setAttributeBase('Strength', 10);

    const effectId = gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.infinite.buff',
        duration: { kind: 'Infinite' },
        modifiers: [
          { attribute: 'Strength', op: 'Add', magnitude: 2 },
          { attribute: 'Strength', op: 'Multiply', magnitude: 1.5 },
        ],
      }),
    );

    expect(gfc.getAttribute('Strength')).toEqual({
      baseValue: 10,
      currentValue: 18,
    });
    expect(gfc.removeGameplayEffect(effectId)).toBe(true);
    expect(gfc.getAttribute('Strength')).toEqual({
      baseValue: 10,
      currentValue: 10,
    });
  });

  it('probe 7: multiply modifiers use continuous multiplication', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.setAttributeBase('Damage', 10);

    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.mul.a',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Damage', op: 'Multiply', magnitude: 1.5 }],
      }),
    );
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.mul.b',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Damage', op: 'Multiply', magnitude: 2 }],
      }),
    );

    expect(gfc.getAttribute('Damage')).toEqual({
      baseValue: 10,
      currentValue: 30,
    });
  });

  it('probe 8: override uses last applied active effect', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.setAttributeBase('Armor', 8);

    const first = gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.override.first',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Armor', op: 'Override', magnitude: 20 }],
      }),
    );
    const second = gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.override.second',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Armor', op: 'Override', magnitude: 5 }],
      }),
    );

    expect(gfc.getAttribute('Armor')?.currentValue).toBe(5);
    expect(gfc.removeGameplayEffect(second)).toBe(true);
    expect(gfc.getAttribute('Armor')?.currentValue).toBe(20);
    expect(gfc.removeGameplayEffect(first)).toBe(true);
    expect(gfc.getAttribute('Armor')?.currentValue).toBe(8);
  });

  it('probe 9: duration GE progresses on matching tag and expires at magnitude', () => {
    const trace = new TraceBuffer();
    const engine = RuleEngine.create({ traceSink: trace });
    const gfc = engine.createEntityWithGfc('player');
    gfc.setAttributeBase('Strength', 10);
    const combat = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));

    const effectId = gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.duration.marked',
        duration: {
          kind: 'Duration',
          unitTag: engine.tagManager.resolve('Status.Marked'),
          magnitude: 2,
          channels: [combat],
        },
        grantedTags: [engine.tagManager.resolve('Status.Marked')],
        modifiers: [{ attribute: 'Strength', op: 'Add', magnitude: 1 }],
      }),
    );

    expect(gfc.getAttribute('Strength')?.currentValue).toBe(11);
    expect(gfc.hasTag(engine.tagManager.resolve('Status.Marked'))).toBe(true);

    engine.eventSystem.dispatch(
      combat,
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Character.Player')],
      }),
    );
    expect(gfc.listActiveEffects()).toHaveLength(1);

    engine.eventSystem.dispatch(
      combat,
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
      }),
    );
    expect(gfc.listActiveEffects()).toHaveLength(1);

    engine.eventSystem.dispatch(
      combat,
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
      }),
    );

    expect(gfc.removeGameplayEffect(effectId)).toBe(false);
    expect(gfc.listActiveEffects()).toEqual([]);
    expect(gfc.getAttribute('Strength')).toEqual({
      baseValue: 10,
      currentValue: 10,
    });
    expect(gfc.hasTag(engine.tagManager.resolve('Status.Marked'))).toBe(false);
    expect(trace.entries.some((entry) => entry.kind === 'ge.duration.expired')).toBe(true);
  });

  it('probe 10: duration channels are entity-local and unsubscribe on cleanup', () => {
    const trace = new TraceBuffer();
    const engine = RuleEngine.create({ traceSink: trace });
    const player = engine.createEntityWithGfc('player');
    const enemy = engine.createEntityWithGfc('enemy');
    player.setAttributeBase('Tempo', 1);
    enemy.setAttributeBase('Tempo', 1);
    const combat = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));
    const dungeon = engine.eventSystem.channel(engine.tagManager.resolve('Dungeon'));

    player.applyGameplayEffect(
      createEffect({
        id: 'ge.player.duration',
        duration: {
          kind: 'Duration',
          unitTag: engine.tagManager.resolve('Status.Marked'),
          magnitude: 1,
          channels: [combat],
        },
        modifiers: [{ attribute: 'Tempo', op: 'Add', magnitude: 1 }],
      }),
    );
    enemy.applyGameplayEffect(
      createEffect({
        id: 'ge.enemy.duration',
        duration: {
          kind: 'Duration',
          unitTag: engine.tagManager.resolve('Status.Marked'),
          magnitude: 1,
          channels: [dungeon],
        },
        modifiers: [{ attribute: 'Tempo', op: 'Add', magnitude: 2 }],
      }),
    );

    engine.eventSystem.dispatch(
      combat,
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
      }),
    );

    expect(player.listActiveEffects()).toEqual([]);
    expect(enemy.listActiveEffects()).toHaveLength(1);
    expect(trace.entries.filter((entry) => entry.kind === 'gfc.channel.unsubscribe')).toHaveLength(1);
  });

  it('probe 11: toJSON includes tags, attributes, and active effects', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.addTag(engine.tagManager.resolve('Status.Marked'), 2);
    gfc.setAttributeBase('Health', 20);
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.health.buff',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Health', op: 'Add', magnitude: 5 }],
      }),
    );

    expect(gfc.toJSON()).toEqual({
      entityId: 'player',
      tags: [{ name: 'Status.Marked', count: 2 }],
      attributes: [{ attribute: 'Health', baseValue: 20, currentValue: 25 }],
      activeEffects: [
        {
          id: expect.stringMatching(/^effect-\d+$/),
          definitionId: 'ge.health.buff',
          durationKind: 'Infinite',
          durationProgress: undefined,
          durationTarget: undefined,
          durationChannels: [],
          ongoingContributing: true,
          stackedDurationMagnitude: undefined,
        },
      ],
      grantedAbilities: [],
      activeAbilities: [],
    });
  });

  it('probe 12: dispose stops gfc subscriptions', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('listener');
    const handler = vi.fn();

    gfc.subscribe({ handler });
    gfc.dispose();

    engine.eventSystem.dispatch(createGameplayEvent(engine.tagManager));
    expect(handler).not.toHaveBeenCalled();
  });

  it('probe 13: grantAbility returns handle and revoke is safe', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    const handle = gfc.grantAbility({
      id: 'passive.equip',
      kind: 'active',
      tags: {},
      effectsOnActivate: [],
    });

    expect(handle).toMatch(/^ability-\d+$/);
    expect(gfc.revokeAbility(handle)).toBe(true);
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

  it('rejects invalid duration magnitude', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');

    expect(() =>
      gfc.applyGameplayEffect(
        createEffect({
          id: 'ge.bad.duration',
          duration: {
            kind: 'Duration',
            unitTag: engine.tagManager.resolve('Status.Marked'),
            magnitude: 0,
          },
          modifiers: [],
        }),
      ),
    ).toThrow(/Duration magnitude/);
  });
});
