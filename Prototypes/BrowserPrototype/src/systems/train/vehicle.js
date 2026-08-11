/**
 * LAST TRAIN - one locomotive or one wagon.
 *
 * A vehicle owns its condition: health, armour, upgrade level and the cargo
 * inside it. It deliberately does not own its position in the train, does not
 * emit events and does not know about the rest of the game, which is what
 * makes damage and armour behaviour testable without building a world.
 *
 * Damage runs through two filters before it reaches the hull:
 *
 *   1. What the weapon is for. Rifle rounds against rolled steel do a
 *      fraction of their paper damage; a heavy shell does all of it.
 *   2. Armour, if fitted. It takes 30% off, wears down as it works, and keeps
 *      helping a little even once the plates are shredded.
 */

import { CargoHold } from "./cargoHold.js";
import { ARMOUR, DAMAGE_STATES } from "../../data/balance.js";
import { effectivenessOf } from "../../data/damage.js";
import { VEHICLE_CATALOG, VEHICLE_KIND, vehicleSpec, maxLevel } from "../../data/wagons.js";

/** Visual condition bands. The renderer maps these onto dents, smoke and fire. */
export const DAMAGE_STATE = {
  pristine: "pristine",
  light: "light",
  medium: "medium",
  heavy: "heavy",
  critical: "critical",
  destroyed: "destroyed",
};

let nextVehicleId = 1;

/** Test hook: makes ids predictable when a test builds several trains. */
export function resetVehicleIds() {
  nextVehicleId = 1;
}

export class Vehicle {
  #kind;
  #level;
  #health;
  #armoured = false;
  #armourIntegrity = 0;
  #hold;
  #destroyed = false;
  #detached = false;

  constructor(kind, level = 1, { id = null } = {}) {
    const spec = vehicleSpec(kind, level);
    this.id = id ?? `${kind}_${nextVehicleId++}`;
    this.#kind = kind;
    this.#level = level;
    this.#health = spec.maxHealth;
    this.#hold = new CargoHold(spec.cargoSlots);
  }

  get kind() {
    return this.#kind;
  }

  get level() {
    return this.#level;
  }

  get spec() {
    return vehicleSpec(this.#kind, this.#level);
  }

  get maxHealth() {
    return this.spec.maxHealth;
  }

  get health() {
    return this.#health;
  }

  get healthFraction() {
    return this.maxHealth === 0 ? 0 : this.#health / this.maxHealth;
  }

  get missingHealth() {
    return this.maxHealth - this.#health;
  }

  get isDestroyed() {
    return this.#destroyed;
  }

  /** True once the vehicle has been cut loose from the locomotive. */
  get isDetached() {
    return this.#detached;
  }

  get isLocomotive() {
    return this.#kind === VEHICLE_KIND.locomotive;
  }

  get hold() {
    return this.#hold;
  }

  get cargoSlots() {
    return this.#hold.capacity;
  }

  get mount() {
    return this.spec.mount;
  }

  get massTonnes() {
    return this.spec.massTonnes;
  }

  get armourClass() {
    return VEHICLE_CATALOG[this.#kind].armourClass;
  }

  get isArmoured() {
    return this.#armoured;
  }

  /** Remaining armour condition, 0-1. Drives how battered the plates look. */
  get armourIntegrity() {
    if (!this.#armoured) return 0;
    const capacity = this.armourCapacity;
    return capacity === 0 ? 0 : this.#armourIntegrity / capacity;
  }

  get armourCapacity() {
    return this.maxHealth * ARMOUR.integrity.capacityFactor;
  }

  /**
   * Damage reduction actually in effect right now. Full 30% while the plates
   * are sound, falling to a quarter of that once they have been stripped -
   * shredded armour is worth something, just not much.
   */
  get armourReduction() {
    if (!this.#armoured) return 0;
    const { strippedEffectiveness } = ARMOUR.integrity;
    const scale = strippedEffectiveness + (1 - strippedEffectiveness) * this.armourIntegrity;
    return ARMOUR.damageReduction * scale;
  }

  get canUpgrade() {
    return this.#level < maxLevel(this.#kind) && !this.#destroyed;
  }

  get canFitArmour() {
    return !this.#armoured && !this.#destroyed;
  }

  /** Visual condition band, used by the renderer and the blueprint. */
  get damageState() {
    if (this.#destroyed) return DAMAGE_STATE.destroyed;
    const fraction = this.healthFraction;
    if (fraction >= DAMAGE_STATES.pristine) return DAMAGE_STATE.pristine;
    if (fraction >= DAMAGE_STATES.light) return DAMAGE_STATE.light;
    if (fraction >= DAMAGE_STATES.medium) return DAMAGE_STATE.medium;
    if (fraction >= DAMAGE_STATES.heavy) return DAMAGE_STATE.heavy;
    return DAMAGE_STATE.critical;
  }

  /**
   * Applies a hit.
   *
   * @param {object} hit
   * @param {number} hit.amount        the weapon's base damage
   * @param {string} [hit.damageClass] what kind of weapon it was
   * @returns {{ applied: number, absorbed: number, destroyed: boolean, stateChanged: boolean }}
   */
  applyDamage({ amount, damageClass = null }) {
    if (this.#destroyed || amount <= 0) {
      return { applied: 0, absorbed: 0, destroyed: false, stateChanged: false };
    }

    const stateBefore = this.damageState;
    const multiplier = damageClass ? effectivenessOf(damageClass, this.armourClass) : 1;
    const incoming = amount * multiplier;

    let absorbed = 0;
    if (this.#armoured) {
      absorbed = incoming * this.armourReduction;
      // Plates wear out from the work they do, not from what gets through.
      this.#armourIntegrity = Math.max(
        0,
        this.#armourIntegrity - incoming * ARMOUR.integrity.wearFactor,
      );
    }

    const applied = Math.min(this.#health, incoming - absorbed);
    this.#health -= applied;

    if (this.#health <= 0) {
      this.#health = 0;
      this.#destroyed = true;
    }

    return {
      applied,
      absorbed,
      destroyed: this.#destroyed,
      stateChanged: this.damageState !== stateBefore,
    };
  }

  /** Restores hull condition. Returns how much was actually restored. */
  repair(amount) {
    if (this.#destroyed || amount <= 0) return 0;
    const restored = Math.min(amount, this.missingHealth);
    this.#health += restored;
    return restored;
  }

  /**
   * Restores armour plating along with the hull. Workshops do both; a field
   * repair does not, which is why this is a separate call.
   */
  repairArmour(fraction = 1) {
    if (!this.#armoured) return 0;
    const before = this.#armourIntegrity;
    this.#armourIntegrity = Math.min(
      this.armourCapacity,
      this.#armourIntegrity + this.armourCapacity * fraction,
    );
    return this.#armourIntegrity - before;
  }

  /**
   * Raises the vehicle one level. Health scales with the hull rather than
   * being handed back for free: a wagon at 50% that gets rebuilt bigger comes
   * out of the workshop still at 50%, and the player pays to repair it.
   */
  upgrade() {
    if (!this.canUpgrade) return false;
    const fraction = this.healthFraction;
    const armourFraction = this.armourIntegrity;

    this.#level += 1;
    this.#health = this.maxHealth * fraction;
    this.#hold.setCapacity(this.spec.cargoSlots);
    if (this.#armoured) this.#armourIntegrity = this.armourCapacity * armourFraction;
    return true;
  }

  /** Bolts armour on. Once only - there are no armour levels in LAST TRAIN. */
  fitArmour() {
    if (!this.canFitArmour) return false;
    this.#armoured = true;
    this.#armourIntegrity = this.armourCapacity;
    return true;
  }

  /** Marks the vehicle as cut loose. Set by the train, never by the vehicle. */
  markDetached() {
    this.#detached = true;
  }

  serialize() {
    return {
      id: this.id,
      kind: this.#kind,
      level: this.#level,
      health: this.#health,
      armoured: this.#armoured,
      armourIntegrity: this.#armourIntegrity,
      destroyed: this.#destroyed,
      detached: this.#detached,
      hold: this.#hold.serialize(),
    };
  }

  static deserialize(data) {
    const vehicle = new Vehicle(data.kind, data.level, { id: data.id });
    vehicle.#health = data.health;
    vehicle.#armoured = Boolean(data.armoured);
    vehicle.#armourIntegrity = data.armourIntegrity ?? 0;
    vehicle.#destroyed = Boolean(data.destroyed);
    vehicle.#detached = Boolean(data.detached);
    vehicle.#hold = CargoHold.deserialize(data.hold);
    return vehicle;
  }
}
