import { createGameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import { DEFAULT_CHANNEL_TAG } from '../tags/native-tags.js';
import type { TraceEntryInput } from '../trace/trace.js';
import type {
  AttributeValue,
  GameplayEffectApplicationContext,
  GameplayEffectDefinition,
  GameplayEffectModifier,
} from '../gfc/types.js';
import { evaluateTagGates, gatesNeedEntity } from './tag-gates.js';
import type {
  AbilityActivationRegistry,
  AbilityHandlerContext,
  AbilityHookServices,
} from './ability-activation-registry.js';
import {
  mergeParameterValues,
  resolveBindingMap,
  resolveBindingMapOptional,
  type AbilityParameterValue,
} from './parameter-binding.js';
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
  /** Optional host reaction when listenWhileActive matches (legacy / combat session). */
  onActiveAbilityEvent?(info: ActiveAbilityEventInfo): void;
  /** App-registered activation handlers (CORE-F11/F12). */
  activationRegistry?: AbilityActivationRegistry;
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
  activationCtx: AbilityActivationContext;
  parameters: Record<string, AbilityParameterValue>;
  definition: GameplayAbilityDefinition;
};

let nextAbilityHandle = 0;
let nextAbilityInstance = 0;
let nextListenSerial = 0;

export class GameplayAbilityRuntime {
  private readonly granted = new Map<string, GrantedAbilityRecord>();
  private readonly active = new Map<string, ActiveAbilityRecord>();

  constructor(private readonly host: GameplayAbilityHost) {}

  grantAbility(definition: GameplayAbilityDefinition): string {
    this.validateDefinition(definition);

    const handle = `ability-${nextAbilityHandle++}`;
    const record: GrantedAbilityRecord = { handle, definition };

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
    const parameters = this.resolveParameters(definition, ctx);

    const activeRecord: ActiveAbilityRecord = {
      instanceId,
      handle,
      abilityDefId: definition.id,
      listenerIds: [],
      activationCtx: ctx,
      parameters,
      definition,
    };
    this.active.set(instanceId, activeRecord);

    const costTiming = definition.costApplyTiming ?? 'activate';
    if (costTiming === 'activate') {
      const shouldCharge =
        definition.costEffect !== undefined ||
        (definition.cost !== undefined && definition.chargeCostOnActivate !== false);
      if (shouldCharge && !this.applyCostForActive(activeRecord)) {
        this.endAbility(instanceId);
        return { ok: false, reason: 'insufficient_cost' };
      }
    }

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
        setByCaller: ctx.setByCaller,
      };
      this.host.applyGameplayEffectTo(targetId, binding.effect, geContext);
    }

    let activationData: (Record<string, unknown> & {
      takeDamage?: import('./types.js').TakeDamageActivationData;
    }) | undefined;

    if (definition.handlerId) {
      const handler = this.host.activationRegistry?.get(definition.handlerId);
      if (!handler) {
        this.endAbility(instanceId);
        return { ok: false, reason: 'cannot_activate' };
      }
      const handlerResult = handler.onActivate(this.buildHandlerContext(activeRecord));
      if (!handlerResult.ok) {
        this.endAbility(instanceId);
        return { ok: false, reason: handlerResult.reason ?? 'cannot_activate' };
      }
      if (handlerResult.data) {
        activationData = handlerResult.data as typeof activationData;
      }
    }

    if (definition.listenWhileActive) {
      this.attachDeclarativeListeners(activeRecord, definition.listenWhileActive, definition);
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

  private buildHandlerContext(active: ActiveAbilityRecord): AbilityHandlerContext {
    const services = this.createHookServices(active);
    return {
      host: this.host,
      definition: active.definition,
      ctx: {
        ...active.activationCtx,
        parameters: active.parameters,
      },
      instanceId: active.instanceId,
      services,
    };
  }

  private createHookServices(active: ActiveAbilityRecord): AbilityHookServices {
    return {
      parameters: active.parameters,
      startListen: (filter, onEvent) => this.startListen(active, filter, onEvent),
      stopListen: (listenerId) => this.stopListen(active, listenerId),
      checkCost: () => this.checkCostForActive(active),
      applyCost: () => {
        if (!this.applyCostForActive(active)) {
          throw new GameplayAbilityError('applyCost failed: insufficient cost');
        }
      },
      commitAbility: () => {
        if (!this.checkCostForActive(active)) {
          return false;
        }
        return this.applyCostForActive(active);
      },
      applyEffectBindings: (when) => this.applyEffectBindingsForActive(active, when),
      endAbility: () => {
        this.endAbility(active.instanceId);
      },
    };
  }

  private startListen(
    active: ActiveAbilityRecord,
    listen: GameplayAbilityEventListen,
    onEvent: (event: GameplayEvent) => void,
  ): string {
    if (!this.active.has(active.instanceId)) {
      throw new GameplayAbilityError('startListen: ability is not active');
    }
    const channelTag = listen.channelTag ?? DEFAULT_CHANNEL_TAG;
    const channel = createGameplayEventChannel(this.host.tagManager.resolve(channelTag));
    const listenerId = `ga-hook-listen:${this.host.entityId}:${active.instanceId}:${nextListenSerial++}`;

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
      onEvent(event);
    });

    active.listenerIds.push(listenerId);
    return listenerId;
  }

  private stopListen(active: ActiveAbilityRecord, listenerId: string): void {
    this.host.unsubscribeAbilityEvent(listenerId);
    active.listenerIds = active.listenerIds.filter((id) => id !== listenerId);
  }

  private resolveParameters(
    definition: GameplayAbilityDefinition,
    ctx: AbilityActivationContext,
  ): Record<string, AbilityParameterValue> {
    const fromDef = mergeParameterValues(definition.parameterSchema, definition.parameterValues);
    if (ctx.parameters) {
      return { ...fromDef, ...ctx.parameters };
    }
    return fromDef;
  }

  private checkCostForActive(active: ActiveAbilityRecord): boolean {
    const def = active.definition;
    if (def.costEffect) {
      return this.checkCostEffect(def.costEffect, active.parameters, def.costBindings);
    }
    if (def.cost) {
      return this.canAffordLegacyCost(def.cost);
    }
    return true;
  }

  private applyCostForActive(active: ActiveAbilityRecord): boolean {
    const def = active.definition;
    if (def.costEffect) {
      if (!this.checkCostEffect(def.costEffect, active.parameters, def.costBindings)) {
        return false;
      }
      const raw = resolveBindingMap(def.costBindings, active.parameters);
      // Cost GE magnitudes are "amount to spend" (positive); apply as negative Add.
      const setByCaller = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [key, -Math.abs(value)]),
      );
      this.host.applyGameplayEffectTo(this.host.entityId, def.costEffect, {
        instigatorEntityId: active.activationCtx.instigatorEntityId,
        sourceEntityId: active.activationCtx.sourceEntityId ?? this.host.entityId,
        targetEntityId: this.host.entityId,
        payload: active.activationCtx.payload,
        setByCaller,
      });
      return true;
    }
    if (def.cost) {
      if (!this.canAffordLegacyCost(def.cost)) {
        return false;
      }
      this.spendLegacyCost(def.cost);
      return true;
    }
    return true;
  }

  private checkCostEffect(
    effect: GameplayEffectDefinition,
    parameters: Readonly<Record<string, AbilityParameterValue>>,
    costBindings: Readonly<Record<string, string>> | undefined,
  ): boolean {
    const raw = resolveBindingMap(costBindings, parameters);
    const setByCaller = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, -Math.abs(value)]),
    );
    for (const modifier of effect.modifiers) {
      if (!this.canAffordModifier(modifier, setByCaller)) {
        return false;
      }
    }
    return true;
  }

  private canAffordModifier(
    modifier: GameplayEffectModifier,
    setByCaller: Readonly<Record<string, number>>,
  ): boolean {
    const magnitude = this.resolveModifierMagnitude(modifier, setByCaller);
    if (magnitude === undefined) {
      return false;
    }
    const attr = this.host.getAttribute(modifier.attribute);
    if (!attr) {
      return false;
    }
    if (modifier.op === 'Add') {
      // Spending resources: Add negative amount → need current >= -magnitude
      if (magnitude < 0) {
        return attr.currentValue >= -magnitude;
      }
      return true;
    }
    if (modifier.op === 'Override') {
      return true;
    }
    return true;
  }

  private resolveModifierMagnitude(
    modifier: GameplayEffectModifier,
    setByCaller: Readonly<Record<string, number>>,
  ): number | undefined {
    const mag = modifier.magnitude;
    if (typeof mag === 'number') {
      return mag;
    }
    if (mag.kind === 'SetByCaller') {
      const value = setByCaller[mag.key];
      return value;
    }
    // AttributeBased cost check not supported in F12 MVP
    return undefined;
  }

  private applyEffectBindingsForActive(active: ActiveAbilityRecord, when?: string): void {
    const bindings = active.definition.effectBindings ?? [];
    for (const binding of bindings) {
      if (when !== undefined && binding.when !== when) {
        continue;
      }
      const setByCaller = resolveBindingMapOptional(binding.bind, active.parameters);
      if (binding.bind && Object.keys(binding.bind).length > 0 && setByCaller === undefined) {
        // Optional params missing — skip this binding
        continue;
      }
      const targetId =
        binding.target === 'self' ? this.host.entityId : active.activationCtx.targetEntityId;
      if (!targetId) {
        throw new GameplayAbilityError('applyEffectBindings: missing target');
      }
      this.host.applyGameplayEffectTo(targetId, binding.effect, {
        instigatorEntityId: active.activationCtx.instigatorEntityId,
        sourceEntityId: active.activationCtx.sourceEntityId,
        targetEntityId: active.activationCtx.targetEntityId,
        payload: active.activationCtx.payload,
        setByCaller: setByCaller ?? active.activationCtx.setByCaller,
      });
    }
  }

  private attachDeclarativeListeners(
    active: ActiveAbilityRecord,
    listen: GameplayAbilityEventListen,
    definition: GameplayAbilityDefinition,
  ): void {
    const handler =
      definition.handlerId !== undefined
        ? this.host.activationRegistry?.get(definition.handlerId)
        : undefined;

    this.startListen(active, listen, (event) => {
      if (handler?.onActiveEvent) {
        handler.onActiveEvent({
          ...this.buildHandlerContext(active),
          event,
          ctx: {
            ...active.activationCtx,
            event,
            payload: event.payload,
            parameters: active.parameters,
          },
        });
        return;
      }

      this.host.onActiveAbilityEvent?.({
        instanceId: active.instanceId,
        handle: active.handle,
        abilityDefId: active.abilityDefId,
        event,
      });
    });
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

    const needsTargetBinding =
      def.effectsOnActivate.some((binding) => binding.target === 'target') ||
      (def.effectBindings ?? []).some((binding) => binding.target === 'target');
    if (needsTargetBinding && !ctx.targetEntityId) {
      return { ok: false, reason: 'missing_target', defId: def.id };
    }

    const costTiming = def.costApplyTiming ?? 'activate';
    if (costTiming === 'activate') {
      const parameters = this.resolveParameters(def, ctx);
      if (def.costEffect) {
        if (!this.checkCostEffect(def.costEffect, parameters, def.costBindings)) {
          return { ok: false, reason: 'insufficient_cost', defId: def.id };
        }
      } else if (
        def.cost &&
        def.chargeCostOnActivate !== false &&
        !this.canAffordLegacyCost(def.cost)
      ) {
        return { ok: false, reason: 'insufficient_cost', defId: def.id };
      }
    }

    return { ok: true, defId: def.id };
  }

  private canAffordLegacyCost(cost: NonNullable<GameplayAbilityDefinition['cost']>): boolean {
    const value = this.host.getAttribute(cost.attribute);
    if (!value) {
      return false;
    }
    return value.currentValue >= cost.amount;
  }

  private spendLegacyCost(cost: NonNullable<GameplayAbilityDefinition['cost']>): void {
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
    if (definition.handlerId && definition.effectsOnActivate.length === 0) {
      return true;
    }
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
