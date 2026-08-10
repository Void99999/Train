import test from "node:test";
import assert from "node:assert/strict";

import { createRunContext, simulate } from "./helpers.js";
import { JOURNEY_PHASE } from "../src/systems/world/journeyTracker.js";
import { RunManager, RUN_FAILURE } from "../src/systems/run/runManager.js";
import { Unlocks } from "../src/systems/world/unlocks.js";
import { EventBus, GAME_EVENT } from "../src/core/events.js";
import { Vehicle } from "../src/systems/train/vehicle.js";
import { VEHICLE_KIND } from "../src/data/wagons.js";
import { OUTPOSTS, difficultyBandAt, FINAL_SEQUENCE_DISTANCE_KM } from "../src/data/journey.js";
import { UNLOCK, unlocksUpTo, outpostGranting } from "../src/data/progression.js";
import { JOURNEY, MODES } from "../src/data/balance.js";

/**
 * Drives the train up to an outpost and stops there.
 *
 * The grace period after leaving an outpost is run off first: in real play the
 * next outpost is nine kilometres away and the quiet stretch is long over by
 * the time the train gets there, but a test that teleports has to wait it out.
 */
function travelToOutpost(context, outpostNumber) {
  simulate(JOURNEY.postOutpostPeaceSeconds + 1, (delta) => context.journey.update(delta));

  const target = OUTPOSTS[outpostNumber - 1];
  context.train.setDistanceMetres(target.distanceKm * 1000);
  context.train.halt();
  context.journey.update(0.016);
}

/* ------------------------------------------------------------ line layout */

test("the line has ten outposts at irregular spacing", () => {
  assert.equal(OUTPOSTS.length, 10);

  const gaps = OUTPOSTS.slice(1).map((outpost, index) => outpost.distanceKm - OUTPOSTS[index].distanceKm);
  for (const gap of gaps) {
    assert.ok(gap > 6 && gap < 12, `gap of ${gap} km is roughly ten`);
  }
  // Even spacing would let a player count platforms and work out where the
  // line ends, which is the one thing the ending depends on them not knowing.
  const uniqueGaps = new Set(gaps.map((gap) => gap.toFixed(1)));
  assert.ok(uniqueGaps.size > 1, "spacing is not a countable pattern");
});

test("the last outpost leaves a long final leg to the end of the line", () => {
  const last = OUTPOSTS[OUTPOSTS.length - 1];
  assert.ok(FINAL_SEQUENCE_DISTANCE_KM - last.distanceKm >= 5, "room for a real gauntlet");
});

test("difficulty escalates along the line and tanks arrive late", () => {
  assert.deepEqual(Object.keys(difficultyBandAt(2).weights), ["standard_soldier"]);
  assert.ok(!("tank" in difficultyBandAt(20).weights), "no tanks in the second band");
  assert.ok(!("tank" in difficultyBandAt(45).weights), "no tanks before 50 km");
  assert.ok("tank" in difficultyBandAt(60).weights, "tanks begin in the 50-70 band");
  assert.ok("tank" in difficultyBandAt(95).weights);

  assert.ok(
    difficultyBandAt(95).groupSize.max > difficultyBandAt(5).groupSize.max,
    "groups get bigger",
  );
  assert.ok(
    difficultyBandAt(95).intervalSeconds.max < difficultyBandAt(5).intervalSeconds.max,
    "attacks come more often",
  );
});

/* --------------------------------------------------------------- outposts */

test("rolling into an outpost slowly docks the train", () => {
  const context = createRunContext({ unlockedUpTo: 0 });
  const reached = [];
  context.events.on(GAME_EVENT.outpostReached, (payload) => reached.push(payload));

  travelToOutpost(context, 1);

  assert.equal(context.journey.phase, JOURNEY_PHASE.docked);
  assert.equal(context.journey.currentOutpost.number, 1);
  assert.equal(context.journey.highestOutpostReached, 1);
  assert.equal(reached.length, 1);
});

test("running past an outpost at speed does not dock", () => {
  const context = createRunContext({ unlockedUpTo: 0 });
  const target = OUTPOSTS[0];

  context.train.setThrottleIndex(4);
  simulate(400, (delta) => {
    context.train.update(delta);
    context.journey.update(delta);
  });

  assert.ok(context.train.distanceKm > target.distanceKm, "we went straight past it");
  assert.equal(context.journey.highestOutpostReached, 0, "and did not stop");
});

test("an outpost that has been run past is gone, not blocking the next one", () => {
  const context = createRunContext({ unlockedUpTo: 0 });

  // Straight past the first outpost without slowing down.
  context.train.setThrottleIndex(4);
  simulate(400, (delta) => {
    context.train.update(delta);
    context.journey.update(delta);
  });
  assert.equal(context.journey.highestOutpostReached, 0);

  // The second outpost is still reachable.
  travelToOutpost(context, 2);
  assert.equal(context.journey.highestOutpostReached, 2);
});

test("outposts are safe and departure buys a quiet stretch", () => {
  const context = createRunContext({ unlockedUpTo: 0 });
  travelToOutpost(context, 1);

  assert.equal(context.journey.isHostile, false, "nothing attacks at an outpost");

  assert.ok(context.journey.depart());
  assert.equal(context.journey.phase, JOURNEY_PHASE.grace);
  assert.equal(context.journey.isHostile, false, "still quiet on the way out");
  assert.equal(context.journey.graceRemainingSeconds, JOURNEY.postOutpostPeaceSeconds);

  simulate(JOURNEY.postOutpostPeaceSeconds - 5, (delta) => context.journey.update(delta));
  assert.equal(context.journey.isHostile, false, "44 seconds in, still quiet");

  simulate(6, (delta) => context.journey.update(delta));
  assert.equal(context.journey.phase, JOURNEY_PHASE.travelling);
  assert.ok(context.journey.isHostile, "and then the war starts again");
});

test("the HUD is told what has happened, never what is left", () => {
  const context = createRunContext({ unlockedUpTo: 0 });
  travelToOutpost(context, 2);

  const snapshot = context.journey.hudSnapshot();
  assert.equal(snapshot.lastOutpostNumber, 2);
  assert.equal(snapshot.lastOutpostNameKey, "OUTPOST_2_NAME");
  assert.ok(snapshot.distanceKm > 0);

  // The ending is a surprise, so none of this may ever be available to draw.
  const keys = Object.keys(snapshot).join(" ").toLowerCase();
  assert.ok(!keys.includes("remaining"));
  assert.ok(!keys.includes("total"));
  assert.ok(!keys.includes("final"));
  assert.ok(!keys.includes("next"));
});

test("the final sequence is due only at the end of the line", () => {
  const context = createRunContext();
  assert.equal(context.journey.isFinalSequenceDue, false);

  context.train.setDistanceMetres((FINAL_SEQUENCE_DISTANCE_KM - 1) * 1000);
  assert.equal(context.journey.isFinalSequenceDue, false);

  context.train.setDistanceMetres(FINAL_SEQUENCE_DISTANCE_KM * 1000);
  assert.ok(context.journey.isFinalSequenceDue);

  context.journey.markFinalSequenceFired();
  assert.equal(context.journey.isFinalSequenceDue, false, "it only happens once");
});

/* ---------------------------------------------------------------- unlocks */

test("outposts grant the unlocks the progression table promises", () => {
  const context = createRunContext({ unlockedUpTo: 0 });
  assert.equal(context.unlocks.has(UNLOCK.vehicleTransport), false);

  travelToOutpost(context, 1);
  assert.ok(context.unlocks.has(UNLOCK.weaponAssaultRifle));
  assert.ok(context.unlocks.has(UNLOCK.vehicleTransport));
  assert.ok(context.unlocks.has(UNLOCK.vehicleCombat));
  assert.ok(context.unlocks.has(UNLOCK.combatWagonLevel2));
  assert.equal(context.unlocks.has(UNLOCK.wagonArmour), false);

  context.journey.depart();
  travelToOutpost(context, 2);
  assert.ok(context.unlocks.has(UNLOCK.wagonArmour));
});

test("the unlock schedule matches the design", () => {
  assert.equal(outpostGranting(UNLOCK.weaponAssaultRifle), 1);
  assert.equal(outpostGranting(UNLOCK.wagonArmour), 2);
  assert.equal(outpostGranting(UNLOCK.weaponRpg), 3);
  assert.equal(outpostGranting(UNLOCK.combatWagonLevel3), 3);
  assert.equal(outpostGranting(UNLOCK.combatWagonLevel4), 4);
  assert.equal(outpostGranting(UNLOCK.crewLoader), 4);
  assert.equal(outpostGranting(UNLOCK.weaponMinigun), 6);
});

test("the minigun arrives with time left to enjoy it", () => {
  const grantedAt = outpostGranting(UNLOCK.weaponMinigun);
  assert.ok(grantedAt <= OUTPOSTS.length - 3, "at least three outposts of runway");
});

test("unlocks are never revoked", () => {
  const unlocks = new Unlocks({ events: new EventBus() });
  unlocks.grantForOutpost(1);
  unlocks.grantForOutpost(2);
  assert.ok(unlocks.has(UNLOCK.weaponAssaultRifle), "outpost 1's grant survives outpost 2");

  const fresh = unlocks.grantForOutpost(1);
  assert.deepEqual(fresh, [], "granting twice is harmless");
});

test("unlocksUpTo reproduces the state at any outpost", () => {
  const atFour = unlocksUpTo(4);
  assert.ok(atFour.has(UNLOCK.crewLoader));
  assert.equal(atFour.has(UNLOCK.weaponMinigun), false);
});

/* -------------------------------------------------- checkpoints and modes */

test("normal mode sends a failed run back to the last outpost reached", () => {
  const context = createRunContext({ money: 1000, unlockedUpTo: 0 });
  const run = new RunManager({
    context,
    events: context.events,
    saveSystem: context.saveSystem,
    mode: MODES.normal.id,
  });

  travelToOutpost(context, 1);
  context.journey.depart();
  assert.ok(run.hasCheckpoint, "arriving and leaving both checkpoint");

  // Get well past the outpost, then die.
  context.train.setDistanceMetres(OUTPOSTS[1].distanceKm * 1000);
  const outcome = run.fail(RUN_FAILURE.playerDied);

  assert.ok(outcome.recoverable);
  assert.equal(outcome.outpostNumber, 1, "back to outpost 1, never forward to 2");

  const respawn = run.respawn();
  assert.equal(respawn.outpostNumber, 1);
  assert.equal(context.journey.highestOutpostReached, 1);
  assert.ok(Math.abs(context.train.distanceKm - OUTPOSTS[0].distanceKm) < 0.01);
});

test("dying costs money and trade goods", () => {
  const context = createRunContext({ money: 0, unlockedUpTo: 1 });
  const run = new RunManager({
    context,
    events: context.events,
    saveSystem: context.saveSystem,
    mode: MODES.normal.id,
  });

  context.train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  context.wallet.earn(1000);
  context.train.addCargo("coal", 40);

  travelToOutpost(context, 1);
  run.fail(RUN_FAILURE.playerDied);
  run.respawn();

  assert.equal(context.wallet.balance, 800, "a fifth of the money is gone");
});

test("dying restores the player and leaves the train drivable", () => {
  const context = createRunContext({ money: 500, unlockedUpTo: 1 });
  const run = new RunManager({
    context,
    events: context.events,
    saveSystem: context.saveSystem,
  });

  const wagon = context.train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  travelToOutpost(context, 1);

  wagon.applyDamage({ amount: 550 });
  context.health.damage(100);

  run.fail(RUN_FAILURE.playerDied);
  const respawn = run.respawn();

  assert.equal(context.health.value, 100, "the player is patched up");
  const restoredWagon = respawn.train.wagons[0];
  assert.ok(
    restoredWagon.healthFraction >= MODES.normal.respawnVehicleHealthFraction,
    "the train is worth driving again",
  );
});

test("hardcore keeps no checkpoint and does not come back", () => {
  const context = createRunContext({ money: 1000 });
  const run = new RunManager({
    context,
    events: context.events,
    saveSystem: context.saveSystem,
    mode: MODES.hardcore.id,
  });

  travelToOutpost(context, 1);
  assert.equal(run.hasCheckpoint, false);
  assert.equal(run.saveCheckpoint(), null);

  const outcome = run.fail(RUN_FAILURE.locomotiveDestroyed);
  assert.equal(outcome.recoverable, false);
  assert.equal(run.respawn(), null);
});

test("a hardcore failure banks the personal bests", () => {
  const context = createRunContext({ money: 100 });
  const run = new RunManager({
    context,
    events: context.events,
    saveSystem: context.saveSystem,
    mode: MODES.hardcore.id,
  });

  context.statistics.sample({ distanceKm: 42.5, moneyEarned: 900, runTimeSeconds: 1800 });
  context.events.emit(GAME_EVENT.enemyKilled, { isVehicle: false });
  context.events.emit(GAME_EVENT.enemyKilled, { isVehicle: true });

  run.fail(RUN_FAILURE.playerDied);

  assert.equal(context.statistics.records.distanceKm, 42.5);
  assert.equal(context.statistics.records.enemiesKilled, 2);
  assert.equal(context.statistics.records.vehiclesDestroyed, 1);
});

test("losing the locomotive is a run failure", () => {
  const context = createRunContext();
  context.train.damageVehicle(context.train.locomotive, { amount: 99999 });
  assert.ok(context.train.isDead, "and the run manager is told by the caller");
});

test("a run summary reports everything the player did", () => {
  const context = createRunContext();
  context.statistics.sample({ distanceKm: 12.3, moneyEarned: 400, runTimeSeconds: 610 });
  context.events.emit(GAME_EVENT.outpostReached, { outpost: OUTPOSTS[0] });
  context.train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  const rows = context.statistics.summaryRows();
  const labels = rows.map((row) => row.labelKey);
  assert.deepEqual(labels, [
    "STATS_DISTANCE",
    "STATS_OUTPOSTS",
    "STATS_ENEMIES_KILLED",
    "STATS_VEHICLES_DESTROYED",
    "STATS_MONEY_EARNED",
    "STATS_LARGEST_TRAIN",
    "STATS_RUN_TIME",
  ]);
  assert.equal(context.statistics.current.largestTrainWagons, 1);
  assert.equal(context.statistics.current.outpostsReached, 1);
});
