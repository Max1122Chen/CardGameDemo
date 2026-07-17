# COMBAT-F06 — Enemy behavior-tree AI (context-aware, higher Wisdom)

## Meta
- **ID:** COMBAT-F06
- **Status:** Planned
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CORE-F14](../Core/CORE-F14-behavior-tree.md), [COMBAT-F05](./COMBAT-F05-enemy-data-driven.md)

Depends on: COMBAT-F05 Done, CORE-F14 Done  
Blocks: richer dungeon encounters

---

## TL;DR

After F05 proves **fixed BT** enemies (slime), F06 adds **context-aware** trees for higher-Wisdom foes (e.g. orc):

- Blackboard populated each enemy turn: self HP/AP/block, player HP/block, hand card ids + costs, legal plays.
- BT uses `Selector` + `BlackboardCompare` + weighted/scored child order (Wisdom modulates weights).
- Same `behaviorTreeId` asset model — orc references `bt.orc_tactical.json`, not a separate AI code path.

**Non-goals:** enemy hand UI; multi-target; item use from backpack in combat (defer).

---

## Probe: orc

- Richer deck (multiple equipment grants).
- `Wisdom` ~8–10.
- BT example: if player low HP → aggressive card; if self low HP → defend/buff; else play highest expected damage legal card.

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | Stub registered; implement after COMBAT-F05 |
