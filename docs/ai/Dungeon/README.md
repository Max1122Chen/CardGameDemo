# Dungeon — implementation design

Engineering **how** for adventure / level exploration. Gameplay **what** stays in [docs/design/systems/dungeon.md](../../design/systems/dungeon.md).

## Index

| Doc | Feature | Status |
|-----|---------|--------|
| [DUNGEON-F01-minimal-level-slice.md](./DUNGEON-F01-minimal-level-slice.md) | DUNGEON-F01 | Planned |

## Conventions

- 地牢 **层级** = **`level`** in code and data (`level.probe`, `LevelAsset`).
- **Room** = node on a level graph; **adventure** = one run (F01: single level).
- Slices use `-Snn` inside the feature doc only.
