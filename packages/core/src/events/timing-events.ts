import type { RuleEngine } from '../engine/rule-engine.js';
import { createGameplayEvent } from './gameplay-event.js';
import type { GameplayEventChannel } from './gameplay-event-channel.js';

export const TIMING_TURN_END_TAG = 'Timing.TurnEnd';

/** Dispatch a turn-end timing event on the given channel (for Duration GE unitTag). */
export function emitTurnEndTimingEvent(
  engine: RuleEngine,
  channel: GameplayEventChannel,
  payload?: Record<string, unknown>,
): void {
  engine.eventSystem.dispatch(
    channel,
    createGameplayEvent(engine.tagManager, {
      tags: [engine.tagManager.resolve(TIMING_TURN_END_TAG)],
      payload,
    }),
  );
}
