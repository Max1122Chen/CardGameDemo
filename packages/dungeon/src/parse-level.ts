import { LevelParseError } from './errors.js';
import { normalizeLevelAsset } from './level-geometry.js';
import type {
  CellCoord,
  LevelAsset,
  LevelDoor,
  LevelSource,
  RoomDefinition,
  RoomDirection,
  RoomEncounter,
  RoomKind,
  RoomRect,
} from './types.js';
import { DEFAULT_DOOR_COST, ROOM_DIRECTIONS } from './types.js';

export type WireRoomDefinition = {
  id: string;
  kind?: string;
  grid?: { x: number; y: number };
  rect?: { x?: number; y?: number; w?: number; h?: number };
  exits?: Record<string, string>;
  encounter?: { characterId?: string };
};

export type WireDoorDefinition = {
  a: { x?: number; y?: number };
  b: { x?: number; y?: number };
  cost?: number;
};

export type WireLevelDefinition = {
  id: string;
  source?: string;
  startRoomId: string;
  startPosition?: { x?: number; y?: number };
  rooms: WireRoomDefinition[];
  doors?: WireDoorDefinition[];
};

function parseRoomKind(raw: string | undefined, roomId: string): RoomKind {
  if (raw === undefined || raw === 'normal') {
    return 'normal';
  }
  if (raw === 'safe' || raw === 'exit') {
    return raw;
  }
  throw new LevelParseError(`Room ${roomId}: invalid kind "${raw}"`);
}

function parseExits(
  roomId: string,
  raw: Record<string, string> | undefined,
): Partial<Record<RoomDirection, string>> {
  if (!raw) {
    return {};
  }
  const exits: Partial<Record<RoomDirection, string>> = {};
  for (const [key, target] of Object.entries(raw)) {
    if (!(ROOM_DIRECTIONS as readonly string[]).includes(key)) {
      throw new LevelParseError(`Room ${roomId}: invalid exit direction "${key}"`);
    }
    if (typeof target !== 'string' || !target) {
      throw new LevelParseError(`Room ${roomId}: exit ${key} requires target room id`);
    }
    exits[key as RoomDirection] = target;
  }
  return exits;
}

function parseEncounter(
  roomId: string,
  raw: { characterId?: string } | undefined,
): RoomEncounter | undefined {
  if (!raw) {
    return undefined;
  }
  if (typeof raw.characterId !== 'string' || !raw.characterId) {
    throw new LevelParseError(`Room ${roomId}: encounter.characterId is required`);
  }
  return { characterId: raw.characterId };
}

function parseRect(roomId: string, wire: WireRoomDefinition): RoomRect | undefined {
  if (wire.rect) {
    const { x, y, w, h } = wire.rect;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof w !== 'number' ||
      typeof h !== 'number' ||
      w < 1 ||
      h < 1
    ) {
      throw new LevelParseError(`Room ${roomId}: rect requires numeric x,y,w,h with w,h >= 1`);
    }
    return { x, y, w, h };
  }
  if (wire.grid) {
    if (typeof wire.grid.x !== 'number' || typeof wire.grid.y !== 'number') {
      throw new LevelParseError(`Room ${roomId}: grid.x and grid.y must be numbers`);
    }
    return { x: wire.grid.x, y: wire.grid.y, w: 1, h: 1 };
  }
  return undefined;
}

function parseRoom(wire: WireRoomDefinition): RoomDefinition {
  if (!wire.id) {
    throw new LevelParseError('Room id is required');
  }
  const rect = parseRect(wire.id, wire);
  if (!rect) {
    throw new LevelParseError(`Room ${wire.id}: rect or grid is required`);
  }
  const room: RoomDefinition = {
    id: wire.id,
    kind: parseRoomKind(wire.kind, wire.id),
    rect,
    exits: parseExits(wire.id, wire.exits),
  };
  room.grid = { x: rect.x, y: rect.y };
  const encounter = parseEncounter(wire.id, wire.encounter);
  if (encounter) {
    room.encounter = encounter;
  }
  return room;
}

function parseSource(raw: string | undefined): LevelSource {
  if (raw === undefined || raw === 'wire') {
    return 'wire';
  }
  if (raw === 'generator' || raw === 'virtual') {
    return raw;
  }
  throw new LevelParseError(`Invalid level source "${raw}"`);
}

function parseDoor(index: number, wire: WireDoorDefinition): LevelDoor {
  if (
    typeof wire.a?.x !== 'number' ||
    typeof wire.a?.y !== 'number' ||
    typeof wire.b?.x !== 'number' ||
    typeof wire.b?.y !== 'number'
  ) {
    throw new LevelParseError(`doors[${index}]: a and b require numeric x,y`);
  }
  const cost = wire.cost === undefined ? DEFAULT_DOOR_COST : wire.cost;
  if (typeof cost !== 'number' || cost < 0) {
    throw new LevelParseError(`doors[${index}]: cost must be a non-negative number`);
  }
  return {
    a: { x: wire.a.x, y: wire.a.y },
    b: { x: wire.b.x, y: wire.b.y },
    cost,
  };
}

function parseStartPosition(raw: { x?: number; y?: number } | undefined): CellCoord | undefined {
  if (!raw) {
    return undefined;
  }
  if (typeof raw.x !== 'number' || typeof raw.y !== 'number') {
    throw new LevelParseError('startPosition.x and startPosition.y must be numbers');
  }
  return { x: raw.x, y: raw.y };
}

/** Build LevelAsset from wire JSON; validates and normalizes to spatial model. */
export function parseLevelDefinition(wire: WireLevelDefinition): LevelAsset {
  if (!wire.id) {
    throw new LevelParseError('Level id is required');
  }
  if (!wire.startRoomId) {
    throw new LevelParseError(`Level ${wire.id}: startRoomId is required`);
  }
  if (!Array.isArray(wire.rooms) || wire.rooms.length === 0) {
    throw new LevelParseError(`Level ${wire.id}: rooms must be a non-empty array`);
  }

  const rooms: Record<string, RoomDefinition> = {};
  for (const roomWire of wire.rooms) {
    const room = parseRoom(roomWire);
    if (rooms[room.id]) {
      throw new LevelParseError(`Level ${wire.id}: duplicate room id "${room.id}"`);
    }
    rooms[room.id] = room;
  }

  if (!rooms[wire.startRoomId]) {
    throw new LevelParseError(
      `Level ${wire.id}: startRoomId "${wire.startRoomId}" not found in rooms`,
    );
  }

  for (const room of Object.values(rooms)) {
    for (const [dir, targetId] of Object.entries(room.exits ?? {})) {
      if (!targetId || !rooms[targetId]) {
        throw new LevelParseError(
          `Level ${wire.id}: room "${room.id}" exit ${dir} → unknown room "${targetId}"`,
        );
      }
    }
  }

  const doors = (wire.doors ?? []).map((d, i) => parseDoor(i, d));

  try {
    return normalizeLevelAsset({
      id: wire.id,
      source: parseSource(wire.source),
      startRoomId: wire.startRoomId,
      startPosition: parseStartPosition(wire.startPosition),
      rooms,
      doors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LevelParseError(`Level ${wire.id}: ${message}`);
  }
}
