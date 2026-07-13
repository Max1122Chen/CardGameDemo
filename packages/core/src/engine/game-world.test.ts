import { describe, expect, it } from 'vitest';

import { ProbeComponentType } from './types.js';
import { GameWorld } from './game-world.js';

describe('GameWorld', () => {
  it('probe 2: entity lifecycle and destroy', () => {
    const world = new GameWorld();
    const id = world.createEntity('unit-a');

    expect(world.hasEntity(id)).toBe(true);
    expect(world.hasComponent(id, ProbeComponentType)).toBe(false);
    expect(world.destroyEntity(id)).toBe(true);
    expect(world.hasEntity(id)).toBe(false);
  });

  it('probe 3: component round-trip', () => {
    const world = new GameWorld();
    const id = world.createEntity();

    world.addComponent(id, ProbeComponentType, { value: 7 });
    expect(world.getComponent(id, ProbeComponentType)?.value).toBe(7);
    expect(world.requireComponent(id, ProbeComponentType).value).toBe(7);
    expect(world.removeComponent(id, ProbeComponentType)).toBe(true);
    expect(world.getComponent(id, ProbeComponentType)).toBeUndefined();
  });

  it('probe 4: component isolation between entities', () => {
    const world = new GameWorld();
    const left = world.createEntity('left');
    const right = world.createEntity('right');

    world.addComponent(left, ProbeComponentType, { value: 1 });

    expect(world.getComponent(left, ProbeComponentType)?.value).toBe(1);
    expect(world.getComponent(right, ProbeComponentType)).toBeUndefined();
  });

  it('auto-generates entity ids when omitted', () => {
    const world = new GameWorld();
    const id = world.createEntity();
    expect(id).toMatch(/^entity-\d+$/);
  });

  it('rejects duplicate entity ids', () => {
    const world = new GameWorld();
    world.createEntity('dup');
    expect(() => world.createEntity('dup')).toThrow(/already exists/);
  });
});
