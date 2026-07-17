import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parseBehaviorTree, type BehaviorTreeAsset, type WireBehaviorTree } from '@cardgame/core';

export function loadBehaviorTreeById(dataRoot: string, treeId: string): BehaviorTreeAsset {
  const dir = join(dataRoot, 'behavior-trees');
  if (!existsSync(dir)) {
    throw new Error(`Behavior tree directory missing: ${dir}`);
  }

  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
    const wire = JSON.parse(readFileSync(join(dir, name), 'utf8')) as WireBehaviorTree;
    if (wire.id === treeId) {
      return parseBehaviorTree(wire);
    }
  }

  throw new Error(`Behavior tree not found: ${treeId}`);
}
