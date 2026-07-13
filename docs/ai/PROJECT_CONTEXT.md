# CardGameDemo Project Context (for AI)

Last updated: 2026-07-11

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

**Framework foundation (code)** — see [ACTIVE_WORK.md](./ACTIVE_WORK.md).

- **Done:** Design split; CORE-F01–F03 (monorepo, tags, event system)
- **Done:** CORE-F01–F05 (through GFC skeleton)
- **Next:** CORE-F06 Attribute + GE

Agents: follow `ACTIVE_WORK.md` order; register slices in [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md).

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
