import type { RuleEngine } from '@cardgame/core';
import {
  createBehaviorTreeRunState,
  createGameplayEvent,
  emitTurnEndTimingEvent,
  tickBehaviorTree,
  type BehaviorTreeAsset,
  type BehaviorTreeRunState,
} from '@cardgame/core';
import type { CharacterInstance } from '@cardgame/characters';
import type { GameplayFrameworkComponent } from '@cardgame/core';
import type { GameplayEffectApplicationContext } from '@cardgame/core';
import type { GameplayTag } from '@cardgame/core';
import type { TraceEntryInput } from '@cardgame/core';
import type { CardDefinition } from './card-definition.js';
import {
  computeAttributeBonusForEntity,
  loadAttributeBonusConfig,
  readPrimaryBlock,
  type AttributeBonusConfig,
} from './attribute-bonus.js';
import { CombatAttributes } from './combat-attributes.js';
import {
  getEntityActionPoints,
  getEntityBlock,
  getEntityHealth,
  getEntityMaxActionPoints,
  getEntityMaxHealth,
} from './combat-damage.js';
import {
  buildDeckInstances,
  discardFromHand,
  discardHand,
  drawCards,
} from './deck-state.js';
import { peekNextTaskNode } from './enemy-bt-peek.js';
import { EnemyCombatAi, type EnemyCardPreview } from './enemy-combat-ai.js';
import { CombatError } from './errors.js';
import { characterPrimariesToCombat } from './primary-stats.js';
import { registerCombatAbilityHandlers } from './register-combat-abilities.js';
import {
  clearCombatTransientState,
  isPlayerCombatReady,
  refreshPlayerForEncounter,
} from './combat-cleanup.js';
import {
  bootstrapCombatAttributes,
  DEFAULT_PLAYER_PRIMARIES,
  resetCombatMeta,
} from './combat-entity-bootstrap.js';
import { SetByCallerKeys } from './set-by-caller-keys.js';
import {
  COMBAT_ENEMY_ID,
  COMBAT_PLAYER_ID,
  DEFAULT_COMBAT_CONFIG,
  type CardId,
  type CardInstance,
  type CombatAction,
  type ActorSnapshot,
  type CombatPhase,
  type CombatResult,
  type CombatAttachOptions,
  type CombatEncounterEnd,
  type CombatSessionConfig,
  type CombatSessionTuneables,
  type CombatSnapshot,
  type CombatTurnOwner,
  type DamageBreakdown,
  type DeckState,
  type EnemyCombatSetup,
} from './types.js';

type PreviewState = EnemyCardPreview;

export class CombatSession {
  private phase: CombatPhase = 'Setup';
  private turnOwner: CombatTurnOwner = 'player';
  private result?: CombatResult;
  private readonly deck: DeckState;
  private readonly instances: Map<string, CardInstance>;
  private readonly enemyDeck: DeckState;
  private readonly enemyInstances: Map<string, CardInstance>;
  private readonly combatLog: string[] = [];
  private readonly combatChannel;
  private readonly enemyCharacter: CharacterInstance;
  private readonly enemyBehaviorTree: BehaviorTreeAsset;
  private readonly enemyBtState: BehaviorTreeRunState;
  private readonly enemyAi: EnemyCombatAi;
  private readonly cardDefinitions: Record<CardId, CardDefinition>;
  private readonly bonusConfig: AttributeBonusConfig;
  private preview?: PreviewState;
  private enemyPreview?: PreviewState;
  private readonly cardAbilityHandles = new Map<CardId, string>();
  private readonly enemyCardAbilityHandles = new Map<CardId, string>();
  private readonly takeDamageHandles = new Map<string, string>();

  private constructor(
    private readonly engine: RuleEngine,
    private readonly config: CombatSessionConfig,
    deck: DeckState,
    instances: Map<string, CardInstance>,
    enemyDeck: DeckState,
    enemyInstances: Map<string, CardInstance>,
    cardDefinitions: Record<CardId, CardDefinition>,
    enemy: EnemyCombatSetup,
  ) {
    this.deck = deck;
    this.instances = instances;
    this.enemyDeck = enemyDeck;
    this.enemyInstances = enemyInstances;
    this.cardDefinitions = cardDefinitions;
    this.bonusConfig = loadAttributeBonusConfig();
    this.combatChannel = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));
    this.enemyCharacter = enemy.character;
    this.enemyBehaviorTree = enemy.behaviorTree;
    this.enemyBtState = createBehaviorTreeRunState();
    this.enemyAi = new EnemyCombatAi({
      getEnemy: () => this.requireEnemy(),
      getPlayer: () => this.requirePlayer(),
      getCardDefinition: (id) => this.getCardDefinition(id),
      cardDefinitions: this.cardDefinitions,
      enemyDeck: this.enemyDeck,
      enemyInstances: this.enemyInstances,
      enemyCardAbilityHandles: this.enemyCardAbilityHandles,
      enemyCharacter: this.enemyCharacter,
      bonusConfig: this.bonusConfig,
      hasPlayerPreview: () => this.preview !== undefined,
      getEnemyPreview: () => this.enemyPreview,
      setEnemyPreview: (preview) => {
        this.enemyPreview = preview;
      },
      emitCombatEvent: (tagName, payload) => this.emitCombatEvent(tagName, payload),
    });
  }

  /** Tear down prior combat entities so the shared RuleEngine can host another battle. */
  static clearCombatEntities(engine: RuleEngine): void {
    for (const entityId of [COMBAT_PLAYER_ID, COMBAT_ENEMY_ID]) {
      engine.getGfc(entityId)?.dispose();
      engine.gameWorld.destroyEntity(entityId);
    }
  }

  static clearEnemyEntity(engine: RuleEngine): void {
    engine.getGfc(COMBAT_ENEMY_ID)?.dispose();
    engine.gameWorld.destroyEntity(COMBAT_ENEMY_ID);
  }

  /**
   * Fresh battle: destroys player + enemy, then bootstraps both.
   * Prefer `attach({ reusePlayer: true })` for adventure multi-fight.
   */
  static bootstrap(
    engine: RuleEngine,
    config: Partial<CombatSessionTuneables> &
      Pick<CombatSessionConfig, 'cardCatalog' | 'deckIds' | 'takeDamageAbility' | 'enemy'>,
  ): CombatSession {
    return CombatSession.attach(engine, config, { reusePlayer: false });
  }

  /**
   * Start an encounter on a shared RuleEngine.
   * `reusePlayer: true` keeps COMBAT_PLAYER_ID / Health; only respawns the enemy.
   */
  static attach(
    engine: RuleEngine,
    config: Partial<CombatSessionTuneables> &
      Pick<CombatSessionConfig, 'cardCatalog' | 'deckIds' | 'takeDamageAbility' | 'enemy'>,
    options: CombatAttachOptions = {},
  ): CombatSession {
    const merged = { ...DEFAULT_COMBAT_CONFIG, ...config };
    if (!merged.cardCatalog || !merged.deckIds || !merged.enemy) {
      throw new CombatError(
        'CombatSession.attach requires cardCatalog, deckIds, and enemy (spawn via spawnEnemyFromRepo)',
      );
    }

    const reusePlayer = options.reusePlayer === true;
    if (reusePlayer) {
      const player = engine.getGfc(COMBAT_PLAYER_ID);
      if (!player || !isPlayerCombatReady(player)) {
        throw new CombatError(
          'attach(reusePlayer) requires an existing combat-ready player GFC on COMBAT_PLAYER_ID',
        );
      }
      CombatSession.clearEnemyEntity(engine);
    } else {
      CombatSession.clearCombatEntities(engine);
    }

    const registration = registerCombatAbilityHandlers(engine.activationRegistry);
    const cardDefinitions = merged.cardCatalog;
    const { deck, instances } = buildDeckInstances(merged.deckIds);
    const { deck: enemyDeck, instances: enemyInstances } = buildDeckInstances(
      merged.enemy.character.deckIds,
      { idPrefix: 'enemy-' },
    );
    const session = new CombatSession(
      engine,
      merged,
      deck,
      instances,
      enemyDeck,
      enemyInstances,
      cardDefinitions,
      merged.enemy,
    );
    session.wireCardPlayBridge(registration);
    session.runSetup({ reusePlayer });
    return session;
  }

  /**
   * End the encounter: cleanup player combat state, destroy enemy, keep player GFC.
   * Host should call after Victory/Defeat (or force-end).
   */
  detach(): CombatEncounterEnd {
    if (this.preview || this.enemyPreview) {
      this.cancelCardPreview();
    }

    const player = this.requirePlayer();
    const playerHealth = getEntityHealth(player);
    const result = this.result ?? 'defeat';

    for (const handle of this.cardAbilityHandles.values()) {
      player.revokeAbility(handle);
    }
    this.cardAbilityHandles.clear();

    clearCombatTransientState(player);
    CombatSession.clearEnemyEntity(this.engine);

    return { result, playerHealth };
  }

  getEnemyCharacterInstance(): CharacterInstance {
    return this.enemyCharacter;
  }

  private wireCardPlayBridge(
    registration: ReturnType<typeof registerCombatAbilityHandlers>,
  ): void {
    registration.setBridge({
      matchesPreview: ({ abilityInstanceId, cardInstanceId }) => {
        if (this.preview) {
          if (this.preview.abilityInstanceId !== abilityInstanceId) {
            return false;
          }
          if (cardInstanceId !== undefined && cardInstanceId !== this.preview.instanceId) {
            return false;
          }
          return true;
        }
        if (this.enemyPreview) {
          if (this.enemyPreview.abilityInstanceId !== abilityInstanceId) {
            return false;
          }
          if (cardInstanceId !== undefined && cardInstanceId !== this.enemyPreview.instanceId) {
            return false;
          }
          return true;
        }
        return false;
      },
      cancelPreview: () => this.cancelCardPreview(),
      settleTakeDamage: (targetEntityId) => {
        const target = this.engine.requireGfc(targetEntityId);
        const amount = target.getAttribute(CombatAttributes.DamageToTake)?.currentValue ?? 0;
        const sourceId = this.enemyPreview ? COMBAT_ENEMY_ID : COMBAT_PLAYER_ID;
        const result = this.activateTakeDamage(targetEntityId, {
          instigatorEntityId: sourceId,
          sourceEntityId: sourceId,
          targetEntityId,
        });
        this.emitCombatEvent('GameplayEvent.Combat.player.DealDamage', {
          sourceId: this.enemyPreview ? COMBAT_ENEMY_ID : COMBAT_PLAYER_ID,
          targetId: targetEntityId,
          amount,
          blocked: result.blocked,
          healthLost: result.healthLost,
        });
        this.emitCombatTrace({
          kind: 'combat.damage',
          sourceId: this.enemyPreview ? COMBAT_ENEMY_ID : COMBAT_PLAYER_ID,
          targetId: targetEntityId,
          amount,
          blocked: result.blocked,
        });
        return result;
      },
      resetMeta: () => {
        resetCombatMeta(this.requirePlayer());
        const enemy = this.engine.getGfc(COMBAT_ENEMY_ID);
        if (enemy) {
          resetCombatMeta(enemy);
        }
      },
      completePlay: (args) => {
        if (this.enemyPreview?.abilityInstanceId === args.abilityInstanceId) {
          this.completeEnemyCardPlayFromHook(args);
          return;
        }
        this.completeCardPlayFromHook(args);
      },
    });
  }

  getCardDefinition(actionId: CardId): CardDefinition {
    const def = this.cardDefinitions[actionId];
    if (!def) {
      throw new CombatError(`Unknown card: ${actionId}`);
    }
    return def;
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

    const def = this.getCardDefinition(instance.actionId);
    const player = this.requirePlayer();
    const handle = this.cardAbilityHandles.get(instance.actionId);
    if (!handle) {
      throw new CombatError(`No ability granted for card ${instance.actionId}`);
    }

    const targetId = this.resolvePreviewTarget(def, targetEntityId);

    const setByCaller: Record<string, number> = {};
    if (def.attributeBonus) {
      setByCaller[SetByCallerKeys.AttributeBonus] = computeAttributeBonusForEntity(
        def.attributeBonus,
        player,
        this.bonusConfig,
      );
    }

    const result = player.tryActivate(handle, {
      instigatorEntityId: COMBAT_PLAYER_ID,
      sourceEntityId: COMBAT_PLAYER_ID,
      targetEntityId: targetId,
      parameters: def.ability.parameterValues,
      payload: { cardInstanceId: instanceId, actionId: instance.actionId, cost: def.cost },
      setByCaller: Object.keys(setByCaller).length > 0 ? setByCaller : undefined,
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
    if (this.preview) {
      const player = this.requirePlayer();
      const enemy = this.requireEnemy();
      player.endAbility(this.preview.abilityInstanceId);
      resetCombatMeta(player);
      resetCombatMeta(enemy);
      this.preview = undefined;
    }
    if (this.enemyPreview) {
      const enemy = this.requireEnemy();
      const player = this.requirePlayer();
      enemy.endAbility(this.enemyPreview.abilityInstanceId);
      resetCombatMeta(enemy);
      resetCombatMeta(player);
      this.enemyPreview = undefined;
    }
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
      const def = this.getCardDefinition(instance.actionId);
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
        const def = this.getCardDefinition(instance.actionId);
        return {
          instanceId,
          actionId: instance.actionId,
          name: def.name,
          cost: def.cost,
        };
      })
      .filter((card): card is NonNullable<typeof card> => card !== undefined);

    const nextTask = peekNextTaskNode(
      this.enemyBehaviorTree.root,
      this.enemyBtState,
      this.enemyAi.createPeekContext(enemy, player),
    );
    const intentLabel = this.enemyAi.buildIntentLabel(nextTask, enemy, player);

    let preview: CombatSnapshot['preview'];
    if (this.preview) {
      const def = this.getCardDefinition(this.preview.actionId);
      const target =
        this.preview.targetEntityId === COMBAT_PLAYER_ID ? player : this.requireEnemy();
      const panelDamage =
        typeof def.ability.parameterValues?.Damage === 'number'
          ? def.ability.parameterValues.Damage
          : 0;
      const bonus = computeAttributeBonusForEntity(
        def.attributeBonus,
        player,
        this.bonusConfig,
      );
      const scaling =
        player.getAttribute(CombatAttributes.DamageScaling)?.currentValue ?? 1;
      const multiplier =
        player.getAttribute(CombatAttributes.DamageMultiplier)?.currentValue ?? 1;
      const offset = player.getAttribute(CombatAttributes.DamageOffset)?.currentValue ?? 0;
      const outgoing = player.getAttribute(CombatAttributes.Damage)?.currentValue ?? 0;
      const damageBreakdown: DamageBreakdown | undefined =
        panelDamage > 0 || bonus !== 0 || outgoing > 0
          ? {
              panel: panelDamage,
              bonus,
              scaling,
              multiplier,
              offset,
              outgoing,
            }
          : undefined;

      preview = {
        handIndex: this.preview.handIndex,
        instanceId: this.preview.instanceId,
        actionId: this.preview.actionId,
        targetEntityId: this.preview.targetEntityId,
        damage: outgoing,
        damageToTake: target.getAttribute(CombatAttributes.DamageToTake)?.currentValue,
        blockToGain: player.getAttribute(CombatAttributes.BlockToGain)?.currentValue,
        damageBreakdown,
      };
    }

    return {
      phase: this.phase,
      turnOwner: this.turnOwner,
      player: this.buildActorSnapshot(COMBAT_PLAYER_ID, player, 'Player', true),
      enemies: [
        this.buildActorSnapshot(
          COMBAT_ENEMY_ID,
          enemy,
          this.enemyCharacter.displayName,
          false,
        ),
      ],
      hand,
      enemyIntent: {
        entityId: COMBAT_ENEMY_ID,
        label: intentLabel,
      },
      combatLog: [...this.combatLog],
      result: this.result,
      preview,
    };
  }

  hasCardPreview(): boolean {
    return this.preview !== undefined;
  }

  private runSetup(options: { reusePlayer?: boolean } = {}): void {
    const reusePlayer = options.reusePlayer === true;
    this.emitCombatTrace({ kind: 'combat.phase', before: 'Setup', after: 'Setup' });

    if (!reusePlayer) {
      this.engine.createEntityWithGfc(COMBAT_PLAYER_ID);
    }
    this.engine.createEntityWithGfc(COMBAT_ENEMY_ID);

    const player = this.requirePlayer();
    const enemy = this.requireEnemy();
    const enemyPrimaries = characterPrimariesToCombat(this.enemyCharacter.primaries);

    if (reusePlayer) {
      this.revokePlayerCardAbilities(player);
      this.takeDamageHandles.set(
        COMBAT_PLAYER_ID,
        refreshPlayerForEncounter(player, {
          actionPointsPerTurn: this.config.actionPointsPerTurn,
          takeDamageAbility: this.config.takeDamageAbility,
        }),
      );
    } else {
      this.takeDamageHandles.set(
        COMBAT_PLAYER_ID,
        bootstrapCombatAttributes(
          player,
          {
            health: this.config.playerStartHealth,
            block: 0,
            maxActionPoints: this.config.actionPointsPerTurn,
            actionPoints: this.config.actionPointsPerTurn,
            primaries: DEFAULT_PLAYER_PRIMARIES,
            takeDamageAbility: this.config.takeDamageAbility,
          },
          this.engine.tagManager,
        ),
      );
    }

    this.takeDamageHandles.set(
      COMBAT_ENEMY_ID,
      bootstrapCombatAttributes(
        enemy,
        {
          health: this.config.enemyHealthOverride ?? this.enemyCharacter.maxHealth,
          block: 0,
          maxActionPoints: this.enemyCharacter.maxActionPoints,
          actionPoints: this.enemyCharacter.maxActionPoints,
          primaries: enemyPrimaries,
          takeDamageAbility: this.config.takeDamageAbility,
        },
        this.engine.tagManager,
      ),
    );

    for (const def of Object.values(this.cardDefinitions)) {
      this.cardAbilityHandles.set(def.id, player.grantAbility(def.ability));
      this.enemyCardAbilityHandles.set(def.id, enemy.grantAbility(def.ability));
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

    const enemyDrawn = drawCards(this.enemyDeck, this.config.enemyOpeningDraw);
    for (const instanceId of enemyDrawn) {
      const instance = this.enemyInstances.get(instanceId);
      if (instance) {
        this.emitDrawEvent(COMBAT_ENEMY_ID, instance.actionId);
      }
    }

    if (this.config.enemyStartHealth !== undefined) {
      enemy.setAttributeBase(CombatAttributes.Health, this.config.enemyStartHealth);
    }

    this.setPhase('PlayerTurn', 'player');
    this.log(`Battle begins vs ${this.enemyCharacter.displayName}. Drew ${drawn.length} cards.`);
    this.emitCombatTrace({ kind: 'combat.turn', owner: 'player', phase: 'PlayerTurn' });
  }

  private revokePlayerCardAbilities(player: GameplayFrameworkComponent): void {
    const abilityIds = new Set(
      Object.values(this.cardDefinitions).map((def) => def.ability.id),
    );
    for (const granted of player.listGrantedAbilities()) {
      if (abilityIds.has(granted.abilityDefId)) {
        player.revokeAbility(granted.handle);
      }
    }
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

    const def = this.getCardDefinition(instance.actionId);
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

  /** Session bridge: discard / log / events after hook commitAbility + settle. */
  private completeCardPlayFromHook(args: {
    abilityInstanceId: string;
    actionId: string;
    cardInstanceId: string;
    cost: number;
    logMessage: string;
  }): void {
    const preview = this.preview;
    if (!preview || preview.abilityInstanceId !== args.abilityInstanceId) {
      return;
    }

    const player = this.requirePlayer();
    const enemy = this.requireEnemy();
    const handIndex = this.deck.hand.indexOf(preview.instanceId);

    resetCombatMeta(player);
    resetCombatMeta(enemy);
    this.preview = undefined;

    if (handIndex >= 0) {
      discardFromHand(this.deck, handIndex);
    }

    this.log(args.logMessage);
    this.emitCombatEvent('GameplayEvent.Combat.player.PlayACard', {
      entityId: COMBAT_PLAYER_ID,
      cardId: args.actionId,
      cost: args.cost,
    });
    this.emitCombatTrace({
      kind: 'combat.play_card',
      entityId: COMBAT_PLAYER_ID,
      cardId: args.actionId,
      cost: args.cost,
    });

    this.checkEndConditions();
  }

  private completeEnemyCardPlayFromHook(args: {
    abilityInstanceId: string;
    actionId: string;
    cardInstanceId: string;
    cost: number;
    logMessage: string;
  }): void {
    const preview = this.enemyPreview;
    if (!preview || preview.abilityInstanceId !== args.abilityInstanceId) {
      return;
    }

    const player = this.requirePlayer();
    const enemy = this.requireEnemy();
    const handIndex = this.enemyDeck.hand.indexOf(preview.instanceId);

    resetCombatMeta(player);
    resetCombatMeta(enemy);
    this.enemyPreview = undefined;

    if (handIndex >= 0) {
      discardFromHand(this.enemyDeck, handIndex);
    }

    this.log(`${this.enemyCharacter.displayName}: ${this.getCardDefinition(args.actionId).name} played.`);
    this.emitCombatEvent('GameplayEvent.Combat.player.PlayACard', {
      entityId: COMBAT_ENEMY_ID,
      cardId: args.actionId,
      cost: args.cost,
    });
    this.emitCombatTrace({
      kind: 'combat.play_card',
      entityId: COMBAT_ENEMY_ID,
      cardId: args.actionId,
      cost: args.cost,
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

  private drawOpeningHand(actionIds: readonly CardId[]): string[] {
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

    const enemy = this.requireEnemy();
    const player = this.requirePlayer();
    enemy.setAttributeBase(CombatAttributes.Block, 0);

    this.enemyAi.syncBlackboard(enemy, player);

    const btCtx = {
      blackboard: this.enemyAi.blackboard,
      tasks: this.enemyAi.taskRegistry,
    };
    tickBehaviorTree(this.enemyBehaviorTree.root, btCtx, this.enemyBtState, { leafBudget: 1 });

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

  /** Discard leftover hand, refill AP, draw — runs at player turn start so Intent matches execution. */
  private prepareEnemyForUpcomingTurn(): void {
    const enemy = this.requireEnemy();
    discardHand(this.enemyDeck);

    const maxAp =
      enemy.getAttribute(CombatAttributes.MaxActionPoints)?.currentValue ??
      this.enemyCharacter.maxActionPoints;
    enemy.setAttributeBase(CombatAttributes.ActionPoints, maxAp);

    if (this.config.enemyTurnDraw <= 0) {
      return;
    }

    const drawn = drawCards(this.enemyDeck, this.config.enemyTurnDraw);
    for (const instanceId of drawn) {
      const instance = this.enemyInstances.get(instanceId);
      if (instance) {
        this.emitDrawEvent(COMBAT_ENEMY_ID, instance.actionId);
      }
    }
  }

  private beginPlayerTurn(): void {
    const player = this.requirePlayer();
    player.setAttributeBase(CombatAttributes.Block, 0);
    const maxAp =
      player.getAttribute(CombatAttributes.MaxActionPoints)?.currentValue ??
      this.config.actionPointsPerTurn;
    player.setAttributeBase(CombatAttributes.ActionPoints, maxAp);

    const drawn = drawCards(this.deck, this.config.turnDraw);
    for (const instanceId of drawn) {
      const instance = this.instances.get(instanceId);
      if (instance) {
        this.emitDrawEvent(COMBAT_PLAYER_ID, instance.actionId);
      }
    }

    this.prepareEnemyForUpcomingTurn();

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
      handSize:
        entityId === COMBAT_ENEMY_ID ? this.enemyDeck.hand.length : this.deck.hand.length,
    });
    this.emitCombatTrace({
      kind: 'combat.draw',
      entityId,
      cardId,
      handSize:
        entityId === COMBAT_ENEMY_ID ? this.enemyDeck.hand.length : this.deck.hand.length,
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

  private buildActorSnapshot(
    entityId: string,
    gfc: GameplayFrameworkComponent,
    name: string,
    includeAp: boolean,
  ): ActorSnapshot {
    return {
      entityId,
      name,
      health: getEntityHealth(gfc),
      maxHealth: getEntityMaxHealth(gfc),
      block: getEntityBlock(gfc),
      actionPoints: includeAp ? getEntityActionPoints(gfc) : undefined,
      maxActionPoints: includeAp ? getEntityMaxActionPoints(gfc) : undefined,
      primaries: readPrimaryBlock(gfc),
      damageScaling: gfc.getAttribute(CombatAttributes.DamageScaling)?.currentValue,
      damageMultiplier: gfc.getAttribute(CombatAttributes.DamageMultiplier)?.currentValue,
      damageOffset: gfc.getAttribute(CombatAttributes.DamageOffset)?.currentValue,
    };
  }
}
