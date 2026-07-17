export type RoomDirection = 'north' | 'south' | 'east' | 'west';

export type RoomKind = 'normal' | 'safe' | 'exit';

export type RoomEncounter = {
  characterId: string;
};

export type RoomDefinition = {
  id: string;
  kind: RoomKind;
  grid?: { x: number; y: number };
  /** Adjacent room ids; movement cost is always 0 in F01. */
  exits: Partial<Record<RoomDirection, string>>;
  encounter?: RoomEncounter;
};

export type LevelSource = 'wire' | 'generator' | 'virtual';

export type LevelAsset = {
  id: string;
  source: LevelSource;
  startRoomId: string;
  rooms: Record<string, RoomDefinition>;
};

export type RoomGroundLootEntry = {
  itemId: string;
  quantity: number;
};

export type RoomRuntimeState = {
  cleared: boolean;
  /** True after combat resolved for this room's encounter (win or skip). */
  encounterConsumed: boolean;
  loot: RoomGroundLootEntry[];
};

export type AdventurePhase = 'explore' | 'combat' | 'victory' | 'defeat';

export type AdventureExploreAction =
  | { type: 'Move'; direction: RoomDirection }
  | { type: 'ConfirmCombat' }
  | { type: 'PickupLoot'; index: number }
  | { type: 'LeaveLevel' };

export type LevelGenProfile = {
  seed: number;
  width: number;
  height: number;
  roomCount: number;
  encounterTable: { characterId: string; weight: number }[];
  /** Fraction of normal (non-start, non-exit) rooms that get an encounter. */
  encounterChance?: number;
  exitRoom?: boolean;
};

export const ROOM_DIRECTIONS: readonly RoomDirection[] = [
  'north',
  'south',
  'east',
  'west',
] as const;

export function oppositeDirection(dir: RoomDirection): RoomDirection {
  switch (dir) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
  }
}
