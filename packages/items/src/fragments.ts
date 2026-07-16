export type EquipmentCardGrant = {
  cardId: string;
  count: number;
};

export type EquipmentFragment = {
  kind: 'equipment';
  slots: readonly string[];
  twoHandMode: 'required' | 'optional' | 'forbidden';
  cards: readonly EquipmentCardGrant[];
};

export type DurabilityFragment = {
  kind: 'durability';
  max: number;
};

export type ConsumableUseFragment = {
  kind: 'consumable_use';
  effectRef: string;
};

export type PassiveEffectsFragment = {
  kind: 'passive_effects';
  effectRefs: readonly string[];
};

export type InventoryShapeFragment = {
  kind: 'inventory_shape';
  width: number;
  height: number;
};

export type ItemFragment =
  | EquipmentFragment
  | DurabilityFragment
  | ConsumableUseFragment
  | PassiveEffectsFragment
  | InventoryShapeFragment;

export type ItemInstanceState = {
  durability?: { current: number };
};

export type ItemFootprint = {
  width: number;
  height: number;
};

export function getEquipmentFragment(fragments: readonly ItemFragment[]): EquipmentFragment | undefined {
  return fragments.find((fragment): fragment is EquipmentFragment => fragment.kind === 'equipment');
}

export function getDurabilityFragment(fragments: readonly ItemFragment[]): DurabilityFragment | undefined {
  return fragments.find((fragment): fragment is DurabilityFragment => fragment.kind === 'durability');
}

export function getInventoryShapeFragment(
  fragments: readonly ItemFragment[],
): InventoryShapeFragment | undefined {
  return fragments.find((fragment): fragment is InventoryShapeFragment => fragment.kind === 'inventory_shape');
}

export function getItemFootprint(fragments: readonly ItemFragment[]): ItemFootprint {
  const shape = getInventoryShapeFragment(fragments);
  return shape ? { width: shape.width, height: shape.height } : { width: 1, height: 1 };
}

export function requiresItemInstance(fragments: readonly ItemFragment[], maxStack: number): boolean {
  return maxStack === 1 || getDurabilityFragment(fragments) !== undefined;
}

export function createInitialInstanceState(fragments: readonly ItemFragment[]): ItemInstanceState | undefined {
  const durability = getDurabilityFragment(fragments);
  if (!durability) {
    return undefined;
  }
  return { durability: { current: durability.max } };
}
