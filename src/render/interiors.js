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
import { metalMaterial, glassMaterial, lampMaterial, labelMaterial } from "./materials.js";

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
/**
 * Where the throttle quadrant is, given the cab.
 *
 * Both the cab that builds the quadrant and the cinematic that reaches for it
 * need these numbers, and they must agree exactly. A hand reaching for a
 * remembered position is precisely how an arm ends up inside a desk.
 *
 * @param {ReturnType<typeof cabDimensions>} cab
 */
export function throttleQuadrant(cab) {
  const consoleTop = cab.floorY + 1.0;
  const consoleZ = cab.frontZ - 0.45;
  return {
    consoleTop,
    consoleZ,
    /** The quadrant sits at the driver's edge of the desk. */
    z: consoleZ + 0.16,
    /** Top surface of the desk. Nothing reaching over it may pass below this. */
    deskTopY: consoleTop + 0.06,
    /** Height of the slot the lever runs in - the lever's pivot. */
    slotY: consoleTop + 0.145,
    /** The knob, relative to the base of the lever. */
    knobOffset: { y: 0.265, z: -0.04 },
    /**
     * Lever position along the slot. Notch 0 is idle, behind the first
     * setting; 1 to 4 are 25, 50, 75 and 100 per cent.
     */
    notchX(notch) {
      return notch <= 0 ? -1.02 : -0.81 + (notch - 1) * 0.26;
    },
  };
}

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
    /** The outer skin of the hull, where the walkway starts. */
    outerHalfWidth: width / 2,
    floorY: 1.35,
    ceilingY: 3.95,
  };
}

/**
 * The cab's side doors and the walkways outside them.
 *
 * One description shared by the wall that has the hole in it, the door that
 * fills the hole, the walkway on the other side, and the colliders for all
 * three - so they cannot end up in different places.
 *
 * @param {ReturnType<typeof cabDimensions>} cab
 */
export function sideDoorLayout(cab) {
  const centreZ = cab.backZ + 1.05;
  const width = 0.92;
  return {
    centreZ,
    width,
    minZ: centreZ - width / 2,
    maxZ: centreZ + width / 2,
    /** A low sill, so stepping out is a step and not a drop. */
    sillY: cab.floorY + 0.02,
    headY: cab.floorY + 2.06,
    /** How far the leaf slides back along the hull to open. */
    travel: 1.02,
    /** Seconds for a full open or close. */
    slideSeconds: 0.65,
    /**
     * The deck outside: flush with the cab floor, so there is no step down.
     *
     * Nine tenths of a metre is wider than a real locomotive walkway, and it
     * makes this machine a wide one. It is deliberate. The player's collision
     * volume is 0.64 m across, so a realistic 0.6 m deck leaves them wedged
     * between the hull and the railing with nowhere to move - technically
     * standing outside, unable to do anything out there. This leaves room to
     * walk about, turn, and shoot past the railing.
     */
    walkway: {
      innerX: cab.outerHalfWidth,
      outerX: cab.outerHalfWidth + 0.9,
      topY: cab.floorY,
      railingHeight: 1.06,
    },
  };
}

function mesh(geometry, material, { castShadow = true } = {}) {
  const node = new THREE.Mesh(geometry, material);
  node.castShadow = castShadow;
  node.receiveShadow = true;
  return node;
}

/**
 * Builds a wall with rectangular openings cut through it, as panels around
 * the holes. Used for windows and doorways.
 *
 * Openings must not overlap; they are laid out along the wall in order and
 * the solid panels fill the gaps between them.
 *
 * @param {object} options
 * @param {"x"|"z"} options.axis     which way the wall faces
 * @param {object[]} options.openings `{ centre, width, bottom, top }`, in
 *                                    wall-local terms
 */
function wallWithOpenings({ axis, span, height, base, openings, material, thickness = WALL }) {
  const group = new THREE.Group();
  const pieces = [];

  const spanHalf = span / 2;

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

  const sorted = [...openings].sort((a, b) => a.centre - b.centre);

  // Full-height panels filling the gaps: before the first opening, between
  // each pair, and after the last.
  let cursor = -spanHalf;
  for (const opening of sorted) {
    const left = opening.centre - opening.width / 2;
    add((cursor + left) / 2, left - cursor, base, base + height);
    cursor = opening.centre + opening.width / 2;
  }
  add((cursor + spanHalf) / 2, spanHalf - cursor, base, base + height);

  // The sill under each opening and the header over it.
  for (const opening of sorted) {
    add(opening.centre, opening.width, base, base + opening.bottom);
    add(opening.centre, opening.width, base + opening.top, base + height);
  }

  return { group, pieces };
}

/**
 * One cab side door: the frame around the opening, and the leaf that fills it.
 *
 * The leaf rides on an external rail and slides back along the hull, which is
 * the only arrangement that works here - a door hinged inward would sweep
 * through the driver's seat, and one hinged outward would foul the walkway
 * railing the moment it opened.
 *
 * The returned group's name is what the world looks up to animate it, and its
 * `slide` child is the part that actually moves; the frame stays put.
 */
function buildSideDoor({ cab, doorway, side, panel, trim, handworn, glass }) {
  const name = side > 0 ? "right" : "left";
  const group = new THREE.Group();
  group.name = `cab-side-door-${name}`;

  const jambX = side * cab.innerHalfWidth;
  // Just proud of the outer skin, so the leaf passes outside the wall.
  const leafX = side * (cab.outerHalfWidth + 0.05);
  const height = doorway.headY - doorway.sillY;

  /* ------------------------------------------------------------- frame */

  for (const edge of [-1, 1]) {
    const jamb = mesh(new THREE.BoxGeometry(0.16, height + 0.12, 0.07), trim);
    jamb.position.set(jambX, (doorway.sillY + doorway.headY) / 2, doorway.centreZ + edge * (doorway.width / 2 + 0.035));
    group.add(jamb);
  }

  const lintel = mesh(new THREE.BoxGeometry(0.16, 0.08, doorway.width + 0.14), trim);
  lintel.position.set(jambX, doorway.headY + 0.04, doorway.centreZ);
  group.add(lintel);

  // A worn threshold plate, because this is where every boot lands.
  const threshold = mesh(new THREE.BoxGeometry(0.3, 0.03, doorway.width), handworn, {
    castShadow: false,
  });
  threshold.position.set(side * (cab.innerHalfWidth + 0.03), doorway.sillY, doorway.centreZ);
  group.add(threshold);

  // The rail the leaf hangs from, long enough to carry it fully open.
  const rail = mesh(
    new THREE.BoxGeometry(0.05, 0.06, doorway.width + doorway.travel + 0.2),
    trim,
  );
  rail.position.set(
    side * (cab.outerHalfWidth + 0.09),
    doorway.headY + 0.11,
    doorway.centreZ - doorway.travel / 2,
  );
  group.add(rail);

  /* -------------------------------------------------------------- leaf */

  const slide = new THREE.Group();
  slide.name = `cab-side-door-${name}-slide`;
  group.add(slide);

  const leaf = mesh(new THREE.BoxGeometry(0.07, height, doorway.width - 0.02), panel);
  leaf.position.set(leafX, (doorway.sillY + doorway.headY) / 2, doorway.centreZ);
  slide.add(leaf);

  // Pressed ribs across the lower half, the way a steel door is stiffened.
  for (let i = 0; i < 3; i += 1) {
    const rib = mesh(new THREE.BoxGeometry(0.02, 0.05, doorway.width - 0.16), trim, {
      castShadow: false,
    });
    rib.position.set(
      leafX + side * 0.045,
      doorway.sillY + 0.3 + i * 0.22,
      doorway.centreZ,
    );
    slide.add(rib);
  }

  // A window in the upper half, so a closed door is not a blank plate.
  const port = mesh(new THREE.BoxGeometry(0.04, 0.5, doorway.width - 0.28), glass, {
    castShadow: false,
  });
  port.position.set(leafX, doorway.headY - 0.5, doorway.centreZ);
  slide.add(port);

  const portFrame = mesh(new THREE.BoxGeometry(0.05, 0.58, doorway.width - 0.2), trim, {
    castShadow: false,
  });
  portFrame.position.set(leafX + side * 0.005, doorway.headY - 0.5, doorway.centreZ);
  slide.add(portFrame);

  // The pull handle, on both faces so it can be worked from either side.
  for (const face of [-1, 1]) {
    const handle = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), handworn);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(leafX + side * face * 0.06, doorway.sillY + 1.02, doorway.centreZ + 0.2);
    slide.add(handle);

    for (const end of [-1, 1]) {
      const bracket = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), handworn, { castShadow: false });
      bracket.position.set(
        leafX + side * face * 0.032,
        doorway.sillY + 1.02,
        doorway.centreZ + 0.2 + end * 0.16,
      );
      slide.add(bracket);
    }
  }

  // Hangers connecting the leaf to its rail.
  for (const end of [-1, 1]) {
    const hanger = mesh(new THREE.BoxGeometry(0.04, 0.14, 0.05), trim, { castShadow: false });
    hanger.position.set(
      side * (cab.outerHalfWidth + 0.08),
      doorway.headY + 0.04,
      doorway.centreZ + end * (doorway.width / 2 - 0.1),
    );
    slide.add(hanger);
  }

  return group;
}

/**
 * The walkways outside the cab doors.
 *
 * Not decoration: these are floors the player stands on, with railings that
 * stop them stepping off a moving train. They live here rather than with the
 * hull because everything the player can stand on is built in one place, next
 * to the collider that makes it solid.
 *
 * @returns {{ group: THREE.Group, colliders: Box[] }}
 */
export function buildSideWalkways(size, { frame, trim }) {
  const cab = cabDimensions(size);
  const doorway = sideDoorLayout(cab);
  const deck = doorway.walkway;

  const group = new THREE.Group();
  const colliders = [];

  // Runs from behind the cab up to the front buffer beam, so the player can
  // work their way along the hood as well as stand by the door.
  const backZ = -size.length / 2 + 0.25;
  const frontZ = size.length / 2 - 0.25;
  const deckLength = frontZ - backZ;
  const deckCentreZ = (backZ + frontZ) / 2;
  const deckWidth = deck.outerX - deck.innerX;
  const deckCentreX = (deck.innerX + deck.outerX) / 2;

  for (const side of [-1, 1]) {
    const name = side > 0 ? "right" : "left";

    // The deck plate. Its top face is exactly the cab floor's height, so
    // stepping out of the door is a step across rather than a step down.
    const plate = mesh(new THREE.BoxGeometry(deckWidth, 0.06, deckLength), frame, {
      castShadow: false,
    });
    plate.position.set(side * deckCentreX, deck.topY - 0.03, deckCentreZ);
    group.add(plate);

    // Grating bars, laid across the deck. Coarse enough to be cheap, fine
    // enough to read as grating rather than as a plank.
    const barSpacing = 0.34;
    const bars = Math.floor(deckLength / barSpacing);
    for (let i = 0; i <= bars; i += 1) {
      const bar = mesh(new THREE.BoxGeometry(deckWidth - 0.04, 0.02, 0.05), trim, {
        castShadow: false,
      });
      bar.position.set(side * deckCentreX, deck.topY + 0.01, backZ + i * barSpacing);
      group.add(bar);
    }

    // Edge stringers along both sides of the deck.
    for (const edge of [deck.innerX + 0.02, deck.outerX - 0.02]) {
      const stringer = mesh(new THREE.BoxGeometry(0.05, 0.09, deckLength), trim, {
        castShadow: false,
      });
      stringer.position.set(side * edge, deck.topY - 0.02, deckCentreZ);
      group.add(stringer);
    }

    // Support brackets under the deck, back to the frame.
    for (let i = 0; i < 9; i += 1) {
      const bracket = mesh(new THREE.BoxGeometry(deckWidth, 0.06, 0.08), frame, {
        castShadow: false,
      });
      bracket.position.set(
        side * deckCentreX,
        deck.topY - 0.16,
        backZ + 0.4 + (i * (deckLength - 0.8)) / 8,
      );
      group.add(bracket);
    }

    group.add(buildWalkwayRailing({ side, deck, doorway, backZ, frontZ, trim }));
    group.add(buildBoardingSteps({ side, deck, doorway, frame, trim }));

    /* --------------------------------------------------------- colliders */

    colliders.push(
      // The deck. Reaches back under the hull skin so there is no seam
      // between the cab floor and the walkway for a boot to fall through.
      new Box(
        side > 0 ? cab.innerHalfWidth : -deck.outerX,
        deck.topY - 0.12,
        backZ,
        side > 0 ? deck.outerX : -cab.innerHalfWidth,
        deck.topY,
        frontZ,
        { tag: `walkway-${name}` },
      ),
      // The railing. A wall, so nobody walks off the side of a moving train.
      new Box(
        side > 0 ? deck.outerX - 0.06 : -deck.outerX - 0.06,
        deck.topY,
        backZ,
        side > 0 ? deck.outerX + 0.06 : -deck.outerX + 0.06,
        deck.topY + deck.railingHeight,
        frontZ,
        { tag: `walkway-railing-${name}` },
      ),
    );

    // And gates across both ends, so the walkway is closed off.
    for (const [end, z] of [["back", backZ], ["front", frontZ]]) {
      colliders.push(
        new Box(
          side > 0 ? cab.innerHalfWidth : -deck.outerX,
          deck.topY,
          z - 0.06,
          side > 0 ? deck.outerX : -cab.innerHalfWidth,
          deck.topY + deck.railingHeight,
          z + 0.06,
          { tag: `walkway-end-${name}-${end}` },
        ),
      );
    }
  }

  return { group, colliders };
}

/**
 * Posts, two rails and a toe board along the outer edge of a walkway, with a
 * boarding gap opposite the door.
 *
 * The gap is how anyone gets on or off the machine, and it is where the
 * protagonist climbs aboard in the intro. It is closed by a chain rather than
 * left as a hole: the railing's collider runs unbroken along the whole deck,
 * because a moving train with a gap in its railing and no fall handling
 * underneath it is a way to lose the player through the floor of the world.
 */
function buildWalkwayRailing({ side, deck, doorway, backZ, frontZ, trim }) {
  const group = new THREE.Group();
  const x = side * deck.outerX;

  const gapStart = doorway.minZ - 0.12;
  const gapEnd = doorway.maxZ + 0.12;

  /** A run of railing between two points along the deck. */
  const railRun = (fromZ, toZ) => {
    const runLength = toZ - fromZ;
    if (runLength <= 0.05) return;
    const runCentre = (fromZ + toZ) / 2;

    for (const height of [deck.railingHeight, deck.railingHeight * 0.55]) {
      const rail = mesh(new THREE.CylinderGeometry(0.026, 0.026, runLength, 6), trim, {
        castShadow: false,
      });
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, deck.topY + height, runCentre);
      group.add(rail);
    }

    // Toe board - what stops a dropped magazine going over the side.
    const toe = mesh(new THREE.BoxGeometry(0.03, 0.11, runLength), trim, { castShadow: false });
    toe.position.set(x, deck.topY + 0.055, runCentre);
    group.add(toe);

    const posts = Math.max(2, Math.round(runLength / 1.3));
    for (let i = 0; i < posts; i += 1) {
      const post = mesh(new THREE.CylinderGeometry(0.028, 0.032, deck.railingHeight, 6), trim);
      post.position.set(x, deck.topY + deck.railingHeight / 2, fromZ + (i * runLength) / (posts - 1));
      group.add(post);
    }
  };

  railRun(backZ, gapStart);
  railRun(gapEnd, frontZ);

  // Stout grab irons either side of the gap, standing proud of the railing -
  // the things you actually haul yourself up by.
  for (const z of [gapStart, gapEnd]) {
    const grabIron = mesh(
      new THREE.CylinderGeometry(0.032, 0.034, deck.railingHeight + 0.55, 8),
      trim,
    );
    grabIron.position.set(x, deck.topY + (deck.railingHeight + 0.55) / 2 - 0.2, z);
    group.add(grabIron);
  }

  // The chain across the gap, hung as two segments meeting low in the middle.
  const gapMiddle = (gapStart + gapEnd) / 2;
  const chainDrop = 0.14;
  for (const height of [deck.railingHeight, deck.railingHeight * 0.55]) {
    for (const end of [gapStart, gapEnd]) {
      const span = Math.abs(gapMiddle - end);
      const link = mesh(new THREE.CylinderGeometry(0.014, 0.014, Math.hypot(span, chainDrop), 5), trim, {
        castShadow: false,
      });
      link.rotation.x = Math.PI / 2;
      link.rotation.y = 0;
      link.position.set(x, deck.topY + height - chainDrop / 2, (gapMiddle + end) / 2);
      // Tip it so the two halves meet at the sag in the middle.
      link.rotation.x = Math.PI / 2 + Math.atan2(chainDrop, span) * (end < gapMiddle ? -1 : 1);
      group.add(link);
    }
  }

  // End rails, closing the walkway off at both ends.
  for (const z of [backZ, frontZ]) {
    const endRail = mesh(new THREE.CylinderGeometry(0.026, 0.026, deck.outerX - deck.innerX, 6), trim, {
      castShadow: false,
    });
    endRail.rotation.z = Math.PI / 2;
    endRail.position.set(side * (deck.innerX + deck.outerX) / 2, deck.topY + deck.railingHeight, z);
    group.add(endRail);

    const endPost = mesh(new THREE.CylinderGeometry(0.028, 0.032, deck.railingHeight, 6), trim, {
      castShadow: false,
    });
    endPost.position.set(side * deck.innerX, deck.topY + deck.railingHeight / 2, z);
    group.add(endPost);
  }

  // A grab handle on the hull beside the doorway, for the same reason.
  const hullGrab = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.9, 6), trim);
  hullGrab.position.set(side * (deck.innerX + 0.06), deck.topY + 1.35, doorway.maxZ + 0.16);
  group.add(hullGrab);

  return group;
}

/**
 * The steps under the boarding gap.
 *
 * Visual only, and honestly so: the railing's collider runs across the gap, so
 * the player never reaches them. They are here because a walkway a metre and a
 * half off the ballast with no way up to it looks wrong, and because the intro
 * climbs them on camera.
 */
function buildBoardingSteps({ side, deck, doorway, frame, trim }) {
  const group = new THREE.Group();
  const treads = 3;

  for (let i = 0; i < treads; i += 1) {
    const drop = (i + 1) * 0.34;
    const tread = mesh(new THREE.BoxGeometry(0.5, 0.04, doorway.width * 0.85), frame, {
      castShadow: false,
    });
    tread.position.set(side * (deck.outerX - 0.22), deck.topY - drop, doorway.centreZ);
    group.add(tread);
  }

  // Stringers carrying the treads, back up to the deck.
  for (const edge of [-1, 1]) {
    const stringer = mesh(new THREE.BoxGeometry(0.05, 1.15, 0.06), trim, { castShadow: false });
    stringer.position.set(
      side * (deck.outerX - 0.22),
      deck.topY - 0.55,
      doorway.centreZ + edge * doorway.width * 0.42,
    );
    group.add(stringer);
  }

  return group;
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
  // Wear is placed where wear happens rather than sprayed over everything.
  // Walls are mostly sound with grime gathering toward the bottom; the floor
  // is scuffed all over; handrails and door edges are polished back to bare
  // metal by hands; the machinery bay is oily.
  const paint = metalMaterial({
    colour: INTERIOR_GREEN,
    wear: 0.06,
    seed: 210,
    repeat: 2,
    // One tile top to bottom, so the grime gradient runs once up the wall.
    repeatY: 1,
    grimeBias: 0.34,
  });
  const floorMaterial = metalMaterial({ colour: FLOOR_STEEL, wear: 0.4, seed: 211, repeat: 4 });
  const panel = metalMaterial({ colour: PANEL_GREY, wear: 0.16, seed: 212, repeat: 2 });
  const trim = metalMaterial({ colour: 0x5a5b58, wear: 0.22, seed: 213, repeat: 1 });
  // Touched constantly: worn bright rather than dirty.
  const handworn = metalMaterial({ colour: 0x8d8f8a, wear: 0.5, seed: 214, repeat: 1, metalness: 0.95 });
  // Down at boot level, behind the console, near the machinery.
  const grimy = metalMaterial({ colour: 0x3a3c38, wear: 0.62, seed: 215, repeat: 2 });
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
  const front = wallWithOpenings({
    axis: "z",
    span: innerWidth,
    height: innerHeight,
    base: cab.floorY,
    // Wider and taller than it was. The driver has to be able to see the
    // track, and a letterbox slot high on the wall does not do that.
    openings: [{ centre: 0, width: 2.3, bottom: 1.05, top: 2.2 }],
    material: paint,
  });
  front.group.position.set(0, 0, cab.frontZ);
  group.add(front.group);

  const windscreen = mesh(new THREE.BoxGeometry(2.3, 1.15, 0.04), glass, { castShadow: false });
  windscreen.position.set(0, cab.floorY + 1.625, cab.frontZ);
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
  const rear = wallWithOpenings({
    axis: "z",
    span: innerWidth,
    height: innerHeight,
    base: cab.floorY,
    openings: [{ centre: 0, width: 0.95, bottom: 0.02, top: 2.05 }],
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
      { x: 0, y: cab.floorY + 1.0, z: cab.backZ + 0.12 },
      { x: 0.95, y: 2.0, z: 0.25 },
    ),
  });

  /* ------------------------------------------- side walls and doorways */

  /*
   * Each side wall carries two holes: the driver's window, and a doorway out
   * onto the walkway. Both are cut through the wall itself. What used to be
   * here was a solid wall with a flat panel stuck to the inside of it, which
   * is why the doors read as black rectangles - there was nothing behind them.
   */
  const doorway = sideDoorLayout(cab);
  // Wall-local coordinates run along z from the wall group's centre.
  const doorLocalZ = doorway.centreZ - cab.centreZ;

  for (const side of [-1, 1]) {
    const name = side > 0 ? "right" : "left";
    const x = side * cab.innerHalfWidth;

    const wall = wallWithOpenings({
      axis: "x",
      span: cab.length,
      height: innerHeight,
      base: cab.floorY,
      openings: [
        { centre: 0.35, width: 1.5, bottom: 1.15, top: 2.0 },
        {
          centre: doorLocalZ,
          width: doorway.width,
          bottom: doorway.sillY - cab.floorY,
          top: doorway.headY - cab.floorY,
        },
      ],
      material: paint,
    });
    wall.group.position.set(x, 0, cab.centreZ);
    group.add(wall.group);

    const window = mesh(new THREE.BoxGeometry(0.04, 0.85, 1.5), glass, { castShadow: false });
    window.position.set(x, cab.floorY + 1.58, cab.centreZ + 0.35);
    group.add(window);

    group.add(buildSideDoor({ cab, doorway, side, panel, trim, handworn, glass }));

    /*
     * The wall is solid either side of the doorway and nowhere else. Three
     * boxes instead of one, because a single wall-length collider would seal
     * the opening the player is meant to walk through.
     */
    colliders.push(
      new Box(
        x - WALL / 2, cab.floorY, cab.backZ,
        x + WALL / 2, cab.ceilingY, doorway.minZ,
        { tag: `cab-wall-${name}-rear` },
      ),
      new Box(
        x - WALL / 2, cab.floorY, doorway.maxZ,
        x + WALL / 2, cab.ceilingY, cab.frontZ,
        { tag: `cab-wall-${name}-front` },
      ),
      // Over the top of the doorway, so nothing can be walked through up there.
      new Box(
        x - WALL / 2, doorway.headY, doorway.minZ,
        x + WALL / 2, cab.ceilingY, doorway.maxZ,
        { tag: `cab-wall-${name}-header` },
      ),
    );

    /*
     * The leaf itself. Toggled by the world as the door slides, so a closed
     * door stops the player and an open one does not. Everything else in the
     * cab is static; this is the one collider that changes during play.
     */
    colliders.push(
      new Box(
        x - WALL / 2, doorway.sillY, doorway.minZ,
        x + WALL / 2, doorway.headY, doorway.maxZ,
        { tag: `cab-side-door-${name}` },
      ),
    );

    interactables.push({
      id: `side-door-${name}`,
      promptKey: "PROMPT_OPEN_DOOR",
      box: Box.fromCentre(
        { x: side * (cab.innerHalfWidth - 0.14), y: cab.floorY + 1.05, z: doorway.centreZ },
        { x: 0.34, y: 1.9, z: doorway.width },
      ),
    });

    // Grab handles beside the doorway, on the inside.
    const grab = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), handworn);
    grab.position.set(x - side * 0.09, cab.floorY + 1.5, doorway.maxZ + 0.22);
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

  /*
   * The throttle quadrant. Four detents in a machined slot with the settings
   * stencilled beside them, rather than four cubes sitting on a table.
   */
  // Right at the driver's edge of the desk, with clear air between the eye and
  // the markings.
  const quadrantLayout = throttleQuadrant(cab);
  const quadrantZ = quadrantLayout.z;
  const quadrant = mesh(new THREE.BoxGeometry(1.5, 0.1, 0.34), panel);
  quadrant.position.set(-0.54, consoleTop + 0.09, quadrantZ);
  group.add(quadrant);

  // The slot the lever runs in. It reaches back past the first setting,
  // because the lever has to have somewhere to sit when the engine is idle.
  const slot = mesh(new THREE.BoxGeometry(1.3, 0.03, 0.06), grimy, { castShadow: false });
  slot.position.set(-0.54, quadrantLayout.slotY, quadrantZ);
  group.add(slot);

  const notchLabels = ["25", "50", "75", "100"];
  for (let i = 0; i < 4; i += 1) {
    const x = quadrantLayout.notchX(i + 1);

    // A detent in the quadrant.
    const detent = mesh(new THREE.BoxGeometry(0.035, 0.05, 0.1), handworn, { castShadow: false });
    detent.position.set(x, consoleTop + 0.15, quadrantZ - 0.07);
    group.add(detent);

    // The stencilled setting, lying flat on the quadrant so it can be read
    // from the driver's position.
    const plate = mesh(
      new THREE.PlaneGeometry(0.16, 0.09),
      labelMaterial(notchLabels[i], { width: 192, height: 108, fontSize: 74 }),
      { castShadow: false },
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(x, consoleTop + 0.146, quadrantZ + 0.1);
    group.add(plate);

    // The indicator lamp for that setting. Dark until selected - a lamp
    // material at zero emissive still shows its base colour, which made every
    // notch look permanently lit.
    const light = mesh(
      new THREE.BoxGeometry(0.055, 0.02, 0.055),
      new THREE.MeshStandardMaterial({
        color: 0x1a1d1a,
        emissive: 0x8fbf63,
        emissiveIntensity: 0,
        roughness: 0.45,
      }),
      { castShadow: false },
    );
    light.position.set(x, consoleTop + 0.152, quadrantZ - 0.14);
    light.name = `throttle-light-${i + 1}`;
    group.add(light);
  }

  /*
   * The throttle lever.
   *
   * Built as a group pivoting at the slot so it can travel along the quadrant
   * - it starts at idle, behind the first setting, and the driver pushes it
   * forward. A lever welded permanently to one notch is a decoration; this is
   * a control, and it reads the throttle the player has actually selected.
   */
  const throttleLever = new THREE.Group();
  throttleLever.name = "throttle-lever";
  throttleLever.position.set(quadrantLayout.notchX(0), quadrantLayout.slotY, quadrantZ);

  const leverShaft = mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 8), handworn);
  leverShaft.rotation.x = -0.25;
  leverShaft.position.set(0, 0.125, 0);
  throttleLever.add(leverShaft);

  const throttleKnob = mesh(new THREE.SphereGeometry(0.045, 10, 8), panel);
  throttleKnob.position.set(0, quadrantLayout.knobOffset.y, quadrantLayout.knobOffset.z);
  throttleLever.add(throttleKnob);

  group.add(throttleLever);

  // The brake handle, for weight rather than function.
  const lever = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 8), trim);
  lever.rotation.x = -0.35;
  lever.position.set(0.7, consoleTop + 0.28, consoleZ);
  group.add(lever);

  const leverKnob = mesh(new THREE.SphereGeometry(0.07, 10, 8), panel);
  leverKnob.position.set(0.7, consoleTop + 0.52, consoleZ - 0.08);
  group.add(leverKnob);

  /*
   * The instrument cluster, angled toward the driver on a raised binnacle.
   * The large dial on the left is the speedometer; its needle is driven by the
   * simulation, so the cab reports the same speed the HUD does.
   */
  // The binnacle is kept low and set back so it frames the windscreen rather
  // than blocking it.
  const binnacle = mesh(new THREE.BoxGeometry(1.05, 0.26, 0.2), panel);
  binnacle.rotation.x = -0.3;
  binnacle.position.set(-0.62, consoleTop + 0.17, consoleZ - 0.28);
  group.add(binnacle);

  /*
   * The driver stands behind the console at more negative z and looks along
   * +z, so the dials have to face -z. A CircleGeometry faces +z by default,
   * which pointed every instrument at the front wall instead of at the driver.
   */
  const gaugeAngle = Math.PI / 2 + 0.55;
  const gaugeSpecs = [
    { x: -0.95, radius: 0.13, label: "km/h", name: "gauge-speed" },
    { x: -0.62, radius: 0.085, label: "BAR", name: "gauge-pressure" },
    { x: -0.38, radius: 0.085, label: "TEMP", name: "gauge-temperature" },
  ];

  for (const spec of gaugeSpecs) {
    const bezel = mesh(
      new THREE.CylinderGeometry(spec.radius + 0.018, spec.radius + 0.018, 0.05, 18),
      handworn,
    );
    bezel.rotation.x = gaugeAngle;
    bezel.position.set(spec.x, consoleTop + 0.20, consoleZ - 0.275);
    group.add(bezel);

    const face = mesh(
      new THREE.CircleGeometry(spec.radius, 20),
      labelMaterial(spec.label, {
        colour: "#d9d2bd",
        background: "#15181a",
        width: 160,
        height: 160,
        fontSize: 34,
        emissive: 0.5,
      }),
      { castShadow: false },
    );
    face.rotation.set(0.55, Math.PI, 0);
    face.position.set(spec.x, consoleTop + 0.215, consoleZ - 0.245);
    group.add(face);

    // The needle. Pivots at the centre of the dial.
    const needlePivot = new THREE.Group();
    needlePivot.rotation.set(0.55, Math.PI, 0);
    needlePivot.position.set(spec.x, consoleTop + 0.218, consoleZ - 0.24);

    const needle = mesh(
      new THREE.BoxGeometry(0.008, spec.radius * 0.82, 0.006),
      new THREE.MeshStandardMaterial({
        color: 0xd8503a,
        emissive: 0xd8503a,
        emissiveIntensity: 0.5,
        roughness: 0.5,
      }),
      { castShadow: false },
    );
    needle.position.y = spec.radius * 0.36;
    needlePivot.add(needle);
    needlePivot.name = spec.name;
    group.add(needlePivot);
  }

  // The volume is the throttle quadrant itself, not a room-sized bubble.
  // Interaction is decided by looking at the object; the volume only says
  // where the object is.
  interactables.push({
    id: "throttle",
    promptKey: "PROMPT_DRIVE",
    box: Box.fromCentre(
      { x: -0.42, y: consoleTop + 0.18, z: quadrantZ },
      { x: 1.25, y: 0.4, z: 0.4 },
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
    // The panel on the wall, and nothing else.
    box: Box.fromCentre(
      { x: cab.innerHalfWidth - 0.09, y: cab.floorY + 1.5, z: cab.backZ + 1.9 },
      { x: 0.2, y: 0.9, z: 1.2 },
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

    const bulb = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.22), lampMaterial(0xffe9c8, 2.6), {
      castShadow: false,
    });
    bulb.position.set(0, cab.ceilingY - 0.15, z);
    bulb.name = "cab-lamp";
    group.add(bulb);

    // Trimmed back from what it was. The cab has to be lit well enough to
    // work in, but a bright lamp a metre from the windscreen is half of why
    // the glass was unusable - the other half was the glass itself.
    const light = new THREE.PointLight(0xffe2b8, 19, 11, 2);
    light.position.set(0, cab.ceilingY - 0.25, z);
    light.name = "cab-light";
    group.add(light);
  }

  // A very dim fill from the middle of the room. It has no fixture because it
  // is not a lamp - it stands in for light bouncing around a small steel box,
  // and it is what stops the corners going to pure black at night.
  const fill = new THREE.PointLight(0xbfd0e0, 6, 9, 1.4);
  fill.position.set(0, cab.floorY + 1.6, cab.centreZ);
  group.add(fill);

  group.name = "cab-interior";

  /**
   * Where the player stands when a run begins: on the floor, in the middle of
   * the cab, behind the console with room to turn round.
   */
  /* -------------------------------------------------- structural framing */

  // Vertical ribs down the side walls, and a kick plate at boot height. Both
  // are what stops a wall reading as a flat painted rectangle.
  for (const side of [-1, 1]) {
    const x = side * (cab.innerHalfWidth - 0.04);

    for (let i = 0; i < 5; i += 1) {
      const rib = mesh(
        new THREE.BoxGeometry(0.05, innerHeight - 0.2, 0.09),
        trim,
        { castShadow: false },
      );
      rib.position.set(x, cab.floorY + innerHeight / 2, cab.backZ + 0.55 + i * 0.95);
      group.add(rib);
    }

    const kickPlate = mesh(
      new THREE.BoxGeometry(0.05, 0.28, cab.length - 0.2),
      grimy,
      { castShadow: false },
    );
    kickPlate.position.set(x, cab.floorY + 0.14, cab.centreZ);
    group.add(kickPlate);

    // Bolt heads along the rib line.
    for (let i = 0; i < 7; i += 1) {
      const bolt = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6), handworn, {
        castShadow: false,
      });
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(x - side * 0.03, cab.floorY + 1.95, cab.backZ + 0.4 + i * 0.65);
      group.add(bolt);
    }
  }

  // Conduit and pipework running the length of the cab at shoulder height.
  for (const [offset, radius] of [[0.05, 0.045], [-0.05, 0.03]]) {
    const conduit = mesh(
      new THREE.CylinderGeometry(radius, radius, cab.length - 0.25, 8),
      trim,
      { castShadow: false },
    );
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(cab.innerHalfWidth - 0.14 + offset, cab.floorY + 2.15, cab.centreZ);
    group.add(conduit);
  }

  /* --------------------------------------------------- switches and dials */

  // A small switch bank on the side wall by the driver.
  const switchPlate = mesh(new THREE.BoxGeometry(0.05, 0.34, 0.55), panel);
  switchPlate.position.set(-cab.innerHalfWidth + 0.05, cab.floorY + 1.42, consoleZ + 0.5);
  group.add(switchPlate);

  for (let i = 0; i < 4; i += 1) {
    const toggle = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6), handworn);
    toggle.rotation.z = Math.PI / 2 + (i % 2 ? 0.4 : -0.4);
    toggle.position.set(
      -cab.innerHalfWidth + 0.1,
      cab.floorY + 1.5,
      consoleZ + 0.68 - i * 0.12,
    );
    group.add(toggle);
  }

  // Two warning lamps above the switch bank: one amber, one red.
  for (const [i, colour] of [[0, 0xd08a2a], [1, 0xa33228]]) {
    const lens = mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10),
      lampMaterial(colour, 0.35),
      { castShadow: false },
    );
    lens.rotation.z = Math.PI / 2;
    lens.position.set(-cab.innerHalfWidth + 0.09, cab.floorY + 1.68, consoleZ + 0.6 - i * 0.14);
    lens.name = `warning-lamp-${i}`;
    group.add(lens);
  }

  const spawn = { x: 0.35, y: cab.floorY, z: cab.centreZ - 0.2 };

  return { group, colliders, spawn, interactables, dimensions: cab };
}
