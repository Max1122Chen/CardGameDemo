import type { EntityId } from '../engine/component-type.js';
import type { GameplayTagContainer } from '../tags/gameplay-tag-container.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { GameplayEffectApplicationContext, OngoingTagRequirements } from './types.js';

export function ongoingRequirementsNeedEntity(
  requirements: OngoingTagRequirements | undefined,
  side: 'source' | 'target',
): boolean {
  if (!requirements) {
    return false;
  }

  if (side === 'source') {
    return (
      (requirements.sourceRequiredTags?.length ?? 0) > 0 ||
      (requirements.sourceBlockedTags?.length ?? 0) > 0
    );
  }

  return (
    (requirements.targetRequiredTags?.length ?? 0) > 0 ||
    (requirements.targetBlockedTags?.length ?? 0) > 0
  );
}

export function resolveOngoingEntityId(
  side: 'source' | 'target',
  context: GameplayEffectApplicationContext,
  hostEntityId: EntityId,
): EntityId | undefined {
  if (side === 'source') {
    return context.sourceEntityId ?? context.instigatorEntityId;
  }
  return context.targetEntityId ?? hostEntityId;
}

function evaluateSide(
  manager: GameplayTagManager,
  required: readonly string[] | undefined,
  blocked: readonly string[] | undefined,
  container: GameplayTagContainer | undefined,
): boolean {
  const needsContainer = (required?.length ?? 0) > 0;
  if (needsContainer && !container) {
    return false;
  }

  for (const tagName of required ?? []) {
    if (!container?.has(manager.resolve(tagName))) {
      return false;
    }
  }

  for (const tagName of blocked ?? []) {
    if (container?.has(manager.resolve(tagName))) {
      return false;
    }
  }

  return true;
}

export function evaluateOngoingTagRequirements(
  manager: GameplayTagManager,
  requirements: OngoingTagRequirements | undefined,
  context: GameplayEffectApplicationContext,
  hostEntityId: EntityId,
  resolveTags: (entityId: EntityId) => GameplayTagContainer | undefined,
): boolean {
  if (!requirements) {
    return true;
  }

  if (ongoingRequirementsNeedEntity(requirements, 'source')) {
    const sourceId = resolveOngoingEntityId('source', context, hostEntityId);
    if (!sourceId) {
      return false;
    }
    if (
      !evaluateSide(
        manager,
        requirements.sourceRequiredTags,
        requirements.sourceBlockedTags,
        resolveTags(sourceId),
      )
    ) {
      return false;
    }
  }

  if (ongoingRequirementsNeedEntity(requirements, 'target')) {
    const targetId = resolveOngoingEntityId('target', context, hostEntityId);
    if (!targetId) {
      return false;
    }
    if (
      !evaluateSide(
        manager,
        requirements.targetRequiredTags,
        requirements.targetBlockedTags,
        resolveTags(targetId),
      )
    ) {
      return false;
    }
  }

  return true;
}
