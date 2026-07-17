# COMBAT-F06 — Enemy behavior-tree AI (context-aware, higher Intelligence)

## Meta
- **ID:** COMBAT-F06
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CORE-F14](../Core/CORE-F14-behavior-tree.md), [COMBAT-F05](./COMBAT-F05-enemy-data-driven.md), [combat.md](../../design/systems/combat.md) § AI

Depends on: COMBAT-F05 Done, CORE-F14 Done  
Blocks: richer dungeon encounters (DUNGEON-F01)

> **Attribute note:** Tactical thresholds use **Intelligence** (智力). **Wisdom** (感知) is reserved for perception-style mechanics later — not used in F06.

---

## TL;DR

F05 ships **fixed** enemies (slime `Repeat+Sequence`). F06 adds **smart** enemies that read battlefield state each turn:

1. **Combat adapter** fills a **blackboard** before enemy tick and before Intent peek.
2. **`bt.orc_tactical.json`** uses `Selector` + `combat.playCardIf` / `combat.playBestCard`.
3. **Intelligence** modulates HP thresholds (defend earlier, finish player earlier).
4. **Intent peek** walks Selector with conditions + playability; fixed Sequence (slime) shows planned step even if card not in hand.

**Probe:** `orc_brute` → `behaviorTreeId: bt.orc_tactical`.

---

## Implemented (2026-07-17)

| Area | Files |
|------|-------|
| Blackboard | `packages/combat/src/enemy-blackboard.ts` |
| Card scoring | `packages/combat/src/enemy-card-choice.ts` |
| Intent peek | `packages/combat/src/enemy-bt-peek.ts` |
| Session wire | `packages/combat/src/combat-session.ts` |
| BT leaf budget | `packages/core/src/bt/tick.ts` — failed Task/Compare do not consume budget (Selector fallback) |
| Data | `data/behavior-trees/bt.orc_tactical.json`, `orc_brute.behaviorTreeId` |
| Tests | `combat-f06.test.ts`, `enemy-blackboard.test.ts` |

Host tasks: `combat.playCardIf` (`when`, `cardId`), `combat.playBestCard` (`when?`, `goal`).

---

## Enemy turn timing (Intent sync)

Enemy draw/AP **prep runs at player turn start** (`prepareEnemyForUpcomingTurn`), not on enemy turn:

| Phase | Player | Enemy |
|-------|--------|-------|
| **Player turn begins** | Block→0, AP refill, draw `turnDraw` (5) | Discard leftover hand, AP refill, draw `enemyTurnDraw` (5) |
| **Player turn (UI)** | Player acts; **Intent** peeks BT with enemy’s prepped hand/AP | — |
| **Player EndTurn** | Hand discarded | — |
| **Enemy turn** | — | Block→0, **BT tick only** (play one card) |

Opening battle: enemy uses `enemyOpeningDraw` once; every subsequent player turn triggers enemy prep. Fixes stale AP / empty hand causing `Unknown` Intent.

---

## Blackboard contract

| Key | Type | Source |
|-----|------|--------|
| `intelligence` | number | `character.primaries.intelligence` |
| `selfHp` / `selfMaxHp` / `selfHpPct` | number | enemy Health |
| `selfBlock` / `selfAp` | number | enemy attrs |
| `playerHp` / `playerMaxHp` / `playerHpPct` / `playerBlock` | number | player attrs |
| `selfLowHp` / `playerLowHp` | boolean | HP% vs Intelligence thresholds |

```text
selfLowHpThreshold  = clamp(0.22, 0.48, 0.48 - intelligence * 0.013)
playerLowHpThreshold = clamp(0.18, 0.40, 0.40 - intelligence * 0.009)
```

Orc (`intelligence` 6): defend bias ~40% HP; finisher bias ~35% player HP.

---

## Tactical tree (`bt.orc_tactical.json`)

Selector priority:

1. `playCardIf` — `when: selfLowHp`, `cardId: defend`
2. `playBestCard` — `when: playerLowHp`, `goal: finisher`
3. `playBestCard` — `goal: damage`
4. `playCard` — `strike` / `defend` fallbacks

`bt.orc_stub.json` kept for regression reference.

---

## Acceptance

- [x] `fillEnemyBlackboard` before enemy tick + Intent
- [x] Orc defends when `selfLowHp` + defend in hand
- [x] Orc plays best damage card when healthy
- [x] Intent matches next action (orc + slime regression)
- [x] `npm run verify` green (226 tests)

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | Stub registered |
| 2026-07-17 | Full design |
| 2026-07-17 | Implemented; Intelligence (not Wisdom) for thresholds |
