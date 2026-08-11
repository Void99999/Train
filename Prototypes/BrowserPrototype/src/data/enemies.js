/**
 * LAST TRAIN - enemy catalog.
 *
 * Speeds matter as much as health here. The train runs at up to 22 m/s, so an
 * enemy's top speed decides whether it can pursue, whether it gets one firing
 * pass, or whether it is simply left behind. That relationship is what makes
 * a heavy, slow train genuinely more dangerous to own.
 *
 * `salvageValue` is the money picked up for a kill. Design note: the spec's
 * economy is built on trading, but the price list (3000 minigun, 1800 turret
 * upgrade, 1500 Loader) is not reachable from cargo margins alone within ten
 * outposts. Salvage is the second income stream that makes those prices land
 * where they were meant to. Set these to 0 for a pure-trading economy.
 */

import { ARMOUR_CLASS } from "./wagons.js";

export const ENEMY_CATALOG = {
  standard_soldier: {
    id: "standard_soldier",
    maxHealth: 100,
    armourClass: ARMOUR_CLASS.unarmoured,
    weaponId: "enemy_rifle",
    /** Metres per second. A running soldier cannot keep up with the train. */
    moveSpeed: 4.6,
    /** Seconds between deciding to shoot and the first round leaving. */
    aimTimeSeconds: 0.5,
    /** Fires while moving instead of stopping to plant himself. */
    firesOnTheMove: true,
    salvageValue: 15,
    /** Rough silhouette in metres, for hit detection and spawn spacing. */
    size: { length: 0.6, width: 0.7, height: 1.8 },
  },

  heavy_soldier: {
    id: "heavy_soldier",
    maxHealth: 200,
    armourClass: ARMOUR_CLASS.unarmoured,
    weaponId: "enemy_heavy_weapon",
    moveSpeed: 2.9,
    aimTimeSeconds: 0.9,
    firesOnTheMove: true,
    salvageValue: 35,
    size: { length: 0.75, width: 0.9, height: 1.9 },
  },

  combat_vehicle: {
    id: "combat_vehicle",
    maxHealth: 600,
    armourClass: ARMOUR_CLASS.lightVehicle,
    weaponId: "enemy_autocannon",
    /** Faster than the train at full throttle, so it can run alongside. */
    moveSpeed: 30,
    acceleration: 4.5,
    aimTimeSeconds: 0.7,
    firesOnTheMove: true,
    salvageValue: 120,
    size: { length: 5.4, width: 2.3, height: 2.2 },
  },

  tank: {
    id: "tank",
    maxHealth: 2500,
    armourClass: ARMOUR_CLASS.heavyArmour,
    weaponId: "enemy_tank_cannon",
    /** Slower than a train at speed - it has to be met, or outrun. */
    moveSpeed: 16,
    acceleration: 1.6,
    aimTimeSeconds: 1.8,
    firesOnTheMove: false,
    /** Degrees per second the turret can traverse onto a target. */
    turretTraverseSpeed: 20,
    salvageValue: 400,
    size: { length: 7.6, width: 3.4, height: 2.6 },
  },
};

export const ENEMY_IDS = Object.keys(ENEMY_CATALOG);

export function enemySpec(id) {
  const spec = ENEMY_CATALOG[id];
  if (!spec) throw new Error(`Unknown enemy: ${id}`);
  return spec;
}
