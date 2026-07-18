import type { AdventureSnapshot, LevelAsset, RoomDirection } from '@cardgame/dungeon';
import { cellKey, findDoorBetween, stepCell } from '@cardgame/dungeon';

const DIRS: RoomDirection[] = ['north', 'south', 'east', 'west'];

/**
 * Wide cell map (ASCII / box-drawing tree style).
 * Monospace glyphs share one column width — a "wider wall char" cannot fix aspect ratio.
 * Instead each floor cell spans several columns so rooms look less vertically skinny.
 *
 * F04 fog (Civ-style): draw `mappedRoomIds`; interior glyphs only for `visionRoomIds`.
 *
 * Example (inner width 3):
 *   +───+─#─+───+
 *   | @ | ~ | X |
 *   +───+───+───+
 */
const INNER_W = 3; // floor characters between vertical bars
const PITCH_X = INNER_W + 1; // shared vertical bar on the left of each cell
const PITCH_Y = 2; // top border row + content row (bottom shared with next)

const H = '─';
const V = '│';
const CORNER = '+';
const DOOR = '#';

function floorGlyph(
  level: LevelAsset,
  snapshot: AdventureSnapshot,
  x: number,
  y: number,
  roomId: string,
): string {
  const isPlayer = snapshot.position.x === x && snapshot.position.y === y;
  if (isPlayer) {
    return '@';
  }

  const vision = new Set(snapshot.visionRoomIds ?? []);
  // Visited / mapped but out of vision: layout only (empty floor).
  if (!vision.has(roomId)) {
    return ' ';
  }

  const room = level.rooms[roomId]!;
  const state = snapshot.roomStates[roomId];
  const cleared = state?.cleared ?? false;
  const hostileRoom = Boolean(room.encounter) && !state?.encounterConsumed && !cleared;

  if (room.kind === 'exit') {
    return 'X';
  }
  if (room.kind === 'safe') {
    return 'S';
  }
  if (hostileRoom) {
    return '~';
  }
  return ' ';
}

/** Center `ch` in a string of length INNER_W. */
function padInner(ch: string): string {
  if (INNER_W <= 1) {
    return ch.slice(0, 1);
  }
  const left = Math.floor((INNER_W - 1) / 2);
  const right = INNER_W - 1 - left;
  return `${' '.repeat(left)}${ch}${' '.repeat(right)}`;
}

/**
 * Render a cell-grid map with wide ASCII/box cells (folder-tree style ─ │ +).
 * Draw `mappedRoomIds`; interior glyphs only when room is in `visionRoomIds`.
 */
export function renderLevelMapLines(level: LevelAsset, snapshot: AdventureSnapshot): string[] {
  const mappedIds =
    snapshot.mappedRoomIds?.length > 0
      ? snapshot.mappedRoomIds
      : [snapshot.currentRoomId];
  const mapped = new Set(mappedIds);
  const rooms = Object.values(level.rooms).filter((room) => mapped.has(room.id));
  if (rooms.length === 0) {
    return [`Room: ${snapshot.currentRoomId}`];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const room of rooms) {
    minX = Math.min(minX, room.rect.x);
    maxX = Math.max(maxX, room.rect.x + room.rect.w - 1);
    minY = Math.min(minY, room.rect.y);
    maxY = Math.max(maxY, room.rect.y + room.rect.h - 1);
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const gw = width * PITCH_X + 1;
  const gh = height * PITCH_Y + 1;
  const grid: string[][] = Array.from({ length: gh }, () => Array.from({ length: gw }, () => ' '));

  const set = (gx: number, gy: number, ch: string) => {
    if (gy >= 0 && gy < gh && gx >= 0 && gx < gw) {
      grid[gy]![gx] = ch;
    }
  };

  const hasFloor = (x: number, y: number): string | undefined => {
    const id = level.occupancy[cellKey({ x, y })];
    if (!id || !mapped.has(id)) {
      return undefined;
    }
    return id;
  };

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const roomId = hasFloor(x, y);
      if (!roomId) {
        continue;
      }
      const lx = x - minX;
      const ly = y - minY;
      const ox = lx * PITCH_X;
      const oy = ly * PITCH_Y;

      set(ox, oy, CORNER);
      set(ox + PITCH_X, oy, CORNER);
      set(ox, oy + PITCH_Y, CORNER);
      set(ox + PITCH_X, oy + PITCH_Y, CORNER);

      for (const edge of ['north', 'south'] as const) {
        const n = stepCell({ x, y }, edge);
        const nRoom = hasFloor(n.x, n.y);
        const door = findDoorBetween(level.doors, { x, y }, n);
        const sameRoom = nRoom === roomId;
        const gy = edge === 'north' ? oy : oy + PITCH_Y;
        for (let i = 1; i <= INNER_W; i += 1) {
          if (sameRoom) {
            set(ox + i, gy, ' ');
          } else if (door && i === Math.ceil(INNER_W / 2)) {
            set(ox + i, gy, DOOR);
          } else {
            set(ox + i, gy, H);
          }
        }
      }

      for (const edge of ['west', 'east'] as const) {
        const n = stepCell({ x, y }, edge);
        const nRoom = hasFloor(n.x, n.y);
        const door = findDoorBetween(level.doors, { x, y }, n);
        const sameRoom = nRoom === roomId;
        const gx = edge === 'west' ? ox : ox + PITCH_X;
        const gy = oy + 1;
        if (sameRoom) {
          set(gx, gy, ' ');
        } else if (door) {
          set(gx, gy, DOOR);
        } else {
          set(gx, gy, V);
        }
      }

      const inner = padInner(floorGlyph(level, snapshot, x, y, roomId));
      for (let i = 0; i < INNER_W; i += 1) {
        set(ox + 1 + i, oy + 1, inner[i] ?? ' ');
      }
    }
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const roomId = hasFloor(x, y);
      if (!roomId) {
        continue;
      }
      for (const dir of DIRS) {
        const n = stepCell({ x, y }, dir);
        if (hasFloor(n.x, n.y) !== roomId) {
          continue;
        }
        const lx = x - minX;
        const ly = y - minY;
        const ox = lx * PITCH_X;
        const oy = ly * PITCH_Y;
        if (dir === 'east') {
          set(ox + PITCH_X, oy + 1, ' ');
        } else if (dir === 'south') {
          for (let i = 1; i <= INNER_W; i += 1) {
            set(ox + i, oy + PITCH_Y, ' ');
          }
        }
      }
    }
  }

  const lines = grid.map((row) => row.join(''));
  lines.push('');
  lines.push(
    `You: ${snapshot.currentRoomId} @${snapshot.position.x},${snapshot.position.y}`,
  );
  lines.push(
    `@ you  ${DOOR} door (${H}${DOOR}${H} / ${DOOR})  ${H}${V} wall  ~ hostile  S safe  X exit`,
  );
  const visionCount = snapshot.visionRoomIds?.length ?? 0;
  const mappedCount = mapped.size;
  lines.push(
    `Map: ${mappedCount} known | Vision: ${visionCount} (door) | ${Object.keys(level.rooms).length} total`,
  );
  if (snapshot.pendingCombat) {
    const encounter = snapshot.currentRoom.encounter?.characterId ?? 'enemy';
    lines.push(`Encounter: ${encounter} — Enter/C to fight (room-wide)`);
  }
  if (snapshot.currentRoom.kind === 'exit' && !snapshot.pendingCombat) {
    lines.push('Exit room — L to leave level');
  }
  return lines;
}
