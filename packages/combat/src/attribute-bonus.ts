import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GameplayFrameworkComponent } from '@cardgame/core';
import {
  CombatAttributes,
  type PrimaryAttributeBlock,
  type PrimaryAttributeName,
} from './combat-attributes.js';

export type AttributeBonusGrade = 'none' | 'A' | 'B' | 'C' | 'D';

export type AttributeBonusSpec = {
  grade: AttributeBonusGrade;
  stats: readonly PrimaryAttributeName[];
};

export type AttributeBonusGradeFactors = {
  bonus: number;
  punishment: number;
};

export type AttributeBonusConfig = {
  neutral: number;
  grades: Record<AttributeBonusGrade, AttributeBonusGradeFactors>;
};

export const DEFAULT_ATTRIBUTE_BONUS_CONFIG: AttributeBonusConfig = {
  neutral: 10,
  grades: {
    none: { bonus: 0, punishment: 0 },
    A: { bonus: 1.0, punishment: 1.0 },
    B: { bonus: 0.75, punishment: 0.5 },
    C: { bonus: 0.5, punishment: 0.5 },
    D: { bonus: 0.25, punishment: 0 },
  },
};

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'data', 'combat'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/combat)');
}

export function resolveCombatDataRoot(
  startDir = dirname(fileURLToPath(import.meta.url)),
): string {
  return join(findRepoRoot(startDir), 'data', 'combat');
}

export function loadAttributeBonusConfig(
  dataRoot = resolveCombatDataRoot(),
): AttributeBonusConfig {
  const path = join(dataRoot, 'attribute-bonus.json');
  if (!existsSync(path)) {
    return DEFAULT_ATTRIBUTE_BONUS_CONFIG;
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as AttributeBonusConfig;
  return {
    ...DEFAULT_ATTRIBUTE_BONUS_CONFIG,
    ...parsed,
    grades: { ...DEFAULT_ATTRIBUTE_BONUS_CONFIG.grades, ...parsed.grades },
  };
}

export function sumPrimaryStats(
  gfc: GameplayFrameworkComponent,
  stats: readonly PrimaryAttributeName[],
): number {
  let total = 0;
  for (const stat of stats) {
    total += gfc.getAttribute(stat)?.currentValue ?? 0;
  }
  return total;
}

/** Signed attribute bonus: +bonus above neutral, -punishment below. */
export function computeAttributeBonus(
  spec: AttributeBonusSpec | undefined,
  statSum: number,
  config: AttributeBonusConfig = DEFAULT_ATTRIBUTE_BONUS_CONFIG,
): number {
  if (!spec || spec.grade === 'none' || spec.stats.length === 0) {
    return 0;
  }
  const factors = config.grades[spec.grade];
  if (!factors) {
    return 0;
  }
  const d = statSum - config.neutral;
  if (d >= 0) {
    return Math.floor(d * factors.bonus);
  }
  const punished = Math.floor(Math.abs(d) * factors.punishment);
  return punished > 0 ? -punished : 0;
}

export function computeAttributeBonusForEntity(
  spec: AttributeBonusSpec | undefined,
  gfc: GameplayFrameworkComponent,
  config: AttributeBonusConfig = DEFAULT_ATTRIBUTE_BONUS_CONFIG,
): number {
  if (!spec) {
    return 0;
  }
  const statSum = sumPrimaryStats(gfc, spec.stats);
  return computeAttributeBonus(spec, statSum, config);
}

export function readPrimaryBlock(gfc: GameplayFrameworkComponent): PrimaryAttributeBlock {
  return {
    [CombatAttributes.Strength]: gfc.getAttribute(CombatAttributes.Strength)?.currentValue ?? 0,
    [CombatAttributes.Constitution]:
      gfc.getAttribute(CombatAttributes.Constitution)?.currentValue ?? 0,
    [CombatAttributes.Dexterity]: gfc.getAttribute(CombatAttributes.Dexterity)?.currentValue ?? 0,
    [CombatAttributes.Intelligence]:
      gfc.getAttribute(CombatAttributes.Intelligence)?.currentValue ?? 0,
    [CombatAttributes.Wisdom]: gfc.getAttribute(CombatAttributes.Wisdom)?.currentValue ?? 0,
    [CombatAttributes.Charisma]: gfc.getAttribute(CombatAttributes.Charisma)?.currentValue ?? 0,
  };
}
