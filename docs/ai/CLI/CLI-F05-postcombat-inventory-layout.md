# CLI-F05 — Post-combat result + inventory in-frame layout

## Meta
- **ID:** CLI-F05
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CLI-F04](./CLI-F04-combat-ui-layout.md), [ITEM-F01](../Items/ITEM-F01-item-foundation.md), [EQUIP-F01](../Equipment/EQUIP-F01-equipment-loadout.md)

Depends on: CLI-F04 Done  
Blocks: further inventory chrome polish

---

## TL;DR

1. **Victory / Defeat:** replace **Enemies** pane content with centered `VICTORY` / `DEFEAT` (Player pane stays).
2. **Victory loot:** reuse bottom-left **Hand** pane as **Loot** (digit select like cards); **do not** auto-open bag.
3. **Open bag (`B`):** top row becomes **Equipment | Grid** (left | right); **bottom row unchanged** (Hand/Loot | Log).
4. Settings / Console remain stacked overlays (unchanged).

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Feature **CLI-F05** | User 2026-07-17 |
| D2 | Result banner lives **inside Enemies pane**, centered | User |
| D3 | Victory: Hand pane → Loot list (stays Loot even when empty); digits select; no auto-`B` | User 2026-07-17 |
| D4 | Inventory open: top = **Equipment left / backpack Grid right**; bottom stays as-is | User |
| D5 | Inventory is **in-frame** (replaces Player\|Enemies), not a full-width stacked chrome dump | User + partner |
| D6 | Post-combat with pending loot: `P` pickup selected, `A` pickup all (stats `P`/`E` idle until next battle) | Partner default |
| D7 | Opening bag with pending loot defaults focus to **equipment** (loot stays on bottom; Tab still cycles loot) | Partner default |
| D8 | Narrow (`cols` &lt; 72): stack Equipment → Grid → bottom panes | Partner default |
| D9 | Selected backpack **grid cells** use cyan background fill (`selectedCell`), not fg-only | User 2026-07-17 |

---

## Layout modes

### Combat (unchanged from F04)

```text
[ Player | Enemies ]
[ Hand   | Log     ]
```

### Victory (bag closed)

```text
[ Player |  VICTORY  ]
[ Loot   | Log       ]
```

### Defeat

```text
[ Player |  DEFEAT   ]
[ Hand*  | Log       ]   * empty / muted — no loot
```

### Inventory open (any combat result)

```text
[ Equipment | Grid WxH ]
[ Hand/Loot | Log      ]   ← same bottom as before open
+ place> prompt / bag footer hints under top row or in status
```

---

## Input (delta)

| Context | Binding | Behavior |
|---------|---------|----------|
| Victory + pending loot, bag closed | `1–9` | Select loot index (reuse SelectHand path) |
| | `←`/`→` or `h`/`l` | Prev/next loot |
| | `P` | Auto-pickup selected |
| | `A` | Pickup all |
| | `B` | Toggle bag (top row only) |
| Bag open | existing IMC_Inventory | Tab / E / U / T / D / place coords; digits → place input |
| Bag open | bottom Loot | Visible; focus `loot` via Tab for ↑↓ select |

---

## Out of scope

- Redesign Settings / Console overlays
- New place UX beyond current `place> x y [rot]`
- Gameplay design doc edits under `docs/design/systems/`
- EQUIP-F02 wear rules / dual-wield

---

## Acceptance

- [x] Victory shows centered `VICTORY` in Enemies pane; no enemy list
- [x] Defeat shows centered `DEFEAT` in Enemies pane
- [x] Victory pending loot listed in bottom-left pane titled `Loot`; digits select
- [x] Victory does **not** auto-open inventory
- [x] `B` replaces top twin with Equipment \| Grid; bottom Hand/Loot \| Log unchanged
- [x] Closing bag restores Player \| Enemies (or result banner)
- [x] Render + input tests cover victory loot + inventory top-row swap
- [x] `npm run verify` green

---

## Slices

| Slice | Work | Status |
|-------|------|--------|
| **S01** | Frame: result banner, Hand→Loot, inventory top-row twin | Done |
| **S02** | Input/session: loot select via digits; post-combat P/A; bag default focus | Done |
| **S03** | Tests + ACTIVE_WORK / Progress / registry Done | Done |

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | Spec locked from user decisions; implement immediately |
| 2026-07-17 | Implemented + verify green (199 tests) |
| 2026-07-17 | Polish: empty Loot pane stays after pickup; grid selection uses bg fill |
