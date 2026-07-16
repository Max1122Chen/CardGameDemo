import { describe, expect, it } from 'vitest';

import {
  computeAttributeBonus,
  DEFAULT_ATTRIBUTE_BONUS_CONFIG,
} from './attribute-bonus.js';
import { CombatAttributes } from './combat-attributes.js';

describe('attribute bonus', () => {
  it('returns zero for none grade or empty stats', () => {
    expect(
      computeAttributeBonus({ grade: 'none', stats: [CombatAttributes.Strength] }, 12),
    ).toBe(0);
    expect(computeAttributeBonus(undefined, 12)).toBe(0);
  });

  it('applies bonus above neutral', () => {
    expect(
      computeAttributeBonus(
        { grade: 'A', stats: [CombatAttributes.Strength] },
        12,
        DEFAULT_ATTRIBUTE_BONUS_CONFIG,
      ),
    ).toBe(2);
    expect(
      computeAttributeBonus(
        { grade: 'B', stats: [CombatAttributes.Strength] },
        12,
        DEFAULT_ATTRIBUTE_BONUS_CONFIG,
      ),
    ).toBe(1);
  });

  it('applies punishment below neutral', () => {
    expect(
      computeAttributeBonus(
        { grade: 'A', stats: [CombatAttributes.Strength] },
        8,
        DEFAULT_ATTRIBUTE_BONUS_CONFIG,
      ),
    ).toBe(-2);
    expect(
      computeAttributeBonus(
        { grade: 'D', stats: [CombatAttributes.Strength] },
        8,
        DEFAULT_ATTRIBUTE_BONUS_CONFIG,
      ),
    ).toBe(0);
  });

  it('sums multiple stats before grade factors', () => {
    expect(
      computeAttributeBonus(
        { grade: 'A', stats: [CombatAttributes.Strength, CombatAttributes.Dexterity] },
        22,
        DEFAULT_ATTRIBUTE_BONUS_CONFIG,
      ),
    ).toBe(12);
  });
});
