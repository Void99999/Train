# Porting status: browser prototype → Unreal Engine 5

Honest accounting of what moved, what did not, and what is a placeholder.

The browser prototype is archived at `Prototypes/BrowserPrototype/` and still
runs (263 tests passing). It is reference material now, not the game.

---

## Ported and believed complete

| System | Where it lives now | Notes |
|---|---|---|
| Balancing values | `ULastTrainBalance` (Project Settings → Game) | Every cross-cutting number, carried over exactly. Editable without a recompile, saved as text to `DefaultGame.ini`. |
| Weapon / vehicle / cargo / enemy / outpost catalogues | `LastTrainCatalogRows.h` + `ULastTrainDataRegistry` | Same ids, same numbers. DataTable-driven, with a compiled-in fallback so the game runs before anything is imported. |
| Top-level state machine | `ULastTrainGameInstance` | Declared transitions; an illegal one warns rather than silently doing nothing. |
| Save format + migration | `ULastTrainSaveGame` | Versioned from the start. No saves exist yet to migrate. |
| Player movement | `ALastTrainCharacter` | `ACharacter`, so riding a moving train is the engine's problem and not ours. |
| Input | `ULastTrainInputConfig` + Enhanced Input | W/A/S/D, mouse, Shift, E, TAB, Esc. Runtime fallback when no asset is assigned. |
| Health | `UHealthComponent` | No passive regen, as designed. |
| Stamina | `UStaminaComponent` | 8 s sprint, 6 s refill, delay, start threshold. |
| Interaction | `UInteractionComponent` + `IInteractable` | Gaze via a dedicated trace channel. Fixes the prototype's proximity bug by construction. |
| Weapons | `UWeaponComponent` | One component, catalogue-driven. Rate of fire, magazine, reload, reserve from the train's cargo. |
| Throttle | `UThrottleComponent` + `UThrottleControlComponent` | Setting and control are separate. |
| Train motion | `ATrainActor` + `ARailSpline` | **Real spline following in a real world.** Single integrator, vehicles placed from it. |
| Performance / weight | `ATrainActor::GetPerformanceMultiplier` | Wagons, armour and cargo all bite; floored at 55%. |
| Vehicle health + armour | `UVehicleHealthComponent` | Plates wear, keep helping when stripped, drive a damage state. |
| Cargo | `UCargoHoldComponent` | Slots, partial loads, fractional loss on death. |
| Couplings | `ATrainActor::AttachWagon` / `DetachFrom` | Detaching takes everything behind it. |
| Doors | `UTrainDoorComponent` | Side doors always usable; rear reports "No wagon connected." |
| Wallet | `UWalletComponent` | Tracks earned separately from held. |
| Journey / outposts / unlocks | `UJourneyTracker` | Catches every outpost passed in a frame — the prototype's blocking bug cannot recur. |
| Day/night | `ADayNightCycle` | 40-minute cycle. Carries the prototype's hard-won lesson about sun elevation. |
| HUD data | `ULastTrainHudWidget` | All readouts. **Deliberately no "distance remaining"** — the ending stays a surprise. |

---

## Placeholder — works, but is not the real thing

Each is labelled `PLACEHOLDER` in the source.

| What | Where | What it actually is |
|---|---|---|
| Locomotive and wagon bodies | `ATrainVehicle::RebuildBlockout` | An engine cube scaled to the catalogue dimensions. |
| Cab interior | `ALocomotive::BuildCabBlockout` | ~24 boxes: floor, walls with door gaps, ceiling, console, walkways, railings. Walkable and correct; ugly. |
| Door leaves, throttle quadrant | `UTrainDoorComponent`, `UThrottleControlComponent` | Scaled cubes. The quadrant has no markings. |
| The world | `ABlockoutBuilder` | Ground slab, curved track, ballast, marker posts, sun, sky, fog. |
| Projectile weapons | `UWeaponComponent::FireProjectile` | Hitscan with radial damage at the impact point. The damage model is real; the flight is not. |
| Enemy behaviour | `AEnemyCharacter::Tick` | Turns towards the train and shoots in range. No perception, no cover, no movement. |
| Damage visuals | `ATrainVehicle::HandleDamageStateChanged` | Logs the state change. Nothing visual. |
| Detached wagons | `ATrainActor::DetachFrom` | Removed rather than rolling to a stop behind the train. |
| Train audio | `UTrainAudioComponent` | Layer structure, curves and rail-joint timing are real. **No sounds assigned — the train is silent.** |

---

## Not ported yet

Nothing below is stubbed or faked. It simply does not exist.

- **Trading and shops** — `TradeService`, `Workshop`, price volatility, buy/sell UI
- **Train blueprint panel** — the diagram of the consist
- **Outpost actors** — docking, the safe zone, the platform, the services
- **Loader NPC** — hiring, assignment, fetching shells
- **Combat wagon mounts** — the firing positions the player operates by hand
- **Weapon wheel UI** — the input action is bound and the state is tracked; nothing draws
- **Encounter director** — what spawns, where, and how difficulty scales along the line
- **Enemy vehicles** — the catalogue rows exist; there is no vehicle actor
- **Menus** — main menu, options, pause, language selection
- **Localization** — a String Table needs authoring; `en`/`de` strings are in the archived prototype at `Prototypes/BrowserPrototype/src/data/locales/`
- **The intro** — `AIntroDirector` handles the handover and the skip; there are no shots
- **The ending** — wreck escape and rescue
- **Run manager** — death, respawn rules, Normal vs Hardcore consequences
- **Animation** — no skeleton, no anim blueprint, no IK, no character model

---

## Tests

The prototype's 263 tests did not come across, and that is a real loss.

Unreal's equivalent is the Automation Test framework (`IMPLEMENT_SIMPLE_AUTOMATION_TEST`),
which needs the engine to run. The systems most worth covering first are the ones
that were tested before and where a regression is invisible:

1. `GetPerformanceMultiplier` — weight, armour and cargo penalties, and the floor
2. `UJourneyTracker::UpdateDistance` — every outpost caught in one long frame
3. `UVehicleHealthComponent::ApplyDamage` — armour wear and the stripped floor
4. `UCargoHoldComponent` — slot arithmetic and partial loads
5. `ATrainActor::TakeRounds` — whole units out, remainder kept in the magazine
6. `ULastTrainBalance::DamageStateFor` — band boundaries

`Tools/validate_project.mjs` covers structure only. It is not a substitute.
