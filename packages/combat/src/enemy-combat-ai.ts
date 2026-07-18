import type { CharacterInstance } from '@cardgame/characters';
import type { GameplayFrameworkComponent } from '@cardgame/core';
import {
  BehaviorTreeTaskRegistry,
  Blackboard,
  type BtStatus,
} from '@cardgame/core';

import {
  computeAttributeBonusForEntity,
  type AttributeBonusConfig,
} from './attribute-bonus.js';
import type { CardDefinition } from './card-definition.js';
import { getEntityActionPoints } from './combat-damage.js';
import { peekNextTaskNode } from './enemy-bt-peek.js';
import {
  evaluateEnemyWhenCondition,
  fillEnemyBlackboard,
  type EnemyWhenCondition,
} from './enemy-blackboard.js';
import { chooseBestEnemyCard, type EnemyCardGoal } from './enemy-card-choice.js';
import {
  fallbackCardIntentLabel,
  findEnemyHandInstanceId,
  previewEnemyCardIntentLabel,
  resolveEnemyPlayTarget,
} from './enemy-intent-preview.js';
import { SetByCallerKeys } from './set-by-caller-keys.js';
import {
  COMBAT_ENEMY_ID,
  type CardId,
  type CardInstance,
  type DeckState,
} from './types.js';

export type EnemyCardPreview = {
  handIndex: number;
  instanceId: string;
  actionId: CardId;
  abilityHandle: string;
  abilityInstanceId: string;
  targetEntityId: string;
};

/** Session-owned state the enemy AI needs without importing CombatSession. */
export type EnemyCombatAiHost = {
  getEnemy(): GameplayFrameworkComponent;
  getPlayer(): GameplayFrameworkComponent;
  getCardDefinition(id: CardId): CardDefinition;
  cardDefinitions: Record<CardId, CardDefinition>;
  enemyDeck: DeckState;
  enemyInstances: Map<string, CardInstance>;
  enemyCardAbilityHandles: Map<CardId, string>;
  enemyCharacter: CharacterInstance;
  bonusConfig: AttributeBonusConfig;
  hasPlayerPreview(): boolean;
  getEnemyPreview(): EnemyCardPreview | undefined;
  setEnemyPreview(preview: EnemyCardPreview | undefined): void;
  emitCombatEvent(tagName: string, payload?: Record<string, unknown>): void;
};

/**
 * Enemy BT task registry, blackboard, intent labels, and card activation.
 * Extracted from CombatSession so the session stays turn/lifecycle focused.
 */
export class EnemyCombatAi {
  readonly blackboard = new Blackboard();
  readonly taskRegistry: BehaviorTreeTaskRegistry;
  private lastIntentLabel = 'Unknown';

  constructor(private readonly host: EnemyCombatAiHost) {
    this.taskRegistry = this.createTaskRegistry();
  }

  syncBlackboard(
    enemy: GameplayFrameworkComponent,
    player: GameplayFrameworkComponent,
  ): void {
    fillEnemyBlackboard({
      blackboard: this.blackboard,
      primaries: this.host.enemyCharacter.primaries,
      enemy,
      player,
    });
  }

  createPeekContext(
    enemy: GameplayFrameworkComponent,
    player: GameplayFrameworkComponent,
  ) {
    this.syncBlackboard(enemy, player);
    return {
      blackboard: this.blackboard,
      isCardPlayable: (cardId: CardId) => this.isCardPlayable(cardId, enemy),
      resolvePlayBestCard: (goal: EnemyCardGoal) =>
        this.resolvePlayBestCard(goal, enemy, player)?.cardId,
    };
  }

  buildIntentLabel(
    nextTask: ReturnType<typeof peekNextTaskNode>,
    enemy: GameplayFrameworkComponent,
    player: GameplayFrameworkComponent,
  ): string {
    if (this.host.hasPlayerPreview() || this.host.getEnemyPreview()) {
      return this.lastIntentLabel;
    }
    const label = this.computeIntentLabel(nextTask, enemy, player);
    this.lastIntentLabel = label;
    return label;
  }

  private createTaskRegistry(): BehaviorTreeTaskRegistry {
    const registry = new BehaviorTreeTaskRegistry();
    registry.register('combat.playCard', (_ctx, params) => this.taskPlayCard(params));
    registry.register('combat.playCardIf', (_ctx, params) => this.taskPlayCardIf(params));
    registry.register('combat.playBestCard', (_ctx, params) => this.taskPlayBestCard(params));
    registry.register('combat.wait', () => 'Success');
    registry.register('combat.endTurn', () => 'Success');
    return registry;
  }

  private isCardPlayable(cardId: CardId, enemy: GameplayFrameworkComponent): boolean {
    if (!this.host.cardDefinitions[cardId]) {
      return false;
    }
    const instanceId = findEnemyHandInstanceId(
      cardId,
      this.host.enemyDeck.hand,
      this.host.enemyInstances,
    );
    if (!instanceId) {
      return false;
    }
    return getEntityActionPoints(enemy) >= this.host.getCardDefinition(cardId).cost;
  }

  private resolvePlayBestCard(
    goal: EnemyCardGoal,
    enemy: GameplayFrameworkComponent,
    player: GameplayFrameworkComponent,
  ) {
    return chooseBestEnemyCard({
      goal,
      enemy,
      player,
      hand: this.host.enemyDeck.hand,
      instances: this.host.enemyInstances,
      cardDefinitions: this.host.cardDefinitions,
      abilityHandles: this.host.enemyCardAbilityHandles,
      bonusConfig: this.host.bonusConfig,
    });
  }

  private parseWhenParam(params: Record<string, unknown>): EnemyWhenCondition | undefined {
    const when = params.when;
    if (when === 'selfLowHp' || when === 'playerLowHp') {
      return when;
    }
    return undefined;
  }

  private parseGoalParam(params: Record<string, unknown>): EnemyCardGoal | undefined {
    const goal = params.goal;
    if (goal === 'damage' || goal === 'block' || goal === 'finisher') {
      return goal;
    }
    return undefined;
  }

  private matchesWhen(params: Record<string, unknown>): boolean {
    const when = this.parseWhenParam(params);
    if (!when) {
      return true;
    }
    return evaluateEnemyWhenCondition(this.blackboard, when);
  }

  private computeIntentLabel(
    nextTask: ReturnType<typeof peekNextTaskNode>,
    enemy: GameplayFrameworkComponent,
    player: GameplayFrameworkComponent,
  ): string {
    if (!nextTask) {
      return 'Unknown';
    }
    if (nextTask.actionId === 'combat.wait') {
      return 'Wait';
    }
    if (nextTask.actionId === 'combat.endTurn') {
      return 'End turn';
    }
    if (nextTask.actionId !== 'combat.playCard') {
      return 'Unknown';
    }

    const cardId = typeof nextTask.params?.cardId === 'string' ? nextTask.params.cardId : '';
    if (!cardId || !this.host.cardDefinitions[cardId]) {
      return 'Unknown';
    }

    const def = this.host.getCardDefinition(cardId);
    const handle = this.host.enemyCardAbilityHandles.get(cardId);
    if (!handle) {
      return fallbackCardIntentLabel(def);
    }

    const instanceId = findEnemyHandInstanceId(
      cardId,
      this.host.enemyDeck.hand,
      this.host.enemyInstances,
    );
    if (!instanceId) {
      return fallbackCardIntentLabel(def);
    }

    if (getEntityActionPoints(enemy) < def.cost) {
      return fallbackCardIntentLabel(def);
    }

    return previewEnemyCardIntentLabel({
      enemy,
      player,
      def,
      abilityHandle: handle,
      cardInstanceId: instanceId,
      bonusConfig: this.host.bonusConfig,
    });
  }

  private taskPlayCard(params: Record<string, unknown>): BtStatus {
    const cardId = typeof params.cardId === 'string' ? params.cardId : '';
    if (!cardId || !this.host.cardDefinitions[cardId]) {
      return 'Failure';
    }
    return this.playCardById(cardId) ? 'Success' : 'Failure';
  }

  private taskPlayCardIf(params: Record<string, unknown>): BtStatus {
    if (!this.matchesWhen(params)) {
      return 'Failure';
    }
    return this.taskPlayCard(params);
  }

  private taskPlayBestCard(params: Record<string, unknown>): BtStatus {
    if (!this.matchesWhen(params)) {
      return 'Failure';
    }
    const goal = this.parseGoalParam(params);
    if (!goal) {
      return 'Failure';
    }
    const choice = this.resolvePlayBestCard(goal, this.host.getEnemy(), this.host.getPlayer());
    if (!choice) {
      return 'Failure';
    }
    return this.playCardByInstanceId(choice.instanceId) ? 'Success' : 'Failure';
  }

  private playCardByInstanceId(instanceId: string): boolean {
    const instance = this.host.enemyInstances.get(instanceId);
    if (!instance) {
      return false;
    }
    return this.playCardById(instance.actionId);
  }

  private playCardById(cardId: CardId): boolean {
    if (this.host.getEnemyPreview()) {
      return false;
    }

    const handIndex = this.host.enemyDeck.hand.findIndex(
      (instanceId) => this.host.enemyInstances.get(instanceId)?.actionId === cardId,
    );
    if (handIndex < 0) {
      return false;
    }

    const instanceId = this.host.enemyDeck.hand[handIndex]!;
    const instance = this.host.enemyInstances.get(instanceId);
    if (!instance) {
      return false;
    }

    const def = this.host.getCardDefinition(instance.actionId);
    const enemy = this.host.getEnemy();
    if (getEntityActionPoints(enemy) < def.cost) {
      return false;
    }

    const handle = this.host.enemyCardAbilityHandles.get(instance.actionId);
    if (!handle) {
      return false;
    }

    const targetId = resolveEnemyPlayTarget(def);

    const setByCaller: Record<string, number> = {};
    if (def.attributeBonus) {
      setByCaller[SetByCallerKeys.AttributeBonus] = computeAttributeBonusForEntity(
        def.attributeBonus,
        enemy,
        this.host.bonusConfig,
      );
    }

    const result = enemy.tryActivate(handle, {
      instigatorEntityId: COMBAT_ENEMY_ID,
      sourceEntityId: COMBAT_ENEMY_ID,
      targetEntityId: targetId,
      parameters: def.ability.parameterValues,
      payload: { cardInstanceId: instanceId, actionId: instance.actionId, cost: def.cost },
      setByCaller: Object.keys(setByCaller).length > 0 ? setByCaller : undefined,
    });

    if (!result.ok) {
      return false;
    }

    this.host.setEnemyPreview({
      handIndex,
      instanceId,
      actionId: instance.actionId,
      abilityHandle: handle,
      abilityInstanceId: result.instanceId,
      targetEntityId: targetId,
    });

    this.host.emitCombatEvent('GameplayEvent.Combat.TryPlayCard', {
      cardInstanceId: instanceId,
      actionId: instance.actionId,
      sourceId: COMBAT_ENEMY_ID,
      targetId,
    });

    return true;
  }
}
