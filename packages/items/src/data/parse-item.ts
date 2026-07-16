import type { GameplayTagManager } from '@cardgame/core';
import { DefinitionParseError } from '@cardgame/core';

import type { ItemDefinition, ItemId } from '../item-definition.js';
import type {
  ConsumableUseFragment,
  DurabilityFragment,
  EquipmentCardGrant,
  EquipmentFragment,
  InventoryShapeFragment,
  ItemFragment,
  PassiveEffectsFragment,
} from '../fragments.js';

export type WireEquipmentCardGrant = {
  cardId: string;
  count: number;
};

export type WireItemFragment =
  | {
      kind: 'equipment';
      slots: readonly string[];
      twoHandMode?: 'required' | 'optional' | 'forbidden';
      cards: readonly WireEquipmentCardGrant[];
    }
  | { kind: 'durability'; max: number }
  | { kind: 'consumable_use'; effectRef: string }
  | { kind: 'passive_effects'; effectRefs: readonly string[] }
  | { kind: 'inventory_shape'; width: number; height: number };

export type WireItemDefinition = {
  id: string;
  name: string;
  tags: readonly string[];
  maxStack: number;
  sellValue: number;
  fragments?: readonly WireItemFragment[];
};

function parseEquipmentCards(
  itemId: string,
  cards: readonly WireEquipmentCardGrant[],
): readonly EquipmentCardGrant[] {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new DefinitionParseError(`Item ${itemId}: equipment.cards must be non-empty`);
  }

  return cards.map((entry: WireEquipmentCardGrant, index: number) => {
    if (!entry.cardId) {
      throw new DefinitionParseError(`Item ${itemId}: equipment.cards[${index}].cardId is required`);
    }
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      throw new DefinitionParseError(
        `Item ${itemId}: equipment.cards[${index}].count must be a positive integer`,
      );
    }
    return { cardId: entry.cardId, count: entry.count };
  });
}

function parseFragment(itemId: string, wire: WireItemFragment): ItemFragment {
  switch (wire.kind) {
    case 'equipment': {
      if (!Array.isArray(wire.slots) || wire.slots.length === 0) {
        throw new DefinitionParseError(`Item ${itemId}: equipment.slots must be non-empty`);
      }
      const twoHandMode = wire.twoHandMode ?? 'optional';
      if (twoHandMode !== 'required' && twoHandMode !== 'optional' && twoHandMode !== 'forbidden') {
        throw new DefinitionParseError(`Item ${itemId}: unknown equipment.twoHandMode "${String(twoHandMode)}"`);
      }
      return {
        kind: 'equipment',
        slots: wire.slots,
        twoHandMode,
        cards: parseEquipmentCards(itemId, wire.cards),
      } satisfies EquipmentFragment;
    }
    case 'durability': {
      if (!Number.isInteger(wire.max) || wire.max < 1) {
        throw new DefinitionParseError(`Item ${itemId}: durability.max must be a positive integer`);
      }
      return { kind: 'durability', max: wire.max } satisfies DurabilityFragment;
    }
    case 'consumable_use': {
      if (!wire.effectRef) {
        throw new DefinitionParseError(`Item ${itemId}: consumable_use.effectRef is required`);
      }
      return { kind: 'consumable_use', effectRef: wire.effectRef } satisfies ConsumableUseFragment;
    }
    case 'passive_effects': {
      if (!Array.isArray(wire.effectRefs) || wire.effectRefs.length === 0) {
        throw new DefinitionParseError(`Item ${itemId}: passive_effects.effectRefs must be non-empty`);
      }
      return { kind: 'passive_effects', effectRefs: wire.effectRefs } satisfies PassiveEffectsFragment;
    }
    case 'inventory_shape': {
      if (!Number.isInteger(wire.width) || wire.width < 1) {
        throw new DefinitionParseError(`Item ${itemId}: inventory_shape.width must be a positive integer`);
      }
      if (!Number.isInteger(wire.height) || wire.height < 1) {
        throw new DefinitionParseError(`Item ${itemId}: inventory_shape.height must be a positive integer`);
      }
      return {
        kind: 'inventory_shape',
        width: wire.width,
        height: wire.height,
      } satisfies InventoryShapeFragment;
    }
    default:
      throw new DefinitionParseError(
        `Item ${itemId}: unknown fragment kind "${String((wire as { kind?: string }).kind)}"`,
      );
  }
}

export function parseItemDefinition(
  wire: WireItemDefinition,
  manager: GameplayTagManager,
): ItemDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('ItemDefinition.id is required');
  }
  if (!wire.name) {
    throw new DefinitionParseError(`Item ${wire.id}: name is required`);
  }
  if (!Number.isInteger(wire.maxStack) || wire.maxStack < 1) {
    throw new DefinitionParseError(`Item ${wire.id}: maxStack must be a positive integer`);
  }
  if (!Number.isFinite(wire.sellValue) || wire.sellValue < 0) {
    throw new DefinitionParseError(`Item ${wire.id}: sellValue must be >= 0`);
  }
  if (!Array.isArray(wire.tags) || wire.tags.length === 0) {
    throw new DefinitionParseError(`Item ${wire.id}: tags must be non-empty`);
  }

  const tags = wire.tags.map((tagName: string) => manager.resolve(tagName));
  const fragments = (wire.fragments ?? []).map((fragment) => parseFragment(wire.id, fragment));

  return {
    id: wire.id,
    name: wire.name,
    tags,
    maxStack: wire.maxStack,
    sellValue: wire.sellValue,
    fragments,
  };
}

export function buildItemCatalog(
  wires: readonly WireItemDefinition[],
  manager: GameplayTagManager,
): Record<ItemId, ItemDefinition> {
  const catalog: Record<ItemId, ItemDefinition> = {};

  for (const wire of wires) {
    const def = parseItemDefinition(wire, manager);
    if (catalog[def.id]) {
      throw new DefinitionParseError(`Duplicate item id in catalog: ${def.id}`);
    }
    catalog[def.id] = def;
  }

  return catalog;
}

export function collectItemTagNames(wires: readonly WireItemDefinition[]): string[] {
  const names = new Set<string>();
  for (const wire of wires) {
    for (const tag of wire.tags) {
      names.add(tag);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}
