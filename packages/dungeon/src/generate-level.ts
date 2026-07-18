import type {
  LevelAsset,
  LevelDoor,
  LevelGenProfile,
  RoomDefinition,
  RoomDirection,
  RoomRect,
} from './types.js';
import { DEFAULT_DOOR_COST, ROOM_DIRECTIONS } from './types.js';
import {
  buildOccupancy,
  cellKey,
  cellsInRect,
  normalizeLevelAsset,
  roomsShareWall,
  sharedWallPairs,
} from './level-geometry.js';

/** Mulberry32 — small deterministic PRNG for level generation. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(
  table: { characterId: string; weight: number }[],
  rng: () => number,
): string | undefined {
  if (table.length === 0) {
    return undefined;
  }
  const total = table.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  if (total <= 0) {
    return table[0]?.characterId;
  }
  let roll = rng() * total;
  for (const row of table) {
    roll -= Math.max(0, row.weight);
    if (roll <= 0) {
      return row.characterId;
    }
  }
  return table[table.length - 1]?.characterId;
}

function pickRoomSize(rng: () => number): { w: number; h: number } {
  const roll = rng();
  if (roll < 0.55) {
    return { w: 1, h: 1 };
  }
  if (roll < 0.75) {
    return rng() < 0.5 ? { w: 2, h: 1 } : { w: 1, h: 2 };
  }
  if (roll < 0.9) {
    return rng() < 0.5 ? { w: 3, h: 1 } : { w: 1, h: 3 };
  }
  return { w: 2, h: 2 };
}

function rectInBounds(rect: RoomRect, width: number, height: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= width && rect.y + rect.h <= height;
}

function occupancyHasOverlap(
  occupancy: Map<string, string>,
  rect: RoomRect,
): boolean {
  for (const cell of cellsInRect(rect)) {
    if (occupancy.has(cellKey(cell))) {
      return true;
    }
  }
  return false;
}

function stampOccupancy(occupancy: Map<string, string>, rect: RoomRect, roomId: string): void {
  for (const cell of cellsInRect(rect)) {
    occupancy.set(cellKey(cell), roomId);
  }
}

/** Place `size` so it shares a wall with `anchor` on `dir` side of anchor. */
function placeAdjacentRect(
  anchor: RoomRect,
  dir: RoomDirection,
  size: { w: number; h: number },
  rng: () => number,
): RoomRect {
  let x = anchor.x;
  let y = anchor.y;
  switch (dir) {
    case 'east':
      x = anchor.x + anchor.w;
      y = anchor.y + Math.floor(rng() * Math.max(1, anchor.h - size.h + 1));
      break;
    case 'west':
      x = anchor.x - size.w;
      y = anchor.y + Math.floor(rng() * Math.max(1, anchor.h - size.h + 1));
      break;
    case 'south':
      y = anchor.y + anchor.h;
      x = anchor.x + Math.floor(rng() * Math.max(1, anchor.w - size.w + 1));
      break;
    case 'north':
      y = anchor.y - size.h;
      x = anchor.x + Math.floor(rng() * Math.max(1, anchor.w - size.w + 1));
      break;
  }
  return { x, y, w: size.w, h: size.h };
}

function doorGraphDistance(
  startId: string,
  rooms: Record<string, RoomDefinition>,
  doors: LevelDoor[],
  occupancy: Record<string, string>,
): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  for (const id of Object.keys(rooms)) {
    adj.set(id, new Set());
  }
  for (const door of doors) {
    const ra = occupancy[cellKey(door.a)];
    const rb = occupancy[cellKey(door.b)];
    if (ra && rb) {
      adj.get(ra)!.add(rb);
      adj.get(rb)!.add(ra);
    }
  }
  const dist = new Map<string, number>();
  const queue = [startId];
  dist.set(startId, 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = dist.get(id)!;
    for (const n of adj.get(id) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

/**
 * F02 spatial generator: rectangular rooms, selective doors, seed-stable.
 * Same seed → same LevelAsset.
 */
export function generateLevel(profile: LevelGenProfile): LevelAsset {
  const width = Math.max(3, profile.width);
  const height = Math.max(3, profile.height);
  const roomCount = Math.max(1, profile.roomCount);
  const rng = createSeededRng(profile.seed);
  const wantExit = profile.exitRoom !== false;
  const encounterChance = profile.encounterChance ?? 0.45;
  const fillerCount = profile.fillerWallRooms ?? 1;

  const occupancy = new Map<string, string>();
  const placed: { id: string; rect: RoomRect }[] = [];
  const doors: LevelDoor[] = [];

  const startRect: RoomRect = { x: Math.floor(width / 2), y: Math.floor(height / 2), w: 1, h: 1 };
  const startId = 'r0';
  placed.push({ id: startId, rect: startRect });
  stampOccupancy(occupancy, startRect, startId);

  let attempts = 0;
  const maxAttempts = roomCount * 80;
  while (placed.length < roomCount && attempts < maxAttempts) {
    attempts += 1;
    const anchor = placed[Math.floor(rng() * placed.length)]!;
    const dir = ROOM_DIRECTIONS[Math.floor(rng() * ROOM_DIRECTIONS.length)]!;
    const size = pickRoomSize(rng);
    const rect = placeAdjacentRect(anchor.rect, dir, size, rng);
    if (!rectInBounds(rect, width, height) || occupancyHasOverlap(occupancy, rect)) {
      continue;
    }
    if (!roomsShareWall(anchor.rect, rect)) {
      continue;
    }
    const pairs = sharedWallPairs(anchor.rect, rect);
    if (pairs.length === 0) {
      continue;
    }
    const id = `r${placed.length}`;
    placed.push({ id, rect });
    stampOccupancy(occupancy, rect, id);
    const [a, b] = pairs[Math.floor(rng() * pairs.length)]!;
    doors.push({ a: { ...a }, b: { ...b }, cost: DEFAULT_DOOR_COST });
  }

  // Filler rooms: share a wall but intentionally no door (adjacent ≠ connected).
  let fillers = 0;
  attempts = 0;
  while (fillers < fillerCount && attempts < maxAttempts) {
    attempts += 1;
    const anchor = placed[Math.floor(rng() * placed.length)]!;
    const dir = ROOM_DIRECTIONS[Math.floor(rng() * ROOM_DIRECTIONS.length)]!;
    const size = pickRoomSize(rng);
    const rect = placeAdjacentRect(anchor.rect, dir, size, rng);
    if (!rectInBounds(rect, width, height) || occupancyHasOverlap(occupancy, rect)) {
      continue;
    }
    if (!roomsShareWall(anchor.rect, rect)) {
      continue;
    }
    // Must also touch some other room or the same anchor — wall without door is enough.
    const id = `r${placed.length}`;
    placed.push({ id, rect });
    stampOccupancy(occupancy, rect, id);
    fillers += 1;
  }

  const rooms: Record<string, RoomDefinition> = {};
  for (const entry of placed) {
    rooms[entry.id] = {
      id: entry.id,
      kind: 'normal',
      rect: entry.rect,
    };
  }
  rooms[startId]!.kind = 'safe';

  const occRecord = Object.fromEntries(occupancy.entries());
  if (wantExit && placed.length > 1) {
    const dist = doorGraphDistance(startId, rooms, doors, occRecord);
    let bestId = startId;
    let best = -1;
    for (const [id, d] of dist) {
      if (d > best) {
        best = d;
        bestId = id;
      }
    }
    if (bestId !== startId) {
      rooms[bestId]!.kind = 'exit';
    }
  }

  for (const room of Object.values(rooms)) {
    if (room.kind !== 'normal') {
      continue;
    }
    if (rng() > encounterChance) {
      continue;
    }
    const characterId = pickWeighted(profile.encounterTable, rng);
    if (characterId) {
      room.encounter = { characterId };
    }
  }

  return normalizeLevelAsset({
    id: `level.gen.${profile.seed}`,
    source: 'generator',
    startRoomId: startId,
    startPosition: { x: startRect.x, y: startRect.y },
    rooms,
    doors,
  });
}

/** Single-room virtual level for BattleOnly (encounter → confirm → combat). */
export function createVirtualBattleLevel(characterId: string): LevelAsset {
  return normalizeLevelAsset({
    id: `level.battle_only.${characterId}`,
    source: 'virtual',
    startRoomId: 'arena',
    startPosition: { x: 0, y: 0 },
    rooms: {
      arena: {
        id: 'arena',
        kind: 'normal',
        rect: { x: 0, y: 0, w: 1, h: 1 },
        encounter: { characterId },
      },
    },
    doors: [],
  });
}

/** Default profile for CLI `dungeon` mode (seeded). */
export function defaultDungeonGenProfile(seed: number): LevelGenProfile {
  return {
    seed,
    width: 12,
    height: 10,
    roomCount: 10,
    fillerWallRooms: 2,
    encounterTable: [
      { characterId: 'slime', weight: 2 },
      { characterId: 'orc_brute', weight: 1 },
    ],
    encounterChance: 0.5,
    exitRoom: true,
  };
}

export function generateDefaultDungeonLevel(seed: number): LevelAsset {
  return generateLevel(defaultDungeonGenProfile(seed));
}

/** Expose occupancy builder for tests. */
export { buildOccupancy, cellKey };
