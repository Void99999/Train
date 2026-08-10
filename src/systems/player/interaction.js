/**
 * LAST TRAIN - what the player is looking at, and what happens when they use it.
 *
 * Two jobs, deliberately separated from each other and from the renderer:
 *
 *   focus     decide which single object the player means
 *   activate  run that object's action
 *
 * Focus is not proximity. Standing near the console must not offer the
 * blueprint on the far wall, and looking at the floor must not offer anything
 * at all. An object qualifies only if it is within reach, roughly in front of
 * the player, and nearer to the centre of the view than any other candidate.
 *
 * There is exactly one focused object at a time, so the interface can never
 * show two prompts or a prompt for something behind the player.
 */

/** How far the player can reach, in metres. */
const REACH = 2.4;

/**
 * How far off centre an object may sit and still count as "looked at", as the
 * cosine of the angle.
 *
 * A single fixed cone does not work. Close up, an object at arm's length
 * subtends a wide angle - standing right at the console, the throttle quadrant
 * is below and to the left of the eye, and a 30 degree cone misses it
 * entirely, so the player cannot use the control they are standing at. Far
 * away the opposite is true: a wide cone would grab things the player is
 * clearly not looking at.
 *
 * So the cone tightens with distance: about 60 degrees within arm's reach,
 * narrowing to about 23 degrees at the far end of the range.
 */
const AIM_NEAR = 0.5;
const AIM_FAR = 0.92;

export class InteractionSystem {
  #focused = null;
  #actions = new Map();

  /** The object the player is currently looking at, or null. */
  get focused() {
    return this.#focused;
  }

  get focusedId() {
    return this.#focused?.id ?? null;
  }

  /**
   * Registers what an interactable actually does.
   * @param {string} id
   * @param {(context: object) => void} handler
   */
  register(id, handler) {
    this.#actions.set(id, handler);
  }

  get registeredIds() {
    return [...this.#actions.keys()];
  }

  /**
   * Chooses the focused object.
   *
   * @param {object} options
   * @param {{x,y,z}} options.eye        camera position
   * @param {{x,y,z}} options.forward    unit vector the player is looking along
   * @param {Array} options.interactables each with a `box` and an `id`
   * @returns {object|null} the focused entry
   */
  update({ eye, forward, interactables }) {
    let best = null;
    let bestScore = 0;

    for (const item of interactables) {
      const target = centreOf(item.box);

      const toTarget = {
        x: target.x - eye.x,
        y: target.y - eye.y,
        z: target.z - eye.z,
      };

      // Measure the distance to the box, not to its centre: a long console is
      // reachable from anywhere along it, and centre-distance would make the
      // far end unusable.
      const distance = distanceToBox(eye, item.box);
      if (distance > REACH) continue;

      const length = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
      if (length < 0.001) continue;

      const aim =
        (toTarget.x * forward.x + toTarget.y * forward.y + toTarget.z * forward.z) / length;

      if (aim < requiredAim(distance)) continue;

      // Score by how centred it is relative to what was required, so the thing
      // the player is most clearly looking at wins and only one prompt shows.
      const score = aim - requiredAim(distance);
      if (score > bestScore || best === null) {
        bestScore = score;
        best = item;
      }
    }

    this.#focused = best;
    return best;
  }

  /** Clears focus. Used when control is taken away - cutscenes, menus, death. */
  clear() {
    this.#focused = null;
  }

  /**
   * Runs the focused object's action.
   * @returns {boolean} whether anything actually happened
   */
  activate(context = {}) {
    if (!this.#focused) return false;
    const handler = this.#actions.get(this.#focused.id);
    if (!handler) {
      console.warn(`Interactable "${this.#focused.id}" has no registered action.`);
      return false;
    }
    handler({ ...context, interactable: this.#focused });
    return true;
  }
}

/** The aim threshold at a given distance: wide up close, tight far away. */
export function requiredAim(distance) {
  const t = Math.max(0, Math.min(1, distance / REACH));
  return AIM_NEAR + (AIM_FAR - AIM_NEAR) * t;
}

function centreOf(box) {
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    z: (box.minZ + box.maxZ) / 2,
  };
}

/** Shortest distance from a point to an axis-aligned box; 0 when inside. */
export function distanceToBox(point, box) {
  const dx = Math.max(box.minX - point.x, 0, point.x - box.maxX);
  const dy = Math.max(box.minY - point.y, 0, point.y - box.maxY);
  const dz = Math.max(box.minZ - point.z, 0, point.z - box.maxZ);
  return Math.hypot(dx, dy, dz);
}

export const INTERACTION_REACH = REACH;
