export type RoomDirection = 'north' | 'south' | 'east' | 'west';

export type RoomKind = 'normal' | 'safe' | 'exit';

export type RoomEncounter = {
  characterId: string;
};

export type CellCoord = {
  x: number;
  y: number;
};

/** Axis-aligned room footprint in level cell space. */
export type RoomRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Bidirectional door between adjacent cells of different rooms. */
export type LevelDoor = {
  a: CellCoord;
  b: CellCoord;
  /** Edge cost when crossing (F02 default 1; AP spend in F03). */
  cost: number;
};

export type RoomDefinition = {
  id: string;
  kind: RoomKind;
  /** Occupied rectangle (required after normalize). */
  rect: RoomRect;
  /**
   * Legacy F01 layout hint / derived origin. Prefer `rect`.
   * @deprecated use rect
   */
  grid?: { x: number; y: number };
  /**
   * Legacy F01 per-direction room targets. After normalize, derived from doors
   * for convenience; movement uses cell steps + doors.
   * @deprecated use level.doors
   */
  exits?: Partial<Record<RoomDirection, string>>;
  encounter?: RoomEncounter;
};

export type LevelSource = 'wire' | 'generator' | 'virtual';

export type LevelAsset = {
  id: string;
  source: LevelSource;
  startRoomId: string;
  /** Player spawn cell (must belong to startRoomId). */
  startPosition: CellCoord;
  rooms: Record<string, RoomDefinition>;
  doors: LevelDoor[];
  /** cellKey "x,y" → roomId for floor cells. */
  occupancy: Record<string, string>;
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

/** One floor: explore / combat / left stairs / defeat. */
export type LevelPhase = 'explore' | 'combat' | 'exited' | 'defeat';

/** Whole dungeon run (outer AdventureSession). */
export type AdventurePhase = 'explore' | 'combat' | 'victory' | 'defeat';

export type AdventureExploreAction =
  | { type: 'Move'; direction: RoomDirection }
  | { type: 'ConfirmCombat' }
  | { type: 'PickupLoot'; index: number }
  | { type: 'LeaveLevel' }
  | { type: 'EndRound' };

/** Default floors per generated dungeon run (F05). */
export const DEFAULT_DUNGEON_LEVEL_COUNT = 2;

/** Default explore AP per round (design doc example). */
export const DEFAULT_EXPLORE_MAX_AP = 3;

export type LevelGenProfile = {
  seed: number;
  /** Placement canvas width (cells). */
  width: number;
  /** Placement canvas height (cells). */
  height: number;
  roomCount: number;
  encounterTable: { characterId: string; weight: number }[];
  /** Fraction of normal rooms that get an encounter. */
  encounterChance?: number;
  exitRoom?: boolean;
  /** Extra rooms that may share walls without doors (adjacent ≠ connected). */
  fillerWallRooms?: number;
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

export const DEFAULT_DOOR_COST = 1;
