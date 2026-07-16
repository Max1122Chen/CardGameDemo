import { INPUT_ACTIONS, type TriggeredInputAction } from './input-action.js';
import { keyMatches, type ActiveMappingContext } from './input-mapping.js';
import type { ParsedKey } from './key-events.js';

/**
 * Resolve a key against active IMCs (highest priority first).
 * First matching mapping in a context wins; consume stops lower-priority contexts.
 */
export function resolveInput(
  activeContexts: readonly ActiveMappingContext[],
  key: ParsedKey,
): TriggeredInputAction[] {
  if (key.kind === 'unknown') {
    return [];
  }

  const sorted = [...activeContexts].sort((a, b) => b.priority - a.priority);
  const triggered: TriggeredInputAction[] = [];

  for (const { context } of sorted) {
    let matchedInContext = false;
    let consumeContext = false;

    for (const mapping of context.mappings) {
      if (!keyMatches(mapping.match, key)) {
        continue;
      }

      const def = INPUT_ACTIONS[mapping.actionId];
      if (!def) {
        continue;
      }

      matchedInContext = true;
      const event: TriggeredInputAction = { id: mapping.actionId };
      if (key.kind === 'char') {
        if (
          def.valueKind === 'char' ||
          mapping.match.type === 'any_char' ||
          mapping.match.type === 'place_char'
        ) {
          event.char = key.char;
        }
        if (def.valueKind === 'digit' || mapping.match.type === 'digit') {
          event.digit = Number(key.char);
        }
      }
      triggered.push(event);

      const consume = mapping.consume ?? def.consume;
      if (consume) {
        consumeContext = true;
      }
      // One mapping per key per context (declaration order = priority within IMC).
      break;
    }

    if (matchedInContext && consumeContext) {
      break;
    }
  }

  return triggered;
}
