import type { RuleEngine } from '../engine/rule-engine.js';
import { createGameplayEvent } from '../events/gameplay-event.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import type { TraceEntryInput } from '../trace/trace.js';
import { activateCardAction } from './card-actions.js';
import { getCardSpec, STARTER_DECK } from './card-catalog.js';
import {
  applyDamage,
  getEntityActionPoints,
  getEntityBlock,
  getEntityHealth,
} from './combat-damage.js';
import {
  buildDeckInstances,
  discardFromHand,
  discardHand,
  drawCards,
} from './deck-state.js';
import { CombatError } from './errors.js';
import { createSlimeScript } from './enemy-script.js';
import {
  COMBAT_ENEMY_ID,
  COMBAT_PLAYER_ID,
  DEFAULT_COMBAT_CONFIG,
  type CardInstance,
  type CombatAction,
  type CombatPhase,
  type CombatResult,
  type CombatSessionConfig,
  type CombatSnapshot,
  type CombatTurnOwner,
  type DeckState,
} from './types.js';

export class CombatSession {
  private phase: CombatPhase = 'Setup';
  private turnOwner: CombatTurnOwner = 'player';
  private result?: CombatResult;
  private readonly deck: DeckState;
  private readonly instances: Map<string, CardInstance>;
  private readonly combatLog: string[] = [];
  private readonly combatChannel;
  private readonly enemyScript;

  private constructor(
    private readonly engine: RuleEngine,
    private readonly config: CombatSessionConfig,
    deck: DeckState,
    instances: Map<string, CardInstance>,
  ) {
    this.deck = deck;
    this.instances = instances;
    this.combatChannel = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));
    this.enemyScript = createSlimeScript(config.enemyAttackDamage);
  }

  static bootstrap(
    engine: RuleEngine,
    config: Partial<CombatSessionConfig> = {},
  ): CombatSession {
    const merged = { ...DEFAULT_COMBAT_CONFIG, ...config };
    const { deck, instances } = buildDeckInstances(STARTER_DECK);
    const session = new CombatSession(engine, merged, deck, instances);
    session.runSetup();
    return session;
  }

  legalActions(): CombatAction[] {
    if (this.phase !== 'PlayerTurn' || this.result) {
      return [];
    }

    const actions: CombatAction[] = [{ type: 'EndTurn' }];
    const player = this.requirePlayer();
    const ap = getEntityActionPoints(player);

    this.deck.hand.forEach((instanceId, handIndex) => {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return;
      }
      const spec = getCardSpec(instance.actionId);
      if (ap >= spec.cost) {
        actions.push({ type: 'PlayCard', handIndex });
      }
    });

    return actions;
  }

  applyAction(action: CombatAction): void {
    if (this.result) {
      throw new CombatError(`Combat already ended with result: ${this.result}`);
    }

    switch (action.type) {
      case 'PlayCard':
        this.playCard(action.handIndex);
        break;
      case 'EndTurn':
        this.endPlayerTurn();
        break;
      default:
        throw new CombatError('Unknown combat action');
    }
  }

  getSnapshot(): CombatSnapshot {
    const player = this.requirePlayer();
    const enemy = this.requireEnemy();

    const hand = this.deck.hand
      .map((instanceId) => {
        const instance = this.instances.get(instanceId);
        if (!instance) {
          return undefined;
        }
        const spec = getCardSpec(instance.actionId);
        return {
          instanceId,
          actionId: instance.actionId,
          name: spec.name,
          cost: spec.cost,
        };
      })
      .filter((card): card is NonNullable<typeof card> => card !== undefined);

    const intent = this.enemyScript.getIntent();

    return {
      phase: this.phase,
      turnOwner: this.turnOwner,
      player: {
        entityId: COMBAT_PLAYER_ID,
        name: 'Player',
        health: getEntityHealth(player),
        block: getEntityBlock(player),
        actionPoints: getEntityActionPoints(player),
      },
      enemies: [
        {
          entityId: COMBAT_ENEMY_ID,
          name: this.enemyScript.name,
          health: getEntityHealth(enemy),
          block: getEntityBlock(enemy),
        },
      ],
      hand,
      enemyIntent: {
        entityId: COMBAT_ENEMY_ID,
        label: `Attack ${intent.damage}`,
      },
      combatLog: [...this.combatLog],
      result: this.result,
    };
  }

  private runSetup(): void {
    this.emitCombatTrace({ kind: 'combat.phase', before: 'Setup', after: 'Setup' });

    const player = this.engine.createEntityWithGfc(COMBAT_PLAYER_ID);
    const enemy = this.engine.createEntityWithGfc(COMBAT_ENEMY_ID);

    player.setAttributeBase('Health', this.config.playerStartHealth);
    player.setAttributeBase('Block', 0);
    player.setAttributeBase('ActionPoints', this.config.actionPointsPerTurn);
    enemy.setAttributeBase('Health', this.config.enemyStartHealth);
    enemy.setAttributeBase('Block', 0);

    const drawn = drawCards(this.deck, this.config.openingDraw);
    for (const instanceId of drawn) {
      const instance = this.instances.get(instanceId);
      if (instance) {
        this.emitDrawEvent(COMBAT_PLAYER_ID, instance.actionId);
      }
    }

    this.setPhase('PlayerTurn', 'player');
    this.log(`Battle begins. Drew ${drawn.length} cards.`);
    this.emitCombatTrace({ kind: 'combat.turn', owner: 'player', phase: 'PlayerTurn' });
  }

  private playCard(handIndex: number): void {
    if (this.phase !== 'PlayerTurn') {
      throw new CombatError('Cannot play cards outside player turn');
    }

    const instanceId = this.deck.hand[handIndex];
    if (!instanceId) {
      throw new CombatError(`Invalid hand index: ${handIndex}`);
    }

    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new CombatError(`Unknown card instance: ${instanceId}`);
    }

    const spec = getCardSpec(instance.actionId);
    const player = this.requirePlayer();
    const ap = getEntityActionPoints(player);
    if (ap < spec.cost) {
      throw new CombatError(`Insufficient AP for ${spec.name}`);
    }

    player.setAttributeBase('ActionPoints', ap - spec.cost);

    activateCardAction({
      actionId: instance.actionId,
      player,
      enemy: this.requireEnemy(),
      engine: this.engine,
      onPlayerDealsDamage: (amount, result) => {
        this.emitCombatEvent('GameplayEvent.Combat.player.DealDamage', {
          sourceId: COMBAT_PLAYER_ID,
          targetId: COMBAT_ENEMY_ID,
          amount,
          blocked: result.blocked,
          healthLost: result.healthLost,
        });
        this.emitCombatTrace({
          kind: 'combat.damage',
          sourceId: COMBAT_PLAYER_ID,
          targetId: COMBAT_ENEMY_ID,
          amount,
          blocked: result.blocked,
        });
        this.log(`${spec.name} dealt ${result.healthLost} damage (${result.blocked} blocked).`);
      },
      onPlayerGainsBlock: (amount) => {
        this.log(`${spec.name} gained ${amount} block.`);
      },
    });

    discardFromHand(this.deck, handIndex);
    this.emitCombatEvent('GameplayEvent.Combat.player.PlayACard', {
      entityId: COMBAT_PLAYER_ID,
      cardId: instance.actionId,
      cost: spec.cost,
    });
    this.emitCombatTrace({
      kind: 'combat.play_card',
      entityId: COMBAT_PLAYER_ID,
      cardId: instance.actionId,
      cost: spec.cost,
    });

    this.checkEndConditions();
  }

  private endPlayerTurn(): void {
    if (this.phase !== 'PlayerTurn') {
      throw new CombatError('Cannot end turn outside player turn');
    }

    discardHand(this.deck);
    this.emitCombatEvent('GameplayEvent.Combat.player.FinishTurn', {
      entityId: COMBAT_PLAYER_ID,
    });
    this.log('Player ended turn.');

    if (this.result) {
      return;
    }

    this.runEnemyTurn();
  }

  private runEnemyTurn(): void {
    this.setPhase('EnemyTurn', 'enemy');
    this.emitCombatEvent('GameplayEvent.Combat.player.NPC.StartTurn', {
      entityId: COMBAT_ENEMY_ID,
    });
    this.emitCombatTrace({ kind: 'combat.turn', owner: 'enemy', phase: 'EnemyTurn' });

    const player = this.requirePlayer();
    const damage = this.enemyScript.getIntent().damage;
    const result = applyDamage(player, damage);

    this.emitCombatEvent('GameplayEvent.Combat.player.TakeDamage', {
      sourceId: COMBAT_ENEMY_ID,
      targetId: COMBAT_PLAYER_ID,
      amount: damage,
      blocked: result.blocked,
      healthLost: result.healthLost,
    });
    this.emitCombatTrace({
      kind: 'combat.damage',
      sourceId: COMBAT_ENEMY_ID,
      targetId: COMBAT_PLAYER_ID,
      amount: damage,
      blocked: result.blocked,
    });
    this.log(`Slime attacked for ${result.healthLost} damage (${result.blocked} blocked).`);

    this.checkEndConditions();
    if (this.result) {
      return;
    }

    this.emitCombatEvent('GameplayEvent.Combat.player.NPC.FinishTurn', {
      entityId: COMBAT_ENEMY_ID,
    });

    this.beginPlayerTurn();
  }

  private beginPlayerTurn(): void {
    const player = this.requirePlayer();
    player.setAttributeBase('Block', 0);
    player.setAttributeBase('ActionPoints', this.config.actionPointsPerTurn);

    const drawn = drawCards(this.deck, this.config.turnDraw);
    for (const instanceId of drawn) {
      const instance = this.instances.get(instanceId);
      if (instance) {
        this.emitDrawEvent(COMBAT_PLAYER_ID, instance.actionId);
      }
    }

    this.setPhase('PlayerTurn', 'player');
    this.emitCombatEvent('GameplayEvent.Combat.player.StartTurn', {
      entityId: COMBAT_PLAYER_ID,
    });
    this.emitCombatTrace({ kind: 'combat.turn', owner: 'player', phase: 'PlayerTurn' });
    this.log(`Player turn. Drew ${drawn.length} card(s).`);
  }

  private checkEndConditions(): void {
    const playerHealth = getEntityHealth(this.requirePlayer());
    const enemyHealth = getEntityHealth(this.requireEnemy());

    if (enemyHealth <= 0) {
      this.endCombat('victory');
      return;
    }

    if (playerHealth <= 0) {
      this.endCombat('defeat');
    }
  }

  private endCombat(result: CombatResult): void {
    const before = this.phase;
    this.result = result;
    this.phase = result === 'victory' ? 'Victory' : 'Defeat';
    this.emitCombatTrace({ kind: 'combat.end', result });
    this.emitCombatTrace({ kind: 'combat.phase', before, after: this.phase });
    this.log(result === 'victory' ? 'Victory!' : 'Defeat.');
  }

  private setPhase(phase: CombatPhase, turnOwner: CombatTurnOwner): void {
    const before = this.phase;
    this.phase = phase;
    this.turnOwner = turnOwner;
    this.emitCombatTrace({ kind: 'combat.phase', before, after: phase });
  }

  private emitDrawEvent(entityId: string, cardId: string): void {
    this.emitCombatEvent('GameplayEvent.Combat.player.DrawACard', {
      entityId,
      cardId,
      handSize: this.deck.hand.length,
    });
    this.emitCombatTrace({
      kind: 'combat.draw',
      entityId,
      cardId,
      handSize: this.deck.hand.length,
    });
  }

  private emitCombatEvent(tagName: string, payload?: Record<string, unknown>): void {
    const tags: GameplayTag[] = [
      this.engine.tagManager.resolve('GameplayEvent.Combat'),
      this.engine.tagManager.resolve(tagName),
    ];

    this.engine.eventSystem.dispatch(
      this.combatChannel,
      createGameplayEvent(this.engine.tagManager, { tags, payload }),
    );
  }

  private emitCombatTrace(entry: TraceEntryInput): void {
    this.engine.trace?.emit(entry);
  }

  private log(message: string): void {
    this.combatLog.push(message);
    if (this.combatLog.length > 20) {
      this.combatLog.shift();
    }
  }

  private requirePlayer() {
    return this.engine.requireGfc(COMBAT_PLAYER_ID);
  }

  private requireEnemy() {
    return this.engine.requireGfc(COMBAT_ENEMY_ID);
  }
}
