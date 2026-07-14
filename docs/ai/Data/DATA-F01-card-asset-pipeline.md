# DATA-F01 — Card & effect asset pipeline (JSON)

## Meta
- **ID:** DATA-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-14
- **Related:** [CORE-F10](../Core/CORE-F10-data-driven-gfc-gaps.md), [COMBAT-F03](../Combat/COMBAT-F03-combat-describability-probes.md)
- **Gameplay (read-only):** [equipment-and-cards.md](../../design/systems/equipment-and-cards.md)

Depends on: CORE-F10, COMBAT-F03  
Blocks: EQUIP-F01, COMBAT-F04 (enemy data)

---

## TL;DR

Load **CardDefinition** graphs from validated JSON into `CombatSession`. Starter deck (Strike / Defend / Bash) + F03 probe cards become assets. Adding a card = new JSON + test, **no core combat TS change**.

---

## Goal

1. **Schema** aligned with COMBAT-F03 checklist (Zod preferred for TS monorepo).
2. **Loader** reads files / in-memory JSON → CORE-F10 parse → runtime `CardDefinition`.
3. **CombatSession** bootstraps deck from loaded cards (id multiplicity for starter).
4. **Migrate** TS card defs to `data/cards/*.json` (or `packages/core/fixtures` → promote to `data/`).

---

## Product stance

| Topic | Decision |
|-------|----------|
| Package home | **Proposed:** repo-root `data/` assets + loader module in `packages/core/src/data/` (or new `packages/data` if Node fs needed). Prefer **core parse + host/cli reads files** so core stays I/O-free. |
| Core purity | `parseCardDefinition(json, tagManager)` in core; **CLI / tests** call `fs.readFile` |
| Schema | Zod in core or `@cardgame/data`; JSON Schema export optional P1 |
| Editor | Out |
| Equipment injection | Out (EQUIP-F01) |
| Localization | Out |

---

## Architecture

```text
data/cards/
  strike.json
  defend.json
  bash.json
  weaken.json          # F03 probe (optional pack)
  …

data/decks/
  starter.json         # ["strike","strike",…]

packages/core
  definitions/parse-*.ts   # from CORE-F10
  data/parse-card.ts       # CardDefinition wrapper

packages/cli | tests
  loadCardsFromDir(path) → Map<id, CardDefinition>
  CombatSession({ cardCatalog, deckIds })
```

### Card JSON sketch

```json
{
  "id": "strike",
  "name": "Strike",
  "cost": 1,
  "targeting": "single_enemy",
  "settleTakeDamageOnTarget": true,
  "ability": {
    "id": "ga.card.strike",
    "kind": "active",
    "chargeCostOnActivate": false,
    "endPolicy": "manual",
    "tags": { "abilityTags": ["Card.strike"] },
    "effectsOnActivate": [
      {
        "target": "self",
        "effect": {
          "id": "ge.card.strike.damage-face",
          "duration": { "kind": "Instant" },
          "modifiers": [
            { "attribute": "Damage", "op": "Override", "magnitude": 6 }
          ]
        }
      },
      {
        "target": "target",
        "effect": {
          "id": "ge.card.strike.feed-damage-to-take",
          "duration": { "kind": "Instant" },
          "modifiers": [
            {
              "attribute": "DamageToTake",
              "op": "Override",
              "magnitude": {
                "kind": "AttributeBased",
                "captureFrom": "Source",
                "attribute": "Damage",
                "valueKind": "Current"
              }
            }
          ]
        }
      }
    ],
    "listenWhileActive": {
      "channelTag": "Combat",
      "eventTags": [
        "GameplayEvent.Combat.TryPlayCard",
        "GameplayEvent.Combat.CancelPlayCard"
      ],
      "match": "any"
    }
  },
  "commitEffects": []
}
```

Defend: `settleTakeDamageOnTarget: false`; commit applies Block from `BlockToGain` (session helper or commitEffect Asset).

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **DATA-F01-S01** | Zod (or hand schema) for CardDefinition + GE/GA nested |
| **DATA-F01-S02** | `parseCardDefinition` + error paths; fixture round-trip tests |
| **DATA-F01-S03** | Wire CombatSession to catalog map + deck id list |
| **DATA-F01-S04** | Migrate Strike/Defend/Bash (+ probes) to JSON; delete duplicate TS factories |

---

## Locked decisions (2026-07-14)

| ID | Decision |
|----|----------|
| Q7 Layout | `data/cards/*.json` at repo root; core I/O-free |
| Q8 Validation | F10 parse first; Zod optional in DATA-F01-S01 |

---

## Open decisions (need user)

See chat **拍板清单 Q7–Q8**. Defaults if “按建议”:

| ID | Default |
|----|---------|
| Q7 Layout | `data/cards/*.json` at repo root; core stays I/O-free; tests/CLI load files |
| Q8 Validation | Zod in `packages/core` (devDependency already via workspace tools — or minimal hand validators from F10 parse) |

---

## Exit criteria

- [x] Starter battle from JSON deck matches F02/F03 numeric tests
- [x] New probe card = JSON only + test assert
- [x] `npm run verify` green
- [x] Status → Done; FEATURE_REGISTRY + PROGRESS_LOG

---

## Downstream (do not implement here)

| Feature | Notes |
|---------|-------|
| **CORE-F11** | Reusable GE/GA assets, SetByCaller, Activation registry; retires inline-as-end-state |
| EQUIP-F01 | Equipment → inject card ids into deck |
| COMBAT-F04 | Enemy defs / intent from data |
| DUNGEON-F01 | Encounter tables |

---

## Approval

**Review** — implement after F10 + F03 Done.
