# CardGameDemo Project Context (for AI)

Last updated: 2026-07-03

## 1) Project goal

Build a **rules machine** MVP for a roguelike card game: validate gameplay via console and automated agents before investing in rendering.

- **Stack (planned):** TypeScript monorepo — `core` (pure logic), `cli`, `data`, `editor`, optional `ui`
- **Not in scope yet:** full graphics, physics, commercial polish

## 2) Architecture direction (planned)

```text
docs/design/Overview.md + systems/ (gameplay authority, user-owned)
        ↓
Data assets (JSON + Schema) ← Editor (later)
        ↓
packages/core — GameState, RuleEngine, EffectInterpreter, seeded RNG
        ↓
Hosts: CLI / Agent API / simple UI
```

## 3) Current phase

**Design iteration + infrastructure.**

- **Done:** Design split into [Overview.md](../design/Overview.md) + [systems/](../design/systems/)
- **User:** refining mechanics, effects, numbers in design doc
- **Not started:** npm workspace, `packages/core`, combat P0

Agents should **not** start large implementation until `ACTIVE_WORK.md` lists concrete tasks and user scopes work.

## 4) Collaboration conventions

- Bootstrap: `PROJECT_CONTEXT`, `PROGRESS_LOG`, `ACTIVE_WORK`, `BOOTSTRAP_DIGEST`
- Gameplay **what** → [Overview.md](../design/Overview.md) + `systems/`; **how** → `docs/ai/` when tasked
- Session end: append `PROGRESS_LOG`; complex tasks → `sessions/`
- Commit: prepare ≠ execute (`git-commit-mentor`)

## 5) Key links

- [WORKING_WITH_AI.md](./WORKING_WITH_AI.md)
- [BOOTSTRAP_DIGEST.md](./BOOTSTRAP_DIGEST.md)
- [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md)
- Rules: `.cursor/rules/`, skills: `.cursor/skills/cardgame-prototype-mentor/`

## 6) Maintenance

Keep this file **stable and high-level**. Fast-changing details → `PROGRESS_LOG`, `ACTIVE_WORK`, `sessions/`.
