/**
 * LAST TRAIN - the Loader.
 *
 * One crew member, hired once, who does exactly one job: he carries heavy
 * artillery shells from a transport wagon to a heavy turret, one shell at a
 * time, on foot.
 *
 * Everything about him is deliberately slow and physical. He does not teleport
 * ammunition, he does not sprint, and he cannot carry two shells. The point is
 * not convenience - it is that the player feels the layout of their own train.
 * Putting the shells in the wagon directly behind the turret is worth
 * something. Putting them six wagons forward is a decision with a cost.
 *
 * And when a wagon between him and the shells is blown off the train, he
 * simply cannot get to them any more. That is not a failure state to be
 * papered over; it is the consequence the player is supposed to feel.
 */

import { LOADER } from "../../data/progression.js";

export const LOADER_STATE = {
  idle: "idle",
  walkingToAmmunition: "walking_to_ammunition",
  pickingUp: "picking_up",
  carryingToTurret: "carrying_to_turret",
  loading: "loading",
  /** He is aboard, a turret needs a shell, and he cannot reach one. */
  noAccess: "no_access",
};

/** Assignment mode: serve one named turret, or whichever needs it most. */
export const LOADER_ASSIGNMENT_AUTOMATIC = "automatic";

const SHELL_ID = "heavy_shell";

export class Loader {
  #train;
  #mounts;
  #state = LOADER_STATE.idle;
  #position = 0;
  #timer = 0;
  #carrying = 0;
  #targetVehicle = null;
  #assignment = LOADER_ASSIGNMENT_AUTOMATIC;

  constructor({ train, mounts }) {
    this.#train = train;
    this.#mounts = mounts;
  }

  get state() {
    return this.#state;
  }

  /** Metres behind the front of the locomotive. Used to draw him. */
  get position() {
    return this.#position;
  }

  get isCarryingShell() {
    return this.#carrying > 0;
  }

  get assignment() {
    return this.#assignment;
  }

  /**
   * @param {string} assignment a vehicle id, or LOADER_ASSIGNMENT_AUTOMATIC
   */
  setAssignment(assignment) {
    this.#assignment = assignment;
    // Drop the current errand so a reassignment takes effect immediately.
    if (!this.isCarryingShell) {
      this.#targetVehicle = null;
      this.#state = LOADER_STATE.idle;
      this.#timer = 0;
    }
  }

  /** Localization key describing what he is doing, for the blueprint panel. */
  get statusKey() {
    switch (this.#state) {
      case LOADER_STATE.walkingToAmmunition:
        return "BLUEPRINT_LOADER_FETCHING";
      case LOADER_STATE.pickingUp:
        return "BLUEPRINT_LOADER_FETCHING";
      case LOADER_STATE.carryingToTurret:
        return "BLUEPRINT_LOADER_CARRYING";
      case LOADER_STATE.loading:
        return "BLUEPRINT_LOADER_LOADING";
      case LOADER_STATE.noAccess:
        return "BLUEPRINT_LOADER_NO_ACCESS";
      default:
        return "BLUEPRINT_LOADER_IDLE";
    }
  }

  /**
   * The turret he should be serving: the assigned one, or in automatic mode
   * the emptiest one that is still coupled to the train.
   */
  #selectTurret() {
    const turrets = this.#mounts.heavyTurrets().filter(
      ({ weapon }) => weapon.roundsInMagazine < weapon.magazineSize,
    );
    if (turrets.length === 0) return null;

    if (this.#assignment !== LOADER_ASSIGNMENT_AUTOMATIC) {
      return turrets.find(({ vehicle }) => vehicle.id === this.#assignment) ?? null;
    }

    // Only one Loader exists, so there is no cleverness to be had here beyond
    // servicing whoever is emptiest and closest.
    return turrets.sort((a, b) => {
      const byRounds = a.weapon.roundsInMagazine - b.weapon.roundsInMagazine;
      if (byRounds !== 0) return byRounds;
      const distanceA = Math.abs((this.#train.offsetOf(a.vehicle) ?? 0) - this.#position);
      const distanceB = Math.abs((this.#train.offsetOf(b.vehicle) ?? 0) - this.#position);
      return distanceA - distanceB;
    })[0];
  }

  /**
   * Walks towards an offset. Returns true once he is there.
   * He walks. That is the entire point of him.
   */
  #walkTowards(targetOffset, deltaSeconds) {
    const step = LOADER.walkSpeed * deltaSeconds;
    const gap = targetOffset - this.#position;
    if (Math.abs(gap) <= step) {
      this.#position = targetOffset;
      return true;
    }
    this.#position += Math.sign(gap) * step;
    return false;
  }

  update(deltaSeconds) {
    const turret = this.#selectTurret();

    // Nothing to do, or the turret he was serving is gone.
    if (!turret) {
      if (!this.isCarryingShell) this.#state = LOADER_STATE.idle;
      this.#targetVehicle = null;
      return;
    }

    if (this.isCarryingShell) {
      this.#deliver(turret, deltaSeconds);
      return;
    }

    this.#fetch(deltaSeconds);
  }

  #fetch(deltaSeconds) {
    // findCargoLocation only searches the connected train, so a wagon that has
    // been cut loose simply is not found - no special case needed.
    const source = this.#train.findCargoLocation(SHELL_ID);
    if (!source) {
      this.#state = LOADER_STATE.noAccess;
      this.#targetVehicle = null;
      return;
    }

    if (this.#targetVehicle !== source) {
      this.#targetVehicle = source;
      this.#timer = 0;
      this.#state = LOADER_STATE.walkingToAmmunition;
    }

    const offset = this.#train.offsetOf(source);
    if (offset === null) {
      this.#state = LOADER_STATE.noAccess;
      return;
    }

    if (this.#state === LOADER_STATE.walkingToAmmunition) {
      if (this.#walkTowards(offset, deltaSeconds)) {
        this.#state = LOADER_STATE.pickingUp;
        this.#timer = LOADER.pickUpSeconds;
      }
      return;
    }

    if (this.#state === LOADER_STATE.pickingUp) {
      this.#timer -= deltaSeconds;
      if (this.#timer > 0) return;
      // Take exactly one. He has one pair of hands.
      const taken = source.hold.remove(SHELL_ID, LOADER.carryCapacity);
      if (taken <= 0) {
        this.#state = LOADER_STATE.idle;
        this.#targetVehicle = null;
        return;
      }
      this.#carrying = taken;
      this.#targetVehicle = null;
      this.#state = LOADER_STATE.carryingToTurret;
    }
  }

  #deliver(turret, deltaSeconds) {
    const offset = this.#train.offsetOf(turret.vehicle);
    if (offset === null) {
      // The turret he was walking to is no longer on the train. He keeps the
      // shell and will take it to whichever turret is left.
      this.#state = LOADER_STATE.carryingToTurret;
      return;
    }

    if (this.#state === LOADER_STATE.carryingToTurret) {
      if (this.#walkTowards(offset, deltaSeconds)) {
        this.#state = LOADER_STATE.loading;
        this.#timer = LOADER.loadSeconds;
      }
      return;
    }

    if (this.#state === LOADER_STATE.loading) {
      this.#timer -= deltaSeconds;
      if (this.#timer > 0) return;
      const loaded = turret.weapon.loadDirectly(this.#carrying);
      this.#carrying -= loaded;
      this.#state = LOADER_STATE.idle;
    }
  }

  serialize() {
    return {
      state: this.#state,
      position: this.#position,
      timer: this.#timer,
      carrying: this.#carrying,
      assignment: this.#assignment,
    };
  }

  restore(data) {
    if (!data) return;
    this.#state = data.state ?? LOADER_STATE.idle;
    this.#position = data.position ?? 0;
    this.#timer = data.timer ?? 0;
    this.#carrying = data.carrying ?? 0;
    this.#assignment = data.assignment ?? LOADER_ASSIGNMENT_AUTOMATIC;
    this.#targetVehicle = null;
  }
}

/**
 * The train's crew. Exactly one Loader, hired once, no levels, no upgrades.
 */
export class Crew {
  #loader = null;
  #train;
  #mounts;

  constructor({ train, mounts }) {
    this.#train = train;
    this.#mounts = mounts;
  }

  get hasLoader() {
    return this.#loader !== null;
  }

  get loader() {
    return this.#loader;
  }

  hireLoader() {
    if (this.#loader) return false;
    this.#loader = new Loader({ train: this.#train, mounts: this.#mounts });
    return true;
  }

  update(deltaSeconds) {
    this.#loader?.update(deltaSeconds);
  }

  serialize() {
    return { loader: this.#loader?.serialize() ?? null };
  }

  restore(data) {
    if (data?.loader) {
      this.hireLoader();
      this.#loader.restore(data.loader);
    }
  }
}
