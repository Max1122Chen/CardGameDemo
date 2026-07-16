import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEventSystem, GameplayEventSubscribeOptions } from '../events/gameplay-event-system.js';
import type { GameplayEvent } from '../events/gameplay-event.js';
import { GameplayAbilityRuntime } from '../ga/gameplay-ability-runtime.js';
import type {
  AbilityActivationContext,
  ActivationResult,
  GameplayAbilityDefinition,
} from '../ga/types.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { TraceEntryInput, TraceSink } from '../trace/trace.js';
import type { AbilityActivationRegistry } from '../ga/ability-activation-registry.js';
import type {
  ActiveGameplayEffect,
  AttributeChangeCallback,
  AttributeEvaluationPipeline,
  AttributeValue,
  GameplayEffectApplicationContext,
  GameplayEffectDefinition,
  GameplayEffectDuration,
  GameplayModifierOp,
  GfcSnapshot,
} from './types.js';
import { GameplayEffectError, GameplayNotImplementedError } from './errors.js';
import {
  evaluateOngoingTagRequirements,
  resolveOngoingEntityId,
} from './ongoing-tag-requirements.js';
import {
  assignModifierStages,
  evaluateFlatAttributeValue,
  evaluateStagedAttributeValue,
  modifierRequiresEntity,
  normalizeModifierMagnitude,
  resolveModifierMagnitude,
  type StagedResolvedModifier,
} from './attribute-evaluation.js';

export type GameplayFrameworkComponentOptions = {
  entityId: EntityId;
  tagManager: GameplayTagManager;
  eventSystem: GameplayEventSystem;
  sink?: TraceSink;
  getGfc?: (entityId: EntityId) => GameplayFrameworkComponent | undefined;
  activationRegistry?: AbilityActivationRegistry;
  /** Notifies when any entity's tags change (for cross-entity ongoing GE gates). */
  onEntityTagChange?: (entityId: EntityId) => void;
};

let nextEffectHandle = 0;

export class GameplayFrameworkComponent {
  readonly entityId: EntityId;

  private readonly tagManager: GameplayTagManager;
  private readonly eventSystem: GameplayEventSystem;
  private readonly sink?: TraceSink;
  private readonly tags: GameplayTagContainer;
  private readonly manualListenerIds: string[] = [];
  private readonly passiveListenerIds: string[] = [];
  private readonly abilityRuntime: GameplayAbilityRuntime;
  private readonly resolveGfc: (entityId: EntityId) => GameplayFrameworkComponent | undefined;
  private readonly onEntityTagChange?: (entityId: EntityId) => void;
  private readonly attributeSets = new Map<string, unknown>();
  private readonly attributes = new Map<string, AttributeValue>();
  private readonly evaluationPipelines = new Map<string, readonly GameplayTag[]>();
  private readonly activeEffects = new Map<string, ActiveGameplayEffect>();
  private readonly channelSubscriptions = new Map<
    number,
    { channel: GameplayEventChannel; listenerId: string; refCount: number }
  >();
  private readonly preAttributeChangeCallbacks: AttributeChangeCallback[] = [];
  private readonly postAttributeChangeCallbacks: AttributeChangeCallback[] = [];
  private nextApplicationOrder = 0;
  private disposed = false;

  constructor(options: GameplayFrameworkComponentOptions) {
    this.entityId = options.entityId;
    this.tagManager = options.tagManager;
    this.eventSystem = options.eventSystem;
    this.sink = options.sink;
    this.tags = new GameplayTagContainer({
      manager: options.tagManager,
      entityId: options.entityId,
      sink: options.sink,
    });
    this.resolveGfc = options.getGfc ?? (() => undefined);
    this.onEntityTagChange = options.onEntityTagChange;
    this.abilityRuntime = new GameplayAbilityRuntime({
      entityId: this.entityId,
      tagManager: this.tagManager,
      getOwnerTags: () => this.tags,
      getAttribute: (attribute) => {
        const value = this.attributes.get(attribute);
        return value ? { ...value } : undefined;
      },
      applyGameplayEffectTo: (entityId, effect, geContext) => {
        const gfc = this.resolveGfc(entityId);
        if (!gfc) {
          throw new Error(`GameplayFrameworkComponent not found: ${entityId}`);
        }
        return gfc.applyGameplayEffect(effect, geContext);
      },
      resolveEntityTags: (entityId) => this.resolveGfc(entityId)?.getTagContainer(),
      subscribeAbilityEvent: (channel, listenerId, handler) => {
        this.eventSystem.subscribe({ channel, listenerId, handler });
        this.passiveListenerIds.push(listenerId);
      },
      unsubscribeAbilityEvent: (listenerId) => {
        this.eventSystem.unsubscribe(listenerId);
        const index = this.passiveListenerIds.indexOf(listenerId);
        if (index >= 0) {
          this.passiveListenerIds.splice(index, 1);
        }
      },
      activationRegistry: options.activationRegistry,
      emitTrace: (entry) => {
        this.sink?.emit(entry);
      },
    });
  }

  addTag(tag: GameplayTag, count = 1): void {
    this.assertActive();
    this.tags.add(tag, count);
    this.notifyTagChange();
  }

  removeTag(tag: GameplayTag, count = 1): void {
    this.assertActive();
    this.tags.remove(tag, count);
    this.notifyTagChange();
  }

  hasTag(query: GameplayTag): boolean {
    this.assertActive();
    return this.tags.has(query);
  }

  getTagContainer(): GameplayTagContainer {
    this.assertActive();
    return this.tags;
  }

  dispatch(channel: GameplayEventChannel, event: GameplayEvent): void;
  dispatch(event: GameplayEvent): void;
  dispatch(channelOrEvent: GameplayEventChannel | GameplayEvent, maybeEvent?: GameplayEvent): void {
    this.assertActive();

    if (maybeEvent === undefined) {
      this.eventSystem.dispatch(channelOrEvent as GameplayEvent);
      return;
    }

    this.eventSystem.dispatch(channelOrEvent as GameplayEventChannel, maybeEvent);
  }

  subscribe(
    options: Omit<GameplayEventSubscribeOptions, 'channel'> & { channel?: GameplayEventChannel },
  ): string {
    this.assertActive();

    const channel = options.channel ?? this.eventSystem.defaultChannel;
    const listenerId = this.eventSystem.subscribe({
      ...options,
      channel,
    });
    this.manualListenerIds.push(listenerId);
    return listenerId;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const listenerId of this.manualListenerIds) {
      this.eventSystem.unsubscribe(listenerId);
    }

    for (const subscription of this.channelSubscriptions.values()) {
      this.eventSystem.unsubscribe(subscription.listenerId);
    }

    this.abilityRuntime.dispose();

    this.manualListenerIds.length = 0;
    this.passiveListenerIds.length = 0;
    this.channelSubscriptions.clear();
    this.activeEffects.clear();
    this.disposed = true;
  }

  registerAttributeSet(id: string, set: unknown): void {
    this.assertActive();
    this.attributeSets.set(id, set);
  }

  getAttribute(attribute: string): AttributeValue | undefined {
    this.assertActive();
    const value = this.attributes.get(attribute);
    return value ? { ...value } : undefined;
  }

  setAttributeBase(attribute: string, value: number): void {
    this.assertActive();
    this.assertAttributeKey(attribute);
    this.assertFiniteNumber(value, `attribute base value for ${attribute}`);

    const state = this.ensureAttribute(attribute);
    state.baseValue = value;
    this.emitTrace('attribute.base.set', {
      attribute,
      after: value,
    });
    const dependents = this.collectDependentAttributes(this.entityId, attribute);
    this.recomputeAttributes([attribute, ...dependents]);
  }

  applyGameplayEffect(
    effect: GameplayEffectDefinition,
    context?: GameplayEffectApplicationContext,
  ): string {
    this.assertActive();
    this.validateEffect(effect);

    const applicationContext = this.resolveApplicationContext(context);
    this.validateApplicationContextForEffect(effect, applicationContext);
    this.warnUnknownStagesForEffect(effect);

    const effectId = `effect-${nextEffectHandle++}`;
    this.emitTrace('ge.applied', {
      effectId,
      effectDefId: effect.id,
      durationKind: effect.duration.kind,
    });
    this.emitTrace('ge.ctx', {
      effectDefId: effect.id,
      instigatorId: applicationContext.instigatorEntityId,
      sourceId: applicationContext.sourceEntityId,
      targetId: applicationContext.targetEntityId,
    });

    if (effect.duration.kind === 'Instant') {
      this.applyInstantEffect(effect, applicationContext);
      return effectId;
    }

    const stacking = effect.stacking ?? { kind: 'none' };
    if (stacking.kind === 'byEffectId') {
      const existing = this.findActiveEffectByDefId(effect.id);
      if (existing) {
        return this.reapplyStackedEffect(existing, effect, stacking, applicationContext);
      }
    }

    const ongoingContributing = this.evaluateOngoingContributing(effect, applicationContext);

    const activeEffect: ActiveGameplayEffect = {
      id: effectId,
      definition: effect,
      applicationOrder: this.nextApplicationOrder++,
      applicationContext,
      durationProgress: effect.duration.kind === 'Duration' ? 0 : undefined,
      stackedDurationMagnitude:
        effect.duration.kind === 'Duration' ? effect.duration.magnitude : undefined,
      ongoingContributing,
      durationChannels: this.resolveDurationChannels(effect.duration),
    };

    this.activeEffects.set(effectId, activeEffect);
    if (ongoingContributing) {
      this.applyGrantedTags(effect.grantedTags);
    }

    if (effect.duration.kind === 'Duration') {
      this.addDurationSubscriptions(activeEffect);
    }

    this.recomputeAttributes(this.collectModifiedAttributes(effect));
    return effectId;
  }

  /** Re-evaluate ongoing gates when tags change on a related entity. */
  refreshOngoingForTagChange(changedEntityId: EntityId): void {
    this.assertActive();

    let touched = false;
    for (const activeEffect of this.getOrderedActiveEffects()) {
      if (!activeEffect.definition.ongoingTagRequirements) {
        continue;
      }

      const context = activeEffect.applicationContext;
      const sourceId = resolveOngoingEntityId('source', context, this.entityId);
      const targetId = resolveOngoingEntityId('target', context, this.entityId);
      if (
        changedEntityId !== this.entityId &&
        changedEntityId !== sourceId &&
        changedEntityId !== targetId
      ) {
        continue;
      }

      if (this.updateEffectOngoingState(activeEffect)) {
        touched = true;
      }
    }

    if (touched) {
      this.recomputeAttributes(this.collectAllModifiedAttributesFromActiveEffects());
    }
  }

  removeGameplayEffect(effectId: string): boolean {
    this.assertActive();
    const effect = this.activeEffects.get(effectId);
    if (!effect) {
      return false;
    }

    this.activeEffects.delete(effectId);
    if (effect.ongoingContributing) {
      this.removeGrantedTags(effect.definition.grantedTags);
    }

    if (effect.definition.duration.kind === 'Duration') {
      this.removeDurationSubscriptions(effect);
    }

    this.emitTrace('ge.removed', {
      effectId,
      effectDefId: effect.definition.id,
      durationKind: effect.definition.duration.kind,
    });
    this.recomputeAttributes(this.collectModifiedAttributes(effect.definition));
    return true;
  }

  listActiveEffects(): readonly ActiveGameplayEffect[] {
    this.assertActive();
    return this.getOrderedActiveEffects().map((effect) => ({
      ...effect,
      definition: {
        ...effect.definition,
        modifiers: [...effect.definition.modifiers],
        grantedTags: effect.definition.grantedTags ? [...effect.definition.grantedTags] : undefined,
        ongoingTagRequirements: effect.definition.ongoingTagRequirements
          ? { ...effect.definition.ongoingTagRequirements }
          : undefined,
        stacking: effect.definition.stacking ? { ...effect.definition.stacking } : undefined,
      },
      durationChannels: [...effect.durationChannels],
    }));
  }

  grantAbility(definition: GameplayAbilityDefinition): string {
    this.assertActive();
    return this.abilityRuntime.grantAbility(definition);
  }

  revokeAbility(handle: string): boolean {
    this.assertActive();
    return this.abilityRuntime.revokeAbility(handle);
  }

  canActivate(handle: string, ctx: AbilityActivationContext): boolean {
    this.assertActive();
    return this.abilityRuntime.canActivate(handle, ctx);
  }

  tryActivate(handle: string, ctx: AbilityActivationContext): ActivationResult {
    this.assertActive();
    return this.abilityRuntime.tryActivate(handle, ctx);
  }

  endAbility(instanceId: string): boolean {
    this.assertActive();
    return this.abilityRuntime.endAbility(instanceId);
  }

  listGrantedAbilities() {
    this.assertActive();
    return this.abilityRuntime.listGrantedAbilities();
  }

  listActiveAbilities() {
    this.assertActive();
    return this.abilityRuntime.listActiveAbilities();
  }

  clearEvaluationPipeline(attribute: string): void {
    this.assertActive();
    this.assertAttributeKey(attribute);
    if (!this.evaluationPipelines.delete(attribute)) {
      return;
    }
    this.recomputeAttributes([attribute]);
  }

  bindEvaluationPipeline(pipeline: AttributeEvaluationPipeline): void {
    this.assertActive();
    this.assertAttributeKey(pipeline.attribute);
    this.evaluationPipelines.set(pipeline.attribute, [...pipeline.stageOrder]);
    this.recomputeAttributes([pipeline.attribute]);
  }

  getEvaluationPipeline(attribute: string): AttributeEvaluationPipeline | undefined {
    this.assertActive();
    const stageOrder = this.evaluationPipelines.get(attribute);
    if (!stageOrder) {
      return undefined;
    }
    return { attribute, stageOrder };
  }

  onPreAttributeChange(callback: AttributeChangeCallback): () => void {
    this.assertActive();
    this.preAttributeChangeCallbacks.push(callback);
    return () => {
      const index = this.preAttributeChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.preAttributeChangeCallbacks.splice(index, 1);
      }
    };
  }

  onPostAttributeChange(callback: AttributeChangeCallback): () => void {
    this.assertActive();
    this.postAttributeChangeCallbacks.push(callback);
    return () => {
      const index = this.postAttributeChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.postAttributeChangeCallbacks.splice(index, 1);
      }
    };
  }

  toJSON(): GfcSnapshot {
    this.assertActive();
    return {
      entityId: this.entityId,
      tags: this.tags.toArray().map((entry) => ({
        name: entry.tag.name,
        count: entry.count,
      })),
      attributes: [...this.attributes.entries()].map(([attribute, value]) => ({
        attribute,
        baseValue: value.baseValue,
        currentValue: value.currentValue,
      })),
      activeEffects: this.getOrderedActiveEffects().map((effect) => ({
        id: effect.id,
        definitionId: effect.definition.id,
        durationKind: effect.definition.duration.kind,
        durationProgress: effect.durationProgress,
        durationTarget:
          effect.definition.duration.kind === 'Duration'
            ? this.getEffectiveDurationMagnitude(effect)
            : undefined,
        durationChannels: effect.durationChannels.map((channel) => channel.name),
        ongoingContributing: effect.ongoingContributing,
        stackedDurationMagnitude: effect.stackedDurationMagnitude,
      })),
      grantedAbilities: this.abilityRuntime.listGrantedAbilities(),
      activeAbilities: this.abilityRuntime.listActiveAbilities(),
    };
  }

  private collectDependentAttributes(
    sourceEntityId: EntityId,
    sourceAttribute: string,
  ): string[] {
    const dependents = new Set<string>();

    for (const effect of this.activeEffects.values()) {
      for (const modifier of effect.definition.modifiers) {
        const normalized = normalizeModifierMagnitude(modifier.magnitude);
        if (normalized.kind !== 'AttributeBased' || normalized.attribute !== sourceAttribute) {
          continue;
        }

        const ctxEntityId =
          normalized.captureFrom === 'Source'
            ? effect.applicationContext.sourceEntityId
            : effect.applicationContext.targetEntityId;
        if (ctxEntityId === sourceEntityId) {
          dependents.add(modifier.attribute);
        }
      }
    }

    return [...dependents];
  }

  private applyInstantEffect(
    effect: GameplayEffectDefinition,
    applicationContext: GameplayEffectApplicationContext,
  ): void {
    if (effect.grantedTags && effect.grantedTags.length > 0) {
      throw new Error('Instant gameplay effects cannot grant tags');
    }

    const touched = new Set<string>();
    for (const modifier of effect.modifiers) {
      const state = this.ensureAttribute(modifier.attribute);
      const magnitude = resolveModifierMagnitude(
        modifier.magnitude,
        applicationContext,
        (entityId, attribute) => this.readAttributeForEvaluation(entityId, attribute),
      );
      this.emitTrace('ge.magnitude.resolve', {
        effectDefId: effect.id,
        attribute: modifier.attribute,
        captured: magnitude,
      });
      state.baseValue = this.applyModifierToValue(state.baseValue, modifier.op, magnitude);
      touched.add(modifier.attribute);
      this.emitTrace('attribute.base.set', {
        attribute: modifier.attribute,
        after: state.baseValue,
      });
    }

    this.recomputeAttributes([...touched]);
  }

  private applyModifierToValue(value: number, op: GameplayModifierOp, magnitude: number): number {
    switch (op) {
      case 'Add':
        return value + magnitude;
      case 'Multiply':
        return value * magnitude;
      case 'Override':
        return magnitude;
      default:
        return value;
    }
  }

  private recomputeAttributes(attributes: readonly string[]): void {
    const uniqueAttributes = [...new Set(attributes)];

    for (const attribute of uniqueAttributes) {
      const state = this.ensureAttribute(attribute);
      const oldValue = state.currentValue;
      const nextValue = this.evaluateCurrentValue(attribute, state.baseValue);

      if (oldValue === nextValue) {
        state.currentValue = nextValue;
        continue;
      }

      let finalValue = nextValue;
      const ctx = {
        entityId: this.entityId,
        attribute,
        oldValue,
        newValue: nextValue,
      };

      for (const callback of this.preAttributeChangeCallbacks) {
        callback(ctx);
        finalValue = ctx.newValue;
      }

      state.currentValue = finalValue;
      this.emitTrace('attribute.current.recompute', {
        attribute,
        before: oldValue,
        after: finalValue,
      });

      ctx.newValue = finalValue;
      for (const callback of this.postAttributeChangeCallbacks) {
        callback(ctx);
      }
    }
  }

  private evaluateCurrentValue(attribute: string, baseValue: number): number {
    const pipeline = this.evaluationPipelines.get(attribute);
    const modifiers = this.collectResolvedModifiers(attribute, pipeline);

    if (!pipeline || pipeline.length === 0) {
      return evaluateFlatAttributeValue(baseValue, modifiers);
    }

    return evaluateStagedAttributeValue(baseValue, pipeline, modifiers, (stage, before, after) => {
      if (stage === 'final') {
        this.emitTrace('attr.pipeline.final', { attribute, before, after });
        return;
      }
      this.emitTrace('attr.pipeline.stage', { attribute, stage, before, after });
    });
  }

  private collectResolvedModifiers(
    attribute: string,
    pipeline: readonly GameplayTag[] | undefined,
  ): StagedResolvedModifier[] {
    const modifiers: StagedResolvedModifier[] = [];
    let order = 0;

    for (const effect of this.getOrderedActiveEffects()) {
      if (!effect.ongoingContributing) {
        continue;
      }

      for (const modifier of effect.definition.modifiers) {
        if (modifier.attribute !== attribute) {
          continue;
        }

        const magnitude = resolveModifierMagnitude(
          modifier.magnitude,
          effect.applicationContext,
          (entityId, attr) => this.readAttributeForEvaluation(entityId, attr),
        );
        this.emitTrace('ge.magnitude.resolve', {
          effectDefId: effect.definition.id,
          attribute,
          captured: magnitude,
        });

        let stageIndex: number | undefined;
        if (pipeline && pipeline.length > 0) {
          const assignment = assignModifierStages(pipeline, modifier.evaluationStage);
          stageIndex = assignment.stageIndex;
        }

        modifiers.push({
          op: modifier.op,
          magnitude,
          order: order++,
          stageIndex,
        });
      }
    }

    return modifiers;
  }

  private readAttributeForEvaluation(
    entityId: EntityId,
    attribute: string,
  ): AttributeValue | undefined {
    if (entityId === this.entityId) {
      return this.attributes.get(attribute);
    }
    return this.resolveGfc(entityId)?.getAttribute(attribute);
  }

  private resolveApplicationContext(
    context?: GameplayEffectApplicationContext,
  ): GameplayEffectApplicationContext {
    return context ?? { instigatorEntityId: this.entityId };
  }

  private validateApplicationContextForEffect(
    effect: GameplayEffectDefinition,
    context: GameplayEffectApplicationContext,
  ): void {
    for (const modifier of effect.modifiers) {
      const requiredEntity = modifierRequiresEntity(modifier.magnitude);
      if (!requiredEntity) {
        continue;
      }

      const entityId =
        requiredEntity === 'Source' ? context.sourceEntityId : context.targetEntityId;
      if (!entityId) {
        throw new GameplayEffectError(
          `Gameplay effect ${effect.id} modifier on ${modifier.attribute} requires ${requiredEntity} entity in application context`,
        );
      }
    }
  }

  private warnUnknownStagesForEffect(effect: GameplayEffectDefinition): void {
    for (const modifier of effect.modifiers) {
      if (!modifier.evaluationStage) {
        continue;
      }

      const pipeline = this.evaluationPipelines.get(modifier.attribute);
      if (!pipeline || pipeline.length === 0) {
        continue;
      }

      const assignment = assignModifierStages(pipeline, modifier.evaluationStage);
      if (!assignment.unknownStage) {
        continue;
      }

      this.emitTrace('ge.modifier.stage.fallback', {
        attribute: modifier.attribute,
        stage: modifier.evaluationStage.name,
        effectDefId: effect.id,
      });
    }
  }

  private handleDurationEvent(channel: GameplayEventChannel, event: GameplayEvent): void {
    const expiredEffectIds: string[] = [];

    for (const effect of this.getOrderedActiveEffects()) {
      if (effect.definition.duration.kind !== 'Duration') {
        continue;
      }

      if (!effect.durationChannels.some((entry) => entry.tag.index === channel.tag.index)) {
        continue;
      }

      if (!event.tags.has(effect.definition.duration.unitTag)) {
        continue;
      }

      const before = effect.durationProgress ?? 0;
      const after = before + 1;
      effect.durationProgress = after;

      this.emitTrace('ge.duration.progress', {
        effectId: effect.id,
        effectDefId: effect.definition.id,
        unitTag: effect.definition.duration.unitTag.name,
        before,
        after,
        target: this.getEffectiveDurationMagnitude(effect),
      });

      if (after >= this.getEffectiveDurationMagnitude(effect)) {
        this.emitTrace('ge.duration.expired', {
          effectId: effect.id,
          effectDefId: effect.definition.id,
          unitTag: effect.definition.duration.unitTag.name,
          finalProgress: after,
        });
        expiredEffectIds.push(effect.id);
      }
    }

    for (const effectId of expiredEffectIds) {
      this.removeGameplayEffect(effectId);
    }
  }

  private addDurationSubscriptions(effect: ActiveGameplayEffect): void {
    for (const channel of effect.durationChannels) {
      const existing = this.channelSubscriptions.get(channel.tag.index);
      if (existing) {
        existing.refCount += 1;
        continue;
      }

      const listenerId = this.eventSystem.subscribe({
        channel,
        listenerId: `gfc:${this.entityId}:duration:${channel.name}`,
        handler: (event) => {
          this.handleDurationEvent(channel, event);
        },
      });

      this.channelSubscriptions.set(channel.tag.index, {
        channel,
        listenerId,
        refCount: 1,
      });
      this.emitTrace('gfc.channel.subscribe', {
        channel: channel.name,
      });
    }
  }

  private removeDurationSubscriptions(effect: ActiveGameplayEffect): void {
    for (const channel of effect.durationChannels) {
      const subscription = this.channelSubscriptions.get(channel.tag.index);
      if (!subscription) {
        continue;
      }

      subscription.refCount -= 1;
      if (subscription.refCount > 0) {
        continue;
      }

      this.eventSystem.unsubscribe(subscription.listenerId);
      this.channelSubscriptions.delete(channel.tag.index);
      this.emitTrace('gfc.channel.unsubscribe', {
        channel: channel.name,
      });
    }
  }

  private resolveDurationChannels(duration: GameplayEffectDuration): readonly GameplayEventChannel[] {
    if (duration.kind !== 'Duration') {
      return [];
    }

    const channels = duration.channels && duration.channels.length > 0 ? duration.channels : [this.eventSystem.defaultChannel];
    const unique = new Map<number, GameplayEventChannel>();
    for (const channel of channels) {
      unique.set(channel.tag.index, channel);
    }

    return [...unique.values()];
  }

  private collectModifiedAttributes(effect: GameplayEffectDefinition): string[] {
    return [...new Set(effect.modifiers.map((modifier) => modifier.attribute))];
  }

  private getOrderedActiveEffects(): ActiveGameplayEffect[] {
    return [...this.activeEffects.values()].sort(
      (left, right) => left.applicationOrder - right.applicationOrder,
    );
  }

  private ensureAttribute(attribute: string): AttributeValue {
    const existing = this.attributes.get(attribute);
    if (existing) {
      return existing;
    }

    const created: AttributeValue = { baseValue: 0, currentValue: 0 };
    this.attributes.set(attribute, created);
    return created;
  }

  private applyGrantedTags(tags: readonly GameplayTag[] | undefined): void {
    if (!tags || tags.length === 0) {
      return;
    }
    for (const tag of tags) {
      this.tags.add(tag);
    }
    this.notifyTagChange();
  }

  private removeGrantedTags(tags: readonly GameplayTag[] | undefined): void {
    if (!tags || tags.length === 0) {
      return;
    }
    for (const tag of tags) {
      this.tags.remove(tag);
    }
    this.notifyTagChange();
  }

  private notifyTagChange(): void {
    this.onEntityTagChange?.(this.entityId);
  }

  private evaluateOngoingContributing(
    effect: GameplayEffectDefinition,
    context: GameplayEffectApplicationContext,
  ): boolean {
    return evaluateOngoingTagRequirements(
      this.tagManager,
      effect.ongoingTagRequirements,
      context,
      this.entityId,
      (entityId) => this.resolveGfc(entityId)?.getTagContainer(),
    );
  }

  private updateEffectOngoingState(activeEffect: ActiveGameplayEffect): boolean {
    const next = this.evaluateOngoingContributing(
      activeEffect.definition,
      activeEffect.applicationContext,
    );
    const previous = activeEffect.ongoingContributing;
    if (previous === next) {
      return false;
    }

    activeEffect.ongoingContributing = next;
    if (next) {
      this.applyGrantedTags(activeEffect.definition.grantedTags);
    } else {
      this.removeGrantedTags(activeEffect.definition.grantedTags);
    }

    this.emitTrace('ge.ongoing.state', {
      effectId: activeEffect.id,
      effectDefId: activeEffect.definition.id,
      contributing: next,
    });
    return true;
  }

  private findActiveEffectByDefId(definitionId: string): ActiveGameplayEffect | undefined {
    for (const effect of this.activeEffects.values()) {
      if (effect.definition.id === definitionId) {
        return effect;
      }
    }
    return undefined;
  }

  private reapplyStackedEffect(
    existing: ActiveGameplayEffect,
    incoming: GameplayEffectDefinition,
    stacking: Extract<import('./types.js').GameplayEffectStacking, { kind: 'byEffectId' }>,
    applicationContext: GameplayEffectApplicationContext,
  ): string {
    existing.applicationContext = applicationContext;

    if (incoming.duration.kind === 'Duration') {
      const base =
        existing.stackedDurationMagnitude ?? incoming.duration.magnitude;
      if (stacking.onReapply === 'addDuration') {
        existing.stackedDurationMagnitude = base + incoming.duration.magnitude;
      } else if (stacking.onReapply === 'refreshDuration') {
        existing.stackedDurationMagnitude = incoming.duration.magnitude;
        existing.durationProgress = 0;
      }
    }

    if (stacking.onReapply === 'addMagnitude') {
      throw new GameplayNotImplementedError('GameplayEffect stacking addMagnitude');
    }

    this.updateEffectOngoingState(existing);
    this.recomputeAttributes(this.collectModifiedAttributes(incoming));
    this.emitTrace('ge.stacked', {
      effectId: existing.id,
      effectDefId: incoming.id,
      policy: stacking.onReapply,
      stackedDurationMagnitude: existing.stackedDurationMagnitude,
    });
    return existing.id;
  }

  private getEffectiveDurationMagnitude(effect: ActiveGameplayEffect): number {
    if (effect.definition.duration.kind !== 'Duration') {
      return 0;
    }
    return effect.stackedDurationMagnitude ?? effect.definition.duration.magnitude;
  }

  private collectAllModifiedAttributesFromActiveEffects(): string[] {
    const attributes = new Set<string>();
    for (const effect of this.activeEffects.values()) {
      for (const modifier of effect.definition.modifiers) {
        attributes.add(modifier.attribute);
      }
    }
    return [...attributes];
  }

  private validateEffect(effect: GameplayEffectDefinition): void {
    if (!effect.id) {
      throw new Error('GameplayEffectDefinition.id is required');
    }

    for (const modifier of effect.modifiers) {
      this.assertAttributeKey(modifier.attribute);
      const normalized = normalizeModifierMagnitude(modifier.magnitude);
      if (normalized.kind === 'Scalable') {
        this.assertFiniteNumber(normalized.value, `modifier magnitude for ${modifier.attribute}`);
      } else if (normalized.kind === 'AttributeBased') {
        this.assertAttributeKey(normalized.attribute);
        if (normalized.coefficient !== undefined) {
          this.assertFiniteNumber(
            normalized.coefficient,
            `modifier coefficient for ${modifier.attribute}`,
          );
        }
      } else if (normalized.kind === 'SetByCaller') {
        if (!normalized.key) {
          throw new Error(`SetByCaller magnitude key is required for ${modifier.attribute}`);
        }
      }
    }

    if (effect.duration.kind === 'Duration') {
      if (effect.duration.magnitude <= 0 || !Number.isInteger(effect.duration.magnitude)) {
        throw new Error(`Duration magnitude must be a positive integer, got ${effect.duration.magnitude}`);
      }
    }

    if (effect.duration.kind === 'Duration') {
      return;
    }

  }

  private assertAttributeKey(attribute: string): void {
    if (!attribute) {
      throw new Error('Attribute key is required');
    }
  }

  private assertFiniteNumber(value: number, label: string): void {
    if (!Number.isFinite(value)) {
      throw new Error(`Expected finite number for ${label}, got ${value}`);
    }
  }

  private emitTrace(
    kind:
      | 'attribute.base.set'
      | 'attribute.current.recompute'
      | 'ge.applied'
      | 'ge.removed'
      | 'ge.ctx'
      | 'ge.magnitude.resolve'
      | 'ge.modifier.stage.fallback'
      | 'attr.pipeline.stage'
      | 'attr.pipeline.final'
      | 'ge.duration.progress'
      | 'ge.duration.expired'
      | 'ge.ongoing.state'
      | 'ge.stacked'
      | 'gfc.channel.subscribe'
      | 'gfc.channel.unsubscribe',
    payload: Record<string, unknown>,
  ): void {
    if (!this.sink) {
      return;
    }

    const entry = {
      kind,
      entity: this.entityId,
      ...payload,
    } as TraceEntryInput;

    this.sink.emit(entry);
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new Error(`GameplayFrameworkComponent disposed: ${this.entityId}`);
    }
  }
}
