# COMBAT-F02 — GFC-backed combat integration (stub)

Status: Planned  
Feature ID: COMBAT-F02  
Updated: 2026-07-13

Gameplay reference (read-only): [combat.md](../../design/systems/combat.md), [effects.md](../../design/systems/effects.md)

Depends on: **CORE-F08**, **CORE-F09**, COMBAT-F01

---

## Goal (one paragraph)

Rewire `CombatSession` to use **GA + numeric pipeline** instead of COMBAT-F01 `CardAction` / direct attribute writes.

**Confirmed damage flow (user):**

1. **Attacker** finishes outgoing damage evaluation (CORE-F09 pipeline).
2. Attacker dispatches a **deal-damage gameplay event** (tags + payload: source, target, amount, damage type, …).
3. **Target** has a granted **DealDamage passive GA**; on event where target is self, `tryActivate` runs absorption logic (block / HP via GE or pipeline).

**Full spec:** write after CORE-F08 + CORE-F09 specs stabilize.

---

## Placeholder scope

- Card play → activate card GA (replaces `card-actions.ts` shortcuts).
- Enemy attack → same damage event path.
- Grant `DealDamage` passive on combat bootstrap.
- Retain COMBAT-F01 turn/deck/AP orchestration unless superseded.
