import { describe, expect, it } from 'vitest';

import { Blackboard } from './blackboard.js';
import { BehaviorTreeParseError } from './errors.js';
import { parseBehaviorTree } from './parse-behavior-tree.js';
import { createBehaviorTreeRunState } from './run-state.js';
import { BehaviorTreeTaskRegistry } from './task-registry.js';
import { tickBehaviorTree, tickNode } from './tick.js';
import type { BtNode } from './types.js';

function makeCtx(
  registry: BehaviorTreeTaskRegistry,
  blackboard = new Blackboard(),
  leafBudget?: number,
) {
  return {
    blackboard,
    tasks: registry,
    ...(leafBudget !== undefined ? { leafBudget: { remaining: leafBudget } } : {}),
  };
}

describe('behavior tree CORE-F14', () => {
  it('parses slime-style repeat sequence from wire JSON', () => {
    const asset = parseBehaviorTree({
      id: 'bt.slime_cycle',
      root: {
        type: 'Repeat',
        child: {
          type: 'Sequence',
          children: [
            { type: 'Task', actionId: 'combat.attack', params: { panelDamage: 6 } },
            { type: 'Task', actionId: 'combat.playCard', params: { cardId: 'weaken' } },
            { type: 'Task', actionId: 'combat.attack', params: { panelDamage: 6 } },
          ],
        },
      },
    });
    expect(asset.id).toBe('bt.slime_cycle');
    expect(asset.root.type).toBe('Repeat');
  });

  it('rejects invalid wire trees', () => {
    expect(() => parseBehaviorTree({ id: '', root: { type: 'Wait' } })).toThrow(BehaviorTreeParseError);
    expect(() => parseBehaviorTree({ id: 'x', root: { type: 'Sequence', children: [] } })).toThrow(
      BehaviorTreeParseError,
    );
  });

  it('runs Sequence children in order until failure', () => {
    const calls: string[] = [];
    const registry = new BehaviorTreeTaskRegistry();
    registry.register('a', () => {
      calls.push('a');
      return 'Success';
    });
    registry.register('b', () => {
      calls.push('b');
      return 'Failure';
    });
    registry.register('c', () => {
      calls.push('c');
      return 'Success';
    });

    const root: BtNode = {
      type: 'Sequence',
      children: [
        { type: 'Task', actionId: 'a' },
        { type: 'Task', actionId: 'b' },
        { type: 'Task', actionId: 'c' },
      ],
    };
    const state = createBehaviorTreeRunState();
    const status = tickNode(root, makeCtx(registry), state);
    expect(status).toBe('Failure');
    expect(calls).toEqual(['a', 'b']);
  });

  it('runs Selector until first success', () => {
    const registry = new BehaviorTreeTaskRegistry();
    registry.register('fail', () => 'Failure');
    registry.register('ok', () => 'Success');

    const root: BtNode = {
      type: 'Selector',
      children: [
        { type: 'Task', actionId: 'fail' },
        { type: 'Task', actionId: 'ok' },
        { type: 'Task', actionId: 'fail' },
      ],
    };
    const state = createBehaviorTreeRunState();
    expect(tickNode(root, makeCtx(registry), state)).toBe('Success');
  });

  it('evaluates BlackboardCompare', () => {
    const board = new Blackboard();
    board.set('hp', 5);
    const registry = new BehaviorTreeTaskRegistry();
    const low: BtNode = {
      type: 'BlackboardCompare',
      key: 'hp',
      op: 'lt',
      value: 10,
    };
    const state = createBehaviorTreeRunState();
    expect(tickNode(low, makeCtx(registry, board), state)).toBe('Success');
  });

  it('inverts child result', () => {
    const registry = new BehaviorTreeTaskRegistry();
    registry.register('fail', () => 'Failure');
    const root: BtNode = { type: 'Inverter', child: { type: 'Task', actionId: 'fail' } };
    const state = createBehaviorTreeRunState();
    expect(tickNode(root, makeCtx(registry), state)).toBe('Success');
  });

  it('advances slime cycle one leaf per tick with leafBudget', () => {
    const calls: string[] = [];
    const registry = new BehaviorTreeTaskRegistry();
    registry.register('combat.attack', () => {
      calls.push('attack');
      return 'Success';
    });
    registry.register('combat.playCard', () => {
      calls.push('play');
      return 'Success';
    });

    const asset = parseBehaviorTree({
      id: 'bt.slime_cycle',
      root: {
        type: 'Repeat',
        child: {
          type: 'Sequence',
          children: [
            { type: 'Task', actionId: 'combat.attack', params: { panelDamage: 6 } },
            { type: 'Task', actionId: 'combat.playCard', params: { cardId: 'weaken' } },
            { type: 'Task', actionId: 'combat.attack', params: { panelDamage: 6 } },
          ],
        },
      },
    });

    const state = createBehaviorTreeRunState();
    expect(tickBehaviorTree(asset.root, makeCtx(registry), state, { leafBudget: 1 })).toBe('Running');
    expect(calls).toEqual(['attack']);
    expect(tickBehaviorTree(asset.root, makeCtx(registry), state, { leafBudget: 1 })).toBe('Running');
    expect(calls).toEqual(['attack', 'play']);
    expect(tickBehaviorTree(asset.root, makeCtx(registry), state, { leafBudget: 1 })).toBe('Running');
    expect(calls).toEqual(['attack', 'play', 'attack']);
    expect(tickBehaviorTree(asset.root, makeCtx(registry), state, { leafBudget: 1 })).toBe('Running');
    expect(calls).toEqual(['attack', 'play', 'attack', 'attack']);
  });

  it('returns Failure for unregistered task actionId', () => {
    const registry = new BehaviorTreeTaskRegistry();
    const root: BtNode = { type: 'Task', actionId: 'missing' };
    const state = createBehaviorTreeRunState();
    expect(tickNode(root, makeCtx(registry), state)).toBe('Failure');
  });
});
