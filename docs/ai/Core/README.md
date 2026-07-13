# Core — implementation design

Engineering **how** for the rules machine. Gameplay **what** stays in [docs/design/Overview.md](../../design/Overview.md) + [systems/](../../design/systems/).

## Index

| Doc | Feature | Status |
|-----|---------|--------|
| [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md) | Cross-cutting | Active |
| [CORE-F01-monorepo-tooling-logging.md](./CORE-F01-monorepo-tooling-logging.md) | CORE-F01 | Done |
| [CORE-F02-gameplay-tag.md](./CORE-F02-gameplay-tag.md) | CORE-F02 | Done |

## Conventions

- One primary doc per `CORE-Fnn` (or ADR for small decision-only changes).
- **Manager / System** naming and framework type names → [ENGINEERING_CONVENTIONS.md](./ENGINEERING_CONVENTIONS.md).
- Provisional defaults for open gameplay questions live here, not in `docs/design/systems/`.
- Supersede via doc **变更记录** or a new ADR; do not silently drift from recorded decisions.
