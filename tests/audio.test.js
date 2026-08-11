import test from "node:test";
import assert from "node:assert/strict";

import { locomotiveMix } from "../src/audio/trainAudio.js";
import { createSoundLibrary } from "../src/audio/soundLibrary.js";

/** The four throttle notches the driver can actually select. */
const NOTCHES = [0.25, 0.5, 0.75, 1];

/** Total continuous level of the engine bed, before the train bus scales it. */
function bedLevel(mix) {
  return mix.rumble.gain + mix.exhaust.gain + mix.fundamental.gain;
}

/** Everything that plays continuously, engine bed plus rolling stock. */
function continuousLevel(mix) {
  return bedLevel(mix) + mix.rolling.gain + mix.wind.gain + mix.frame.gain;
}

test("every throttle notch sounds different from the one below it", () => {
  const mixes = NOTCHES.map((throttleFraction) =>
    locomotiveMix({ throttleFraction, speedFraction: throttleFraction, moving: true }),
  );

  for (let i = 1; i < mixes.length; i += 1) {
    const previous = mixes[i - 1];
    const current = mixes[i];

    // Brightness is the main cue and has to move clearly - a tenth of an
    // octave would be inaudible on a noise source.
    assert.ok(
      current.exhaust.cutoff > previous.exhaust.cutoff * 1.15,
      `notch ${i + 1} is audibly brighter than notch ${i}`,
    );
    assert.ok(current.rumble.cutoff > previous.rumble.cutoff, "and the block opens up");
    assert.ok(current.fundamental.frequency > previous.fundamental.frequency, "and sits higher");
    assert.ok(current.rattlesPerSecond > previous.rattlesPerSecond, "and shakes more");
    assert.ok(bedLevel(current) > bedLevel(previous), "and is somewhat louder");
  }
});

test("full power is not four times as loud as the first notch", () => {
  // The user's complaint was a train that becomes painfully loud. The notches
  // must be tellable apart by timbre; level is the small part of the change.
  const quiet = locomotiveMix({ throttleFraction: 0.25, speedFraction: 0.25, moving: true });
  const loud = locomotiveMix({ throttleFraction: 1, speedFraction: 1, moving: true });

  const ratio = bedLevel(loud) / bedLevel(quiet);
  assert.ok(ratio > 1.4, `full power is clearly bigger (was ${ratio.toFixed(2)}x)`);
  assert.ok(ratio < 2.2, `but not overwhelming (was ${ratio.toFixed(2)}x)`);
});

test("the engine bed never gets loud enough to swamp an explosion", () => {
  // Bus levels: train 0.5, weapons 1. An explosion's loudest layer is at 1.
  // The continuous bed at its absolute worst must stay well under that, or
  // the mix is the one the user described - a wall of train with gunfire
  // somewhere behind it.
  const worst = locomotiveMix({ throttleFraction: 1, speedFraction: 1, moving: true, inside: true });
  const bedAfterBus = continuousLevel(worst) * 0.5;

  assert.ok(bedAfterBus < 0.3, `bed sits low in the mix (was ${bedAfterBus.toFixed(3)})`);
});

test("a stopped train idles rather than falling silent", () => {
  const idle = locomotiveMix({ throttleFraction: 0, speedFraction: 0, moving: false });

  assert.ok(idle.rumble.gain > 0, "the engine is still running");
  assert.equal(idle.rolling.gain, 0, "but nothing is rolling");
  assert.equal(idle.wind.gain, 0, "and there is no wind");
  assert.equal(idle.rattlesPerSecond, 0, "and nothing is shaking");
});

test("rolling and wind follow speed, not the throttle", () => {
  // Opening the throttle at a stand must not make wheel noise appear. That
  // gap between the engine taking up load and the speed arriving is most of
  // what makes a heavy train feel heavy.
  const openedAtRest = locomotiveMix({ throttleFraction: 1, speedFraction: 0, moving: false });
  assert.equal(openedAtRest.rolling.gain, 0);
  assert.ok(openedAtRest.exhaust.cutoff > 600, "but the engine responds immediately");

  const coasting = locomotiveMix({ throttleFraction: 0, speedFraction: 1, moving: true });
  assert.ok(coasting.rolling.gain > 0.15, "and wheel noise is there without power");
});

test("stepping outside opens up the high end", () => {
  const inside = locomotiveMix({ throttleFraction: 1, speedFraction: 1, moving: true, inside: true });
  const outside = locomotiveMix({ throttleFraction: 1, speedFraction: 1, moving: true, inside: false });

  assert.ok(outside.wind.gain > inside.wind.gain * 2, "wind hits you in the doorway");
  assert.ok(outside.rolling.cutoff > inside.rolling.cutoff, "and the wheels are not muffled");
  assert.ok(outside.frame.gain < inside.frame.gain, "while the frame is an interior sound");
});

test("nothing in the continuous bed is a plain oscillator except the sub", () => {
  // A periodic waveform under a lowpass is what produced the repetitive car
  // engine sound. Only the sine is allowed, because a sine has no harmonics
  // to buzz.
  const mix = locomotiveMix({ throttleFraction: 1, speedFraction: 1, moving: true });
  assert.ok(mix.fundamental.frequency < 60, "the sub stays below the range where it reads as a pitch");
  assert.ok(mix.fundamental.gain < mix.rumble.gain, "and never outweighs the noise it supports");
});

test("the catalogue has every sound the train drives", () => {
  const sounds = createSoundLibrary(() => 0.5);
  for (const name of ["rail_clack", "panel_rattle", "metal_stress", "explosion"]) {
    assert.equal(typeof sounds[name], "function", `${name} exists`);
  }
});
