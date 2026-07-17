# Active work (agent backlog)

Last updated: 2026-07-17

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase:** COMBAT-F06 next (COMBAT-F05 Done).

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| — | **CORE-F14** | BT runtime in core | **Done** ([spec](./Core/CORE-F14-behavior-tree.md)) |
| — | **CHAR-F01** | `@cardgame/characters` defs + spawn | **Done** ([spec](./Characters/CHAR-F01-character-package.md)) |
| — | **COMBAT-F05** | Slime/orc data spawn + BT fixed turns + loot from instance | **Done** ([spec](./Combat/COMBAT-F05-enemy-data-driven.md)) |
| — | **COMBAT-F06** | Context-aware orc BT (blackboard + Wisdom) | Planned ([spec](./Combat/COMBAT-F06-enemy-bt-ai.md)) |
| — | **DUNGEON-F01** | Map, encounters, spawn | Planned (after COMBAT-F05) |

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| Equipment wear / dual-wield variants / passives | EQUIP-F02 | EQUIP-F01 |
| Enemy context-aware BT (orc tactical) | COMBAT-F06 | COMBAT-F05 |
| Dungeon / loot / events | DUNGEON-F01 | COMBAT-F05 |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
