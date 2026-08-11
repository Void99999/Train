import "./domStub.js";

import test from "node:test";
import assert from "node:assert/strict";

import * as THREE from "../vendor/three/three.module.js";
import { buildLocomotiveCab, cabDimensions, throttleQuadrant } from "../src/render/interiors.js";
import { CinematicStage } from "../src/render/cinematicStage.js";
import { World } from "../src/render/world.js";
import { Train } from "../src/systems/train/train.js";
import { overlaps } from "../src/systems/world/collision.js";
import { boardingPath, throttleReachPose } from "../src/cinematics/introSequence.js";

/** The locomotive's real dimensions, from src/data/wagons.js. */
const LOCOMOTIVE_SIZE = { length: 12.5, width: 3.1, height: 4.2 };

const cab = cabDimensions(LOCOMOTIVE_SIZE);

function cabColliders() {
  return buildLocomotiveCab(LOCOMOTIVE_SIZE).colliders;
}

/** The hand prop, posed, with its true world bounds. */
function handBoundsAt(stage, t) {
  const pose = throttleReachPose(t, cab);
  stage.hand.position.set(pose.position.x, pose.position.y, pose.position.z);
  stage.hand.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
  stage.hand.updateWorldMatrix(true, true);
  return { pose, box: new THREE.Box3().setFromObject(stage.hand) };
}

test("the arm never passes through the driver's console", () => {
  /*
   * Measured, not reasoned about. Two previous attempts at this bug moved the
   * hand along a path that looked right on paper and left the forearm buried
   * in the desk, because the arm was never checked - only the hand was. This
   * walks the whole movement against the console's actual collider and the
   * hand prop's actual geometry.
   */
  const stage = new CinematicStage({ scene: new THREE.Scene() });
  const desk = cabColliders().find((collider) => collider.tag === "cab-console");
  assert.ok(desk, "the console has a collider to test against");

  let worst = { clearance: Infinity, t: 0 };

  for (let step = 0; step <= 400; step += 1) {
    const t = step / 400;
    const { box } = handBoundsAt(stage, t);

    const overDesk =
      box.min.x < desk.maxX &&
      box.max.x > desk.minX &&
      box.min.z < desk.maxZ &&
      box.max.z > desk.minZ;
    if (!overDesk) continue;

    const clearance = box.min.y - desk.maxY;
    if (clearance < worst.clearance) worst = { clearance, t };
  }

  assert.ok(
    worst.clearance > 0.05,
    `the lowest part of the arm stays clear of the desk ` +
      `(closest was ${worst.clearance.toFixed(3)} m at t=${worst.t.toFixed(2)})`,
  );
});

test("the arm stays inside the cab throughout the reach", () => {
  const stage = new CinematicStage({ scene: new THREE.Scene() });

  for (let step = 0; step <= 100; step += 1) {
    const { box } = handBoundsAt(stage, step / 100);
    assert.ok(box.min.x > -cab.innerHalfWidth, "not through the left wall");
    assert.ok(box.max.x < cab.innerHalfWidth, "not through the right wall");
    assert.ok(box.min.y > cab.floorY, "not through the floor");
    assert.ok(box.max.y < cab.ceilingY, "not through the roof");
    assert.ok(box.max.z < cab.frontZ, "not through the front bulkhead");
  }
});

test("the hand ends up holding the lever at full power", () => {
  const quadrant = throttleQuadrant(cab);
  const end = throttleReachPose(1, cab);

  assert.equal(end.notch, 4, "full power");
  assert.ok(Math.abs(end.position.x - quadrant.notchX(4)) < 0.01, "at the last notch");
  assert.ok(
    Math.abs(end.position.y - (quadrant.slotY + quadrant.knobOffset.y)) < 0.01,
    "and on the knob, not on the desk",
  );
});

test("the lever travels the whole quadrant rather than jumping", () => {
  // A control that snaps from idle to full teaches the player nothing. The
  // notch has to move continuously so each setting lights as it is passed.
  const seen = [];
  for (let step = 0; step <= 100; step += 1) {
    seen.push(throttleReachPose(step / 100, cab).notch);
  }

  assert.equal(seen[0], 0, "starts at idle");
  assert.equal(seen.at(-1), 4, "ends at full power");

  for (let i = 1; i < seen.length; i += 1) {
    assert.ok(seen[i] >= seen[i - 1], "never goes backwards");
    assert.ok(seen[i] - seen[i - 1] < 0.6, "and never jumps a notch and a half");
  }

  // Every setting is passed through, so every lamp lights in turn.
  for (const notch of [1, 2, 3]) {
    assert.ok(
      seen.some((value) => Math.abs(value - notch) < 0.1),
      `the lever passes ${notch * 25} per cent`,
    );
  }
});

test("the hand starts at his side, below the desk and clear of it", () => {
  const start = throttleReachPose(0, cab);
  const quadrant = throttleQuadrant(cab);
  const desk = cabColliders().find((collider) => collider.tag === "cab-console");

  // Behind the console rather than over it, and low - so the shot opens on an
  // empty desk and the arm comes up into frame.
  assert.ok(start.position.z < desk.minZ, `behind the desk (z=${start.position.z.toFixed(2)})`);
  assert.ok(start.position.y < quadrant.deskTopY, "and below its surface");
  assert.equal(start.gripped, false);
});

test("the cab and the cinematic agree about where the quadrant is", () => {
  /*
   * The reach used to carry its own copy of the quadrant's coordinates. Two
   * sets of numbers that have to match by hand is how a hand ends up reaching
   * for a control that is not there any more.
   */
  const quadrant = throttleQuadrant(cab);
  const { group } = buildLocomotiveCab(LOCOMOTIVE_SIZE);

  let lever = null;
  group.traverse((node) => {
    if (node.name === "throttle-lever") lever = node;
  });
  assert.ok(lever, "the cab has a throttle lever");

  assert.ok(Math.abs(lever.position.x - quadrant.notchX(0)) < 1e-9, "parked at idle");
  assert.ok(Math.abs(lever.position.y - quadrant.slotY) < 1e-9, "pivoting in the slot");
  assert.ok(Math.abs(lever.position.z - quadrant.z) < 1e-9, "on the quadrant");
});

/* ------------------------------------------------------- climbing aboard */

function boardedWorld({ doorOpen = true } = {}) {
  const world = new World({ quality: { shadows: false, shadowMapSize: 512 } });
  const train = new Train();
  world.syncTrain(train);

  world.setSideDoorOpen("right", doorOpen);
  for (let i = 0; i < 60; i += 1) world.update(0.05, 0, {}, 0);

  return world;
}

/** Everything the camera brushes against on its way in, by collider tag. */
function obstaclesAlongBoarding(world, { probeRadius = 0.08 } = {}) {
  const hit = new Set();

  for (let step = 0; step <= 400; step += 1) {
    const eye = boardingPath(step / 400, cab).eye;
    const probe = {
      minX: eye.x - probeRadius, maxX: eye.x + probeRadius,
      minY: eye.y - probeRadius, maxY: eye.y + probeRadius,
      minZ: eye.z - probeRadius, maxZ: eye.z + probeRadius,
    };
    for (const collider of world.colliders.boxes) {
      if (overlaps(probe, collider)) hit.add(collider.tag);
    }
  }

  return [...hit];
}

test("climbing aboard does not pass through the train", () => {
  /*
   * The reported bug: the player clips through the wall on the way into the
   * cab. The old path moved inward and forward at once and cut the corner
   * through the jamb - and once there was a walkway railing outside, through
   * that as well. This checks the whole path against every collider the
   * locomotive has.
   */
  const world = boardedWorld();
  const hit = obstaclesAlongBoarding(world);

  assert.deepEqual(hit, [], `nothing in the way (hit: ${hit.join(", ") || "nothing"})`);
});

test("the door has to be open for him to climb in - and the intro opens it", () => {
  // Proof that the path really does go through the doorway rather than
  // somewhere the door happens not to be.
  const shut = boardedWorld({ doorOpen: false });
  const hit = obstaclesAlongBoarding(shut);

  assert.ok(
    hit.includes("cab-side-door-right"),
    "with the door shut he would walk into it, which is what the door is for",
  );
});

test("the boarding path never moves diagonally through a surface", () => {
  // The shape of the fix: each leg changes height, or crosses the hull, or
  // walks up the cab - never two of those at once.
  const samples = [];
  for (let step = 0; step <= 200; step += 1) samples.push(boardingPath(step / 200, cab).eye);

  for (let i = 1; i < samples.length; i += 1) {
    const previous = samples[i - 1];
    const current = samples[i];
    const moved = [
      Math.abs(current.x - previous.x) > 1e-6,
      Math.abs(current.y - previous.y) > 1e-6,
      Math.abs(current.z - previous.z) > 1e-6,
    ].filter(Boolean).length;

    // One axis at a time, except at the two joins between legs.
    assert.ok(moved <= 2, "never all three at once");
  }
});

test("he ends up at the controls, on the cab floor", () => {
  const end = boardingPath(1, cab).eye;

  assert.ok(Math.abs(end.x) < cab.innerHalfWidth, "inside the cab");
  assert.ok(Math.abs(end.y - (cab.floorY + 1.68)) < 0.01, "standing on the floor at eye height");
  assert.ok(end.z > cab.backZ && end.z < cab.frontZ, "and in the cab's length");
});

test("he starts outside the train, on the ground", () => {
  // Where the walk-up shot hands over to the climb.
  const start = boardingPath(0, cab).eye;

  assert.ok(start.x > cab.outerHalfWidth, "outside the hull");
  assert.ok(Math.abs(start.y - 1.68) < 0.01, "standing on the ballast, not on the deck");
});
