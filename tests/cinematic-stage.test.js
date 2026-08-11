import "./domStub.js";

import test from "node:test";
import assert from "node:assert/strict";

import * as THREE from "../vendor/three/three.module.js";
import { CinematicStage } from "../src/render/cinematicStage.js";

/** A stage with the helicopter flying, the way act two leaves it. */
function flying({ bank = -0.12, pitch = 0.06, y = 58 } = {}) {
  const stage = new CinematicStage({ scene: new THREE.Scene() });
  stage.helicopter.position.set(0, y, -40);
  stage.helicopter.rotation.set(pitch, 0, bank);
  return stage;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

test("the door gun is part of the helicopter, not a separate prop", () => {
  const stage = flying();
  assert.equal(stage.doorGun.parent, stage.helicopter, "bolted to the airframe");
});

test("the gun cannot drift away from the doorway however the aircraft moves", () => {
  const stage = flying();
  const gun = new THREE.Vector3();

  // Fly it around, including the near-inverted attitude of the crash.
  for (const [x, y, z, rx, ry, rz] of [
    [0, 58, -40, 0.06, 0, -0.12],
    [3, 51, 12, 0.2, 1.4, -0.5],
    [-9, 22, 60, 0.37, 3.1, -0.8],
  ]) {
    stage.helicopter.position.set(x, y, z);
    stage.helicopter.rotation.set(rx, ry, rz);
    stage.helicopter.updateWorldMatrix(true, true);
    stage.doorGun.getWorldPosition(gun);

    // The gun's mount, measured in the aircraft's own frame, never moves.
    const local = stage.helicopter.worldToLocal(gun.clone());
    assert.ok(local.x < -1.3, "outside the left cabin skin");
    assert.ok(Math.abs(local.z) < 2, "in the door opening, not on the tail");

    // And in world space it stays within arm's reach of the hull centre.
    assert.ok(distance(gun, { x, y, z }) < 2, "still on the aircraft");
  }
});

test("the gunner stands in the doorway rather than outside the aircraft", () => {
  const stage = flying();
  const { eye } = stage.gunnerView();
  const local = stage.helicopter.worldToLocal(new THREE.Vector3(eye.x, eye.y, eye.z));

  // Cabin is 2.6 wide, 2.2 tall, 5.4 long, centred on the origin.
  assert.ok(Math.abs(local.x) < 1.3, "inside the cabin, not hanging in the air");
  assert.ok(Math.abs(local.y) < 1.1, "between floor and ceiling");
  assert.ok(local.z > -2.7 && local.z < 2.7, "and within its length");
});

test("recoil moves the weapon and leaves the gunner's head alone", () => {
  const stage = flying();
  const muzzle = new THREE.Vector3();

  stage.setDoorGunRecoil(0);
  const restEye = stage.gunnerView().eye;
  stage.muzzleFlash.getWorldPosition(muzzle);
  const restMuzzle = muzzle.clone();

  stage.setDoorGunRecoil(1);
  const firedEye = stage.gunnerView().eye;
  stage.muzzleFlash.getWorldPosition(muzzle);

  // This is the whole complaint: the gun kicked and the aircraft shook.
  assert.equal(distance(restEye, firedEye), 0, "the eye does not move at all");

  const travel = distance(restMuzzle, muzzle);
  assert.ok(travel > 0.05, `the gun visibly recoils (moved ${travel.toFixed(3)} m)`);
  assert.ok(travel < 0.25, "but a hand weapon's worth, not a wrecked mount");
});

test("recoil does not move the helicopter", () => {
  const stage = flying();
  const before = stage.helicopter.position.clone();
  const beforeRotation = stage.helicopter.rotation.clone();

  stage.setDoorGunRecoil(1);
  stage.setDoorGunElevation(0.8);

  assert.deepEqual(stage.helicopter.position.toArray(), before.toArray());
  assert.deepEqual(
    [stage.helicopter.rotation.x, stage.helicopter.rotation.y, stage.helicopter.rotation.z],
    [beforeRotation.x, beforeRotation.y, beforeRotation.z],
  );
});

test("the camera looks where the gun is pointed, down onto the ground", () => {
  const stage = flying();

  for (const [lookDown, minDegrees] of [
    [0.42, 15],
    [0.85, 35],
  ]) {
    stage.setDoorGunElevation(lookDown);
    const { eye, aim } = stage.gunnerView();
    const direction = new THREE.Vector3(aim.x - eye.x, aim.y - eye.y, aim.z - eye.z).normalize();
    const degrees = (Math.asin(-direction.y) * 180) / Math.PI;

    assert.ok(
      degrees > minDegrees,
      `at ${lookDown} the view is ${degrees.toFixed(1)} degrees down, not at the sky`,
    );
    // From 58 m up this has to reach ground the battlefield actually covers.
    assert.ok(eye.y / -direction.y < 200, "and the ground it hits is in shot");
  }
});

test("the horizon banks with the aircraft", () => {
  const level = flying({ bank: 0 }).gunnerView().up;
  const rolled = flying({ bank: -0.8 }).gunnerView().up;

  assert.ok(level.y > 0.99, "flying level, up is up");
  assert.ok(Math.abs(rolled.x) > 0.5, "rolled hard over, the world tips with it");
});

test("the gunner can actually see the battlefield past his own aircraft", () => {
  /*
   * The camera used to sit deep inside a solid cabin box. Nothing was framed
   * but the inside of the hull - the whole act was a dark slab. Rather than
   * eyeballing it, this fans rays across the shot's frustum and counts how
   * many the aircraft eats.
   */
  const stage = flying();
  stage.helicopter.traverse((node) => (node.visible = true));
  stage.setDoorGunElevation(0.42);

  const view = stage.gunnerView();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
  camera.up.set(view.up.x, view.up.y, view.up.z);
  camera.position.set(view.eye.x, view.eye.y, view.eye.z);
  camera.lookAt(view.aim.x, view.aim.y, view.aim.z);
  camera.updateMatrixWorld();

  const raycaster = new THREE.Raycaster();
  raycaster.far = 400;

  let blocked = 0;
  let total = 0;
  for (let iy = -5; iy <= 5; iy += 1) {
    for (let ix = -8; ix <= 8; ix += 1) {
      total += 1;
      raycaster.setFromCamera(new THREE.Vector2(ix / 8, iy / 5), camera);
      if (raycaster.intersectObject(stage.helicopter, true).length > 0) blocked += 1;
    }
  }

  const fraction = blocked / total;
  assert.ok(fraction < 0.4, `most of the frame is the world, not the hull (${Math.round(fraction * 100)}% blocked)`);
  assert.ok(fraction > 0.05, "but the weapon and the doorway are still in shot");
});

test("the gunner is in the door opening, not buried in the cabin", () => {
  const stage = flying();
  const { eye } = stage.gunnerView();
  const local = stage.helicopter.worldToLocal(new THREE.Vector3(eye.x, eye.y, eye.z));

  // The cabin skin is at 1.3; the door opening runs from z -1.9 to 0.6.
  assert.ok(local.x < -1.1, `out at the doorway (x=${local.x.toFixed(2)})`);
  assert.ok(local.z > -1.9 && local.z < 0.6, "and within the opening, not behind the bulkhead");
});
