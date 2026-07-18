export type DiceAdvantage = 'normal' | 'advantage' | 'disadvantage';

export type D20CheckInput = {
  /** Uniform [0, 1) RNG (seeded by host / session). */
  rng: () => number;
  /** Difficulty class — succeed if natural+modifier >= dc (unless nat 1/20). */
  dc: number;
  /** Flat bonus/penalty added after the die (attribute correction, etc.). */
  modifier?: number;
  mode?: DiceAdvantage;
};

export type D20CheckResult = {
  /** Natural die face used (1–20), after advantage/disadvantage pick. */
  natural: number;
  /** natural + modifier (for display; success may ignore this on crit). */
  total: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
  mode: DiceAdvantage;
  dc: number;
  modifier: number;
};

function rollFace(rng: () => number): number {
  return Math.floor(rng() * 20) + 1;
}

/**
 * d20 check per design/systems/random.md:
 * - natural 1 → fail; natural 20 → succeed
 * - else succeed when natural + modifier >= dc
 * - advantage / disadvantage pick max / min of two faces
 */
export function rollD20Check(input: D20CheckInput): D20CheckResult {
  const mode = input.mode ?? 'normal';
  const modifier = input.modifier ?? 0;
  const dc = input.dc;

  let natural: number;
  if (mode === 'normal') {
    natural = rollFace(input.rng);
  } else {
    const a = rollFace(input.rng);
    const b = rollFace(input.rng);
    natural = mode === 'advantage' ? Math.max(a, b) : Math.min(a, b);
  }

  const total = natural + modifier;
  const criticalFailure = natural === 1;
  const criticalSuccess = natural === 20;
  let success: boolean;
  if (criticalFailure) {
    success = false;
  } else if (criticalSuccess) {
    success = true;
  } else {
    success = total >= dc;
  }

  return {
    natural,
    total,
    success,
    criticalSuccess,
    criticalFailure,
    mode,
    dc,
    modifier,
  };
}

export function formatD20Check(result: D20CheckResult): string {
  const crit = result.criticalSuccess
    ? ' crit success'
    : result.criticalFailure
      ? ' crit fail'
      : '';
  const modeLabel = result.mode === 'normal' ? '' : ` ${result.mode}`;
  return `d20${modeLabel} ${result.natural}${result.modifier >= 0 ? '+' : ''}${result.modifier}=${result.total} vs DC ${result.dc} → ${result.success ? 'success' : 'fail'}${crit}`;
}
