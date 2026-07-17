import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import {
  CombatAttributes,
  CombatSession,
  bootstrapCombatAttributes,
  loadCombatBootstrapFromRepo,
  registerCombatAbilityHandlers,
  TAKE_DAMAGE_ABILITY_ID,
  TAKE_DAMAGE_HANDLER_ID,
} from './index.js';
import { probeCombatBootstrapConfig, createProbeCombatEngine } from './test-bootstrap.js';

describe('CORE-F12 ActivationRegistry + card archetypes', () => {
  it('TakeDamage handler settles via registered handlerId', () => {
    const engine = RuleEngine.create();
    registerCombatAbilityHandlers(engine.activationRegistry);
    const { takeDamageAbility } = loadCombatBootstrapFromRepo(engine.tagManager);
    const target = engine.createEntityWithGfc('target');
    bootstrapCombatAttributes(
      target,
      { health: 20, block: 3, takeDamageAbility },
      engine.tagManager,
    );

    expect(takeDamageAbility.id).toBe(TAKE_DAMAGE_ABILITY_ID);
    expect(takeDamageAbility.handlerId).toBe(TAKE_DAMAGE_HANDLER_ID);

    const handle = target
      .listGrantedAbilities()
      .find((a) => a.abilityDefId === TAKE_DAMAGE_ABILITY_ID)?.handle;
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
    expect(target.listActiveAbilities()).toHaveLength(0);
  });

  it('strike uses cardPlayDamage archetype and Damage parameter', () => {
    const engine = createProbeCombatEngine();
    const { cardCatalog } = loadCombatBootstrapFromRepo(engine.tagManager);
    expect(cardCatalog.strike!.ability.id).toBe('ga.archetype.cardPlayDamage');
    expect(cardCatalog.strike!.ability.handlerId).toBe('combat.cardPlayDamage');
    expect(cardCatalog.strike!.ability.parameterValues?.Damage).toBe(6);
    expect(cardCatalog.bash!.ability.parameterValues?.Damage).toBe(8);
    expect(cardCatalog.defend!.ability.id).toBe('ga.archetype.cardPlayBlock');
  });

  it('F03 probes still hold with thin card JSON', () => {
    const engine = createProbeCombatEngine();
    const session = CombatSession.bootstrap(engine, {
      ...probeCombatBootstrapConfig(engine),
      openingHand: ['weaken', 'strike'],
    });
    const weakenIndex = session.getSnapshot().hand.findIndex((c) => c.actionId === 'weaken');
    session.applyAction({ type: 'PlayCard', handIndex: weakenIndex });
    const strikeIndex = session.getSnapshot().hand.findIndex((c) => c.actionId === 'strike');
    session.applyAction({ type: 'PlayCard', handIndex: strikeIndex });
    expect(session.getSnapshot().enemies[0]!.health).toBe(2);
  });
});
