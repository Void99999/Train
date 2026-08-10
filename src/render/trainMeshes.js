/**
 * LAST TRAIN - building the train.
 *
 * An original compact military-industrial design: a low riveted hood, a tall
 * squared-off cab set back over the frame, external walkways with pipe
 * railings, twin exhaust stacks and a heavy buffer beam. It should read as
 * something built to work rather than something styled - old, field-modified,
 * and green under the dirt.
 *
 * Meshes are built from the same data the simulation uses, so a level 4
 * transport wagon really is longer and taller than a level 1, and a combat
 * wagon really does grow a turret at level 4.
 */

import * as THREE from "../../vendor/three/three.module.js";
import { metalMaterial, glassMaterial, lampMaterial } from "./materials.js";
import { buildLocomotiveCab } from "./interiors.js";
import { VEHICLE_KIND, MOUNT_TYPE } from "../data/wagons.js";
import { DAMAGE_STATE } from "../systems/train/vehicle.js";

/** The train's green. Faded, olive, not a bright colour. */
const TRAIN_GREEN = 0x3f5240;
const FRAME_GREY = 0x2a2e30;
const RUSTY_STEEL = 0x4a4340;

/** How worn each damage band looks. Feeds straight into the material. */
const WEAR_BY_STATE = {
  [DAMAGE_STATE.pristine]: 0.28,
  [DAMAGE_STATE.light]: 0.42,
  [DAMAGE_STATE.medium]: 0.58,
  [DAMAGE_STATE.heavy]: 0.75,
  [DAMAGE_STATE.critical]: 0.92,
  [DAMAGE_STATE.destroyed]: 1,
};

let seedCounter = 100;

function box(width, height, depth, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radius, height, material, segments = 16) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A running-gear assembly: wheels on an axle, side frames, springs.
 * Sits under the vehicle and is what the final derailment destroys.
 */
function buildBogie({ wheelRadius = 0.52, axles = 2, width = 2.2 }) {
  const group = new THREE.Group();
  const steel = metalMaterial({ colour: FRAME_GREY, wear: 0.72, seed: seedCounter++, repeat: 1 });
  const tyre = metalMaterial({ colour: 0x1d2022, wear: 0.55, seed: seedCounter++, repeat: 1 });

  const frame = box(width * 0.9, 0.34, axles * 1.5, steel);
  frame.position.y = wheelRadius + 0.32;
  group.add(frame);

  for (let axle = 0; axle < axles; axle += 1) {
    const z = (axle - (axles - 1) / 2) * 1.5;
    for (const side of [-1, 1]) {
      // Wheels are named so the world can spin them with the train's speed.
      // A train whose wheels do not turn reads as a prop being dragged.
      const wheel = cylinder(wheelRadius, 0.16, tyre, 24);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * (width / 2), wheelRadius, z);
      wheel.name = "wheel";
      wheel.userData.radius = wheelRadius;
      group.add(wheel);

      // Wheel face detail so the wheels are not featureless discs up close.
      const hub = cylinder(wheelRadius * 0.4, 0.18, steel, 12);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * (width / 2), wheelRadius, z);
      hub.name = "wheel";
      hub.userData.radius = wheelRadius;
      group.add(hub);

      // A counterweight on the wheel face, so the rotation is visible.
      const crank = box(0.09, wheelRadius * 0.75, 0.09, steel);
      crank.position.set(side * (width / 2 + 0.09), wheelRadius, z);
      crank.name = "wheel";
      crank.userData.radius = wheelRadius;
      crank.userData.crankOffset = wheelRadius * 0.42;
      group.add(crank);
    }

    const axleBar = cylinder(0.08, width, steel, 8);
    axleBar.rotation.z = Math.PI / 2;
    axleBar.position.set(0, wheelRadius, z);
    group.add(axleBar);
  }

  group.name = "bogie";
  return group;
}

/** Pipe railing along a walkway edge. */
function buildRailing(length, material) {
  const group = new THREE.Group();
  const posts = Math.max(2, Math.round(length / 1.4));

  for (let i = 0; i < posts; i += 1) {
    const post = cylinder(0.035, 0.9, material, 6);
    post.position.set(0, 0.45, -length / 2 + (i * length) / (posts - 1));
    group.add(post);
  }

  for (const height of [0.86, 0.5]) {
    const rail = cylinder(0.03, length, material, 6);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(0, height, 0);
    group.add(rail);
  }
  return group;
}

/**
 * The locomotive. Original design; nothing here is modelled on a real machine
 * or on another game's train.
 */
export function buildLocomotive({ size, wear = 0.3 }) {
  const group = new THREE.Group();
  const { length, width, height } = size;

  // Grime runs up from the running gear rather than covering the whole hull.
  const paint = metalMaterial({
    colour: TRAIN_GREEN, wear, seed: 7, repeat: 3, repeatY: 1, grimeBias: 0.3,
  });
  const frame = metalMaterial({ colour: FRAME_GREY, wear: wear + 0.2, seed: 11, repeat: 2 });
  const trim = metalMaterial({ colour: RUSTY_STEEL, wear: wear + 0.3, seed: 13, repeat: 1 });

  // Main frame, low and heavy.
  const chassis = box(width, 0.55, length, frame);
  chassis.position.y = 1.05;
  group.add(chassis);

  // The cab is a real room, built as walls with thickness rather than a solid
  // block. A solid box would be invisible from the inside - every face points
  // away from the camera and is culled - which is what "missing walls" means.
  const cab = buildLocomotiveCab(size);
  group.add(cab.group);

  // Long hood forward of the cab, where the machinery lives. It starts exactly
  // at the cab's front wall so there is no gap between the two.
  const hoodStart = cab.dimensions.frontZ;
  const hoodEnd = length / 2 - 0.45;
  const hoodLength = hoodEnd - hoodStart;
  const hoodCentre = (hoodStart + hoodEnd) / 2;

  const hood = box(width * 0.82, 1.7, hoodLength, paint);
  hood.position.set(0, 2.2, hoodCentre);
  group.add(hood);

  // Louvred panels along the hood sides.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      const louvre = box(0.06, 0.9, 0.7, trim);
      louvre.position.set(side * (width * 0.41), 2.3, hoodStart + 0.9 + i * 1.1);
      group.add(louvre);
    }
  }

  // Cab roof overhang, sitting on top of the interior's ceiling.
  const roof = box(width * 1.04, 0.14, cab.dimensions.length + 0.4, trim);
  roof.position.set(0, cab.dimensions.ceilingY + 0.2, cab.dimensions.centreZ);
  group.add(roof);

  // Twin exhaust stacks, on the hood ahead of the cab.
  for (const offset of [-0.45, 0.45]) {
    const stack = cylinder(0.19, 0.75, trim, 12);
    stack.position.set(offset, 3.4, hoodStart + 1.6);
    group.add(stack);
  }

  // Walkways and railings down both sides of the hood.
  for (const side of [-1, 1]) {
    const walkway = box(0.5, 0.08, length * 0.7, frame);
    walkway.position.set(side * (width * 0.52), 1.36, length * 0.08);
    group.add(walkway);

    const railing = buildRailing(length * 0.66, trim);
    railing.position.set(side * (width * 0.7), 1.4, length * 0.08);
    group.add(railing);
  }

  // Buffer beams and couplers at both ends.
  for (const end of [-1, 1]) {
    const beam = box(width * 1.05, 0.45, 0.3, trim);
    beam.position.set(0, 1.25, end * (length / 2));
    group.add(beam);

    const coupler = box(0.34, 0.3, 0.5, frame);
    coupler.position.set(0, 1.15, end * (length / 2 + 0.25));
    group.add(coupler);
  }

  // Headlight, and the beam it throws down the track.
  const headlamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10),
    lampMaterial(0xffe3b0, 3),
  );
  headlamp.position.set(0, 3.05, length / 2 - 0.1);
  headlamp.name = "headlamp";
  group.add(headlamp);

  const beam = new THREE.SpotLight(0xffe0b2, 220, 130, Math.PI / 9, 0.45, 1.4);
  beam.position.set(0, 3.05, length / 2);
  beam.target.position.set(0, 0, length / 2 + 60);
  beam.name = "headlight";
  group.add(beam);
  group.add(beam.target);

  // Running gear: two three-axle trucks.
  const frontBogie = buildBogie({ axles: 3, width: width * 0.72 });
  frontBogie.position.z = length * 0.26;
  group.add(frontBogie);

  const rearBogie = buildBogie({ axles: 3, width: width * 0.72 });
  rearBogie.position.z = -length * 0.26;
  group.add(rearBogie);

  group.name = "locomotive";

  // The interior's colliders and spawn point travel with the mesh, so the
  // geometry the player can see and the geometry that stops them walking
  // through it are produced by the same code and cannot drift apart.
  group.userData.colliders = cab.colliders;
  group.userData.interactables = cab.interactables;
  group.userData.spawn = cab.spawn;
  group.userData.cab = cab.dimensions;
  return group;
}

/** An enclosed freight wagon. Grows visibly with each upgrade level. */
export function buildTransportWagon({ size, level, wear = 0.35 }) {
  const group = new THREE.Group();
  const { length, width, height } = size;

  const paint = metalMaterial({
    colour: TRAIN_GREEN, wear, seed: 20 + level, repeat: 3, repeatY: 1, grimeBias: 0.3,
  });
  const frame = metalMaterial({ colour: FRAME_GREY, wear: wear + 0.2, seed: 30 + level, repeat: 2 });
  const trim = metalMaterial({ colour: RUSTY_STEEL, wear: wear + 0.25, seed: 40 + level, repeat: 1 });

  const underframe = box(width, 0.4, length, frame);
  underframe.position.y = 1.0;
  group.add(underframe);

  const body = box(width, height - 1.5, length, paint);
  body.position.y = 1.2 + (height - 1.5) / 2;
  group.add(body);

  // Vertical ribs. More of them on the bigger wagons, so the size reads.
  const ribs = 4 + level;
  for (let i = 0; i < ribs; i += 1) {
    const z = -length / 2 + (length * (i + 0.5)) / ribs;
    for (const side of [-1, 1]) {
      const rib = box(0.1, height - 1.7, 0.16, trim);
      rib.position.set(side * (width / 2), 1.3 + (height - 1.5) / 2, z);
      group.add(rib);
    }
  }

  // Sliding side doors with handles.
  for (const side of [-1, 1]) {
    const door = box(0.09, (height - 1.5) * 0.72, length * 0.3, trim);
    door.position.set(side * (width / 2 + 0.02), 1.35 + (height - 1.5) / 2, 0);
    group.add(door);

    const handle = cylinder(0.045, 0.5, frame, 6);
    handle.position.set(side * (width / 2 + 0.09), 1.5 + (height - 1.5) / 2, length * 0.1);
    group.add(handle);
  }

  // End doors, so the player can actually walk from wagon to wagon.
  for (const end of [-1, 1]) {
    const door = box(width * 0.42, (height - 1.5) * 0.8, 0.1, trim);
    door.position.set(0, 1.3 + (height - 1.5) * 0.4, end * (length / 2));
    door.name = end > 0 ? "door-front" : "door-rear";
    group.add(door);

    const beam = box(width * 1.02, 0.4, 0.28, trim);
    beam.position.set(0, 1.2, end * (length / 2));
    group.add(beam);
  }

  // Roof, slightly proud of the body.
  const roof = box(width * 1.04, 0.12, length * 1.01, trim);
  roof.position.y = height - 0.24;
  group.add(roof);

  for (const end of [-1, 1]) {
    const bogie = buildBogie({ axles: 2, width: width * 0.72 });
    bogie.position.z = end * (length * 0.3);
    group.add(bogie);
  }

  group.name = `transport-${level}`;
  return group;
}

/** A fighting platform. Level decides what is bolted to it. */
export function buildCombatWagon({ size, level, mount, wear = 0.35 }) {
  const group = new THREE.Group();
  const { length, width, height } = size;

  const paint = metalMaterial({
    colour: TRAIN_GREEN, wear, seed: 50 + level, repeat: 3, repeatY: 1, grimeBias: 0.3,
  });
  const frame = metalMaterial({ colour: FRAME_GREY, wear: wear + 0.2, seed: 60 + level, repeat: 2 });
  const trim = metalMaterial({ colour: RUSTY_STEEL, wear: wear + 0.25, seed: 70 + level, repeat: 1 });

  const underframe = box(width, 0.4, length, frame);
  underframe.position.y = 1.0;
  group.add(underframe);

  const bodyHeight = height - 1.6;
  const body = box(width, bodyHeight, length, paint);
  body.position.y = 1.2 + bodyHeight / 2;
  group.add(body);

  // Sloped armour shoulders - the visual difference from a freight wagon.
  for (const side of [-1, 1]) {
    const shoulder = box(0.5, 0.5, length * 0.94, trim);
    shoulder.rotation.z = side * 0.6;
    shoulder.position.set(side * (width / 2 - 0.1), 1.2 + bodyHeight, 0);
    group.add(shoulder);
  }

  for (const end of [-1, 1]) {
    const door = box(width * 0.4, bodyHeight * 0.78, 0.1, trim);
    door.position.set(0, 1.3 + bodyHeight * 0.39, end * (length / 2));
    door.name = end > 0 ? "door-front" : "door-rear";
    group.add(door);

    const bogie = buildBogie({ axles: 2, width: width * 0.72 });
    bogie.position.z = end * (length * 0.3);
    group.add(bogie);
  }

  if (mount === MOUNT_TYPE.machineGun) {
    // A firing port cut into the side, with the weapon poking through it.
    const port = box(0.14, 0.7, 1.6, frame);
    port.position.set(width / 2, 1.2 + bodyHeight * 0.6, 0.5);
    group.add(port);

    const barrel = cylinder(0.07, 1.5, frame, 8);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(width / 2 + 0.7, 1.2 + bodyHeight * 0.6, 0.5);
    barrel.name = "mount-barrel";
    group.add(barrel);
  }

  if (mount === MOUNT_TYPE.rocketLauncher) {
    const cradle = box(1.5, 0.5, 1.9, frame);
    cradle.position.set(width / 2 - 0.2, 1.2 + bodyHeight + 0.3, 0.4);
    group.add(cradle);

    for (const offset of [-0.35, 0.35]) {
      const tube = cylinder(0.16, 2.1, trim, 10);
      tube.rotation.x = Math.PI / 2;
      tube.rotation.y = 0.2;
      tube.position.set(width / 2 - 0.2, 1.2 + bodyHeight + 0.55, offset);
      group.add(tube);
    }
  }

  if (mount === MOUNT_TYPE.heavyCannon) {
    // A full rotating turret on the roof. Original design: a squat hexagonal
    // casting with a long barrel and a heavy mantlet.
    const turret = new THREE.Group();
    turret.name = "turret";

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.75, 1.0, 6),
      metalMaterial({ colour: TRAIN_GREEN, wear: wear + 0.1, seed: 81, repeat: 2 }),
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    turret.add(shell);

    const mantlet = box(1.1, 0.8, 0.5, trim);
    mantlet.position.set(0, 0.05, 1.5);
    turret.add(mantlet);

    const barrel = cylinder(0.16, 4.2, frame, 12);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, 3.4);
    barrel.name = "turret-barrel";
    turret.add(barrel);

    const muzzle = cylinder(0.24, 0.6, trim, 12);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.05, 5.3);
    turret.add(muzzle);

    // Hatch on top, so it reads as something a person climbs into.
    const hatch = cylinder(0.42, 0.14, trim, 10);
    hatch.position.set(-0.3, 0.55, -0.4);
    turret.add(hatch);

    turret.position.set(0, 1.2 + bodyHeight + 0.5, -0.4);
    group.add(turret);
  }

  const roof = box(width * 1.02, 0.12, length * 1.01, trim);
  roof.position.y = 1.2 + bodyHeight;
  group.add(roof);

  group.name = `combat-${level}`;
  return group;
}

/**
 * Bolt-on armour plating. Applied over an existing vehicle so that armour is
 * visibly *added* to the wagon the player already owns rather than replacing
 * it with a different model.
 */
export function buildArmourPlating({ size, integrity = 1 }) {
  const group = new THREE.Group();
  const { length, width, height } = size;
  const plate = metalMaterial({
    colour: 0x3a3f3c,
    wear: 0.45 + (1 - integrity) * 0.5,
    seed: 90,
    repeat: 2,
  });
  const bolt = metalMaterial({ colour: 0x6a6f70, wear: 0.5, seed: 91, repeat: 1 });

  for (const side of [-1, 1]) {
    const slab = box(0.22, (height - 1.6) * 0.86, length * 0.92, plate);
    slab.position.set(side * (width / 2 + 0.12), 1.3 + (height - 1.6) * 0.45, 0);
    group.add(slab);

    // Heavy bolt heads down the plate edges.
    const bolts = Math.round(length / 1.2);
    for (let i = 0; i < bolts; i += 1) {
      for (const heightOffset of [0.3, 0.85]) {
        const head = cylinder(0.075, 0.09, bolt, 6);
        head.rotation.z = Math.PI / 2;
        head.position.set(
          side * (width / 2 + 0.24),
          1.3 + (height - 1.6) * heightOffset,
          -length * 0.44 + (i * length * 0.88) / (bolts - 1),
        );
        group.add(head);
      }
    }
  }

  group.name = "armour";
  return group;
}

/**
 * Builds the right mesh for a vehicle, including its armour if it has any.
 * The mesh carries its damage state so the renderer can tell when it needs
 * rebuilding.
 */
export function buildVehicleMesh(vehicle) {
  const wear = WEAR_BY_STATE[vehicle.damageState] ?? 0.35;
  const size = vehicle.spec.size;

  let mesh;
  if (vehicle.kind === VEHICLE_KIND.locomotive) {
    mesh = buildLocomotive({ size, wear });
  } else if (vehicle.kind === VEHICLE_KIND.transport) {
    mesh = buildTransportWagon({ size, level: vehicle.level, wear });
  } else {
    mesh = buildCombatWagon({ size, level: vehicle.level, mount: vehicle.mount, wear });
  }

  if (vehicle.isArmoured) {
    mesh.add(buildArmourPlating({ size, integrity: vehicle.armourIntegrity }));
  }

  mesh.userData.vehicleId = vehicle.id;
  mesh.userData.damageState = vehicle.damageState;
  mesh.userData.armoured = vehicle.isArmoured;
  mesh.userData.level = vehicle.level;
  return mesh;
}

/** Frees the geometry and materials of a mesh tree. */
export function disposeMesh(object) {
  object.traverse((node) => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
    else node.material?.dispose();
  });
}
