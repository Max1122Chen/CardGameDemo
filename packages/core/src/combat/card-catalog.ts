import type { CardActionId } from './types.js';

export type CardActionSpec = {
  id: CardActionId;
  name: string;
  cost: number;
  damage?: number;
  block?: number;
};

export const CARD_CATALOG: Record<CardActionId, CardActionSpec> = {
  strike: { id: 'strike', name: 'Strike', cost: 1, damage: 6 },
  defend: { id: 'defend', name: 'Defend', cost: 1, block: 5 },
  bash: { id: 'bash', name: 'Bash', cost: 2, damage: 8 },
};

export const STARTER_DECK: readonly CardActionId[] = [
  'strike',
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'bash',
];

export function getCardSpec(actionId: CardActionId): CardActionSpec {
  return CARD_CATALOG[actionId];
}
