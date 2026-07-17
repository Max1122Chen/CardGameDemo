import { LevelParseError } from './errors.js';
import type {
  LevelAsset,
  LevelSource,
  RoomDefinition,
  RoomDirection,
  RoomEncounter,
  RoomKind,
} from './types.js';
import { ROOM_DIRECTIONS } from './types.js';

export type WireRoomDefinition = {
  id: string;
  kind?: string;
  grid?: { x: number; y: number };
  exits?: Record<string, string>;
  encounter?: { characterId?: string };
};

export type WireLevelDefinition = {
  id: string;
  source?: string;
  startRoomId: string;
  rooms: WireRoomDefinition[];
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

function parseRoom(wire: WireRoomDefinition): RoomDefinition {
  if (!wire.id) {
    throw new LevelParseError('Room id is required');
  }
  const room: RoomDefinition = {
    id: wire.id,
    kind: parseRoomKind(wire.kind, wire.id),
    exits: parseExits(wire.id, wire.exits),
  };
  if (wire.grid) {
    if (typeof wire.grid.x !== 'number' || typeof wire.grid.y !== 'number') {
      throw new LevelParseError(`Room ${wire.id}: grid.x and grid.y must be numbers`);
    }
    room.grid = { x: wire.grid.x, y: wire.grid.y };
  }
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

/** Build LevelAsset from wire JSON; validates start room and exit targets. */
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
    for (const [dir, targetId] of Object.entries(room.exits)) {
      if (!targetId || !rooms[targetId]) {
        throw new LevelParseError(
          `Level ${wire.id}: room "${room.id}" exit ${dir} → unknown room "${targetId}"`,
        );
      }
    }
  }

  return {
    id: wire.id,
    source: parseSource(wire.source),
    startRoomId: wire.startRoomId,
    rooms,
  };
}
