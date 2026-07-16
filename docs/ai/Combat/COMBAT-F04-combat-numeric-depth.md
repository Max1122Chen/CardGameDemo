# COMBAT-F04 — Combat numeric depth (caps, six stats, damage pipeline, probes)

## Meta
- **ID:** COMBAT-F04
- **Status:** Implemented — **await user playtest / approval** before commit & Done.
- **Owner:** —
- **Last updated:** 2026-07-16
- **Related:** [COMBAT-F03](./COMBAT-F03-combat-describability-probes.md), [CORE-F09](../Core/CORE-F09-numeric-calculation-pipeline.md), [CORE-F13](../Core/CORE-F13-thin-ga-runtime.md), [CLI-F02](../CLI/CLI-F02-terminal-tui.md)
- **Gameplay (read-only):** [attributes.md](../../design/systems/attributes.md), [gameplay-framework.md](../../design/systems/gameplay-framework.md) §伤害管线, [equipment-and-cards.md](../../design/systems/equipment-and-cards.md) §属性补正

Depends on: CORE-F09 Done, CORE-F12/F13 Done, DATA-F01 Done

---

## TL;DR

Turn combat into a **framework validation battlefield**:

1. **Caps** — `MaxHealth` / `MaxActionPoints` as attributes; `AttributeChange` callbacks clamp currents; **mend** heal card proves it.
2. **Six primaries** — player + enemy bootstrap; **global** Attribute Bonus grade table; cards declare grade + stat(s) only.
3. **Damage pipeline** — `Damage` bound to `[CommonDamage, DamageOffset]`; face = panel base + **AttributeBonus** + **Scaling** + **Multiplier** + offset; feed → `DamageToTake` → absorb → TakeDamage.
4. **CLI** — `P` / `E` stats overlay; preview line shows damage breakdown.
5. **Deck** — fewer Strike/Defend; probe cards each stress one mechanism; **flex removed**.

**Non-goals:** derived `MaxHealth` from Constitution; equipment; enemy JSON catalog; block correction pipeline; d20 (`random.md`); ndjson (CLI-F01).

---

## Problem (current vs target)

| Topic | Today | Target |
|-------|-------|--------|
| HP/AP ceiling | Session tuneables set initial base only | `MaxHealth` / `MaxActionPoints` + clamp |
| Strike | `damage-face` Override = panel | Panel = base; pipeline → **current** |
| Flex | `Damage +2` Infinite GE | **Removed** — use surge / precise cut |
| Attribute Bonus | None | Global table + card `attributeBonus` |
| Enemy attack | Fixed damage bypass | Same `Damage` pipeline on enemy entity |
| CLI | HP/AP in frame | Stats overlay + preview breakdown |

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | **Neutral = 10** for all primaries | User 2026-07-16 |
| D2 | Attribute Bonus grades in **`data/combat/attribute-bonus.json`**; cards never embed factors | User |
| D3 | `d = sum(stats) - neutral`; `bonus = floor(\|d\| × factor)`; bonus if `d≥0` else punishment; **Add @ CommonDamage** via SetByCaller `Data.AttributeBonus` | design docs |
| D4 | `Damage` pipeline: **`[EvaluationStage.CommonDamage, EvaluationStage.DamageOffset]`** | CORE-F09 |
| D5 | Bootstrap: tuneables → **Max** attrs + fill current; turn start AP → **MaxActionPoints.current** | User |
| D6 | **Clamp** via `onPostAttributeChange`: `Health ∈ [0, MaxHealth.current]`, `AP ∈ [0, MaxActionPoints.current]` | User |
| D7 | **No** Constitution → MaxHealth derivation this Feature | User |
| D8 | **Remove flex** card + `ge.card.flex.strength`; deck uses surge / precise cut instead | User |
| D9 | CLI: **`p`** player stats, **`e`** enemy stats overlay; six primaries ANSI colors per §CLI | User |
| D10 | `attributeBonus` on **card JSON root** (sibling of `parameters`); loader validates grade + stats | User |
| D11 | Main frame: **Damage breakdown only during preview**; full six primaries in overlay only | User |
| D12 | **Block correction deferred** | User |
| D13 | **Enemy attack** uses enemy `Damage` pipeline (bootstrap panel + stats), not Session hardcoded amount | Partner, accepted |
| D14 | **Table-driven correction unit tests** + turn-start AP trace | Partner, accepted |
| D15 | Correction computed in **combat hook** before `applyEffectBindings('preview')`; injected as SetByCaller — not entity Infinite GE | Partner |

---

## Attribute model

### Combat attribute keys

| Key | Role | Bootstrap default |
|-----|------|-------------------|
| `MaxHealth` | HP ceiling | tuneable |
| `Health` | Current HP | = Max at start |
| `MaxActionPoints` | AP ceiling | `actionPointsPerTurn` |
| `ActionPoints` | Current AP | = Max at turn start |
| `Strength` … `Charisma` | Primaries | scenario table |
| `Damage` | Outgoing face | pipeline |
| `DamageScaling` | Additive % stack | base **1.0** |
| `DamageMultiplier` | Multiplicative stack | base **1.0** |
| `DamageOffset` | Additive | base **0** |
| `DamageToTake` / `Block` / `BlockToGain` | Unchanged | existing |

### Primary attributes

| Key | 中文 | CLI ANSI |
|-----|------|----------|
| `Strength` | 力量 | yellow |
| `Constitution` | 体质 | red |
| `Dexterity` | 敏捷 | green |
| `Intelligence` | 智慧 | blue |
| `Wisdom` | 感知 | gray |
| `Charisma` | 魅力 | magenta |

### Scenario bootstrap (default)

| Entity | Str | Con | Dex | Int | Wis | Cha | MaxHP | Notes |
|--------|-----|-----|-----|-----|-----|-----|-------|-------|
| Player | 12 | 10 | 10 | 10 | 10 | 10 | 30 | tuneable |
| Slime | 8 | 10 | 6 | 4 | 6 | 4 | 12 | tuneable |

Enemy attack: slime sets `Damage.base` from attack template (e.g. panel 6) + optional correction before feed — **not** `dealDamageToEntity(fixed 6)` bypass.

---

## Global Attribute Bonus

**File:** `data/combat/attribute-bonus.json`

```json
{
  "neutral": 10,
  "grades": {
    "none": { "bonus": 0, "punishment": 0 },
    "A": { "bonus": 1.0, "punishment": 1.0 },
    "B": { "bonus": 0.75, "punishment": 0.5 },
    "C": { "bonus": 0.5, "punishment": 0.5 },
    "D": { "bonus": 0.25, "punishment": 0 }
  }
}
```

**API (`@cardgame/combat`):** `computeAttributeBonus(grade, statValues, config) → number`

**Card wire:**

```json
{
  "id": "strike",
  "name": "Strike",
  "cost": 1,
  "targeting": "single_enemy",
  "abilityRef": "ga.archetype.cardPlayDamage",
  "parameters": { "Damage": 6 },
  "attributeBonus": { "grade": "A", "stats": ["Strength"] }
}
```

Loader: reject unknown grade/stat; merge bonus metadata into card `CardDefinition` for hooks.

---

## Damage flow

```text
[preview — source]
  hook: setByCaller.Data.AttributeBonus = compute(...)
  applyEffectBindings('preview'):
    damage-face: Override Damage.base ← Data.Damage (panel)
                 Add Damage @ CommonDamage ← Data.AttributeBonus
    (pipeline: × DamageScaling, × DamageMultiplier @ CommonDamage)
    (+ DamageOffset @ DamageOffset)
  feed-damage-to-take on target: Override DamageToTake ← Source.Damage.Current

[target absorb]
  vulnerable etc. @ EvaluationStage.DamageAbsorb

[commit]
  TakeDamage GA → Block → Health
```

### GE templates

#### `ge.template.damage-face` (revise)

```json
{
  "id": "ge.template.damage-face",
  "duration": { "kind": "Instant" },
  "modifiers": [
    {
      "attribute": "Damage",
      "op": "Override",
      "magnitude": { "kind": "SetByCaller", "key": "Data.Damage" }
    },
    {
      "attribute": "Damage",
      "op": "Add",
      "magnitude": { "kind": "SetByCaller", "key": "Data.AttributeBonus" },
      "evaluationStage": "EvaluationStage.CommonDamage"
    }
  ]
}
```

#### New / revised effect templates

| id | Purpose |
|----|---------|
| `ge.combat.heal` | Instant Add Health ← SetByCaller `Data.Heal` |
| `ge.buff.damage-scaling` | Duration Add `DamageScaling` +0.25 @ CommonDamage |
| `ge.buff.damage-multiplier` | Duration Multiply `DamageMultiplier` 1.25 @ CommonDamage |
| `ge.buff.damage-offset` | Instant Add `DamageOffset` +4 @ DamageOffset |

`ge.template.feed-damage-to-take` — **unchanged**.

### Hook changes (`card-play-handlers`)

Before `applyEffectBindings('preview')`:

1. Read card `attributeBonus` + entity primaries.
2. Merge into activation `setByCaller` / helper context for GE apply.

**mend:** new hook `combat.cardPlayHeal` or extend status hook — apply heal GE on commit only (no preview damage).

---

## Probe card roster (locked)

Display **name** localized; **id** English snake.

| id | name | cost | target | Panel / heal | Correction | Proves |
|----|------|------|--------|------------|------------|--------|
| `strike` | Strike | 1 | enemy | 6 | A + Str | baseline + correction |
| `bash` | Bash | 2 | enemy | 8 | A + Str | higher panel |
| `jab` | Jab | 0 | enemy | 3 | D + Str | weak / D grade |
| `heavy_blow` | Heavy Blow | 2 | enemy | 5 | B + Str | commit self +25% scaling (1 turn) |
| `surge` | Surge | 1 | self | — | — | commit self ×1.25 DamageMultiplier (1 turn) |
| `precise_cut` | Precise Cut | 1 | enemy | 2 | C + Dex | +4 DamageOffset |
| `mend` | Mend | 1 | self | heal 8 | — | MaxHealth clamp |
| `weaken` | Weaken | 1 | enemy | — | — | vulnerable regression |
| `defend` | Defend | 1 | self | block 5 | — | block unchanged |
| `wait` | Wait | 1 | none | — | — | AP only |

**Removed:** `flex`, `ge.card.flex.strength`.

**Starter deck (`data/decks/starter.json`):**

```json
["strike","strike","defend","defend","bash","jab","heavy_blow","surge","precise_cut","mend","weaken","wait"]
```

---

## Golden scenarios (hand calc — test oracle)

Defaults: Player Str=12, neutral=10, mult/corr/offset bases unless noted, slime 0 block.

| Scenario | Steps | Expected |
|----------|-------|----------|
| G1 baseline strike | strike → commit | Damage current = 6 + floor(2×1.0) = **8** HP loss |
| G2 weaken + strike | weaken → strike | 8 × 1.25 = **10** HP loss |
| G3 heavy + strike | heavy_blow → strike | 8 × 1.25 = **10** HP loss |
| G4 surge + strike | surge → strike | 8 × 1.25 corr = **10** HP loss |
| G5 precise | precise_cut → commit | 2 + 0 dex + **4 offset** = **6** HP loss |
| G6 mend cap | damage to 22/30, mend | Health → **30** |
| G7 mend overflow | 28/30, mend 8 | Health → **30** not 36 |
| G8 F03 regression | weaken → strike (full session) | enemy HP **2** |

> **Note:** G8 expected value verified at implement time against new pipeline; document final number in tests.

---

## CLI

| Key | Action |
|-----|--------|
| `P` | Toggle player **stats** overlay |
| `E` | Toggle enemy **stats** overlay |
| `Esc` | Close overlay |

**Overlay:** six primaries (colored) + `HP/MaxHP` + `AP/MaxAP` + `Damage`, `DamageScaling`, `DamageMultiplier`, `DamageOffset`.

**Main frame (preview only):** one line e.g. `dmg: 6+2 ×1.25 ×1.0 +0 → 10` (S04 stretch — **in scope**).

---

## Scope

### In

1. Max attrs + clamp + turn AP refill + trace
2. Six primaries bootstrap (player + enemy)
3. `attribute-bonus.json` + resolver + card wire + loader validation
4. Revised `damage-face`; hook SetByCaller injection
5. Damage pipeline attrs + entity pipeline bind
6. Probe cards + GE JSON + starter deck; remove flex
7. **mend** + heal hook/archetype
8. Enemy attack via Damage pipeline
9. CLI stats overlay + preview breakdown
10. Unit + integration tests (correction table, golden G1–G8)

### Out

- Constitution → MaxHealth
- Block correction
- Equipment
- Enemy JSON catalog (stats in bootstrap tuneables only)
- d20 / random.md
- CLI-F01 ndjson

---

## Slices

| Slice | Deliverable | Gate |
|-------|-------------|------|
| **S01** | MaxHealth/MaxAP, clamp callbacks, turn AP→Max, mend + heal GE, S01 tests | **User review** |
| **S02** | Primaries, correction config + loader, revised damage-face, hook injection, strike/bash/jab, correction unit tests | User review |
| **S03** | Pipeline attrs, heavy_blow/surge/precise_cut, flex removal, deck swap, enemy attack pipeline, G1–G6 tests | User review |
| **S04** | CLI overlay + preview breakdown, G7–G8 + F03 regression, docs DoD, verify green | Done |

---

## Exit criteria

- [x] Health/AP clamped to max attrs; mend proves overflow cap
- [x] Strike matches G1 hand calc through full pipeline
- [x] One card each: mult, corr mult, offset, vulnerable, heal
- [x] Correction factors only in global JSON
- [x] Enemy attack uses Damage pipeline
- [x] CLI stats overlay (p/e) with colors
- [x] Preview damage breakdown line (S04)
- [x] `npm run verify` green (144 tests)

---

## Risks

| Risk | Mitigation |
|------|------------|
| F03 golden HP changes | Recompute G8; document in test |
| Hook SetByCaller threading | Unit test apply path before session |
| precise_cut timing (preview vs commit offset) | Lock: offset GE on **preview** alongside damage-face |

---

## Approval

**Implemented 2026-07-16** — code + tests + verify green; **await user playtest** before marking Done / commit.

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-16 | Initial draft |
| 2026-07-16 | **Implemented:** S01–S04 code; verify 144 tests green; G8 weaken+strike → enemy HP 2; flex removed |
