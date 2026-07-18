# DUNGEON-F03 — Explore round timing + door AP

## Meta
- **ID:** DUNGEON-F03
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-18
- **Related:** [DUNGEON-F02](./DUNGEON-F02-spatial-level-gen.md), [dungeon.md](../../design/systems/dungeon.md)
- **Depends on:** DUNGEON-F02 Done

---

## TL;DR

1. Explore uses **rounds**; each round starts with full **explore AP** (default 3).
2. **Intra-room** moves cost 0 AP; **door** moves spend edge cost (typically 1).
3. When AP &lt; move cost, move is illegal; player can still loot / confirm combat / leave / **EndRound**.
4. **EndRound** emits `RoundEnd`, then starts next round (`RoundStart` + refill AP). Refresh hooks empty for now.
5. Explore AP is owned by `AdventureSession` (not combat `ActionPoints` GFC).

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Default max explore AP = 3 | Design example |
| D2 | Spend only on door/edge cost &gt; 0 | F02 model |
| D3 | EndRound always legal in explore when not pending combat | Partner |
| D4 | Combat interrupt does not refill explore AP | Partner |
| D5 | Lifecycle `RoundStart` / `RoundEnd` emit on bus | F02 stubs |

---

## Scope

### In

- `AdventureSession` round index + explore AP
- `EndRound` explore action + CLI binding (`f`)
- AP gate on move / `ga.dungeon.move`
- Snapshot + CLI status (Round / AP)
- Tests

### Out

- Unit pool refresh on round end (later)
- Fractional corridor costs (keep integer 1 for now)
- Rest / multi-round rest
- Fog (F04), multi-level (F05)

---

## Slices

| Order | Slice | Status |
|-------|-------|--------|
| S01 | Session round/AP + EndRound + lifecycle | Done |
| S02 | CLI bind + HUD + tests | Done |

---

## 验收

- [x] Round 1 starts with full AP
- [x] Door move spends AP; intra-room does not
- [x] AP too low → cannot Move that direction
- [x] EndRound refills AP and increments round; emits RoundEnd then RoundStart
- [x] `npm run verify` green

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Spec created; implementation |
| 2026-07-18 | S01–S02 Done |
