# Opening and building LAST TRAIN

This project was written without Unreal Engine present. It has **never been
compiled**. Everything below is what you need to do to change that, in order.

---

## 1. What you need installed

| Thing | Version | Why |
|---|---|---|
| **Unreal Engine** | **5.4** | Set in `LastTrain.uproject` as `EngineAssociation`. If you have a different 5.x, edit that string; the code targets 5.4 APIs and 5.3–5.5 should be fine. |
| **Visual Studio 2022** | 17.8 or newer | The compiler. Community edition is enough. |
| VS workload: **Game development with C++** | — | Installs the toolchain UBT expects. |
| VS component: **.NET 6.0 Runtime** | — | Unreal Build Tool is a .NET application. |
| VS component: **Windows 10/11 SDK** | 10.0.22621 or newer | Links against the platform. |
| **Windows 10/11 64-bit** | — | `TargetPlatforms` is Windows only. |
| Disk | ~100 GB free | Engine plus derived data cache. |

Linux and macOS will build the code, but the project is configured Windows-first
(DX12, SM6) and the design targets a Steam PC release.

---

## 2. First open

1. Right-click `LastTrain.uproject` → **Generate Visual Studio project files**.
   (If that entry is missing, the engine version association is wrong. Run
   `UnrealVersionSelector.exe` from your engine's `Engine/Binaries/Win64`.)
2. Open `LastTrain.sln`.
3. Set the configuration to **Development Editor**, platform **Win64**.
4. Build. Expect this to take 10–30 minutes the first time.
5. **Expect compile errors on the first attempt.** This code has never been
   through a compiler. See §6.
6. Once it builds, launch by double-clicking `LastTrain.uproject`.

On first launch you will see:

> `EditorStartupMap` could not be found

That is expected. The map does not exist yet — see §3.

---

## 3. What only the editor can create

These are binary asset formats. They cannot be written as text, and nothing in
this repository fakes them.

### Required before the game does anything

| Asset | Path | How |
|---|---|---|
| **Vertical slice level** | `Content/LastTrain/Maps/L_VerticalSlice` | File → New Level → Empty Level. Save to that exact path. The `.ini` files already point at it. |

That is the only *required* one. Open that empty level and press Play: the game
mode notices there is no railway and builds a placeholder world from code — a
lit ground plane, four kilometres of curved track, marker posts, and a train
standing on it. You can walk, drive, open the cab doors and fire the pistol.

**Everything it builds is boxes.** It is a blockout for testing the systems, not
the game's environment.

### Needed to replace the placeholders

| Asset | Path | Replaces |
|---|---|---|
| Input Actions + Mapping Context | `Content/LastTrain/Input/` | The runtime fallback bindings in `ULastTrainInputConfig::BuildRuntimeFallback`. Needed before keys can be rebound in a menu. |
| HUD widget (UMG) | `Content/LastTrain/UI/WBP_Hud` | Derive from `ULastTrainHudWidget`, bind its `Get…` functions, set it on `ALastTrainPlayerController::HudWidgetClass`. Until then the game runs with no interface. |
| DataTables | `Content/LastTrain/Data/` | Import the five CSVs in `Data/Source/`, pick the matching row struct, then assign them under **Project Settings → Game → Last Train Balance → Data Tables**. Until then the compiled-in catalogue is used. |
| String Table | `Content/LastTrain/Localization/ST_Game` | English and German strings. `ULastTrainHudWidget::GetEquippedWeaponName` already reads from this path. |
| Locomotive mesh + materials | `Content/LastTrain/Meshes/` | The placeholder cube in `ATrainVehicle::RebuildBlockout` and the box cab in `ALocomotive::BuildCabBlockout`. |
| Sounds | `Content/LastTrain/Audio/` | `UTrainAudioComponent` has the layers, curves and rail-joint timing; it has no sounds. MetaSounds suit this design best. |
| Intro Level Sequence | `Content/LastTrain/Cinematics/LS_Intro` | `AIntroDirector` plays it if assigned and skips straight to gameplay if not. |
| Enemy Behavior Tree + Blackboard | `Content/LastTrain/AI/` | `AEnemyCharacter`'s placeholder "turn and shoot" tick. |
| Animation Blueprint | `Content/LastTrain/Animation/` | Nothing — there is no character animation at all yet. |

---

## 4. Importing a DataTable

1. Drag `Content/LastTrain/Data/Source/DT_Weapons.csv` into the Content Browser.
2. Choose **DataTable**, and pick row type **WeaponRow**.
3. Repeat for Vehicles, Cargo, Enemies, Outposts.
4. **Project Settings → Game → Last Train Balance → Data Tables** — assign all five.

All five must be assigned. The registry deliberately refuses a half-loaded
catalogue: rifles from an asset and wagons from the fallback is worse than
either, because a balancing change would appear to do nothing.

`Tools/validate_project.mjs` checks that the CSV columns match the row structs,
which is worth running after any change to either — a mismatched column is
dropped silently on import and leaves the field at zero.

---

## 5. Checking the project without the engine

```
node Tools/validate_project.mjs
```

Catches: malformed `.uproject`, missing `GENERATED_BODY()`, a `.generated.h`
that is not the last include, missing `#pragma once`, truncated files, and CSV
columns that do not match their row struct.

**It is not a compiler.** It cannot tell you whether the C++ builds.

---

## 6. When it does not compile

It has never been compiled, so assume there is something. The likely areas, in
order of probability:

1. **Header paths.** Engine headers move between versions. `Components/SkyAtmosphereComponent.h`, `Engine/ExponentialHeightFog.h` and the Enhanced Input headers are the ones most likely to have moved.
2. **Enhanced Input API.** `UInputMappingContext::MapKey` and the modifier classes in `LastTrainInputConfig.cpp` are the least common API in the project.
3. **`UDeveloperSettings`.** Needs the `DeveloperSettings` module, which is in `LastTrain.Build.cs`. If `ULastTrainBalance` fails to resolve, check that first.
4. **`ULevelSequencePlayer`.** `LevelSequence`, `MovieScene` and `MovieSceneTracks` are private dependencies; if the linker complains, they may need to be public.

Fix them, then re-run the validator and commit. Do not work around a compile
error by deleting the feature.

---

## 7. Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint (drains stamina) |
| Ctrl | Crouch |
| Space | Jump |
| E | Interact — throttle, doors |
| Left mouse | Fire |
| R | Reload (draws from the train's cargo) |
| TAB | Weapon wheel (held) |
| Esc | Pause |

The throttle cycles: stand → 25 → 50 → 75 → 100 → stand.
