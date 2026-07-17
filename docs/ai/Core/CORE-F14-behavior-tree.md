# CORE-F14 — Behavior tree runtime (data + tick, host-agnostic)

## Meta
- **ID:** CORE-F14
- **Status:** Review
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CORE-F08](./CORE-F08-gameplay-ability-framework.md), [COMBAT-F05](../Combat/COMBAT-F05-enemy-data-driven.md), [COMBAT-F06](../Combat/COMBAT-F06-enemy-bt-ai.md)

Depends on: CORE-F01 (monorepo)  
Blocks: COMBAT-F05 (enemy turn driver), COMBAT-F06 (smart AI), future dungeon exploration AI

---

## TL;DR

1. **Pure runtime in `packages/core`** — parse JSON BT assets, tick tree, blackboard; **no** combat / CLI / dungeon imports.
2. **Host registers task handlers** — leaf `Task` nodes call `actionId` + params via `BehaviorTreeTaskRegistry` (same spirit as GA effect registry).
3. **Composite nodes v1:** `Sequence`, `Selector`, `Repeat`, `Inverter`, `Succeed`, `Fail`.
4. **Leaf nodes v1:** `Task` (opaque action), `Wait` (no-op success).
5. **Condition nodes v1 (F14 minimal):** `BlackboardCompare` (key op value) — enough for F06; slime F05 may use only `Sequence`+`Repeat`+`Task`.
6. **Assets:** `data/behavior-trees/*.json`; character/enemy defs reference `behaviorTreeId`.
7. **No editor** — hand-authored JSON only.

**Non-goals:** visual BT editor; parallel/async subtrees; subtree hot-reload; exploration locomotion tasks (dungeon registers later).

---

## Design principles (mirror GFC)

| Principle | Rule |
|-----------|------|
| Core purity | `packages/core` BT module: no `CombatSession`, no `AppState` |
| Data-driven | Tree shape + task params in JSON; no per-enemy TypeScript branches |
| Host tasks | Combat registers `combat.attack`, `combat.playCard`, `combat.endTurn`; dungeon registers `dungeon.wander`, etc. |
| Blackboard | Typed-ish bag (`number`, `boolean`, `string`); **host fills** before tick (HP, hand, AP) |
| Tick contract | One enemy turn = host sets blackboard → `tick(root)` until `Success` \| `Failure` or step budget |
| Wisdom | **Not** in core — combat adapter may pass `wisdom` into blackboard for condition weights in F06 |
| Turn persistence | **BehaviorTreeInstance** keeps composite cursor between host ticks (turn-based combat resumes mid-`Sequence`) | Partner |

---

## Turn-based persistence (critical)

Combat calls `tick` **once per enemy turn** (not one full tree per frame).

- `Sequence` / `Selector` store **running child index** on the instance until subtree completes.
- Slime `Repeat(Sequence[a,b,c])`: turn 1 → `a`, turn 2 → `b`, turn 3 → `c`, turn 4 → `a` again.
- Host may loop `tick` within a single turn only if a task returns `Running` (unused v1); v1 = **one leaf execution per enemy turn** unless `combat.endTurn` ends early.

```typescript
interface BehaviorTreeInstance {
  assetId: string;
  nodeState: Map<NodeId, SequenceState | ...>;
}
```


## Wire schema (draft)

```json
{
  "id": "bt.slime_cycle",
  "root": {
    "type": "Repeat",
    "child": {
      "type": "Sequence",
      "children": [
        { "type": "Task", "actionId": "combat.attack", "params": { "panelDamage": 6 } },
        { "type": "Task", "actionId": "combat.playCard", "params": { "cardId": "weaken" } },
        { "type": "Task", "actionId": "combat.attack", "params": { "panelDamage": 6 } }
      ]
    }
  }
}
```

### Node types (v1)

| type | Behavior |
|------|----------|
| `Sequence` | Run children in order; fail fast |
| `Selector` | Run until one child succeeds |
| `Repeat` | Always `Running` at composite level; child success → restart child (loop) |
| `Inverter` | Flip child result |
| `Succeed` / `Fail` | Constant |
| `Task` | Lookup `actionId` in registry; `Running` if host needs multi-frame (unused v1) |
| `BlackboardCompare` | `key`, `op`, `value` → Success/Failure |

---

## Runtime API (sketch)

```typescript
// packages/core — illustrative
type BtStatus = 'Success' | 'Failure' | 'Running';

interface BehaviorTreeContext {
  blackboard: Blackboard;
  tasks: BehaviorTreeTaskRegistry;
}

function tickNode(node: BtNode, ctx: BehaviorTreeContext): BtStatus;
function loadBehaviorTree(wire: WireBehaviorTree): BehaviorTreeAsset;
```

Combat adapter (in `@cardgame/combat`):

```typescript
registry.register('combat.attack', (ctx, params) => { /* deal damage */ return 'Success'; });
registry.register('combat.playCard', (ctx, params) => { /* check AP, play, target player */ });
```

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **S01** | Wire types + loader + unit tests (dummy registry) |
| **S02** | Composites + Repeat loop + blackboard compare |
| **S03** | `data/behavior-trees/bt.slime_cycle.json` + combat task registry stub (no full combat wire yet) |

COMBAT-F05 consumes CORE-F14-S02+.

---

## Acceptance

- [ ] BT loads from JSON; invalid trees fail at load
- [ ] Sequence/Selector/Repeat/Inverter tested in core
- [ ] No imports from combat/cli/items in core BT module
- [ ] Slime cycle expressible as single BT asset

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | Initial spec (Review); user: unified BT for all enemy AI |
