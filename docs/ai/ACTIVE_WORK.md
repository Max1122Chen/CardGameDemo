# Active work (agent backlog)

Last updated: 2026-07-16

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: post–CORE-F12** — parameterized GA/GE + Cost GE shipped; pick next Feature.

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–17 | … through CORE-F12 | Params + Cost GE + hooks + `@cardgame/combat` | **Done** ([spec](./Core/CORE-F12-tech-debt-polish.md)) |
| — | **CLI-F01** | ndjson / debug stubs | Planned (parallel) |

**Architecture lock (current):**

- GA = archetype Def (`parameters` + `effectBindings` + `costEffectRef` + `handlerId`); cards override `parameters`.
- GE = JSON templates + SetByCaller; bind `$Param` → `Data.*` at apply.
- Cost = Cost GE + `checkCost` / `applyCost` / `commitAbility`.
- Listen = explicit in activate hook; Session = bridge only.
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
