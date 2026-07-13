# CORE-F04 — RuleEngine and GameWorld (ECS)

## Meta

- **ID:** CORE-F04
- **Status:** Accepted
- **Owner:** 麦克斯大大
- **Last updated:** 2026-07-13
- **Related:** [gameplay-framework.md](../../design/systems/gameplay-framework.md), [CORE-F03-gameplay-event.md](./CORE-F03-gameplay-event.md), [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md)

> **Agent:** Implementation design only. Gameplay rules → `docs/design/systems/` (user-owned).

## TL;DR

Introduce **`RuleEngine`** as the root of one rules simulation instance (like a minimal game engine). It owns **`GameplayTagManager`**, **`GameplayEventSystem`**, and **`GameWorld`** — an **ECS-style** entity store (`EntityId` + components). **No GFC in F04**; combat/deck components come later. F04 ends with probe tests proving entity lifecycle and shared systems wiring.

---

## Scope

### In

- `RuleEngine` — factory, lifecycle, accessors for manager / eventSystem / gameWorld
- `GameWorld` — create/destroy entity, add/get/has/remove component
- `EntityId` — opaque string identity
- Component registry by **type token** (symbol or branded string); no split GFC yet
- Optional `TraceSink` plumbed from engine construction
- Probe component(s) for tests (e.g. `ProbeComponent` with a counter field)
- Unit probe tests

### Out (CORE-F05+)

- `GameplayFrameworkComponent` (GFC / ASC analogue)
- Attribute, GE, GA
- Combat systems, turn loop
- Serialization of full game state (F05: GFC `toJSON` tags only)
- Archetype/chunk ECS optimization

---

## Context

Prior features (F01–F03) are **libraries**: trace, tags, events. They need a **session root** to:

- Share one `GameplayTagManager` and `GameplayEventSystem` per battle / debug session
- Host **entities** without OOP `Character` classes (ECS-friendly for agents & replay)
- Attach **GFC** in F05 as a single component (UE `UAbilitySystemComponent` pattern)

User decisions (2026-07-13):

- Root name: **`RuleEngine`** (not `GameplayRulesContext`)
- World name: **`GameWorld`** (not `RuleWorld`)
- Avoid `Rule*` prefix elsewhere except where it truly means “rules machine” layer
- ECS over OOP entities; **GFC not split** across components (F05)

---

## Architecture

```text
RuleEngine                          ← one simulation instance (BattleOnly, debug, …)
├── tagManager: GameplayTagManager
├── eventSystem: GameplayEventSystem
├── gameWorld: GameWorld
│     └── entities: Map<EntityId, EntityRecord>
│           └── components: Map<ComponentType, ComponentInstance>
└── optional traceSink

EntityId = string (e.g. "player-1", "enemy-0")

Future (F05):
  entity + GameplayFrameworkComponent  ≈  UE Actor + ASC
```

### Responsibility split

| Type | Role |
|------|------|
| **RuleEngine** | Owns subsystems; `createEngine()` entry; teardown |
| **GameWorld** | ECS entity/component storage only — no tag/event logic |
| **GameplayTagManager** | Tag definitions (existing F02) |
| **GameplayEventSystem** | Event bus (existing F03) |

Combat / dungeon **Systems** (future) receive `RuleEngine` or `(gameWorld, eventSystem)` — not defined in F04.

---

## Decision log

| # | Topic | Decision | Rationale |
|---|--------|----------|-----------|
| D1 | Root type name | **`RuleEngine`** | User: engine-like session root |
| D2 | World type name | **`GameWorld`** | User: not RuleWorld |
| D3 | Naming policy | **`Rule*` only for RuleEngine** and true rules-layer types; prefer `Game*`, `Gameplay*`, `Entity*` elsewhere | User: RuleWorld/RuleXxx feels odd |
| D4 | Entity model | **ECS** — `EntityId` + components | User: suitable for Demo/agents |
| D5 | Entity ID type | **`string`** | Human-readable in logs/replay |
| D6 | Component lookup | **`Map` per entity** (type token → instance) | Simple; optimize later |
| D7 | Component type key | **`symbol` or string brand** e.g. `ComponentType<T>` | No class-per-entity inheritance |
| D8 | GFC in F04 | **No** | Separate feat F05 |
| D9 | Engine singleton | **No global**; one instance per test/session | Determinism |
| D10 | Destroy entity | `destroyEntity(id)` removes all components | Explicit lifecycle |
| D11 | ID generation | `createEntity(id?)` — auto `entity-N` if omitted | Debug can force ids |

---

## Public API (planned)

### `RuleEngine`

```typescript
type RuleEngineOptions = {
  tagDefinitions?: TagDefinitionsInput;
  traceSink?: TraceSink;
  maxEventDispatchDepth?: number;
};

class RuleEngine {
  static create(options?: RuleEngineOptions): RuleEngine;

  readonly tagManager: GameplayTagManager;
  readonly eventSystem: GameplayEventSystem;
  readonly gameWorld: GameWorld;

  dispose(): void; // unhook listeners if needed later
}
```

### `GameWorld`

```typescript
type EntityId = string;

class GameWorld {
  createEntity(id?: EntityId): EntityId;
  destroyEntity(id: EntityId): boolean;
  hasEntity(id: EntityId): boolean;
  listEntities(): readonly EntityId[];

  addComponent<T>(entityId: EntityId, type: ComponentType<T>, component: T): void;
  getComponent<T>(entityId: EntityId, type: ComponentType<T>): T | undefined;
  requireComponent<T>(entityId: EntityId, type: ComponentType<T>): T;
  hasComponent(entityId: EntityId, type: ComponentType<unknown>): boolean;
  removeComponent(entityId: EntityId, type: ComponentType<unknown>): boolean;
}
```

### Component type token

```typescript
// Example pattern
function defineComponentType<T>(name: string): ComponentType<T> {
  return Symbol(name) as ComponentType<T>;
}

const ProbeComponentType = defineComponentType<ProbeComponent>('Probe');
```

---

## File layout (planned)

```text
packages/core/src/
  engine/
    rule-engine.ts
    game-world.ts
    component-type.ts
    types.ts
    index.ts
  engine/__tests__/ or *.test.ts colocated
```

**Exports from `@cardgame/core`:** `RuleEngine`, `GameWorld`, `EntityId`, `defineComponentType`, `ComponentType`.

---

## Probe tests (acceptance)

| # | Case | Assert |
|---|------|--------|
| 1 | Engine wiring | `RuleEngine.create()` exposes shared tagManager + eventSystem + gameWorld |
| 2 | Entity lifecycle | create → hasComponent false → destroy → hasEntity false |
| 3 | Component round-trip | add/get/require/remove probe component |
| 4 | Isolation | Two entities; component on A not visible on B |
| 5 | Shared events | dispatch on engine.eventSystem visible to subscriber (smoke) |
| 6 | Custom entity id | `createEntity('player-1')` retrievable |

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **CORE-F04-S01** | `ComponentType`, `GameWorld`, entity CRUD |
| **CORE-F04-S02** | `RuleEngine.create`, wire F02/F03 |
| **CORE-F04-S03** | Probe tests + exports; `npm run verify` green |

---

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| `GameplayRulesContext` | User chose RuleEngine |
| `RuleWorld` | User chose GameWorld |
| OOP `Entity` class | User chose ECS |
| GFC inside F04 | Split feat; F05 focuses on ASC-shaped component |
| Archetype ECS | Overkill for MVP |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Component type collisions | `defineComponentType` with unique names |
| Engine vs World API creep | GameWorld only stores; RuleEngine owns services |

---

## Acceptance (CORE-F04)

- [ ] `RuleEngine` + `GameWorld` implemented
- [ ] ECS component add/get/has/remove/destroy
- [ ] Shared tagManager + eventSystem per engine
- [ ] Probe tests 1–6 pass
- [ ] No `Rule*` types except `RuleEngine` in new code

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-13 | Initial accepted spec; RuleEngine + GameWorld ECS |
