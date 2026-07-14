import { createGameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import { DEFAULT_CHANNEL_TAG } from '../tags/native-tags.js';
import type { TraceEntryInput } from '../trace/trace.js';
import type { AttributeValue, GameplayEffectApplicationContext, GameplayEffectDefinition } from '../gfc/types.js';
import { evaluateTagGates, gatesNeedEntity } from './tag-gates.js';
import {
  GameplayAbilityError,
  type AbilityActivationContext,
  type ActivationFailureReason,
  type ActivationResult,
  type ActiveAbilityEventInfo,
  type ActiveAbilitySnapshot,
  type GameplayAbilityDefinition,
  type GameplayAbilityEventListen,
  type GrantedAbilitySnapshot,
  type TakeDamageActivationData,
} from './types.js';

export type GameplayAbilityHost = {
  entityId: EntityId;
  tagManager: GameplayTagManager;
  getOwnerTags(): GameplayTagContainer;
  getAttribute(attribute: string): AttributeValue | undefined;
  setAttributeBase(attribute: string, value: number): void;
  applyGameplayEffectTo(
    entityId: EntityId,
    effect: GameplayEffectDefinition,
    context?: GameplayEffectApplicationContext,
  ): string;
  resolveEntityTags(entityId: EntityId): GameplayTagContainer | undefined;
  /** Subscribe while an ability is Active (or F08 grant-time passive shim). */
  subscribeAbilityEvent(
    channel: GameplayEventChannel,
    listenerId: string,
    handler: (event: GameplayEvent) => void,
  ): void;
  unsubscribeAbilityEvent(listenerId: string): void;
  /** Optional host reaction when listenWhileActive matches (combat commit/cancel). */
  onActiveAbilityEvent?(info: ActiveAbilityEventInfo): void;
  runBuiltinActivation?(
    kind: import('./types.js').GameplayAbilityBuiltinActivation,
    ctx: import('./types.js').AbilityActivationContext,
  ): import('./types.js').TakeDamageActivationData | void;
  emitTrace(entry: TraceEntryInput): void;
};

type GrantedAbilityRecord = {
  handle: string;
  definition: GameplayAbilityDefinition;
  /** F08 passive shim listener (grant-scoped). */
  grantListenerId?: string;
};

type ActiveAbilityRecord = {
  instanceId: string;
  handle: string;
  abilityDefId: string;
  listenerIds: string[];
};

let nextAbilityHandle = 0;
let nextAbilityInstance = 0;

export class GameplayAbilityRuntime {
  private readonly granted = new Map<string, GrantedAbilityRecord>();
  private readonly active = new Map<string, ActiveAbilityRecord>();

  constructor(private readonly host: GameplayAbilityHost) {}

  grantAbility(definition: GameplayAbilityDefinition): string {
    this.validateDefinition(definition);

    const handle = `ability-${nextAbilityHandle++}`;
    const record: GrantedAbilityRecord = { handle, definition };

    // F08 passive shim: grant-scoped listen → tryActivate on match.
    if (definition.kind === 'passive' && definition.passiveTrigger) {
      const listen = definition.passiveTrigger;
      const channelTag = listen.channelTag ?? DEFAULT_CHANNEL_TAG;
      const channel = createGameplayEventChannel(this.host.tagManager.resolve(channelTag));
      const listenerId = `ga-grant-listen:${this.host.entityId}:${handle}`;

      this.host.subscribeAbilityEvent(channel, listenerId, (event) => {
        this.onGrantScopedPassiveEvent(handle, event);
      });
      record.grantListenerId = listenerId;
    }

    this.granted.set(handle, record);
    this.host.emitTrace({
      kind: 'ga.grant',
      entity: this.host.entityId,
      abilityDefId: definition.id,
      handle,
      kindAbility: definition.kind,
    });

    if (definition.autoActivateOnGrant) {
      this.tryActivate(handle, { instigatorEntityId: this.host.entityId });
    }

    return handle;
  }

  revokeAbility(handle: string): boolean {
    const record = this.granted.get(handle);
    if (!record) {
      return false;
    }

    if (record.grantListenerId) {
      this.host.unsubscribeAbilityEvent(record.grantListenerId);
    }

    this.granted.delete(handle);
    this.host.emitTrace({
      kind: 'ga.revoke',
      entity: this.host.entityId,
      handle,
      abilityDefId: record.definition.id,
    });
    return true;
  }

  canActivate(handle: string, ctx: AbilityActivationContext): boolean {
    return this.evaluateActivation(handle, ctx).ok;
  }

  tryActivate(handle: string, ctx: AbilityActivationContext): ActivationResult {
    const evaluation = this.evaluateActivation(handle, ctx);
    if (!evaluation.ok) {
      this.host.emitTrace({
        kind: 'ga.activate.attempt',
        entity: this.host.entityId,
        handle,
        abilityDefId: evaluation.defId,
        ok: false,
        reason: evaluation.reason,
      });
      return { ok: false, reason: evaluation.reason };
    }

    const record = this.granted.get(handle)!;
    const definition = record.definition;
    const instanceId = `ability-instance-${nextAbilityInstance++}`;

    const chargeCost = definition.chargeCostOnActivate !== false;
    if (chargeCost && definition.cost) {
      this.spendCost(definition.cost);
    }

    const activeRecord: ActiveAbilityRecord = {
      instanceId,
      handle,
      abilityDefId: definition.id,
      listenerIds: [],
    };
    this.active.set(instanceId, activeRecord);

    for (const binding of definition.effectsOnActivate) {
      const targetId = binding.target === 'self' ? this.host.entityId : ctx.targetEntityId;
      if (!targetId) {
        this.endAbility(instanceId);
        return { ok: false, reason: 'missing_target' };
      }
      const geContext: GameplayEffectApplicationContext = {
        instigatorEntityId: ctx.instigatorEntityId,
        sourceEntityId: ctx.sourceEntityId,
        targetEntityId: ctx.targetEntityId,
        payload: ctx.payload,
      };
      this.host.applyGameplayEffectTo(targetId, binding.effect, geContext);
    }

    let activationData: { takeDamage?: TakeDamageActivationData } | undefined;

    if (definition.builtinActivation) {
      if (!this.host.runBuiltinActivation) {
        this.endAbility(instanceId);
        return { ok: false, reason: 'cannot_activate' };
      }
      const builtinResult = this.host.runBuiltinActivation(definition.builtinActivation, ctx);
      if (definition.builtinActivation === 'combat.takeDamage' && builtinResult) {
        activationData = { takeDamage: builtinResult };
      }
    }

    if (definition.listenWhileActive) {
      this.attachActiveListeners(activeRecord, definition.listenWhileActive);
    }

    this.host.emitTrace({
      kind: 'ga.activate.attempt',
      entity: this.host.entityId,
      handle,
      abilityDefId: definition.id,
      ok: true,
    });
    this.host.emitTrace({
      kind: 'ga.activate',
      entity: this.host.entityId,
      instanceId,
      abilityDefId: definition.id,
      sourceId: ctx.sourceEntityId,
      targetId: ctx.targetEntityId,
    });

    if (this.shouldAutoEnd(definition)) {
      this.endAbility(instanceId);
    }

    return { ok: true, instanceId, activationData };
  }

  endAbility(instanceId: string): boolean {
    const record = this.active.get(instanceId);
    if (!record) {
      return false;
    }

    for (const listenerId of record.listenerIds) {
      this.host.unsubscribeAbilityEvent(listenerId);
    }
    record.listenerIds.length = 0;

    this.active.delete(instanceId);
    this.host.emitTrace({
      kind: 'ga.end',
      entity: this.host.entityId,
      instanceId,
      abilityDefId: record.abilityDefId,
    });
    return true;
  }

  listGrantedAbilities(): GrantedAbilitySnapshot[] {
    return [...this.granted.values()].map((entry) => ({
      handle: entry.handle,
      abilityDefId: entry.definition.id,
      kind: entry.definition.kind,
      name: entry.definition.name,
    }));
  }

  listActiveAbilities(): ActiveAbilitySnapshot[] {
    return [...this.active.values()].map((entry) => ({
      instanceId: entry.instanceId,
      handle: entry.handle,
      abilityDefId: entry.abilityDefId,
    }));
  }

  dispose(): void {
    for (const handle of [...this.granted.keys()]) {
      this.revokeAbility(handle);
    }
    this.active.clear();
  }

  private attachActiveListeners(
    active: ActiveAbilityRecord,
    listen: GameplayAbilityEventListen,
  ): void {
    const channelTag = listen.channelTag ?? DEFAULT_CHANNEL_TAG;
    const channel = createGameplayEventChannel(this.host.tagManager.resolve(channelTag));
    const listenerId = `ga-active-listen:${this.host.entityId}:${active.instanceId}`;

    this.host.subscribeAbilityEvent(channel, listenerId, (event) => {
      if (!this.active.has(active.instanceId)) {
        return;
      }
      if (!this.eventMatchesListen(listen, event)) {
        return;
      }

      this.host.emitTrace({
        kind: 'ga.listen.match',
        entity: this.host.entityId,
        instanceId: active.instanceId,
        abilityDefId: active.abilityDefId,
        eventTags: [...listen.eventTags],
      });

      this.host.onActiveAbilityEvent?.({
        instanceId: active.instanceId,
        handle: active.handle,
        abilityDefId: active.abilityDefId,
        event,
      });
    });

    active.listenerIds.push(listenerId);
  }

  private onGrantScopedPassiveEvent(handle: string, event: GameplayEvent): void {
    const record = this.granted.get(handle);
    if (!record || record.definition.kind !== 'passive' || !record.definition.passiveTrigger) {
      return;
    }

    if (!this.eventMatchesListen(record.definition.passiveTrigger, event)) {
      return;
    }

    this.host.emitTrace({
      kind: 'ga.passive.trigger',
      entity: this.host.entityId,
      handle,
      eventTags: [...record.definition.passiveTrigger.eventTags],
    });

    const payload = event.payload ?? {};
    const ctx: AbilityActivationContext = {
      instigatorEntityId: this.host.entityId,
      sourceEntityId: typeof payload.sourceId === 'string' ? payload.sourceId : undefined,
      targetEntityId: typeof payload.targetId === 'string' ? payload.targetId : undefined,
      event,
      payload,
    };

    this.tryActivate(handle, ctx);
  }

  private eventMatchesListen(listen: GameplayAbilityEventListen, event: GameplayEvent): boolean {
    const tags = listen.eventTags.map((name) => this.host.tagManager.resolve(name));
    if (tags.length > 0) {
      const tagOk =
        listen.match === 'any' ? tags.some((tag) => event.tags.has(tag)) : tags.every((tag) => event.tags.has(tag));
      if (!tagOk) {
        return false;
      }
    }

    if (listen.payloadMatch) {
      const payload = event.payload ?? {};
      for (const [key, expected] of Object.entries(listen.payloadMatch)) {
        if (payload[key] !== expected) {
          return false;
        }
      }
    }

    return true;
  }

  private evaluateActivation(
    handle: string,
    ctx: AbilityActivationContext,
  ):
    | { ok: true; defId: string }
    | { ok: false; reason: ActivationFailureReason; defId: string } {
    const record = this.granted.get(handle);
    if (!record) {
      return { ok: false, reason: 'not_granted', defId: '' };
    }

    const def = record.definition;
    const gates = def.tags;

    if (!evaluateTagGates(this.host.tagManager, gates, 'owner', this.host.getOwnerTags())) {
      return { ok: false, reason: 'cannot_activate', defId: def.id };
    }

    if (gatesNeedEntity(gates, 'source')) {
      if (!ctx.sourceEntityId) {
        return { ok: false, reason: 'missing_source', defId: def.id };
      }
      if (!evaluateTagGates(this.host.tagManager, gates, 'source', this.host.resolveEntityTags(ctx.sourceEntityId))) {
        return { ok: false, reason: 'cannot_activate', defId: def.id };
      }
    }

    if (gatesNeedEntity(gates, 'target')) {
      if (!ctx.targetEntityId) {
        return { ok: false, reason: 'missing_target', defId: def.id };
      }
      if (!evaluateTagGates(this.host.tagManager, gates, 'target', this.host.resolveEntityTags(ctx.targetEntityId))) {
        return { ok: false, reason: 'cannot_activate', defId: def.id };
      }
    }

    const needsTargetBinding = def.effectsOnActivate.some((binding) => binding.target === 'target');
    if (needsTargetBinding && !ctx.targetEntityId) {
      return { ok: false, reason: 'missing_target', defId: def.id };
    }

    const chargeCost = def.chargeCostOnActivate !== false;
    if (chargeCost && def.cost && !this.canAffordCost(def.cost)) {
      return { ok: false, reason: 'insufficient_cost', defId: def.id };
    }

    return { ok: true, defId: def.id };
  }

  private canAffordCost(cost: NonNullable<GameplayAbilityDefinition['cost']>): boolean {
    const value = this.host.getAttribute(cost.attribute);
    if (!value) {
      return false;
    }
    return value.currentValue >= cost.amount;
  }

  private spendCost(cost: NonNullable<GameplayAbilityDefinition['cost']>): void {
    const value = this.host.getAttribute(cost.attribute);
    if (!value) {
      throw new GameplayAbilityError(`Missing cost attribute: ${cost.attribute}`);
    }
    this.host.setAttributeBase(cost.attribute, value.baseValue - cost.amount);
  }

  private shouldAutoEnd(definition: GameplayAbilityDefinition): boolean {
    if (definition.endPolicy === 'manual') {
      return false;
    }
    if (definition.endPolicy === 'auto') {
      return true;
    }
    // Default F08: Instant-only activate effects → auto end; otherwise stay.
    if (definition.effectsOnActivate.length === 0) {
      return true;
    }
    return definition.effectsOnActivate.every((binding) => binding.effect.duration.kind === 'Instant');
  }

  private validateDefinition(definition: GameplayAbilityDefinition): void {
    if (!definition.id) {
      throw new GameplayAbilityError('GameplayAbilityDefinition.id is required');
    }

    if (definition.kind === 'passive' && !definition.passiveTrigger && !definition.autoActivateOnGrant) {
      throw new GameplayAbilityError(
        `Passive ability ${definition.id} requires passiveTrigger or autoActivateOnGrant`,
      );
    }

    if (definition.kind === 'active' && definition.passiveTrigger) {
      throw new GameplayAbilityError(`Active ability ${definition.id} cannot have passiveTrigger (use listenWhileActive)`);
    }
  }
}
