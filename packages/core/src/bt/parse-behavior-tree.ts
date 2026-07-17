import { BehaviorTreeParseError } from './errors.js';
import type {
  BehaviorTreeAsset,
  BlackboardCompareOp,
  BlackboardValue,
  BtNode,
  WireBehaviorTree,
  WireBtNode,
} from './types.js';

const COMPARE_OPS = new Set<BlackboardCompareOp>(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']);

function parseCompareOp(op: string): BlackboardCompareOp {
  if (!COMPARE_OPS.has(op as BlackboardCompareOp)) {
    throw new BehaviorTreeParseError(`Invalid BlackboardCompare op: ${op}`);
  }
  return op as BlackboardCompareOp;
}

function parseCompareValue(value: unknown): BlackboardValue {
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  throw new BehaviorTreeParseError('BlackboardCompare value must be number, boolean, or string');
}

function parseNode(wire: WireBtNode, path: string): BtNode {
  switch (wire.type) {
    case 'Sequence': {
      const children = wire.children;
      if (!children || children.length === 0) {
        throw new BehaviorTreeParseError(`${path}: Sequence requires children`);
      }
      return {
        type: 'Sequence',
        children: children.map((child, index) => parseNode(child, `${path}/children[${index}]`)),
      };
    }
    case 'Selector': {
      const children = wire.children;
      if (!children || children.length === 0) {
        throw new BehaviorTreeParseError(`${path}: Selector requires children`);
      }
      return {
        type: 'Selector',
        children: children.map((child, index) => parseNode(child, `${path}/children[${index}]`)),
      };
    }
    case 'Repeat': {
      if (!wire.child) {
        throw new BehaviorTreeParseError(`${path}: Repeat requires child`);
      }
      return { type: 'Repeat', child: parseNode(wire.child, `${path}/child`) };
    }
    case 'Inverter': {
      if (!wire.child) {
        throw new BehaviorTreeParseError(`${path}: Inverter requires child`);
      }
      return { type: 'Inverter', child: parseNode(wire.child, `${path}/child`) };
    }
    case 'Succeed': {
      if (!wire.child) {
        throw new BehaviorTreeParseError(`${path}: Succeed requires child`);
      }
      return { type: 'Succeed', child: parseNode(wire.child, `${path}/child`) };
    }
    case 'Fail': {
      if (!wire.child) {
        throw new BehaviorTreeParseError(`${path}: Fail requires child`);
      }
      return { type: 'Fail', child: parseNode(wire.child, `${path}/child`) };
    }
    case 'Task': {
      if (!wire.actionId || wire.actionId.length === 0) {
        throw new BehaviorTreeParseError(`${path}: Task requires actionId`);
      }
      return {
        type: 'Task',
        actionId: wire.actionId,
        params: wire.params ?? {},
      };
    }
    case 'Wait':
      return { type: 'Wait' };
    case 'BlackboardCompare': {
      if (!wire.key) {
        throw new BehaviorTreeParseError(`${path}: BlackboardCompare requires key`);
      }
      if (!wire.op) {
        throw new BehaviorTreeParseError(`${path}: BlackboardCompare requires op`);
      }
      if (wire.value === undefined) {
        throw new BehaviorTreeParseError(`${path}: BlackboardCompare requires value`);
      }
      return {
        type: 'BlackboardCompare',
        key: wire.key,
        op: parseCompareOp(wire.op),
        value: parseCompareValue(wire.value),
      };
    }
    default:
      throw new BehaviorTreeParseError(`${path}: Unknown node type: ${wire.type}`);
  }
}

export function parseBehaviorTree(wire: WireBehaviorTree): BehaviorTreeAsset {
  if (!wire.id || wire.id.length === 0) {
    throw new BehaviorTreeParseError('Behavior tree id is required');
  }
  if (!wire.root) {
    throw new BehaviorTreeParseError('Behavior tree root is required');
  }
  return {
    id: wire.id,
    root: parseNode(wire.root, 'root'),
  };
}
