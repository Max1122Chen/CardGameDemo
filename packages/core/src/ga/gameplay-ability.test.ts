import { describe, expect, it } from 'vitest';

import { createGameplayEvent } from '../events/gameplay-event.js';
import { RuleEngine } from '../engine/rule-engine.js';
import type { GameplayAbilityDefinition } from '../ga/types.js';
import { TraceBuffer } from '../trace/trace.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import type { AbilityActivationHandler } from './ability-activation-registry.js';

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
    ...overrides,
  };
}

describe('GameplayAbility thin runtime on GFC', () => {
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
      }),
    );

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
  });

  it('invokes hook onActivate without auto cost or auto end', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    let hookCalled = false;

    engine.activationRegistry.register('test.hook', {
      onActivate({ services }) {
        hookCalled = true;
        services.applyEffectBindings('preview');
        services.endAbility();
        return { ok: true };
      },
    });

    const handle = player.grantAbility(
      activeAbility({
        handlerId: 'test.hook',
        effectBindings: [
          {
            when: 'preview',
            target: 'self',
            effect: instantEffect('ge.test.buff', 'Strength', 2),
          },
        ],
      }),
    );
    player.setAttributeBase('Strength', 10);

    const result = player.tryActivate(handle, { instigatorEntityId: 'player' });

    expect(hookCalled).toBe(true);
    expect(result.ok).toBe(true);
    expect(player.getAttribute('Strength')?.baseValue).toBe(12);
    expect(player.listActiveAbilities()).toHaveLength(0);
  });

  it('startListen unsubscribes when endAbility runs', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const heard: string[] = [];

    engine.activationRegistry.register('test.listen', {
      onActivate({ services }) {
        services.startListen({ eventTags: ['Status.Marked'] }, (event) => {
          heard.push(String(event.payload?.cardTag ?? ''));
        });
        return { ok: true };
      },
    } satisfies AbilityActivationHandler);

    const handle = player.grantAbility(
      activeAbility({ handlerId: 'test.listen' }),
    );
    const activated = player.tryActivate(handle, { instigatorEntityId: 'player' });
    expect(activated.ok).toBe(true);
    expect(player.listActiveAbilities()).toHaveLength(1);

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
        payload: { cardTag: 'strike' },
      }),
    );
    expect(heard).toEqual(['strike']);

    if (activated.ok) {
      expect(player.endAbility(activated.instanceId)).toBe(true);
    }
    expect(player.listActiveAbilities()).toHaveLength(0);

    engine.eventSystem.dispatch(
      createGameplayEvent(engine.tagManager, {
        tags: [engine.tagManager.resolve('Status.Marked')],
        payload: { cardTag: 'bash' },
      }),
    );
    expect(heard).toEqual(['strike']);
  });

  it('commitAbility applies Cost GE when hook calls it', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('ActionPoints', 3);

    engine.activationRegistry.register('test.cost', {
      onActivate({ services }) {
        if (!services.commitAbility()) {
          return { ok: false, reason: 'cannot_activate' };
        }
        services.endAbility();
        return { ok: true };
      },
    });

    const handle = player.grantAbility(
      activeAbility({
        handlerId: 'test.cost',
        costEffect: {
          id: 'ge.test.spend-ap',
          duration: { kind: 'Instant' },
          modifiers: [
            {
              attribute: 'ActionPoints',
              op: 'Add',
              magnitude: { kind: 'SetByCaller', key: 'Data.Amount' },
            },
          ],
        },
        costBindings: { 'Data.Amount': '$ApCost' },
        parameterValues: { ApCost: 2 },
      }),
    );

    const result = player.tryActivate(handle, { instigatorEntityId: 'player' });
    expect(result.ok).toBe(true);
    expect(player.getAttribute('ActionPoints')?.baseValue).toBe(1);
    expect(player.listActiveAbilities()).toHaveLength(0);
  });

  it('emits ga trace entries', () => {
    const traceBuffer = new TraceBuffer();
    const engine = RuleEngine.create({ traceSink: traceBuffer });
    const player = engine.createEntityWithGfc('player');

    engine.activationRegistry.register('test.trace', {
      onActivate({ services }) {
        services.endAbility();
        return { ok: true };
      },
    });

    const handle = player.grantAbility(activeAbility({ handlerId: 'test.trace' }));
    player.tryActivate(handle, { instigatorEntityId: 'player' });

    const kinds = traceBuffer.entries.map((entry) => entry.kind);
    expect(kinds).toContain('ga.grant');
    expect(kinds).toContain('ga.activate');
    expect(kinds).toContain('ga.end');
  });

  it('endAbility is independent from revoke', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');

    engine.activationRegistry.register('test.stayActive', {
      onActivate() {
        return { ok: true };
      },
    });

    const handle = player.grantAbility(activeAbility({ handlerId: 'test.stayActive' }));
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
});
