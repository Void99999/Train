/**
 * LAST TRAIN - walkable interiors.
 *
 * The cab is built as an actual room: a floor to stand on, four walls with
 * thickness, a ceiling, glazed openings, a door, and fittings the player can
 * walk around. Nothing here is a single solid box.
 *
 * That distinction matters more than it sounds. A box built with a front-side
 * material is invisible from the inside, because every face is pointing away
 * from the camera and gets culled - which is exactly what "the train has
 * missing walls" looks like. Walls have to be built as walls.
 *
 * Every structural piece is registered as a collider at the same time it is
 * built, so the geometry the player can see and the geometry that stops them
 * walking through it can never drift apart.
 */

import * as THREE from "../../vendor/three/three.module.js";
import { Box } from "../systems/world/collision.js";
import { metalMaterial, glassMaterial, lampMaterial } from "./materials.js";

const WALL = 0.12;

/** Interior paint: lighter than the exterior green, worn back to primer. */
const INTERIOR_GREEN = 0x53614c;
const FLOOR_STEEL = 0x2f3336;
const PANEL_GREY = 0x3d4448;
const BLUEPRINT_BLUE = 0x1b3d6b;

/**
 * The cab's dimensions, derived from the locomotive's overall size so that the
 * interior and the exterior shell can never disagree about where the walls are.
 */
export function cabDimensions(size) {
  const { length, width } = size;
  const backZ = -length / 2 + 0.65;
  const frontZ = -0.8;
  return {
    backZ,
    frontZ,
    centreZ: (backZ + frontZ) / 2,
    length: frontZ - backZ,
    innerHalfWidth: width / 2 - WALL,
    floorY: 1.35,
    ceilingY: 3.95,
  };
}

function mesh(geometry, material, { castShadow = true } = {}) {
  const node = new THREE.Mesh(geometry, material);
  node.castShadow = castShadow;
  node.receiveShadow = true;
  return node;
}

/**
 * Builds a wall with a rectangular opening in it, as four panels around the
 * hole. Used for windows and doorways.
 *
 * @param {object} options
 * @param {"x"|"z"} options.axis   which way the wall faces
 * @param {object} options.opening `{ centre, width, bottom, top }` in wall-local terms
 */
function wallWithOpening({ axis, span, height, base, opening, material, thickness = WALL }) {
  const group = new THREE.Group();
  const pieces = [];

  const spanHalf = span / 2;
  const openLeft = opening.centre - opening.width / 2;
  const openRight = opening.centre + opening.width / 2;

  const add = (offset, width, bottom, top) => {
    if (width <= 0.001 || top - bottom <= 0.001) return;
    const size = axis === "x"
      ? new THREE.BoxGeometry(thickness, top - bottom, width)
      : new THREE.BoxGeometry(width, top - bottom, thickness);
    const panel = mesh(size, material);
    const centre = (bottom + top) / 2;
    if (axis === "x") panel.position.set(0, centre, offset);
    else panel.position.set(offset, centre, 0);
    group.add(panel);
    pieces.push({ offset, width, bottom, top });
  };

  // Left of the opening, right of it, below it, above it.
  add((-spanHalf + openLeft) / 2, openLeft + spanHalf, base, base + height);
  add((openRight + spanHalf) / 2, spanHalf - openRight, base, base + height);
  add(opening.centre, opening.width, base, base + opening.bottom);
  add(opening.centre, opening.width, base + opening.top, base + height);

  return { group, pieces };
}

/**
 * Builds the driver's cab.
 *
 * @returns {{ group: THREE.Group, colliders: Box[], spawn: {x,y,z}, interactables: object[] }}
 */
export function buildLocomotiveCab(size) {
  const cab = cabDimensions(size);
  const group = new THREE.Group();
  const colliders = [];
  const interactables = [];

  // Wear is kept low in here. The outside of the train has spent years in the
  // weather; the inside is a working cab that somebody looked after, and
  // running it through the same rust values turns the whole room orange.
  const paint = metalMaterial({ colour: INTERIOR_GREEN, wear: 0.16, seed: 210, repeat: 2 });
  const floorMaterial = metalMaterial({ colour: FLOOR_STEEL, wear: 0.3, seed: 211, repeat: 4 });
  const panel = metalMaterial({ colour: PANEL_GREY, wear: 0.18, seed: 212, repeat: 2 });
  const trim = metalMaterial({ colour: 0x5a5b58, wear: 0.26, seed: 213, repeat: 1 });
  const glass = glassMaterial();

  const innerWidth = cab.innerHalfWidth * 2;
  const innerHeight = cab.ceilingY - cab.floorY;

  /* ------------------------------------------------------------ floor */

  const floor = mesh(
    new THREE.BoxGeometry(innerWidth, WALL, cab.length),
    floorMaterial,
    { castShadow: false },
  );
  floor.position.set(0, cab.floorY - WALL / 2, cab.centreZ);
  group.add(floor);
  colliders.push(
    new Box(
      -cab.innerHalfWidth, cab.floorY - WALL, cab.backZ,
      cab.innerHalfWidth, cab.floorY, cab.frontZ,
      { tag: "cab-floor" },
    ),
  );

  // Tread plate strips, so the floor is not a flat grey rectangle.
  for (let i = 0; i < 6; i += 1) {
    const strip = mesh(new THREE.BoxGeometry(innerWidth - 0.2, 0.015, 0.12), trim, {
      castShadow: false,
    });
    strip.position.set(0, cab.floorY + 0.008, cab.backZ + 0.5 + i * 0.75);
    group.add(strip);
  }

  /* ---------------------------------------------------------- ceiling */

  const ceiling = mesh(new THREE.BoxGeometry(innerWidth, WALL, cab.length), paint, {
    castShadow: false,
  });
  ceiling.position.set(0, cab.ceilingY + WALL / 2, cab.centreZ);
  group.add(ceiling);
  colliders.push(
    new Box(
      -cab.innerHalfWidth, cab.ceilingY, cab.backZ,
      cab.innerHalfWidth, cab.ceilingY + WALL, cab.frontZ,
      { tag: "cab-ceiling" },
    ),
  );

  // Roof ribs.
  for (let i = 0; i < 4; i += 1) {
    const rib = mesh(new THREE.BoxGeometry(innerWidth, 0.08, 0.1), trim, { castShadow: false });
    rib.position.set(0, cab.ceilingY - 0.05, cab.backZ + 0.8 + i * 1.1);
    group.add(rib);
  }

  /* ------------------------------------------------------ front wall */

  // Faces the hood. A wide windscreen sits above the console.
  const front = wallWithOpening({
    axis: "z",
    span: innerWidth,
    height: innerHeight,
    base: cab.floorY,
    opening: { centre: 0, width: 2.0, bottom: 1.15, top: 2.05 },
    material: paint,
  });
  front.group.position.set(0, 0, cab.frontZ);
  group.add(front.group);

  const windscreen = mesh(new THREE.BoxGeometry(2.0, 0.9, 0.04), glass, { castShadow: false });
  windscreen.position.set(0, cab.floorY + 1.6, cab.frontZ);
  group.add(windscreen);

  // The wall is solid to the player even where the glass is.
  colliders.push(
    new Box(
      -cab.innerHalfWidth, cab.floorY, cab.frontZ - WALL / 2,
      cab.innerHalfWidth, cab.ceilingY, cab.frontZ + WALL / 2,
      { tag: "cab-front-wall" },
    ),
  );

  /* ------------------------------------------------------- rear wall */

  // Carries the door through to the rest of the train. It is closed, and it
  // stays closed until there is a wagon on the other side of it.
  const rear = wallWithOpening({
    axis: "z",
    span: innerWidth,
    height: innerHeight,
    base: cab.floorY,
    opening: { centre: 0, width: 0.95, bottom: 0.02, top: 2.05 },
    material: paint,
  });
  rear.group.position.set(0, 0, cab.backZ);
  group.add(rear.group);

  const door = mesh(new THREE.BoxGeometry(0.92, 2.0, 0.07), panel);
  door.position.set(0, cab.floorY + 1.02, cab.backZ);
  door.name = "cab-rear-door";
  group.add(door);

  const handle = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 6), trim);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.34, cab.floorY + 1.05, cab.backZ + 0.06);
  group.add(handle);

  const doorWindow = mesh(new THREE.BoxGeometry(0.5, 0.42, 0.03), glass, { castShadow: false });
  doorWindow.position.set(0, cab.floorY + 1.6, cab.backZ + 0.05);
  group.add(doorWindow);

  colliders.push(
    new Box(
      -cab.innerHalfWidth, cab.floorY, cab.backZ - WALL / 2,
      cab.innerHalfWidth, cab.ceilingY, cab.backZ + WALL / 2,
      { tag: "cab-rear-wall" },
    ),
  );

  interactables.push({
    id: "rear-door",
    promptKey: "PROMPT_OPEN_DOOR",
    box: Box.fromCentre(
      { x: 0, y: cab.floorY + 1.0, z: cab.backZ + 0.3 },
      { x: 1.0, y: 2.0, z: 0.6 },
    ),
  });

  /* ------------------------------------------------------- side walls */

  for (const side of [-1, 1]) {
    const x = side * cab.innerHalfWidth;

    const wall = wallWithOpening({
      axis: "x",
      span: cab.length,
      height: innerHeight,
      base: cab.floorY,
      opening: { centre: 0.35, width: 1.5, bottom: 1.15, top: 2.0 },
      material: paint,
    });
    wall.group.position.set(x, 0, cab.centreZ);
    group.add(wall.group);

    const window = mesh(new THREE.BoxGeometry(0.04, 0.85, 1.5), glass, { castShadow: false });
    window.position.set(x, cab.floorY + 1.58, cab.centreZ + 0.35);
    group.add(window);

    // A side door back towards the running boards.
    const sideDoor = mesh(new THREE.BoxGeometry(0.07, 1.95, 0.8), panel);
    sideDoor.position.set(x - side * 0.05, cab.floorY + 0.98, cab.backZ + 1.0);
    group.add(sideDoor);

    colliders.push(
      new Box(
        x - WALL / 2, cab.floorY, cab.backZ,
        x + WALL / 2, cab.ceilingY, cab.frontZ,
        { tag: `cab-wall-${side > 0 ? "right" : "left"}` },
      ),
    );

    // Grab handles by the doors.
    const grab = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), trim);
    grab.position.set(x - side * 0.09, cab.floorY + 1.5, cab.backZ + 1.55);
    group.add(grab);
  }

  /* ---------------------------------------------------------- console */

  const consoleTop = cab.floorY + 1.0;
  const consoleZ = cab.frontZ - 0.45;

  const desk = mesh(new THREE.BoxGeometry(2.3, 0.12, 0.7), panel);
  desk.position.set(-0.15, consoleTop, consoleZ);
  group.add(desk);

  const pedestal = mesh(new THREE.BoxGeometry(2.2, 0.88, 0.55), panel);
  pedestal.position.set(-0.15, cab.floorY + 0.44, consoleZ);
  group.add(pedestal);

  colliders.push(
    Box.standing(
      { x: -0.15, y: cab.floorY, z: consoleZ },
      { x: 2.3, y: 1.06, z: 0.7 },
      { tag: "cab-console" },
    ),
  );

  // Four throttle notches: 25 / 50 / 75 / 100. Physical buttons on the desk,
  // matching the four settings the simulation actually has.
  const notches = [];
  for (let i = 0; i < 4; i += 1) {
    const notch = mesh(
      new THREE.BoxGeometry(0.16, 0.05, 0.16),
      metalMaterial({ colour: 0x6a6f70, wear: 0.4, seed: 220 + i, repeat: 1 }),
    );
    notch.position.set(-0.75 + i * 0.24, consoleTop + 0.08, consoleZ - 0.12);
    notch.name = `throttle-notch-${i + 1}`;
    group.add(notch);

    // Dark until selected. A lamp material at zero emissive still shows its
    // base colour, which made every notch look lit.
    const light = mesh(
      new THREE.BoxGeometry(0.1, 0.02, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0x1a1d1a,
        emissive: 0x7d9a5f,
        emissiveIntensity: 0,
        roughness: 0.5,
      }),
    );
    light.position.set(-0.75 + i * 0.24, consoleTop + 0.115, consoleZ - 0.12);
    light.name = `throttle-light-${i + 1}`;
    group.add(light);
    notches.push(light);
  }

  // The brake handle, for weight rather than function.
  const lever = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 8), trim);
  lever.rotation.x = -0.35;
  lever.position.set(0.7, consoleTop + 0.28, consoleZ);
  group.add(lever);

  const leverKnob = mesh(new THREE.SphereGeometry(0.07, 10, 8), panel);
  leverKnob.position.set(0.7, consoleTop + 0.52, consoleZ - 0.08);
  group.add(leverKnob);

  // Gauges.
  for (let i = 0; i < 3; i += 1) {
    const gauge = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14), trim);
    gauge.rotation.x = Math.PI / 2 - 0.25;
    gauge.position.set(-0.95 + i * 0.3, consoleTop + 0.3, consoleZ - 0.28);
    group.add(gauge);

    const face = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 14), lampMaterial(0xd8cfae, 0.35));
    face.rotation.x = Math.PI / 2 - 0.25;
    face.position.set(-0.95 + i * 0.3, consoleTop + 0.305, consoleZ - 0.255);
    group.add(face);
  }

  interactables.push({
    id: "throttle",
    promptKey: "PROMPT_DRIVE",
    box: Box.fromCentre(
      { x: -0.4, y: consoleTop + 0.2, z: consoleZ + 0.35 },
      { x: 1.8, y: 1.4, z: 1.0 },
    ),
  });

  /* -------------------------------------------------- blueprint panel */

  // The blue train blueprint, bolted to the wall where the driver can read it.
  const blueprintFrame = mesh(new THREE.BoxGeometry(0.06, 0.86, 1.2), trim);
  blueprintFrame.position.set(cab.innerHalfWidth - 0.05, cab.floorY + 1.5, cab.backZ + 1.9);
  group.add(blueprintFrame);

  const blueprintFace = mesh(
    new THREE.BoxGeometry(0.02, 0.76, 1.1),
    new THREE.MeshStandardMaterial({
      color: BLUEPRINT_BLUE,
      emissive: BLUEPRINT_BLUE,
      emissiveIntensity: 0.35,
      roughness: 0.6,
      metalness: 0.1,
    }),
  );
  blueprintFace.position.set(cab.innerHalfWidth - 0.09, cab.floorY + 1.5, cab.backZ + 1.9);
  blueprintFace.name = "blueprint-panel";
  group.add(blueprintFace);

  interactables.push({
    id: "blueprint",
    promptKey: "PROMPT_BLUEPRINT",
    box: Box.fromCentre(
      { x: cab.innerHalfWidth - 0.5, y: cab.floorY + 1.4, z: cab.backZ + 1.9 },
      { x: 1.0, y: 1.6, z: 1.4 },
    ),
  });

  /* ------------------------------------------------------- furniture */

  // Driver's seat.
  const seatBase = mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), panel);
  seatBase.position.set(-0.65, cab.floorY + 0.5, consoleZ - 0.95);
  group.add(seatBase);

  const seatBack = mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), panel);
  seatBack.position.set(-0.65, cab.floorY + 0.82, consoleZ - 1.18);
  group.add(seatBack);

  const seatPost = mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.45, 8), trim);
  seatPost.position.set(-0.65, cab.floorY + 0.24, consoleZ - 0.95);
  group.add(seatPost);

  colliders.push(
    Box.standing(
      { x: -0.65, y: cab.floorY, z: consoleZ - 1.0 },
      { x: 0.55, y: 0.56, z: 0.75 },
      { tag: "cab-seat" },
    ),
  );

  // A locker against the rear wall, and pipes along the ceiling.
  const locker = mesh(new THREE.BoxGeometry(0.5, 1.3, 0.45), panel);
  locker.position.set(-cab.innerHalfWidth + 0.3, cab.floorY + 0.65, cab.backZ + 0.4);
  group.add(locker);
  colliders.push(
    Box.standing(
      { x: -cab.innerHalfWidth + 0.3, y: cab.floorY, z: cab.backZ + 0.4 },
      { x: 0.5, y: 1.3, z: 0.45 },
      { tag: "cab-locker" },
    ),
  );

  for (const offset of [-0.55, 0.55]) {
    const pipe = mesh(new THREE.CylinderGeometry(0.05, 0.05, cab.length - 0.3, 8), trim, {
      castShadow: false,
    });
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(offset, cab.ceilingY - 0.18, cab.centreZ);
    group.add(pipe);
  }

  // Cable run down the corner.
  const cable = mesh(new THREE.CylinderGeometry(0.03, 0.03, innerHeight - 0.3, 6), trim, {
    castShadow: false,
  });
  cable.position.set(cab.innerHalfWidth - 0.12, cab.floorY + innerHeight / 2, cab.backZ + 0.4);
  group.add(cable);

  /* --------------------------------------------------------- lighting */

  // Two interior lamps. Warm, dim, and the reason the cab reads as lived-in.
  for (const z of [cab.backZ + 1.2, cab.frontZ - 1.2]) {
    const housing = mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), trim, { castShadow: false });
    housing.position.set(0, cab.ceilingY - 0.09, z);
    group.add(housing);

    const bulb = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.22), lampMaterial(0xffe9c8, 2.0), {
      castShadow: false,
    });
    bulb.position.set(0, cab.ceilingY - 0.15, z);
    bulb.name = "cab-lamp";
    group.add(bulb);

    const light = new THREE.PointLight(0xffe2b8, 14, 8, 2);
    light.position.set(0, cab.ceilingY - 0.25, z);
    light.name = "cab-light";
    group.add(light);
  }

  group.name = "cab-interior";

  /**
   * Where the player stands when a run begins: on the floor, in the middle of
   * the cab, behind the console with room to turn round.
   */
  const spawn = { x: 0.35, y: cab.floorY, z: cab.centreZ - 0.2 };

  return { group, colliders, spawn, interactables, dimensions: cab };
}
