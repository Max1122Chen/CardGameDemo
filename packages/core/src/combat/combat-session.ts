import type { RuleEngine } from '../engine/rule-engine.js';
import { createGameplayEvent } from '../events/gameplay-event.js';
import { emitTurnEndTimingEvent } from '../events/timing-events.js';
import type { AbilityHandlerContext } from '../ga/ability-activation-registry.js';
import type { GameplayFrameworkComponent } from '../gfc/gameplay-framework-component.js';
import type { GameplayEffectApplicationContext } from '../gfc/types.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import type { TraceEntryInput } from '../trace/trace.js';
import { gainBlockFromPreviewEffect, spendActionPointsEffect } from './card-abilities.js';
import type { CardDefinition } from './card-definition.js';
import { CombatAttributes } from './combat-attributes.js';
import { getEntityActionPoints, getEntityBlock, getEntityHealth } from './combat-damage.js';
import {
  buildDeckInstances,
  discardFromHand,
  discardHand,
  drawCards,
} from './deck-state.js';
import { CombatError } from './errors.js';
import { createSlimeScript } from './enemy-script.js';
import { registerCombatAbilityHandlers } from './register-combat-abilities.js';
import { readCommitMode } from './card-play-handler.js';
import { CommitMode } from './set-by-caller-keys.js';
import { bootstrapCombatAttributes, resetCombatMeta } from './take-damage.js';
import {
  COMBAT_ENEMY_ID,
  COMBAT_PLAYER_ID,
  DEFAULT_COMBAT_CONFIG,
  type CardActionId,
  type CardInstance,
  type CombatAction,
  type CombatPhase,
  type CombatResult,
  type CombatSessionConfig,
  type CombatSessionTuneables,
  type CombatSnapshot,
  type CombatTurnOwner,
  type DeckState,
} from './types.js';

type PreviewState = {
  handIndex: number;
  instanceId: string;
  actionId: CardActionId;
  abilityHandle: string;
  abilityInstanceId: string;
  targetEntityId: string;
};

export class CombatSession {
  private phase: CombatPhase = 'Setup';
  private turnOwner: CombatTurnOwner = 'player';
  private result?: CombatResult;
  private readonly deck: DeckState;
  private readonly instances: Map<string, CardInstance>;
  private readonly combatLog: string[] = [];
  private readonly combatChannel;
  private readonly enemyScript;
  private readonly cardDefinitions: Record<CardActionId, CardDefinition>;
  private preview?: PreviewState;
  private readonly cardAbilityHandles = new Map<CardActionId, string>();
  private readonly takeDamageHandles = new Map<string, string>();

  private constructor(
    private readonly engine: RuleEngine,
    private readonly config: CombatSessionConfig,
    deck: DeckState,
    instances: Map<string, CardInstance>,
    cardDefinitions: Record<CardActionId, CardDefinition>,
  ) {
    this.deck = deck;
    this.instances = instances;
    this.cardDefinitions = cardDefinitions;
    this.combatChannel = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));
    this.enemyScript = createSlimeScript(config.enemyAttackDamage);
  }

  static bootstrap(
    engine: RuleEngine,
    config: Partial<CombatSessionTuneables> &
      Pick<CombatSessionConfig, 'cardCatalog' | 'deckIds'>,
  ): CombatSession {
    const merged = { ...DEFAULT_COMBAT_CONFIG, ...config };
    if (!merged.cardCatalog || !merged.deckIds) {
      throw new CombatError(
        'CombatSession.bootstrap requires cardCatalog and deckIds (load from data/ via loadCombatBootstrapFromRepo)',
      );
    }
    const registration = registerCombatAbilityHandlers(engine.activationRegistry);
    const cardDefinitions = merged.cardCatalog;
    const { deck, instances } = buildDeckInstances(merged.deckIds);
    const session = new CombatSession(engine, merged, deck, instances, cardDefinitions);
    registration.setBridge({
      handleCardPlayEvent: (args) => session.handleCardPlayEvent(args),
    });
    session.runSetup();
    return session;
  }

  getCardDefinition(actionId: CardActionId): CardDefinition {
    return this.cardDefinitions[actionId];
  }

  /** Select card + target: GFC preview meta; cancel previous preview. */
  beginCardPreview(handIndex: number, targetEntityId: string = COMBAT_ENEMY_ID): void {
    if (this.phase !== 'PlayerTurn' || this.result) {
      throw new CombatError('Cannot preview cards outside player turn');
    }

    this.cancelCardPreview();

    const instanceId = this.deck.hand[handIndex];
    if (!instanceId) {
      throw new CombatError(`Invalid hand index: ${handIndex}`);
    }
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new CombatError(`Unknown card instance: ${instanceId}`);
    }

    const def = this.cardDefinitions[instance.actionId];
    const player = this.requirePlayer();
    const handle = this.cardAbilityHandles.get(instance.actionId);
    if (!handle) {
      throw new CombatError(`No ability granted for card ${instance.actionId}`);
    }

    const targetId = this.resolvePreviewTarget(def, targetEntityId);

    const result = player.tryActivate(handle, {
      instigatorEntityId: COMBAT_PLAYER_ID,
      sourceEntityId: COMBAT_PLAYER_ID,
      targetEntityId: targetId,
      setByCaller: def.setByCaller,
      payload: { cardInstanceId: instanceId, actionId: instance.actionId, cost: def.cost },
    });

    if (!result.ok) {
      throw new CombatError(`Cannot preview ${instance.actionId}: ${result.reason}`);
    }

    this.preview = {
      handIndex,
      instanceId,
      actionId: instance.actionId,
      abilityHandle: handle,
      abilityInstanceId: result.instanceId,
      targetEntityId: targetId,
    };
  }

  cancelCardPreview(): void {
    if (!this.preview) {
      return;
    }

    const player = this.requirePlayer();
    const enemy = this.requireEnemy();
    player.endAbility(this.preview.abilityInstanceId);
    resetCombatMeta(player);
    resetCombatMeta(enemy);
    this.preview = undefined;
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
      const def = this.cardDefinitions[instance.actionId];
      if (ap >= def.cost) {
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
        const def = this.cardDefinitions[instance.actionId];
        return {
          instanceId,
          actionId: instance.actionId,
          name: def.name,
          cost: def.cost,
        };
      })
      .filter((card): card is NonNullable<typeof card> => card !== undefined);

    const intent = this.enemyScript.getIntent();

    let preview: CombatSnapshot['preview'];
    if (this.preview) {
      const target =
        this.preview.targetEntityId === COMBAT_PLAYER_ID ? player : this.requireEnemy();
      preview = {
        handIndex: this.preview.handIndex,
        instanceId: this.preview.instanceId,
        actionId: this.preview.actionId,
        targetEntityId: this.preview.targetEntityId,
        damage: player.getAttribute(CombatAttributes.Damage)?.currentValue,
        damageToTake: target.getAttribute(CombatAttributes.DamageToTake)?.currentValue,
        blockToGain: player.getAttribute(CombatAttributes.BlockToGain)?.currentValue,
      };
    }

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
      preview,
    };
  }

  hasCardPreview(): boolean {
    return this.preview !== undefined;
  }

  private runSetup(): void {
    this.emitCombatTrace({ kind: 'combat.phase', before: 'Setup', after: 'Setup' });

    this.engine.createEntityWithGfc(COMBAT_PLAYER_ID);
    this.engine.createEntityWithGfc(COMBAT_ENEMY_ID);

    const player = this.requirePlayer();
    const enemy = this.requireEnemy();

    this.takeDamageHandles.set(
      COMBAT_PLAYER_ID,
      bootstrapCombatAttributes(
        player,
        {
          health: this.config.playerStartHealth,
          block: 0,
          actionPoints: this.config.actionPointsPerTurn,
        },
        this.engine.tagManager,
      ),
    );
    this.takeDamageHandles.set(
      COMBAT_ENEMY_ID,
      bootstrapCombatAttributes(
        enemy,
        { health: this.config.enemyStartHealth, block: 0 },
        this.engine.tagManager,
      ),
    );

    const grantedAbilityHandles = new Map<string, string>();
    for (const def of Object.values(this.cardDefinitions)) {
      let handle = grantedAbilityHandles.get(def.ability.id);
      if (!handle) {
        handle = player.grantAbility(def.ability);
        grantedAbilityHandles.set(def.ability.id, handle);
      }
      this.cardAbilityHandles.set(def.id, handle);
    }

    const drawn = this.config.openingHand
      ? this.drawOpeningHand(this.config.openingHand)
      : drawCards(this.deck, this.config.openingDraw);
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

    const def = this.cardDefinitions[instance.actionId];
    const player = this.requirePlayer();
    const ap = getEntityActionPoints(player);
    if (ap < def.cost) {
      throw new CombatError(`Insufficient AP for ${def.name}`);
    }

    if (
      !this.preview ||
      this.preview.instanceId !== instanceId ||
      this.preview.handIndex !== handIndex
    ) {
      const defaultTarget =
        def.targeting === 'single_enemy' ? COMBAT_ENEMY_ID : COMBAT_PLAYER_ID;
      this.beginCardPreview(handIndex, defaultTarget);
    }

    this.emitCombatEvent('GameplayEvent.Combat.TryPlayCard', {
      cardInstanceId: instanceId,
      actionId: instance.actionId,
      sourceId: COMBAT_PLAYER_ID,
      targetId: this.preview?.targetEntityId ?? COMBAT_ENEMY_ID,
    });
  }

  /** CardPlay GA listenWhileActive → commit/cancel (registered bridge). */
  handleCardPlayEvent(
    info: AbilityHandlerContext & { event: import('../events/gameplay-event.js').GameplayEvent },
  ): void {
    const event = info.event;
    const tryTag = this.engine.tagManager.resolve('GameplayEvent.Combat.TryPlayCard');
    const cancelTag = this.engine.tagManager.resolve('GameplayEvent.Combat.CancelPlayCard');

    if (event.tags.has(cancelTag)) {
      this.cancelCardPreview();
      return;
    }

    if (!event.tags.has(tryTag) || !this.preview) {
      return;
    }

    if (this.preview.abilityInstanceId !== info.instanceId) {
      return;
    }

    const payload = event.payload ?? {};
    if (payload.cardInstanceId !== this.preview.instanceId) {
      return;
    }

    this.commitPreview();
  }

  private commitPreview(): void {
    const preview = this.preview;
    if (!preview) {
      return;
    }

    const player = this.requirePlayer();
    const enemy = this.requireEnemy();
    const def = this.cardDefinitions[preview.actionId];
    const geContext: GameplayEffectApplicationContext = {
      instigatorEntityId: COMBAT_PLAYER_ID,
      sourceEntityId: COMBAT_PLAYER_ID,
      targetEntityId: preview.targetEntityId,
      setByCaller: def.setByCaller,
    };

    player.applyGameplayEffect(spendActionPointsEffect(def.cost), {
      instigatorEntityId: COMBAT_PLAYER_ID,
      sourceEntityId: COMBAT_PLAYER_ID,
    });

    for (const binding of def.commitEffects ?? []) {
      const targetGfc =
        binding.target === 'self'
          ? player
          : preview.targetEntityId === COMBAT_PLAYER_ID
            ? player
            : enemy;
      targetGfc.applyGameplayEffect(binding.effect, geContext);
    }

    const mode = readCommitMode(def.setByCaller);
    if (mode === CommitMode.SettleTakeDamage) {
      const targetGfc =
        preview.targetEntityId === COMBAT_PLAYER_ID ? player : enemy;
      const amount = targetGfc.getAttribute(CombatAttributes.DamageToTake)?.currentValue ?? 0;
      const result = this.activateTakeDamage(targetGfc.entityId, geContext);
      this.emitCombatEvent('GameplayEvent.Combat.player.DealDamage', {
        sourceId: COMBAT_PLAYER_ID,
        targetId: preview.targetEntityId,
        amount,
        blocked: result.blocked,
        healthLost: result.healthLost,
      });
      this.emitCombatTrace({
        kind: 'combat.damage',
        sourceId: COMBAT_PLAYER_ID,
        targetId: preview.targetEntityId,
        amount,
        blocked: result.blocked,
      });
      this.log(`${def.name} dealt ${result.healthLost} damage (${result.blocked} blocked).`);
    } else if (mode === CommitMode.ApplyBlock) {
      const gain = player.getAttribute(CombatAttributes.BlockToGain)?.currentValue ?? 0;
      player.applyGameplayEffect(gainBlockFromPreviewEffect(), {
        instigatorEntityId: COMBAT_PLAYER_ID,
        sourceEntityId: COMBAT_PLAYER_ID,
      });
      this.log(`${def.name} gained ${gain} block.`);
    } else {
      this.log(`${def.name} played.`);
    }

    const handIndex = this.deck.hand.indexOf(preview.instanceId);
    player.endAbility(preview.abilityInstanceId);
    resetCombatMeta(player);
    resetCombatMeta(enemy);
    this.preview = undefined;

    if (handIndex >= 0) {
      discardFromHand(this.deck, handIndex);
    }

    this.emitCombatEvent('GameplayEvent.Combat.player.PlayACard', {
      entityId: COMBAT_PLAYER_ID,
      cardId: preview.actionId,
      cost: def.cost,
    });
    this.emitCombatTrace({
      kind: 'combat.play_card',
      entityId: COMBAT_PLAYER_ID,
      cardId: preview.actionId,
      cost: def.cost,
    });

    this.checkEndConditions();
  }

  private activateTakeDamage(
    entityId: string,
    ctx: GameplayEffectApplicationContext,
  ): { blocked: number; healthLost: number } {
    const gfc = this.engine.requireGfc(entityId);
    const takeHandle = this.takeDamageHandles.get(entityId);
    if (!takeHandle) {
      throw new CombatError(`TakeDamage ability not granted to ${entityId}`);
    }
    const activation = gfc.tryActivate(takeHandle, {
      instigatorEntityId: ctx.instigatorEntityId,
      sourceEntityId: ctx.sourceEntityId,
      targetEntityId: ctx.targetEntityId ?? entityId,
    });
    if (!activation.ok) {
      throw new CombatError(`TakeDamage failed: ${activation.reason}`);
    }
    return activation.activationData?.takeDamage ?? { blocked: 0, healthLost: 0 };
  }

  private resolvePreviewTarget(def: CardDefinition, requestedTarget: string): string {
    switch (def.targeting) {
      case 'single_enemy':
        return requestedTarget;
      case 'self':
      case 'none':
        return COMBAT_PLAYER_ID;
    }
  }

  private drawOpeningHand(actionIds: readonly CardActionId[]): string[] {
    this.deck.hand.length = 0;
    const drawn: string[] = [];

    for (const actionId of actionIds) {
      const pileIndex = this.deck.drawPile.findIndex(
        (instanceId) => this.instances.get(instanceId)?.actionId === actionId,
      );
      if (pileIndex < 0) {
        throw new CombatError(`Cannot arrange opening hand: ${actionId} not in draw pile`);
      }
      const [instanceId] = this.deck.drawPile.splice(pileIndex, 1);
      if (!instanceId) {
        throw new CombatError(`Cannot arrange opening hand: ${actionId} missing instance`);
      }
      this.deck.hand.push(instanceId);
      drawn.push(instanceId);
    }

    return drawn;
  }

  private endPlayerTurn(): void {
    if (this.phase !== 'PlayerTurn') {
      throw new CombatError('Cannot end turn outside player turn');
    }

    this.cancelCardPreview();
    discardHand(this.deck);
    this.emitCombatEvent('GameplayEvent.Combat.player.FinishTurn', {
      entityId: COMBAT_PLAYER_ID,
    });
    this.emitTurnEndTiming(COMBAT_PLAYER_ID);
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

    player.applyGameplayEffect(
      {
        id: 'ge.enemy.attack.feed',
        duration: { kind: 'Instant' },
        modifiers: [
          { attribute: CombatAttributes.DamageToTake, op: 'Override', magnitude: damage },
        ],
      },
      { instigatorEntityId: COMBAT_ENEMY_ID, sourceEntityId: COMBAT_ENEMY_ID },
    );

    const result = this.activateTakeDamage(COMBAT_PLAYER_ID, {
      instigatorEntityId: COMBAT_ENEMY_ID,
      sourceEntityId: COMBAT_ENEMY_ID,
      targetEntityId: COMBAT_PLAYER_ID,
    });
    resetCombatMeta(player);

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
    this.emitTurnEndTiming(COMBAT_ENEMY_ID);

    this.beginPlayerTurn();
  }

  private beginPlayerTurn(): void {
    const player = this.requirePlayer();
    player.setAttributeBase(CombatAttributes.Block, 0);
    player.setAttributeBase(CombatAttributes.ActionPoints, this.config.actionPointsPerTurn);

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

  private emitTurnEndTiming(entityId: string): void {
    emitTurnEndTimingEvent(this.engine, this.combatChannel, { entityId });
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

  private requirePlayer(): GameplayFrameworkComponent {
    return this.engine.requireGfc(COMBAT_PLAYER_ID);
  }

  private requireEnemy(): GameplayFrameworkComponent {
    return this.engine.requireGfc(COMBAT_ENEMY_ID);
  }
}
