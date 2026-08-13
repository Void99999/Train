# LAST TRAIN — Visual & Cinematic Review 01

**Reviewer role:** visual / cinematic review only. Implementation stays with Codex in native Unreal Engine 5.8.1.
**Target of this document:** the first 5–10 minutes (menu → intro cinematic → first train driving).
**Goal:** move from *"unfinished white Unreal test arena"* to *"convincing early vertical slice"*.
**Explicit non-goal:** final graphics, new features, more content. See §11.

---

## 0. Scope, sources, and what this review could NOT verify

**Reviewed from:**

- The written playtest report of the current UE 5.8.1 build (9 problems).
- The 2D browser prototype in this repository (`index.html`, `css/style.css`, `js/main.js`), which is *not* the game but *is* the only existing recorded version of the intended dramaturgy. Its act structure and beat timings are used in §2 as an animatic reference.

**Not reviewed — important:**

This repository contains **no Unreal Engine project**. There is no `.uproject`, no `.umap`, no `.uasset`, no C++ source. The Unreal build lives somewhere this review has no access to. Therefore:

- Every diagnosis below marked **[inferred]** is derived from the reported symptom, not from reading Codex's actual assets or Blueprints.
- Where a symptom has more than one plausible cause, all likely causes are listed so Codex can check quickly rather than guess.
- Nothing in this document has been tested in the engine. It is a specification, not a verified fix.

If Codex can expose the Unreal project (or even just screenshots of the Locomotive Blueprint, the Post Process Volume settings, and the PlayerController input setup), a second review pass can be far more precise.

---

## 1. Root cause analysis — 9 reported problems, 3 actual causes

Before the priority list, this matters more than any individual fix. The nine reported problems are not nine independent bugs. They collapse into three root causes, and fixing the roots fixes most symptoms at once.

### Root Cause A — Default blockout material + unconstrained auto-exposure
**Produces:** Problem 1 (white cubes), most of Problem 2 (empty look), part of Problem 6 (locomotive reads as blocks), Problem 5 in the lighting sense (blown-out white).

Unreal's default blockout/BSP material is a flat, near-white, uniform-roughness grey. Combined with default auto-exposure (Eye Adaptation), which continuously renormalises the image so *whatever is on screen* averages to mid-grey, the result is mathematically guaranteed to look like a white test arena. Auto-exposure actively fights every attempt to make a scene dark or moody: point the camera at a dark area and it brightens it back to grey.

This is one material and one Post Process Volume setting. It is the single highest damage-to-effort ratio item in the entire review.

### Root Cause B — No atmospheric / distance layer
**Produces:** Problem 7 (map edges), the "black surroundings" of Problem 2, the flatness of Problem 3, and the general absence of scale and depth.

There is apparently no volumetric fog, no mid-ground occlusion, no distant silhouette layer, and no horizon treatment. Without these, a limited vertical-slice level has nowhere to hide: the player sees geometry, then nothing. "Nothing" reads either as black void or as the sky meeting a hard terrain edge. Both announce "the map ends here."

Atmosphere is also what creates *depth*. A battlefield without haze cannot look large, no matter how much geometry is added.

### Root Cause C — Sequencer does not own the cinematic
**Produces:** Problem 4 (crawl is gameplay, not cutscene), Problem 3 (no camera language, no timing on the explosion), Problem 5 (mouse behaviour inconsistent across state changes), and the general "this is a level, not a film" feeling.

The build appears to hand control to the PlayerController and then *hope* the player walks through the story. The crawl being playable is the clearest evidence. A cinematic needs a single authority that owns the camera, owns the timing, and owns whether input is accepted at all. Until there is an explicit game-flow state machine and Sequencer-driven camera cuts, cinematic quality cannot be authored — only approximated.

---

## 2. Section 1 — VISUAL PRIORITY LIST

Ranked most damaging → least damaging. "Damage" = how much it destroys the player's belief that they are inside a real place, weighted against how cheap it is to fix.

> **P0 outside this list:** the mouse capture bug (Problem 5) is not a visual issue but is the **single most important fix in the build**. It makes the game feel broken within ten seconds of gaining control, before the player has any chance to judge the visuals. Fix it first. See §7.

| # | Problem | Damage | Effort | Root cause | Why this rank |
|---|---------|--------|--------|-----------|---------------|
| **V1** | Uniform white blockout material + blown-out auto-exposure | Critical | **Very low** | A | Affects 100% of screen time in every scene. Fixed with one material library and one exposure lock. Nothing else is worth doing first. |
| **V2** | Visible map edges / black void surrounding everything | Critical | Low–Medium | B | Instantly and permanently breaks immersion. Also the reason the helicopter scene feels empty. Fog + mid-ground blockers + silhouette ring. |
| **V3** | Locomotive: visible geometry ≠ collision (invisible floors, standing in mid-air) | Critical | Medium | — | Breaks the physical contract of the world. Worse than ugly: it reads as *bugged*. The player spends more continuous time inside the locomotive than anywhere else. |
| **V4** | Helicopter battlefield is empty — no war activity, no depth, no scale | High | Medium | A+B | This is the player's first impression of the game's ambition. Currently it promises nothing. |
| **V5** | Crawl sequence handed to the player instead of being a cutscene | High | Medium | C | A dramaturgical failure, not a visual one, but it destroys the intended emotional beat and makes the intro feel unfinished. |
| **V6** | Opening train too slow + weak explosion | High | Medium | B+C | The first 20 seconds set expectations. A limp explosion says "prototype" louder than white boxes do. |
| **V7** | Lighting: no readable interiors, no contrast authoring | Medium | Low | A | Largely solved by V1, then refined. Interiors currently unreadable or blown. |
| **V8** | Locomotive greybox incompleteness (missing shell, no cabin detail) | Medium | Medium | — | Separate from V3. Even a correct-collision locomotive still needs the parts list in §4. |
| **V9** | Debris / VFX quality (blocky debris chunks) | Low | Low | — | Real, but nobody notices debris shape if V1–V6 are fixed. Do last. |

**Recommended order of work:** Mouse (§7) → V1 → V2 → V3 → V6 → V4 → V5 → V7 → V8 → V9.

**Rationale for putting V1 and V2 before everything cinematic:** there is no point authoring beautiful camera moves through a white void. Fix the *look* of the world first, then point cameras at it. Doing it the other way round means re-timing every shot after the lighting changes.

---

## 3. Section 2 — INTRO CINEMATIC SHOT PLAN

### 3.1 Reference: the existing prototype timing

The browser prototype (`js/main.js`) already runs the correct act order and is worth watching before building the Unreal version. Its measured beats:

| Act | Function | Duration | Key beats (ms from act start) |
|-----|----------|----------|-------------------------------|
| 1 — Train | `startSequence()` / `explode()` | ~6.9 s | explosion 0, fade-to-black 4400, scene cleared 6400, fade up 6900 |
| 2 — Helicopter | `runHeliScene()` | ~8.6 s | approach 0–2000 (ease-out), hover 2000, door gunner fires 2500, **hit 4300**, spin/fall 5900, ground impact ~7000–8600 |
| 3 — Crawl | `runFieldScene()` | ~14.3 s | combat decays from 3500 over 4500, shelter approach 0→1 over 8500, **rise begins 9000** (2600 ms, with tremor), cut 12600–14300 |
| 4 — Cab | `runCabScene()` | ~9.4 s | reach 900, press 2500, departure 2900, speed steps at +1800 / +3400, out 7600 |

Total ≈ 45 s. **That is too short for the Unreal version** — the prototype is a title-screen flourish, not an opening cinematic. The plan below expands it to ~2:00 while keeping the same beat order and the same emotional shape.

### 3.2 Global cinematic rules

- **One Level Sequence per act** (`SEQ_01_TRAIN` … `SEQ_08_DEPARTURE`), chained by a Master Sequence. Never one monolithic sequence — it becomes unworkable to iterate.
- **Cine Camera Actor only.** Never the player camera. Shutter angle 180°, motion blur ON. Focal lengths below are on a 36 mm sensor.
- **Camera Cuts track drives everything.** No manual camera blending in Blueprint.
- **Every cut is a hard cut** unless a dissolve is specified. Hard cuts read as deliberate; slow blends read as "the developer couldn't decide."
- **Handheld imperfection on every shot.** A tiny Perlin camera shake (amplitude 0.2–0.5°, frequency 1–3 Hz) on *all* cinematic cameras, always on. Perfectly still cameras are the #1 tell of an amateur game cutscene. This is nearly free and enormously effective.
- **Skip is mandatory.** Hold-to-skip (0.7 s hold) on any key, from frame 1. Never a single tap — accidental skips of a 2-minute intro are infuriating.
- **Letterbox bars** in/out over 0.4 s at cinematic start/end. Cheap, and it tells the player unambiguously "you do not have control now."

### 3.3 Shot list

Total runtime **1:56**. Timecodes are cumulative from cinematic start.

---

#### SEQ_00 — MAIN MENU (before the cinematic)

Not a shot, but it sets the bar. The menu must **not** be a static image or a black screen.

- A live 3D shot: the locomotive standing at the shelter at dusk, seen from a slow, continuous dolly (very slow — 0.3 m/s, looping over ~60 s).
- Volumetric fog, one warm practical light in the cab window, cold key from the sky.
- Distant artillery flashes on the horizon every 8–15 s (random), each with a delayed low rumble 3–5 s later.
- Menu audio: wind bed, distant rumble, faint rail creak. No music required for the vertical slice; ambience is enough and is more distinctive.

**Why:** the menu is the first thing the player sees. If it is atmospheric, they forgive a lot afterwards.

---

#### SEQ_01 — OPENING TRAIN — `0:00–0:12`

**The current problem is not the train's speed value. It is the absence of speed cues.**

Perceived speed comes from the angular velocity of *nearby reference geometry*, not from the m/s number. A train at 25 m/s (90 km/h) filmed from 150 m away looks like it is crawling. The same train filmed from 3 m away, with sleepers at 0.6 m spacing crossing frame at ~40/second and a telegraph pole whipping past every 0.5 s, reads as violently fast.

| Shot | Time | Camera | Content |
|------|------|--------|---------|
| 1.1 | 0:00–0:04 | 24 mm, static, **1.2 m above rail height, 2.5 m from track centre** | Train enters frame L→R and passes camera. Sleepers streak. Camera shakes hard on pass-by (amplitude ramps 0→2° over 0.3 s as the loco arrives, decays over 1.5 s). Motion blur essential. |
| 1.2 | 0:04–0:08 | 50 mm, **tracking parallel** to the train at matched speed | Side profile. Train is now stable in frame; the *background* streaks instead. Foreground occluders (poles, bushes) wipe across frame every ~0.4 s. This is the single strongest speed cue available. |
| 1.3 | 0:08–0:12 | 35 mm, low front 3/4, static, train approaching | Train fills frame. Headlight flare grows. Slight camera push-in (dolly, not zoom) 0.5 m over the shot. Cut on the loco reaching ~70% of frame width. |

**Speed target:** the train must read as **80–100 km/h**. Set the actual velocity, then verify by the pass-by cue, not the number.

**Environment visible:** railway embankment on both sides (see §9 — this is the free map-edge solution), telegraph poles, treeline silhouettes at 200–400 m, heavy ground haze, pre-dawn or dusk sky. No white boxes anywhere in frame.

---

#### SEQ_02 — EXPLOSION — `0:12–0:22`

The reported explosion is weak. Explosions read as powerful because of **timing structure and low frequency**, not particle count.

**Beat structure (from shot start):**

| t | Beat |
|---|------|
| 0.00 s | **Anticipation.** A single frame of the loco lurching / a bright pinpoint at the boiler. |
| 0.10 s | **Pre-flash.** Small light flash, 2 frames. Sells "something ignited" before the main event. |
| 0.30 s | **Main detonation.** Full-screen light flash (0.08 s), fireball begins expanding. |
| 0.30–0.90 s | Fireball expands in **three overlapping waves** at different speeds — a single expanding sphere always looks fake. Bright core → mid orange → dark rolling smoke. |
| 0.35 s | Shockwave ring (a fast-expanding, thin distortion / dust ring along the ground). Cheap, and it is the element most associated with "real explosion" footage. |
| 0.45 s | **Camera reaction begins** — deliberately *after* the flash. Light arrives first. This 0.15 s delay is one of the highest-value details in the whole cinematic. |
| 0.5–2.5 s | Debris arcs with fire trails. Heavy pieces (bogies, boiler sections) tumble slowly; light pieces (panels) flutter. **Do not use uniform cubes** — see §3 note below. |
| 1.0–4.0 s | Smoke column rises, lit from below by the burning wreck. |
| 4.0 s+ | Fire settles. The wreck burns and smokes for the remainder of the shot. Firelight illuminates the surrounding terrain — this is the cheapest way to make the environment look expensive. |

**Camera:** two shots.
- **2.1** `0:12–0:16` — 35 mm, the same low angle as 1.3, holds through the detonation. Camera is knocked (shake 3–4° decaying over 2 s) and the operator "recovers" — a slow, imperfect re-aim rather than a snap back.
- **2.2** `0:16–0:22` — 85 mm, wide-distance shot from ~150 m, on the embankment. Burning wreck, smoke column, silhouettes. **The sound arrives late in this shot** (see below). Slow drift right.

**Audio (this is where the current version fails hardest):**
- **Sub-bass 35–55 Hz with a fast downward pitch sweep is what sells impact.** A loud mid-range bang without sub content will always feel weak, no matter the volume.
- Layered: transient crack (broadband click) → sub boom → metal tearing → debris rain → fire bed.
- **In shot 2.2, delay the sound by distance ÷ 343 m/s** (≈ 0.44 s at 150 m). Free, and it reads as extremely professional.
- Add a short reverb slap off the distant terrain, ~0.8 s after the main event.

**Debris note:** blocky debris is acceptable at greybox stage **only if** the pieces are non-uniform in size and rotation, and tumble on all three axes with varied angular velocity. A dozen identical cubes rotating identically looks worse than five varied chunks. Cost: near zero.

---

#### SEQ_03 — HELICOPTER / BATTLEFIELD — `0:22–0:48`

This is 26 seconds and currently the emptiest part of the build. See §5 for how to fill it cheaply.

| Shot | Time | Camera | Content |
|------|------|--------|---------|
| 3.1 | 0:22–0:28 | 28 mm, **mounted inside the cabin**, looking out the open side door past the door gunner | Establishes we are in a military helicopter. Rotor shadow strobes across the interior (a simple rotating light-function or animated opacity — very cheap, very convincing). Door gunner silhouette. Battlefield sliding past below. |
| 3.2 | 0:28–0:35 | 24 mm, **exterior chase**, helicopter in lower third | Reveals scale: the helicopter is small against a burning landscape. Fires, smoke columns, artillery flashes below. Other aircraft silhouettes in the distance. |
| 3.3 | 0:35–0:41 | 50 mm, **looking down past the skid**, slight handheld | The battlefield directly below: craters, burning vehicles, trench lines, moving lights. **This is the shot that must prove the world is not empty.** |
| 3.4 | 0:41–0:48 | 35 mm, interior, over the gunner's shoulder | Gunner fires. Muzzle flash lights the cabin interior in strobing bursts. Tracers arc down. Shell casings. Radio chatter. Ends on the gunner's head turning toward an off-screen threat — the cut into the hit. |

**What must be visible below at all times:** at least 6–10 fire sources, 3–5 smoke columns of varying height, 2–3 destroyed vehicle silhouettes, trench/road lines cutting across the terrain, and at least one *moving* element (a vehicle, tracer fire, a secondary explosion). Static battlefields read as dioramas.

**The player must never see the void.** In every one of these four shots, frame the camera so that the horizon is either fog, smoke, or terrain — never the edge of the level. See §9.

---

#### SEQ_04 — HELICOPTER HIT — `0:48–0:56`

| Shot | Time | Camera | Content |
|------|------|--------|---------|
| 4.1 | 0:48–0:50 | 50 mm, exterior, tail rotor in frame | Impact on the tail. Bright flash, sparks, immediate smoke trail. Sharp, short shot — 2 seconds only. |
| 4.2 | 0:50–0:56 | 28 mm, **interior**, violent handheld | Alarm tone. Red warning light. The cabin tilts and starts rotating. Loose objects fly. The gunner loses footing and grabs the frame. Rotor pitch drops and warbles. Camera shake amplitude climbs from 1° to 6° across the shot. |

**Audio:** master submix begins a low-pass sweep here (open → ~2 kHz) so the world starts to feel wrong *before* the crash. Alarm tone, metal stress, turbine dying.

---

#### SEQ_05 — CRASH — `0:56–1:04`

| Shot | Time | Camera | Content |
|------|------|--------|---------|
| 5.1 | 0:56–1:00 | 24 mm, exterior wide | The helicopter spins down trailing fire. Spin rate **accelerates** (the prototype does this correctly: angular velocity ramps rather than staying constant). Ground rushes up. |
| 5.2 | 1:00–1:02 | 28 mm, interior, extreme shake | Final 2 seconds before impact. Ground visible through the door. |
| 5.3 | 1:02–1:04 | — | **Impact: cut to black on the frame of contact.** Then hold black for 1.5 s with only audio. |

**The cut-to-black on impact is the correct choice** — it avoids having to animate a convincing crash, it is what real films do, and it makes the transition into the crawl feel intentional. Do not attempt a physics-simulated crash for the vertical slice.

**Audio through the black:** one enormous impact, then **near-silence with a 4–6 kHz tinnitus sine** and everything else heavily low-passed (~500 Hz). This is the strongest emotional tool available in the entire intro and costs almost nothing. See §6.

---

#### SEQ_06 — INJURED CRAWL — `1:04–1:28`

**This is a cutscene. The player does not have WASD.** See §8 for the control contract.

**Presentation:** first-person, camera on a spline, 24 s. Not a free-walk section.

**Camera motion — this is what makes it read as crawling rather than as a slow dolly:**

- Forward motion is **not constant**. It advances in pulls: ~1.4 s per cycle, with a forward surge of ~0.5 m over 0.4 s, then a near-stop. A constant-velocity dolly reads as a camera on rails, which is exactly the problem.
- Vertical bob synced to the pull: camera drops ~4 cm and rises ~7 cm per cycle.
- Roll oscillation ±3–5°, alternating left/right with the arm that is pulling.
- Yaw drift ±6°, slow and irregular.
- Camera height **0.35 m** (prone), not 1.65 m.
- Occasional stumble: every ~7 s, one cycle fails — a bigger drop, a longer pause, heavier breathing.

**Visible body:** left and right forearms/hands entering frame alternately, reaching forward, gripping ground, pulling. The prototype does exactly this and it works. Blood/dirt on the sleeves. If a full first-person body rig is not feasible, **hands and forearms only are sufficient** — do not delay this over rigging a full body.

**Environment (see §5):** burning debris, craters, shattered tree stumps, wrecked equipment, smoke drifting at ground level. The camera being at 0.35 m is an enormous advantage: at that height, ground fog and near-field debris hide almost everything distant, so very little world needs to exist.

**Dramaturgy across the 24 s** (mirroring the prototype's `calm` parameter, which is the right design):

| Time | State |
|------|-------|
| 1:04–1:10 | Combat still close. Rounds crack overhead, impacts nearby, heavy fire glow. Tinnitus still dominant, audio still muffled. |
| 1:10–1:18 | Combat decays. Audio filter opens back up over ~8 s. Breathing becomes the dominant sound. Fire crackle. |
| 1:18–1:28 | Quiet. Distant fire only. The railway shelter and the waiting locomotive resolve out of the smoke ahead — **they must be visible and getting closer**, so the player understands the goal. |

**Optional (mark as optional for Codex):** allow one participatory input — e.g. the player presses W rhythmically to trigger each pull, with the cinematic advancing regardless if they do nothing. This keeps agency during a 24-second non-interactive stretch. It is a well-established technique, but it is *not* required by this spec, and the default remains fully cinematic as requested.

---

#### SEQ_07 — SHELTER & RISE — `1:28–1:40`

| Beat | Time | Content |
|------|------|---------|
| Arrival | 1:28–1:31 | Camera reaches the shelter/embankment. Hands grip a rail or a wall. |
| Rise | 1:31–1:37 | **6 seconds, unsteady.** Camera climbs 0.35 m → 1.65 m on a non-linear, non-monotonic curve: it rises, slips back, rises again. Tremor: a high-frequency, low-amplitude noise scaled by how far through the rise we are. The prototype's approach (`smoothstep` × a sine tremor) is correct — copy that shape. Legs/feet enter the lower frame. Audio: strained breathing, effort vocalisation, cloth, boots on gravel. |
| Approach | 1:37–1:40 | Walking — still limping, camera bob asymmetric (one leg heavier) — toward the locomotive door. Hand reaches out and grips the door handle. |

**The limp must persist into gameplay.** If the character rises and then walks normally, the injury is instantly forgotten and the whole crawl was wasted. Keep an asymmetric camera bob for the rest of the vertical slice, or at least for several minutes.

---

#### SEQ_08 — LOCOMOTIVE ENTRY & DEPARTURE — `1:40–1:56`

| Beat | Time | Content |
|------|------|---------|
| Entry | 1:40–1:44 | Door opens (physically — hinge animation, not a teleport). Camera steps up **onto the step, then into the cab** — two distinct height changes. Door closes behind. Exterior sound ducks noticeably as the door shuts: interior/exterior audio separation is one of the cheapest and most convincing effects available. |
| Cab reveal | 1:44–1:48 | Camera turns to the driver's desk. Gauges, levers, the blueprint panel. One warm practical light. Rain/dirt on the windscreen. This is the player's first proper look at the space they will spend the rest of the slice in — light it carefully. |
| Start | 1:48–1:52 | Hand reaches for the throttle. Engine cranks — starter, ignition, then the diesel settles into an idle rumble. Cab vibration begins (subtle camera noise, 2–4 Hz). Gauges swing up. |
| Departure | 1:52–1:56 | Throttle forward. Engine note climbs, wheel-slip chirp, the world outside the windscreen begins to move. Wheel clack starts slow and accelerates. **Letterbox bars retract, control passes to the player** — ideally *before* the sequence fully ends, so the handover feels seamless rather than like a loading break. |

**Handover rule:** the last 1–2 seconds of the cinematic and the first 1–2 seconds of gameplay should overlap visually. Never: cinematic ends → black → gameplay begins. That reads as a level load.

---

## 4. Section 3 — BATTLEFIELD GREYBOX PLAN

**Principle: a convincing battlefield is made of light, smoke, and silhouette — not of models.** Codex does not need AAA assets. He needs the right *layers*.

### 4.1 The five-layer method

Build every battlefield view in these five layers. Each is cheap. Together they read as a large, active war zone.

**Layer 1 — Ground shaping (terrain, no models)**
- Craters (sculpted, 2–8 m diameter, varied depth), berms, trench lines, vehicle ruts, embankments.
- A flat plane is the enemy. Sculpted ground alone removes most of the "test arena" feeling.
- Cost: Landscape sculpting time only. No assets.

**Layer 2 — Silhouette props (a kit of 8–12 meshes, reused hundreds of times)**

This is the entire prop budget. Build once, scatter everywhere:

| Prop | Notes |
|------|-------|
| Shattered tree stump | 3 height variants. The single most effective battlefield prop that exists. |
| Broken wall / concrete fragment | 3 variants, use as occluders |
| Wrecked vehicle blockform | Silhouette only — burnt, dark, never detailed |
| Sandbag / earthwork block | Stackable |
| Barbed wire post | Line them up; wire can be a simple card |
| Crate / barrel | Rotated, scattered, half-buried |
| Rail sleeper / bent rail section | Ties the battlefield to the train theme |
| Debris pile | Generic, use to break up ground silhouettes |

**Rotate, scale non-uniformly, and half-bury them.** Props sitting perfectly on the ground plane at uniform scale is what makes greybox look like greybox. Sinking props 10–30% into the terrain and rotating them randomly costs nothing and transforms the read.

**Layer 3 — Fire and smoke (the highest-value layer)**

- **6–12 fire sources per battlefield view.** Each = a small Niagara fire + a point light with flicker + local smoke.
- **3–5 smoke columns** at varying heights (10 m, 40 m, 120 m). Tall columns create scale better than any geometry.
- **Ground-level drifting smoke** — wide, slow, semi-transparent sheets moving across the terrain. This is the primary occluder and the primary depth cue.
- Fire lights should actually illuminate the terrain. A burning wreck that does not light its surroundings looks like a sticker.

**Layer 4 — Distant activity (all fake, all cheap)**

- **Artillery flashes:** a light + a brief bloom on the horizon, firing every 4–12 s at random positions, with a rumble delayed 2–6 s. Costs nothing. Reads as an active war.
- **Tracer arcs:** simple ribbon particles arcing between distant points. Even one every few seconds transforms the scene.
- **Distant aircraft silhouettes:** two or three dark shapes crossing the sky slowly.
- **Secondary explosions:** every 15–30 s, a distant flash + delayed boom.

Movement is what separates "battlefield" from "diorama." All of the above are lights and particles — no geometry, no animation, negligible cost.

**Layer 5 — Atmosphere**
- Volumetric fog carrying the fire glow (see §6). This is what binds the four layers above into a single believable image.

### 4.2 Where to spend the detail budget

The player only ever sees the battlefield from **three vantage points**: the helicopter (far, moving, fast), the crawl (0.35 m off the ground, slow, narrow), and the departing train (side-on, moving).

- **Detail only what is within 30 m of the crawl spline.** This is the only place the player gets a close, slow look. Put 80% of the prop budget here.
- The helicopter views need **silhouette and light only** — at that distance and speed, no detail is resolvable. Do not waste effort.
- Everything beyond 200 m: silhouette cards and fog.

This is a large saving and it is invisible to the player.

---

## 5. Section 4 — LOCOMOTIVE GREYBOX STANDARD

### 5.1 The reported bug — most likely cause **[inferred]**

> *"block → gap → block → gap, but some gaps still have collision. I can stand on invisible geometry."*

The most probable cause is **auto-generated convex collision on a hollow or U-shaped mesh.** Unreal's automatic simple-collision generators (`Auto Convex Collision`, or the K-DOP box fits) produce a *convex hull*. A convex hull of a hollow locomotive shell is a **solid block** — it fills the interior, the window openings, the door gaps, and every space between parts. The visual has gaps; the collision does not. That matches the reported symptom exactly.

Other candidates to check, in order:

1. Auto-convex collision on hollow meshes (most likely).
2. Orphaned Blocking Volumes left over from an earlier blockout pass and never deleted.
3. Simple collision authored before the mesh was scaled — collision does not always follow non-uniform scale as expected.
4. `Use Complex Collision As Simple` not set on shell meshes that need it.

**Diagnosis takes two minutes:** viewport view mode → **Player Collision**, and console `show COLLISION`. The mismatch will be immediately visible. Do this before changing anything.

### 5.2 Collision rules — non-negotiable

- **R1.** Every walkable surface must be **visible from directly above that spot.** If the player can stand there, they must be able to see what they are standing on.
- **R2.** No auto-convex collision on any hollow mesh. Ever. Author collision from **box primitives per part**, or set `Use Complex Collision As Simple` on static, non-physics shell meshes (acceptable and cheap for a greybox locomotive).
- **R3.** One mesh owns its own collision. No standalone Blocking Volumes in the locomotive. If a Blocking Volume exists, it is a bug.
- **R4.** Window openings, doorways and gangway gaps must be **holes in the collision too** — or explicitly blocked with visible glass/geometry. No invisible panes.
- **R5.** The floor is a **single continuous mesh** with a single box collision. Not tiles. Not a plane with gaps.

### 5.3 Required parts list

A greybox locomotive is not "some boxes." It is a *simplified but complete* vehicle. Minimum contents:

**Exterior**
- Watertight outer shell — no gaps, no missing faces, no visible interior from outside except through windows
- Roof (complete, including over the cab)
- Front and rear ends with buffers and coupler
- Bogies and wheels **contacting the rail** — wheels floating above or sunk into the rail is a classic and very visible error (the prototype's history shows this exact bug was fixed twice; do not repeat it)
- Side walkways, both sides, full length
- Railings along all walkways
- Access steps at both ends of each walkway
- Side doors (both sides), rear gangway/connection door
- Windscreen (2 panes), side cab windows, at least 2 body windows per side

**Cab interior**
- Complete floor, complete ceiling, four complete walls
- Driver's desk with: throttle lever, brake lever, at least 4 gauges, a reverser
- The blueprint / map panel
- Driver's seat
- At least one practical light source
- Rear wall with the gangway door

### 5.4 Dimensions — use real numbers

**Wrong scale is the most common reason a greybox feels fake, and it is completely free to fix.**

| Element | Dimension |
|---------|-----------|
| Rail gauge (standard) | 1.435 m |
| Locomotive length | 18–20 m |
| Locomotive width | 3.0–3.2 m |
| Locomotive height (rail to roof) | 4.2–4.6 m |
| Cab interior width | 2.6–3.0 m |
| Cab interior ceiling height | 2.2–2.4 m |
| Walkway width | 0.5–0.7 m |
| Railing height | 1.0–1.1 m |
| Door opening | 0.6–0.7 m × 1.9–2.0 m |
| Step rise | 0.20–0.25 m |
| Desk height | 0.75–0.85 m |
| Window sill height (cab) | 1.1–1.2 m |
| Player capsule / eye height | 1.8 m / 1.65 m |

**Place a reference mannequin (1.8 m) in the locomotive scene permanently.** Every scale error becomes obvious immediately.

### 5.5 Unacceptable — automatic fail

- Invisible floors or walls with collision
- Visible gaps in the exterior shell
- Standing in mid-air anywhere
- Floating or sunken wheels
- Any surface the player can stand on that has no visible geometry
- Windows that block movement but show no glass
- Missing ceiling (seeing the skybox from inside the cab)
- Cab interior visibly smaller or larger than the exterior shell implies
- Uniform scale reference errors (a 3 m-tall door, a 0.4 m railing)

---

## 6. Section 5 — LIGHTING PLAN

### 6.1 Fix the white-out first — this is the highest-value item in the review

**Step 1 — Lock exposure.**

Auto-exposure is why everything looks blown out and why dark scenes refuse to stay dark. It renormalises whatever is on screen toward mid-grey.

- In the Post Process Volume: set **Exposure Metering Mode to Manual**, or constrain auto-exposure to a very narrow band (`Min EV100` ≈ `Max EV100`) per area.
- Set exposure **per scene**: the helicopter interior, the battlefield, the crawl and the cab each get their own value, authored deliberately.
- Use **Local Exposure** (UE5) to keep interiors readable without flattening the image: `Highlight Contrast Scale` ≈ 0.6–0.8, `Shadow Contrast Scale` ≈ 0.8. This is the correct tool for the "unreadable interior vs. blown window" problem — it solves it without lifting the blacks globally.

**Step 2 — Fix the blockout material albedo.**

Pure white is physically impossible. Real-world albedo values, and the only values a greybox should use:

| Surface | Linear base colour |
|---------|--------------------|
| Asphalt, charcoal, burnt material | 0.02–0.05 |
| Soil, mud, dirt | 0.05–0.10 |
| Weathered wood, dark metal | 0.08–0.15 |
| Concrete | 0.15–0.25 |
| Light stone, pale paint | 0.25–0.35 |
| **Absolute maximum for anything except snow** | **0.35** |

**Nothing in the level should exceed 0.35.** The current near-white blockout is roughly double the brightest legitimate value in a war setting.

**Step 3 — Build a small greybox material library (6 materials, one afternoon).**

This is the change that will most visibly transform the build:

1. `M_Grey_Ground` — 0.06, high roughness, world-aligned noise
2. `M_Grey_Concrete` — 0.20, roughness 0.8, subtle world-aligned detail normal
3. `M_Grey_Metal` — 0.10, metallic 1.0, roughness 0.5
4. `M_Grey_Wood` — 0.09, roughness 0.9
5. `M_Grey_Burnt` — 0.03, roughness 0.95
6. `M_Grey_Glass` — translucent, low roughness

All driven from one Material Parent with instance parameters. Add a **world-aligned (triplanar) detail normal and a large-scale noise breakup** to every one of them — this alone removes the "flat untextured cube" read, with no UVs and no textures.

**Colour separation matters more than colour accuracy.** Ground slightly warm-brown, concrete neutral, metal slightly cool. Small hue differences make a greybox read as a *place*.

### 6.2 Per-scene lighting

| Scene | Key | Fill | Practicals | Exposure intent |
|-------|-----|------|-----------|-----------------|
| Opening train | Low sun / pre-dawn, strong directional, long shadows | Cool sky light, low intensity | Loco headlight, cab glow | Slightly under. Silhouette-dominant. |
| Explosion | Fire becomes the key light for ~4 s | — | The fireball itself + firelight on terrain | Let it clip briefly — a 0.1 s blowout on a detonation is correct. Recover within 0.5 s. |
| Helicopter | Overcast directional from above | Sky light | Cabin interior warm practical, muzzle flashes, rotor strobe shadow | Mid. Battlefield below must stay readable. |
| Crawl | Very low ambient | Cool sky light, dim | **Fires are the key light.** Warm, flickering, from ground level | Under-exposed but never black. See §6.3. |
| Cab interior | Dim exterior through windows | Sky light | One warm desk practical, gauge backlights | Interior readable, windows slightly hot — this contrast is desirable and realistic. |

### 6.3 Never fully black

An unlit environment is as bad as a blown-out one, and it is a very common overcorrection after fixing exposure.

- **Floor of ~2–4% screen brightness minimum** in any playable area. Achieve with a dim Sky Light (with a real ambient cubemap, not black) plus a very slight fog inscattering.
- Never rely on the player's monitor gamma to reveal content. If something matters, light it.
- **Bounce/GI:** enable Lumen. Fire sources bouncing warm light onto surrounding terrain is what makes the crawl look expensive, and Lumen gives it for free.
- **Silhouette rule:** any object the player must notice (the shelter, the locomotive door, the throttle) must be readable **as a silhouette against a brighter background** or **lit brighter than its background**. Never a dark object against a dark background.

### 6.4 Fog — the workhorse

One Exponential Height Fog actor with Volumetric Fog enabled fixes depth, scale, map edges and mood simultaneously.

- **Volumetric Fog: ON.** Non-volumetric height fog will not carry light from the fires and is worth much less.
- Density: start ~0.02–0.05 for the battlefield, higher (0.06–0.10) at ground level for the crawl.
- Height falloff: 0.15–0.5 — low values keep fog high and hide distant geometry better.
- **Volumetric Fog View Distance:** the default is far too short for a battlefield. Raise it substantially (order of 20,000–40,000 units) or distant smoke columns will pop.
- **Directional Inscattering:** set colour/exponent so the sun (or the fire glow direction) produces a bright band on the horizon. This is what makes a horizon look like a horizon instead of an edge.
- **Tune so that contrast approaches zero by ~400 m.** At that point the map edge is physically invisible and no further geometry is needed.

---

## 7. Section 6 — AUDIO PLAN

Audio is currently reported as near-empty, and this is probably costing more perceived quality than the white boxes are. A greybox scene with excellent audio feels like a game; a beautiful scene with no audio feels like a tech demo.

### 7.1 No audio files required — use MetaSounds

The browser prototype generates **all** of its audio procedurally with the Web Audio API — explosion, rotor, gunfire, wind, breathing, reverb — with zero audio files. **UE5's MetaSounds can do exactly the same thing**, and Codex should use it for the vertical slice. No licensing, no sourcing, no asset pipeline, and it is fully tunable in-editor.

Synthesis recipes:

| Sound | MetaSound recipe |
|-------|------------------|
| **Explosion** | Sine 55 Hz → 35 Hz pitch drop over 0.4 s (the sub — this is the impact) + white noise through a low-pass sweeping 8 kHz → 200 Hz over 1.5 s + a broadband transient click at t=0 + reverb tail |
| **Helicopter rotor** | Noise burst gated by an LFO at ~18–24 Hz (blade-pass thump) + detuned sawtooth pair at 2–4 kHz (turbine whine) + broadband wind noise. Modulate LFO rate with the helicopter's state — it drops and warbles when hit |
| **Tinnitus** | Single sine at 4–6 kHz, ~−18 dB, exponential fade over 20–30 s |
| **Muffled aftermath** | A **low-pass filter on the master submix**, dropped to ~500 Hz on impact and opened back to 20 kHz over 8–15 s. This one effect carries the entire post-crash sequence |
| **Distant battle** | Sparse noise impulses + long reverb + heavy low-pass (distant sound loses high frequencies — this is the cue that sells distance) |
| **Diesel engine** | Sawtooth at firing frequency with a random-walk detune + filtered noise layer. Pitch and filter cutoff both scale with throttle |
| **Wheel clack** | Timed impulse *pairs* (bogies have two axles), rate synced to speed |
| **Wind** | Noise through a high-pass whose cutoff and gain both scale with speed |
| **Breathing** | Filtered noise with an amplitude envelope, ~0.9 s cycle, rate and depth scaled by exertion |

### 7.2 Minimum viable audio — ranked by impact per hour of work

If Codex only has time for five things, these five, in this order:

1. **Sub-bass on both explosions** (train + helicopter crash). Nothing else makes an explosion feel powerful. 40 Hz is the difference between "pop" and "detonation."
2. **Continuous rotor bed** through the whole helicopter sequence. Fills 26 seconds of currently dead air, and makes the sequence read as "military helicopter" instantly.
3. **Crawl subjectivity layer:** breathing + tinnitus + the muffled-master-submix sweep. This is the highest emotional return of any item in this document. It costs one MetaSound and one submix effect.
4. **Train engine + wheel clack scaled to speed.** Without this the driving section — the bulk of the playable slice — is silent and dead.
5. **Distant battle ambience bed** for the battlefield and the crawl.

### 7.3 Mix rules

- **Submix structure:** Master → {Music, SFX, Ambience, UI}. The volume slider that already works should drive Master; per-category sliders can come later.
- **Duck everything under the explosions.** A sidechain/ducking on the SFX and Ambience submixes triggered by the explosion submix. Without ducking, a loud explosion just sums into mud.
- **Interior/exterior separation.** When the cab door closes, exterior sounds should drop noticeably in level *and* lose high frequencies (low-pass ~1.5 kHz). Very cheap, very convincing.
- **Distance delay.** Any explosion visible at distance must have its sound arrive late (distance ÷ 343 m/s). Applies in SEQ_02 shot 2.2 and to all distant artillery.
- **Attenuation on everything.** Every 3D sound needs an Attenuation asset with a realistic falloff and air absorption. Sounds at constant volume regardless of distance is a common and very audible mistake.

---

## 8. Section 7 — MOUSE / INPUT ACCEPTANCE STANDARD

### 8.1 Diagnosis **[inferred]**

> *"I have to hold LEFT MOUSE BUTTON continuously in order to move the camera."*

This is a precise, well-known signature. It is almost certainly caused by:

- The PlayerController using **`SetInputModeGameAndUI`** instead of `SetInputModeGameOnly` — `GameAndUI` only captures the mouse *while a button is held*; that is exactly the reported symptom; **and/or**
- Project Settings → Engine → Input → Mouse Properties → **Default Viewport Mouse Capture Mode** set to `Capture During Mouse Down` instead of `Capture Permanently Including Initial Mouse Down`; **and/or**
- A menu widget left in the viewport (or still holding focus) after Start Game, keeping the UI input mode alive.

Check those three in that order. This is likely a ten-minute fix.

### 8.2 Required behaviour

**On entering gameplay:**
```
PlayerController->SetInputMode(FInputModeGameOnly());
PlayerController->bShowMouseCursor = false;
```
- Cursor hidden.
- Mouse captured and locked to the viewport.
- Full mouse-look with **no button held**.
- Cursor cannot leave the viewport.

**Project Settings → Engine → Input → Mouse Properties:**
- Default Viewport Mouse Capture Mode: **Capture Permanently Including Initial Mouse Down**
- Default Viewport Mouse Lock Mode: **Lock Always** (or `Lock On Capture` at minimum)
- Use Mouse for Touch: **OFF**

**On ESC / pause:**
```
SetGamePaused(true);
PlayerController->SetInputMode(FInputModeUIOnly(PauseWidget));
PlayerController->bShowMouseCursor = true;
```
- Game pauses.
- Cursor visible and free.
- Menu is keyboard-navigable as well as mouse-navigable (the existing menu already does this — keep it).

**On resume:**
- Widget removed from viewport **and** focus explicitly returned to the game.
- `SetInputModeGameOnly()`, cursor hidden, mouse re-captured **automatically**.
- Call `FlushPressedKeys()` on the transition to prevent stuck movement input (a very common bug where the player resumes and immediately walks forward forever).

**On alt-tab / focus loss:**
- Release capture on focus loss.
- **Re-capture automatically on focus regain** — without requiring a click.

**During cinematics:**
- Cursor hidden, mouse captured, but mouse-look does nothing (see §9).

### 8.3 Acceptance tests

| # | Test | Pass condition |
|---|------|----------------|
| M1 | Start Game, move mouse without pressing anything | Camera looks freely |
| M2 | Move mouse rapidly to all four screen edges | Cursor never appears, never leaves the viewport, camera keeps turning |
| M3 | Press ESC | Game pauses, cursor appears, menu clickable |
| M4 | Resume from pause | Cursor hidden, mouse-look works immediately with no click |
| M5 | Resume from pause while a movement key was held at the moment of pausing | Character does not auto-run |
| M6 | Alt-tab out and back | Mouse-look works again without clicking |
| M7 | Windowed mode, drag mouse fast toward another monitor | Cursor stays captured |
| M8 | ESC → resume → ESC → resume, 5× rapidly | State remains correct every time |

**All eight must pass.** M5 and M8 are the ones that usually fail and are usually not tested.

---

## 9. Section 8 — CUTSCENE / GAMEPLAY CONTROL RULES

### 9.1 A single authority

Introduce one explicit state — no other system is allowed to touch input or the camera:

```
EGameFlowState : Menu | Cinematic | Interactive | Paused
```

Exactly one state is active. All input mode, cursor, camera ownership and HUD visibility decisions derive from it and nowhere else. The current build's problems come from multiple systems each assuming they own control.

### 9.2 Use Enhanced Input contexts, not DisableInput

`DisableInput()` leaves stale key state and is a frequent source of "player is stuck" bugs. The correct UE5 approach:

- `IMC_Gameplay` — movement, look, interact, throttle.
- `IMC_Cinematic` — **only** Skip and Pause.
- `IMC_Menu` — UI navigation only.

Entering a cutscene: remove `IMC_Gameplay`, add `IMC_Cinematic`. Leaving: reverse. Movement input is then *structurally* impossible during a cutscene, rather than suppressed by a flag someone will forget to check.

### 9.3 Control ownership table

| Beat | State | Camera owner | Player input accepted |
|------|-------|--------------|----------------------|
| Main menu | Menu | Menu Sequence | UI only |
| Opening train + explosion | Cinematic | Sequencer | Skip, Pause |
| Helicopter flight | Cinematic | Sequencer | Skip, Pause |
| Helicopter hit + crash | Cinematic | Sequencer | Skip, Pause |
| **Crawl** | **Cinematic** | **Sequencer** | **Skip, Pause — no WASD, no mouse-look** |
| Rise + approach | Cinematic | Sequencer | Skip, Pause |
| Locomotive entry | Cinematic | Sequencer | Skip, Pause |
| Departure (last ~2 s) | **Handover** | Blending to player | Look begins to respond |
| Driving the train | Interactive | Player camera | Full |
| Paused | Paused | Frozen | UI only |

### 9.4 Rules

- **No teleporting.** The character's transform must move continuously along the crawl spline. At the end of the cinematic the pawn is *already* physically in the cab; gameplay simply begins from there. A teleport at the handover will be visible and will feel broken.
- **The cinematic camera and the player camera must agree at the handover.** Position, rotation and FOV must match at the transition frame, or the world will visibly jump.
- **Skip must land in the same state as playing through.** The same pawn transform, the same level state, the same audio state. A skip that leaves the player somewhere different is worse than no skip.
- **Never mix.** No "cinematic where the player can look around a bit." Either the sequence owns the camera or the player does. Half-states are where the current build's problems come from.
- **Pause must work during cinematics** and must pause the Sequencer, not just the game.

---

## 10. Section 9 — MAP-EDGE HIDING STRATEGY

### 10.1 The four-band method

Every outdoor view is composed of four distance bands. If all four are present, the boundary is invisible without building a bigger world.

| Band | Distance | Content | Cost |
|------|----------|---------|------|
| **A — Playable** | 0–50 m | Full greybox detail, props, collision | Real work |
| **B — Occluders** | 50–200 m | Embankments, ruined walls, treelines, wrecks, smoke columns. **This band does the actual hiding.** | Reused kit meshes |
| **C — Silhouettes** | 200 m–2 km | Low-poly ridge and ruin shapes, very dark, no detail, unlit or near-unlit material | One afternoon |
| **D — Horizon** | 2–10 km | Distant mountain/city silhouette cards + Sky Atmosphere | Near zero |

Band B is the one currently missing, and it is the one that matters most.

### 10.2 The railway cutting — use the theme

**The single best solution is already in the fiction.** Real railways run through *cuttings* and on *embankments*: earth walls on both sides of the track, 3–8 m high.

This gives, for free:
- A natural corridor that hides everything beyond it
- A completely believable, historically accurate reason for the player not to leave
- Controlled sightlines — the level designer decides exactly where the player can see out
- A dramatic frame for the train

**Use a cutting for most of the route and open out deliberately** at 2–3 chosen moments where a wide vista has been properly built. Controlled reveals feel like design; constant open horizon feels like an unfinished map.

### 10.3 Other practical techniques

- **Fog density tuned so contrast reaches ~0 by 400 m.** Beyond that point, geometry is optional.
- **Terrain berms rising toward the boundary.** The ground curves upward at the level edge, so the player looks at a hillside, not at nothing.
- **Extend the Landscape well beyond the playable area** — even flat and untextured, in fog it is invisible, and it prevents the hard terrain-edge line against the sky.
- **Smoke columns as vertical occluders.** A 120 m smoke column placed at the boundary hides an enormous angular area and is thematically perfect.
- **Treelines and hedgerows** as horizontal occluders.
- **Camera framing in cinematics:** simply never point the camera at the boundary. This is free and is the primary solution for the helicopter shots.
- **Darkness at the edges.** The crawl at 0.35 m eye height plus ground fog means almost nothing beyond 40 m is visible anyway.
- **Soft boundaries in gameplay:** invisible collision plus a diegetic reason (minefield, collapsed track, enemy fire) — never an abrupt invisible wall in an open field.
- **Check draw distances.** Distant silhouette meshes must have Max Draw Distance set to 0 (infinite) and adequate bounds scale, or they will pop out and expose the void.

### 10.4 The test

Stand at every point on the crawl spline and at every cinematic camera position, and rotate 360°. **At no point may the terminating edge of the level be visible.** If it is, add Band B occlusion at that bearing.

---

## 11. Section 10 — CODEX ACCEPTANCE CHECKLIST

Strict, binary pass/fail. **Every item must pass before the next playtest is requested.** Items marked **[BLOCKER]** mean: if this fails, do not request a playtest at all.

### A — Input (test first, takes 5 minutes)

- [ ] **[BLOCKER]** A1 — Mouse-look works with no button held
- [ ] **[BLOCKER]** A2 — Cursor is hidden and cannot leave the viewport during gameplay
- [ ] A3 — ESC pauses, shows cursor, menu is usable
- [ ] A4 — Resume re-captures the mouse automatically, no click needed
- [ ] A5 — Resume after pausing with a key held does not cause auto-run
- [ ] A6 — Alt-tab out and back restores mouse-look without a click
- [ ] A7 — 5× rapid pause/resume leaves correct state
- [ ] A8 — WASD does nothing during every cinematic

### B — Visual baseline

- [ ] **[BLOCKER]** B1 — No surface anywhere exceeds 0.35 linear albedo. **No white boxes remain**
- [ ] **[BLOCKER]** B2 — Exposure is locked/manual. No auto-exposure pumping when turning the camera
- [ ] B3 — All six greybox materials exist and are applied; no default material remains in any scene
- [ ] B4 — Every material has world-aligned detail normal and large-scale noise breakup
- [ ] B5 — Ground / concrete / metal are visually distinguishable by hue as well as value
- [ ] B6 — Volumetric Fog is enabled and tuned in every outdoor scene
- [ ] B7 — Lumen is enabled; fire sources visibly light their surroundings

### C — Map edges

- [ ] **[BLOCKER]** C1 — 360° rotation at every crawl spline point and every cinematic camera position: **the level edge is never visible**
- [ ] C2 — No black void visible in any shot of the helicopter sequence
- [ ] C3 — Band B occluders (50–200 m) exist in every outdoor scene
- [ ] C4 — Band C/D silhouettes exist on every horizon
- [ ] C5 — No distant mesh pops in or out during any camera move
- [ ] C6 — During gameplay, the player cannot reach a position where the world visibly ends

### D — Locomotive

- [ ] **[BLOCKER]** D1 — `show COLLISION` / Player Collision view: **visible geometry matches collision everywhere**
- [ ] **[BLOCKER]** D2 — No invisible floors, walls, or standable surfaces anywhere
- [ ] D3 — No auto-convex collision on any hollow mesh
- [ ] D4 — Zero Blocking Volumes in the locomotive
- [ ] D5 — Exterior shell is watertight — no gaps, no missing faces
- [ ] D6 — Complete cab floor, ceiling, and four walls
- [ ] D7 — Wheels contact the rail exactly — not floating, not sunk
- [ ] D8 — All parts from §5.3 present
- [ ] D9 — All dimensions within §5.4 tolerances; 1.8 m reference mannequin present in the scene
- [ ] D10 — Player can walk the full walkway on both sides without falling through or floating
- [ ] D11 — Windows either have visible glass or do not block movement
- [ ] D12 — Cab interior volume is consistent with the exterior shell

### E — Cinematic

- [ ] **[BLOCKER]** E1 — The crawl is a cutscene. The player has no WASD and no mouse-look
- [ ] E2 — Every act is its own Level Sequence, chained by a Master Sequence
- [ ] E3 — All cinematic cameras are Cine Camera Actors with motion blur enabled
- [ ] E4 — Subtle handheld shake is present on every cinematic camera
- [ ] E5 — Hold-to-skip works from frame 1 of every act
- [ ] E6 — Skipping lands in exactly the same state as playing through
- [ ] E7 — Pause works during cinematics and pauses the Sequencer
- [ ] E8 — No teleports; the pawn moves continuously and is physically in the cab at handover
- [ ] E9 — Cinematic camera and player camera match in position, rotation and FOV at handover — no visible jump
- [ ] E10 — Opening train reads as 80–100 km/h, with pass-by and foreground-occluder speed cues
- [ ] E11 — Explosion follows the beat structure in §3.3, including the 0.15 s delay before the camera reacts
- [ ] E12 — Helicopter shots show ≥6 fires, ≥3 smoke columns, and at least one moving element at all times
- [ ] E13 — Crawl camera advances in pulls, not at constant velocity; hands enter frame alternately
- [ ] E14 — Rise takes ~6 s, is non-monotonic, and has tremor
- [ ] E15 — The limp persists into gameplay
- [ ] E16 — Letterbox bars in/out mark cinematic boundaries

### F — Audio

- [ ] **[BLOCKER]** F1 — Both explosions have a sub-bass layer (35–55 Hz)
- [ ] F2 — Continuous rotor bed throughout the helicopter sequence
- [ ] F3 — Breathing + tinnitus + master low-pass sweep during and after the crash
- [ ] F4 — Train engine and wheel clack scale correctly with throttle and speed
- [ ] F5 — Distant battle ambience present on the battlefield and during the crawl
- [ ] F6 — Exterior audio ducks and low-passes when the cab door closes
- [ ] F7 — Distant explosions have distance-delayed sound
- [ ] F8 — All 3D sounds have attenuation assets; nothing plays at constant volume regardless of distance
- [ ] F9 — Explosions duck other submixes
- [ ] F10 — The existing volume slider still works and affects everything

### G — Whole-run test

- [ ] G1 — Menu → intro → cab → driving, played end to end **three times** with no break in immersion, no visible boundary, no broken collision, no input failure
- [ ] G2 — The same run, skipping every cutscene, ends in a correct state
- [ ] G3 — Continue Run and New Run both still work (regression — these currently work; do not break them)
- [ ] G4 — Blood toggle and volume control still work (regression)
- [ ] G5 — Stable frame rate throughout; no hitching at act transitions
- [ ] G6 — **The honest question:** watch the first two minutes with fresh eyes. Does it look like an unfinished Unreal test level, or like an early build of a real game? If the answer is still "test level," do not request a playtest — return to B1, C1 and D1

---

## 12. Out of scope — explicitly not proposed

Per the brief, this review deliberately does **not** propose:

- Extending the route toward the full 100 km
- Additional outposts
- More weapons or enemies
- Steam publishing, monetisation, achievements
- New progression, crafting, upgrade or economy systems
- A save system beyond what already works
- Multiplayer, mod support, or platform work

**The only goal of the next pass is that the first 5–10 minutes feel like an actual game.** Any work that does not serve that should be rejected.

Also explicitly out of scope for the reviewer: this document does not modify the Unreal project, does not duplicate it, and proposes no browser, HTML or WebGL version of anything. The prototype in this repository is referenced as a timing animatic only.

---

## 13. Summary — the five things that matter most

If time is short, these five, in this order, will move the build further than everything else combined:

1. **Fix mouse capture** (§8). Ten minutes. The build feels broken without it.
2. **Lock exposure and replace the white blockout material** (§6.1). One afternoon. This single change is what stops it looking like a test arena.
3. **Add volumetric fog and mid-ground occluders** (§10). One or two days. Kills the void and the map edges simultaneously.
4. **Fix the locomotive collision mismatch** (§5.1–5.2). Likely auto-convex collision on hollow meshes. Diagnose in two minutes with `show COLLISION`.
5. **Move the crawl into Sequencer** (§9). The intro cannot work as a cinematic until Sequencer owns the camera.

Items 1, 2 and 4 are together perhaps two days of work and will change the player's impression more than a month of asset production.
