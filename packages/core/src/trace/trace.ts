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

export type GameTraceEntry =
  | TraceStartEntry
  | TraceEndEntry
  | DebugNoteEntry
  | TagAddEntry
  | TagRemoveEntry;

export type TraceEntryInput =
  | (Omit<TraceStartEntry, 't'> & { t?: number })
  | (Omit<TraceEndEntry, 't'> & { t?: number })
  | (Omit<DebugNoteEntry, 't'> & { t?: number })
  | (Omit<TagAddEntry, 't'> & { t?: number })
  | (Omit<TagRemoveEntry, 't'> & { t?: number });

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
