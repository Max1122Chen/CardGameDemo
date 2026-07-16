import { describe, expect, it } from 'vitest';

import { RuleEngine } from '../engine/rule-engine.js';
import { resolveModifierMagnitude } from '../gfc/attribute-evaluation.js';

describe('CORE-F11 SetByCaller', () => {
  it('resolves SetByCaller magnitude from application context', () => {
    const value = resolveModifierMagnitude(
      { kind: 'SetByCaller', key: 'Data.Damage' },
      {
        instigatorEntityId: 'p',
        setByCaller: { 'Data.Damage': 6 },
      },
      () => undefined,
    );
    expect(value).toBe(6);
  });

  it('throws when SetByCaller key is missing', () => {
    expect(() =>
      resolveModifierMagnitude(
        { kind: 'SetByCaller', key: 'Data.Missing' },
        { instigatorEntityId: 'p', setByCaller: {} },
        () => undefined,
      ),
    ).toThrow(/missing key/);
  });
});
