import { GameplayAbilityError } from './types.js';

export type AbilityParameterValue = number | boolean;

export type AbilityParameterSchemaEntry = {
  type: 'number' | 'boolean';
  default?: AbilityParameterValue;
};

export type AbilityParameterSchema = Readonly<Record<string, AbilityParameterSchemaEntry>>;

/** Resolve `"$Damage"` → parameter value; bare numbers are not supported in bind maps (keys map to `$Name`). */
export function resolveBindingMap(
  bind: Readonly<Record<string, string>> | undefined,
  parameters: Readonly<Record<string, AbilityParameterValue>>,
): Record<string, number> {
  if (!bind) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [setByCallerKey, ref] of Object.entries(bind)) {
    if (!ref.startsWith('$')) {
      throw new GameplayAbilityError(
        `Binding for ${setByCallerKey} must be a $Parameter ref, got: ${ref}`,
      );
    }
    const paramName = ref.slice(1);
    const value = parameters[paramName];
    if (value === undefined) {
      throw new GameplayAbilityError(`Missing parameter for binding ${ref}`);
    }
    if (typeof value !== 'number') {
      throw new GameplayAbilityError(`Parameter ${paramName} must be number for SetByCaller bind`);
    }
    out[setByCallerKey] = value;
  }
  return out;
}

export function mergeParameterValues(
  schema: AbilityParameterSchema | undefined,
  overrides: Readonly<Record<string, AbilityParameterValue>> | undefined,
): Record<string, AbilityParameterValue> {
  const merged: Record<string, AbilityParameterValue> = {};
  if (schema) {
    for (const [name, entry] of Object.entries(schema)) {
      if (entry.default !== undefined) {
        merged[name] = entry.default;
      }
    }
  }
  if (overrides) {
    for (const [name, value] of Object.entries(overrides)) {
      merged[name] = value;
    }
  }
  return merged;
}

/** Skip bindings whose `$Param` is missing or undefined (optional card parameters). */
export function resolveBindingMapOptional(
  bind: Readonly<Record<string, string>> | undefined,
  parameters: Readonly<Record<string, AbilityParameterValue>>,
): Record<string, number> | undefined {
  if (!bind) {
    return undefined;
  }
  const out: Record<string, number> = {};
  let any = false;
  for (const [setByCallerKey, ref] of Object.entries(bind)) {
    if (!ref.startsWith('$')) {
      throw new GameplayAbilityError(
        `Binding for ${setByCallerKey} must be a $Parameter ref, got: ${ref}`,
      );
    }
    const paramName = ref.slice(1);
    const value = parameters[paramName];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'number') {
      throw new GameplayAbilityError(`Parameter ${paramName} must be number for SetByCaller bind`);
    }
    out[setByCallerKey] = value;
    any = true;
  }
  return any ? out : undefined;
}
