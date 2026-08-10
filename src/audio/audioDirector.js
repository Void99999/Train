/**
 * LAST TRAIN - what makes a noise, and when.
 *
 * Subscribes to the event bus and turns gameplay events into sounds. Systems
 * stay deaf: the train does not know it has an engine note and the weapon does
 * not know it goes bang. That is what allows the whole audio layer to be
 * switched off, replaced, or re-mixed without touching gameplay.
 */

import { GAME_EVENT } from "../core/events.js";
import { AudioEngine } from "./audioEngine.js";
import { createSoundLibrary } from "./soundLibrary.js";
import { TrainAudio } from "./trainAudio.js";

export class AudioDirector {
  engine = new AudioEngine();
  sounds = createSoundLibrary();

  #train;
  #events;
  #settings;
  #enabled = true;

  constructor({ events, settings }) {
    this.#events = events;
    this.#settings = settings;
    this.#train = new TrainAudio({ engine: this.engine, sounds: this.sounds });

    this.#subscribe();
  }

  get trainAudio() {
    return this.#train;
  }

  get isReady() {
    return this.engine.isReady;
  }

  /**
   * Starts audio. Must be called from a user gesture; browsers refuse
   * otherwise and the whole game plays in silence with no error.
   */
  start() {
    const started = this.engine.resume();
    if (started) this.engine.setVolume(this.#settings.volumeGain);
    return started;
  }

  setMuted(muted) {
    this.engine.setMuted(muted);
  }

  /** Plays a catalogue sound by name. Unknown names are ignored, not thrown. */
  play(name, options) {
    if (!this.#enabled || !this.engine.isReady) return;
    this.sounds[name]?.(this.engine, options);
  }

  #subscribe() {
    const events = this.#events;

    events.on(GAME_EVENT.settingsChanged, ({ key, value }) => {
      if (key === "volume") this.engine.setVolume(value / 100);
    });

    // Weapons name their own sound, so adding a weapon needs no wiring here.
    events.on(GAME_EVENT.weaponFired, ({ weaponId, position }) => {
      this.play(weaponId, { position });
    });

    events.on(GAME_EVENT.weaponReloaded, ({ position }) => {
      this.play("mechanical_clunk", { position });
    });

    events.on(GAME_EVENT.ammunitionEmpty, () => this.play("ui_deny"));

    events.on(GAME_EVENT.vehicleDamaged, ({ position }) => {
      this.play("impact_metal", { position });
    });

    events.on(GAME_EVENT.vehicleDestroyed, ({ position }) => {
      this.play("explosion", { position, scale: 1.4 });
    });

    events.on(GAME_EVENT.vehicleDetached, () => this.play("coupling"));
    events.on(GAME_EVENT.vehicleAttached, () => this.play("coupling"));

    events.on(GAME_EVENT.playerDamaged, () => this.play("hurt"));
    events.on(GAME_EVENT.playerHealed, () => this.play("heal"));

    events.on(GAME_EVENT.throttleChanged, () => this.play("mechanical_clunk"));

    events.on(GAME_EVENT.moneyChanged, ({ delta }) => {
      this.play(delta >= 0 ? "ui_confirm" : "ui_move");
    });

    events.on(GAME_EVENT.purchaseFailed, () => this.play("ui_deny"));
    events.on(GAME_EVENT.outpostReached, () => this.play("ui_confirm"));
  }

  /**
   * Per-frame update: moves the listener and drives the continuous voices.
   *
   * @param {object} state
   * @param {{x,y,z}} state.listenerPosition
   * @param {{x,y,z}} state.listenerForward
   * @param {object} state.train `{ speed, maxSpeedKmh, throttleFraction }`
   */
  update(deltaSeconds, { listenerPosition, listenerForward, train }) {
    if (!this.engine.isReady) return;

    if (listenerPosition && listenerForward) {
      this.engine.setListener(listenerPosition, listenerForward);
    }
    if (train) this.#train.update(deltaSeconds, train);
  }

  dispose() {
    this.#train.stop();
    this.engine.dispose();
  }
}
