import { GameplayEventSystem } from '../events/gameplay-event-system.js';
import { GameplayFrameworkComponent } from '../gfc/gameplay-framework-component.js';
import { GfcComponentType } from '../gfc/gfc-component-type.js';
import { NATIVE_GAMEPLAY_TAGS } from '../tags/native-tags.js';
import { GameplayTagManager, type TagDefinitionsInput } from '../tags/gameplay-tag-manager.js';
import type { TraceSink } from '../trace/trace.js';
import type { EntityId } from './component-type.js';
import { GameWorld } from './game-world.js';

export type RuleEngineOptions = {
  tagDefinitions?: TagDefinitionsInput;
  traceSink?: TraceSink;
  maxEventDispatchDepth?: number;
};

export class RuleEngine {
  readonly tagManager: GameplayTagManager;
  readonly eventSystem: GameplayEventSystem;
  readonly gameWorld: GameWorld;

  private readonly traceSink?: TraceSink;

  private constructor(
    tagManager: GameplayTagManager,
    eventSystem: GameplayEventSystem,
    gameWorld: GameWorld,
    traceSink?: TraceSink,
  ) {
    this.tagManager = tagManager;
    this.eventSystem = eventSystem;
    this.gameWorld = gameWorld;
    this.traceSink = traceSink;
  }

  static create(options: RuleEngineOptions = {}): RuleEngine {
    const tagManager = GameplayTagManager.fromDefinitions({
      native: NATIVE_GAMEPLAY_TAGS,
      ...options.tagDefinitions,
    });
    const eventSystem = new GameplayEventSystem({
      manager: tagManager,
      sink: options.traceSink,
      maxDispatchDepth: options.maxEventDispatchDepth,
    });
    const gameWorld = new GameWorld();

    return new RuleEngine(tagManager, eventSystem, gameWorld, options.traceSink);
  }

  get trace(): TraceSink | undefined {
    return this.traceSink;
  }

  dispose(): void {
    for (const entityId of this.gameWorld.listEntities()) {
      const gfc = this.getGfc(entityId);
      gfc?.dispose();
    }
  }

  createEntityWithGfc(entityId?: EntityId): GameplayFrameworkComponent {
    const id = this.gameWorld.createEntity(entityId);

    if (this.gameWorld.hasComponent(id, GfcComponentType)) {
      throw new Error(`GameplayFrameworkComponent already exists on entity ${id}`);
    }

    const gfc = new GameplayFrameworkComponent({
      entityId: id,
      tagManager: this.tagManager,
      eventSystem: this.eventSystem,
    });
    this.gameWorld.addComponent(id, GfcComponentType, gfc);
    return gfc;
  }

  getGfc(entityId: EntityId): GameplayFrameworkComponent | undefined {
    return this.gameWorld.getComponent(entityId, GfcComponentType);
  }

  requireGfc(entityId: EntityId): GameplayFrameworkComponent {
    return this.gameWorld.requireComponent(entityId, GfcComponentType);
  }
}

export type { EntityId };
