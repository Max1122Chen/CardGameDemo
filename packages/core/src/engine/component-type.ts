export type EntityId = string;

export type ComponentType<T> = symbol & { readonly __componentType?: T };

export function defineComponentType<T>(name: string): ComponentType<T> {
  return Symbol(name) as ComponentType<T>;
}
