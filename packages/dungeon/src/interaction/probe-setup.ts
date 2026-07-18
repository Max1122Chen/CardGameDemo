import { createBeggar } from './beggar.js';
import { createLifeFountain } from './fountain.js';
import type { Interactable } from './types.js';

/** Default Interactables for level.probe start room (F01 samples). */
export function defaultProbeInteractables(): Record<string, Interactable[]> {
  return {
    start: [createLifeFountain('fountain.start'), createBeggar('beggar.start')],
  };
}
