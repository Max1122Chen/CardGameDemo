import type { Blackboard } from './blackboard.js';
import type { BehaviorTreeRunState } from './run-state.js';
import type { BehaviorTreeTaskRegistry } from './task-registry.js';
import type { BlackboardValue, BlackboardCompareOp, BtNode, BtStatus } from './types.js';

export type BehaviorTreeContext = {
  blackboard: Blackboard;
  tasks: BehaviorTreeTaskRegistry;
  /** When set, stop after this many leaf nodes (Task/Wait/BlackboardCompare) execute. */
  leafBudget?: { remaining: number };
};

export type TickBehaviorTreeOptions = {
  leafBudget?: number;
};

function invertStatus(status: BtStatus): BtStatus {
  if (status === 'Success') {
    return 'Failure';
  }
  if (status === 'Failure') {
    return 'Success';
  }
  return 'Running';
}

function compareBlackboard(
  left: BlackboardValue | undefined,
  op: BlackboardCompareOp,
  right: BlackboardValue,
): boolean {
  const actual = left;
  switch (op) {
    case 'eq':
      return actual === right;
    case 'ne':
      return actual !== right;
    case 'gt':
      return typeof actual === 'number' && typeof right === 'number' && actual > right;
    case 'gte':
      return typeof actual === 'number' && typeof right === 'number' && actual >= right;
    case 'lt':
      return typeof actual === 'number' && typeof right === 'number' && actual < right;
    case 'lte':
      return typeof actual === 'number' && typeof right === 'number' && actual <= right;
    default:
      return false;
  }
}

function consumeLeafBudget(ctx: BehaviorTreeContext): void {
  if (ctx.leafBudget) {
    ctx.leafBudget.remaining -= 1;
  }
}

function tickLeaf(node: BtNode, ctx: BehaviorTreeContext): BtStatus {
  switch (node.type) {
    case 'Task': {
      const status = ctx.tasks.run(node.actionId, ctx, node.params ?? {});
      if (status === 'Success' || status === 'Running') {
        consumeLeafBudget(ctx);
      }
      return status;
    }
    case 'Wait':
      consumeLeafBudget(ctx);
      return 'Success';
    case 'BlackboardCompare': {
      const actual = ctx.blackboard.get(node.key);
      const ok = compareBlackboard(actual, node.op, node.value);
      return ok ? 'Success' : 'Failure';
    }
    default:
      return 'Failure';
  }
}

export function tickNode(node: BtNode, ctx: BehaviorTreeContext, state: BehaviorTreeRunState): BtStatus {
  switch (node.type) {
    case 'Task':
    case 'Wait':
    case 'BlackboardCompare':
      return tickLeaf(node, ctx);

    case 'Sequence': {
      let index = state.sequenceIndex.get(node) ?? 0;
      while (index < node.children.length) {
        const child = node.children[index]!;
        const status = tickNode(child, ctx, state);
        if (status === 'Running') {
          state.sequenceIndex.set(node, index);
          return 'Running';
        }
        if (status === 'Failure') {
          state.sequenceIndex.set(node, 0);
          return 'Failure';
        }
        index += 1;
        if (index >= node.children.length) {
          state.sequenceIndex.set(node, 0);
          return 'Success';
        }
        if (ctx.leafBudget && ctx.leafBudget.remaining <= 0) {
          state.sequenceIndex.set(node, index);
          return 'Running';
        }
      }
      state.sequenceIndex.set(node, 0);
      return 'Success';
    }

    case 'Selector': {
      let index = state.selectorIndex.get(node) ?? 0;
      while (index < node.children.length) {
        const child = node.children[index]!;
        const status = tickNode(child, ctx, state);
        if (status === 'Running') {
          state.selectorIndex.set(node, index);
          return 'Running';
        }
        if (status === 'Success') {
          state.selectorIndex.set(node, 0);
          return 'Success';
        }
        index += 1;
        if (ctx.leafBudget && ctx.leafBudget.remaining <= 0) {
          state.selectorIndex.set(node, index);
          return 'Running';
        }
      }
      state.selectorIndex.set(node, 0);
      return 'Failure';
    }

    case 'Repeat': {
      const status = tickNode(node.child, ctx, state);
      if (status === 'Running') {
        return 'Running';
      }
      if (status === 'Failure') {
        return 'Failure';
      }
      resetChildState(node.child, state);
      return 'Running';
    }

    case 'Inverter': {
      const status = tickNode(node.child, ctx, state);
      if (status === 'Running') {
        return 'Running';
      }
      return invertStatus(status);
    }

    case 'Succeed': {
      const status = tickNode(node.child, ctx, state);
      if (status === 'Running') {
        return 'Running';
      }
      return 'Success';
    }

    case 'Fail': {
      const status = tickNode(node.child, ctx, state);
      if (status === 'Running') {
        return 'Running';
      }
      return 'Failure';
    }

    default:
      return 'Failure';
  }
}

function resetChildState(node: BtNode, state: BehaviorTreeRunState): void {
  switch (node.type) {
    case 'Sequence':
      state.sequenceIndex.delete(node);
      for (const child of node.children) {
        resetChildState(child, state);
      }
      break;
    case 'Selector':
      state.selectorIndex.delete(node);
      for (const child of node.children) {
        resetChildState(child, state);
      }
      break;
    case 'Repeat':
    case 'Inverter':
    case 'Succeed':
    case 'Fail':
      resetChildState(node.child, state);
      break;
    default:
      break;
  }
}

export function tickBehaviorTree(
  root: BtNode,
  ctx: BehaviorTreeContext,
  state: BehaviorTreeRunState,
  options?: TickBehaviorTreeOptions,
): BtStatus {
  const leafBudget =
    options?.leafBudget !== undefined ? { remaining: options.leafBudget } : undefined;
  const scopedCtx: BehaviorTreeContext = leafBudget ? { ...ctx, leafBudget } : ctx;
  return tickNode(root, scopedCtx, state);
}
