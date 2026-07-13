import { describe, expect, it } from 'vitest';

import { NoopTraceSink, TRACE_SCHEMA_VERSION, TraceBuffer } from './trace.js';

describe('TraceBuffer', () => {
  it('assigns monotonic logical ticks when t is omitted', () => {
    const buffer = new TraceBuffer();

    buffer.emit({ kind: 'trace.start', version: TRACE_SCHEMA_VERSION, seed: 42 });
    buffer.emit({ kind: 'debug.note', message: 'probe' });
    buffer.emit({ kind: 'trace.end' });

    expect(buffer.entries).toEqual([
      { kind: 'trace.start', t: 0, version: TRACE_SCHEMA_VERSION, seed: 42 },
      { kind: 'debug.note', t: 1, message: 'probe' },
      { kind: 'trace.end', t: 2 },
    ]);
  });

  it('respects explicit t and advances the internal counter', () => {
    const buffer = new TraceBuffer();

    buffer.emit({ kind: 'debug.note', t: 5, message: 'manual' });
    buffer.emit({ kind: 'trace.end' });

    expect(buffer.entries[0]?.t).toBe(5);
    expect(buffer.entries[1]?.t).toBe(6);
  });

  it('clear resets entries and tick counter', () => {
    const buffer = new TraceBuffer();
    buffer.emit({ kind: 'trace.end' });
    buffer.clear();
    buffer.emit({ kind: 'trace.end' });

    expect(buffer.entries).toEqual([{ kind: 'trace.end', t: 0 }]);
  });
});

describe('NoopTraceSink', () => {
  it('does not throw when emitting', () => {
    const sink = new NoopTraceSink();
    expect(() => {
      sink.emit({ kind: 'debug.note', message: 'ignored' });
    }).not.toThrow();
  });
});
