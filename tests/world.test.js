import test from "node:test";
import assert from "node:assert/strict";

import { DayNightCycle, PHASE } from "../src/systems/world/dayNight.js";
import { WORLD } from "../src/data/balance.js";

test("a full cycle takes about forty minutes", () => {
  const cycle = new DayNightCycle({ startTimeOfDay: 0 });
  cycle.update(WORLD.dayLengthSeconds);
  assert.ok(Math.abs(cycle.timeOfDay) < 1e-9, "back where it started");
  assert.equal(WORLD.dayLengthSeconds, 40 * 60);
});

test("the cycle passes through every phase in order", () => {
  const cycle = new DayNightCycle({ startTimeOfDay: 0 });
  const seen = [];

  for (let i = 0; i < 2000; i += 1) {
    cycle.update(WORLD.dayLengthSeconds / 2000);
    const phase = cycle.phase;
    if (seen[seen.length - 1] !== phase) seen.push(phase);
  }

  assert.deepEqual(seen, [
    PHASE.night,
    PHASE.dawn,
    PHASE.morning,
    PHASE.midday,
    PHASE.afternoon,
    PHASE.sunset,
    PHASE.dusk,
    PHASE.night,
  ]);
});

test("day never snaps into night", () => {
  const cycle = new DayNightCycle({ startTimeOfDay: 0 });
  let previous = cycle.snapshot();
  let biggestJump = 0;

  for (let i = 0; i < 4000; i += 1) {
    cycle.update(WORLD.dayLengthSeconds / 4000);
    const current = cycle.snapshot();
    biggestJump = Math.max(biggestJump, Math.abs(current.darkness - previous.darkness));
    previous = current;
  }

  // Over a tenth of a second of game time, darkness must barely move.
  assert.ok(biggestJump < 0.02, `largest darkness step was ${biggestJump.toFixed(4)}`);
});

test("sky and light colours slide rather than switch", () => {
  const cycle = new DayNightCycle({ startTimeOfDay: 0 });
  const channel = (colour, shift) => (colour >> shift) & 255;
  let previous = cycle.skyColour;
  let biggestJump = 0;

  for (let i = 0; i < 3000; i += 1) {
    cycle.update(WORLD.dayLengthSeconds / 3000);
    const current = cycle.skyColour;
    for (const shift of [16, 8, 0]) {
      biggestJump = Math.max(biggestJump, Math.abs(channel(current, shift) - channel(previous, shift)));
    }
    previous = current;
  }

  assert.ok(biggestJump <= 3, `largest colour step was ${biggestJump}`);
});

test("the sun rises and sets, and the moon takes over", () => {
  const midday = new DayNightCycle({ startTimeOfDay: 0.5 });
  assert.ok(midday.sunElevation > 1.4, "sun overhead");
  assert.ok(midday.sunIntensity > 4);
  assert.equal(midday.isNight, false);
  assert.equal(midday.darkness, 0);
  assert.equal(midday.needsArtificialLight, false);

  const midnight = new DayNightCycle({ startTimeOfDay: 0 });
  assert.ok(midnight.sunElevation < -1.4, "sun well below the horizon");
  assert.equal(midnight.sunIntensity, 0);
  assert.ok(midnight.isNight);
  assert.equal(midnight.darkness, 1);
  assert.ok(midnight.moonIntensity > 0, "the moon is doing the work");
  assert.ok(midnight.needsArtificialLight, "headlights on");
});

test("night is dark but never unlit", () => {
  const midnight = new DayNightCycle({ startTimeOfDay: 0 });
  const midday = new DayNightCycle({ startTimeOfDay: 0.5 });

  // A pitch-black screen is not atmosphere, it is a bug report. The player has
  // to be able to read the cab and the shape of the land at three in the
  // morning, so ambient never falls to nothing.
  assert.ok(midnight.ambientIntensity > 0.35, "there is something to see");

  // It still has to be unmistakably night: no sun at all, and well under half
  // the light of midday once the directional contribution is counted.
  assert.equal(midnight.sunIntensity, 0);
  assert.ok(
    midnight.ambientIntensity < midday.ambientIntensity * 0.7,
    "but it still reads as night",
  );
  assert.ok(
    midnight.ambientIntensity + midnight.moonIntensity <
      midday.ambientIntensity + midday.sunIntensity,
    "and daylight is far brighter overall",
  );
});

test("shadows swing round over the day", () => {
  const morning = new DayNightCycle({ startTimeOfDay: 0.3 });
  const evening = new DayNightCycle({ startTimeOfDay: 0.7 });
  assert.notEqual(morning.sunAzimuth, evening.sunAzimuth);
});

test("the cycle survives a save round trip", () => {
  const cycle = new DayNightCycle({ startTimeOfDay: 0.1 });
  cycle.update(600);

  const restored = new DayNightCycle();
  restored.restore(cycle.serialize());
  assert.equal(restored.timeOfDay, cycle.timeOfDay);
});

test("time of day wraps rather than running off the end", () => {
  const cycle = new DayNightCycle({ startTimeOfDay: 0 });
  cycle.setTimeOfDay(1.25);
  assert.ok(Math.abs(cycle.timeOfDay - 0.25) < 1e-9);
  cycle.setTimeOfDay(-0.25);
  assert.ok(Math.abs(cycle.timeOfDay - 0.75) < 1e-9);
});
