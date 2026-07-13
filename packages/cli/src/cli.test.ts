import { describe, expect, it } from 'vitest';

import { formatNdjsonTrace, parseCliArgs, runCli } from './cli.js';

describe('parseCliArgs', () => {
  it('defaults trace to off', () => {
    expect(parseCliArgs([])).toEqual({ trace: 'off' });
  });

  it('parses trace, seed, and scenario', () => {
    expect(parseCliArgs(['--trace', 'ndjson', '--seed', '42', '--scenario', 'basic-duel'])).toEqual({
      trace: 'ndjson',
      seed: 42,
      scenarioId: 'basic-duel',
    });
  });

  it('rejects invalid trace mode', () => {
    expect(() => parseCliArgs(['--trace', 'pretty'])).toThrow(/Invalid --trace/);
  });
});

describe('runCli', () => {
  it('emits ndjson trace lines on stdout payload', () => {
    const result = runCli({ trace: 'ndjson', seed: 7, scenarioId: 'probe' });

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
    const result = runCli({ trace: 'off' });
    expect(result.stdout).toBe('');
    expect(result.exitCode).toBe(0);
  });
});
