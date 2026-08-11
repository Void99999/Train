/**
 * LAST TRAIN - the train workshop.
 *
 * Everything structural happens here: buying wagons, upgrading them, bolting
 * armour on, repairing damage, hiring the Loader. It never opens by itself -
 * the player walks to the workbench at an outpost and interacts with the
 * blueprint, because arriving at a station should feel like arriving somewhere,
 * not like a menu opening.
 *
 * `preview()` answers the question the player actually has before they spend
 * 500 on a wagon: what does this do to my train? It reports the same statistics
 * as the current train, computed as if the purchase had already happened, so
 * the interface can show both side by side without guessing at the arithmetic.
 */

import { Vehicle } from "../train/vehicle.js";
import {
  VEHICLE_KIND,
  armourPrice,
  purchasePrice,
  upgradePrice,
  vehicleSpec,
  maxLevel,
} from "../../data/wagons.js";
import { LOADER, UPGRADE_UNLOCKS, UNLOCK, VEHICLE_UNLOCKS } from "../../data/progression.js";
import { ECONOMY, TRAIN, ARMOUR } from "../../data/balance.js";
import { GAME_EVENT } from "../../core/events.js";

const ok = (details = {}) => ({ ok: true, ...details });
const fail = (reasonKey) => ({ ok: false, reasonKey });

export class Workshop {
  #train;
  #wallet;
  #unlocks;
  #crew;
  #events;

  /**
   * @param {object} deps
   * @param {import("../train/train.js").Train} deps.train
   * @param {import("./wallet.js").Wallet} deps.wallet
   * @param {{ has: (id: string) => boolean }} deps.unlocks
   * @param {{ hasLoader: boolean, hireLoader: Function }} deps.crew
   */
  constructor({ train, wallet, unlocks, crew = null, events = null }) {
    this.#train = train;
    this.#wallet = wallet;
    this.#unlocks = unlocks;
    this.#crew = crew;
    this.#events = events;
  }

  /* ------------------------------------------------------------ statistics */

  /**
   * The numbers shown on the workshop panel. Computed from a list of vehicles
   * so the same function can describe the real train and a hypothetical one.
   */
  static statisticsFor(vehicles) {
    const wagonCount = Math.max(0, vehicles.length - 1);
    const armouredCount = vehicles.filter((vehicle) => vehicle.isArmoured).length;
    const usedSlots = vehicles.reduce((sum, vehicle) => sum + vehicle.hold.usedSlots, 0);

    const { penaltyPerWagon, penaltyPerArmouredVehicle, penaltyPerOccupiedCargoSlot, minimumMultiplier } =
      TRAIN.performance;
    const performance = Math.max(
      minimumMultiplier,
      1 -
        wagonCount * penaltyPerWagon -
        armouredCount * penaltyPerArmouredVehicle -
        usedSlots * penaltyPerOccupiedCargoSlot,
    );

    return {
      wagonCount,
      armouredCount,
      totalHealth: vehicles.reduce((sum, vehicle) => sum + vehicle.health, 0),
      totalMaxHealth: vehicles.reduce((sum, vehicle) => sum + vehicle.maxHealth, 0),
      cargoCapacity: vehicles.reduce((sum, vehicle) => sum + vehicle.hold.capacity, 0),
      usedCargoSlots: usedSlots,
      massTonnes: vehicles.reduce((sum, vehicle) => sum + vehicle.massTonnes, 0),
      performance,
      maxSpeedKmh: TRAIN.baseMaxSpeedKmh * performance,
    };
  }

  statistics() {
    return Workshop.statisticsFor(this.#train.vehicles);
  }

  /**
   * What the train would look like with one more wagon of `kind` on the back.
   * Nothing is bought and nothing is mutated.
   */
  preview(kind) {
    const hypothetical = new Vehicle(kind, 1, { id: "__preview__" });
    return {
      current: this.statistics(),
      proposed: Workshop.statisticsFor([...this.#train.vehicles, hypothetical]),
      price: purchasePrice(kind),
      vehicle: hypothetical,
    };
  }

  /** What upgrading a specific vehicle would do, without doing it. */
  previewUpgrade(vehicle) {
    if (!vehicle.canUpgrade) return null;
    const hypothetical = new Vehicle(vehicle.kind, vehicle.level + 1, { id: "__preview__" });
    const swapped = this.#train.vehicles.map((current) =>
      current === vehicle ? hypothetical : current,
    );
    return {
      current: this.statistics(),
      proposed: Workshop.statisticsFor(swapped),
      price: upgradePrice(vehicle.kind, vehicle.level),
      nextLevel: vehicle.level + 1,
    };
  }

  /* --------------------------------------------------------------- buying */

  canBuyVehicle(kind) {
    const requirement = VEHICLE_UNLOCKS[kind];
    if (requirement && !this.#unlocks.has(requirement)) return fail("TRADE_ERROR_LOCKED");
    const price = purchasePrice(kind);
    if (price === null) return fail("TRADE_ERROR_NOT_SOLD_HERE");
    if (!this.#wallet.canAfford(price)) return fail("TRADE_ERROR_NO_MONEY");
    return ok({ price });
  }

  buyVehicle(kind) {
    const allowed = this.canBuyVehicle(kind);
    if (!allowed.ok) return allowed;

    this.#wallet.spend(allowed.price);
    const vehicle = this.#train.attach(new Vehicle(kind, 1));
    return ok({ vehicle, price: allowed.price });
  }

  /* ------------------------------------------------------------ upgrading */

  canUpgrade(vehicle) {
    if (vehicle.isLocomotive) return fail("WORKSHOP_MAX_LEVEL");
    if (!vehicle.canUpgrade) return fail("WORKSHOP_MAX_LEVEL");

    const nextLevel = vehicle.level + 1;
    const requirement = UPGRADE_UNLOCKS[vehicle.kind]?.[nextLevel] ?? null;
    if (requirement && !this.#unlocks.has(requirement)) return fail("TRADE_ERROR_LOCKED");

    const price = upgradePrice(vehicle.kind, vehicle.level);
    if (price === null) return fail("WORKSHOP_MAX_LEVEL");
    if (!this.#wallet.canAfford(price)) return fail("TRADE_ERROR_NO_MONEY");
    return ok({ price, nextLevel });
  }

  upgradeVehicle(vehicle) {
    const allowed = this.canUpgrade(vehicle);
    if (!allowed.ok) return allowed;

    this.#wallet.spend(allowed.price);
    vehicle.upgrade();
    this.#events?.emit(GAME_EVENT.vehicleUpgraded, { vehicle, level: vehicle.level });
    return ok({ vehicle, level: vehicle.level, price: allowed.price });
  }

  /* --------------------------------------------------------------- armour */

  canFitArmour(vehicle) {
    if (!this.#unlocks.has(UNLOCK.wagonArmour)) return fail("TRADE_ERROR_LOCKED");
    if (!vehicle.canFitArmour) return fail("TRADE_ERROR_ALREADY_OWNED");
    const price = armourPrice(vehicle.kind);
    if (!this.#wallet.canAfford(price)) return fail("TRADE_ERROR_NO_MONEY");
    return ok({ price });
  }

  fitArmour(vehicle) {
    const allowed = this.canFitArmour(vehicle);
    if (!allowed.ok) return allowed;

    this.#wallet.spend(allowed.price);
    vehicle.fitArmour();
    this.#events?.emit(GAME_EVENT.vehicleArmoured, { vehicle });
    return ok({ vehicle, price: allowed.price });
  }

  /* -------------------------------------------------------------- repairs */

  /** Cost of restoring `healthPoints` of condition, rounded up. */
  static repairCostFor(healthPoints) {
    return Math.ceil(Math.max(0, healthPoints) / ECONOMY.healthPointsPerCurrencyUnit);
  }

  /** Cost of repairing a fraction of one vehicle's missing condition. */
  repairQuote(vehicle, fraction = 1) {
    const points = vehicle.missingHealth * Math.max(0, Math.min(1, fraction));
    return { healthPoints: points, price: Workshop.repairCostFor(points) };
  }

  /** Cost of bringing the whole train back to new. */
  repairAllQuote(fraction = 1) {
    const points = this.#train.vehicles.reduce(
      (sum, vehicle) => sum + vehicle.missingHealth * fraction,
      0,
    );
    return { healthPoints: points, price: Workshop.repairCostFor(points) };
  }

  repairVehicle(vehicle, fraction = 1) {
    const quote = this.repairQuote(vehicle, fraction);
    if (quote.healthPoints <= 0) return fail("WORKSHOP_UNDAMAGED");
    if (!this.#wallet.spend(quote.price)) return fail("TRADE_ERROR_NO_MONEY");

    const restored = vehicle.repair(quote.healthPoints);
    // Plating is patched up along with the hull; a workshop does the whole job.
    vehicle.repairArmour(fraction * (1 / ARMOUR.integrity.wearFactor) * 0.5);
    this.#events?.emit(GAME_EVENT.vehicleRepaired, { vehicle, restored });
    return ok({ vehicle, restored, price: quote.price });
  }

  repairAll(fraction = 1) {
    const quote = this.repairAllQuote(fraction);
    if (quote.healthPoints <= 0) return fail("WORKSHOP_UNDAMAGED");
    if (!this.#wallet.spend(quote.price)) return fail("TRADE_ERROR_NO_MONEY");

    let restored = 0;
    for (const vehicle of this.#train.vehicles) {
      restored += vehicle.repair(vehicle.missingHealth * fraction);
      vehicle.repairArmour(fraction);
      this.#events?.emit(GAME_EVENT.vehicleRepaired, { vehicle, restored });
    }
    return ok({ restored, price: quote.price });
  }

  /* ----------------------------------------------------------------- crew */

  canHireLoader() {
    if (!this.#unlocks.has(LOADER.unlock)) return fail("TRADE_ERROR_LOCKED");
    if (this.#crew?.hasLoader) return fail("TRADE_ERROR_ALREADY_OWNED");
    if (!this.#wallet.canAfford(LOADER.price)) return fail("TRADE_ERROR_NO_MONEY");
    return ok({ price: LOADER.price });
  }

  hireLoader() {
    const allowed = this.canHireLoader();
    if (!allowed.ok) return allowed;
    this.#wallet.spend(LOADER.price);
    this.#crew.hireLoader();
    return ok({ price: LOADER.price });
  }

  /** Everything the workshop panel needs about one vehicle, in one call. */
  vehicleOptions(vehicle) {
    return {
      vehicle,
      kind: vehicle.kind,
      level: vehicle.level,
      maxLevel: maxLevel(vehicle.kind),
      health: vehicle.health,
      maxHealth: vehicle.maxHealth,
      damageState: vehicle.damageState,
      armoured: vehicle.isArmoured,
      mount: vehicleSpec(vehicle.kind, vehicle.level).mount,
      upgrade: this.canUpgrade(vehicle),
      armour: this.canFitArmour(vehicle),
      repair: this.repairQuote(vehicle, 1),
    };
  }

  /** Prices for the buy panel, whether or not they are affordable yet. */
  catalogue() {
    return [VEHICLE_KIND.transport, VEHICLE_KIND.combat].map((kind) => ({
      kind,
      price: purchasePrice(kind),
      unlocked: !VEHICLE_UNLOCKS[kind] || this.#unlocks.has(VEHICLE_UNLOCKS[kind]),
    }));
  }
}
