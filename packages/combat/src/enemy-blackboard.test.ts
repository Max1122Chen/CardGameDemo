import { describe, expect, it } from 'vitest';

import { computeEnemyHpThresholds } from './enemy-blackboard.js';

describe('enemy blackboard thresholds', () => {
  it('higher Intelligence defends earlier and finishes player earlier', () => {
    const low = computeEnemyHpThresholds(4);
    const orc = computeEnemyHpThresholds(6);
    const high = computeEnemyHpThresholds(12);

    expect(orc.selfLowHpThreshold).toBeLessThan(low.selfLowHpThreshold);
    expect(high.selfLowHpThreshold).toBeLessThan(orc.selfLowHpThreshold);
    expect(orc.playerLowHpThreshold).toBeLessThan(low.playerLowHpThreshold);
    expect(high.playerLowHpThreshold).toBeLessThan(orc.playerLowHpThreshold);
  });

  it('clamps extreme Intelligence values', () => {
    expect(computeEnemyHpThresholds(0).selfLowHpThreshold).toBe(0.48);
    expect(computeEnemyHpThresholds(100).selfLowHpThreshold).toBe(0.22);
  });
});
