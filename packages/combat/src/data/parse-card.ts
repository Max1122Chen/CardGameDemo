import type { GameplayTagManager, GameplayAbilityDefinition } from '@cardgame/core';
import {
  DefinitionParseError,
  parseGameplayAbilityDefinition,
  type WireGameplayAbilityDefinition,
  type WireGameplayAbilityEffectBindingSpec,
  type WireGameplayEffectDefinition,
  mergeParameterValues,
} from '@cardgame/core';
import type {
  AttributeBonusGrade,
  AttributeBonusSpec,
} from '../attribute-bonus.js';
import type { PrimaryAttributeName } from '../combat-attributes.js';
import type { CardDefinition, CardTargeting } from '../card-definition.js';
import type { CardId } from '../types.js';
import { TAKE_DAMAGE_ABILITY_ID } from '../set-by-caller-keys.js';

const VALID_BONUS_GRADES: readonly AttributeBonusGrade[] = [
  'none',
  'A',
  'B',
  'C',
  'D',
];

export type WireCardDefinition = {
  id: string;
  name: string;
  cost: number;
  targeting: CardTargeting;
  /** Inline ability for tests; prefer abilityRef against the catalog. */
  ability?: WireGameplayAbilityDefinition;
  abilityRef?: string;
  /** GA parameter overrides (CDO). `cost` also merges into ApCost. */
  parameters?: Readonly<Record<string, number | boolean>>;
  /** Optional card-level effectBindings merged onto archetype. */
  effectBindings?: readonly WireGameplayAbilityEffectBindingSpec[];
  attributeBonus?: {
    grade: AttributeBonusGrade;
    stats: readonly PrimaryAttributeName[];
  };
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

function parseAttributeBonus(
  wire: WireCardDefinition,
): AttributeBonusSpec | undefined {
  if (wire.attributeBonus === undefined) {
    return undefined;
  }
  const { grade, stats } = wire.attributeBonus;
  if (!VALID_BONUS_GRADES.includes(grade)) {
    throw new DefinitionParseError(
      `Card ${wire.id}: unknown attributeBonus grade "${String(grade)}"`,
    );
  }
  if (!Array.isArray(stats) || stats.length === 0) {
    throw new DefinitionParseError(`Card ${wire.id}: attributeBonus.stats must be non-empty`);
  }
  for (const stat of stats as readonly string[]) {
    if (!isPrimaryAttributeName(stat)) {
      throw new DefinitionParseError(
        `Card ${wire.id}: unknown primary stat in attributeBonus: ${String(stat)}`,
      );
    }
  }
  return { grade, stats: stats as readonly PrimaryAttributeName[] };
}

function isPrimaryAttributeName(value: string): value is PrimaryAttributeName {
  return (
    value === 'Strength' ||
    value === 'Constitution' ||
    value === 'Dexterity' ||
    value === 'Intelligence' ||
    value === 'Wisdom' ||
    value === 'Charisma'
  );
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
    ...(wire.effectBindings ?? []),
    ...(abilityWire.effectBindings ?? []),
  ];

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
    attributeBonus: parseAttributeBonus(wire),
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
