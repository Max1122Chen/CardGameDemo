import type { GameTraceEntry, TraceSink } from '@cardgame/core';
import { NoopTraceSink, TRACE_SCHEMA_VERSION, TraceBuffer } from '@cardgame/core';

export type TraceMode = 'off' | 'ndjson';

export type CliOptions = {
  trace: TraceMode;
  seed?: number;
  scenarioId?: string;
};

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = { trace: 'off' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--trace') {
      const value = argv[i + 1];
      if (value !== 'ndjson' && value !== 'off') {
        throw new Error(`Invalid --trace value: ${value ?? '(missing)'}. Use "ndjson" or "off".`);
      }
      options.trace = value;
      i += 1;
      continue;
    }

    if (arg === '--seed') {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error('Missing value for --seed');
      }
      const seed = Number(value);
      if (!Number.isInteger(seed)) {
        throw new Error(`Invalid --seed value: ${value}`);
      }
      options.seed = seed;
      i += 1;
      continue;
    }

    if (arg === '--scenario') {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error('Missing value for --scenario');
      }
      options.scenarioId = value;
      i += 1;
    }
  }

  return options;
}

export function createTraceSink(mode: TraceMode): { sink: TraceSink; buffer?: TraceBuffer } {
  if (mode === 'off') {
    return { sink: new NoopTraceSink() };
  }

  const buffer = new TraceBuffer();
  return { sink: buffer, buffer };
}

export function runStubSession(sink: TraceSink, options: Pick<CliOptions, 'seed' | 'scenarioId'>): void {
  sink.emit({
    kind: 'trace.start',
    version: TRACE_SCHEMA_VERSION,
    seed: options.seed,
    scenarioId: options.scenarioId,
  });
  sink.emit({ kind: 'debug.note', message: 'CORE-F01 scaffold ready' });
  sink.emit({ kind: 'trace.end' });
}

export function formatNdjsonTrace(entries: readonly GameTraceEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  return `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
}

export function runCli(options: CliOptions): { exitCode: number; stdout: string } {
  const { sink, buffer } = createTraceSink(options.trace);
  runStubSession(sink, options);

  const stdout = options.trace === 'ndjson' && buffer ? formatNdjsonTrace(buffer.entries) : '';
  return { exitCode: 0, stdout };
}
