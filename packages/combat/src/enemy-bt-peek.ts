import type { BehaviorTreeRunState } from '@cardgame/core';
import type { BtNode } from '@cardgame/core';

type BtTaskNode = Extract<BtNode, { type: 'Task' }>;

export function peekNextTaskNode(root: BtNode, state: BehaviorTreeRunState): BtTaskNode | undefined {
  return walkPeek(root, state);
}

function walkPeek(node: BtNode, state: BehaviorTreeRunState): BtTaskNode | undefined {
  switch (node.type) {
    case 'Task':
      return node;
    case 'Wait':
    case 'BlackboardCompare':
      return undefined;
    case 'Sequence': {
      const index = state.sequenceIndex.get(node) ?? 0;
      if (index >= node.children.length) {
        return undefined;
      }
      return walkPeek(node.children[index]!, state);
    }
    case 'Selector': {
      const index = state.selectorIndex.get(node) ?? 0;
      if (index >= node.children.length) {
        return undefined;
      }
      return walkPeek(node.children[index]!, state);
    }
    case 'Repeat':
      return walkPeek(node.child, state);
    case 'Inverter':
    case 'Succeed':
    case 'Fail':
      return walkPeek(node.child, state);
    default:
      return undefined;
  }
}
