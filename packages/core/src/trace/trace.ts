export const TRACE_SCHEMA_VERSION = 1;

export type TraceStartEntry = {
  kind: 'trace.start';
  t: number;
  version: number;
  seed?: number;
  scenarioId?: string;
};

export type TraceEndEntry = {
  kind: 'trace.end';
  t: number;
};

export type DebugNoteEntry = {
  kind: 'debug.note';
  t: number;
  message: string;
};

export type TagAddEntry = {
  kind: 'tag.add';
  t: number;
  tag: string;
  count: number;
  entity?: string;
};

export type TagRemoveEntry = {
  kind: 'tag.remove';
  t: number;
  tag: string;
  count: number;
  entity?: string;
};

export type EventDispatchEntry = {
  kind: 'event.dispatch';
  t: number;
  channel: string;
  tags: string[];
  payloadKeys?: string[];
};

export type AttributeBaseSetEntry = {
  kind: 'attribute.base.set';
  t: number;
  entity: string;
  attribute: string;
  after: number;
};

export type AttributeCurrentRecomputeEntry = {
  kind: 'attribute.current.recompute';
  t: number;
  entity: string;
  attribute: string;
  before: number;
  after: number;
};

export type GameplayEffectAppliedEntry = {
  kind: 'ge.applied';
  t: number;
  entity: string;
  effectId: string;
  effectDefId: string;
  durationKind: 'Instant' | 'Infinite' | 'Duration';
};

export type GameplayEffectRemovedEntry = {
  kind: 'ge.removed';
  t: number;
  entity: string;
  effectId: string;
  effectDefId: string;
  durationKind: 'Instant' | 'Infinite' | 'Duration';
};

export type GameplayEffectDurationProgressEntry = {
  kind: 'ge.duration.progress';
  t: number;
  entity: string;
  effectId: string;
  effectDefId: string;
  unitTag: string;
  before: number;
  after: number;
  target: number;
};

export type GameplayEffectDurationExpiredEntry = {
  kind: 'ge.duration.expired';
  t: number;
  entity: string;
  effectId: string;
  effectDefId: string;
  unitTag: string;
  finalProgress: number;
};

export type GfcChannelSubscribeEntry = {
  kind: 'gfc.channel.subscribe';
  t: number;
  entity: string;
  channel: string;
};

export type GfcChannelUnsubscribeEntry = {
  kind: 'gfc.channel.unsubscribe';
  t: number;
  entity: string;
  channel: string;
};

export type CombatPhaseTraceEntry = {
  kind: 'combat.phase';
  t: number;
  before: string;
  after: string;
};

export type CombatTurnTraceEntry = {
  kind: 'combat.turn';
  t: number;
  owner: string;
  phase: string;
};

export type CombatDrawTraceEntry = {
  kind: 'combat.draw';
  t: number;
  entityId: string;
  cardId: string;
  handSize: number;
};

export type CombatPlayCardTraceEntry = {
  kind: 'combat.play_card';
  t: number;
  entityId: string;
  cardId: string;
  cost: number;
};

export type CombatDamageTraceEntry = {
  kind: 'combat.damage';
  t: number;
  sourceId: string;
  targetId: string;
  amount: number;
  blocked: number;
};

export type CombatEndTraceEntry = {
  kind: 'combat.end';
  t: number;
  result: string;
};

export type GaGrantTraceEntry = {
  kind: 'ga.grant';
  t: number;
  entity: string;
  abilityDefId: string;
  handle: string;
  kindAbility: string;
};

export type GaRevokeTraceEntry = {
  kind: 'ga.revoke';
  t: number;
  entity: string;
  handle: string;
  abilityDefId: string;
};

export type GaActivateAttemptTraceEntry = {
  kind: 'ga.activate.attempt';
  t: number;
  entity: string;
  handle: string;
  abilityDefId: string;
  ok: boolean;
  reason?: string;
};

export type GaActivateTraceEntry = {
  kind: 'ga.activate';
  t: number;
  entity: string;
  instanceId: string;
  abilityDefId: string;
  sourceId?: string;
  targetId?: string;
};

export type GaEndTraceEntry = {
  kind: 'ga.end';
  t: number;
  entity: string;
  instanceId: string;
  abilityDefId: string;
};

export type GaPassiveTriggerTraceEntry = {
  kind: 'ga.passive.trigger';
  t: number;
  entity: string;
  handle: string;
  eventTags: string[];
};

export type GameTraceEntry =
  | TraceStartEntry
  | TraceEndEntry
  | DebugNoteEntry
  | TagAddEntry
  | TagRemoveEntry
  | EventDispatchEntry
  | AttributeBaseSetEntry
  | AttributeCurrentRecomputeEntry
  | GameplayEffectAppliedEntry
  | GameplayEffectRemovedEntry
  | GameplayEffectDurationProgressEntry
  | GameplayEffectDurationExpiredEntry
  | GfcChannelSubscribeEntry
  | GfcChannelUnsubscribeEntry
  | CombatPhaseTraceEntry
  | CombatTurnTraceEntry
  | CombatDrawTraceEntry
  | CombatPlayCardTraceEntry
  | CombatDamageTraceEntry
  | CombatEndTraceEntry
  | GaGrantTraceEntry
  | GaRevokeTraceEntry
  | GaActivateAttemptTraceEntry
  | GaActivateTraceEntry
  | GaEndTraceEntry
  | GaPassiveTriggerTraceEntry;

export type TraceEntryInput =
  | (Omit<TraceStartEntry, 't'> & { t?: number })
  | (Omit<TraceEndEntry, 't'> & { t?: number })
  | (Omit<DebugNoteEntry, 't'> & { t?: number })
  | (Omit<TagAddEntry, 't'> & { t?: number })
  | (Omit<TagRemoveEntry, 't'> & { t?: number })
  | (Omit<EventDispatchEntry, 't'> & { t?: number })
  | (Omit<AttributeBaseSetEntry, 't'> & { t?: number })
  | (Omit<AttributeCurrentRecomputeEntry, 't'> & { t?: number })
  | (Omit<GameplayEffectAppliedEntry, 't'> & { t?: number })
  | (Omit<GameplayEffectRemovedEntry, 't'> & { t?: number })
  | (Omit<GameplayEffectDurationProgressEntry, 't'> & { t?: number })
  | (Omit<GameplayEffectDurationExpiredEntry, 't'> & { t?: number })
  | (Omit<GfcChannelSubscribeEntry, 't'> & { t?: number })
  | (Omit<GfcChannelUnsubscribeEntry, 't'> & { t?: number })
  | (Omit<CombatPhaseTraceEntry, 't'> & { t?: number })
  | (Omit<CombatTurnTraceEntry, 't'> & { t?: number })
  | (Omit<CombatDrawTraceEntry, 't'> & { t?: number })
  | (Omit<CombatPlayCardTraceEntry, 't'> & { t?: number })
  | (Omit<CombatDamageTraceEntry, 't'> & { t?: number })
  | (Omit<CombatEndTraceEntry, 't'> & { t?: number })
  | (Omit<GaGrantTraceEntry, 't'> & { t?: number })
  | (Omit<GaRevokeTraceEntry, 't'> & { t?: number })
  | (Omit<GaActivateAttemptTraceEntry, 't'> & { t?: number })
  | (Omit<GaActivateTraceEntry, 't'> & { t?: number })
  | (Omit<GaEndTraceEntry, 't'> & { t?: number })
  | (Omit<GaPassiveTriggerTraceEntry, 't'> & { t?: number });

export type TraceSink = {
  emit(entry: TraceEntryInput): void;
};

export class TraceBuffer implements TraceSink {
  readonly entries: GameTraceEntry[] = [];
  private nextTick = 0;

  emit(entry: TraceEntryInput): void {
    const tick = entry.t ?? this.nextTick;
    this.nextTick = tick + 1;
    const { kind, t: _t, ...rest } = entry;
    this.entries.push({ kind, t: tick, ...rest } as GameTraceEntry);
  }

  clear(): void {
    this.entries.length = 0;
    this.nextTick = 0;
  }
}

export class NoopTraceSink implements TraceSink {
  emit(_entry: TraceEntryInput): void {
    // intentional no-op for tests and --trace off
  }
}
