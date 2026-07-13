import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GameplayTagError, GameplayTagManager, NATIVE_GAMEPLAY_TAGS } from './index.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const repoTagsJson = join(dirname(fileURLToPath(import.meta.url)), '../../../../data/tags.json');

function loadJsonTags(path: string): string[] {
  return JSON.parse(readFileSync(path, 'utf8')) as string[];
}

describe('GameplayTagManager', () => {
  it('probe 1: builds parent chain for Character.Enemy.Orc', () => {
    const manager = GameplayTagManager.fromDefinitions({ native: NATIVE_GAMEPLAY_TAGS });

    const orc = manager.resolve('Character.Enemy.Orc');
    const enemy = manager.resolve('Character.Enemy');
    const character = manager.resolve('Character');

    expect(manager.getParent(orc)?.name).toBe('Character.Enemy');
    expect(manager.getParent(enemy)?.name).toBe('Character');
    expect(manager.getParent(character)).toBeUndefined();
    expect(orc.isChildOf(enemy)).toBe(true);
    expect(orc.isChildOf(character)).toBe(true);
    expect(enemy.matches(character)).toBe(true);
  });

  it('merges native and JSON tag sources with implicit parents', () => {
    const jsonTags = loadJsonTags(fixtureDir + '/tags-minimal.json');
    const manager = GameplayTagManager.fromDefinitions({
      native: NATIVE_GAMEPLAY_TAGS,
      json: jsonTags,
    });

    expect(manager.resolve('Character.Enemy.Goblin').name).toBe('Character.Enemy.Goblin');
    expect(manager.resolve('Status.Buff.Shielded').name).toBe('Status.Buff.Shielded');
    expect(manager.resolve('Status.Buff').name).toBe('Status.Buff');
  });

  it('loads repo data/tags.json alongside native definitions', () => {
    const manager = GameplayTagManager.fromDefinitions({
      native: NATIVE_GAMEPLAY_TAGS,
      json: loadJsonTags(repoTagsJson),
    });

    expect(manager.resolve('GameplayEvent.Combat.DamageDealt').name).toBe(
      'GameplayEvent.Combat.DamageDealt',
    );
    expect(manager.resolve('Status.Debuff.Heavy').isChildOf(manager.resolve('Status.Debuff'))).toBe(
      true,
    );
  });

  it('throws for unknown tags on resolve', () => {
    const manager = GameplayTagManager.fromDefinitions({ native: NATIVE_GAMEPLAY_TAGS });
    expect(() => manager.resolve('Status.Unknown')).toThrow(GameplayTagError);
  });

  it('throws for invalid tag names', () => {
    expect(() =>
      GameplayTagManager.fromDefinitions({ native: ['bad name with spaces'] }),
    ).toThrow(GameplayTagError);
  });

  it('assigns stable indices from sorted canonical names', () => {
    const left = GameplayTagManager.fromDefinitions({
      native: ['Z.Last', 'A.First'],
    });
    const right = GameplayTagManager.fromDefinitions({
      json: ['Z.Last', 'A.First'],
    });

    expect(left.resolve('A.First').index).toBe(right.resolve('A.First').index);
    expect(left.resolve('Z.Last').index).toBe(right.resolve('Z.Last').index);
  });
});
