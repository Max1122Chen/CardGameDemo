import type { InputActionId } from './input-action.js';
import type { ParsedKey } from './key-events.js';

export type KeyMatch =
  | { type: 'kind'; kind: Exclude<ParsedKey['kind'], 'char' | 'unknown'> }
  | { type: 'char'; char: string; ignoreCase?: boolean }
  | { type: 'digit' }
  | { type: 'any_char' }
  | { type: 'place_char' };

export type InputMapping = {
  actionId: InputActionId;
  match: KeyMatch;
  /** Override action consume when set. */
  consume?: boolean;
};

export type InputMappingContext = {
  id: string;
  mappings: readonly InputMapping[];
};

export type ActiveMappingContext = {
  context: InputMappingContext;
  priority: number;
};

export function keyMatches(match: KeyMatch, key: ParsedKey): boolean {
  switch (match.type) {
    case 'kind':
      return key.kind === match.kind;
    case 'char':
      if (key.kind !== 'char') {
        return false;
      }
      if (match.ignoreCase) {
        return key.char.toLowerCase() === match.char.toLowerCase();
      }
      return key.char === match.char;
    case 'digit':
      if (key.kind !== 'char') {
        return false;
      }
      return key.char >= '1' && key.char <= '9';
    case 'any_char':
      return key.kind === 'char';
    case 'place_char':
      return key.kind === 'char' && /[0-9 ]/.test(key.char);
    default:
      return false;
  }
}
