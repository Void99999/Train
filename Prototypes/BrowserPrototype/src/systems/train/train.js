/**
 * LAST TRAIN - the consist.
 *
 * The train is an ordered list of vehicles with the locomotive at index 0.
 * Everything the player is trying to balance meets here: length, weight,
 * armour, cargo and speed are all the same number seen from different sides.
 *
 * The rule that gives the game its teeth lives in this file. Destroy a wagon
 * in the middle of a train and everything behind it is physically cut loose -
 * it does not keep pace, it does not stay on the blueprint, and it is not
 * coming back. Losing a wagon is losing everything behind it.
 */

import { Vehicle } from "./vehicle.js";
import { GAME_EVENT } from "../../core/events.js";
import { TRAIN, UNITS } from "../../data/balance.js";
import { VEHICLE_KIND } from "../../data/wagons.js";

/**
 * A run of wagons that lost its locomotive. It keeps rolling on momentum,
 * slows down, and falls behind. Kept around only so the world can show it
 * receding - it can never be recovered.
 */
export class DetachedSection {
  constructor(vehicles, speed) {
    this.vehicles = vehicles;
    this.speed = speed;
    /** Metres behind the train, growing as the train pulls away. */
    this.distanceBehind = 0;
    vehicles.forEach((vehicle) => vehicle.markDetached());
  }

  get isStopped() {
    return this.speed <= 0.01;
  }

  update(deltaSeconds, trainSpeed) {
    this.speed = Math.max(0, this.speed - TRAIN.detachedRollingDeceleration * deltaSeconds);
    this.distanceBehind += Math.max(0, trainSpeed - this.speed) * deltaSeconds;
  }
}

export class Train {
  /** Front to back, locomotive first. Only ever contains connected vehicles. */
  vehicles = [];
  detachedSections = [];

  #throttleIndex = TRAIN.defaultThrottleIndex;
  #speed = 0;
  #distanceMetres = 0;
  #events;

  constructor({ events } = {}) {
    this.#events = events ?? null;
    this.vehicles.push(new Vehicle(VEHICLE_KIND.locomotive, 1));
  }

  get locomotive() {
    return this.vehicles[0] ?? null;
  }

  /** Everything behind the locomotive. */
  get wagons() {
    return this.vehicles.slice(1);
  }

  get wagonCount() {
    return Math.max(0, this.vehicles.length - 1);
  }

  get armouredCount() {
    return this.vehicles.filter((vehicle) => vehicle.isArmoured).length;
  }

  /** True once the locomotive is gone - this ends the run. */
  get isDead() {
    return this.locomotive === null || this.locomotive.isDestroyed;
  }

  /* ------------------------------------------------------------- throttle */

  get throttleIndex() {
    return this.#throttleIndex;
  }

  /**
   * Throttle as a fraction of top speed. Index 0 is a full stop, which the
   * driver's cabin shows as no notch selected; the four lit notches are
   * 25 / 50 / 75 / 100.
   */
  get throttleFraction() {
    return TRAIN.throttleSteps[this.#throttleIndex];
  }

  setThrottleIndex(index) {
    const clamped = Math.min(TRAIN.throttleSteps.length - 1, Math.max(0, Math.round(index)));
    if (clamped === this.#throttleIndex) return this.#throttleIndex;
    this.#throttleIndex = clamped;
    this.#events?.emit(GAME_EVENT.throttleChanged, {
      index: clamped,
      fraction: this.throttleFraction,
    });
    return clamped;
  }

  throttleUp() {
    return this.setThrottleIndex(this.#throttleIndex + 1);
  }

  throttleDown() {
    return this.setThrottleIndex(this.#throttleIndex - 1);
  }

  /* ---------------------------------------------------------- performance */

  /**
   * How much of its original performance the train still has, 0.55-1.
   *
   * Every wagon costs 3%. Every armoured vehicle costs another 2%. Loaded
   * cargo costs a little more. The floor exists so that a fully built train is
   * slow and vulnerable, never unplayable.
   */
  get performanceMultiplier() {
    const { penaltyPerWagon, penaltyPerArmouredVehicle, penaltyPerOccupiedCargoSlot, minimumMultiplier } =
      TRAIN.performance;

    const penalty =
      this.wagonCount * penaltyPerWagon +
      this.armouredCount * penaltyPerArmouredVehicle +
      this.usedCargoSlots * penaltyPerOccupiedCargoSlot;

    return Math.max(minimumMultiplier, 1 - penalty);
  }

  get maxSpeedKmh() {
    return TRAIN.baseMaxSpeedKmh * this.performanceMultiplier;
  }

  get targetSpeedMetresPerSecond() {
    return this.maxSpeedKmh * this.throttleFraction * UNITS.kmhToMetresPerSecond;
  }

  get speedMetresPerSecond() {
    return this.#speed;
  }

  get speedKmh() {
    return this.#speed / UNITS.kmhToMetresPerSecond;
  }

  get distanceMetres() {
    return this.#distanceMetres;
  }

  get distanceKm() {
    return this.#distanceMetres / UNITS.metresPerKilometre;
  }

  /** Total mass of the connected train, in tonnes. Displayed in the workshop. */
  get massTonnes() {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.massTonnes, 0);
  }

  get totalHealth() {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.health, 0);
  }

  get totalMaxHealth() {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.maxHealth, 0);
  }

  get lengthMetres() {
    return this.vehicles.reduce(
      (sum, vehicle) => sum + vehicle.spec.size.length + TRAIN.couplingLengthMetres,
      0,
    );
  }

  /* --------------------------------------------------------------- cargo */

  get cargoCapacity() {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.hold.capacity, 0);
  }

  get usedCargoSlots() {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.hold.usedSlots, 0);
  }

  get freeCargoSlots() {
    return this.cargoCapacity - this.usedCargoSlots;
  }

  quantityOf(cargoId) {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.hold.quantityOf(cargoId), 0);
  }

  /** How many units of `cargoId` the connected train could still take. */
  spaceFor(cargoId) {
    return this.vehicles.reduce((sum, vehicle) => sum + vehicle.hold.spaceFor(cargoId), 0);
  }

  /**
   * Loads cargo, filling vehicles from the front. Returns how many units were
   * actually stored, which may be fewer than asked for.
   */
  addCargo(cargoId, quantity) {
    let remaining = Math.floor(quantity);
    let stored = 0;
    for (const vehicle of this.vehicles) {
      if (remaining <= 0) break;
      const accepted = vehicle.hold.add(cargoId, remaining);
      remaining -= accepted;
      stored += accepted;
    }
    if (stored > 0) this.#events?.emit(GAME_EVENT.cargoChanged, { cargoId, delta: stored });
    return stored;
  }

  /** Unloads cargo, emptying vehicles from the front. Returns units removed. */
  removeCargo(cargoId, quantity) {
    let remaining = Math.floor(quantity);
    let taken = 0;
    for (const vehicle of this.vehicles) {
      if (remaining <= 0) break;
      const removed = vehicle.hold.remove(cargoId, remaining);
      remaining -= removed;
      taken += removed;
    }
    if (taken > 0) this.#events?.emit(GAME_EVENT.cargoChanged, { cargoId, delta: -taken });
    return taken;
  }

  /** Every cargo type currently aboard, merged across all connected vehicles. */
  cargoSummary() {
    const totals = new Map();
    for (const vehicle of this.vehicles) {
      for (const [id, quantity] of vehicle.hold.entries()) {
        totals.set(id, (totals.get(id) ?? 0) + quantity);
      }
    }
    return totals;
  }

  /**
   * The first connected vehicle carrying `cargoId`, or null.
   * The Loader uses this to work out where he has to walk - and finding
   * nothing here is exactly what happens when the wagon holding the shells has
   * been shot off the back of the train.
   */
  findCargoLocation(cargoId) {
    return this.vehicles.find((vehicle) => vehicle.hold.quantityOf(cargoId) > 0) ?? null;
  }

  /* ------------------------------------------------------------ structure */

  /** Couples a new vehicle onto the back of the train. */
  attach(vehicle) {
    this.vehicles.push(vehicle);
    this.#events?.emit(GAME_EVENT.vehicleAttached, { vehicle, index: this.vehicles.length - 1 });
    return vehicle;
  }

  indexOf(vehicle) {
    return this.vehicles.indexOf(vehicle);
  }

  /** Position of a vehicle's centre behind the front of the locomotive, in metres. */
  offsetOf(vehicle) {
    let offset = 0;
    for (const current of this.vehicles) {
      const half = current.spec.size.length / 2;
      offset += half;
      if (current === vehicle) return offset;
      offset += half + TRAIN.couplingLengthMetres;
    }
    return null;
  }

  /**
   * Routes a hit to one vehicle and deals with the consequences.
   *
   * @returns {{ applied: number, destroyed: boolean, detached: Vehicle[] }}
   */
  damageVehicle(vehicle, hit) {
    if (!this.vehicles.includes(vehicle)) {
      return { applied: 0, destroyed: false, detached: [] };
    }

    const result = vehicle.applyDamage(hit);
    if (result.applied > 0) {
      this.#events?.emit(GAME_EVENT.vehicleDamaged, { vehicle, ...result });
    }
    if (result.stateChanged) {
      this.#events?.emit(GAME_EVENT.damageStateChanged, { vehicle, state: vehicle.damageState });
    }
    if (!result.destroyed) return { ...result, detached: [] };

    const detached = this.#handleDestruction(vehicle);
    return { ...result, detached };
  }

  /**
   * A vehicle has been destroyed. It comes out of the consist, and everything
   * behind it goes with it - not deleted, but cut loose, rolling on its own
   * momentum and dropping away behind the train.
   */
  #handleDestruction(vehicle) {
    const index = this.vehicles.indexOf(vehicle);
    this.#events?.emit(GAME_EVENT.vehicleDestroyed, { vehicle, index });

    if (vehicle.isLocomotive) {
      // The run is over. Everything behind is left where it stops.
      const trailing = this.vehicles.slice(1);
      if (trailing.length > 0) this.#cutLoose(trailing);
      this.vehicles = [vehicle];
      return trailing;
    }

    const trailing = this.vehicles.slice(index + 1);
    this.vehicles = this.vehicles.slice(0, index);
    vehicle.markDetached();
    if (trailing.length > 0) this.#cutLoose(trailing);
    return trailing;
  }

  #cutLoose(vehicles) {
    const section = new DetachedSection(vehicles, this.#speed);
    this.detachedSections.push(section);
    this.#events?.emit(GAME_EVENT.vehicleDetached, { vehicles, section });
    return section;
  }

  /* --------------------------------------------------------------- update */

  /**
   * Advances the train by one step.
   * Acceleration scales with performance, so a heavy train is not merely
   * capped lower - it takes noticeably longer to get there.
   */
  update(deltaSeconds) {
    if (this.isDead) {
      this.#speed = Math.max(0, this.#speed - TRAIN.deceleration * deltaSeconds);
    } else {
      const target = this.targetSpeedMetresPerSecond;
      if (this.#speed < target) {
        this.#speed = Math.min(target, this.#speed + TRAIN.acceleration * this.performanceMultiplier * deltaSeconds);
      } else if (this.#speed > target) {
        this.#speed = Math.max(target, this.#speed - TRAIN.deceleration * deltaSeconds);
      }
    }

    this.#distanceMetres += this.#speed * deltaSeconds;

    for (const section of this.detachedSections) section.update(deltaSeconds, this.#speed);
    // Once a section is far enough back to be off screen for good, drop it.
    this.detachedSections = this.detachedSections.filter((section) => section.distanceBehind < 800);
  }

  /** Brings the train to a standstill, e.g. on arrival at an outpost. */
  halt() {
    this.setThrottleIndex(0);
    this.#speed = 0;
  }

  /** Used by the checkpoint system when a run resumes at an outpost. */
  setDistanceMetres(metres) {
    this.#distanceMetres = metres;
  }

  serialize() {
    return {
      throttleIndex: this.#throttleIndex,
      distanceMetres: this.#distanceMetres,
      vehicles: this.vehicles.map((vehicle) => vehicle.serialize()),
    };
  }

  static deserialize(data, { events } = {}) {
    const train = new Train({ events });
    train.vehicles = data.vehicles.map((entry) => Vehicle.deserialize(entry));
    train.#throttleIndex = data.throttleIndex ?? 0;
    train.#distanceMetres = data.distanceMetres ?? 0;
    // Detached sections are intentionally not restored: they are lost, and a
    // reload must not quietly hand them back.
    return train;
  }
}
