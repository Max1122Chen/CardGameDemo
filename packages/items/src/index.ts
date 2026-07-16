export type { ItemDefinition, ItemId } from './item-definition.js';
export {
  type EquipmentCardGrant,
  type EquipmentFragment,
  type DurabilityFragment,
  type ConsumableUseFragment,
  type PassiveEffectsFragment,
  type ItemFragment,
  type ItemInstanceState,
  getEquipmentFragment,
  getDurabilityFragment,
  requiresItemInstance,
  createInitialInstanceState,
} from './fragments.js';
export {
  parseItemDefinition,
  buildItemCatalog,
  collectItemTagNames,
  type WireItemDefinition,
  type WireItemFragment,
} from './data/parse-item.js';
export {
  resolveRepoDataRoot,
  loadItemWiresFromDir,
  loadItemCatalogFromRepo,
  collectItemTagsFromRepo,
  loadBattleRewards,
  type BattleRewardEntry,
  type BattleRewardsTable,
} from './data/item-bootstrap.js';
export {
  DEFAULT_INVENTORY_CAPACITY,
  createInventory,
  canAddToInventory,
  computeAddableQuantity,
  addToInventory,
  discardInventorySlot,
  listInventorySlots,
  resetItemInstanceCounter,
  type InventoryState,
  type InventoryEntry,
  type InventoryStackEntry,
  type InventoryInstanceEntry,
  type InventoryAddResult,
  type InventorySlotView,
} from './inventory.js';
export {
  createPendingLootFromTable,
  hasPendingLoot,
  listPendingLoot,
  pickupLootEntry,
  pickupAllLoot,
  validateBattleRewards,
  type PendingLootState,
  type PendingLootEntry,
  type LootEntryView,
  type PickupLootResult,
} from './loot.js';
