# Active work (agent backlog)

Last updated: 2026-07-14

> **Agent:** Primary backlog. Do not infer implementation from full design docs without promotion here.

---

## In focus

**Phase: Data-driven abilities** — CORE-F11 landed (handlers + SetByCaller + thin cards).

| Order | Feature | Scope (short) | Status |
|-------|---------|---------------|--------|
| 1–16 | CORE-F01–F11, COMBAT-F01–F03, CLI-F02, DATA-F01 | GFC + JSON cards + AbilityActivationRegistry | **Done** |
| — | **CLI-F01** | ndjson / debug stubs | Planned (parallel, not blocking) |

**Next:** User may promote CORE-F12 (tech-debt polish) or EQUIP / COMBAT-F04 after review.

---

## Deferred (user roadmap — register when promoted)

| Theme | Suggested ID | After |
|-------|--------------|-------|
| F11 structural polish | CORE-F12 | After F11 commit |
| Equipment + equipment-driven deck | EQUIP-F01 | Prefer after polish |
| Enemy data + AI | COMBAT-F04 | Prefer after polish |
| Dungeon / loot / events | DUNGEON-F01 | Combat + equipment data |

---

## Related

| File | Role |
|------|------|
| [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md) | Feature IDs |
| [TECH_DEBT.md](./TECH_DEBT.md) | Open deferred items |
| [ENGINEERING_CONVENTIONS.md](./Core/ENGINEERING_CONVENTIONS.md) | Naming |
