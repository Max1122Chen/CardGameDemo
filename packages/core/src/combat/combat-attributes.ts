/** Combat attribute keys used by GFC-backed numerics. */
export const CombatAttributes = {
  Health: 'Health',
  Block: 'Block',
  ActionPoints: 'ActionPoints',
  Damage: 'Damage',
  DamageToTake: 'DamageToTake',
  BlockToGain: 'BlockToGain',
} as const;

export type CombatAttributeName = (typeof CombatAttributes)[keyof typeof CombatAttributes];
