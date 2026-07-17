import { AdventureError } from './errors.js';
import type {
  AdventureExploreAction,
  AdventurePhase,
  LevelAsset,
  RoomDefinition,
  RoomDirection,
  RoomGroundLootEntry,
  RoomRuntimeState,
} from './types.js';
import { ROOM_DIRECTIONS } from './types.js';

export type AdventureSnapshot = {
  phase: AdventurePhase;
  levelId: string;
  currentRoomId: string;
  pendingCombat: boolean;
  currentRoom: RoomDefinition;
  roomStates: Record<string, RoomRuntimeState>;
  legalActions: AdventureExploreAction[];
  log: readonly string[];
};

function emptyRoomState(): RoomRuntimeState {
  return {
    cleared: false,
    encounterConsumed: false,
    loot: [],
  };
}

function initRoomStates(level: LevelAsset): Record<string, RoomRuntimeState> {
  const states: Record<string, RoomRuntimeState> = {};
  for (const id of Object.keys(level.rooms)) {
    states[id] = emptyRoomState();
  }
  return states;
}

/**
 * Explore-phase session: move, confirm-combat pause, room loot.
 * Combat attach/detach is owned by the host (S04); this class only tracks phase + pending.
 */
export class AdventureSession {
  private phase: AdventurePhase = 'explore';
  private currentRoomId: string;
  private readonly roomStates: Record<string, RoomRuntimeState>;
  private pendingCombat = false;
  private readonly log: string[] = [];

  private constructor(private readonly level: LevelAsset) {
    this.currentRoomId = level.startRoomId;
    this.roomStates = initRoomStates(level);
    this.log.push(`Entered level ${level.id} at ${level.startRoomId}.`);

    // Virtual BattleOnly / start-in-encounter: pause for confirm on spawn.
    this.refreshPendingCombatFlag();
  }

  static start(level: LevelAsset): AdventureSession {
    return new AdventureSession(level);
  }

  getLevel(): LevelAsset {
    return this.level;
  }

  getPhase(): AdventurePhase {
    return this.phase;
  }

  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  isPendingCombat(): boolean {
    return this.pendingCombat;
  }

  getRoomState(roomId: string): RoomRuntimeState {
    const state = this.roomStates[roomId];
    if (!state) {
      throw new AdventureError(`Unknown room: ${roomId}`);
    }
    return state;
  }

  getCurrentRoom(): RoomDefinition {
    const room = this.level.rooms[this.currentRoomId];
    if (!room) {
      throw new AdventureError(`Unknown current room: ${this.currentRoomId}`);
    }
    return room;
  }

  legalActions(): AdventureExploreAction[] {
    if (this.phase !== 'explore') {
      return [];
    }

    const actions: AdventureExploreAction[] = [];
    const room = this.getCurrentRoom();
    const state = this.getRoomState(this.currentRoomId);

    if (this.pendingCombat) {
      actions.push({ type: 'ConfirmCombat' });
      // Deliberate beat: no move/leave while combat confirmation pending.
      for (let i = 0; i < state.loot.length; i += 1) {
        actions.push({ type: 'PickupLoot', index: i });
      }
      return actions;
    }

    for (const dir of ROOM_DIRECTIONS) {
      if (room.exits[dir]) {
        actions.push({ type: 'Move', direction: dir });
      }
    }

    for (let i = 0; i < state.loot.length; i += 1) {
      actions.push({ type: 'PickupLoot', index: i });
    }

    if (room.kind === 'exit' && this.canLeaveLevel()) {
      actions.push({ type: 'LeaveLevel' });
    }

    return actions;
  }

  applyAction(action: AdventureExploreAction): void {
    if (this.phase !== 'explore') {
      throw new AdventureError(`Cannot apply explore action in phase ${this.phase}`);
    }

    switch (action.type) {
      case 'Move':
        this.move(action.direction);
        break;
      case 'ConfirmCombat':
        this.confirmCombat();
        break;
      case 'PickupLoot':
        this.pickupLoot(action.index);
        break;
      case 'LeaveLevel':
        this.leaveLevel();
        break;
      default:
        throw new AdventureError('Unknown adventure action');
    }
  }

  /** Host calls after combat victory: mark room cleared, drop loot on ground. */
  resolveCombatVictory(loot: RoomGroundLootEntry[]): void {
    if (this.phase !== 'combat') {
      throw new AdventureError('resolveCombatVictory requires combat phase');
    }
    const state = this.getRoomState(this.currentRoomId);
    state.cleared = true;
    state.encounterConsumed = true;
    state.loot.push(...loot);
    this.pendingCombat = false;
    this.phase = 'explore';
    this.log.push(`Victory in ${this.currentRoomId}. Loot on ground: ${loot.length}.`);
  }

  /** Host calls after combat defeat. */
  resolveCombatDefeat(): void {
    if (this.phase !== 'combat') {
      throw new AdventureError('resolveCombatDefeat requires combat phase');
    }
    this.phase = 'defeat';
    this.pendingCombat = false;
    this.log.push('Defeat. Adventure ended.');
  }

  /** Host: after ConfirmCombat, phase is already `combat`; reserved for attach hooks. */
  notifyCombatAttached(): void {
    if (this.phase !== 'combat') {
      throw new AdventureError('notifyCombatAttached requires combat phase');
    }
  }

  getSnapshot(): AdventureSnapshot {
    return {
      phase: this.phase,
      levelId: this.level.id,
      currentRoomId: this.currentRoomId,
      pendingCombat: this.pendingCombat,
      currentRoom: this.getCurrentRoom(),
      roomStates: structuredClone(this.roomStates),
      legalActions: this.legalActions(),
      log: [...this.log],
    };
  }

  private move(direction: RoomDirection): void {
    this.commitMove(direction, this.getMovementCost(direction));
  }

  /**
   * F01: movement cost is always 0 (wired for ga.dungeon.move / future AP).
   * Throws if direction is not a legal exit from the current room.
   */
  getMovementCost(direction: RoomDirection): number {
    if (this.phase !== 'explore') {
      throw new AdventureError(`Cannot move in phase ${this.phase}`);
    }
    if (this.pendingCombat) {
      throw new AdventureError('Confirm combat before moving');
    }
    const room = this.getCurrentRoom();
    const targetId = room.exits[direction];
    if (!targetId) {
      throw new AdventureError(`No exit ${direction} from ${room.id}`);
    }
    if (!this.level.rooms[targetId]) {
      throw new AdventureError(`Broken exit to ${targetId}`);
    }
    return 0;
  }

  /**
   * Commit a validated move. Prefer `activateDungeonMove` (GA) from hosts;
   * `applyAction({ type: 'Move' })` also ends here.
   */
  commitMove(direction: RoomDirection, movementCost: number): void {
    const expected = this.getMovementCost(direction);
    if (movementCost !== expected) {
      throw new AdventureError(
        `Movement cost mismatch: got ${movementCost}, expected ${expected}`,
      );
    }
    const room = this.getCurrentRoom();
    const targetId = room.exits[direction]!;
    this.currentRoomId = targetId;
    this.log.push(`Moved ${direction} to ${targetId} (cost ${movementCost}).`);
    this.refreshPendingCombatFlag();
  }

  private confirmCombat(): void {
    if (!this.pendingCombat) {
      throw new AdventureError('No pending combat to confirm');
    }
    this.phase = 'combat';
    this.log.push(`Confirmed combat in ${this.currentRoomId}.`);
  }

  private pickupLoot(index: number): RoomGroundLootEntry {
    const state = this.getRoomState(this.currentRoomId);
    if (index < 0 || index >= state.loot.length) {
      throw new AdventureError(`Invalid loot index: ${index}`);
    }
    const [entry] = state.loot.splice(index, 1);
    if (!entry) {
      throw new AdventureError(`Invalid loot index: ${index}`);
    }
    this.log.push(`Picked up ${entry.itemId} x${entry.quantity}.`);
    return entry;
  }

  /** Returns removed loot entry for host to place into inventory. */
  takeLoot(index: number): RoomGroundLootEntry {
    return this.pickupLoot(index);
  }

  private leaveLevel(): void {
    if (!this.canLeaveLevel()) {
      throw new AdventureError('Cannot leave level yet');
    }
    this.phase = 'victory';
    this.log.push('Left level. Adventure victory.');
  }

  private canLeaveLevel(): boolean {
    const room = this.getCurrentRoom();
    return room.kind === 'exit' && !this.pendingCombat;
  }

  private refreshPendingCombatFlag(): void {
    const room = this.getCurrentRoom();
    const state = this.getRoomState(this.currentRoomId);
    this.pendingCombat = Boolean(
      room.encounter && !state.encounterConsumed && !state.cleared,
    );
    if (this.pendingCombat) {
      this.log.push(
        `Enemy present in ${this.currentRoomId} (${room.encounter!.characterId}) — confirm to fight.`,
      );
    }
  }
}
