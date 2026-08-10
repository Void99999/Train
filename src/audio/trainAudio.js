/**
 * LAST TRAIN - the sound of the train.
 *
 * Four continuous voices plus a rhythm:
 *
 *   engine    a pitched drone that rises with throttle and settles with speed
 *   rolling   broadband wheel-on-rail noise that opens up as speed climbs
 *   wind      air over the hull, felt mostly at the top of the range
 *   frame     a low interior rumble, the structure working
 *   clacks    rail joints, fired at a rate proportional to speed
 *
 * The engine deliberately responds to the *throttle* as well as to the speed.
 * Opening the throttle has to be audible immediately, before the train has
 * actually gained anything - that lag between hearing the engine take up and
 * feeling the speed arrive is most of what makes a heavy train feel heavy.
 *
 * Rail joints are the single most important cue for how fast the train is
 * going. Their rate is speed divided by joint spacing, so 25% and 100% are
 * unmistakably different without anyone having to read a number.
 */

import { UNITS } from "../data/balance.js";

/** Metres between rail joints. Real track is longer; this reads better. */
const JOINT_SPACING_METRES = 11;

/** Below this, the train is stopped as far as the mix is concerned. */
const IDLE_SPEED = 0.4;

export class TrainAudio {
  #engine;
  #sounds;
  #voices = null;
  #distanceSinceClack = 0;
  #stressTimer = 12;
  #started = false;

  constructor({ engine, sounds }) {
    this.#engine = engine;
    this.#sounds = sounds;
  }

  get isRunning() {
    return this.#started;
  }

  /** Builds the continuous voices. Safe to call more than once. */
  start() {
    if (this.#started || !this.#engine.isReady) return false;

    this.#voices = {
      // A low sawtooth is the closest simple source to a diesel under load.
      engine: this.#engine.createLoop({
        type: "sawtooth",
        frequency: 34,
        filterType: "lowpass",
        cutoff: 240,
        bus: "train",
      }),
      // A second voice an octave up, for the mechanical edge on top.
      engineHarmonic: this.#engine.createLoop({
        type: "square",
        frequency: 68,
        filterType: "lowpass",
        cutoff: 400,
        bus: "train",
      }),
      rolling: this.#engine.createLoop({
        type: "noise",
        filterType: "bandpass",
        cutoff: 320,
        q: 0.7,
        bus: "train",
      }),
      wind: this.#engine.createLoop({
        type: "noise",
        filterType: "highpass",
        cutoff: 700,
        bus: "train",
      }),
      frame: this.#engine.createLoop({
        type: "noise",
        filterType: "lowpass",
        cutoff: 90,
        bus: "train",
      }),
    };

    this.#started = Object.values(this.#voices).every(Boolean);
    return this.#started;
  }

  stop() {
    if (!this.#voices) return;
    for (const voice of Object.values(this.#voices)) voice?.stop();
    this.#voices = null;
    this.#started = false;
  }

  /**
   * @param {object} state
   * @param {number} state.speed         metres per second
   * @param {number} state.maxSpeedKmh   the train's current ceiling
   * @param {number} state.throttleFraction 0-1
   * @param {boolean} state.inside       is the player in the train
   */
  update(deltaSeconds, { speed = 0, maxSpeedKmh = 80, throttleFraction = 0, inside = true }) {
    if (!this.#started) {
      if (!this.start()) return;
    }

    const topSpeed = Math.max(1, maxSpeedKmh * UNITS.kmhToMetresPerSecond);
    const speedFraction = Math.min(1, speed / topSpeed);
    const moving = speed > IDLE_SPEED;

    // Interior surfaces damp the high end; outside, everything is brighter.
    const enclosure = inside ? 1 : 1.6;

    /* ------------------------------------------------------------ engine */

    // Idles at 34 Hz and climbs with throttle. Speed contributes a little, so
    // the note settles once the train has caught up with the notch.
    const engineHz = 34 + throttleFraction * 46 + speedFraction * 14;
    const engineGain = 0.05 + throttleFraction * 0.12;

    this.#set(this.#voices.engine.source.frequency, engineHz, 0.35);
    this.#set(this.#voices.engine.gain.gain, engineGain, 0.3);
    this.#set(this.#voices.engine.filter.frequency, 180 + throttleFraction * 520, 0.35);

    this.#set(this.#voices.engineHarmonic.source.frequency, engineHz * 2.02, 0.35);
    this.#set(this.#voices.engineHarmonic.gain.gain, engineGain * 0.35, 0.3);
    this.#set(this.#voices.engineHarmonic.filter.frequency, 300 + throttleFraction * 900, 0.35);

    /* ----------------------------------------------------------- rolling */

    // Wheel noise is almost all of the speed cue. It is silent at a stand.
    this.#set(this.#voices.rolling.gain.gain, moving ? 0.05 + speedFraction * 0.16 : 0, 0.2);
    this.#set(this.#voices.rolling.filter.frequency, (260 + speedFraction * 900) * enclosure, 0.25);

    /* -------------------------------------------------------------- wind */

    // Wind rises faster than linearly: barely there at a crawl, loud at speed.
    const windGain = moving ? Math.pow(speedFraction, 2.1) * (inside ? 0.075 : 0.22) : 0;
    this.#set(this.#voices.wind.gain.gain, windGain, 0.3);
    this.#set(this.#voices.wind.filter.frequency, 600 + speedFraction * 1500, 0.3);

    /* ------------------------------------------------------------- frame */

    this.#set(
      this.#voices.frame.gain.gain,
      moving ? (0.04 + speedFraction * 0.07) * (inside ? 1 : 0.4) : 0.012,
      0.25,
    );

    /* ------------------------------------------------------- rail joints */

    if (moving) {
      this.#distanceSinceClack += speed * deltaSeconds;
      while (this.#distanceSinceClack >= JOINT_SPACING_METRES) {
        this.#distanceSinceClack -= JOINT_SPACING_METRES;
        // Louder at speed, and never so loud at a crawl that it dominates.
        this.#sounds.rail_clack(this.#engine, { intensity: 0.35 + speedFraction * 0.9 });
      }
    } else {
      this.#distanceSinceClack = 0;
    }

    /* ----------------------------------------------------- metal groaning */

    // Occasional structural complaint, more often the harder it is working.
    this.#stressTimer -= deltaSeconds * (0.4 + speedFraction);
    if (this.#stressTimer <= 0) {
      this.#stressTimer = 9 + Math.random() * 14;
      if (moving) this.#sounds.metal_stress(this.#engine);
    }
  }

  #set(param, value, smoothing) {
    param.setTargetAtTime(value, this.#engine.now, smoothing);
  }
}
