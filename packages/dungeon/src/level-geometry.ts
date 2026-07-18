import type {
  CellCoord,
  LevelAsset,
  LevelDoor,
  RoomDefinition,
  RoomDirection,
  RoomRect,
} from './types.js';
import { ROOM_DIRECTIONS, oppositeDirection } from './types.js';
import { AdventureError } from './errors.js';

export function cellKey(c: CellCoord): string {
  return `${c.x},${c.y}`;
}

export function stepCell(c: CellCoord, dir: RoomDirection): CellCoord {
  switch (dir) {
    case 'north':
      return { x: c.x, y: c.y - 1 };
    case 'south':
      return { x: c.x, y: c.y + 1 };
    case 'east':
      return { x: c.x + 1, y: c.y };
    case 'west':
      return { x: c.x - 1, y: c.y };
  }
}

export function directionBetween(from: CellCoord, to: CellCoord): RoomDirection | undefined {
  if (to.x === from.x && to.y === from.y - 1) {
    return 'north';
  }
  if (to.x === from.x && to.y === from.y + 1) {
    return 'south';
  }
  if (to.x === from.x + 1 && to.y === from.y) {
    return 'east';
  }
  if (to.x === from.x - 1 && to.y === from.y) {
    return 'west';
  }
  return undefined;
}

export function cellsInRect(rect: RoomRect): CellCoord[] {
  const cells: CellCoord[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

export function resolveRoomRect(room: RoomDefinition): RoomRect {
  if (room.rect) {
    return room.rect;
  }
  if (room.grid) {
    return { x: room.grid.x, y: room.grid.y, w: 1, h: 1 };
  }
  throw new AdventureError(`Room ${room.id} has no rect or grid`);
}

export function buildOccupancy(rooms: Record<string, RoomDefinition>): Record<string, string> {
  const occupancy: Record<string, string> = {};
  for (const room of Object.values(rooms)) {
    const rect = resolveRoomRect(room);
    for (const cell of cellsInRect(rect)) {
      const key = cellKey(cell);
      if (occupancy[key]) {
        throw new AdventureError(
          `Occupancy overlap at ${key}: ${occupancy[key]} and ${room.id}`,
        );
      }
      occupancy[key] = room.id;
    }
  }
  return occupancy;
}

function orderedDoorKey(a: CellCoord, b: CellCoord): string {
  const ka = cellKey(a);
  const kb = cellKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Normalize door endpoints (unordered) and default cost. */
export function canonicalizeDoor(door: LevelDoor): LevelDoor {
  const ka = cellKey(door.a);
  const kb = cellKey(door.b);
  if (ka <= kb) {
    return { a: { ...door.a }, b: { ...door.b }, cost: door.cost };
  }
  return { a: { ...door.b }, b: { ...door.a }, cost: door.cost };
}

export function findDoorBetween(
  doors: readonly LevelDoor[],
  a: CellCoord,
  b: CellCoord,
): LevelDoor | undefined {
  const want = orderedDoorKey(a, b);
  for (const door of doors) {
    if (orderedDoorKey(door.a, door.b) === want) {
      return door;
    }
  }
  return undefined;
}

/**
 * Cost to step from `from` to adjacent `to`.
 * Same room → 0. Door → door.cost. Otherwise undefined (wall / void).
 */
export function stepMovementCost(
  level: LevelAsset,
  from: CellCoord,
  to: CellCoord,
): number | undefined {
  const fromRoom = level.occupancy[cellKey(from)];
  const toRoom = level.occupancy[cellKey(to)];
  if (!fromRoom || !toRoom) {
    return undefined;
  }
  if (fromRoom === toRoom) {
    return 0;
  }
  const door = findDoorBetween(level.doors, from, to);
  if (!door) {
    return undefined;
  }
  return door.cost;
}

/** Shared wall cell-pairs between two rects (4-neighbor adjacencies). */
export function sharedWallPairs(a: RoomRect, b: RoomRect): Array<[CellCoord, CellCoord]> {
  const pairs: Array<[CellCoord, CellCoord]> = [];
  const aCells = cellsInRect(a);
  const bSet = new Set(cellsInRect(b).map(cellKey));
  for (const cell of aCells) {
    for (const dir of ROOM_DIRECTIONS) {
      const n = stepCell(cell, dir);
      if (bSet.has(cellKey(n))) {
        pairs.push([cell, n]);
      }
    }
  }
  return pairs;
}

export function roomsShareWall(a: RoomRect, b: RoomRect): boolean {
  return sharedWallPairs(a, b).length > 0;
}

/** Build legacy room.exits from doors (first door per direction from any cell in room). */
export function deriveLegacyExits(
  roomId: string,
  level: Pick<LevelAsset, 'doors' | 'occupancy'>,
): Partial<Record<RoomDirection, string>> {
  const exits: Partial<Record<RoomDirection, string>> = {};
  for (const door of level.doors) {
    const roomA = level.occupancy[cellKey(door.a)];
    const roomB = level.occupancy[cellKey(door.b)];
    if (!roomA || !roomB) {
      continue;
    }
    if (roomA === roomId) {
      const dir = directionBetween(door.a, door.b);
      if (dir && !exits[dir]) {
        exits[dir] = roomB;
      }
    } else if (roomB === roomId) {
      const dir = directionBetween(door.b, door.a);
      if (dir && !exits[dir]) {
        exits[dir] = roomA;
      }
    }
  }
  return exits;
}

type LegacyRoom = RoomDefinition & {
  grid?: { x: number; y: number };
  exits?: Partial<Record<RoomDirection, string>>;
};

/**
 * Normalize wire/generator output into full spatial LevelAsset.
 * Accepts legacy grid+exits rooms and converts them to rect+doors.
 */
export function normalizeLevelAsset(input: {
  id: string;
  source: LevelAsset['source'];
  startRoomId: string;
  startPosition?: CellCoord;
  rooms: Record<string, LegacyRoom>;
  doors?: LevelDoor[];
}): LevelAsset {
  const rooms: Record<string, RoomDefinition> = {};
  for (const raw of Object.values(input.rooms)) {
    const rect = resolveRoomRect(raw);
    rooms[raw.id] = {
      id: raw.id,
      kind: raw.kind,
      rect,
      encounter: raw.encounter,
    };
  }

  if (!rooms[input.startRoomId]) {
    throw new AdventureError(`Unknown startRoomId: ${input.startRoomId}`);
  }

  const occupancy = buildOccupancy(rooms);
  const doorMap = new Map<string, LevelDoor>();

  const addDoor = (a: CellCoord, b: CellCoord, cost: number) => {
    const door = canonicalizeDoor({ a, b, cost });
    doorMap.set(orderedDoorKey(door.a, door.b), door);
  };

  for (const door of input.doors ?? []) {
    addDoor(door.a, door.b, door.cost);
  }

  // Legacy exits: door between 1×1 (or rect) room centers via direction to neighbor room.
  for (const raw of Object.values(input.rooms)) {
    if (!raw.exits) {
      continue;
    }
    const fromRect = resolveRoomRect(raw);
    for (const dir of ROOM_DIRECTIONS) {
      const targetId = raw.exits[dir];
      if (!targetId) {
        continue;
      }
      const target = rooms[targetId];
      if (!target) {
        throw new AdventureError(`Broken exit ${raw.id} ${dir} → ${targetId}`);
      }
      const toRect = target.rect;
      const pairs = sharedWallPairs(fromRect, toRect);
      if (pairs.length > 0) {
        // Prefer a pair whose step matches `dir` from the from-cell.
        const matching = pairs.find(([a, b]) => directionBetween(a, b) === dir);
        const [a, b] = matching ?? pairs[0]!;
        addDoor(a, b, 1);
        continue;
      }
      // Non-adjacent legacy (should not happen for probe): place door from
      // representative cell stepping in dir if neighbor cell is in target.
      const fromCell = { x: fromRect.x, y: fromRect.y };
      const toCell = stepCell(fromCell, dir);
      if (occupancy[cellKey(toCell)] === targetId) {
        addDoor(fromCell, toCell, 1);
      } else {
        // Fallback: link room origin cells if they happen to be adjacent.
        const targetOrigin = { x: toRect.x, y: toRect.y };
        if (directionBetween(fromCell, targetOrigin)) {
          addDoor(fromCell, targetOrigin, 1);
        } else {
          throw new AdventureError(
            `Cannot place door for legacy exit ${raw.id} ${dir} → ${targetId}`,
          );
        }
      }
    }
  }

  // Ensure doors are reciprocal in occupancy sense (already bidirectional storage).
  for (const door of doorMap.values()) {
    const ra = occupancy[cellKey(door.a)];
    const rb = occupancy[cellKey(door.b)];
    if (!ra || !rb || ra === rb) {
      throw new AdventureError(
        `Invalid door ${cellKey(door.a)}↔${cellKey(door.b)} (rooms ${ra}/${rb})`,
      );
    }
  }

  const startRect = rooms[input.startRoomId]!.rect;
  const startPosition = input.startPosition ?? { x: startRect.x, y: startRect.y };

  if (occupancy[cellKey(startPosition)] !== input.startRoomId) {
    throw new AdventureError(
      `startPosition ${cellKey(startPosition)} is not in start room ${input.startRoomId}`,
    );
  }

  // Attach legacy exits for hosts that still peek at room.exits (optional convenience).
  for (const room of Object.values(rooms)) {
    room.exits = deriveLegacyExits(room.id, { doors: [...doorMap.values()], occupancy });
    room.grid = { x: room.rect.x, y: room.rect.y };
  }

  return {
    id: input.id,
    source: input.source,
    startRoomId: input.startRoomId,
    startPosition,
    rooms,
    doors: [...doorMap.values()].sort((d1, d2) =>
      orderedDoorKey(d1.a, d1.b).localeCompare(orderedDoorKey(d2.a, d2.b)),
    ),
    occupancy,
  };
}

export { oppositeDirection };
