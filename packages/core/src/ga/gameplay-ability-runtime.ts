import { createGameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import { DEFAULT_CHANNEL_TAG } from '../tags/native-tags.js';
import type { TraceEntryInput } from '../trace/trace.js';
import type { AttributeValue, GameplayEffectDefinition } from '../gfc/types.js';
import { evaluateTagGates, gatesNeedEntity } from './tag-gates.js';
import {
  GameplayAbilityError,
  type AbilityActivationContext,
  type ActivationFailureReason,
  type ActivationResult,
  type ActiveAbilitySnapshot,
  type GameplayAbilityDefinition,
  type GrantedAbilitySnapshot,
} from './types.js';

export type GameplayAbilityHost = {
  entityId: EntityId;
  tagManager: GameplayTagManager;
  getOwnerTags(): GameplayTagContainer;
  getAttribute(attribute: string): AttributeValue | undefined;
  setAttributeBase(attribute: string, value: number): void;
  applyGameplayEffectTo(entityId: EntityId, effect: GameplayEffectDefinition): string;
  resolveEntityTags(entityId: EntityId): GameplayTagContainer | undefined;
  subscribePassive(channel: GameplayEventChannel, listenerId: string, handler: (event: GameplayEvent) => void): void;
  unsubscribePassive(listenerId: string): void;
  emitTrace(entry: TraceEntryInput): void;
};

type GrantedAbilityRecord = {
  handle: string;
  definition: GameplayAbilityDefinition;
  passiveListenerId?: string;
};

type ActiveAbilityRecord = {
  instanceId: string;
  handle: string;
  abilityDefId: string;
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

    if (definition.kind === 'passive') {
      const channelTag = definition.passiveTrigger!.channelTag ?? DEFAULT_CHANNEL_TAG;
      const channel = createGameplayEventChannel(this.host.tagManager.resolve(channelTag));
      const listenerId = `ga-passive:${this.host.entityId}:${handle}`;

      this.host.subscribePassive(channel, listenerId, (event) => {
        this.onPassiveEvent(handle, event);
      });
      record.passiveListenerId = listenerId;
    }

    this.granted.set(handle, record);
    this.host.emitTrace({
      kind: 'ga.grant',
      entity: this.host.entityId,
      abilityDefId: definition.id,
      handle,
      kindAbility: definition.kind,
    });

    return handle;
  }

  revokeAbility(handle: string): boolean {
    const record = this.granted.get(handle);
    if (!record) {
      return false;
    }

    if (record.passiveListenerId) {
      this.host.unsubscribePassive(record.passiveListenerId);
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
    const instanceId = `ability-instance-${nextAbilityInstance++}`;

    if (record.definition.cost) {
      this.spendCost(record.definition.cost);
    }

    this.active.set(instanceId, {
      instanceId,
      handle,
      abilityDefId: record.definition.id,
    });

    for (const binding of record.definition.effectsOnActivate) {
      const targetId = binding.target === 'self' ? this.host.entityId : ctx.targetEntityId;
      if (!targetId) {
        this.active.delete(instanceId);
        return { ok: false, reason: 'missing_target' };
      }
      this.host.applyGameplayEffectTo(targetId, binding.effect);
    }

    this.host.emitTrace({
      kind: 'ga.activate.attempt',
      entity: this.host.entityId,
      handle,
      abilityDefId: record.definition.id,
      ok: true,
    });
    this.host.emitTrace({
      kind: 'ga.activate',
      entity: this.host.entityId,
      instanceId,
      abilityDefId: record.definition.id,
      sourceId: ctx.sourceEntityId,
      targetId: ctx.targetEntityId,
    });

    if (this.shouldAutoEnd(record.definition)) {
      this.endAbility(instanceId);
    }

    return { ok: true, instanceId };
  }

  endAbility(instanceId: string): boolean {
    const record = this.active.get(instanceId);
    if (!record) {
      return false;
    }

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
    return [...this.active.values()].map((entry) => ({ ...entry }));
  }

  dispose(): void {
    for (const handle of [...this.granted.keys()]) {
      this.revokeAbility(handle);
    }
    this.active.clear();
  }

  private onPassiveEvent(handle: string, event: GameplayEvent): void {
    const record = this.granted.get(handle);
    if (!record || record.definition.kind !== 'passive' || !record.definition.passiveTrigger) {
      return;
    }

    if (!this.eventMatchesTrigger(record.definition.passiveTrigger, event)) {
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

  private eventMatchesTrigger(
    trigger: NonNullable<GameplayAbilityDefinition['passiveTrigger']>,
    event: GameplayEvent,
  ): boolean {
    const tags = trigger.eventTags.map((name) => this.host.tagManager.resolve(name));
    if (tags.length === 0) {
      return true;
    }

    if (trigger.match === 'any') {
      return tags.some((tag) => event.tags.has(tag));
    }

    return tags.every((tag) => event.tags.has(tag));
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

    if (def.cost && !this.canAffordCost(def.cost)) {
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
    if (definition.effectsOnActivate.length === 0) {
      return true;
    }
    return definition.effectsOnActivate.every((binding) => binding.effect.duration.kind === 'Instant');
  }

  private validateDefinition(definition: GameplayAbilityDefinition): void {
    if (!definition.id) {
      throw new GameplayAbilityError('GameplayAbilityDefinition.id is required');
    }

    if (definition.kind === 'passive' && !definition.passiveTrigger) {
      throw new GameplayAbilityError(`Passive ability ${definition.id} requires passiveTrigger`);
    }

    if (definition.kind === 'active' && definition.passiveTrigger) {
      throw new GameplayAbilityError(`Active ability ${definition.id} cannot have passiveTrigger`);
    }
  }
}
