/**
 * LAST TRAIN - the day and night cycle.
 *
 * Forty real minutes from dawn back round to dawn, moving continuously. There
 * is no moment where the game flips from day to night: the sun angle, the
 * light colour, the ambient level and the sky all slide, and the train's
 * headlight becomes the thing keeping the track visible somewhere in the
 * middle of that slide.
 *
 * This is pure maths with no renderer in it, so the transitions can be tested
 * without drawing a frame.
 */

import { WORLD } from "../../data/balance.js";

export const PHASE = {
  night: "night",
  dawn: "dawn",
  morning: "morning",
  midday: "midday",
  afternoon: "afternoon",
  sunset: "sunset",
  dusk: "dusk",
};

/**
 * Phase boundaries as fractions of the cycle, where 0 is midnight and 0.5 is
 * midday. Ordered, and read as "this phase starts here".
 */
const PHASE_STARTS = [
  { at: 0.0, phase: PHASE.night },
  { at: 0.21, phase: PHASE.dawn },
  { at: 0.29, phase: PHASE.morning },
  { at: 0.42, phase: PHASE.midday },
  { at: 0.58, phase: PHASE.afternoon },
  { at: 0.71, phase: PHASE.sunset },
  { at: 0.79, phase: PHASE.dusk },
  { at: 0.86, phase: PHASE.night },
];

/** Key colours, interpolated between rather than switched. */
const SUN_COLOURS = [
  { at: 0.0, colour: 0x1b2740 },
  { at: 0.22, colour: 0x4a3b48 },
  { at: 0.28, colour: 0xd8763f },
  { at: 0.35, colour: 0xffca8a },
  { at: 0.5, colour: 0xfff3dc },
  { at: 0.68, colour: 0xffcf96 },
  { at: 0.75, colour: 0xd9663a },
  { at: 0.82, colour: 0x4a3550 },
  { at: 1.0, colour: 0x1b2740 },
];

const SKY_COLOURS = [
  { at: 0.0, colour: 0x05070d },
  { at: 0.22, colour: 0x1b2036 },
  { at: 0.3, colour: 0x6b6072 },
  { at: 0.42, colour: 0x8fb0cc },
  { at: 0.5, colour: 0x9dc0dc },
  { at: 0.68, colour: 0x8a9db4 },
  { at: 0.76, colour: 0x5c4a57 },
  { at: 0.84, colour: 0x161a2a },
  { at: 1.0, colour: 0x05070d },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Interpolates through a list of `{ at, colour }` stops. Returns a hex number. */
function sampleGradient(stops, position) {
  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i += 1) {
    if (position >= stops[i].at && position <= stops[i + 1].at) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const span = upper.at - lower.at;
  const t = span === 0 ? 0 : (position - lower.at) / span;

  const channel = (shift) => {
    const a = (lower.colour >> shift) & 255;
    const b = (upper.colour >> shift) & 255;
    return Math.round(lerp(a, b, t));
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export class DayNightCycle {
  #time;

  constructor({ startTimeOfDay = WORLD.startTimeOfDay } = {}) {
    this.#time = startTimeOfDay % 1;
  }

  /** Position in the cycle, 0-1. 0 is midnight, 0.5 is midday. */
  get timeOfDay() {
    return this.#time;
  }

  setTimeOfDay(value) {
    // Wrapping is only needed when the value is out of range. Doing the modulo
    // unconditionally perturbs the last bit, which would make a saved time of
    // day come back very slightly different every time it was reloaded.
    this.#time = value >= 0 && value < 1 ? value : ((value % 1) + 1) % 1;
  }

  update(deltaSeconds) {
    this.#time = (this.#time + deltaSeconds / WORLD.dayLengthSeconds) % 1;
  }

  get phase() {
    let current = PHASE_STARTS[0].phase;
    for (const entry of PHASE_STARTS) {
      if (this.#time >= entry.at) current = entry.phase;
    }
    return current;
  }

  /**
   * Sun elevation in radians. Negative means the sun is below the horizon,
   * which is what the renderer uses to decide whether to light the scene with
   * the sun or the moon.
   */
  get sunElevation() {
    return Math.sin((this.#time - 0.25) * Math.PI * 2) * (Math.PI / 2);
  }

  /** Sun azimuth in radians, so shadows swing round over the course of a day. */
  get sunAzimuth() {
    return this.#time * Math.PI * 2;
  }

  get isNight() {
    return this.sunElevation < -0.05;
  }

  /** 0 in full daylight, 1 in the middle of the night. */
  get darkness() {
    const elevation = this.sunElevation;
    if (elevation >= 0.25) return 0;
    if (elevation <= -0.15) return 1;
    return 1 - (elevation + 0.15) / 0.4;
  }

  get sunColour() {
    return sampleGradient(SUN_COLOURS, this.#time);
  }

  get skyColour() {
    return sampleGradient(SKY_COLOURS, this.#time);
  }

  /**
   * Directional light strength, in the renderer's physical units. Falls to
   * zero before the sun is fully down, so dusk hands over to the moon and the
   * train's own lights rather than snapping between them.
   */
  get sunIntensity() {
    return Math.max(0, Math.sin(this.sunElevation)) * 4.6;
  }

  /**
   * Moonlight takes over as the sun goes: cold, directional, and much weaker
   * than daylight - but not as weak as real moonlight, which would leave the
   * player staring at a black rectangle. Night has to be dark enough to feel
   * like night and light enough to drive a train through.
   */
  get moonIntensity() {
    return this.darkness * 1.25;
  }

  /**
   * Ambient never drops to nothing.
   *
   * Real moonlight is far darker than this. It is raised deliberately: the
   * player has to be able to read the inside of the cab and the shape of the
   * land at 3am, and a scene the player cannot parse is not atmospheric, it is
   * broken. Night stays clearly night - the sun contributes nothing, colours
   * go cold and blue, and contrast comes from practical lamps.
   */
  get ambientIntensity() {
    return 0.45 + (1 - this.darkness) * 0.4;
  }

  /** True once artificial lights should be burning. */
  get needsArtificialLight() {
    return this.darkness > 0.35;
  }

  /** Everything the renderer needs, in one object. */
  snapshot() {
    return {
      timeOfDay: this.#time,
      phase: this.phase,
      sunElevation: this.sunElevation,
      sunAzimuth: this.sunAzimuth,
      sunColour: this.sunColour,
      skyColour: this.skyColour,
      sunIntensity: this.sunIntensity,
      moonIntensity: this.moonIntensity,
      ambientIntensity: this.ambientIntensity,
      darkness: this.darkness,
      isNight: this.isNight,
      needsArtificialLight: this.needsArtificialLight,
    };
  }

  serialize() {
    return { timeOfDay: this.#time };
  }

  restore(data) {
    if (data?.timeOfDay !== undefined) this.setTimeOfDay(data.timeOfDay);
  }
}
