import { describe, expect, it } from 'vitest';

import { createGameplayEvent } from '../events/gameplay-event.js';
import { RuleEngine } from '../engine/rule-engine.js';
import type { GameplayAbilityDefinition } from '../ga/types.js';
import { TraceBuffer } from '../trace/trace.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';

function instantEffect(id: string, attribute: string, magnitude: number): GameplayEffectDefinition {
  return {
    id,
    duration: { kind: 'Instant' },
    modifiers: [{ attribute, op: 'Add', magnitude }],
  };
}

function activeAbility(overrides: Partial<GameplayAbilityDefinition> = {}): GameplayAbilityDefinition {
  return {
    id: 'ga.active.test',
    kind: 'active',
    tags: {},
    effectsOnActivate: [{ target: 'self', effect: instantEffect('ge.test.buff', 'Strength', 2) }],
    ...overrides,
  };
}

describe('GameplayAbility on GFC', () => {
  it('grants and revokes abilities with unique handles', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    const def = activeAbility();

    const first = gfc.grantAbility(def);
    const second = gfc.grantAbility(def);

    expect(first).not.toBe(second);
    expect(gfc.listGrantedAbilities()).toHaveLength(2);
    expect(gfc.revokeAbility(first)).toBe(true);
    expect(gfc.listGrantedAbilities()).toHaveLength(1);
    expect(gfc.revokeAbility('missing')).toBe(false);
  });

  it('tryActivate applies instant GE to self', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('Strength', 10);
    const handle = player.grantAbility(activeAbility());

    const result = player.tryActivate(handle, { instigatorEntityId: 'player' });

    expect(result.ok).toBe(true);
    expect(player.getAttribute('Strength')?.baseValue).toBe(12);
    expect(player.listActiveAbilities()).toHaveLength(0);
  });

  it('canActivate respects owner blocked tags', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const stunned = engine.tagManager.resolve('Status.Debuff.Vulnerable');
    player.addTag(stunned);

    const handle = player.grantAbility(
      activeAbility({
        tags: { activationBlockedTags: ['Status.Debuff.Vulnerable'] },
      }),
    );

    expect(player.canActivate(handle, { instigatorEntityId: 'player' })).toBe(false);
  });

  it('checks source and target tag gates', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const enemy = engine.createEntityWithGfc('enemy-1');
    enemy.addTag(engine.tagManager.resolve('Character.Enemy'));

    const handle = player.grantAbility(
      activeAbility({
        tags: { targetRequiredTags: ['Character.Enemy'] },
        effectsOnActivate: [
          { target: 'target', effect: instantEffect('ge.test.hit', 'Health', -3) },
        ],
      }),
    );

    enemy.setAttributeBase('Health', 10);

    const fail = player.tryActivate(handle, {
      instigatorEntityId: 'player',
      targetEntityId: 'player',
    });
    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.reason).toBe('cannot_activate');
    }

    const ok = player.tryActivate(handle, {
      instigatorEntityId: 'player',
      targetEntityId: 'enemy-1',
    });
    expect(ok.ok).toBe(true);
    expect(enemy.getAttribute('Health')?.baseValue).toBe(7);
  });

  it('spends cost on successful activation', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('ActionPoints', 3);

    const handle = player.grantAbility(
      activeAbility({
        cost: { attribute: 'ActionPoints', amount: 2 },
      }),
    );

    const fail = player.tryActivate(handle, { instigatorEntityId: 'player' });
    expect(fail.ok).toBe(true);
    expect(player.getAttribute('ActionPoints')?.baseValue).toBe(1);

    const handle2 = player.grantAbility(
      activeAbility({
        id: 'ga.active.costly',
        cost: { attribute: 'ActionPoints', amount: 2 },
      }),
    );
    const insufficient = player.tryActivate(handle2, { instigatorEntityId: 'player' });
    expect(insufficient.ok).toBe(false);
    if (!insufficient.ok) {
      expect(insufficient.reason).toBe('insufficient_cost');
    }
  });

  it('passive ability auto-activates on default channel event', () => {
    const engine = RuleEngine.create();
    const listener = engine.createEntityWithGfc('listener');
    listener.setAttributeBase('Armor', 0);

    listener.grantAbility({
      id: 'ga.passive.marked',
      kind: 'passive',
      tags: {},
      passiveTrigger: {
        eventTags: ['Status.Marked'],
      },
      effectsOnActivate: [{ target: 'self', effect: instantEffect('ge.passive.armor', 'Armor', 4) }],
    });

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
      }),
    );

    expect(listener.getAttribute('Armor')?.baseValue).toBe(4);
  });

  it('emits ga trace entries', () => {
    const traceBuffer = new TraceBuffer();
    const engine = RuleEngine.create({ traceSink: traceBuffer });
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('Strength', 1);
    const handle = player.grantAbility(activeAbility());

    player.tryActivate(handle, { instigatorEntityId: 'player' });

    const kinds = traceBuffer.entries.map((entry) => entry.kind);
    expect(kinds).toContain('ga.grant');
    expect(kinds).toContain('ga.activate');
    expect(kinds).toContain('ga.end');
  });

  it('endAbility is independent from revoke', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const handle = player.grantAbility(
      activeAbility({
        effectsOnActivate: [
          {
            target: 'self',
            effect: {
              id: 'ge.infinite.buff',
              duration: { kind: 'Infinite' },
              modifiers: [{ attribute: 'Strength', op: 'Add', magnitude: 1 }],
            },
          },
        ],
      }),
    );

    const result = player.tryActivate(handle, { instigatorEntityId: 'player' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(player.listActiveAbilities()).toHaveLength(1);
    expect(player.revokeAbility(handle)).toBe(true);
    expect(player.listGrantedAbilities()).toHaveLength(0);
    expect(player.listActiveAbilities()).toHaveLength(1);

    expect(player.endAbility(result.instanceId)).toBe(true);
    expect(player.listActiveAbilities()).toHaveLength(0);
  });

  it('endPolicy manual keeps Active after Instant effects', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('Strength', 10);
    const handle = player.grantAbility(
      activeAbility({
        endPolicy: 'manual',
        chargeCostOnActivate: false,
        cost: { attribute: 'ActionPoints', amount: 1 },
      }),
    );
    player.setAttributeBase('ActionPoints', 3);

    const result = player.tryActivate(handle, { instigatorEntityId: 'player' });
    expect(result.ok).toBe(true);
    expect(player.getAttribute('Strength')?.baseValue).toBe(12);
    expect(player.getAttribute('ActionPoints')?.baseValue).toBe(3);
    expect(player.listActiveAbilities()).toHaveLength(1);
    if (result.ok) {
      expect(player.endAbility(result.instanceId)).toBe(true);
    }
    expect(player.listActiveAbilities()).toHaveLength(0);
  });

  it('listenWhileActive notifies host and unsubscribes on end', () => {
    const matches: string[] = [];
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player', {
      onActiveAbilityEvent: (info) => {
        matches.push(String(info.event.payload?.cardTag ?? ''));
        player.endAbility(info.instanceId);
      },
    });

    const handle = player.grantAbility(
      activeAbility({
        id: 'ga.card.preview',
        endPolicy: 'manual',
        effectsOnActivate: [],
        listenWhileActive: {
          eventTags: ['Status.Marked'],
          payloadMatch: { cardTag: 'strike' },
        },
      }),
    );

    const activated = player.tryActivate(handle, { instigatorEntityId: 'player' });
    expect(activated.ok).toBe(true);
    expect(player.listActiveAbilities()).toHaveLength(1);

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
        payload: { cardTag: 'bash' },
      }),
    );
    expect(matches).toEqual([]);
    expect(player.listActiveAbilities()).toHaveLength(1);

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
        payload: { cardTag: 'strike' },
      }),
    );
    expect(matches).toEqual(['strike']);
    expect(player.listActiveAbilities()).toHaveLength(0);

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
        payload: { cardTag: 'strike' },
      }),
    );
    expect(matches).toEqual(['strike']);
  });

  it('autoActivateOnGrant activates with listenWhileActive', () => {
    let heard = false;
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player', {
      onActiveAbilityEvent: () => {
        heard = true;
      },
    });
    player.setAttributeBase('Armor', 0);

    player.grantAbility({
      id: 'ga.auto.listen',
      kind: 'active',
      tags: {},
      autoActivateOnGrant: true,
      endPolicy: 'manual',
      effectsOnActivate: [{ target: 'self', effect: instantEffect('ge.auto.armor', 'Armor', 1) }],
      listenWhileActive: { eventTags: ['Status.Marked'] },
    });

    expect(player.getAttribute('Armor')?.baseValue).toBe(1);
    expect(player.listActiveAbilities()).toHaveLength(1);

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
      }),
    );
    expect(heard).toBe(true);
  });
});
