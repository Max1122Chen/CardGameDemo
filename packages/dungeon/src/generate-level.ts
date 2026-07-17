import type { LevelAsset, LevelGenProfile, RoomDefinition, RoomDirection } from './types.js';
import { oppositeDirection } from './types.js';

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

type Cell = { x: number; y: number };

function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

function neighbors4(c: Cell, width: number, height: number): Cell[] {
  const out: Cell[] = [];
  if (c.y > 0) {
    out.push({ x: c.x, y: c.y - 1 });
  }
  if (c.y < height - 1) {
    out.push({ x: c.x, y: c.y + 1 });
  }
  if (c.x > 0) {
    out.push({ x: c.x - 1, y: c.y });
  }
  if (c.x < width - 1) {
    out.push({ x: c.x + 1, y: c.y });
  }
  return out;
}

function directionBetween(from: Cell, to: Cell): RoomDirection | undefined {
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

/**
 * F01 generator: place rooms via random walk on a grid, link adjacent placed cells,
 * assign start/exit and optional weighted encounters. Same seed → same LevelAsset.
 */
export function generateLevel(profile: LevelGenProfile): LevelAsset {
  const width = Math.max(1, profile.width);
  const height = Math.max(1, profile.height);
  const maxCells = width * height;
  const roomCount = Math.min(Math.max(1, profile.roomCount), maxCells);
  const rng = createSeededRng(profile.seed);
  const wantExit = profile.exitRoom !== false;
  const encounterChance = profile.encounterChance ?? 0.4;

  const start: Cell = {
    x: Math.floor(rng() * width),
    y: Math.floor(rng() * height),
  };
  const placed = new Map<string, Cell>();
  placed.set(cellKey(start), start);

  let cursor = start;
  while (placed.size < roomCount) {
    const options = neighbors4(cursor, width, height);
    const next = options[Math.floor(rng() * options.length)]!;
    placed.set(cellKey(next), next);
    cursor = next;
  }

  const cells = [...placed.values()];
  const idForCell = new Map<string, string>();
  cells.forEach((cell, index) => {
    idForCell.set(cellKey(cell), `r${index}`);
  });

  const rooms: Record<string, RoomDefinition> = {};
  for (const cell of cells) {
    const id = idForCell.get(cellKey(cell))!;
    const exits: RoomDefinition['exits'] = {};
    for (const n of neighbors4(cell, width, height)) {
      const neighborId = idForCell.get(cellKey(n));
      if (!neighborId) {
        continue;
      }
      const dir = directionBetween(cell, n);
      if (dir) {
        exits[dir] = neighborId;
      }
    }
    rooms[id] = {
      id,
      kind: 'normal',
      grid: { x: cell.x, y: cell.y },
      exits,
    };
  }

  const startRoomId = idForCell.get(cellKey(start))!;
  rooms[startRoomId]!.kind = 'safe';

  if (wantExit && cells.length > 1) {
    let farthest = start;
    let best = -1;
    for (const cell of cells) {
      const d = Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y);
      if (d > best) {
        best = d;
        farthest = cell;
      }
    }
    const exitId = idForCell.get(cellKey(farthest))!;
    if (exitId !== startRoomId) {
      rooms[exitId]!.kind = 'exit';
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

  // Ensure exits are reciprocal when both rooms exist (walk already places both sides).
  for (const room of Object.values(rooms)) {
    for (const dir of Object.keys(room.exits) as RoomDirection[]) {
      const targetId = room.exits[dir];
      if (!targetId) {
        continue;
      }
      const target = rooms[targetId];
      if (!target) {
        continue;
      }
      const back = oppositeDirection(dir);
      if (!target.exits[back]) {
        target.exits[back] = room.id;
      }
    }
  }

  return {
    id: `level.gen.${profile.seed}`,
    source: 'generator',
    startRoomId,
    rooms,
  };
}

/** Single-room virtual level for BattleOnly (encounter → confirm → combat). */
export function createVirtualBattleLevel(characterId: string): LevelAsset {
  return {
    id: `level.battle_only.${characterId}`,
    source: 'virtual',
    startRoomId: 'arena',
    rooms: {
      arena: {
        id: 'arena',
        kind: 'normal',
        grid: { x: 0, y: 0 },
        exits: {},
        encounter: { characterId },
      },
    },
  };
}
