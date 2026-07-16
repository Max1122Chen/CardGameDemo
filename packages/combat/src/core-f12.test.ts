import { describe, expect, it } from 'vitest';

import {
  CombatAttributes,
  CombatSession,
  bootstrapCombatAttributes,
  combatBootstrapConfig,
  createTakeDamageAbilityDefinition,
  registerCombatAbilityHandlers,
} from './index.js';
import { RuleEngine } from '@cardgame/core';

describe('CORE-F12 ActivationRegistry + card archetypes', () => {
  it('TakeDamage handler settles via registered handlerId', () => {
    const engine = RuleEngine.create();
    registerCombatAbilityHandlers(engine.activationRegistry);
    const target = engine.createEntityWithGfc('target');
    bootstrapCombatAttributes(target, { health: 20, block: 3 }, engine.tagManager);

    expect(createTakeDamageAbilityDefinition().handlerId).toBe('combat.takeDamage');

    const handle = target
      .listGrantedAbilities()
      .find((a) => a.abilityDefId === 'ga.archetype.takeDamage')?.handle;
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

  it('strike uses cardPlayDamage archetype and Damage parameter', () => {
    const engine = RuleEngine.create();
    const { cardCatalog } = combatBootstrapConfig(engine);
    expect(cardCatalog.strike!.ability.id).toBe('ga.archetype.cardPlayDamage');
    expect(cardCatalog.strike!.ability.handlerId).toBe('combat.cardPlayDamage');
    expect(cardCatalog.strike!.ability.parameterValues?.Damage).toBe(6);
    expect(cardCatalog.bash!.ability.parameterValues?.Damage).toBe(8);
    expect(cardCatalog.defend!.ability.id).toBe('ga.archetype.cardPlayBlock');
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
    expect(session.getSnapshot().enemies[0]!.health).toBe(5);
  });
});
