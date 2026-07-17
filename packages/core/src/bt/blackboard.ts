import type { BlackboardValue } from './types.js';

export class Blackboard {
  private readonly values = new Map<string, BlackboardValue>();

  get(key: string): BlackboardValue | undefined {
    return this.values.get(key);
  }

  set(key: string, value: BlackboardValue): void {
    this.values.set(key, value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  clear(): void {
    this.values.clear();
  }
}
