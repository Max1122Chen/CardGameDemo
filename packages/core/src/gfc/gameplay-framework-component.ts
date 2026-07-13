import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEventSystem, GameplayEventSubscribeOptions } from '../events/gameplay-event-system.js';
import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { TraceEntryInput, TraceSink } from '../trace/trace.js';
import type {
  ActiveGameplayEffect,
  AttributeChangeCallback,
  AttributeValue,
  GameplayEffectDefinition,
  GameplayEffectDuration,
  GameplayModifierOp,
  GfcSnapshot,
} from './types.js';

export type GameplayFrameworkComponentOptions = {
  entityId: EntityId;
  tagManager: GameplayTagManager;
  eventSystem: GameplayEventSystem;
  sink?: TraceSink;
};

let nextAbilityHandle = 0;
let nextEffectHandle = 0;

export class GameplayFrameworkComponent {
  readonly entityId: EntityId;

  private readonly tagManager: GameplayTagManager;
  private readonly eventSystem: GameplayEventSystem;
  private readonly sink?: TraceSink;
  private readonly tags: GameplayTagContainer;
  private readonly manualListenerIds: string[] = [];
  private readonly grantedAbilityHandles = new Set<string>();
  private readonly attributeSets = new Map<string, unknown>();
  private readonly attributes = new Map<string, AttributeValue>();
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
  }

  addTag(tag: GameplayTag, count = 1): void {
    this.assertActive();
    this.tags.add(tag, count);
  }

  removeTag(tag: GameplayTag, count = 1): void {
    this.assertActive();
    this.tags.remove(tag, count);
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

    this.manualListenerIds.length = 0;
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
    this.recomputeAttributes([attribute]);
  }

  applyGameplayEffect(effect: GameplayEffectDefinition, _context?: unknown): string {
    this.assertActive();
    this.validateEffect(effect);

    const effectId = `effect-${nextEffectHandle++}`;
    this.emitTrace('ge.applied', {
      effectId,
      effectDefId: effect.id,
      durationKind: effect.duration.kind,
    });

    if (effect.duration.kind === 'Instant') {
      this.applyInstantEffect(effect);
      return effectId;
    }

    const activeEffect: ActiveGameplayEffect = {
      id: effectId,
      definition: effect,
      applicationOrder: this.nextApplicationOrder++,
      durationProgress: effect.duration.kind === 'Duration' ? 0 : undefined,
      durationChannels: this.resolveDurationChannels(effect.duration),
    };

    this.activeEffects.set(effectId, activeEffect);
    this.applyGrantedTags(effect.grantedTags);

    if (effect.duration.kind === 'Duration') {
      this.addDurationSubscriptions(activeEffect);
    }

    this.recomputeAttributes(this.collectModifiedAttributes(effect));
    return effectId;
  }

  removeGameplayEffect(effectId: string): boolean {
    this.assertActive();
    const effect = this.activeEffects.get(effectId);
    if (!effect) {
      return false;
    }

    this.activeEffects.delete(effectId);
    this.removeGrantedTags(effect.definition.grantedTags);

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
      },
      durationChannels: [...effect.durationChannels],
    }));
  }

  grantAbility(_spec: unknown): string {
    this.assertActive();
    const handle = `ability-${nextAbilityHandle++}`;
    this.grantedAbilityHandles.add(handle);
    return handle;
  }

  revokeAbility(handle: string): void {
    this.assertActive();
    this.grantedAbilityHandles.delete(handle);
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
          effect.definition.duration.kind === 'Duration' ? effect.definition.duration.magnitude : undefined,
        durationChannels: effect.durationChannels.map((channel) => channel.name),
      })),
    };
  }

  private applyInstantEffect(effect: GameplayEffectDefinition): void {
    if (effect.grantedTags && effect.grantedTags.length > 0) {
      throw new Error('Instant gameplay effects cannot grant tags');
    }

    const touched = new Set<string>();
    for (const modifier of effect.modifiers) {
      const state = this.ensureAttribute(modifier.attribute);
      state.baseValue = this.applyModifierToValue(state.baseValue, modifier.op, modifier.magnitude);
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

      const ctx = {
        entityId: this.entityId,
        attribute,
        oldValue,
        newValue: nextValue,
      };

      for (const callback of this.preAttributeChangeCallbacks) {
        callback(ctx);
      }

      state.currentValue = nextValue;
      this.emitTrace('attribute.current.recompute', {
        attribute,
        before: oldValue,
        after: nextValue,
      });

      for (const callback of this.postAttributeChangeCallbacks) {
        callback(ctx);
      }
    }
  }

  private evaluateCurrentValue(attribute: string, baseValue: number): number {
    const effects = this.getOrderedActiveEffects();
    let addSum = 0;
    let multiplyProduct = 1;
    let overrideValue: number | undefined;

    for (const effect of effects) {
      for (const modifier of effect.definition.modifiers) {
        if (modifier.attribute !== attribute) {
          continue;
        }

        switch (modifier.op) {
          case 'Add':
            addSum += modifier.magnitude;
            break;
          case 'Multiply':
            multiplyProduct *= modifier.magnitude;
            break;
          case 'Override':
            overrideValue = modifier.magnitude;
            break;
          default:
            break;
        }
      }
    }

    if (overrideValue !== undefined) {
      return overrideValue;
    }

    return (baseValue + addSum) * multiplyProduct;
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
        target: effect.definition.duration.magnitude,
      });

      if (after >= effect.definition.duration.magnitude) {
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
    for (const tag of tags ?? []) {
      this.tags.add(tag);
    }
  }

  private removeGrantedTags(tags: readonly GameplayTag[] | undefined): void {
    for (const tag of tags ?? []) {
      this.tags.remove(tag);
    }
  }

  private validateEffect(effect: GameplayEffectDefinition): void {
    if (!effect.id) {
      throw new Error('GameplayEffectDefinition.id is required');
    }

    for (const modifier of effect.modifiers) {
      this.assertAttributeKey(modifier.attribute);
      this.assertFiniteNumber(modifier.magnitude, `modifier magnitude for ${modifier.attribute}`);
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
      | 'ge.duration.progress'
      | 'ge.duration.expired'
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
