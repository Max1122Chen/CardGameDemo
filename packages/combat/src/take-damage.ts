import type { GameplayAbilityDefinition, GameplayTagManager } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';
import { CombatAttributes } from './combat-attributes.js';
import {
  bootstrapCombatEntity,
  DEFAULT_ENEMY_PRIMARIES,
  DEFAULT_PLAYER_PRIMARIES,
  type CombatEntityBootstrapOptions,
} from './combat-entity-bootstrap.js';
import { settleTakeDamageOnEntity } from './settle-take-damage.js';

export { registerCombatAttributeClamps } from './combat-entity-bootstrap.js';
export { DEFAULT_ENEMY_PRIMARIES, DEFAULT_PLAYER_PRIMARIES };

/** Settle Block then Health from DamageToTake using Instant GE only. */
export function settleTakeDamage(target: GameplayFrameworkComponent): {
  blocked: number;
  healthLost: number;
} {
  return settleTakeDamageOnEntity(target);
}

export function resetCombatMeta(entity: GameplayFrameworkComponent): void {
  entity.applyGameplayEffect({
    id: 'ge.combat.meta.reset',
    duration: { kind: 'Instant' },
    modifiers: [
      { attribute: CombatAttributes.Damage, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.DamageToTake, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.BlockToGain, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.DamageScaling, op: 'Override', magnitude: 1 },
      { attribute: CombatAttributes.DamageMultiplier, op: 'Override', magnitude: 1 },
      { attribute: CombatAttributes.DamageOffset, op: 'Override', magnitude: 0 },
    ],
  });
}

export function bootstrapCombatAttributes(
  gfc: GameplayFrameworkComponent,
  options: {
    health: number;
    block?: number;
    actionPoints?: number;
    maxActionPoints?: number;
    primaries?: CombatEntityBootstrapOptions['primaries'];
    takeDamageAbility: GameplayAbilityDefinition;
  },
  tagManager: GameplayTagManager,
): string {
  const maxAp = options.maxActionPoints ?? options.actionPoints;
  return bootstrapCombatEntity(
    gfc,
    {
      maxHealth: options.health,
      block: options.block,
      maxActionPoints: maxAp,
      actionPoints: options.actionPoints ?? maxAp,
      primaries: options.primaries,
      takeDamageAbility: options.takeDamageAbility,
    },
    tagManager,
  );
}
