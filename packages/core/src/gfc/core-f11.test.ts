import { describe, expect, it } from 'vitest';

import { RuleEngine } from '../engine/rule-engine.js';
import { registerCombatAbilityHandlers } from '../combat/register-combat-abilities.js';
import { bootstrapCombatAttributes } from '../combat/take-damage.js';
import { CombatAttributes } from '../combat/combat-attributes.js';
import { createTakeDamageAbilityDefinition } from '../combat/take-damage-ability.js';
import { resolveModifierMagnitude } from '../gfc/attribute-evaluation.js';
import { SetByCallerKeys } from '../combat/set-by-caller-keys.js';
import { CombatSession } from '../combat/combat-session.js';
import { combatBootstrapConfig } from '../data/combat-bootstrap.test-helper.js';

describe('CORE-F11 SetByCaller', () => {
  it('resolves SetByCaller magnitude from application context', () => {
    const value = resolveModifierMagnitude(
      { kind: 'SetByCaller', key: SetByCallerKeys.Damage },
      {
        instigatorEntityId: 'p',
        setByCaller: { [SetByCallerKeys.Damage]: 6 },
      },
      () => undefined,
    );
    expect(value).toBe(6);
  });

  it('throws when SetByCaller key is missing', () => {
    expect(() =>
      resolveModifierMagnitude(
        { kind: 'SetByCaller', key: 'Data.Missing' },
        { instigatorEntityId: 'p', setByCaller: {} },
        () => undefined,
      ),
    ).toThrow(/missing key/);
  });
});

describe('CORE-F11 ActivationRegistry', () => {
  it('TakeDamage handler settles via registered handlerId', () => {
    const engine = RuleEngine.create();
    registerCombatAbilityHandlers(engine.activationRegistry);
    const target = engine.createEntityWithGfc('target');
    bootstrapCombatAttributes(target, { health: 20, block: 3 }, engine.tagManager);

    expect(createTakeDamageAbilityDefinition().handlerId).toBe('combat.takeDamage');

    const handle = target.listGrantedAbilities().find((a) => a.abilityDefId === 'ga.combat.take-damage')
      ?.handle;
    expect(handle).toBeDefined();

    target.setAttributeBase(CombatAttributes.DamageToTake, 8);
    const result = target.tryActivate(handle!, {
      instigatorEntityId: 'source',
      sourceEntityId: 'source',
      targetEntityId: 'target',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.activationData?.takeDamage).toEqual({ blocked: 3, healthLost: 5 });
    }
  });
});

describe('CORE-F11 card refs + SetByCaller combat', () => {
  it('strike uses abilityRef ga.card.play and SetByCaller damage', () => {
    const engine = RuleEngine.create();
    const { cardCatalog } = combatBootstrapConfig(engine);
    expect(cardCatalog.strike.ability.id).toBe('ga.card.play');
    expect(cardCatalog.strike.ability.handlerId).toBe('combat.cardPlay');
    expect(cardCatalog.strike.setByCaller?.['Data.Damage']).toBe(6);
    expect(cardCatalog.bash.setByCaller?.['Data.Damage']).toBe(8);
    expect(cardCatalog.strike.ability.id).toBe(cardCatalog.defend.ability.id);
  });

  it('F03 probes still hold with thin card JSON', () => {
    const engine = RuleEngine.create();
    const session = CombatSession.bootstrap(engine, {
      ...combatBootstrapConfig(engine),
      openingHand: ['weaken', 'strike'],
    });
    const weakenIndex = session.getSnapshot().hand.findIndex((c) => c.actionId === 'weaken');
    session.applyAction({ type: 'PlayCard', handIndex: weakenIndex });
    const strikeIndex = session.getSnapshot().hand.findIndex((c) => c.actionId === 'strike');
    session.applyAction({ type: 'PlayCard', handIndex: strikeIndex });
    expect(session.getSnapshot().enemies[0].health).toBe(5);
  });
});
