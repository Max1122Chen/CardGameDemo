import type { AdventureSnapshot, LevelAsset } from '@cardgame/dungeon';

export function renderLevelMapLines(level: LevelAsset, snapshot: AdventureSnapshot): string[] {
  const rooms = Object.values(level.rooms);
  const withGrid = rooms.filter((room) => room.grid !== undefined);
  if (withGrid.length === 0) {
    return [
      `Room: ${snapshot.currentRoomId}`,
      snapshot.pendingCombat ? 'Enemy present — confirm to fight (Enter/C)' : '',
    ].filter((line) => line.length > 0);
  }

  const minX = Math.min(...withGrid.map((room) => room.grid!.x));
  const maxX = Math.max(...withGrid.map((room) => room.grid!.x));
  const minY = Math.min(...withGrid.map((room) => room.grid!.y));
  const maxY = Math.max(...withGrid.map((room) => room.grid!.y));

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => '   '),
  );

  for (const room of withGrid) {
    const gx = room.grid!.x - minX;
    const gy = room.grid!.y - minY;
    const state = snapshot.roomStates[room.id];
    const current = room.id === snapshot.currentRoomId;
    const cleared = state?.cleared ?? false;
    const hasEncounter = Boolean(room.encounter) && !state?.encounterConsumed;

    let glyph = room.kind === 'exit' ? 'X' : room.kind === 'safe' ? 'S' : 'R';
    if (hasEncounter && !cleared) {
      glyph = '!';
    }
    if (current) {
      glyph = `*${glyph}`;
    } else if (cleared) {
      glyph = glyph.toLowerCase();
    }

    grid[gy]![gx] = glyph.padEnd(3, ' ');
  }

  const lines = grid.map((row) => row.join(''));
  lines.push('');
  lines.push(`You: ${snapshot.currentRoomId}`);
  if (snapshot.pendingCombat) {
    const encounter = snapshot.currentRoom.encounter?.characterId ?? 'enemy';
    lines.push(`Encounter: ${encounter} — Enter/C to fight`);
  }
  if (snapshot.currentRoom.kind === 'exit' && !snapshot.pendingCombat) {
    lines.push('Exit room — Enter to leave level');
  }
  return lines;
}
