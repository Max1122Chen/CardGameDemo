import type { GameplayAbilityDefinition } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';

import { CombatAttributes } from './combat-attributes.js';
import { resetCombatMeta } from './take-damage.js';

/** Infinite GEs that survive between encounters on the adventure player. */
export const PERSISTENT_INFINITE_GE_IDS = new Set([
  'ge.combat.damage.pipeline',
  'ge.combat.damage-to-take.identity',
]);

const TRANSIENT_INFINITE_GE_PREFIXES = ['ge.combat.', 'ge.buff.', 'ge.status.'] as const;

function isTransientCombatEffect(definitionId: string): boolean {
  if (PERSISTENT_INFINITE_GE_IDS.has(definitionId)) {
    return false;
  }
  return TRANSIENT_INFINITE_GE_PREFIXES.some((prefix) => definitionId.startsWith(prefix));
}

/** Clear combat meta attrs and combat-scoped GEs; preserve Health and primaries. */
export function clearCombatTransientState(gfc: GameplayFrameworkComponent): void {
  resetCombatMeta(gfc);
  for (const effect of [...gfc.listActiveEffects()]) {
    if (!isTransientCombatEffect(effect.definition.id)) {
      continue;
    }
    // Drop Infinite / Duration combat buffs left mid-fight; keep pipeline Infinite GEs.
    if (
      effect.definition.duration.kind === 'Infinite' ||
      effect.definition.duration.kind === 'Duration'
    ) {
      gfc.removeGameplayEffect(effect.id);
    }
  }
  gfc.setAttributeBase(CombatAttributes.Block, 0);
}

export function isPlayerCombatReady(gfc: GameplayFrameworkComponent): boolean {
  return gfc.getAttribute(CombatAttributes.MaxHealth)?.currentValue !== undefined;
}

export function resolveTakeDamageHandle(
  gfc: GameplayFrameworkComponent,
  takeDamageAbility: GameplayAbilityDefinition,
): string {
  const existing = gfc
    .listGrantedAbilities()
    .find((entry) => entry.abilityDefId === takeDamageAbility.id);
  if (existing) {
    return existing.handle;
  }
  return gfc.grantAbility(takeDamageAbility);
}

/** Prepare an existing adventure player GFC for a new encounter. */
export function refreshPlayerForEncounter(
  gfc: GameplayFrameworkComponent,
  options: {
    actionPointsPerTurn: number;
    takeDamageAbility: GameplayAbilityDefinition;
  },
): string {
  clearCombatTransientState(gfc);
  gfc.setAttributeBase(CombatAttributes.ActionPoints, options.actionPointsPerTurn);
  return resolveTakeDamageHandle(gfc, options.takeDamageAbility);
}
