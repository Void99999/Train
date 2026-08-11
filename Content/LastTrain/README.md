# Content

Most of this tree is empty, and deliberately so.

Unreal's asset formats — `.uasset`, `.umap` — are binary. They can only be
created by the editor. Nothing here fakes one: a hand-written file with those
extensions would fail to load and would waste whoever opened it an afternoon
finding out why.

What is here instead is everything that *can* be written as text.

## Data/Source/

Five CSVs holding the game's catalogues, with the balancing carried over from
the browser prototype where it was tuned:

| File | Rows | Imports as |
|---|---|---|
| `DT_Weapons.csv` | 11 | `FWeaponRow` |
| `DT_Vehicles.csv` | 9 | `FVehicleRow` |
| `DT_Cargo.csv` | 7 | `FCargoRow` |
| `DT_Enemies.csv` | 4 | `FEnemyRow` |
| `DT_Outposts.csv` | 10 | `FOutpostRow` |

Drag one into the Content Browser, choose **DataTable**, pick the matching row
type, then assign all five under **Project Settings → Game → Last Train Balance
→ Data Tables**.

Until they are assigned, `ULastTrainDataRegistry` uses a compiled-in copy of the
same numbers, so the game runs either way. All five must be assigned together —
a half-loaded catalogue is refused on purpose.

`node Tools/validate_project.mjs` checks the CSV columns against the row structs.
A column that does not match is dropped silently on import and leaves the field
at zero, which is a very quiet way to lose a catalogue.

## The empty folders

`Maps`, `Blueprints`, `Input`, `Localization`, `Cinematics`, `Audio`,
`Materials`, `Meshes` — these are where the authored assets go.
`Docs/UNREAL_SETUP.md` §3 lists exactly which ones are needed, what each
replaces, and which single one is required before the game will do anything at
all. (It is the level.)
