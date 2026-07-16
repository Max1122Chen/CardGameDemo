/** Combat attribute keys used by GFC-backed numerics. */
export const CombatAttributes = {
  MaxHealth: 'MaxHealth',
  Health: 'Health',
  MaxActionPoints: 'MaxActionPoints',
  ActionPoints: 'ActionPoints',
  Strength: 'Strength',
  Constitution: 'Constitution',
  Dexterity: 'Dexterity',
  Intelligence: 'Intelligence',
  Wisdom: 'Wisdom',
  Charisma: 'Charisma',
  Damage: 'Damage',
  DamageScaling: 'DamageScaling',
  DamageMultiplier: 'DamageMultiplier',
  DamageOffset: 'DamageOffset',
  DamageToTake: 'DamageToTake',
  Block: 'Block',
  BlockToGain: 'BlockToGain',
} as const;

export type CombatAttributeName = (typeof CombatAttributes)[keyof typeof CombatAttributes];

export const PrimaryAttributes = [
  CombatAttributes.Strength,
  CombatAttributes.Constitution,
  CombatAttributes.Dexterity,
  CombatAttributes.Intelligence,
  CombatAttributes.Wisdom,
  CombatAttributes.Charisma,
] as const;

export type PrimaryAttributeName = (typeof PrimaryAttributes)[number];

export type PrimaryAttributeBlock = Readonly<Record<PrimaryAttributeName, number>>;

export const DEFAULT_PRIMARY_ATTRIBUTES: PrimaryAttributeBlock = {
  [CombatAttributes.Strength]: 10,
  [CombatAttributes.Constitution]: 10,
  [CombatAttributes.Dexterity]: 10,
  [CombatAttributes.Intelligence]: 10,
  [CombatAttributes.Wisdom]: 10,
  [CombatAttributes.Charisma]: 10,
};

export const DEFAULT_PLAYER_PRIMARIES: PrimaryAttributeBlock = {
  ...DEFAULT_PRIMARY_ATTRIBUTES,
  [CombatAttributes.Strength]: 12,
};

export const DEFAULT_ENEMY_PRIMARIES: PrimaryAttributeBlock = {
  [CombatAttributes.Strength]: 8,
  [CombatAttributes.Constitution]: 10,
  [CombatAttributes.Dexterity]: 6,
  [CombatAttributes.Intelligence]: 4,
  [CombatAttributes.Wisdom]: 6,
  [CombatAttributes.Charisma]: 4,
};
