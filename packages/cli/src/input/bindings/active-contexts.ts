import type { AppState } from '../../types.js';
import type { ActiveMappingContext } from '../input-mapping.js';
import {
  IMC_Console,
  IMC_Explore,
  IMC_Gameplay,
  IMC_Global,
  IMC_Inventory,
  IMC_Settings,
  IMC_Stats,
} from './contexts.js';
import { isExplorePhase } from '../../ui-mode.js';

/**
 * Build the active IMC stack from UI focus.
 * Higher priority wins; consume stops lower contexts.
 */
export function activeContextsForState(state: AppState): ActiveMappingContext[] {
  const active: ActiveMappingContext[] = [{ context: IMC_Global, priority: 0 }];

  if (state.focusLayer === 'console') {
    active.push({ context: IMC_Console, priority: 100 });
    return active;
  }

  if (state.focusLayer === 'inventory') {
    active.push({ context: IMC_Inventory, priority: 50 });
    return active;
  }

  if (state.focusLayer === 'settings') {
    active.push({ context: IMC_Settings, priority: 40 });
    return active;
  }

  // Gameplay (+ optional stats modal above it for Esc).
  if (isExplorePhase(state)) {
    active.push({ context: IMC_Explore, priority: 25 });
  } else {
    active.push({ context: IMC_Gameplay, priority: 20 });
  }
  if (state.statsOverlay !== 'none') {
    active.push({ context: IMC_Stats, priority: 70 });
  }
  return active;
}
