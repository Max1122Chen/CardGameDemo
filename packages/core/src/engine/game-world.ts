import type { ComponentType, EntityId } from './component-type.js';

type EntityRecord = {
  components: Map<symbol, unknown>;
};

export class GameWorld {
  private readonly entities = new Map<EntityId, EntityRecord>();
  private nextAutoId = 0;

  createEntity(id?: EntityId): EntityId {
    const entityId = id ?? `entity-${this.nextAutoId++}`;

    if (this.entities.has(entityId)) {
      throw new Error(`Entity already exists: ${entityId}`);
    }

    this.entities.set(entityId, { components: new Map() });
    return entityId;
  }

  destroyEntity(id: EntityId): boolean {
    return this.entities.delete(id);
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  listEntities(): readonly EntityId[] {
    return [...this.entities.keys()];
  }

  addComponent<T>(entityId: EntityId, type: ComponentType<T>, component: T): void {
    const record = this.requireEntity(entityId);
    record.components.set(type, component);
  }

  getComponent<T>(entityId: EntityId, type: ComponentType<T>): T | undefined {
    const record = this.entities.get(entityId);
    if (!record) {
      return undefined;
    }

    return record.components.get(type) as T | undefined;
  }

  requireComponent<T>(entityId: EntityId, type: ComponentType<T>): T {
    const component = this.getComponent(entityId, type);
    if (component === undefined) {
      throw new Error(`Missing component ${String(type)} on entity ${entityId}`);
    }

    return component;
  }

  hasComponent(entityId: EntityId, type: ComponentType<unknown>): boolean {
    const record = this.entities.get(entityId);
    if (!record) {
      return false;
    }

    return record.components.has(type);
  }

  removeComponent(entityId: EntityId, type: ComponentType<unknown>): boolean {
    const record = this.entities.get(entityId);
    if (!record) {
      return false;
    }

    return record.components.delete(type);
  }

  private requireEntity(entityId: EntityId): EntityRecord {
    const record = this.entities.get(entityId);
    if (!record) {
      throw new Error(`Unknown entity: ${entityId}`);
    }

    return record;
  }
}
