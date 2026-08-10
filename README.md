# LAST TRAIN

A first-person survival train game set in a fictional war zone.

A soldier survives a helicopter crash, is separated from his unit, and finds an
abandoned green locomotive at a railway building. He does not know where the
line goes or whether anyone is coming for him. He takes the train and starts
moving.

Over the journey he trades cargo, buys and upgrades wagons, armours them,
stores ammunition, mans train-mounted weapons and fights soldiers, vehicles and
tanks. His train grows from one locomotive into a mobile survival machine — and
every wagon he adds makes it slower, which means longer under fire.

**Keep moving. Survive. Get home.**

## Playing it

Double-click **`last-train-standalone.html`**. That is the whole procedure — no
server, no installation, no internet. Everything the game needs is inside that
one file, and it can be copied anywhere on its own.

It needs a current browser and a machine that can do WebGL, which in practice
means anything from the last decade.

## Developing it

```
npm start          # http://localhost:8080
npm test           # 180 unit tests, no browser needed
npm run check      # locale consistency + the full suite
npm run build      # regenerate last-train-standalone.html
```

There are no dependencies to install and no build step in the loop: edit a file,
reload the page.

> Double-clicking `index.html` shows a blank page. The game is delivered as
> native ES modules and browsers refuse to load those over `file://`. Serve the
> folder — that is what `npm start` does — or use the standalone file above.

### How the standalone build works

`tools/build-standalone.js` embeds every module's source as a string. At load
time a small resolver walks the import graph, turns each module into a Blob URL,
and rewrites the relative specifiers in its dependents to point at those URLs.
Blob URLs are same-origin wherever the page came from, so the module graph loads
from a file on disk.

Only the specifier strings are rewritten — there is no bundler and no
transpiler, so the standalone build runs exactly the same code as the served
one. Rebuild it after changing any source file.

## What is in the repository

```
last-train-standalone.html  the whole game in one file (generated)
index.html                  the game shell
src/data/                   every balancing value and catalogue
src/data/locales/           English and German
src/core/                   events, save, settings, input, localization, state
src/systems/                the rules: train, player, economy, world, combat, AI
src/render/                 three.js scene, materials, train meshes
src/ui/                     menus and HUD
tests/                      the test suite
tools/                      dev server, locale checker
vendor/three/               three.js r185, vendored (MIT)
docs/ARCHITECTURE.md        decisions that are expensive to reverse
docs/BALANCING.md           where every number lives, and why
prototype/                  the original animated intro, still runnable
```

## Controls

| | |
| --- | --- |
| `W A S D` | move |
| Mouse | look |
| `Shift` | sprint |
| `E` | interact |
| `R` | reload |
| `H` | use a medkit |
| `Tab` (hold) | weapon wheel |
| `↑` `↓` | throttle up and down |
| `Esc` | pause |

Bindings live in one place (`src/core/input.js`) and on-screen prompts read the
key that is actually bound, so a rebind can never disagree with the interface.

## State of the project

The game is being built in the order the design calls for: architecture first,
then a vertical slice, then content. Systems are written, tested and only then
extended.

**Working and covered by tests**

- Data-driven balancing for weapons, wagons, cargo, enemies, shops, armour,
  repairs, unlocks and the journey
- Localization in English and German, switchable from the main menu and from
  the pause menu, saved between sessions
- Versioned save system with migrations, and settings that persist immediately
- Train simulation: four throttle notches that really change speed, weight and
  armour penalties with a 55% floor, per-wagon health and armour, progressive
  damage states, and uncoupling — destroy a wagon and everything behind it is
  cut loose, rolls to a stop and is gone
- Cargo held per wagon and counted in slots, so space is a real decision
- Economy: trading with sell-all and sell-half, weapon and ammunition shops,
  medical services, and a workshop that previews what a purchase would do to
  the train before the player commits
- Progression: unlocks granted at outposts and never revoked; the 45-second
  quiet stretch after leaving one
- Player: 100 health with no regeneration, sprint stamina, medkits, weapons
  that reload out of the train's own stores and waste no rounds doing it
- Combat model: weapons that behave differently against armour, splash damage,
  wagon walls that genuinely protect the player inside them, and enemy target
  selection that spreads fire instead of locking onto the locomotive
- The Loader: hired once, walks the train at human pace, carries exactly one
  shell at a time, and simply cannot reach ammunition behind a break in the train
- Normal and Hardcore modes, outpost checkpoints, death penalties, statistics
  and personal bests
- A continuous 40-minute day/night cycle that slides rather than switches
- The main menu on an animated night railway, options, language, pause and HUD
- First-person driving from the cab

**Not built yet**

Walkable interiors and moving between wagons, outpost locations to walk around,
enemy actors and projectiles, the weapon wheel, the blueprint and workshop
interfaces, audio, the opening cinematics, and the derailment and rescue ending.
The systems each of those needs already exist and are tested; what is missing is
the presentation layer and the actors.

Nothing the player can currently see reveals how long the line is. That is
deliberate and enforced by a test.

## The prototype

`prototype/` holds the original animated opening — the train explosion, the
helicopter attack and crash, the crawl across the battlefield, and the cab with
its four power settings. It still runs on its own:

```
http://localhost:8080/prototype/
```

It is kept because it is a working sketch of the opening cinematic, which is a
late phase of the project. It is not wired into the game.

## Credits and licensing

All designs, models, materials and text are original to LAST TRAIN.

three.js is vendored under `vendor/three/` and is MIT licensed; its licence is
included alongside it.
