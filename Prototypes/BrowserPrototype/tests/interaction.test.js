import test from "node:test";
import assert from "node:assert/strict";

import { InteractionSystem, distanceToBox, requiredAim } from "../src/systems/player/interaction.js";
import { Box } from "../src/systems/world/collision.js";

/** An interactable box centred at a point. */
function thing(id, centre, size = { x: 0.4, y: 0.4, z: 0.4 }) {
  return { id, promptKey: `PROMPT_${id.toUpperCase()}`, box: Box.fromCentre(centre, size) };
}

const eye = { x: 0, y: 1.7, z: 0 };
/** Looking along +z, which is how the player faces down the train. */
const forward = { x: 0, y: 0, z: 1 };

test("the aim cone widens as the player gets closer", () => {
  // Standing at a console, the control is below and to the side of the eye.
  // A fixed narrow cone makes it impossible to use the thing you are standing
  // at, which is exactly the bug this replaced.
  assert.ok(requiredAim(0.4) < requiredAim(2.4), "wider up close");
  assert.ok(requiredAim(0.4) < 0.65, "well over 45 degrees within arm's reach");
  assert.ok(requiredAim(2.4) > 0.85, "but tight at the far end of the range");
});

test("a control below the eye is usable from right in front of it", () => {
  const system = new InteractionSystem();
  // Eye at head height, quadrant low on a desk half a metre ahead - the exact
  // geometry that used to be unreachable.
  const closeEye = { x: 0.35, y: 3.03, z: -1.9 };
  const lookingDown = { x: 0, y: Math.sin(-0.25), z: Math.cos(-0.25) };

  const focused = system.update({
    eye: closeEye,
    forward: lookingDown,
    interactables: [thing("throttle", { x: -0.42, y: 2.53, z: -1.09 }, { x: 1.25, y: 0.4, z: 0.4 })],
  });

  assert.equal(focused?.id, "throttle");
});

test("distance is measured to the box, not to its centre", () => {
  const box = new Box(-2, 0, -2, 2, 2, 2);
  assert.equal(distanceToBox({ x: 0, y: 1, z: 0 }, box), 0, "inside is zero");
  assert.equal(distanceToBox({ x: 3, y: 1, z: 0 }, box), 1, "one metre outside the face");
});

test("something in front and within reach is focused", () => {
  const system = new InteractionSystem();
  const focused = system.update({
    eye,
    forward,
    interactables: [thing("console", { x: 0, y: 1.7, z: 1.2 })],
  });

  assert.equal(focused?.id, "console");
  assert.equal(system.focusedId, "console");
});

test("looking away clears the prompt even when standing right next to it", () => {
  const system = new InteractionSystem();
  const interactables = [thing("blueprint", { x: 0, y: 1.7, z: 1.0 })];

  assert.equal(system.update({ eye, forward, interactables })?.id, "blueprint");

  // Turn round. The object has not moved and is still close.
  const behind = { x: 0, y: 0, z: -1 };
  assert.equal(system.update({ eye, forward: behind, interactables }), null);
  assert.equal(system.focusedId, null);
});

test("looking at the floor clears the prompt", () => {
  const system = new InteractionSystem();
  const interactables = [thing("blueprint", { x: 0, y: 1.7, z: 1.0 })];

  const down = { x: 0, y: -1, z: 0 };
  assert.equal(system.update({ eye, forward: down, interactables }), null);
});

test("something out of reach is not focused however hard it is stared at", () => {
  const system = new InteractionSystem();
  const far = system.update({
    eye,
    forward,
    interactables: [thing("door", { x: 0, y: 1.7, z: 6 })],
  });
  assert.equal(far, null);
});

test("only one thing is focused, and it is the one nearest the centre of view", () => {
  const system = new InteractionSystem();
  const focused = system.update({
    eye,
    forward,
    interactables: [
      // Dead ahead.
      thing("throttle", { x: 0, y: 1.7, z: 1.2 }),
      // Also close and also in front, but off to one side.
      thing("blueprint", { x: 0.9, y: 1.7, z: 1.2 }),
    ],
  });

  assert.equal(focused.id, "throttle", "the one being looked at wins");
});

test("turning between two objects moves the focus", () => {
  const system = new InteractionSystem();
  const interactables = [
    thing("throttle", { x: 0, y: 1.7, z: 1.2 }),
    thing("blueprint", { x: 1.2, y: 1.7, z: 0.4 }),
  ];

  assert.equal(system.update({ eye, forward, interactables }).id, "throttle");

  const right = { x: 1, y: 0, z: 0 };
  assert.equal(system.update({ eye, forward: right, interactables }).id, "blueprint");
});

test("activate runs the registered action for the focused object", () => {
  const system = new InteractionSystem();
  const fired = [];
  system.register("throttle", () => fired.push("throttle"));
  system.register("blueprint", () => fired.push("blueprint"));

  system.update({ eye, forward, interactables: [thing("throttle", { x: 0, y: 1.7, z: 1.2 })] });

  assert.equal(system.activate(), true);
  assert.deepEqual(fired, ["throttle"], "and only that one");
});

test("activate does nothing when nothing is focused", () => {
  const system = new InteractionSystem();
  system.register("throttle", () => assert.fail("should not run"));
  assert.equal(system.activate(), false);
});

test("an object with no registered action reports failure rather than pretending", () => {
  const system = new InteractionSystem();
  system.update({ eye, forward, interactables: [thing("mystery", { x: 0, y: 1.7, z: 1.2 })] });

  const originalWarn = console.warn;
  console.warn = () => {};
  assert.equal(system.activate(), false);
  console.warn = originalWarn;
});

test("the action receives which object was used", () => {
  const system = new InteractionSystem();
  let received = null;
  system.register("door", (context) => (received = context.interactable.id));

  system.update({ eye, forward, interactables: [thing("door", { x: 0, y: 1.7, z: 1.0 })] });
  system.activate({ extra: 1 });

  assert.equal(received, "door");
});

test("clearing focus stops E doing anything", () => {
  const system = new InteractionSystem();
  system.register("door", () => assert.fail("should not run"));
  system.update({ eye, forward, interactables: [thing("door", { x: 0, y: 1.7, z: 1.0 })] });

  system.clear();
  assert.equal(system.focused, null);
  assert.equal(system.activate(), false);
});
