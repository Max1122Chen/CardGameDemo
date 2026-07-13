# CORE-F05 — GameplayFrameworkComponent skeleton (ASC)

## Meta

- **ID:** CORE-F05
- **Status:** Accepted
- **Owner:** 麦克斯大大
- **Last updated:** 2026-07-13
- **Related:** [gameplay-framework.md](../../design/systems/gameplay-framework.md), [CORE-F04-rule-engine-gameworld.md](./CORE-F04-rule-engine-gameworld.md), [CORE-F02-gameplay-tag.md](./CORE-F02-gameplay-tag.md), [CORE-F03-gameplay-event.md](./CORE-F03-gameplay-event.md)

> **Agent:** Implementation design only. Gameplay rules → `docs/design/systems/` (user-owned).

## TL;DR

Add **`GameplayFrameworkComponent` (GFC)** as a **single ECS component** per entity — UE **`UAbilitySystemComponent`** analogue, **not split** into Tag/Attribute components. F05 delivers: Tag API, Event bridge, **placeholders** for Attribute/GE/GA, and `toJSON` (tags only). Attribute writes remain **GE-only** (implemented in CORE-F06). Equipment passives = grant passive GA later; **not** GFC scope.

---

## Scope

### In

- `GameplayFrameworkComponent` class
- Registration on `GameWorld` via `GfcComponentType` (one GFC per entity)
- `RuleEngine` helper: `createEntityWithGfc(id?)` or `addGfc(entityId)`
- Tag: `addTag` / `removeTag` / `hasTag` / `getTagContainer` (delegates to inner `GameplayTagContainer`)
- Event: `dispatch(channel, event)` / `subscribe` / `dispose` (tracks listener ids)
- Placeholders: `getAttribute`, `registerAttributeSet`, `applyGameplayEffect`, `grantAbility`, `revokeAbility`
- Attribute callback **registration** types only (no invoke until F06)
- `toJSON()` — `entityId` + explicit tags
- Probe tests

### Out (CORE-F06+)

- Real Attribute Base/Current, Aggregator, Pipeline
- GE apply/remove/tick
- GA activation logic
- Equipment system integration
- Full `GameWorld` / engine snapshot

---

## Context

Design doc GFC dimensions:

| Dimension | F05 | F06+ |
|-----------|-----|------|
| GameplayState (tags) | **Yes** | — |
| GameplayState (attributes) | Placeholder | **Yes** |
| Attribute callbacks | Register only | Invoke on write |
| GE modification | Placeholder API | **Yes** |
| Event handling | **Yes** (bridge) | GA uses same bridge |
| GA | `grantAbility` stub | Activate later |

User decisions:

- GFC **aligned with UE ASC** — one component, not split
- **Tag** may be modified directly on GFC (combat, debug, some GE paths)
- **Attribute** only via GE (enforce in F06; F05 `getAttribute` throws)
- Equipment → passive **GA** granted on wear; interacts with GFC, not part of GFC

---

## Architecture

```text
RuleEngine
  └── GameWorld
        └── Entity "player-1"
              └── GameplayFrameworkComponent   ← sole framework host (like ASC)
                    ├── entityId
                    ├── tags: GameplayTagContainer
                    ├── listenerIds[]          (event cleanup)
                    ├── grantedAbilities[]     (stub, F06+)
                    ├── attributeSets[]          (stub)
                    └── ref: RuleEngine (tagManager, eventSystem)
```

### UE mapping

| UE | CardGameDemo F05 |
|----|------------------|
| `AActor` | `EntityId` in `GameWorld` |
| `UAbilitySystemComponent` | **`GameplayFrameworkComponent`** |
| `UAttributeSet` subobjects | stub `registerAttributeSet` (F06) |
| `GameplayTag` container on ASC | inner `GameplayTagContainer` |
| `HandleGameplayEvent` / delegates | `subscribe` / `dispatch` via F03 |

---

## Decision log

| # | Topic | Decision | Rationale |
|---|--------|----------|-----------|
| D1 | Component shape | **Single `GameplayFrameworkComponent`** | User: align ASC, no split |
| D2 | One GFC per entity | **At most one** per `EntityId` | ASC model |
| D3 | Tag mutation | **Public** `addTag` / `removeTag` on GFC | User Q4 |
| D4 | Attribute read | `getAttribute` → **`GameplayNotImplementedError`** in F05 | Until F06 |
| D5 | Attribute write | **No public setter**; `applyGameplayEffect` stub throws in F05 | User Q3 |
| D6 | Event ownership | **Shared** `RuleEngine.eventSystem` | F03 design |
| D7 | `dispose()` | Unsubscribe all `listenerIds` | Leak prevention |
| D8 | `grantAbility` / `revokeAbility` | **Stub** returns handle / no-op | Equipment/GA later |
| D9 | Serialization | `toJSON()`: `{ entityId, tags: [...] }` | User Q7 |
| D10 | Factory | `RuleEngine.createEntityWithGfc(id?)` creates entity + attaches GFC | Ergonomic BattleOnly |

---

## Public API (planned)

### Component type

```typescript
const GfcComponentType = defineComponentType<GameplayFrameworkComponent>('GameplayFrameworkComponent');
```

### `GameplayFrameworkComponent`

```typescript
class GameplayFrameworkComponent {
  readonly entityId: EntityId;

  // Tags (F05)
  addTag(tag: GameplayTag, count?: number): void;
  removeTag(tag: GameplayTag, count?: number): void;
  hasTag(query: GameplayTag): boolean;
  getTagContainer(): GameplayTagContainer; // read-focused; mutations via methods preferred

  // Events (F05)
  dispatch(channel: GameplayEventChannel, event: GameplayEvent): void;
  dispatch(event: GameplayEvent): void; // default channel
  subscribe(options: Omit<GameplayEventSubscribeOptions, 'channel'> & { channel?: GameplayEventChannel }): string;
  dispose(): void;

  // Stubs (F05)
  registerAttributeSet(id: string, set: unknown): void;
  getAttribute(setId: string, attrId: string): number;
  applyGameplayEffect(effect: unknown, context?: unknown): void;
  grantAbility(spec: unknown): string;
  revokeAbility(handle: string): void;

  onPreAttributeChange(cb: AttributeChangeCallback): () => void;
  onPostAttributeChange(cb: AttributeChangeCallback): () => void;

  toJSON(): GfcSnapshot;
}
```

### `RuleEngine` extensions

```typescript
createEntityWithGfc(entityId?: EntityId): GameplayFrameworkComponent;
getGfc(entityId: EntityId): GameplayFrameworkComponent | undefined;
requireGfc(entityId: EntityId): GameplayFrameworkComponent;
```

---

## Event bridge behavior

- `dispatch` → `engine.eventSystem.dispatch(channel, event)`; payload may include `entityId` by convention (not enforced)
- `subscribe` → registers on shared eventSystem; stores `listenerId` on GFC for `dispose()`
- Default channel: same as F03 (`Channel.Default`)

---

## Attribute callbacks (F05 register only)

Types defined; arrays on GFC; **not invoked** until CORE-F06 GE write path exists.

```typescript
type AttributeChangeCallback = (ctx: {
  entityId: EntityId;
  setId: string;
  attrId: string;
  oldValue: number;
  newValue: number;
}) => void;
```

UE reference for F06: `PreAttributeChange`, `PostAttributeChange`, `PreGameplayEffectExecute`, `PostGameplayEffectExecute` on `UAttributeSet`.

---

## Placeholder errors

Use `GameplayNotImplementedError` (or extend `GameplayEventError` hierarchy) for stub calls — **not** silent zeros.

---

## File layout (planned)

```text
packages/core/src/
  gfc/
    gameplay-framework-component.ts
    gfc-component-type.ts
    errors.ts
    types.ts
    index.ts
  engine/rule-engine.ts          # extend with GFC helpers
```

---

## Probe tests (acceptance)

| # | Case | Assert |
|---|------|--------|
| 1 | createEntityWithGfc | entity exists; GFC retrievable |
| 2 | Tag isolation | Two GFCs; tags independent |
| 3 | Event dispatch | GFC A dispatch; GFC B subscribe on same channel receives |
| 4 | dispose | after dispose, subscriber not called |
| 5 | getAttribute stub | throws NotImplemented |
| 6 | toJSON | only entityId + tags |
| 7 | grantAbility stub | returns handle; revoke no throw |

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **CORE-F05-S01** | `GameplayFrameworkComponent` + tag API + trace on tags |
| **CORE-F05-S02** | Event bridge + dispose |
| **CORE-F05-S03** | RuleEngine GFC helpers + stubs |
| **CORE-F05-S04** | Probe tests + exports |

---

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Split TagComponent / AttributeComponent | User: ASC single component |
| GFC owns EventSystem | F03 global bus |
| getAttribute returns 0 | User/R1: throw until real |

---

## Acceptance (CORE-F05)

- [ ] GFC as single ECS component; one per entity
- [ ] Tag + Event bridge working
- [ ] Stubs throw clearly; grantAbility placeholder
- [ ] toJSON tags only
- [ ] Probe tests 1–7 pass

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-13 | Initial accepted spec; ASC-shaped GFC on GameWorld entities |
