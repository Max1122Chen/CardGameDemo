import type { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { GameplayAbilityTagGates } from './types.js';

export type TagGateRole = 'owner' | 'source' | 'target';

function requiredKey(role: TagGateRole): 'activationRequiredTags' | 'sourceRequiredTags' | 'targetRequiredTags' {
  switch (role) {
    case 'owner':
      return 'activationRequiredTags';
    case 'source':
      return 'sourceRequiredTags';
    case 'target':
      return 'targetRequiredTags';
  }
}

function blockedKey(role: TagGateRole): 'activationBlockedTags' | 'sourceBlockedTags' | 'targetBlockedTags' {
  switch (role) {
    case 'owner':
      return 'activationBlockedTags';
    case 'source':
      return 'sourceBlockedTags';
    case 'target':
      return 'targetBlockedTags';
  }
}

export function gatesNeedEntity(gates: GameplayAbilityTagGates, role: TagGateRole): boolean {
  const required = gates[requiredKey(role)] ?? [];
  const blocked = gates[blockedKey(role)] ?? [];
  return required.length > 0 || blocked.length > 0;
}

export function evaluateTagGates(
  manager: GameplayTagManager,
  gates: GameplayAbilityTagGates,
  role: TagGateRole,
  container: GameplayTagContainer | undefined,
): boolean {
  const required = gates[requiredKey(role)] ?? [];
  const blocked = gates[blockedKey(role)] ?? [];

  if (required.length > 0 && !container) {
    return false;
  }

  for (const tagName of required) {
    if (!container?.has(manager.resolve(tagName))) {
      return false;
    }
  }

  for (const tagName of blocked) {
    if (container?.has(manager.resolve(tagName))) {
      return false;
    }
  }

  return true;
}
