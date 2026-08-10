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
import { RunManager, RUN_FAILURE } from "./systems/run/runManager.js";
import { Crew } from "./systems/ai/loader.js";

import { MenuSystem } from "./ui/menus.js";
import { Hud } from "./ui/hud.js";

import { weaponSpec } from "./data/weapons.js";
import { TRAIN } from "./data/balance.js";

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

export class Game {
  #renderer;
  #world;
  #loopHandle = null;
  #lastFrameTime = 0;
  #run = null;
  #menuTrain = null;
  #cameraRig = { yaw: 0, pitch: 0 };
  #menuCameraTime = 0;

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

    this.events.on(GAME_EVENT.languageChanged, () => this.hud.refreshLanguage());
    this.#wireRunEvents();

    // The main menu is played out in front of the train the run will be built
    // around, so one exists before the player presses Start. It carries no
    // simulation - it is there to be looked at.
    this.#menuTrain = new Train();
    this.#world.syncTrain(this.#menuTrain);
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
        if (this.#run) {
          this.#run.mounts.sync();
          this.#world.syncTrain(this.#run.train);
        }
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

    this.#run = context;
    this.#world.syncTrain(train);

    // The opening cinematic is a later phase of the project. Until it exists,
    // Start puts the player at the controls directly.
    this.state.transitionTo(STATE.playing);
    this.menus.hide();
    this.hud.show();
    this.#cameraRig = { yaw: 0, pitch: 0 };
    this.#requestPointerLock();

    this.events.emit(GAME_EVENT.runStarted, { mode: this.settings.mode });
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
    this.#requestPointerLock();
  }

  pause() {
    if (!this.state.transitionTo(STATE.paused)) return;
    this.hud.hide();
    this.menus.show("pause");
    document.exitPointerLock?.();
  }

  exitToMenu() {
    this.#run = null;
    this.state.transitionTo(STATE.mainMenu);
    this.hud.hide();
    this.menus.show("mainMenu");
    document.exitPointerLock?.();
  }

  #requestPointerLock() {
    this.#renderer.three.domElement.requestPointerLock?.();
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

    if (!this.#run || !this.state.isSimulating) return;

    if (this.input.wasPressed(ACTION.throttleUp)) this.#run.train.throttleUp();
    if (this.input.wasPressed(ACTION.throttleDown)) this.#run.train.throttleDown();

    if (this.input.wasPressed(ACTION.reload)) {
      this.#run.inventory.reloadEquipped(this.#run.train);
    }

    if (this.input.wasPressed(ACTION.useMedkit)) {
      const restored = this.#run.inventory.useMedkit(this.#run.health);
      if (restored > 0) this.hud.toast(this.localization.t("MEDICAL_MEDKIT"));
    }

    // Mouse look, applied only while the pointer is captured.
    if (document.pointerLockElement) {
      const delta = this.input.consumeMouseDelta();
      this.#cameraRig.yaw -= delta.x * 0.0022;
      this.#cameraRig.pitch = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, this.#cameraRig.pitch - delta.y * 0.0022),
      );
    }
  }

  #update(delta) {
    this.dayNight.update(delta);
    const sky = this.dayNight.snapshot();

    if (this.#run && this.state.isSimulating) {
      const { train, journey, crew, mounts, stamina, statistics, wallet } = this.#run;

      train.update(delta);
      journey.update(delta);
      crew.update(delta);
      mounts.update(delta);
      this.#run.inventory.update(delta, { triggerHeld: this.input.isHeld(ACTION.fire) });
      stamina.update(delta, {
        wantsToSprint: this.input.isHeld(ACTION.sprint),
        isMoving: false,
      });

      statistics.sample({
        distanceKm: train.distanceKm,
        moneyEarned: wallet.totalEarned,
        runTimeSeconds: journey.elapsedSeconds,
      });

      if (train.isDead) this.#failRun(RUN_FAILURE.locomotiveDestroyed);

      this.#world.update(delta, train.speedMetresPerSecond, sky);
      this.#placeCabCamera();
      this.hud.update(this.#buildHudSnapshot());
    } else {
      this.#world.update(delta, 0, sky);
      if (!this.#run) this.#placeMenuCamera(delta);
    }
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

    // A three-quarter view from ahead of the locomotive, framed so the machine
    // sits in the right of the picture and the menu has the left to itself.
    camera.position.set(13.5, 4.4 + Math.sin(this.#menuCameraTime * 0.17) * 0.2, 15 + drift);
    camera.lookAt(new THREE.Vector3(-4.5, 2.6, -1 + drift * 0.3));
  }

  /**
   * First person at the driver's position, looking forward over the hood.
   *
   * The cab is currently a sealed shell - modelled interiors and walking
   * through the train are the next phase of the project - so the eye point is
   * placed at the front of the cab, above the bonnet line, which is where a
   * driver would actually be looking from.
   */
  #placeCabCamera() {
    const camera = this.#renderer.camera;
    const locomotive = this.#run.train.locomotive;
    if (!locomotive) return;

    const length = locomotive.spec.size.length;
    camera.position.set(-0.55, 3.55, -length * 0.18 + 1.4);

    const direction = new THREE.Vector3(
      Math.sin(this.#cameraRig.yaw) * Math.cos(this.#cameraRig.pitch),
      Math.sin(this.#cameraRig.pitch),
      Math.cos(this.#cameraRig.yaw) * Math.cos(this.#cameraRig.pitch),
    );
    camera.lookAt(camera.position.clone().add(direction));
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

  dispose() {
    if (this.#loopHandle !== null) cancelAnimationFrame(this.#loopHandle);
    this.input.detach();
    this.#world.dispose();
    this.#renderer.dispose();
  }
}
