# LAST TRAIN — architecture

This document records the decisions that are expensive to reverse. Read it
before changing anything under `src/core` or `src/data`.

## Engine and delivery

**Decision: native ES modules in the browser, with three.js vendored.**

The project began as a browser prototype and stays on the web stack. The
practical consequences:

- No build step. Edit a file, reload the page.
- No runtime dependencies and no CDN. `vendor/three/` holds three.js r185
  (MIT, licence included), so the folder runs offline and unchanged forever.
- The whole simulation is plain JavaScript with no engine types in it, so it
  runs headlessly under `node --test`. That is why nearly every rule in the
  game is covered by tests that never draw a frame.

Because the game is delivered as ES modules, browsers refuse to load it over
`file://`. Serve the folder instead — `npm start`. This is the single most
common "it doesn't work" report and it is not a bug.

## Layers

```
src/
  data/        pure values. Balancing, catalogues, localization.
  core/        services with no gameplay in them: events, save, input,
               localization, settings, state machine, RNG.
  systems/     the rules. Train, player, economy, combat, world, AI, run.
  render/      three.js. Reads the simulation, never writes to it.
  ui/          DOM. Reads a flat snapshot, never touches a system directly.
  game.js      wiring and the loop. Contains no gameplay numbers.
```

The dependency rule is one-directional: `ui` and `render` may import from
`systems`, `core` and `data`; `systems` may import from `core` and `data`;
`core` may import from `data`; `data` imports nothing but `data`.

Nothing in `data/` may import a system. That keeps balancing edits free of
circular-import surprises, and it is why `balance.js` is safe to import from
anywhere.

## Why the simulation does not know about the renderer

Every system exposes plain state and emits events. The renderer subscribes and
rebuilds meshes when something changes; the HUD receives a flat snapshot object
built in `game.js`.

This is what makes the two hardest features testable:

- **Uncoupling.** `Train.damageVehicle` decides that everything behind a
  destroyed wagon is cut loose. There is no mesh involved, so the rule can be
  asserted directly.
- **The Loader.** He walks at 1.35 m/s along an offset measured in metres from
  the front of the locomotive. The tests advance him with `crew.update(delta)`
  and check that a shell took a believable number of seconds to arrive.

## The event bus

`src/core/events.js`. Systems announce; they do not call each other. A listener
that throws is logged and skipped — one broken HUD widget must never stop the
train from being updated.

Event names are constants in `GAME_EVENT`. A typo is then a crash at import
time rather than a listener that silently never fires.

## Save data

Three slots — `settings`, `records`, `run` — because they have different
lifetimes. Settings survive everything. Records survive a failed run. The run
checkpoint is replaced constantly and cleared when the run ends.

Every slot carries a schema version and a migration chain
(`MIGRATIONS` in `saveSystem.js`). Loading walks the record forward to the
current version. Bump the version and add a migration in the same commit.

Two deliberate behaviours:

- A payload is fully serialised *before* storage is touched, so a save that
  cannot be written leaves the previous save intact.
- A record written by a newer build is refused rather than guessed at.

## Secrets the interface must never learn

The ending depends on the player not knowing the line has an end. Two rules
enforce this in code rather than in review:

1. `JourneyTracker.hudSnapshot()` returns travelled distance and the last
   outpost reached. There is no method anywhere that returns distance
   remaining, outposts remaining, or "is this the final one".
2. `FINAL_SEQUENCE_DISTANCE_KM` lives in `data/journey.js` and is read only by
   the ending trigger.

`tests/journey.test.js` asserts that the HUD snapshot contains no key matching
`remaining`, `total`, `final` or `next`. If someone adds one, the suite fails.

## Localization

No user-facing string is written into markup or into a system. The interface is
built in code (`src/ui/dom.js`) precisely so that every string has to go
through `Localization.t()`.

`tools/check-locales.js` verifies that every language has the same key set and
the same placeholders, and runs as part of `npm run check`.

Translations are written to read naturally, not literally. The title stays
`LAST TRAIN` in every language.

## Rendering

The train never moves. The world slides past underneath it
(`World.#scrollWorld`). This keeps the player near the origin — a hundred
kilometres of floating-point drift would visibly shake the camera — and makes
an endless railway a matter of recycling scenery.

Materials are generated onto a canvas at runtime rather than loaded from image
files (`src/render/materials.js`). Weathering is therefore a parameter: the
same steel material is asked for "lightly used" or "eight years in a war zone"
and produces a matching albedo and roughness map. Vehicle meshes are rebuilt
when a vehicle's damage state, level or armour changes, so damage is visible on
the machine rather than only on a health bar.

## Testing

`npm run check` runs the locale check and the full suite — 259 tests, none of
which need a GPU.

Most of them cover the simulation. A few cover geometry, which is unusual and
worth explaining: `tests/domStub.js` provides just enough of a 2D canvas for
the render modules to build their meshes under Node, so a test can construct
the real cab, the real locomotive and the real cinematic props and measure
them. That is how the door, the walkway and the two camera paths through the
cab are checked — by walking a body through the actual colliders and by taking
the actual bounding box of the actual hand mesh, rather than by reasoning about
coordinates on paper. Two earlier attempts at the hand-through-the-console bug
were fixed on paper and were still wrong.

Anything that depends on what a frame *looks like* — lighting, materials, the
mix — still has to be looked at and listened to. `npm start` and open the page.

## Current state

Built and tested: the data layer, all core services, the train simulation,
the economy, progression, the journey, the player, the combat model, the
Loader, the day/night cycle, the menus and the HUD, the walkable cab with its
side doors and walkways, the interaction system, the intro cinematic and the
audio layer.

Not yet built: outpost locations, enemy AI actors, projectiles, the workshop
and shop interfaces. The systems those features need already exist and are
tested; what is missing is the presentation and the actors.

Still placeholder, and described as such deliberately: every sound is
synthesised at runtime rather than recorded; there are no character models,
no skeleton and no inverse kinematics, so the hand in the intro is a shaped
prop on a scripted path; and the locomotive, while it is now a real room with
real doors, is built from primitives rather than modelled.
