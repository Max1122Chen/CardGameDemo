import { AdventureError } from './errors.js';
import { cellKey, stepCell, stepMovementCost } from './level-geometry.js';
import {
  AdventureLifecycleBus,
  type AdventureLifecycleEventType,
  type AdventureLifecycleListener,
} from './lifecycle.js';
import type {
  AdventureExploreAction,
  LevelPhase,
  CellCoord,
  LevelAsset,
  RoomDefinition,
  RoomDirection,
  RoomGroundLootEntry,
  RoomRuntimeState,
} from './types.js';
import { DEFAULT_EXPLORE_MAX_AP, ROOM_DIRECTIONS } from './types.js';

export type LevelSnapshot = {
  phase: LevelPhase;
  levelId: string;
  currentRoomId: string;
  position: CellCoord;
  pendingCombat: boolean;
  /** 1-based explore round index. */
  round: number;
  exploreAp: number;
  maxExploreAp: number;
  /** Rooms permanently known (ever seen via vision) — Civ 开图 layout. */
  knownRoomIds: string[];
  /** Rooms the player has physically entered. */
  visitedRoomIds: string[];
  /** Current room ∪ door-adjacent — interior known. */
  visionRoomIds: string[];
  /** Alias of knownRoomIds (rooms drawn on the map). */
  mappedRoomIds: string[];
  /**
   * @deprecated alias of mappedRoomIds / knownRoomIds.
   */
  visibleRoomIds: string[];
  currentRoom: RoomDefinition;
  roomStates: Record<string, RoomRuntimeState>;
  legalActions: AdventureExploreAction[];
  log: readonly string[];
};

export type LevelSessionOptions = {
  lifecycle?: AdventureLifecycleBus;
  /** Max explore AP refilled each round (default 3). */
  maxExploreAp?: number;
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
 * Explore-phase session: cell move, confirm-combat pause, room loot, explore rounds/AP.
 * Combat attach/detach is owned by the host; this class tracks phase + pending.
 */
export class LevelSession {
  private phase: LevelPhase = 'explore';
  private position: CellCoord;
  private readonly roomStates: Record<string, RoomRuntimeState>;
  private pendingCombat = false;
  private readonly log: string[] = [];
  private readonly lifecycle: AdventureLifecycleBus;
  private readonly maxExploreAp: number;
  private round = 0;
  private exploreAp = 0;
  private readonly visitedRoomIds = new Set<string>();
  /** Layout memory: rooms ever seen in vision (not only entered). */
  private readonly knownRoomIds = new Set<string>();

  private constructor(private readonly level: LevelAsset, options: LevelSessionOptions = {}) {
    this.lifecycle = options.lifecycle ?? new AdventureLifecycleBus();
    this.maxExploreAp = Math.max(0, options.maxExploreAp ?? DEFAULT_EXPLORE_MAX_AP);
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

    this.markVisited(level.startRoomId);
    this.revealKnownFromVision();
    this.beginRound();
    this.refreshPendingCombatFlag();
  }

  static start(
    level: LevelAsset,
    lifecycleOrOptions?: AdventureLifecycleBus | LevelSessionOptions,
  ): LevelSession {
    if (lifecycleOrOptions instanceof AdventureLifecycleBus) {
      return new LevelSession(level, { lifecycle: lifecycleOrOptions });
    }
    return new LevelSession(level, lifecycleOrOptions ?? {});
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

  getPhase(): LevelPhase {
    return this.phase;
  }

  getRound(): number {
    return this.round;
  }

  getExploreAp(): number {
    return this.exploreAp;
  }

  getMaxExploreAp(): number {
    return this.maxExploreAp;
  }

  getVisitedRoomIds(): string[] {
    return [...this.visitedRoomIds].sort();
  }

  /** Permanent layout memory: rooms ever revealed by vision. */
  getKnownRoomIds(): string[] {
    return [...this.knownRoomIds].sort();
  }

  /** Room ids linked to `roomId` by at least one door. */
  private doorAdjacentRoomIds(roomId: string): string[] {
    const ids = new Set<string>();
    for (const door of this.level.doors) {
      const ra = this.level.occupancy[cellKey(door.a)];
      const rb = this.level.occupancy[cellKey(door.b)];
      if (ra === roomId && rb) {
        ids.add(rb);
      } else if (rb === roomId && ra) {
        ids.add(ra);
      }
    }
    return [...ids];
  }

  /** Current room ∪ door-adjacent rooms (interior vision). */
  getVisionRoomIds(): string[] {
    const currentId = this.getCurrentRoomId();
    const vision = new Set<string>([currentId, ...this.doorAdjacentRoomIds(currentId)]);
    return [...vision].sort();
  }

  /** Rooms drawn on the map = known layout (ever seen). */
  getMappedRoomIds(): string[] {
    return this.getKnownRoomIds();
  }

  /** @deprecated use getMappedRoomIds / getKnownRoomIds */
  getVisibleRoomIds(): string[] {
    return this.getMappedRoomIds();
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

    actions.push({ type: 'EndRound' });
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
      case 'EndRound':
        this.endRound();
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

  getSnapshot(): LevelSnapshot {
    return {
      phase: this.phase,
      levelId: this.level.id,
      currentRoomId: this.getCurrentRoomId(),
      position: { ...this.position },
      pendingCombat: this.pendingCombat,
      round: this.round,
      exploreAp: this.exploreAp,
      maxExploreAp: this.maxExploreAp,
      visitedRoomIds: this.getVisitedRoomIds(),
      knownRoomIds: this.getKnownRoomIds(),
      visionRoomIds: this.getVisionRoomIds(),
      mappedRoomIds: this.getMappedRoomIds(),
      visibleRoomIds: this.getMappedRoomIds(),
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
   * Geometric step cost (ignores AP). Undefined if wall/void/pending/wrong phase.
   */
  getStepCost(direction: RoomDirection): number | undefined {
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
   * Cost for a legal affordable step, or undefined if illegal / not enough AP.
   */
  getMovementCost(direction: RoomDirection): number | undefined {
    const cost = this.getStepCost(direction);
    if (cost === undefined) {
      return undefined;
    }
    if (cost > this.exploreAp) {
      return undefined;
    }
    return cost;
  }

  /**
   * Commit a validated step. Prefer `activateDungeonMove` (GA) from hosts;
   * `applyAction({ type: 'Move' })` also ends here.
   */
  commitMove(direction: RoomDirection, movementCost: number): void {
    const expected = this.getMovementCost(direction);
    if (expected === undefined) {
      const geometric = (() => {
        try {
          return this.getStepCost(direction);
        } catch {
          return undefined;
        }
      })();
      if (geometric !== undefined && geometric > this.exploreAp) {
        throw new AdventureError(
          `Not enough explore AP (need ${geometric}, have ${this.exploreAp})`,
        );
      }
      throw new AdventureError(`Cannot move ${direction} from ${cellKey(this.position)}`);
    }
    if (movementCost !== expected) {
      throw new AdventureError(
        `Movement cost mismatch: got ${movementCost}, expected ${expected}`,
      );
    }
    const target = stepCell(this.position, direction);
    this.position = target;
    if (movementCost > 0) {
      this.exploreAp -= movementCost;
    }
    const toRoom = this.getCurrentRoomId();
    this.markVisited(toRoom);
    this.revealKnownFromVision();
    this.log.push(
      `Moved ${direction} to ${cellKey(target)} (${toRoom}, cost ${movementCost}, AP ${this.exploreAp}/${this.maxExploreAp}).`,
    );
    this.refreshPendingCombatFlag();
  }

  private markVisited(roomId: string): void {
    this.visitedRoomIds.add(roomId);
    this.knownRoomIds.add(roomId);
  }

  /** Once a room enters vision, its layout is permanently known (Civ 开图). */
  private revealKnownFromVision(): void {
    for (const id of this.getVisionRoomIds()) {
      this.knownRoomIds.add(id);
    }
  }

  private beginRound(): void {
    this.round += 1;
    this.exploreAp = this.maxExploreAp;
    this.log.push(`Round ${this.round} — explore AP ${this.exploreAp}/${this.maxExploreAp}.`);
    this.lifecycle.emit('RoundStart', {
      round: this.round,
      exploreAp: this.exploreAp,
      maxExploreAp: this.maxExploreAp,
    });
  }

  private endRound(): void {
    if (this.pendingCombat) {
      throw new AdventureError('Confirm combat before ending round');
    }
    this.log.push(`Round ${this.round} ended.`);
    this.lifecycle.emit('RoundEnd', {
      round: this.round,
      exploreAp: this.exploreAp,
    });
    // Hook for future unit-pool refresh (empty in F03).
    this.beginRound();
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
    this.phase = 'exited';
    this.log.push('Left level.');
    this.lifecycle.emit('LeaveLevel', {
      levelId: this.level.id,
      roomId: this.getCurrentRoomId(),
    });
  }

  canLeaveLevel(): boolean {
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
