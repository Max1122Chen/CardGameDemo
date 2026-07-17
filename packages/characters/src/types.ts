import type { EquipmentLoadout, InventoryState, ItemDefinition, ItemId } from '@cardgame/items';

export type PrimaryStats = {
  strength: number;
  constitution: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export type CharacterEquipmentSpawn = {
  itemId: ItemId;
  slot?: string;
};

export type CharacterInventorySpawn = {
  itemId: ItemId;
  quantity?: number;
  x: number;
  y: number;
  rotation?: 0 | 90;
};

export type CharacterLootEntry = {
  itemId: ItemId;
  quantityMin: number;
  quantityMax: number;
};

export type CharacterLootProfile = {
  entries: readonly CharacterLootEntry[];
};

export type CharacterDefinition = {
  id: string;
  name: string;
  maxHealth: number;
  maxActionPoints: number;
  primaries: PrimaryStats;
  behaviorTreeId: string;
  equipment: readonly CharacterEquipmentSpawn[];
  inventory: readonly CharacterInventorySpawn[];
  loot: CharacterLootProfile;
  inventoryWidth?: number;
  inventoryHeight?: number;
};

export type CharacterInstance = {
  definitionId: string;
  displayName: string;
  primaries: PrimaryStats;
  maxHealth: number;
  maxActionPoints: number;
  loadout: EquipmentLoadout;
  inventory: InventoryState;
  deckIds: readonly string[];
  behaviorTreeId: string;
  loot: CharacterLootProfile;
};

export type CharacterCatalog = Record<string, CharacterDefinition>;

export type SpawnContext = {
  itemCatalog: Record<ItemId, ItemDefinition>;
  behaviorTreeIds?: ReadonlySet<string>;
};
