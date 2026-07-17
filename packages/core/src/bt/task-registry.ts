import type { BtStatus } from './types.js';
import type { Blackboard } from './blackboard.js';

export type BehaviorTreeTaskContext = {
  blackboard: Blackboard;
};

export type BehaviorTreeTaskHandler = (
  ctx: BehaviorTreeTaskContext,
  params: Record<string, unknown>,
) => BtStatus;

export class BehaviorTreeTaskRegistry {
  private readonly handlers = new Map<string, BehaviorTreeTaskHandler>();

  register(actionId: string, handler: BehaviorTreeTaskHandler): void {
    if (this.handlers.has(actionId)) {
      throw new Error(`Behavior tree task already registered: ${actionId}`);
    }
    this.handlers.set(actionId, handler);
  }

  run(actionId: string, ctx: BehaviorTreeTaskContext, params: Record<string, unknown>): BtStatus {
    const handler = this.handlers.get(actionId);
    if (!handler) {
      return 'Failure';
    }
    return handler(ctx, params);
  }

  has(actionId: string): boolean {
    return this.handlers.has(actionId);
  }
}
