import test from "node:test";
import assert from "node:assert/strict";

import { Box, ColliderSet, moveBody, overlaps, findClearSpot } from "../src/systems/world/collision.js";
import { PlayerController } from "../src/systems/player/playerController.js";
import { Stamina } from "../src/systems/player/stamina.js";
import { Cutscene, ease, lerpPoint } from "../src/cinematics/cutsceneDirector.js";
import { PLAYER } from "../src/data/balance.js";
import { simulate } from "./helpers.js";

/** A plain 6x6 room with a floor at y=0 and walls at +/-3. */
function room({ size = 3, height = 2.6 } = {}) {
  const colliders = new ColliderSet();
  colliders.add(new Box(-size, -0.2, -size, size, 0, size, { tag: "floor" }));
  colliders.add(new Box(-size, height, -size, size, height + 0.2, size, { tag: "ceiling" }));
  colliders.add(new Box(size, 0, -size, size + 0.2, height, size, { tag: "east" }));
  colliders.add(new Box(-size - 0.2, 0, -size, -size, height, size, { tag: "west" }));
  colliders.add(new Box(-size, 0, size, size, height, size + 0.2, { tag: "north" }));
  colliders.add(new Box(-size, 0, -size - 0.2, size, height, -size, { tag: "south" }));
  return colliders;
}

/** Runs a controller for `seconds` with a constant intent. */
function walk(player, intent, seconds, delta = 1 / 60) {
  simulate(seconds, (step) => player.update(step, intent), delta);
}

/* ------------------------------------------------------------- collision */

test("boxes only overlap when they really intersect", () => {
  const a = new Box(0, 0, 0, 1, 1, 1);
  assert.ok(overlaps(a, new Box(0.5, 0.5, 0.5, 2, 2, 2)));
  assert.equal(overlaps(a, new Box(1, 0, 0, 2, 1, 1)), false, "touching is not overlapping");
  assert.equal(overlaps(a, new Box(2, 2, 2, 3, 3, 3)), false);
});

test("a falling body lands on the floor instead of through it", () => {
  // Tall enough that a body standing at y=2 is not already in the ceiling.
  const colliders = room({ height: 5 });
  const position = { x: 0, y: 2, z: 0 };

  const contact = moveBody(position, { x: 0, y: -3, z: 0 }, colliders, {
    radius: 0.32,
    height: 1.8,
  });

  assert.ok(contact.grounded);
  assert.equal(position.y, 0, "standing exactly on the floor");
});

test("a body stops at a wall and does not pass through it", () => {
  const colliders = room();
  const position = { x: 0, y: 0, z: 0 };

  moveBody(position, { x: 10, y: 0, z: 0 }, colliders, { radius: 0.32, height: 1.8 });

  assert.ok(position.x < 3, "did not go through the wall");
  assert.ok(Math.abs(position.x - (3 - 0.32)) < 1e-6, "stopped exactly against it");
});

test("a body slides along a wall rather than sticking to it", () => {
  const colliders = room();
  const position = { x: 2.9, y: 0, z: 0 };

  // Pushing into the east wall and north at the same time.
  moveBody(position, { x: 1, y: 0, z: 1 }, colliders, { radius: 0.32, height: 1.8 });

  assert.ok(position.x <= 3 - 0.32 + 1e-6, "blocked on x");
  assert.ok(position.z > 0.9, "but still moved on z");
});

test("a low sill is stepped over rather than blocking", () => {
  const colliders = room();
  colliders.add(new Box(-3, 0, 0.5, 3, 0.2, 0.7, { tag: "sill" }));

  const position = { x: 0, y: 0, z: 0 };
  moveBody(position, { x: 0, y: 0, z: 1 }, colliders, {
    radius: 0.32,
    height: 1.8,
    stepHeight: 0.35,
  });

  assert.ok(position.z > 0.7, "walked over it");
  assert.equal(position.y, 0.2, "and is now standing on it");
});

test("a body stops under a ceiling instead of rising through it", () => {
  const colliders = room({ height: 2.6 });
  const position = { x: 0, y: 0, z: 0 };


  const contact = moveBody(position, { x: 0, y: 5, z: 0 }, colliders, {
    radius: 0.32,
    height: 1.8,
  });

  assert.ok(contact.hitCeiling);
  assert.ok(Math.abs(position.y - (2.6 - 1.8)) < 1e-6);
});

test("an obstructed spawn is moved to the nearest clear spot", () => {
  const colliders = room();
  colliders.add(new Box(-0.5, 0, -0.5, 0.5, 1.5, 0.5, { tag: "crate" }));

  const clear = findClearSpot({ x: 0, y: 0, z: 0 }, colliders, { radius: 0.32, height: 1.8 });
  assert.ok(Math.hypot(clear.x, clear.z) > 0.5, "moved out of the crate");
  assert.ok(Math.hypot(clear.x, clear.z) < 2.5, "but not far");
});

/* ------------------------------------------------------------ controller */

test("the player walks forward when told to", () => {
  const player = new PlayerController({ colliders: room({ size: 40 }) });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(player, {}, 0.5);

  const before = player.position.z;
  walk(player, { forward: 1 }, 1);

  assert.ok(player.position.z > before + 1, "actually moved");
  assert.ok(player.isMoving);
});

test("the player moves in all four directions", () => {
  const start = () => {
    const player = new PlayerController({ colliders: room() });
    player.spawnAt({ x: 0, y: 0.1, z: 0 });
    walk(player, {}, 0.4);
    return player;
  };

  const forward = start();
  walk(forward, { forward: 1 }, 0.8);
  assert.ok(forward.position.z > 0.5, "W moves forward");

  const back = start();
  walk(back, { forward: -1 }, 0.8);
  assert.ok(back.position.z < -0.5, "S moves back");

  // Facing +Z with the camera looking along +Z, the player's right hand points
  // at -X. This is the assertion that was encoding the A/D swap.
  const right = start();
  walk(right, { right: 1 }, 0.8);
  assert.ok(right.position.x < -0.5, "D moves right");

  const left = start();
  walk(left, { right: -1 }, 0.8);
  assert.ok(left.position.x > 0.5, "A moves left");
});

test("strafing right is the same direction as facing right and walking on", () => {
  // States the rule without depending on which way the axes point: the
  // player's right is their forward turned a quarter turn clockwise.
  const strafing = new PlayerController({ colliders: room({ size: 40 }) });
  strafing.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(strafing, {}, 0.4);
  walk(strafing, { right: 1 }, 1.2);

  const turning = new PlayerController({ colliders: room({ size: 40 }) });
  turning.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(turning, {}, 0.4);
  turning.look(-Math.PI / 2, 0);
  walk(turning, { forward: 1 }, 1.2);

  assert.ok(Math.abs(strafing.position.x - turning.position.x) < 0.1, "same x");
  assert.ok(Math.abs(strafing.position.z - turning.position.z) < 0.1, "same z");
});

test("A and D are exact opposites", () => {
  const go = (right) => {
    const player = new PlayerController({ colliders: room({ size: 40 }) });
    player.spawnAt({ x: 0, y: 0.1, z: 0 });
    walk(player, {}, 0.4);
    walk(player, { right }, 1);
    return player.position;
  };

  const d = go(1);
  const a = go(-1);
  assert.ok(Math.abs(d.x + a.x) < 0.05 && Math.abs(d.z + a.z) < 0.05);
});

test("movement follows where the player is looking", () => {
  const player = new PlayerController({ colliders: room() });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(player, {}, 0.4);

  // Turn a quarter turn, then walk "forward".
  player.look(Math.PI / 2, 0);
  walk(player, { forward: 1 }, 0.8);

  assert.ok(player.position.x > 0.5, "forward is now along x");
  assert.ok(Math.abs(player.position.z) < 0.4);
});

test("walking speed matches the balance table", () => {
  const player = new PlayerController({ colliders: room({ size: 40 }) });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(player, { forward: 1 }, 2);

  assert.ok(
    Math.abs(player.speed - PLAYER.movement.walkSpeed) < 0.2,
    `walked at ${player.speed.toFixed(2)} m/s`,
  );
});

test("sprinting is faster than walking and drains stamina", () => {
  const stamina = new Stamina();
  const player = new PlayerController({ colliders: room({ size: 40 }), stamina });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });

  walk(player, { forward: 1, sprint: true }, 2);

  assert.ok(player.speed > PLAYER.movement.walkSpeed + 1, `sprinted at ${player.speed.toFixed(2)}`);
  assert.ok(stamina.value < stamina.max, "and it cost stamina");
});

test("standing still with sprint held costs nothing", () => {
  const stamina = new Stamina();
  const player = new PlayerController({ colliders: room(), stamina });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });

  walk(player, { sprint: true }, 2);
  assert.equal(stamina.value, stamina.max);
});

test("crouching is slower and lowers the eye", () => {
  const player = new PlayerController({ colliders: room({ size: 40 }) });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(player, {}, 0.4);
  const standingEye = player.eyePosition.y;

  walk(player, { forward: 1, crouch: true }, 1.5);

  assert.ok(player.eyePosition.y < standingEye - 0.4, "eye dropped");
  assert.ok(player.speed < PLAYER.movement.walkSpeed, "and slowed down");
});

test("the player cannot walk out through a wall", () => {
  const player = new PlayerController({ colliders: room() });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });

  walk(player, { forward: 1 }, 6);

  assert.ok(player.position.z < 3, "still inside the room");
  assert.ok(player.isClear, "and not embedded in the wall");
});

test("the player does not fall through the floor over a long run", () => {
  const player = new PlayerController({ colliders: room() });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });

  walk(player, { forward: 1 }, 30);

  assert.ok(player.position.y >= 0, `ended at y=${player.position.y}`);
  assert.ok(player.isGrounded);
});

test("a disabled player does not move", () => {
  const player = new PlayerController({ colliders: room() });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(player, {}, 0.4);

  const before = { ...player.position };
  player.setEnabled(false);
  walk(player, { forward: 1, sprint: true }, 2);

  assert.ok(Math.abs(player.position.z - before.z) < 0.01, "frozen during a cutscene");
  assert.equal(player.isEnabled, false);
});

test("a re-enabled player moves again", () => {
  const player = new PlayerController({ colliders: room() });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  player.setEnabled(false);
  walk(player, { forward: 1 }, 1);

  player.setEnabled(true);
  const before = player.position.z;
  walk(player, { forward: 1 }, 1);

  assert.ok(player.position.z > before + 0.8, "control came back");
});

test("looking is clamped so the camera cannot flip over", () => {
  const player = new PlayerController({ colliders: room() });
  player.look(0, 100);
  assert.ok(player.pitch < Math.PI / 2);
  player.look(0, -200);
  assert.ok(player.pitch > -Math.PI / 2);
});

test("the eye is at head height above the feet", () => {
  const player = new PlayerController({ colliders: room() });
  player.spawnAt({ x: 0, y: 0.1, z: 0 });
  walk(player, {}, 0.5);

  const eye = player.eyePosition;
  assert.ok(eye.y > player.position.y + 1.5);
  assert.ok(eye.y < player.position.y + 1.8);
});

/* -------------------------------------------------------- cutscene timing */

test("a cutscene runs its shots in order, once each", () => {
  const log = [];
  const shot = (name, duration) => ({
    name,
    duration,
    onEnter: () => log.push(`enter:${name}`),
    onExit: () => log.push(`exit:${name}`),
  });

  const cutscene = new Cutscene([shot("a", 1), shot("b", 1), shot("c", 1)], {
    onFinished: () => log.push("finished"),
  });

  simulate(4, (delta) => cutscene.update(delta), 0.1);

  assert.deepEqual(log, [
    "enter:a", "exit:a",
    "enter:b", "exit:b",
    "enter:c", "exit:c",
    "finished",
  ]);
  assert.ok(cutscene.isFinished);
});

test("a long frame does not swallow a short shot", () => {
  const log = [];
  const shot = (name) => ({
    name,
    duration: 0.2,
    onEnter: () => log.push(name),
  });

  const cutscene = new Cutscene([shot("a"), shot("b"), shot("c")]);
  // One frame longer than all three shots put together.
  cutscene.update(5, {});

  assert.deepEqual(log, ["a", "b", "c"], "every beat still happened");
  assert.ok(cutscene.isFinished);
});

test("skipping still runs every clean-up", () => {
  const exits = [];
  const shots = ["a", "b", "c", "d"].map((name) => ({
    name,
    duration: 2,
    onExit: () => exits.push(name),
  }));

  let finished = false;
  const cutscene = new Cutscene(shots, { onFinished: () => (finished = true) });

  cutscene.update(1, {});
  cutscene.skip({});

  assert.deepEqual(exits, ["a", "b", "c", "d"], "nothing was left half-done");
  assert.ok(finished, "and the handover still happened");
  assert.ok(cutscene.isFinished);
});

test("skipping before the cutscene starts is still safe", () => {
  const exits = [];
  const cutscene = new Cutscene(
    [{ duration: 1, onExit: () => exits.push("a") }],
    { onFinished: () => exits.push("finished") },
  );

  cutscene.skip({});
  assert.deepEqual(exits, ["a", "finished"]);
});

test("a finished cutscene ignores further updates", () => {
  let updates = 0;
  const cutscene = new Cutscene([{ duration: 0.5, onUpdate: () => (updates += 1) }]);

  cutscene.update(1, {});
  const after = updates;
  cutscene.update(1, {});

  assert.equal(updates, after, "no callbacks after the end");
});

test("progress runs from zero to one", () => {
  const cutscene = new Cutscene([{ duration: 1 }, { duration: 1 }]);
  assert.equal(cutscene.progress, 0);

  cutscene.update(1, {});
  assert.ok(Math.abs(cutscene.progress - 0.5) < 0.01);

  cutscene.update(1, {});
  assert.equal(cutscene.progress, 1);
});

test("a cutscene must have at least one shot", () => {
  assert.throws(() => new Cutscene([]), /at least one shot/);
});

test("easing and interpolation behave", () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.ok(ease(0.5) > 0.4 && ease(0.5) < 0.6);
  assert.equal(ease(-5), 0, "clamped");

  const mid = lerpPoint({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: -10 }, 0.5);
  assert.deepEqual(mid, { x: 5, y: 10, z: -5 });
});

test("a shot is told how much time each update covers", () => {
  /*
   * Without this, a shot that moves something by a fixed amount per call
   * travels a different distance depending on the frame rate. The helicopter
   * did exactly that: on a slow machine it crawled and the framing of the
   * whole act went with it.
   */
  const steps = [];
  const cutscene = new Cutscene([
    { name: "a", duration: 1, onUpdate: (t, elapsed, context, delta) => steps.push(delta) },
  ]);

  cutscene.update(0.25, {});
  cutscene.update(0.25, {});
  cutscene.update(0.25, {});

  assert.deepEqual(steps, [0.25, 0.25, 0.25]);
});

test("the time a shot is told about adds up to its duration, however it is stepped", () => {
  const sum = { small: 0, large: 0 };

  const run = (step, key) => {
    const cutscene = new Cutscene([
      { name: "a", duration: 2, onUpdate: (t, e, c, delta) => (sum[key] += delta) },
      { name: "b", duration: 2 },
    ]);
    for (let i = 0; i < 200; i += 1) cutscene.update(step, {});
  };

  run(0.016, "small");
  run(0.25, "large");

  // Both stepping rates hand the first shot exactly its two seconds - which
  // is what makes anything driven by delta frame-rate independent.
  assert.ok(Math.abs(sum.small - 2) < 1e-6, `fine steps: ${sum.small}`);
  assert.ok(Math.abs(sum.large - 2) < 1e-6, `coarse steps: ${sum.large}`);
});
