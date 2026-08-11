/**
 * LAST TRAIN - the game.
 *
 * Owns the loop and holds the systems together. Deliberately thin: it decides
 * what runs when, and delegates every actual rule to the system that owns it.
 * If a gameplay number appears in this file, it is in the wrong place.
 */

import * as THREE from "../vendor/three/three.module.js";

import { EventBus, GAME_EVENT } from "./core/events.js";
import { SaveSystem } from "./core/saveSystem.js";
import { Settings } from "./core/settings.js";
import { Localization } from "./core/localization.js";
import { GameStateManager, STATE } from "./core/gameState.js";
import { InputManager, ACTION } from "./core/input.js";
import { Rng } from "./core/rng.js";

import { Renderer, QUALITY } from "./render/renderer.js";
import { World } from "./render/world.js";
import { CinematicStage } from "./render/cinematicStage.js";

import { createIntroSequence } from "./cinematics/introSequence.js";
import { cabDimensions, sideDoorLayout } from "./render/interiors.js";

import { Train } from "./systems/train/train.js";
import { MountRegistry } from "./systems/train/mounts.js";
import { Wallet } from "./systems/economy/wallet.js";
import { TradeService } from "./systems/economy/trade.js";
import { Workshop } from "./systems/economy/workshop.js";
import { Unlocks } from "./systems/world/unlocks.js";
import { JourneyTracker } from "./systems/world/journeyTracker.js";
import { DayNightCycle } from "./systems/world/dayNight.js";
import { Health } from "./systems/player/health.js";
import { Stamina } from "./systems/player/stamina.js";
import { Inventory } from "./systems/player/inventory.js";
import { Statistics } from "./systems/run/statistics.js";
import { PlayerController } from "./systems/player/playerController.js";
import { InteractionSystem } from "./systems/player/interaction.js";
import { RunManager, RUN_FAILURE } from "./systems/run/runManager.js";
import { Crew } from "./systems/ai/loader.js";

import { MenuSystem } from "./ui/menus.js";
import { Hud } from "./ui/hud.js";
import { CinematicOverlay } from "./ui/cinematicOverlay.js";
import { WeaponWheel } from "./ui/weaponWheel.js";
import { BlueprintPanel } from "./ui/blueprintPanel.js";
import { el } from "./ui/dom.js";

import { AudioDirector } from "./audio/audioDirector.js";
import { locomotiveMix } from "./audio/trainAudio.js";

import { weaponSpec } from "./data/weapons.js";
import { TRAIN, ECONOMY } from "./data/balance.js";

import en from "./data/locales/en.js";
import de from "./data/locales/de.js";

/** Localization key for each weapon's display name. */
const WEAPON_NAME_KEYS = {
  pistol: "WEAPON_PISTOL",
  assault_rifle: "WEAPON_ASSAULT_RIFLE",
  rpg: "WEAPON_RPG",
  minigun: "WEAPON_MINIGUN",
  mounted_machine_gun: "WEAPON_MOUNTED_MACHINE_GUN",
  mounted_rocket_launcher: "WEAPON_MOUNTED_ROCKET_LAUNCHER",
  heavy_turret_cannon: "WEAPON_HEAVY_TURRET_CANNON",
};

/** Longest step the simulation will take, so a stalled tab cannot teleport the train. */
const MAX_DELTA_SECONDS = 1 / 15;

/** Radians of camera rotation per pixel of mouse movement. */
const MOUSE_SENSITIVITY = 0.0022;

export class Game {
  #renderer;
  #world;
  #loopHandle = null;
  #lastFrameTime = 0;
  #run = null;
  #cab = null;
  #menuTrain = null;
  #menuCameraTime = 0;
  #elapsed = 0;

  /** The opening cinematic, while it is playing. Null at every other time. */
  #cutscene = null;
  #cutsceneContext = null;
  #stage = null;
  #overlayRoot = null;

  /** The first-person controller. Owns where the player is and where they look. */
  #player = null;
  #pointerPrompt = null;
  #wheelOpen = false;

  constructor({ canvas, overlay, hudRoot }) {
    this.events = new EventBus();
    this.saveSystem = new SaveSystem();

    this.localization = new Localization({ events: this.events })
      .register("en", en)
      .register("de", de);

    this.settings = new Settings({
      saveSystem: this.saveSystem,
      events: this.events,
      localization: this.localization,
    });

    this.state = new GameStateManager({ events: this.events });
    this.input = new InputManager({ events: this.events });
    this.dayNight = new DayNightCycle();

    this.#renderer = new Renderer({ canvas, quality: QUALITY.high });
    this.#world = new World({ quality: this.#renderer.quality });

    this.menus = new MenuSystem({
      root: overlay,
      localization: this.localization,
      settings: this.settings,
      state: this.state,
      events: this.events,
      actions: {
        startRun: () => this.startRun(),
        resumeRun: () => this.resumeFromPause(),
        exitGame: () => this.exitToMenu(),
        hasSavedRun: () => false,
        isRunInProgress: () => this.#run !== null,
      },
    });

    this.hud = new Hud({ root: hudRoot, localization: this.localization });
    this.hud.hide();

    this.audio = new AudioDirector({ events: this.events, settings: this.settings });
    this.weaponWheel = new WeaponWheel({ root: overlay, localization: this.localization });
    this.blueprint = new BlueprintPanel({ root: overlay, localization: this.localization });
    this.interaction = new InteractionSystem();
    this.#registerInteractions();

    this.#overlayRoot = overlay;
    this.cinematic = new CinematicOverlay({ root: hudRoot, localization: this.localization });
    this.#stage = new CinematicStage({ scene: this.#world.scene });

    // One controller for the whole session. It is handed the world's colliders
    // whenever the train changes shape.
    this.#player = new PlayerController({ colliders: this.#world.colliders });
    this.#player.setEnabled(false);

    this.events.on(GAME_EVENT.languageChanged, () => this.hud.refreshLanguage());
    this.#wireRunEvents();

    // The main menu is played out in front of the train the run will be built
    // around, so one exists before the player presses Start. It carries no
    // simulation - it is there to be looked at.
    this.#menuTrain = new Train();
    this.#world.syncTrain(this.#menuTrain);
  }

  /**
   * What each interactable actually does.
   *
   * Registered once, by id. Previously the prompts existed but nothing was
   * bound to them, so E played a sound and did nothing else - which is what
   * "press E does nothing" was.
   */
  #registerInteractions() {
    this.interaction.register("throttle", () => {
      if (!this.#run) return;
      const train = this.#run.train;
      // Cycle up through the notches and wrap back to a stand at the top, so
      // one key can drive the whole quadrant.
      const next = train.throttleIndex >= TRAIN.throttleSteps.length - 1 ? 0 : train.throttleIndex + 1;
      train.setThrottleIndex(next);
      this.hud.toast(
        `${this.localization.t("HUD_THROTTLE")} ${Math.round(train.throttleFraction * 100)}%`,
      );
    });

    this.interaction.register("blueprint", () => {
      if (!this.#run) return;
      const opened = this.blueprint.toggle(this.#run.train, this.#run.crew);
      this.audio.play(opened ? "ui_confirm" : "ui_move");
    });

    /*
     * The rear door and the side doors are deliberately different things.
     *
     * The side doors let you out onto the walkway, and they always work - you
     * can open one at a stand or at a hundred kilometres an hour. The rear
     * door is the connection into the rest of the train, so it only goes
     * anywhere when there is something coupled behind the locomotive.
     */
    this.interaction.register("rear-door", () => {
      if (!this.#run) return;
      const wagons = this.#run.train.wagons ?? [];

      if (wagons.length === 0) {
        this.audio.play("ui_deny");
        this.hud.toast(this.localization.t("VEHICLE_NO_WAGON"), { variant: "warning" });
        return;
      }

      this.audio.play("door");
      this.hud.toast(this.localization.t("VEHICLE_TRANSPORT"));
    });

    for (const side of ["left", "right"]) {
      this.interaction.register(`side-door-${side}`, () => {
        const opening = this.#world.setSideDoorOpen(side, !this.#world.isSideDoorOpen(side));
        if (opening === null) return;
        this.audio.play("door");
        this.hud.toast(
          this.localization.t(opening ? "PROMPT_STEP_OUTSIDE" : "PROMPT_CLOSE_DOOR"),
        );
      });
    }
  }

  #wireRunEvents() {
    // The train's appearance follows its condition, so a wagon that drops into
    // a worse damage band is rebuilt with heavier weathering immediately.
    for (const event of [
      GAME_EVENT.damageStateChanged,
      GAME_EVENT.vehicleAttached,
      GAME_EVENT.vehicleDestroyed,
      GAME_EVENT.vehicleUpgraded,
      GAME_EVENT.vehicleArmoured,
      GAME_EVENT.vehicleRepaired,
    ]) {
      this.events.on(event, () => {
        if (!this.#run) return;
        this.#run.mounts.sync();
        this.#world.syncTrain(this.#run.train);
        // The floors and walls the player is standing on have just been
        // rebuilt, so the controller has to be given the new ones.
        this.#player.setColliders(this.#world.colliders);
      });
    }

    this.events.on(GAME_EVENT.outpostReached, ({ outpost }) => {
      this.state.transitionTo(STATE.outpost);
      this.hud.toast(this.localization.t(outpost.nameKey));
    });

    this.events.on(GAME_EVENT.playerDied, () => this.#failRun(RUN_FAILURE.playerDied));
  }

  /* ----------------------------------------------------------------- boot */

  start() {
    this.input.attach(globalThis);
    this.state.transitionTo(STATE.mainMenu);
    this.menus.show("mainMenu");
    this.#placeMenuCamera(0);
    this.#lastFrameTime = performance.now();
    this.#loop();
  }

  /* ------------------------------------------------------------------ run */

  /**
   * Builds a fresh run. Everything is constructed here rather than at boot, so
   * starting a second run cannot inherit state from the first.
   */
  startRun() {
    const events = this.events;
    const train = new Train({ events });
    const mounts = new MountRegistry({ train });
    const wallet = new Wallet({ events });
    const unlocks = new Unlocks({ events });
    const crew = new Crew({ train, mounts });
    const health = new Health({ events });
    const stamina = new Stamina({ events });
    const inventory = new Inventory({ events });
    const journey = new JourneyTracker({ train, unlocks, events });
    const statistics = new Statistics({ events, saveSystem: this.saveSystem });

    const context = {
      events,
      train,
      mounts,
      wallet,
      unlocks,
      crew,
      health,
      stamina,
      inventory,
      journey,
      statistics,
      rng: new Rng(),
    };

    context.trade = new TradeService({ train, wallet, unlocks });
    context.workshop = new Workshop({ train, wallet, unlocks, crew, events });
    context.runManager = new RunManager({
      context,
      events,
      saveSystem: this.saveSystem,
      mode: this.settings.mode,
    });

    // The run begins with ammunition aboard. A starting weapon that runs dry
    // and cannot be reloaded is not a starting weapon.
    for (const [cargoId, quantity] of Object.entries(ECONOMY.startingCargo)) {
      train.addCargo(cargoId, quantity);
    }

    this.#run = context;
    // The cab's dimensions never change during a run, and both the cinematic
    // and the interior controls need them.
    this.#cab = cabDimensions(train.locomotive.spec.size);
    this.#world.syncTrain(train);
    this.#player.setColliders(this.#world.colliders);
    this.#player.setStamina(stamina);

    // Browsers only allow audio to start from a user gesture. The click on
    // Start is that gesture, so this is the one place it can happen.
    this.audio.start();

    this.events.emit(GAME_EVENT.runStarted, { mode: this.settings.mode });
    this.playIntro();
  }

  /* ------------------------------------------------------------- cinematic */

  /**
   * Runs the opening cinematic, then hands over to gameplay.
   *
   * The player has no control at all during this: the controller is disabled
   * and the camera belongs to the cutscene. `beginGameplay` is the only place
   * that gives control back, and it runs whether the intro was watched to the
   * end or skipped.
   */
  playIntro() {
    this.state.transitionTo(STATE.intro);
    this.menus.hide();
    this.hud.hide();
    this.#hidePointerPrompt();

    this.#player.setEnabled(false);
    this.input.setEnabled(true);

    this.cinematic.begin({
      skipLabel: this.localization.t("PROMPT_INTERACT", {
        key: this.input.primaryLabel(ACTION.jump),
      }),
    });

    this.#cutsceneContext = {
      camera: this.#renderer.camera,
      world: this.#world,
      stage: this.#stage,
      overlay: this.cinematic,
      dayNight: this.dayNight,
      locomotiveSize: this.#run.train.locomotive.spec.size,
      // Resolved once, because several shots need to know where the cab is
      // before the shot that used to compute it has run.
      cabDimensions: this.#cab,
      scrollSpeed: 0,
    };

    this.#cutscene = createIntroSequence({ onFinished: () => this.beginGameplay() });
  }

  /** Ends the intro early. Bound to the jump key, which is otherwise unused here. */
  skipIntro() {
    if (!this.#cutscene || this.#cutscene.isFinished) return;
    this.#cutscene.skip(this.#cutsceneContext);
  }

  /**
   * The handover. Everything the cutscene took is given back here, in one
   * place, so there is no path into gameplay that leaves the player frozen or
   * still looking through a cinematic camera.
   */
  beginGameplay() {
    this.#cutscene = null;
    this.#cutsceneContext = null;

    // Put the world back the way gameplay expects it, whatever the cutscene
    // was in the middle of doing.
    this.#stage.hideAll();
    this.#world.setRailwayVisible(true);
    this.#world.setTrainVisible(true);
    this.cinematic.clear();

    this.state.transitionTo(STATE.playing);
    this.menus.hide();
    this.hud.show();

    this.#spawnPlayerInCab();

    // Control returns here and nowhere else.
    this.#player.setEnabled(true);
    this.input.setEnabled(true);

    // The throttle really is at full: the protagonist selected it on screen.
    this.#run?.train.setThrottleIndex(TRAIN.throttleSteps.length - 1);

    this.#showControlHandover();
    this.#requestPointerLock();
  }

  /**
   * Places the player on the cab floor.
   *
   * The spawn point comes from the same code that builds the cab, and it is
   * checked against the colliders before it is used, so the player cannot
   * start inside a wall or fall through the floor.
   */
  #spawnPlayerInCab() {
    const locomotive = this.#run?.train.locomotive;
    if (!locomotive) return;

    const spawn = this.#world.spawnPointFor(locomotive.id);
    if (!spawn) {
      console.error("No spawn point on the locomotive - the cab was not built.");
      return;
    }

    this.#player.setColliders(this.#world.colliders);
    // Placed a little above the floor and allowed to settle, so a spawn point
    // that is a few centimetres out lands cleanly instead of jamming.
    this.#player.spawnAt({ x: spawn.x, y: spawn.y + 0.05, z: spawn.z });
    // Facing forward, up the track.
    this.#player.yaw = 0;
    this.#player.pitch = -0.08;

    if (!this.#player.isClear) {
      console.warn("Player spawn was obstructed; moved to the nearest clear spot.");
    }
  }

  /** A brief, unmissable note that the cutscene is over and the game is live. */
  #showControlHandover() {
    const note = el(
      "div",
      { class: "control-handover" },
      this.localization.t("PROMPT_INTERACT", { key: this.input.primaryLabel(ACTION.interact) }),
    );
    this.#overlayRoot.append(note);
    setTimeout(() => note.remove(), 3000);
  }

  #failRun(reason) {
    if (!this.#run) return;
    const outcome = this.#run.runManager.fail(reason);
    this.state.transitionTo(STATE.runFailed);
    this.hud.toast(
      this.localization.t(
        reason === RUN_FAILURE.playerDied ? "RUN_FAILED_PLAYER" : "RUN_FAILED_LOCOMOTIVE",
      ),
      { variant: "warning" },
    );

    if (outcome.recoverable) {
      const respawn = this.#run.runManager.respawn();
      if (respawn) {
        this.#run.train = respawn.train;
        this.#run.inventory = respawn.inventory;
        this.#run.mounts = new MountRegistry({ train: respawn.train });
        this.#world.syncTrain(respawn.train);
        this.state.transitionTo(STATE.outpost);
      }
    }
  }

  resumeFromPause() {
    if (!this.state.transitionTo(STATE.playing)) return;
    this.menus.hide();
    this.hud.show();
    this.#player.setEnabled(true);
    this.audio.setMuted(false);
    this.#requestPointerLock();
  }

  pause() {
    if (!this.state.transitionTo(STATE.paused)) return;
    this.hud.hide();
    this.hud.setPrompt(null);
    // Freeze the player explicitly rather than relying on the menu to swallow
    // keys: a key still held when the menu opened must not keep them walking.
    this.#player.setEnabled(false);
    this.input.releaseAll();
    this.audio.setMuted(true);
    this.interaction.clear();
    this.blueprint.close();
    this.#closeWeaponWheel(false);
    this.menus.show("pause");
    this.#hidePointerPrompt();
    document.exitPointerLock?.();
  }

  exitToMenu() {
    // Abandon the intro if one is running, so its props and overlay do not
    // survive into the menu.
    this.#cutscene = null;
    this.#cutsceneContext = null;
    this.cinematic.clear();
    this.#stage.hideAll();
    this.#world.setRailwayVisible(true);
    this.#world.setTrainVisible(true);
    this.#hidePointerPrompt();

    this.#run = null;
    this.#player.setEnabled(false);
    this.interaction.clear();
    this.blueprint.close();
    this.#closeWeaponWheel(false);
    this.audio.setMuted(false);
    this.state.transitionTo(STATE.mainMenu);
    this.hud.hide();
    this.hud.setPrompt(null);
    this.menus.show("mainMenu");
    document.exitPointerLock?.();

    // The menu looks at its own train again.
    this.#world.syncTrain(this.#menuTrain);
  }

  /**
   * Asks for the mouse.
   *
   * A browser only grants pointer lock from a user gesture, and refuses it for
   * a short while after the player pressed Escape. Either way the game must
   * stay playable, so a refusal puts up a click-to-capture prompt rather than
   * leaving the player unable to look around with no explanation.
   */
  #requestPointerLock() {
    const canvas = this.#renderer.three.domElement;
    const request = canvas.requestPointerLock?.({ unadjustedMovement: false });

    if (request?.catch) {
      request.catch(() => this.#showPointerPrompt());
      return;
    }

    // Older browsers return nothing; check whether it actually took.
    setTimeout(() => {
      if (!document.pointerLockElement && this.state.wantsPointerLock) {
        this.#showPointerPrompt();
      }
    }, 250);
  }

  #showPointerPrompt() {
    if (this.#pointerPrompt) return;

    const prompt = el(
      "div",
      {
        class: "pointer-prompt",
        onclick: () => {
          this.#hidePointerPrompt();
          this.#requestPointerLock();
        },
      },
      el("div", { class: "pointer-prompt__title" }, this.localization.t("PROMPT_INTERACT", {
        key: this.input.primaryLabel(ACTION.fire),
      })),
      el("div", { class: "pointer-prompt__hint" }, this.localization.t("MENU_CONTINUE")),
    );

    this.#pointerPrompt = prompt;
    this.#overlayRoot.append(prompt);
  }

  #hidePointerPrompt() {
    this.#pointerPrompt?.remove();
    this.#pointerPrompt = null;
  }

  /* ----------------------------------------------------------------- loop */

  #loop = () => {
    this.#loopHandle = requestAnimationFrame(this.#loop);

    const now = performance.now();
    const delta = Math.min((now - this.#lastFrameTime) / 1000, MAX_DELTA_SECONDS);
    this.#lastFrameTime = now;

    this.#handleInput();
    this.#update(delta);
    this.#renderer.render(this.#world.scene);
    this.input.endFrame();
  };

  #handleInput() {
    if (this.input.wasPressed(ACTION.pause)) {
      if (this.state.current === STATE.playing || this.state.current === STATE.outpost) this.pause();
      else if (this.state.current === STATE.paused) this.resumeFromPause();
    }

    // During the intro the only control the player has is to skip it.
    if (this.state.current === STATE.intro) {
      if (this.input.wasPressed(ACTION.jump) || this.input.wasPressed(ACTION.interact)) {
        this.skipIntro();
      }
      this.input.consumeMouseDelta();
      return;
    }

    if (!this.#run || !this.state.isSimulating) return;

    /* ------------------------------------------------------- weapon wheel */

    if (this.input.wasPressed(ACTION.weaponWheel)) this.#openWeaponWheel();
    if (this.input.wasReleased(ACTION.weaponWheel)) this.#closeWeaponWheel(true);

    const mouse = this.input.consumeMouseDelta();

    if (this.#wheelOpen) {
      // While the wheel is up the mouse drives the selector, not the camera.
      this.weaponWheel.applyMouseDelta(mouse.x, mouse.y);
      return;
    }

    /* ------------------------------------------------------------- driving */

    if (this.input.wasPressed(ACTION.throttleUp)) this.#run.train.throttleUp();
    if (this.input.wasPressed(ACTION.throttleDown)) this.#run.train.throttleDown();

    if (this.input.wasPressed(ACTION.reload)) {
      this.#run.inventory.reloadEquipped(this.#run.train);
    }

    if (this.input.wasPressed(ACTION.useMedkit)) {
      const restored = this.#run.inventory.useMedkit(this.#run.health);
      if (restored > 0) this.hud.toast(this.localization.t("MEDICAL_MEDKIT"));
    }

    if (this.input.wasPressed(ACTION.interact)) this.#interact();

    // Mouse look. Only while the pointer is captured, so moving the mouse over
    // a menu can never spin the camera behind it.
    if (document.pointerLockElement) {
      this.#player.look(-mouse.x * MOUSE_SENSITIVITY, -mouse.y * MOUSE_SENSITIVITY);
    }
  }

  /* ------------------------------------------------------------ weapons */

  /**
   * Opens the wheel with only the weapons the player owns.
   * A wheel showing weapons that cannot be selected is a shop, not a selector.
   */
  #openWeaponWheel() {
    if (this.#wheelOpen || !this.#run) return;
    const { inventory, train } = this.#run;

    this.#wheelOpen = true;
    this.weaponWheel.open(
      inventory.wheelOrder,
      inventory.equippedWeaponId,
      (id) => this.localization.t(WEAPON_NAME_KEYS[id] ?? "WEAPON_PISTOL"),
      (id) => ({
        magazine: inventory.weaponState(id)?.roundsInMagazine ?? 0,
        reserve: inventory.reserveRoundsFor(id, train),
      }),
    );
    this.audio.play("ui_move");
  }

  /**
   * Closes the wheel. `equip` is false when the wheel is being torn down for
   * some other reason - pausing, quitting - and the selection must not stick.
   */
  #closeWeaponWheel(equip) {
    if (!this.#wheelOpen) return;
    this.#wheelOpen = false;
    const chosen = this.weaponWheel.close();

    if (equip && chosen && this.#run) {
      const changed = chosen !== this.#run.inventory.equippedWeaponId;
      this.#run.inventory.equip(chosen);
      this.audio.play(changed ? "mechanical_clunk" : "ui_move");
    }
  }

  /**
   * Fires the equipped weapon if the trigger is down and it is able to.
   * Automatic weapons keep firing while held; the rate of fire is enforced by
   * the weapon itself, so this can be called every frame.
   */
  #updateFiring() {
    if (this.#wheelOpen || !this.#run) return;
    if (!this.input.isHeld(ACTION.fire)) return;

    const { inventory, train } = this.#run;
    const weapon = inventory.equippedWeapon;
    if (!weapon) return;

    const shot = weapon.fire();
    if (shot) {
      // The player's own weapon plays flat rather than positioned - it is
      // happening at the listener, and panning it sounds wrong.
      this.events.emit(GAME_EVENT.weaponFired, { weaponId: shot.weaponId, shot });
      return;
    }

    // Out of rounds: reload from the train's stores rather than making the
    // player press R to find out the magazine was empty.
    if (weapon.isEmpty && !weapon.isReloading) inventory.reloadEquipped(train);
  }

  /** Acts on whatever the player is looking at. */
  #interact() {
    // The blueprint is a full-screen panel; E closes it again rather than
    // trying to interact with the world through it.
    if (this.blueprint.isOpen) {
      this.blueprint.close();
      this.audio.play("ui_move");
      return;
    }

    const acted = this.interaction.activate({ game: this });
    if (!acted) this.audio.play("ui_deny");
  }

  /** Translates held keys into the controller's movement intent. */
  #movementIntent() {
    const forward =
      (this.input.isHeld(ACTION.moveForward) ? 1 : 0) - (this.input.isHeld(ACTION.moveBackward) ? 1 : 0);
    const right =
      (this.input.isHeld(ACTION.moveRight) ? 1 : 0) - (this.input.isHeld(ACTION.moveLeft) ? 1 : 0);

    return {
      forward,
      right,
      sprint: this.input.isHeld(ACTION.sprint),
      crouch: this.input.isHeld(ACTION.crouch),
      jump: this.input.wasPressed(ACTION.jump),
    };
  }

  #update(delta) {
    this.#elapsed += delta;

    // The cutscene owns the clock during the intro: it sets the time of day
    // per act, so the cycle must not advance underneath it.
    if (this.state.current !== STATE.intro) this.dayNight.update(delta);
    const sky = this.dayNight.snapshot();

    if (this.state.current === STATE.intro && this.#cutscene) {
      this.#stage.update(delta, this.#elapsed);
      this.#cutscene.update(delta, this.#cutsceneContext);
      // The cutscene drives how fast the world slides past.
      this.#world.update(delta, this.#cutsceneContext?.scrollSpeed ?? 0, sky, this.#elapsed);
      this.audio.update(delta, {
        train: {
          speed: this.#cutsceneContext?.scrollSpeed ?? 0,
          maxSpeedKmh: 80,
          throttleFraction: Math.min(1, (this.#cutsceneContext?.scrollSpeed ?? 0) / 22),
          inside: false,
        },
      });
      return;
    }

    if (this.#run && this.state.isSimulating) {
      const { train, journey, crew, mounts, statistics, wallet } = this.#run;

      train.update(delta);
      journey.update(delta);
      crew.update(delta);
      mounts.update(delta);
      this.#run.inventory.update(delta, { triggerHeld: this.input.isHeld(ACTION.fire) });

      // The controller drives stamina, because only it knows whether the
      // player is actually moving.
      this.#player.update(delta, this.#movementIntent());
      this.#updateFiring();

      if (this.#player.consumeFootstep()) {
        this.audio.play("footstep", { running: this.#run.stamina.isSprinting });
      }

      statistics.sample({
        distanceKm: train.distanceKm,
        moneyEarned: wallet.totalEarned,
        runTimeSeconds: journey.elapsedSeconds,
      });

      if (train.isDead) this.#failRun(RUN_FAILURE.locomotiveDestroyed);

      this.#stage.update(delta, this.#elapsed);
      this.#world.update(delta, train.speedMetresPerSecond, sky, this.#elapsed);
      this.#world.setThrottleIndicator(train.throttleIndex);
      // The lever in the cab shows the setting the player actually chose.
      this.#world.setThrottleLever(train.throttleIndex, this.#cab);
      this.#world.setSpeedIndicator(train.speedKmh / TRAIN.baseMaxSpeedKmh);
      this.#placeFirstPersonCamera(train);
      this.hud.update(this.#buildHudSnapshot());
      this.#updateInteractionPrompt();

      this.audio.update(delta, {
        listenerPosition: this.#player.eyePosition,
        listenerForward: this.#player.forwardVector,
        train: {
          speed: train.speedMetresPerSecond,
          maxSpeedKmh: train.maxSpeedKmh,
          throttleFraction: train.throttleFraction,
          inside: true,
        },
      });
    } else {
      this.#stage.update(delta, this.#elapsed);
      this.#world.update(delta, 0, sky);
      if (!this.#run) this.#placeMenuCamera(delta);
    }
  }

  /**
   * Shows the prompt for whatever the player is standing in front of.
   * Proximity rather than a raycast: inside a cab, a box around the console is
   * a better description of "at the controls" than a line from the eye.
   */
  #updateInteractionPrompt() {
    // Focus needs where the eye is and which way it points, because being near
    // a thing is not the same as looking at it.
    const focused = this.interaction.update({
      eye: this.#player.eyePosition,
      forward: this.#player.forwardVector,
      interactables: this.#world.interactables,
    });

    this.hud.setPrompt(
      focused
        ? `${this.localization.t("PROMPT_INTERACT", {
            key: this.input.primaryLabel(ACTION.interact),
          })}  ${this.localization.t(focused.promptKey)}`
        : null,
    );
  }

  /* --------------------------------------------------------------- camera */

  /**
   * The main menu view: parked beside the locomotive at night, drifting
   * slowly. The train is the thing on screen; the menu sits to one side of it.
   */
  #placeMenuCamera(delta) {
    this.#menuCameraTime += delta;
    this.dayNight.setTimeOfDay(0.02);

    const camera = this.#renderer.camera;
    const drift = Math.sin(this.#menuCameraTime * 0.1) * 1.8;

    camera.position.set(13.5, 4.4 + Math.sin(this.#menuCameraTime * 0.17) * 0.2, 15 + drift);
    camera.lookAt(new THREE.Vector3(-4.5, 2.6, -1 + drift * 0.3));
  }

  /**
   * First person, wherever the player has walked to.
   *
   * The camera follows the controller rather than being placed at a fixed
   * point - that is the whole difference between standing in the cab and
   * being bolted to it.
   *
   * A small amount of ride motion is added on top, scaled by speed. It is
   * deliberately tiny - a centimetre or two, well under the threshold where
   * shake becomes uncomfortable - but a completely steady camera inside a
   * machine doing 80 km/h is most of why the train reads as a still room.
   */
  #placeFirstPersonCamera(train = null) {
    const camera = this.#renderer.camera;
    const eye = this.#player.eyePosition;

    let sway = { x: 0, y: 0 };
    if (train) {
      const fraction = Math.min(1, Math.abs(train.speedKmh) / TRAIN.baseMaxSpeedKmh);
      const amount = fraction * 0.011;
      const t = this.#elapsed;
      sway = {
        x: (Math.sin(t * 9.1) + Math.sin(t * 23.3) * 0.4) * amount,
        y: (Math.sin(t * 13.7 + 0.8) + Math.sin(t * 31.1) * 0.35) * amount,
      };
    }

    camera.position.set(eye.x + sway.x, eye.y + sway.y, eye.z);

    const forward = this.#player.forwardVector;
    camera.lookAt(
      eye.x + sway.x + forward.x,
      eye.y + sway.y + forward.y,
      eye.z + forward.z,
    );
  }

  /* ------------------------------------------------------------------ HUD */

  /**
   * Builds a flat snapshot for the HUD. Note what is not in it: no total
   * distance, no distance remaining, no outpost count. The HUD physically
   * cannot spoil the ending because it is never given the numbers.
   */
  #buildHudSnapshot() {
    const { train, wallet, health, stamina, inventory, journey } = this.#run;
    const journeyInfo = journey.hudSnapshot();
    const weaponId = inventory.equippedWeaponId;
    const weapon = inventory.equippedWeapon;

    return {
      money: wallet.balance,
      distanceKm: journeyInfo.distanceKm,
      lastOutpostNameKey: journeyInfo.lastOutpostNameKey,
      health: health.value,
      healthFraction: health.fraction,
      staminaVisible: stamina.shouldDisplay,
      staminaFraction: stamina.fraction,
      speedKmh: train.speedKmh,
      throttleIndex: train.throttleIndex,
      magazine: weapon?.roundsInMagazine ?? 0,
      reserve: inventory.reserveRoundsFor(weaponId, train),
      reloading: weapon?.isReloading ?? false,
      weaponNameKey: WEAPON_NAME_KEYS[weaponId] ?? "WEAPON_PISTOL",
    };
  }

  /* ------------------------------------------------------------ diagnostics */

  /**
   * A snapshot of the things that go wrong invisibly: where the player is,
   * whether they are switched on, whether the cutscene handed control back.
   * Read by the automated flow check and handy from the browser console.
   */
  get diagnostics() {
    return {
      state: this.state.current,
      cutscene: this.#cutscene
        ? { shot: this.#cutscene.currentShot?.name ?? null, progress: this.#cutscene.progress }
        : null,
      player: this.#player
        ? {
            enabled: this.#player.isEnabled,
            position: { ...this.#player.position },
            eyeY: this.#player.eyePosition.y,
            grounded: this.#player.isGrounded,
            yaw: this.#player.yaw,
            clear: this.#player.isClear,
            speed: this.#player.speed,
          }
        : null,
      colliderCount: this.#world.colliders.size,
      ownedWeapons: this.#run?.inventory.wheelOrder ?? [],
      magazine: this.#run?.inventory.equippedWeapon?.roundsInMagazine ?? 0,
      reserve: this.#run
        ? this.#run.inventory.reserveRoundsFor(this.#run.inventory.equippedWeaponId, this.#run.train)
        : 0,
      throttleIndex: this.#run?.train.throttleIndex ?? 0,
      speedKmh: this.#run?.train.speedKmh ?? 0,
      interactableCount: this.#world.interactables.length,
      pointerLocked: Boolean(document.pointerLockElement),
      cinematicActive: this.cinematic.isActive,
      cutsceneShot: this.#cutscene?.currentShot?.name ?? null,
      audio: {
        ready: this.audio.isReady,
        trainVoicesRunning: this.audio.trainAudio.isRunning,
      },
      // What the train actually sounds like right now, so the mix can be
      // inspected on a machine with no sound card.
      audioMix: this.#run
        ? locomotiveMix({
            throttleFraction: this.#run.train.throttleFraction,
            speedFraction: Math.min(
              1,
              this.#run.train.speedKmh / Math.max(1, this.#run.train.maxSpeedKmh),
            ),
            moving: this.#run.train.speedMetresPerSecond > 0.4,
          })
        : null,
      sideDoors: {
        left: this.#world.isSideDoorOpen("left"),
        right: this.#world.isSideDoorOpen("right"),
      },
    };
  }

  /**
   * Diagnostic: advances the intro by `seconds` of cutscene time.
   *
   * The automated flow check uses this to run every shot in a few seconds
   * rather than in real time, which is the only practical way to exercise all
   * twenty beats on a machine without a GPU. It changes nothing about how the
   * cutscene behaves - it is the same update call the loop makes.
   */
  /** Diagnostic: points the camera at an absolute yaw and pitch. */
  debugSetLook(yaw, pitch) {
    this.#player.yaw = yaw;
    this.#player.pitch = pitch;
  }

  /** Diagnostic: sets the throttle notch directly. */
  debugSetThrottle(index) {
    this.#run?.train.setThrottleIndex(index);
  }

  /** Diagnostic: the speed the current notch is asking for, in km/h. */
  debugTargetSpeedKmh() {
    const train = this.#run?.train;
    return train ? train.maxSpeedKmh * train.throttleFraction : 0;
  }

  /** Diagnostic: turns the camera, for automated screenshots without a mouse. */
  debugLook(yaw, pitch) {
    this.#player.look(yaw, pitch);
  }

  /* --------------------------------------------------- doors and walkways */

  /**
   * Diagnostic: presses E on whatever the player is currently looking at.
   * The real key path, not a shortcut round it - a test that called the door
   * handler directly would pass with the prompt and the gaze both broken.
   */
  debugInteract() {
    return this.interaction.activate({ game: this });
  }

  debugSideDoorOpen(side) {
    return this.#world.isSideDoorOpen(side);
  }

  /** Diagnostic: stands in front of a side door and looks straight at it. */
  debugFaceSideDoor(side) {
    if (!this.#run) return null;
    const doorway = sideDoorLayout(this.#cab);
    const direction = side === "right" ? 1 : -1;

    this.#player.position.x = direction * 0.75;
    this.#player.position.y = this.#cab.floorY;
    this.#player.position.z = doorway.centreZ;
    // Yaw is measured so that forward is (sin yaw, cos yaw): a quarter turn
    // to the right faces +x, minus a quarter faces -x.
    this.#player.yaw = (direction * Math.PI) / 2;
    this.#player.pitch = -0.12;
    this.#updateInteractionPrompt();

    return { ...this.#player.position };
  }

  /** Diagnostic: stands at the rear door and looks at it. */
  debugFaceRearDoor() {
    if (!this.#run) return null;
    this.#player.position.x = 0;
    this.#player.position.y = this.#cab.floorY;
    this.#player.position.z = this.#cab.backZ + 1.9;
    // Facing -z, towards the back of the train.
    this.#player.yaw = Math.PI;
    this.#player.pitch = -0.05;
    this.#updateInteractionPrompt();
    return { ...this.#player.position };
  }

  /**
   * Diagnostic: walks out through a side door the way the player would -
   * through the movement system, against the real colliders.
   */
  debugStepOutside(side) {
    return this.#debugWalk(side === "right" ? 1 : -1);
  }

  /** Diagnostic: walks back in through a side door. */
  debugStepInside(side) {
    const result = this.#debugWalk(side === "right" ? -1 : 1);
    return result;
  }

  #debugWalk(directionX) {
    if (!this.#run) return null;
    const before = { ...this.#player.position };

    // Face along the world x axis and walk. Forward is (sin yaw, cos yaw), so
    // a quarter turn right faces +x. This goes through the same movement and
    // collision path the keyboard does - which is the point of testing it.
    this.#player.yaw = (directionX * Math.PI) / 2;

    for (let step = 0; step < 120; step += 1) {
      this.#player.update(1 / 60, { forward: 1 });
    }

    return {
      from: { x: +before.x.toFixed(2), y: +before.y.toFixed(2), z: +before.z.toFixed(2) },
      to: {
        x: +this.#player.position.x.toFixed(2),
        y: +this.#player.position.y.toFixed(2),
        z: +this.#player.position.z.toFixed(2),
      },
      grounded: this.#player.isGrounded,
    };
  }

  advanceIntro(seconds, step = 0.25) {
    if (!this.#cutscene) return false;
    for (let elapsed = 0; elapsed < seconds && this.#cutscene; elapsed += step) {
      this.#stage.update(step, (this.#elapsed += step));
      this.#cutscene?.update(step, this.#cutsceneContext);
      // The world too, or a fast-forward leaves the scenery, the wheels and
      // the cab doors frozen where they were - and then the thing being
      // looked at is not the thing the player would see.
      this.#world.update(
        step,
        this.#cutsceneContext?.scrollSpeed ?? 0,
        this.dayNight.snapshot(),
        this.#elapsed,
      );
    }
    return true;
  }

  dispose() {
    if (this.#loopHandle !== null) cancelAnimationFrame(this.#loopHandle);
    this.input.detach();
    this.#world.dispose();
    this.#renderer.dispose();
  }
}
