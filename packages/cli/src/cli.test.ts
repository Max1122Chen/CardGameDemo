import { describe, expect, it } from 'vitest';

import { formatNdjsonTrace, parseCliArgs, runCli } from './cli.js';

describe('parseCliArgs', () => {
  it('defaults to trace mode with trace off', () => {
    expect(parseCliArgs([])).toEqual({ mode: 'trace', trace: 'off' });
  });

  it('parses mode, trace, seed, and scenario', () => {
    expect(parseCliArgs(['battle', '--trace', 'ndjson', '--seed', '42', '--scenario', 'basic-duel'])).toEqual({
      mode: 'battle',
      trace: 'ndjson',
      seed: 42,
      scenarioId: 'basic-duel',
    });
  });

  it('parses battle enemy id', () => {
    expect(parseCliArgs(['battle', 'orc_brute'])).toEqual({
      mode: 'battle',
      trace: 'off',
      enemyId: 'orc_brute',
    });
  });

  it('parses dungeon mode', () => {
    expect(parseCliArgs(['dungeon'])).toEqual({ mode: 'dungeon', trace: 'off' });
  });

  it('parses --mode debug', () => {
    expect(parseCliArgs(['--mode', 'debug'])).toEqual({ mode: 'debug', trace: 'off' });
  });

  it('rejects invalid trace mode', () => {
    expect(() => parseCliArgs(['--trace', 'pretty'])).toThrow(/Invalid --trace/);
  });

  it('rejects invalid runtime mode', () => {
    expect(() => parseCliArgs(['--mode', 'gui'])).toThrow(/Invalid --mode/);
  });
});

describe('runCli', () => {
  it('emits ndjson trace lines on stdout payload', () => {
    const result = runCli({ mode: 'trace', trace: 'ndjson', seed: 7, scenarioId: 'probe' });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      formatNdjsonTrace([
        { kind: 'trace.start', t: 0, version: 1, seed: 7, scenarioId: 'probe' },
        { kind: 'debug.note', t: 1, message: 'CORE-F01 scaffold ready' },
        { kind: 'trace.end', t: 2 },
      ]),
    );
  });

  it('returns empty stdout when trace is off', () => {
    const result = runCli({ mode: 'trace', trace: 'off' });
    expect(result.stdout).toBe('');
    expect(result.exitCode).toBe(0);
  });
});
