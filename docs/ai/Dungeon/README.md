# Dungeon — implementation design

Engineering **how** for adventure / level exploration. Gameplay **what** stays in [docs/design/systems/dungeon.md](../../design/systems/dungeon.md).

## Index

| Doc | Feature | Status |
|-----|---------|--------|
| [DUNGEON-F01-minimal-level-slice.md](./DUNGEON-F01-minimal-level-slice.md) | DUNGEON-F01 | Done |
| [DUNGEON-F02-spatial-level-gen.md](./DUNGEON-F02-spatial-level-gen.md) | DUNGEON-F02 | Done |
| [DUNGEON-F03-explore-round-ap.md](./DUNGEON-F03-explore-round-ap.md) | DUNGEON-F03 | Done |

## Conventions

- 地牢 **层级** = **`level`** in code and data (`level.probe`, `LevelAsset`).
- **Room** = axis-aligned rect on a cell grid (F02+); **door** = cell-edge link; **adventure** = one run (single level until F05).
- Slices use `-Snn` inside the feature doc only.
