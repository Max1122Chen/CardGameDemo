# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: post–CORE-F13** — thin GA runtime shipped; pick next Feature.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–18 | … through CORE-F13 | Thin runtime + legacy purge | **Done** ([spec](./Core/CORE-F13-thin-ga-runtime.md)) |
| — | **CLI-F01** | ndjson / debug stubs | Planned (parallel) |

**Architecture lock (current):**

- GA runtime = tag gates + hook invoke + services only (**no** auto cost / GE / listen / end).
- GA content = archetype Def (`parameters` + `effectBindings` + `costEffectRef` + `handlerId`).
- GE = JSON templates + SetByCaller; bind `$Param` → `Data.*` at apply (in hook).
- Cost = Cost GE + `checkCost` / `applyCost` / `commitAbility` (hook-timed).
- Listen = `startListen` / `stopListen` in hook only.
- Combat host: `@cardgame/combat`; core = pure framework.

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| Equipment + equipment-driven deck | EQUIP-F01 | now available |
| Enemy data + AI | COMBAT-F04 | now available |
| Dungeon / loot / events | DUNGEON-F01 | Combat + equipment data |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
