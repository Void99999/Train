/**
 * LAST TRAIN - collision.
 *
 * Axis-aligned boxes and nothing else. The player walks through a train: a
 * sequence of rectangular rooms with rectangular fittings in them. A full
 * physics engine would buy nothing here and would cost the ability to test
 * movement without rendering a frame.
 *
 * Movement is resolved one axis at a time. That is what stops the classic
 * failures: sliding along a wall instead of sticking to it, and stepping over
 * a low sill instead of being stopped dead by it.
 *
 * All coordinates are in the train's local space. The train never moves - the
 * world scrolls past it - so a player standing in the cab has a stable
 * position no matter how far down the line the run has got.
 */

/** An axis-aligned box. Built from a centre and a size, stored as bounds. */
export class Box {
  constructor(minX, minY, minZ, maxX, maxY, maxZ, { tag = null } = {}) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
    this.tag = tag;
    /*
     * Whether this box currently stops anything.
     *
     * Almost every collider in the game is permanent, but a door has to be
     * solid when it is shut and not there at all when it is open. Rather than
     * adding and removing boxes - which would mean rebuilding the whole set
     * every time somebody opens a door - the box stays and stops counting.
     */
    this.enabled = true;
  }

  /**
   * Builds a box from a centre point and dimensions, which is how geometry is
   * described everywhere else in the project.
   */
  static fromCentre(centre, size, options) {
    return new Box(
      centre.x - size.x / 2,
      centre.y - size.y / 2,
      centre.z - size.z / 2,
      centre.x + size.x / 2,
      centre.y + size.y / 2,
      centre.z + size.z / 2,
      options,
    );
  }

  /** A box resting on the floor at `y`, which is how most fittings are placed. */
  static standing(centre, size, options) {
    return new Box(
      centre.x - size.x / 2,
      centre.y,
      centre.z - size.z / 2,
      centre.x + size.x / 2,
      centre.y + size.y,
      centre.z + size.z / 2,
      options,
    );
  }

  get centreX() {
    return (this.minX + this.maxX) / 2;
  }

  get centreZ() {
    return (this.minZ + this.maxZ) / 2;
  }

  contains(x, y, z) {
    return (
      x >= this.minX && x <= this.maxX &&
      y >= this.minY && y <= this.maxY &&
      z >= this.minZ && z <= this.maxZ
    );
  }
}

export function overlaps(a, b) {
  if (a.enabled === false || b.enabled === false) return false;
  return (
    a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ
  );
}

/**
 * The colliders the player can bump into.
 *
 * Rebuilt whenever the train's shape changes. Kept as a flat list: a train is
 * a few hundred boxes at most, and a spatial index would be complexity without
 * a measurable gain.
 */
export class ColliderSet {
  #boxes = [];

  get boxes() {
    return this.#boxes;
  }

  get size() {
    return this.#boxes.length;
  }

  add(box) {
    this.#boxes.push(box);
    return box;
  }

  addAll(boxes) {
    for (const box of boxes) this.#boxes.push(box);
    return this;
  }

  clear() {
    this.#boxes = [];
  }

  /** Boxes overlapping a probe box. Used for interaction and for tests. */
  overlapping(probe) {
    return this.#boxes.filter((box) => overlaps(probe, box));
  }
}

/**
 * The volume the player occupies: a box, not a capsule. A capsule would slide
 * around door frames more smoothly, but it would also let the player squeeze
 * through gaps a person could not, and inside a train that reads as a bug.
 */
export function bodyBox(position, radius, height) {
  return new Box(
    position.x - radius,
    position.y,
    position.z - radius,
    position.x + radius,
    position.y + height,
    position.z + radius,
  );
}

/**
 * Moves a body by `displacement`, resolving collisions one axis at a time.
 *
 * @param {{x,y,z}} position     mutated in place
 * @param {{x,y,z}} displacement how far to try to move this step
 * @param {ColliderSet} colliders
 * @param {object} body          `{ radius, height, stepHeight }`
 * @returns {{ grounded: boolean, hitCeiling: boolean, blockedX: boolean, blockedZ: boolean }}
 */
export function moveBody(position, displacement, colliders, body) {
  const radius = body.radius;

  // Split the movement into steps no longer than the body is wide.
  //
  // Without this, a single large step walks straight through a wall: the body
  // is tested only at the end of the move, and a 10-metre step ends well past
  // a 12-centimetre panel. It matters in practice too - one long frame after
  // a stall would otherwise put the player outside the train.
  const distance = Math.hypot(displacement.x, displacement.y, displacement.z);
  const maxStep = Math.max(0.05, radius * 0.75);
  const steps = Math.min(64, Math.max(1, Math.ceil(distance / maxStep)));

  const slice = {
    x: displacement.x / steps,
    y: displacement.y / steps,
    z: displacement.z / steps,
  };

  const result = { grounded: false, hitCeiling: false, blockedX: false, blockedZ: false };

  for (let i = 0; i < steps; i += 1) {
    const contact = moveBodyStep(position, slice, colliders, body);
    result.grounded = contact.grounded;
    result.hitCeiling = result.hitCeiling || contact.hitCeiling;
    result.blockedX = result.blockedX || contact.blockedX;
    result.blockedZ = result.blockedZ || contact.blockedZ;
  }

  return result;
}

/** One collision step, small enough that nothing can be tunnelled through. */
function moveBodyStep(position, displacement, colliders, body) {
  const { radius, height, stepHeight = 0.35 } = body;
  const result = { grounded: false, hitCeiling: false, blockedX: false, blockedZ: false };

  // Horizontal axes first, so a body that is falling still slides along walls.
  result.blockedX = resolveAxis(position, displacement.x, "x", colliders, {
    radius,
    height,
    stepHeight,
  });
  result.blockedZ = resolveAxis(position, displacement.z, "z", colliders, {
    radius,
    height,
    stepHeight,
  });

  if (displacement.y !== 0) {
    position.y += displacement.y;
    const box = bodyBox(position, radius, height);

    for (const collider of colliders.boxes) {
      if (!overlaps(box, collider)) continue;

      if (displacement.y <= 0) {
        // Landing - but only on something that is actually underfoot. A body
        // moving down whose head is inside a ceiling must not be snapped up
        // on top of that ceiling.
        if (collider.maxY > position.y + height * 0.5) continue;
        position.y = collider.maxY;
        result.grounded = true;
      } else {
        // Head hit the ceiling: stop just underneath it.
        position.y = collider.minY - height;
        result.hitCeiling = true;
      }
      box.minY = position.y;
      box.maxY = position.y + height;
    }
  }

  return result;
}

/**
 * Applies movement along one horizontal axis and pushes the body back out of
 * anything it ended up inside.
 *
 * A collider whose top is within `stepHeight` of the body's feet is stepped
 * onto rather than blocking - that is what lets the player walk over the low
 * sills between wagons without jumping.
 *
 * @returns {boolean} whether the movement was blocked
 */
function resolveAxis(position, amount, axis, colliders, { radius, height, stepHeight }) {
  if (amount === 0) return false;

  position[axis] += amount;
  let blocked = false;

  for (const collider of colliders.boxes) {
    const box = bodyBox(position, radius, height);
    if (!overlaps(box, collider)) continue;

    const stepUp = collider.maxY - position.y;
    if (stepUp > 0 && stepUp <= stepHeight) {
      position.y = collider.maxY;
      continue;
    }

    blocked = true;
    const min = axis === "x" ? collider.minX : collider.minZ;
    const max = axis === "x" ? collider.maxX : collider.maxZ;
    position[axis] = amount > 0 ? min - radius : max + radius;
  }

  return blocked;
}

/**
 * Finds a clear standing position near `preferred`.
 *
 * Used when placing the player at the start of a run: if the intended spot is
 * somehow occupied, the player is nudged to the nearest clear one rather than
 * being left inside a wall or dropped through the floor.
 */
export function findClearSpot(preferred, colliders, body, { searchRadius = 2.5 } = {}) {
  const isClear = (candidate) =>
    colliders.overlapping(bodyBox(candidate, body.radius, body.height)).length === 0;

  if (isClear(preferred)) return { ...preferred };

  const step = 0.25;
  for (let distance = step; distance <= searchRadius; distance += step) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const candidate = {
        x: preferred.x + Math.cos(angle) * distance,
        y: preferred.y,
        z: preferred.z + Math.sin(angle) * distance,
      };
      if (isClear(candidate)) return candidate;
    }
  }

  return { ...preferred };
}
