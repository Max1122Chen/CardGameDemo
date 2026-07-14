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

export type WireCardDefinition = {
  id: string;
  name: string;
  cost: number;
  targeting: CardTargeting;
  ability: WireGameplayAbilityDefinition;
  commitEffects?: readonly WireCardCommitEffect[];
  settleTakeDamageOnTarget?: boolean;
  applyBlockFromPreview?: boolean;
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

export function parseCardDefinition(
  wire: WireCardDefinition,
  manager: GameplayTagManager,
): CardDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('CardDefinition.id is required');
  }

  const id = assertCardActionId(wire.id);

  return {
    id,
    name: wire.name,
    cost: wire.cost,
    targeting: wire.targeting,
    ability: parseGameplayAbilityDefinition(wire.ability, manager),
    commitEffects: wire.commitEffects?.map((binding, index) => ({
      target: binding.target,
      effect: parseGameplayEffectDefinition(
        binding.effect,
        manager,
        `commitEffects[${index}].effect`,
      ),
    })),
    settleTakeDamageOnTarget: wire.settleTakeDamageOnTarget,
    applyBlockFromPreview: wire.applyBlockFromPreview,
  };
}

export function buildCardCatalog(
  wires: readonly WireCardDefinition[],
  manager: GameplayTagManager,
): Record<CardActionId, CardDefinition> {
  const catalog = {} as Record<CardActionId, CardDefinition>;

  for (const wire of wires) {
    const def = parseCardDefinition(wire, manager);
    if (catalog[def.id]) {
      throw new DefinitionParseError(`Duplicate card id in catalog: ${def.id}`);
    }
    catalog[def.id] = def;
  }

  return catalog;
}

export function buildCombatCardBootstrap(
  wires: readonly WireCardDefinition[],
  deckIds: readonly string[],
  manager: GameplayTagManager,
): CombatCardBootstrap {
  const cardCatalog = buildCardCatalog(wires, manager);
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
