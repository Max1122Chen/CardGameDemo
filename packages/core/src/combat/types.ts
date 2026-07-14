import type { EntityId } from '../engine/component-type.js';

export const COMBAT_PLAYER_ID = 'player' as const;
export const COMBAT_ENEMY_ID = 'enemy-1' as const;

export type CombatPhase = 'Setup' | 'PlayerTurn' | 'EnemyTurn' | 'Victory' | 'Defeat';
export type CombatTurnOwner = 'player' | 'enemy';
export type CombatResult = 'victory' | 'defeat';
export type CardActionId = 'strike' | 'defend' | 'bash' | 'weaken' | 'flex' | 'wait';

export const CARD_ACTION_IDS = [
  'strike',
  'defend',
  'bash',
  'weaken',
  'flex',
  'wait',
] as const satisfies readonly CardActionId[];

export type CombatAction =
  | { type: 'PlayCard'; handIndex: number }
  | { type: 'EndTurn' };

export type CardInstance = {
  instanceId: string;
  actionId: CardActionId;
};

export type DeckState = {
  drawPile: string[];
  hand: string[];
  discardPile: string[];
};

export type EnemyIntent = {
  kind: 'Attack';
  damage: number;
};

export type ActorSnapshot = {
  entityId: EntityId;
  name: string;
  health: number;
  block: number;
  actionPoints?: number;
};

export type CardView = {
  instanceId: string;
  actionId: CardActionId;
  name: string;
  cost: number;
};

export type CombatPreviewSnapshot = {
  handIndex: number;
  instanceId: string;
  actionId: CardActionId;
  targetEntityId: EntityId;
  damage?: number;
  damageToTake?: number;
  blockToGain?: number;
};

export type CombatSnapshot = {
  phase: CombatPhase;
  turnOwner: CombatTurnOwner;
  player: ActorSnapshot;
  enemies: ActorSnapshot[];
  hand: CardView[];
  enemyIntent?: { entityId: EntityId; label: string };
  combatLog: string[];
  result?: CombatResult;
  preview?: CombatPreviewSnapshot;
};

import type { CardDefinition } from './card-definition.js';

export type CardActionSpec = {
  id: CardActionId;
  name: string;
  cost: number;
};

export type CombatSessionTuneables = {
  openingDraw: number;
  turnDraw: number;
  actionPointsPerTurn: number;
  playerStartHealth: number;
  enemyStartHealth: number;
  enemyAttackDamage: number;
  /** Scenario hook: force opening hand (ignores openingDraw count). */
  openingHand?: readonly CardActionId[];
};

export type CombatSessionConfig = CombatSessionTuneables & {
  cardCatalog: Record<CardActionId, CardDefinition>;
  deckIds: readonly CardActionId[];
};

export const DEFAULT_COMBAT_CONFIG: CombatSessionTuneables = {
  openingDraw: 5,
  turnDraw: 5,
  actionPointsPerTurn: 3,
  playerStartHealth: 30,
  enemyStartHealth: 12,
  enemyAttackDamage: 6,
};
