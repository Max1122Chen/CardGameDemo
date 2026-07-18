import { createAbandonedForge } from './forge.js';
import { createBeggar } from './beggar.js';
import { createBloodAltar } from './altar.js';
import { createLifeFountain } from './fountain.js';
import { createSpikeTrap } from './trap.js';
import type { Interactable } from './types.js';

/** Default Interactables for level.probe (F01 + F02 samples). */
export function defaultProbeInteractables(): Record<string, Interactable[]> {
  return {
    start: [createLifeFountain('fountain.start'), createBeggar('beggar.start')],
    hall_a: [createSpikeTrap('trap.hall_a')],
    hall_b: [createBloodAltar('altar.hall_b')],
    exit: [createAbandonedForge('forge.exit')],
  };
}

/** Minimal mount for generated levels: fountain in the start room. */
export function defaultGeneratedInteractables(startRoomId: string): Record<string, Interactable[]> {
  return {
    [startRoomId]: [createLifeFountain(`fountain.${startRoomId}`)],
  };
}
