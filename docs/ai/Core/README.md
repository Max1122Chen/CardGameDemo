# Core — implementation design

Engineering **how** for the rules machine. Gameplay **what** stays in [docs/design/Overview.md](../../design/Overview.md) + [systems/](../../design/systems/).

## Index

| Doc | Feature | Status |
|-----|---------|--------|
| [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md) | Cross-cutting | Active |
| [CORE-F01-monorepo-tooling-logging.md](./CORE-F01-monorepo-tooling-logging.md) | CORE-F01 | Done |
| [CORE-F02-gameplay-tag.md](./CORE-F02-gameplay-tag.md) | CORE-F02 | Done |
| [CORE-F03-gameplay-event.md](./CORE-F03-gameplay-event.md) | CORE-F03 | Done |
| [CORE-F04-rule-engine-gameworld.md](./CORE-F04-rule-engine-gameworld.md) | CORE-F04 | Done |
| [CORE-F05-gfc-skeleton.md](./CORE-F05-gfc-skeleton.md) | CORE-F05 | Done |

## Conventions

- One primary doc per `CORE-Fnn` (or ADR for small decision-only changes).
- **Manager / System** naming; **RuleEngine** / **GameWorld** / **GFC** → [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md).
- Provisional defaults for open gameplay questions live here, not in `docs/design/systems/`.
