/**
 * LAST TRAIN - the sound of the train.
 *
 * A locomotive is not a car engine. A car engine is a periodic waveform and
 * the ear hears it as a pitch; that is where "brumm brumm brumm" comes from.
 * A 120-tonne diesel-electric heard from inside the cab is almost entirely
 * *noise*: a broadband rumble from the block, a hiss of exhaust and cooling
 * air that brightens as it takes up load, the roll of steel wheels, the frame
 * working, and - the only truly periodic thing in the whole mix - rail joints
 * passing underneath.
 *
 * So none of the continuous voices here are oscillators except one very quiet
 * sine, which exists purely to put weight under the noise and is deliberately
 * harmonic-free so it cannot buzz.
 *
 * Six continuous voices plus two rhythms:
 *
 *   rumble       filtered noise, the mass of the engine block
 *   exhaust      mid-band noise, the machine breathing harder under load
 *   fundamental  a near-subsonic sine, felt more than heard
 *   rolling      wheel-on-rail, the main speed cue in the continuous bed
 *   wind         air over the hull, felt mostly at the top of the range
 *   frame        low interior rumble, the structure working
 *   clacks       rail joints, at a rate proportional to speed
 *   rattles      loose panels and fittings, irregular
 *
 * On loudness: the four throttle notches have to be *distinguishable*, which
 * is not the same as being progressively louder. Most of the difference here
 * is timbre - how bright the exhaust is, how much rattle, how fast the joints
 * come - and only a little of it is level. From notch 1 to notch 4 the engine
 * bed roughly doubles in level, not quadruples, which is why full power is
 * unmistakable without being punishing.
 */

import { UNITS } from "../data/balance.js";

/** Metres between rail joints. Real track is longer; this reads better. */
const JOINT_SPACING_METRES = 11;

/** Below this, the train is stopped as far as the mix is concerned. */
const IDLE_SPEED = 0.4;

/**
 * The whole mix as plain numbers, given the train's state.
 *
 * Pulled out of the audio path on purpose: this is the part with the design
 * decisions in it, and it can be checked in a test runner that has no sound
 * card. Nothing in here touches Web Audio.
 *
 * @param {object} state
 * @param {number} state.throttleFraction 0-1
 * @param {number} state.speedFraction    0-1, speed against the current ceiling
 * @param {boolean} state.moving
 * @param {boolean} state.inside          is the player in the train
 */
export function locomotiveMix({
  throttleFraction = 0,
  speedFraction = 0,
  moving = false,
  inside = true,
} = {}) {
  const throttle = Math.max(0, Math.min(1, throttleFraction));
  const speed = Math.max(0, Math.min(1, speedFraction));

  // Interior surfaces damp the high end; outside, everything is brighter.
  const enclosure = inside ? 1 : 1.6;

  return {
    // The block. Broadband and low - this is the "heavy" in heavy machine.
    // It opens up under load rather than getting much louder.
    rumble: {
      gain: 0.055 + throttle * 0.045,
      cutoff: 70 + throttle * 85,
    },

    // Exhaust and cooling air. The clearest of the four-notch cues: at idle
    // it is a distant hiss, at full power it is a roar sitting on top of the
    // rumble. Level barely moves; brightness moves a great deal.
    exhaust: {
      gain: 0.018 + throttle * 0.05,
      cutoff: (180 + throttle * 520) * enclosure,
    },

    // Weight. A sine has no harmonics, so however loud this gets it can never
    // turn into the buzzing drone that a sawtooth does.
    fundamental: {
      gain: 0.03 + throttle * 0.035,
      frequency: 26 + throttle * 16 + speed * 6,
    },

    // Wheels on steel. Silent at a stand - a parked train still idles, but it
    // does not roll.
    rolling: {
      gain: moving ? 0.045 + speed * 0.13 : 0,
      cutoff: (240 + speed * 820) * enclosure,
    },

    // Wind rises faster than linearly: barely there at a crawl, present at
    // speed, and much stronger with your head out of the door.
    wind: {
      gain: moving ? Math.pow(speed, 2.1) * (inside ? 0.055 : 0.17) : 0,
      cutoff: 600 + speed * 1500,
    },

    // The structure itself. Mostly an interior sound.
    frame: {
      gain: moving ? (0.03 + speed * 0.05) * (inside ? 1 : 0.4) : 0.01,
    },

    // Rail joints. Never so loud at a crawl that they dominate.
    clackIntensity: 0.3 + speed * 0.75,

    // Loose fittings. Irregular on purpose - a rattle on a fixed beat would
    // be exactly the mechanical loop this rewrite exists to remove.
    rattlesPerSecond: moving ? 0.5 + speed * 3.2 + throttle * 1.1 : 0,
  };
}

export class TrainAudio {
  #engine;
  #sounds;
  #voices = null;
  #distanceSinceClack = 0;
  #stressTimer = 12;
  #rattleTimer = 1;
  #started = false;
  #random;

  constructor({ engine, sounds, random = Math.random }) {
    this.#engine = engine;
    this.#sounds = sounds;
    this.#random = random;
  }

  get isRunning() {
    return this.#started;
  }

  /** Builds the continuous voices. Safe to call more than once. */
  start() {
    if (this.#started || !this.#engine.isReady) return false;

    this.#voices = {
      rumble: this.#engine.createLoop({
        type: "noise",
        filterType: "lowpass",
        cutoff: 90,
        q: 0.8,
        bus: "train",
      }),
      exhaust: this.#engine.createLoop({
        type: "noise",
        filterType: "bandpass",
        cutoff: 220,
        q: 1.1,
        bus: "train",
      }),
      // The only oscillator in the bed, and a sine so it cannot buzz.
      fundamental: this.#engine.createLoop({
        type: "sine",
        frequency: 30,
        filterType: "lowpass",
        cutoff: 120,
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
    const moving = speed > IDLE_SPEED;
    const mix = locomotiveMix({
      throttleFraction,
      speedFraction: Math.min(1, speed / topSpeed),
      moving,
      inside,
    });

    /* --------------------------------------------------- continuous voices */

    // Slow smoothing on the engine bed: opening the throttle should sound
    // like a machine taking up load over a second or so, not like a switch.
    this.#apply("rumble", mix.rumble, 0.45);
    this.#apply("exhaust", mix.exhaust, 0.4);
    this.#apply("fundamental", mix.fundamental, 0.4);
    this.#apply("rolling", mix.rolling, 0.2);
    this.#apply("wind", mix.wind, 0.3);
    this.#apply("frame", mix.frame, 0.25);

    /* ------------------------------------------------------- rail joints */

    if (moving) {
      this.#distanceSinceClack += speed * deltaSeconds;
      while (this.#distanceSinceClack >= JOINT_SPACING_METRES) {
        this.#distanceSinceClack -= JOINT_SPACING_METRES;
        this.#sounds.rail_clack(this.#engine, { intensity: mix.clackIntensity });
      }
    } else {
      this.#distanceSinceClack = 0;
    }

    /* ----------------------------------------------------------- rattles */

    if (mix.rattlesPerSecond > 0) {
      this.#rattleTimer -= deltaSeconds * mix.rattlesPerSecond;
      if (this.#rattleTimer <= 0) {
        // Reset to somewhere between a third and one and a half intervals so
        // the rattles never settle into a beat.
        this.#rattleTimer = 0.35 + this.#random() * 1.15;
        this.#sounds.panel_rattle(this.#engine, { intensity: 0.5 + mix.clackIntensity * 0.5 });
      }
    }

    /* ---------------------------------------------------- metal groaning */

    // Occasional structural complaint, more often the harder it is working.
    this.#stressTimer -= deltaSeconds * (0.4 + Math.min(1, speed / topSpeed));
    if (this.#stressTimer <= 0) {
      this.#stressTimer = 9 + this.#random() * 14;
      if (moving) this.#sounds.metal_stress(this.#engine);
    }
  }

  /** Pushes one voice's target numbers at it, ignoring fields it does not have. */
  #apply(name, values, smoothing) {
    const voice = this.#voices[name];
    if (!voice) return;
    if (values.gain !== undefined) this.#set(voice.gain.gain, values.gain, smoothing);
    if (values.cutoff !== undefined) this.#set(voice.filter.frequency, values.cutoff, smoothing);
    if (values.frequency !== undefined && voice.source.frequency) {
      this.#set(voice.source.frequency, values.frequency, smoothing);
    }
  }

  #set(param, value, smoothing) {
    param.setTargetAtTime(value, this.#engine.now, smoothing);
  }
}
