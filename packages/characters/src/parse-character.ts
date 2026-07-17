import { CharacterParseError } from './errors.js';
import type {
  CharacterDefinition,
  CharacterEquipmentSpawn,
  CharacterInventorySpawn,
  CharacterLootEntry,
  PrimaryStats,
} from './types.js';

export type WireCharacterDefinition = {
  id: string;
  name: string;
  maxHealth: number;
  maxActionPoints?: number;
  primaries: PrimaryStats;
  behaviorTreeId: string;
  equipment?: CharacterEquipmentSpawn[];
  inventory?: CharacterInventorySpawn[];
  loot?: { entries?: CharacterLootEntry[] };
  inventoryWidth?: number;
  inventoryHeight?: number;
};

const PRIMARY_KEYS: (keyof PrimaryStats)[] = [
  'strength',
  'constitution',
  'dexterity',
  'intelligence',
  'wisdom',
  'charisma',
];

function parsePrimaries(raw: PrimaryStats, path: string): PrimaryStats {
  const out = {} as PrimaryStats;
  for (const key of PRIMARY_KEYS) {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new CharacterParseError(`${path}.primaries.${key} must be a number`);
    }
    out[key] = value;
  }
  return out;
}

function parseLootEntry(entry: CharacterLootEntry, path: string): CharacterLootEntry {
  if (!entry.itemId) {
    throw new CharacterParseError(`${path}.itemId is required`);
  }
  if (!Number.isInteger(entry.quantityMin) || entry.quantityMin < 0) {
    throw new CharacterParseError(`${path}.quantityMin must be a non-negative integer`);
  }
  if (!Number.isInteger(entry.quantityMax) || entry.quantityMax < entry.quantityMin) {
    throw new CharacterParseError(`${path}.quantityMax must be >= quantityMin`);
  }
  return entry;
}

export function parseCharacterDefinition(wire: WireCharacterDefinition): CharacterDefinition {
  if (!wire.id) {
    throw new CharacterParseError('Character id is required');
  }
  if (!wire.name) {
    throw new CharacterParseError(`Character ${wire.id}: name is required`);
  }
  if (!Number.isInteger(wire.maxHealth) || wire.maxHealth < 1) {
    throw new CharacterParseError(`Character ${wire.id}: maxHealth must be a positive integer`);
  }
  const maxActionPoints = wire.maxActionPoints ?? 3;
  if (!Number.isInteger(maxActionPoints) || maxActionPoints < 0) {
    throw new CharacterParseError(`Character ${wire.id}: maxActionPoints must be a non-negative integer`);
  }
  if (!wire.behaviorTreeId) {
    throw new CharacterParseError(`Character ${wire.id}: behaviorTreeId is required`);
  }
  if (!wire.primaries) {
    throw new CharacterParseError(`Character ${wire.id}: primaries is required`);
  }

  const equipment = (wire.equipment ?? []).map((entry, index) => {
    if (!entry.itemId) {
      throw new CharacterParseError(`Character ${wire.id}: equipment[${index}].itemId is required`);
    }
    return entry;
  });

  const inventory = (wire.inventory ?? []).map((entry, index) => {
    if (!entry.itemId) {
      throw new CharacterParseError(`Character ${wire.id}: inventory[${index}].itemId is required`);
    }
    if (!Number.isInteger(entry.x) || !Number.isInteger(entry.y)) {
      throw new CharacterParseError(`Character ${wire.id}: inventory[${index}] requires integer x,y`);
    }
    const rotation = entry.rotation ?? 0;
    if (rotation !== 0 && rotation !== 90) {
      throw new CharacterParseError(`Character ${wire.id}: inventory[${index}].rotation must be 0 or 90`);
    }
    return { ...entry, rotation };
  });

  const lootEntries = (wire.loot?.entries ?? []).map((entry, index) =>
    parseLootEntry(entry, `Character ${wire.id}: loot.entries[${index}]`),
  );

  if (wire.inventoryWidth !== undefined && (!Number.isInteger(wire.inventoryWidth) || wire.inventoryWidth < 1)) {
    throw new CharacterParseError(`Character ${wire.id}: inventoryWidth must be a positive integer`);
  }
  if (wire.inventoryHeight !== undefined && (!Number.isInteger(wire.inventoryHeight) || wire.inventoryHeight < 1)) {
    throw new CharacterParseError(`Character ${wire.id}: inventoryHeight must be a positive integer`);
  }

  return {
    id: wire.id,
    name: wire.name,
    maxHealth: wire.maxHealth,
    maxActionPoints,
    primaries: parsePrimaries(wire.primaries, `Character ${wire.id}`),
    behaviorTreeId: wire.behaviorTreeId,
    equipment,
    inventory,
    loot: { entries: lootEntries },
    inventoryWidth: wire.inventoryWidth,
    inventoryHeight: wire.inventoryHeight,
  };
}

export function buildCharacterCatalog(wires: readonly WireCharacterDefinition[]): Record<string, CharacterDefinition> {
  const catalog: Record<string, CharacterDefinition> = {};
  for (const wire of wires) {
    const def = parseCharacterDefinition(wire);
    if (catalog[def.id]) {
      throw new CharacterParseError(`Duplicate character id: ${def.id}`);
    }
    catalog[def.id] = def;
  }
  return catalog;
}
