import type { EntityId } from '@cardgame/core';
import type { PrimaryAttributeBlock } from './combat-attributes.js';
import type { CardDefinition } from './card-definition.js';
import type { GameplayAbilityDefinition } from '@cardgame/core';

export const COMBAT_PLAYER_ID = 'player' as const;
export const COMBAT_ENEMY_ID = 'enemy-1' as const;

export type CombatPhase = 'Setup' | 'PlayerTurn' | 'EnemyTurn' | 'Victory' | 'Defeat';
export type CombatTurnOwner = 'player' | 'enemy';
export type CombatResult = 'victory' | 'defeat';
export type CardId = string;
/** @deprecated Prefer CardId ? open string ids (CORE-F12 D6). */
export type CardActionId = CardId;

/** Probe deck card ids (catalog membership validated at load). */
export const CARD_ACTION_IDS = [
  'strike',
  'defend',
  'bash',
  'jab',
  'heavy_blow',
  'surge',
  'precise_cut',
  'mend',
  'weaken',
  'wait',
] as const;

export type CombatAction =
  | { type: 'PlayCard'; handIndex: number }
  | { type: 'EndTurn' };

export type CardInstance = {
  instanceId: string;
  actionId: CardId;
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
  maxHealth: number;
  block: number;
  actionPoints?: number;
  maxActionPoints?: number;
  primaries?: PrimaryAttributeBlock;
  damageScaling?: number;
  damageMultiplier?: number;
  damageOffset?: number;
};

export type DamageBreakdown = {
  panel: number;
  bonus: number;
  scaling: number;
  multiplier: number;
  offset: number;
  outgoing: number;
};

export type CardView = {
  instanceId: string;
  actionId: CardId;
  name: string;
  cost: number;
};

export type CombatPreviewSnapshot = {
  handIndex: number;
  instanceId: string;
  actionId: CardId;
  targetEntityId: EntityId;
  damage?: number;
  damageToTake?: number;
  blockToGain?: number;
  damageBreakdown?: DamageBreakdown;
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

export type CardActionSpec = {
  id: CardId;
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
  openingHand?: readonly CardId[];
};

export type CombatSessionConfig = CombatSessionTuneables & {
  cardCatalog: Record<CardId, CardDefinition>;
  deckIds: readonly CardId[];
  takeDamageAbility: GameplayAbilityDefinition;
};

export const DEFAULT_COMBAT_CONFIG: CombatSessionTuneables = {
  openingDraw: 5,
  turnDraw: 5,
  actionPointsPerTurn: 3,
  playerStartHealth: 30,
  enemyStartHealth: 12,
  enemyAttackDamage: 6,
};
