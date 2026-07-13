import { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';

export type GameplayEventPayload = Record<string, unknown>;

export type GameplayEvent = {
  tags: GameplayTagContainer;
  payload?: GameplayEventPayload;
};

export type CreateGameplayEventInput = {
  tags?: readonly GameplayTag[];
  payload?: GameplayEventPayload;
};

export function createGameplayEvent(
  manager: GameplayTagManager,
  input: CreateGameplayEventInput = {},
): GameplayEvent {
  const container = new GameplayTagContainer({ manager });

  for (const tag of input.tags ?? []) {
    container.add(tag);
  }

  if (input.payload === undefined) {
    return { tags: container };
  }

  return { tags: container, payload: input.payload };
}
