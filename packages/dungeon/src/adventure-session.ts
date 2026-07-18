import { AdventureError } from './errors.js';
import { cellKey, stepCell, stepMovementCost } from './level-geometry.js';
import {
  AdventureLifecycleBus,
  type AdventureLifecycleEventType,
  type AdventureLifecycleListener,
} from './lifecycle.js';
import type {
  AdventureExploreAction,
  AdventurePhase,
  CellCoord,
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
  position: CellCoord;
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
 * Explore-phase session: cell move, confirm-combat pause, room loot.
 * Combat attach/detach is owned by the host; this class tracks phase + pending.
 */
export class AdventureSession {
  private phase: AdventurePhase = 'explore';
  private position: CellCoord;
  private readonly roomStates: Record<string, RoomRuntimeState>;
  private pendingCombat = false;
  private readonly log: string[] = [];
  private readonly lifecycle: AdventureLifecycleBus;

  private constructor(
    private readonly level: LevelAsset,
    lifecycle?: AdventureLifecycleBus,
  ) {
    this.lifecycle = lifecycle ?? new AdventureLifecycleBus();
    this.position = { ...level.startPosition };
    this.roomStates = initRoomStates(level);
    this.log.push(
      `Entered level ${level.id} at ${level.startRoomId} (${cellKey(this.position)}).`,
    );
    this.lifecycle.emit('EnterLevel', {
      levelId: level.id,
      roomId: level.startRoomId,
      position: { ...this.position },
    });

    this.refreshPendingCombatFlag();
  }

  static start(level: LevelAsset, lifecycle?: AdventureLifecycleBus): AdventureSession {
    return new AdventureSession(level, lifecycle);
  }

  getLifecycle(): AdventureLifecycleBus {
    return this.lifecycle;
  }

  onLifecycle(listener: AdventureLifecycleListener): () => void {
    return this.lifecycle.subscribe(listener);
  }

  emitLifecycle(type: AdventureLifecycleEventType, payload?: Record<string, unknown>): void {
    this.lifecycle.emit(type, payload);
  }

  getLevel(): LevelAsset {
    return this.level;
  }

  getPhase(): AdventurePhase {
    return this.phase;
  }

  getPosition(): CellCoord {
    return { ...this.position };
  }

  getCurrentRoomId(): string {
    const id = this.level.occupancy[cellKey(this.position)];
    if (!id) {
      throw new AdventureError(`No room at ${cellKey(this.position)}`);
    }
    return id;
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
    const room = this.level.rooms[this.getCurrentRoomId()];
    if (!room) {
      throw new AdventureError(`Unknown current room: ${this.getCurrentRoomId()}`);
    }
    return room;
  }

  legalActions(): AdventureExploreAction[] {
    if (this.phase !== 'explore') {
      return [];
    }

    const actions: AdventureExploreAction[] = [];
    const room = this.getCurrentRoom();
    const state = this.getRoomState(this.getCurrentRoomId());

    if (this.pendingCombat) {
      actions.push({ type: 'ConfirmCombat' });
      for (let i = 0; i < state.loot.length; i += 1) {
        actions.push({ type: 'PickupLoot', index: i });
      }
      return actions;
    }

    for (const dir of ROOM_DIRECTIONS) {
      if (this.getMovementCost(dir) !== undefined) {
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

  resolveCombatVictory(loot: RoomGroundLootEntry[]): void {
    if (this.phase !== 'combat') {
      throw new AdventureError('resolveCombatVictory requires combat phase');
    }
    const roomId = this.getCurrentRoomId();
    const state = this.getRoomState(roomId);
    state.cleared = true;
    state.encounterConsumed = true;
    state.loot.push(...loot);
    this.pendingCombat = false;
    this.phase = 'explore';
    this.log.push(`Victory in ${roomId}. Loot on ground: ${loot.length}.`);
    this.lifecycle.emit('EndCombat', { roomId, outcome: 'victory', lootCount: loot.length });
  }

  resolveCombatDefeat(): void {
    if (this.phase !== 'combat') {
      throw new AdventureError('resolveCombatDefeat requires combat phase');
    }
    this.phase = 'defeat';
    this.pendingCombat = false;
    this.log.push('Defeat. Adventure ended.');
    this.lifecycle.emit('EndCombat', {
      roomId: this.getCurrentRoomId(),
      outcome: 'defeat',
    });
  }

  notifyCombatAttached(): void {
    if (this.phase !== 'combat') {
      throw new AdventureError('notifyCombatAttached requires combat phase');
    }
  }

  getSnapshot(): AdventureSnapshot {
    return {
      phase: this.phase,
      levelId: this.level.id,
      currentRoomId: this.getCurrentRoomId(),
      position: { ...this.position },
      pendingCombat: this.pendingCombat,
      currentRoom: this.getCurrentRoom(),
      roomStates: structuredClone(this.roomStates),
      legalActions: this.legalActions(),
      log: [...this.log],
    };
  }

  private move(direction: RoomDirection): void {
    const cost = this.getMovementCost(direction);
    if (cost === undefined) {
      throw new AdventureError(`Cannot move ${direction} from ${cellKey(this.position)}`);
    }
    this.commitMove(direction, cost);
  }

  /**
   * Returns movement cost for a step, or undefined if illegal.
   * Intra-room = 0; door edge = door.cost (typically 1). Throws only for phase/pending.
   */
  getMovementCost(direction: RoomDirection): number | undefined {
    if (this.phase !== 'explore') {
      throw new AdventureError(`Cannot move in phase ${this.phase}`);
    }
    if (this.pendingCombat) {
      throw new AdventureError('Confirm combat before moving');
    }
    const target = stepCell(this.position, direction);
    return stepMovementCost(this.level, this.position, target);
  }

  /**
   * Commit a validated step. Prefer `activateDungeonMove` (GA) from hosts;
   * `applyAction({ type: 'Move' })` also ends here.
   */
  commitMove(direction: RoomDirection, movementCost: number): void {
    const expected = this.getMovementCost(direction);
    if (expected === undefined) {
      throw new AdventureError(`Cannot move ${direction} from ${cellKey(this.position)}`);
    }
    if (movementCost !== expected) {
      throw new AdventureError(
        `Movement cost mismatch: got ${movementCost}, expected ${expected}`,
      );
    }
    const target = stepCell(this.position, direction);
    this.position = target;
    const toRoom = this.getCurrentRoomId();
    this.log.push(
      `Moved ${direction} to ${cellKey(target)} (${toRoom}, cost ${movementCost}).`,
    );
    // Encounters are room-scoped: entering any cell of an uncleared encounter room
    // triggers pending combat (not cell-coincidence with a monster token).
    this.refreshPendingCombatFlag();
  }

  private confirmCombat(): void {
    if (!this.pendingCombat) {
      throw new AdventureError('No pending combat to confirm');
    }
    const roomId = this.getCurrentRoomId();
    this.phase = 'combat';
    this.log.push(`Confirmed combat in ${roomId}.`);
    this.lifecycle.emit('EnterCombat', { roomId });
  }

  private pickupLoot(index: number): RoomGroundLootEntry {
    const state = this.getRoomState(this.getCurrentRoomId());
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

  takeLoot(index: number): RoomGroundLootEntry {
    return this.pickupLoot(index);
  }

  private leaveLevel(): void {
    if (!this.canLeaveLevel()) {
      throw new AdventureError('Cannot leave level yet');
    }
    this.phase = 'victory';
    this.log.push('Left level. Adventure victory.');
    this.lifecycle.emit('LeaveLevel', {
      levelId: this.level.id,
      roomId: this.getCurrentRoomId(),
    });
  }

  private canLeaveLevel(): boolean {
    const room = this.getCurrentRoom();
    return room.kind === 'exit' && !this.pendingCombat;
  }

  private refreshPendingCombatFlag(): void {
    const room = this.getCurrentRoom();
    const roomId = this.getCurrentRoomId();
    const state = this.getRoomState(roomId);
    const next = Boolean(room.encounter && !state.encounterConsumed && !state.cleared);
    const newlyPending = next && !this.pendingCombat;
    this.pendingCombat = next;
    if (newlyPending) {
      this.log.push(
        `Enemy present in ${roomId} (${room.encounter!.characterId}) — confirm to fight.`,
      );
    }
  }
}
