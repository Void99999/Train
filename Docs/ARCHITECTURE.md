# LAST TRAIN — architecture

A native Windows PC game in Unreal Engine 5, C++ first, Blueprints where they
earn their place.

---

## Shape of the module

One runtime module, `LastTrain`, in folders that mirror the design:

```
Source/LastTrain/
  Data/          what things are        — no dependencies on anything below
  Core/          the session            — game instance, mode, controller, save
  Player/        the protagonist        — character, input, interaction, vitals
  Weapons/       shooting
  Train/         the machine            — rail, consist, vehicles, doors, throttle
  Economy/       money
  World/         the line               — journey, day/night, blockout
  AI/            enemies and crew
  Audio/         the mix
  UI/            what is on screen
  Cinematics/    the intro and the ending
```

Dependencies run one way: **Data ← everything else.** Nothing in `Data`
includes a system, so balancing can never be blocked by a circular include.

---

## The three decisions that shape everything else

### 1. The train moves; the world does not

The browser prototype kept the train still and slid the scenery past it. That
works for a corridor and collapses the moment the line has to curve, climb, or
have an outpost beside a particular stretch.

Here, `ARailSpline` is the railway and `ATrainActor` owns one number — how far
along it the head of the train is. Every vehicle is placed from that number each
frame. **One integrator, many bodies.** Letting each carriage move itself is how
consists drift apart and couplings stretch.

Everything else on the line is a distance along the same spline, so the train,
an outpost platform and an enemy running alongside all agree where 11 km is.

### 2. The player is an `ACharacter`

Not a custom pawn. Almost everything happens on a machine doing up to 80 km/h,
and `UCharacterMovementComponent` already solves standing on a moving thing:
when the floor is a movable primitive it becomes the character's base and base
movement is applied every frame. Rebuilding that would mean reimplementing one
of the better-tested parts of the engine.

That is why `ATrainVehicle`'s hull is a *movable* primitive on a collision
profile that blocks the pawn. It is not decoration; it is why the player rides
the train instead of being left standing where it used to be.

### 3. Catalogue data is data, and the game runs without it

Weapons, vehicles, cargo, enemies and outposts are `FTableRowBase` structs.
`ULastTrainDataRegistry` loads DataTables named in the balance settings — and
if none are assigned, falls back to a compiled-in set carrying the same numbers.

So a freshly cloned project runs the moment it compiles, and becomes
editor-tunable the moment the CSVs are imported. Without the fallback, the first
experience of the project would be an empty world and five silent failures.

The registry refuses a *partial* load on purpose: rifles from an asset and
wagons from the fallback is worse than either, because a balancing change would
appear to do nothing.

---

## Where the numbers live

- **Cross-cutting values** — `ULastTrainBalance`, a `UDeveloperSettings`. Project
  Settings → Game → Last Train Balance. Saved as text to `DefaultGame.ini`.
- **Catalogue values** — DataTables, or the compiled-in fallback.
- **Anywhere else** — a bug. If a gameplay number appears in a system file, it
  is in the wrong place.

Unreal works in centimetres and the design document is in metres.
`ULastTrainBalance::MetresToCm` converts, in one place.

---

## Interaction

A line trace on a dedicated `Interaction` channel that only usable things
respond to. Cheaper and far more predictable than tracing against `Visibility`
and filtering, because a handrail cannot get in the way of the throttle behind
it.

`IInteractable` is implemented by **components**, not just actors. A locomotive
is one actor with a throttle, two side doors and a rear connection on it, and
each answers for itself — which is what lets the left door and the right door
say different things.

`CanInteract` and `GetInteractionPrompt` are separate questions. That is what
lets the rear door say *"No wagon connected."* instead of either offering an
action that does nothing or vanishing with no explanation.

---

## Placeholders

Everything visual is a blockout: engine cubes scaled to the catalogue's
dimensions. Every one is marked `PLACEHOLDER` in the source and listed in
`Docs/PORTING_STATUS.md`.

They are built from code rather than authored because a `.umap` is binary and
editor-only — a project handed over as source has no level in it, and without
the blockout the first thing anyone sees on pressing Play is a void.

**A cube is not final art and is never to be described as such.**

---

## Verification

`node Tools/validate_project.mjs` — structure only: the `.uproject`, module
wiring, `GENERATED_BODY()`, `.generated.h` ordering, `#pragma once`, truncated
files, and CSV columns against their row structs.

**It is not a compiler.** Only Unreal Build Tool can tell you whether this
builds, and as of this commit nobody has run one against it.

---

## What is not here yet

See `Docs/PORTING_STATUS.md`. The short version: trading, outposts, the Loader,
wagon mounts, menus, localization, the intro, the ending, animation, and
automated tests.
