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

export type ItemFragment =
  | EquipmentFragment
  | DurabilityFragment
  | ConsumableUseFragment
  | PassiveEffectsFragment;

export type ItemInstanceState = {
  durability?: { current: number };
};

export function getEquipmentFragment(fragments: readonly ItemFragment[]): EquipmentFragment | undefined {
  return fragments.find((fragment): fragment is EquipmentFragment => fragment.kind === 'equipment');
}

export function getDurabilityFragment(fragments: readonly ItemFragment[]): DurabilityFragment | undefined {
  return fragments.find((fragment): fragment is DurabilityFragment => fragment.kind === 'durability');
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
