/**
 * LAST TRAIN - how much a given weapon actually hurts a given target.
 *
 * The whole point of this table is that weapons are not reskins of each other.
 * A pistol emptied into a tank should be a waste of ammunition and the player
 * should feel that immediately; a rocket into the same tank should matter.
 *
 * Every number is a multiplier applied to the weapon's base damage:
 *   1.0  = the weapon works exactly as advertised
 *   0.02 = the rounds are bouncing off
 *
 * Tuning note: change the numbers here rather than the damage values on the
 * weapons themselves. Weapon damage sets how strong a weapon is; this table
 * sets what it is *for*.
 */

import { ARMOUR_CLASS } from "./wagons.js";

export const DAMAGE_CLASS = {
  /** Pistols. Effective against people, nothing else. */
  smallArms: "small_arms",
  /** Assault rifles, miniguns. Volume of fire, little penetration. */
  rifle: "rifle",
  /** Vehicle-mounted automatic weapons. Bites into light armour. */
  heavyMachineGun: "heavy_machine_gun",
  /** RPG and the wagon rocket launcher. Opens armoured vehicles. */
  explosiveLight: "explosive_light",
  /** The heavy train cannon and tank guns. Opens anything. */
  explosiveHeavy: "explosive_heavy",
};

/**
 * effectiveness[damageClass][armourClass]
 *
 * The armour classes are:
 *   unarmoured    - infantry, unprotected crew
 *   light_vehicle - technicals, armoured cars, troop carriers
 *   heavy_armour  - tanks
 *   structure     - the train itself: rolled steel wagons and the locomotive
 */
export const EFFECTIVENESS = {
  [DAMAGE_CLASS.smallArms]: {
    [ARMOUR_CLASS.unarmoured]: 1,
    [ARMOUR_CLASS.lightVehicle]: 0.15,
    [ARMOUR_CLASS.heavyArmour]: 0.02,
    [ARMOUR_CLASS.structure]: 0.25,
  },
  [DAMAGE_CLASS.rifle]: {
    [ARMOUR_CLASS.unarmoured]: 1,
    [ARMOUR_CLASS.lightVehicle]: 0.3,
    [ARMOUR_CLASS.heavyArmour]: 0.05,
    [ARMOUR_CLASS.structure]: 0.4,
  },
  [DAMAGE_CLASS.heavyMachineGun]: {
    [ARMOUR_CLASS.unarmoured]: 1,
    [ARMOUR_CLASS.lightVehicle]: 0.6,
    [ARMOUR_CLASS.heavyArmour]: 0.08,
    [ARMOUR_CLASS.structure]: 0.65,
  },
  [DAMAGE_CLASS.explosiveLight]: {
    [ARMOUR_CLASS.unarmoured]: 1,
    [ARMOUR_CLASS.lightVehicle]: 1,
    [ARMOUR_CLASS.heavyArmour]: 0.75,
    [ARMOUR_CLASS.structure]: 0.9,
  },
  [DAMAGE_CLASS.explosiveHeavy]: {
    [ARMOUR_CLASS.unarmoured]: 1,
    [ARMOUR_CLASS.lightVehicle]: 1,
    [ARMOUR_CLASS.heavyArmour]: 1,
    [ARMOUR_CLASS.structure]: 1,
  },
};

/**
 * Multiplier for one weapon class against one armour class.
 * Unknown combinations are a data bug and throw, so a typo in a new enemy
 * definition cannot quietly make that enemy invulnerable.
 */
export function effectivenessOf(damageClass, armourClass) {
  const row = EFFECTIVENESS[damageClass];
  if (!row) throw new Error(`Unknown damage class: ${damageClass}`);
  const value = row[armourClass];
  if (value === undefined) throw new Error(`Unknown armour class: ${armourClass}`);
  return value;
}
