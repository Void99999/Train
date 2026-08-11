# LAST TRAIN

A first-person survival game. A soldier walks away from a helicopter crash,
finds an abandoned green locomotive beside a railway shelter, and takes it a
hundred kilometres through a war zone — trading, arming it, and fighting off
what comes for it.

**Native Windows PC, Unreal Engine 5, C++.**

---

## Status

Early. The project is a C++ vertical-slice foundation.

> **It has never been compiled.** There is no Unreal Engine in the environment
> it was written in. Expect build errors on the first attempt and see
> [`Docs/UNREAL_SETUP.md`](Docs/UNREAL_SETUP.md) §6.

What exists in code and is meant to work once it builds:

- First-person movement, sprint on a stamina budget, crouch, jump
- Gaze-based interaction with a dedicated trace channel
- A locomotive that follows a real spline through a real 3D world
- Four throttle notches — stand, 25, 50, 75, 100 — with weight-scaled response
- A walkable cab with two sliding side doors onto railed exterior walkways
- A rear connection that reports *"No wagon connected."* until something is coupled
- Wagons: coupling, uncoupling, upgrade levels, cargo slots, armour, damage states
- Weapons driven from a catalogue: rate of fire, magazines, reload from the train's stores
- Health, stamina, money, the journey, unlocks, the day/night cycle
- A save format, versioned, with migration in place before there is anything to migrate

Everything visible is a **blockout** — engine cubes scaled to the right
dimensions. See [`Docs/PORTING_STATUS.md`](Docs/PORTING_STATUS.md) for the full,
honest list of what is real, what is a placeholder, and what does not exist yet.

---

## Getting it open

1. Install Unreal Engine 5.4 and Visual Studio 2022 with the C++ game
   development workload.
2. Right-click `LastTrain.uproject` → **Generate Visual Studio project files**.
3. Build `Development Editor | Win64`.
4. Open the project, create an empty level at
   `Content/LastTrain/Maps/L_VerticalSlice`, and press Play.

The full list — including exactly which assets only the editor can create — is
in [`Docs/UNREAL_SETUP.md`](Docs/UNREAL_SETUP.md).

---

## Controls

| Key | |
|---|---|
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint |
| Ctrl | Crouch |
| Space | Jump |
| E | Interact |
| Left mouse | Fire |
| R | Reload |
| TAB | Weapon wheel (held) |
| Esc | Pause |

---

## Layout

```
LastTrain.uproject
Config/                    engine, game, input, editor settings
Source/LastTrain/          the game module — see Docs/ARCHITECTURE.md
Content/LastTrain/         assets, and the CSVs the DataTables import from
Docs/                      setup, architecture, porting status
Tools/                     validate_project.mjs
Prototypes/BrowserPrototype/   the archived browser version
```

---

## Checking the project without the engine

```
node Tools/validate_project.mjs
```

Catches malformed `.uproject` files, missing `GENERATED_BODY()`, `.generated.h`
include ordering, truncated files, and CSV columns that do not match their row
struct. **It is not a compiler.**

---

## The browser prototype

`Prototypes/BrowserPrototype/` is the earlier three.js version. It is reference
material — the balancing was tuned there and every number carried across — and
it still runs:

```
cd Prototypes/BrowserPrototype
npm start          # then open http://localhost:8080
npm run check      # 263 tests
```

It is no longer the game.
