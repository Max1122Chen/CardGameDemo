import { AdventureError } from './errors.js';
import { generateDefaultDungeonLevel } from './generate-level.js';
import { defaultGeneratedInteractables } from './interaction/probe-setup.js';
import type { InteractionHost, RoomInteractableView } from './interaction/types.js';
import {
  AdventureLifecycleBus,
  type AdventureLifecycleEventType,
  type AdventureLifecycleListener,
} from './lifecycle.js';
import { LevelSession, type LevelSessionOptions, type LevelSnapshot } from './level-session.js';
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
import { DEFAULT_DUNGEON_LEVEL_COUNT, DEFAULT_EXPLORE_MAX_AP } from './types.js';

/** Deterministic per-floor seed from run seed + 0-based level index. */
export function seedForLevel(runSeed: number, levelIndex: number): number {
  return (runSeed + levelIndex * 0x9e3779b9) >>> 0;
}

export type AdventureSnapshot = Omit<LevelSnapshot, 'phase'> & {
  phase: AdventurePhase;
  /** 0-based floor index. */
  levelIndex: number;
  /** Total floors in this run. */
  levelCount: number;
  runSeed: number;
};

export type AdventureSessionOptions = LevelSessionOptions & {
  /** Whole-run seed (generated multi-level). Single-level runs use 0 when omitted. */
  runSeed?: number;
  /** Floors in the run (default 1 for startFromLevel / start). */
  levelCount?: number;
  /** Override level factory (tests). */
  levelFactory?: (levelIndex: number, runSeed: number) => LevelAsset;
};

export type AdventureRunOptions = {
  runSeed: number;
  levelCount?: number;
  lifecycle?: AdventureLifecycleBus;
  maxExploreAp?: number;
  levelFactory?: (levelIndex: number, runSeed: number) => LevelAsset;
};

/**
 * Whole dungeon run: owns LevelSession(s), descend vs evacuate on LeaveLevel.
 * Player GFC / inventory / loadout stay on the host across floors.
 */
export class AdventureSession {
  private levelSession: LevelSession;
  private levelIndex: number;
  private readonly levelCount: number;
  private readonly runSeed: number;
  private readonly lifecycle: AdventureLifecycleBus;
  private readonly maxExploreAp: number;
  private readonly levelFactory: (levelIndex: number, runSeed: number) => LevelAsset;
  private readonly runLog: string[] = [];
  /** Set when the run ends (evacuate victory or defeat). */
  private terminalPhase: 'victory' | 'defeat' | null = null;

  private constructor(
    level: LevelAsset,
    options: AdventureSessionOptions & { levelIndex?: number; emitEnterDungeon?: boolean },
  ) {
    this.lifecycle = options.lifecycle ?? new AdventureLifecycleBus();
    this.maxExploreAp = Math.max(0, options.maxExploreAp ?? DEFAULT_EXPLORE_MAX_AP);
    this.runSeed = options.runSeed ?? 0;
    this.levelCount = Math.max(1, options.levelCount ?? 1);
    this.levelIndex = options.levelIndex ?? 0;
    this.levelFactory =
      options.levelFactory ??
      ((index, seed) => generateDefaultDungeonLevel(seedForLevel(seed, index)));

    if (options.emitEnterDungeon !== false) {
      this.lifecycle.emit('EnterDungeon', {
        runSeed: this.runSeed,
        levelCount: this.levelCount,
      });
      this.runLog.push(
        `Entered dungeon (seed ${this.runSeed}, ${this.levelCount} level(s)).`,
      );
    }

    this.levelSession = LevelSession.start(level, {
      lifecycle: this.lifecycle,
      maxExploreAp: this.maxExploreAp,
      interactablesByRoom: options.interactablesByRoom,
      interactionHost: options.interactionHost,
    });
  }

  /** Backward-compatible: single-floor run from a fixed level asset. */
  static start(
    level: LevelAsset,
    lifecycleOrOptions?: AdventureLifecycleBus | AdventureSessionOptions,
  ): AdventureSession {
    if (lifecycleOrOptions instanceof AdventureLifecycleBus) {
      return AdventureSession.startFromLevel(level, { lifecycle: lifecycleOrOptions });
    }
    return AdventureSession.startFromLevel(level, lifecycleOrOptions ?? {});
  }

  /** Single-floor run (JSON probe, battle_only, tests). LeaveLevel → evacuate. */
  static startFromLevel(
    level: LevelAsset,
    options: AdventureSessionOptions = {},
  ): AdventureSession {
    return new AdventureSession(level, {
      ...options,
      levelCount: options.levelCount ?? 1,
      levelIndex: 0,
    });
  }

  /** Seeded multi-floor generated dungeon. */
  static startRun(options: AdventureRunOptions): AdventureSession {
    const levelCount = Math.max(1, options.levelCount ?? DEFAULT_DUNGEON_LEVEL_COUNT);
    const factory =
      options.levelFactory ??
      ((index, seed) => generateDefaultDungeonLevel(seedForLevel(seed, index)));
    const level = factory(0, options.runSeed);
    return new AdventureSession(level, {
      runSeed: options.runSeed,
      levelCount,
      lifecycle: options.lifecycle,
      maxExploreAp: options.maxExploreAp,
      levelFactory: factory,
      levelIndex: 0,
      interactablesByRoom: defaultGeneratedInteractables(level.startRoomId),
    });
  }

  getLevelSession(): LevelSession {
    return this.levelSession;
  }

  getLevelIndex(): number {
    return this.levelIndex;
  }

  getLevelCount(): number {
    return this.levelCount;
  }

  getRunSeed(): number {
    return this.runSeed;
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
    return this.levelSession.getLevel();
  }

  getPhase(): AdventurePhase {
    if (this.terminalPhase) {
      return this.terminalPhase;
    }
    const levelPhase = this.levelSession.getPhase();
    if (levelPhase === 'exited') {
      // Mid-transition should not be observed; treat as explore.
      return 'explore';
    }
    return levelPhase;
  }

  getRound(): number {
    return this.levelSession.getRound();
  }

  getExploreAp(): number {
    return this.levelSession.getExploreAp();
  }

  getMaxExploreAp(): number {
    return this.levelSession.getMaxExploreAp();
  }

  getVisitedRoomIds(): string[] {
    return this.levelSession.getVisitedRoomIds();
  }

  getKnownRoomIds(): string[] {
    return this.levelSession.getKnownRoomIds();
  }

  getVisionRoomIds(): string[] {
    return this.levelSession.getVisionRoomIds();
  }

  getMappedRoomIds(): string[] {
    return this.levelSession.getMappedRoomIds();
  }

  getPosition(): CellCoord {
    return this.levelSession.getPosition();
  }

  getCurrentRoomId(): string {
    return this.levelSession.getCurrentRoomId();
  }

  isPendingCombat(): boolean {
    return this.levelSession.isPendingCombat();
  }

  getRoomState(roomId: string): RoomRuntimeState {
    return this.levelSession.getRoomState(roomId);
  }

  getCurrentRoom(): RoomDefinition {
    return this.levelSession.getCurrentRoom();
  }

  setInteractionHost(host: InteractionHost | null): void {
    this.levelSession.setInteractionHost(host);
  }

  listRoomInteractables(): RoomInteractableView[] {
    return this.levelSession.listRoomInteractables();
  }

  isInteractionActive(): boolean {
    return this.levelSession.isInteractionActive();
  }

  legalActions(): AdventureExploreAction[] {
    if (this.terminalPhase) {
      return [];
    }
    return this.levelSession.legalActions();
  }

  applyAction(action: AdventureExploreAction): void {
    if (this.terminalPhase) {
      throw new AdventureError(`Cannot apply explore action in phase ${this.terminalPhase}`);
    }
    if (action.type === 'LeaveLevel') {
      this.useStairs();
      return;
    }
    this.levelSession.applyAction(action);
  }

  resolveCombatVictory(loot: RoomGroundLootEntry[]): void {
    this.levelSession.resolveCombatVictory(loot);
  }

  resolveCombatDefeat(): void {
    this.levelSession.resolveCombatDefeat();
    this.terminalPhase = 'defeat';
    this.runLog.push('Defeat. Adventure ended.');
  }

  notifyCombatAttached(): void {
    this.levelSession.notifyCombatAttached();
  }

  getStepCost(direction: RoomDirection): number | undefined {
    return this.levelSession.getStepCost(direction);
  }

  getMovementCost(direction: RoomDirection): number | undefined {
    return this.levelSession.getMovementCost(direction);
  }

  commitMove(direction: RoomDirection, movementCost: number): void {
    this.levelSession.commitMove(direction, movementCost);
  }

  takeLoot(index: number): RoomGroundLootEntry {
    return this.levelSession.takeLoot(index);
  }

  getSnapshot(): AdventureSnapshot {
    const levelSnap = this.levelSession.getSnapshot();
    const phase = this.getPhase();
    const log = [...this.runLog, ...levelSnap.log];
    return {
      ...levelSnap,
      phase,
      levelIndex: this.levelIndex,
      levelCount: this.levelCount,
      runSeed: this.runSeed,
      legalActions: this.legalActions(),
      log,
    };
  }

  /** Stairs action: descend or evacuate. */
  private useStairs(): void {
    if (!this.levelSession.canLeaveLevel()) {
      throw new AdventureError('Cannot leave level yet');
    }
    this.levelSession.applyAction({ type: 'LeaveLevel' });
    if (this.levelIndex + 1 < this.levelCount) {
      this.descend();
    } else {
      this.evacuate();
    }
  }

  private descend(): void {
    const fromLevelId = this.levelSession.getLevel().id;
    const host = this.levelSession.getInteractionHost();
    this.levelIndex += 1;
    const next = this.levelFactory(this.levelIndex, this.runSeed);
    this.runLog.push(
      `Descended from ${fromLevelId} → floor ${this.levelIndex + 1}/${this.levelCount} (${next.id}).`,
    );
    this.levelSession = LevelSession.start(next, {
      lifecycle: this.lifecycle,
      maxExploreAp: this.maxExploreAp,
      interactablesByRoom: defaultGeneratedInteractables(next.startRoomId),
      interactionHost: host ?? undefined,
    });
  }

  private evacuate(): void {
    this.terminalPhase = 'victory';
    this.runLog.push('Evacuated dungeon. Victory.');
    this.lifecycle.emit('LeaveDungeon', {
      runSeed: this.runSeed,
      levelIndex: this.levelIndex,
      levelId: this.levelSession.getLevel().id,
    });
  }
}
