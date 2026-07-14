import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import {
  DefinitionParseError,
  parseGameplayAbilityDefinition,
  parseGameplayEffectDefinition,
  type WireGameplayAbilityDefinition,
  type WireGameplayEffectDefinition,
} from '../definitions/parse-definitions.js';
import type { CardCommitEffectTarget, CardDefinition, CardTargeting } from '../combat/card-definition.js';
import { CARD_ACTION_IDS, type CardActionId } from '../combat/types.js';

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
  setByCaller?: Readonly<Record<string, number>>;
  commitEffects?: readonly WireCardCommitEffect[];
  commitEffectRefs?: readonly WireCardCommitEffectRef[];
};

export type DefinitionAssetCatalog = {
  effects: Readonly<Record<string, WireGameplayEffectDefinition>>;
  abilities: Readonly<Record<string, WireGameplayAbilityDefinition>>;
};

export type CombatCardBootstrap = {
  cardCatalog: Record<CardActionId, CardDefinition>;
  deckIds: readonly CardActionId[];
};

function assertCardActionId(id: string): CardActionId {
  if (!(CARD_ACTION_IDS as readonly string[]).includes(id)) {
    throw new DefinitionParseError(`Unknown card id: ${id}`);
  }
  return id as CardActionId;
}

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

export function parseCardDefinition(
  wire: WireCardDefinition,
  manager: GameplayTagManager,
  catalog?: DefinitionAssetCatalog,
): CardDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('CardDefinition.id is required');
  }

  const id = assertCardActionId(wire.id);
  const abilityWire = resolveAbilityWire(wire, catalog);

  const commitEffects: {
    target: CardCommitEffectTarget;
    effect: ReturnType<typeof parseGameplayEffectDefinition>;
  }[] = [];

  if (wire.commitEffects) {
    for (const [index, binding] of wire.commitEffects.entries()) {
      commitEffects.push({
        target: binding.target,
        effect: parseGameplayEffectDefinition(
          binding.effect,
          manager,
          `commitEffects[${index}].effect`,
        ),
      });
    }
  }

  if (wire.commitEffectRefs) {
    for (const [index, binding] of wire.commitEffectRefs.entries()) {
      const effectWire = catalog?.effects[binding.effectRef];
      if (!effectWire) {
        throw new DefinitionParseError(
          `Unknown commitEffectRefs[${index}].effectRef: ${binding.effectRef}`,
        );
      }
      commitEffects.push({
        target: binding.target,
        effect: parseGameplayEffectDefinition(
          effectWire,
          manager,
          `commitEffectRefs[${index}].effect`,
        ),
      });
    }
  }

  return {
    id,
    name: wire.name,
    cost: wire.cost,
    targeting: wire.targeting,
    ability: parseGameplayAbilityDefinition(abilityWire, manager),
    setByCaller: wire.setByCaller,
    commitEffects: commitEffects.length > 0 ? commitEffects : undefined,
  };
}

export function buildCardCatalog(
  wires: readonly WireCardDefinition[],
  manager: GameplayTagManager,
  catalog?: DefinitionAssetCatalog,
): Record<CardActionId, CardDefinition> {
  const cardCatalog = {} as Record<CardActionId, CardDefinition>;

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
    const cardId = assertCardActionId(id);
    if (!cardCatalog[cardId]) {
      throw new DefinitionParseError(`Deck references unknown card at [${index}]: ${id}`);
    }
    return cardId;
  });

  return { cardCatalog, deckIds: parsedDeck };
}

export function catalogToDisplaySpecs(
  catalog: Record<CardActionId, CardDefinition>,
): Record<CardActionId, { id: CardActionId; name: string; cost: number }> {
  const specs = {} as Record<CardActionId, { id: CardActionId; name: string; cost: number }>;
  for (const def of Object.values(catalog)) {
    specs[def.id] = { id: def.id, name: def.name, cost: def.cost };
  }
  return specs;
}
