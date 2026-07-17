import type { GameTraceEntry, TraceSink } from '@cardgame/core';
import { NoopTraceSink, TRACE_SCHEMA_VERSION, TraceBuffer } from '@cardgame/core';

import { runAppShell } from './app-shell.js';
import { createNodeTerminalIO } from './terminal/terminal-io.js';

export type TraceMode = 'off' | 'ndjson';
export type CliRuntimeMode = 'trace' | 'battle' | 'debug' | 'dungeon';

export type CliOptions = {
  mode: CliRuntimeMode;
  trace: TraceMode;
  seed?: number;
  scenarioId?: string;
  enemyId?: string;
};

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = { mode: 'trace', trace: 'off' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--mode') {
      const value = argv[i + 1];
      if (value !== 'trace' && value !== 'battle' && value !== 'debug' && value !== 'dungeon') {
        throw new Error(
          `Invalid --mode value: ${value ?? '(missing)'}. Use "trace", "battle", "debug", or "dungeon".`,
        );
      }
      options.mode = value;
      i += 1;
      continue;
    }

    if (arg === 'battle' || arg === 'debug' || arg === 'trace' || arg === 'dungeon') {
      options.mode = arg;
      // Optional enemy id after battle: `battle orc_brute`
      if (arg === 'battle' || arg === 'dungeon') {
        const next = argv[i + 1];
        if (next && !next.startsWith('-') && next !== 'trace' && next !== 'battle' && next !== 'debug' && next !== 'dungeon') {
          if (arg === 'battle') {
            options.enemyId = next;
          }
          i += 1;
        }
      }
      continue;
    }

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

export async function runTuiCli(options: CliOptions): Promise<number> {
  if (options.mode !== 'battle' && options.mode !== 'debug' && options.mode !== 'dungeon') {
    throw new Error(`runTuiCli requires battle, debug, or dungeon mode, got ${options.mode}`);
  }

  return runAppShell(options, createNodeTerminalIO());
}
