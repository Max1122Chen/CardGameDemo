import type { GameplayTag } from '../tags/gameplay-tag.js';

export type GameplayEventChannel = {
  readonly tag: GameplayTag;
  readonly name: string;
};

export function createGameplayEventChannel(tag: GameplayTag): GameplayEventChannel {
  return {
    tag,
    name: tag.name,
  };
}
