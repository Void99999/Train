import "./domStub.js";

import test from "node:test";
import assert from "node:assert/strict";

import { World } from "../src/render/world.js";
import { Train } from "../src/systems/train/train.js";
import { cabDimensions, sideDoorLayout } from "../src/render/interiors.js";
import { moveBody } from "../src/systems/world/collision.js";

/** The player's collision volume, from playerController.js. */
const BODY = { radius: 0.32, height: 1.8, stepHeight: 0.35 };

function setUp() {
  const world = new World({ quality: { shadows: false, shadowMapSize: 512 } });
  const train = new Train();
  world.syncTrain(train);

  const cab = cabDimensions(train.locomotive.spec.size);
  return { world, train, cab, doorway: sideDoorLayout(cab) };
}

/** Runs the door animation to completion. */
function settleDoors(world) {
  for (let i = 0; i < 60; i += 1) world.update(0.05, 0, {}, 0);
}

/**
 * Walks a body towards a point the way the controller would: small steps,
 * with gravity, resolving against the world.
 */
function walkTo(from, to, colliders, { steps = 400 } = {}) {
  const position = { ...from };

  for (let i = 0; i < steps; i += 1) {
    const dx = to.x - position.x;
    const dz = to.z - position.z;
    const remaining = Math.hypot(dx, dz);
    if (remaining < 0.02) break;

    const step = Math.min(0.04, remaining);
    moveBody(
      position,
      { x: (dx / remaining) * step, y: -0.05, z: (dz / remaining) * step },
      colliders,
      BODY,
    );
  }

  return position;
}

test("each side wall has a real opening rather than a panel stuck to it", () => {
  const { world } = setUp();
  const tags = world.colliders.boxes.map((box) => box.tag);

  for (const side of ["left", "right"]) {
    // The wall is in pieces around the hole, not one slab across the whole side.
    assert.ok(tags.includes(`cab-wall-${side}-rear`), `${side} wall behind the door`);
    assert.ok(tags.includes(`cab-wall-${side}-front`), `${side} wall ahead of the door`);
    assert.ok(tags.includes(`cab-wall-${side}-header`), `${side} wall over the door`);
    assert.ok(tags.includes(`cab-side-door-${side}`), `${side} door leaf`);
  }
});

test("both doors can be opened and closed, and say so", () => {
  const { world } = setUp();

  for (const side of ["left", "right"]) {
    const prompt = () => world.interactables.find((item) => item.id === `side-door-${side}`).promptKey;
    const leaf = () => world.colliders.boxes.find((box) => box.tag === `cab-side-door-${side}`);

    assert.equal(world.isSideDoorOpen(side), false, "shut to begin with");
    assert.equal(prompt(), "PROMPT_OPEN_DOOR");
    assert.equal(leaf().enabled, true, "and solid");

    world.setSideDoorOpen(side, true);
    settleDoors(world);
    assert.equal(world.isSideDoorOpen(side), true);
    assert.equal(prompt(), "PROMPT_CLOSE_DOOR");
    assert.equal(leaf().enabled, false, "and no longer in the way");

    world.setSideDoorOpen(side, false);
    settleDoors(world);
    assert.equal(world.isSideDoorOpen(side), false);
    assert.equal(prompt(), "PROMPT_OPEN_DOOR");
    assert.equal(leaf().enabled, true, "solid again");
  }
});

test("the leaf actually slides out of the doorway", () => {
  const { world, doorway } = setUp();
  const slide = world.findInTrain("cab-side-door-left-slide");
  assert.ok(slide, "the door has a moving part");

  assert.ok(Math.abs(slide.position.z) < 1e-9, "shut, it fills the opening");

  world.setSideDoorOpen("left", true);
  settleDoors(world);
  assert.ok(
    Math.abs(slide.position.z + doorway.travel) < 0.001,
    "open, it has travelled clear of the opening",
  );
  assert.ok(doorway.travel >= doorway.width, "far enough to leave the whole doorway free");
});

test("a shut door stops the player walking out of the train", () => {
  const { world, cab, doorway } = setUp();

  for (const [side, direction] of [["left", -1], ["right", 1]]) {
    const start = { x: direction * 0.9, y: cab.floorY, z: doorway.centreZ };
    const ended = walkTo(start, { x: direction * 3, y: 0, z: doorway.centreZ }, world.colliders);

    assert.ok(
      Math.abs(ended.x) < cab.innerHalfWidth,
      `${side}: still inside the cab (stopped at x=${ended.x.toFixed(2)})`,
    );
  }
});

test("an open door lets the player out onto the walkway, at the same height", () => {
  const { world, cab, doorway } = setUp();

  for (const [side, direction] of [["left", -1], ["right", 1]]) {
    world.setSideDoorOpen(side, true);
    settleDoors(world);

    const start = { x: direction * 0.9, y: cab.floorY, z: doorway.centreZ };
    const ended = walkTo(start, { x: direction * 3, y: 0, z: doorway.centreZ }, world.colliders);

    assert.ok(
      Math.abs(ended.x) > cab.outerHalfWidth,
      `${side}: through the doorway and out (x=${ended.x.toFixed(2)})`,
    );
    // Not a drop and not a hole: the deck is level with the cab floor.
    assert.ok(
      Math.abs(ended.y - doorway.walkway.topY) < 0.01,
      `${side}: standing on the deck, not fallen through it (y=${ended.y.toFixed(2)})`,
    );
  }
});

test("the walkway is wide enough to move about on", () => {
  const { world, cab, doorway } = setUp();
  world.setSideDoorOpen("left", true);
  settleDoors(world);

  const outside = walkTo(
    { x: -0.9, y: cab.floorY, z: doorway.centreZ },
    { x: -3, y: 0, z: doorway.centreZ },
    world.colliders,
  );

  // Push outward against the railing, then inward against the hull, and see
  // how much room there was between the two.
  const atRailing = walkTo(outside, { x: -6, y: 0, z: outside.z }, world.colliders);
  const atHull = walkTo(atRailing, { x: 0, y: 0, z: outside.z }, world.colliders);

  const room = Math.abs(atRailing.x - atHull.x);
  assert.ok(room > 0.15, `there is room to move across the deck (${room.toFixed(2)} m)`);
  assert.ok(atRailing.y > 1, "and the railing held rather than dropping him off the side");
});

test("the player can walk the length of the train outside and come back in", () => {
  const { world, cab, doorway } = setUp();
  world.setSideDoorOpen("left", true);
  settleDoors(world);

  const outside = walkTo(
    { x: -0.9, y: cab.floorY, z: doorway.centreZ },
    { x: -2.2, y: 0, z: doorway.centreZ },
    world.colliders,
  );

  // Forward along the hood, which is where you would go to shoot from.
  const forward = walkTo(outside, { x: outside.x, y: 0, z: 4 }, world.colliders, { steps: 800 });
  assert.ok(forward.z > 3, `made it forward along the deck (z=${forward.z.toFixed(2)})`);
  assert.ok(
    Math.abs(forward.y - doorway.walkway.topY) < 0.01,
    "without falling through anywhere along the way",
  );

  // Back to the door and inside again.
  const returned = walkTo(forward, { x: forward.x, y: 0, z: doorway.centreZ }, world.colliders, {
    steps: 800,
  });
  const inside = walkTo(returned, { x: 0, y: 0, z: doorway.centreZ }, world.colliders);

  assert.ok(Math.abs(inside.x) < 0.4, `back in the cab (x=${inside.x.toFixed(2)})`);
  assert.ok(Math.abs(inside.y - cab.floorY) < 0.01, "standing on the cab floor");
});

test("the walkway is railed off at both ends", () => {
  const { world, cab, doorway } = setUp();
  world.setSideDoorOpen("left", true);
  settleDoors(world);

  const outside = walkTo(
    { x: -0.9, y: cab.floorY, z: doorway.centreZ },
    { x: -2.2, y: 0, z: doorway.centreZ },
    world.colliders,
  );

  for (const target of [40, -40]) {
    const ended = walkTo(outside, { x: outside.x, y: 0, z: target }, world.colliders, {
      steps: 1500,
    });
    assert.ok(
      Math.abs(ended.z) < 7,
      `stopped at the end of the deck rather than walking off it (z=${ended.z.toFixed(2)})`,
    );
    assert.ok(ended.y > 1, "and still up on the train");
  }
});

test("the doors are usable at speed, not only at a stand", () => {
  // Nothing about the door depends on the train being stopped - it is worth a
  // test because it is the sort of restriction that gets added by accident.
  const { world, cab, doorway } = setUp();

  world.setSideDoorOpen("left", true);
  for (let i = 0; i < 60; i += 1) world.update(0.05, 22, {}, i * 0.05);

  assert.equal(world.isSideDoorOpen("left"), true);
  const ended = walkTo(
    { x: -0.9, y: cab.floorY, z: doorway.centreZ },
    { x: -2.2, y: 0, z: doorway.centreZ },
    world.colliders,
  );
  assert.ok(Math.abs(ended.x) > cab.outerHalfWidth, "still lets him out while running");
});
