# CORE-F02 — GameplayTag Manager and Container

## Meta

- **ID:** CORE-F02
- **Status:** Done
- **Owner:** 麦克斯大大
- **Last updated:** 2026-07-13
- **Related:** [gameplay-framework.md](../../design/systems/gameplay-framework.md), [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md), [CORE-F01-monorepo-tooling-logging.md](./CORE-F01-monorepo-tooling-logging.md)

> **Agent:** Implementation design only. Gameplay rules → `docs/design/systems/` (user-owned).

## TL;DR

Implement UE-aligned **hierarchical GameplayTags** in `@cardgame/core`: `GameplayTagManager` (tree + lookup) and `GameplayTagContainer` (mutable bag with **count/stacking**). Matching follows UE `MatchesTag` / `HasTag` semantics. Tag definitions merge **native TS + JSON** at load; unknown tags **fail strict**. Probe tests + trace entries before CORE-F03.

---

## Scope

### In

- `GameplayTag` handle type (registry-backed id)
- `GameplayTagManager` — build hierarchy, resolve names, parent chain
- `GameplayTagContainer` — add/remove, count stacking, `has` / `hasAll` / `hasAny`
- Hierarchy matching (child matches parent query)
- Dual source tag definitions (native + JSON) for load-time merge
- Trace kinds: `tag.add`, `tag.remove` (optional sink on container mutations)
- Unit probe tests (4 cases in §Probe tests)

### Out (later)

- `FGameplayTagQuery` boolean expression language
- Tag redirect / rename migration
- Visual tag editor (Demo tool chain)
- Network replication
- Automatic parent tags in container (UE does not do this; query-time only)

---

## Context

### Gameplay roles (from design doc)

| Role | Example | Needs |
|------|---------|-------|
| State / classification | `Status.Debuff.Vulnerable`, `Character.Enemy` | Container + hierarchical match |
| GE requirements | Granted / Ongoing / Application tags | `hasAll`, `hasAny` |
| GA gates | Activation required / blocked (all / any) | Same |
| Event typing | `GameplayEvent.Combat.DamageDealt` | Stable registered names |

Resolves open question **D.1** (provisional): **native + table fusion**, strict at load.

### UE reference behavior (must align)

```text
Container holds: Status.Debuff.Vulnerable   (explicit tag only)

HasTag(Status.Debuff)           → true   (child satisfies parent query)
HasTag(Status.Debuff.Vulnerable)→ true   (exact)
HasTag(Status.Debuff.Heavy)     → false

Direction: query is parent/general, container tag may be more specific.
```

Implementation API names:

- `GameplayTag.matches(other)` — this tag equals `other` OR is a **descendant** of `other`
- `GameplayTagContainer.has(query)` — ∃ tag in container where `tag.matches(query)`

---

## Decision log

| # | Topic | Decision | Rationale |
|---|--------|----------|-----------|
| D1 | Manager name | **`GameplayTagManager`** | User: Manager suffix for registry/lifecycle domains |
| D2 | Container name | **`GameplayTagContainer`** | User; matches UE vocabulary |
| D3 | Registry naming | **Not** `*Registry` for this domain | Manager/System convention |
| D4 | Tag handle | **`GameplayTag`** readonly object with `index`, `name`, `matches()` | UE FGameplayTag analogue |
| D5 | Stacking | **Count inside `GameplayTagContainer`** | GE Granted Tags need refcount; single public container type |
| D6 | Tag sources | `native-tags.ts` + `data/tags.json` merged at `GameplayTagManager` init | Design D.1 fusion |
| D7 | Unknown tag string at load | **Throw** (`GameplayTagError`) | Data-driven + CI/agent safety |
| D8 | Unknown tag at runtime API | **Throw** if string overload used; prefer `GameplayTag` handle | Prevent typos |
| D9 | Parent auto-insert | **No** — only explicit adds | UE-consistent |
| D10 | Query language | **Defer** `GameplayTagQuery`; only `has` / `hasAll` / `hasAny` | MVP sufficient for GA/GE |
| D11 | Trace | Emit `tag.add` / `tag.remove` when container mutates with sink attached | Reuse CORE-F01 trace |
| D12 | Manager lifetime | One `GameplayTagManager` per **rules context** (battle instance); static default for tests | Avoid global mutable singleton in core tests |

---

## Architecture

```text
  native-tags.ts ──┐
                   ├──► GameplayTagManager
  data/tags.json ──┘         │
                             │ resolve("Status.Debuff.Vulnerable")
                             ▼
                        GameplayTag (handle)
                             │
                             ▼
                   GameplayTagContainer  ──► on GFC / entity (CORE-F04)
                             │
                             ▼
                      TraceSink (optional)
```

### `GameplayTagManager`

**Responsibilities**

- Parse dot-separated names; build **tag tree** (parent nodes implicit in tree)
- Assign stable dense `index: number` per tag (post-order or registration order; **stable across reload** for same definition file)
- `resolve(name: string): GameplayTag`
- `tryResolve(name: string): GameplayTag | undefined` (editor tooling later)
- `getParent(tag: GameplayTag): GameplayTag | undefined`
- `isValidTag(tag: GameplayTag): boolean` (belongs to this manager)
- `listTags(): readonly GameplayTag[]` (tests / debug)

**Construction**

```typescript
GameplayTagManager.fromDefinitions({
  native: NATIVE_GAMEPLAY_TAGS,
  json: loadedTagNames, // string[] or tree object
});
```

Merge rules:

1. Union all tag names from both sources
2. Ensure parent segments exist (if `A.B.C` listed, `A` and `A.B` exist as nodes)
3. Duplicate name with conflicting metadata → throw (future metadata slot)
4. Empty name / invalid characters → throw (allow `[A-Za-z0-9._]` initially)

### `GameplayTag`

```typescript
type GameplayTag = {
  readonly index: number;
  readonly name: string; // canonical "A.B.C"
  matches(query: GameplayTag): boolean;
  isChildOf(ancestor: GameplayTag): boolean;
};
```

- Not constructible outside manager (brand / closed factory)
- Equality: same `index` (or same manager + name)

### `GameplayTagContainer`

**Storage:** `Map<index, count>` internally (sparse, refcount).

**API**

| Method | Behavior |
|--------|----------|
| `add(tag, count = 1)` | Increment; trace if count was 0 |
| `remove(tag, count = 1)` | Decrement; remove key at 0; trace on removal to 0 |
| `getCount(tag)` | 0 if absent |
| `has(query)` | ∃ entry with count > 0 where `entryTag.matches(query)` |
| `hasAll(queries)` | every query passes `has` |
| `hasAny(queries)` | some query passes `has` |
| `clear()` | remove all |
| `toArray()` | explicit tags with count > 0 (debug) |

**Copy:** `clone()` for snapshot / GameState later.

**Trace (when `TraceSink` provided)**

```typescript
{ kind: 'tag.add', t, entity: string, tag: string, count: number }
{ kind: 'tag.remove', t, entity: string, tag: string, count: number }
```

`entity` optional in F02 (empty string or omitted until GFC wires owner id).

---

## File layout (planned)

```text
packages/core/src/
  tags/
    gameplay-tag.ts           # GameplayTag type + factory helpers (internal)
    gameplay-tag-manager.ts   # GameplayTagManager
    gameplay-tag-container.ts # GameplayTagContainer
    native-tags.ts            # const NATIVE_GAMEPLAY_TAGS
    errors.ts                 # GameplayTagError
    index.ts
  index.ts                    # re-export public API
packages/core/src/__fixtures__/
  tags-minimal.json           # probe fixture
data/
  tags.json                   # optional merged table (repo root or packages/data later)
```

**Public exports:** `GameplayTag`, `GameplayTagManager`, `GameplayTagContainer`, `GameplayTagError`, `NATIVE_GAMEPLAY_TAGS`.

---

## Namespace conventions (validation)

Recommended roots (warn in test/dev; strict optional later):

| Root | Purpose |
|------|---------|
| `Status` | Buffs, debuffs, stun, vulnerable |
| `Character` | Player, enemy, factions |
| `GameplayEvent` | Event channel types (CORE-F03) |
| `Ability` | GA asset tags (later) |
| `Effect` | GE asset tags (later) |

F02 probe fixture uses `Status.*` and `Character.*` only.

---

## Probe tests (acceptance)

| # | Case | Assert |
|---|------|--------|
| 1 | Tree | `Character.Enemy.Orc` registers; parent chain `Character` → `Character.Enemy` |
| 2 | `has` parent | Container `Status.Debuff.Vulnerable`; `has(Status.Debuff)` true |
| 3 | `hasAll` / `hasAny` | GA-style required-all and blocked-any scenarios |
| 4 | Count | `add` ×2, `remove` ×1 still `has`; second `remove` clears |

All tests use a **fresh `GameplayTagManager`** per test (D12).

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **CORE-F02-S01** | `GameplayTagManager` + `GameplayTag` + native/json load + tree tests |
| **CORE-F02-S02** | `GameplayTagContainer` + count + has/hasAll/hasAny tests |
| **CORE-F02-S03** | Trace kinds + container optional sink |
| **CORE-F02-S04** | `data/tags.json` sample + export from `index.ts`; `npm run verify` green |

---

## Alternatives considered

| Alternative | Why not (now) |
|-------------|----------------|
| `GameplayTagRegistry` | User convention prefers Manager |
| `TagContainer` short name | User: full `GameplayTagContainer` |
| Separate `GameplayTagCountContainer` | Extra type; merged into one container |
| `Set<string>` runtime | No hierarchy match; error-prone |
| Permissive unknown tags | Hides data bugs |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Manager singleton vs test isolation | Factory per instance; no module-level global |
| Index stability across JSON reorder | Index by sorted canonical name, not file order |
| Trace schema growth | Additive `kind` only; version on `trace.start` already exists |

---

## Acceptance (CORE-F02)

- [x] `GameplayTagManager` resolves hierarchy and `matches` per UE direction
- [x] `GameplayTagContainer` supports count stacking and hasAll/hasAny
- [x] Native + JSON merge with strict unknown handling
- [x] Probe tests 1–4 pass
- [x] Trace `tag.add` / `tag.remove` covered by test
- [x] `ENGINEERING_CONVENTIONS.md` linked; FEATURE_REGISTRY updated

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-13 | Implemented S01–S04; 11 tag tests + trace kinds; verify green |
| 2026-07-13 | Initial accepted spec; Manager/Container naming; engineering conventions |
