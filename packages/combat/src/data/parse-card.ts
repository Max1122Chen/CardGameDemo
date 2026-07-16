import type { GameplayTagManager, GameplayAbilityDefinition } from '@cardgame/core';
import {
  DefinitionParseError,
  parseGameplayAbilityDefinition,
  type WireGameplayAbilityDefinition,
  type WireGameplayAbilityEffectBindingSpec,
  type WireGameplayEffectDefinition,
  mergeParameterValues,
} from '@cardgame/core';
import type { CardCommitEffectTarget, CardDefinition, CardTargeting } from '../card-definition.js';
import type { CardId } from '../types.js';
import { TAKE_DAMAGE_ABILITY_ID } from '../set-by-caller-keys.js';

export type WireCardCommitEffect = {
  target: CardCommitEffectTarget;
  effect: WireGameplayEffectDefinition;
};

export type WireCardCommitEffectRef = {
  target: CardCommitEffectTarget;
  effectRef: string;
};

export type WireCardDefinition = {
  id: string;
  name: string;
  cost: number;
  targeting: CardTargeting;
  /** Inline ability (legacy) or omit when abilityRef is set. */
  ability?: WireGameplayAbilityDefinition;
  abilityRef?: string;
  /** GA parameter overrides (CDO). `cost` also merges into ApCost. */
  parameters?: Readonly<Record<string, number | boolean>>;
  /** Optional card-level effectBindings merged onto archetype. */
  effectBindings?: readonly WireGameplayAbilityEffectBindingSpec[];
  /** @deprecated F11 �?prefer parameters + effectBindings */
  setByCaller?: Readonly<Record<string, number>>;
  /** @deprecated F11 �?prefer effectBindings when=commit */
  commitEffects?: readonly WireCardCommitEffect[];
  commitEffectRefs?: readonly WireCardCommitEffectRef[];
};

export type DefinitionAssetCatalog = {
  effects: Readonly<Record<string, WireGameplayEffectDefinition>>;
  abilities: Readonly<Record<string, WireGameplayAbilityDefinition>>;
};

export type CombatCardBootstrap = {
  cardCatalog: Record<CardId, CardDefinition>;
  deckIds: readonly CardId[];
  takeDamageAbility: GameplayAbilityDefinition;
};

function resolveAbilityWire(
  wire: WireCardDefinition,
  catalog: DefinitionAssetCatalog | undefined,
): WireGameplayAbilityDefinition {
  if (wire.abilityRef) {
    const fromCatalog = catalog?.abilities[wire.abilityRef];
    if (!fromCatalog) {
      throw new DefinitionParseError(`Unknown abilityRef: ${wire.abilityRef}`);
    }
    return fromCatalog;
  }
  if (wire.ability) {
    return wire.ability;
  }
  throw new DefinitionParseError(`Card ${wire.id}: ability or abilityRef is required`);
}

function commitRefsToBindings(
  refs: readonly WireCardCommitEffectRef[] | undefined,
): WireGameplayAbilityEffectBindingSpec[] {
  if (!refs) {
    return [];
  }
  return refs.map((ref) => ({
    when: 'commit',
    target: ref.target,
    effectRef: ref.effectRef,
  }));
}

export function parseCardDefinition(
  wire: WireCardDefinition,
  manager: GameplayTagManager,
  catalog?: DefinitionAssetCatalog,
): CardDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('CardDefinition.id is required');
  }

  const id = wire.id;
  const abilityWire = resolveAbilityWire(wire, catalog);

  const mergedBindings: WireGameplayAbilityEffectBindingSpec[] = [
    ...(abilityWire.effectBindings ?? []),
    ...(wire.effectBindings ?? []),
    ...commitRefsToBindings(wire.commitEffectRefs),
  ];

  if (wire.commitEffects) {
    for (const binding of wire.commitEffects) {
      mergedBindings.push({
        when: 'commit',
        target: binding.target,
        effect: binding.effect,
      });
    }
  }

  const abilityWithBindings: WireGameplayAbilityDefinition = {
    ...abilityWire,
    effectBindings: mergedBindings.length > 0 ? mergedBindings : abilityWire.effectBindings,
  };

  const ability = parseGameplayAbilityDefinition(abilityWithBindings, manager, {
    effects: catalog?.effects,
  });

  const parameterOverrides: Record<string, number | boolean> = {
    ...(ability.parameterValues ?? {}),
    ApCost: wire.cost,
    ...(wire.parameters ?? {}),
  };

  const parameterValues = mergeParameterValues(ability.parameterSchema, parameterOverrides);

  return {
    id,
    name: wire.name,
    cost: wire.cost,
    targeting: wire.targeting,
    ability: {
      ...ability,
      parameterValues,
    },
  };
}

export function buildCardCatalog(
  wires: readonly WireCardDefinition[],
  manager: GameplayTagManager,
  catalog?: DefinitionAssetCatalog,
): Record<CardId, CardDefinition> {
  const cardCatalog: Record<CardId, CardDefinition> = {};

  for (const wire of wires) {
    const def = parseCardDefinition(wire, manager, catalog);
    if (cardCatalog[def.id]) {
      throw new DefinitionParseError(`Duplicate card id in catalog: ${def.id}`);
    }
    cardCatalog[def.id] = def;
  }

  return cardCatalog;
}

export function buildCombatCardBootstrap(
  wires: readonly WireCardDefinition[],
  deckIds: readonly string[],
  manager: GameplayTagManager,
  catalog?: DefinitionAssetCatalog,
): CombatCardBootstrap {
  const cardCatalog = buildCardCatalog(wires, manager, catalog);
  const parsedDeck = deckIds.map((id, index) => {
    if (!cardCatalog[id]) {
      throw new DefinitionParseError(`Deck references unknown card at [${index}]: ${id}`);
    }
    return id;
  });

  const takeDamageWire = catalog?.abilities[TAKE_DAMAGE_ABILITY_ID];
  if (!takeDamageWire) {
    throw new DefinitionParseError(`Missing ability in catalog: ${TAKE_DAMAGE_ABILITY_ID}`);
  }
  const takeDamageAbility = parseGameplayAbilityDefinition(takeDamageWire, manager, catalog);

  return { cardCatalog, deckIds: parsedDeck, takeDamageAbility };
}

export function catalogToDisplaySpecs(
  catalog: Record<CardId, CardDefinition>,
): Record<CardId, { id: CardId; name: string; cost: number }> {
  const specs: Record<CardId, { id: CardId; name: string; cost: number }> = {};
  for (const def of Object.values(catalog)) {
    specs[def.id] = { id: def.id, name: def.name, cost: def.cost };
  }
  return specs;
}
