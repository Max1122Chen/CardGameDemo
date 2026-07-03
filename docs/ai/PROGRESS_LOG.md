# CardGameDemo Progress Log (for AI)

Last updated: 2026-07-03

## Purpose

AI-oriented timeline of **what landed in the repo**. Not a full changelog. Append new entries at the top of **Recent entries**.

---

## Recent entries

### 2026-07-03 — Design doc layout + initial repo (WF-F01)

- **Goal:** Move gameplay design to `docs/design/`; prepare initial commit.
- **Main changes:** `docs/design/卡牌游戏.md`, governance, Cursor rules/skills, `docs/ai` workflow
- **Next step:** Formalize spec sections; rule engine design

### 2026-07-03 — Migrate gameplay design into repo (WF-F01)

- **Goal:** `卡牌游戏.md` as in-repo source of truth; remove external pointer; keep agent read-only policy.
- **Main changes:**
  - Added `docs/ai/design/卡牌游戏.md` (from external copy, 2026-07-01)
  - Added `DESIGN_DOC_GOVERNANCE.md`; removed `GAME_DESIGN_POINTER.md`
  - Replaced `external-design-governance.mdc` → `design-doc-governance.mdc`; updated all references
- **Next step:** User continues design iteration; agent helps with effect-system guidance when asked

### 2026-06-25 — AI collaboration infrastructure (WF-F01-S01)

- **Goal:** Port minEngine-style docs/ai + Cursor rules/skills; external design pointer; no gameplay implementation yet.
- **Main changes:**
  - `.cursor/rules/` — session bootstrap, hard constraints, trust tiers, workflow triggers, external design governance, docs layout
  - `.cursor/skills/` — `cardgame-prototype-mentor`, `git-commit-mentor`
  - `docs/ai/` — PROJECT_CONTEXT, ACTIVE_WORK, BOOTSTRAP_DIGEST, FEATURE_REGISTRY, templates, GAME_DESIGN_POINTER
- **Docs:** this log, WORKING_WITH_AI, README
- **Validation done:** N/A (docs/rules only)
- **Next step:** User continues external gameplay design; promote tasks in ACTIVE_WORK when ready for code

---

## Timeline summary (high level)

1. **2026-06-25 — Workflow foundation**
   - Established human–AI collaboration skeleton adapted from minEngine.
   - Gameplay design stays external; agents read-only by default.
