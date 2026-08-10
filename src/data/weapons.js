/**
 * LAST TRAIN - weapon catalog.
 *
 * Covers the four weapons the player carries, the three weapons bolted to
 * combat wagons, and the weapons enemies shoot back with. They all share one
 * shape so the damage resolver in src/systems/combat/damage.js never needs to
 * know who pulled the trigger.
 *
 * A weapon's `damageClass` decides how well it works against a given target -
 * see src/data/damage.js. A pistol is not a weaker rifle; against a tank it is
 * nothing at all.
 */

import { DAMAGE_CLASS } from "./damage.js";

export const WEAPON_SLOT = {
  /** Carried by the player and selectable from the weapon wheel. */
  personal: "personal",
  /** Bolted to a combat wagon and operated from a firing position. */
  mounted: "mounted",
  /** Carried by enemies. Never selectable. */
  enemy: "enemy",
};

/**
 * `splash` is present only on explosive weapons.
 *   radiusMetres - everything inside takes a share of the damage
 *
 * `penetration` is how much of an intact wagon wall the weapon defeats, 0-1.
 * It is compared against COMBAT.wallProtection to decide whether a shot that
 * hit a wagon can also hurt somebody standing inside it.
 */
export const WEAPON_CATALOG = {
  pistol: {
    id: "pistol",
    slot: WEAPON_SLOT.personal,
    damage: 25,
    damageClass: DAMAGE_CLASS.smallArms,
    ammoId: "pistol_ammo",
    magazineSize: 12,
    roundsPerShot: 1,
    shotsPerSecond: 3,
    reloadSeconds: 1.4,
    /** Cone of fire in degrees at rest; recoil widens it while firing. */
    spreadDegrees: 1.2,
    rangeMetres: 60,
    penetration: 0.05,
    price: null,
    unlockedFromStart: true,
  },

  assault_rifle: {
    id: "assault_rifle",
    slot: WEAPON_SLOT.personal,
    damage: 30,
    damageClass: DAMAGE_CLASS.rifle,
    ammoId: "rifle_ammo",
    magazineSize: 30,
    roundsPerShot: 1,
    shotsPerSecond: 9,
    reloadSeconds: 2.3,
    spreadDegrees: 1.6,
    rangeMetres: 180,
    penetration: 0.15,
    price: 450,
    unlockedFromStart: false,
  },

  rpg: {
    id: "rpg",
    slot: WEAPON_SLOT.personal,
    damage: 500,
    damageClass: DAMAGE_CLASS.explosiveLight,
    ammoId: "rocket",
    magazineSize: 1,
    roundsPerShot: 1,
    shotsPerSecond: 0.5,
    reloadSeconds: 3.4,
    spreadDegrees: 0.4,
    rangeMetres: 300,
    penetration: 0.8,
    splash: { radiusMetres: 6 },
    projectileSpeed: 55,
    price: 1200,
    unlockedFromStart: false,
  },

  minigun: {
    id: "minigun",
    slot: WEAPON_SLOT.personal,
    damage: 20,
    damageClass: DAMAGE_CLASS.rifle,
    ammoId: "rifle_ammo",
    magazineSize: 150,
    roundsPerShot: 1,
    shotsPerSecond: 25,
    reloadSeconds: 5.5,
    spreadDegrees: 3.2,
    rangeMetres: 160,
    penetration: 0.18,
    /** Barrels have to come up to speed before the first round leaves. */
    spinUpSeconds: 0.8,
    price: 3000,
    unlockedFromStart: false,
  },

  mounted_machine_gun: {
    id: "mounted_machine_gun",
    slot: WEAPON_SLOT.mounted,
    damage: 35,
    damageClass: DAMAGE_CLASS.heavyMachineGun,
    ammoId: "rifle_ammo",
    magazineSize: 100,
    roundsPerShot: 1,
    shotsPerSecond: 10,
    reloadSeconds: 4,
    spreadDegrees: 1.1,
    rangeMetres: 260,
    penetration: 0.35,
    price: null,
    unlockedFromStart: false,
    /** Degrees per second the mount can be swung. */
    traverseSpeed: 70,
    /** How far the mount can swing off centre, in degrees. */
    traverseLimitDegrees: 120,
  },

  mounted_rocket_launcher: {
    id: "mounted_rocket_launcher",
    slot: WEAPON_SLOT.mounted,
    damage: 650,
    damageClass: DAMAGE_CLASS.explosiveLight,
    ammoId: "rocket",
    magazineSize: 2,
    roundsPerShot: 1,
    shotsPerSecond: 0.45,
    reloadSeconds: 4.5,
    spreadDegrees: 0.3,
    rangeMetres: 420,
    penetration: 0.85,
    splash: { radiusMetres: 9 },
    projectileSpeed: 70,
    price: null,
    unlockedFromStart: false,
    traverseSpeed: 45,
    traverseLimitDegrees: 140,
  },

  heavy_turret_cannon: {
    id: "heavy_turret_cannon",
    slot: WEAPON_SLOT.mounted,
    damage: 1500,
    damageClass: DAMAGE_CLASS.explosiveHeavy,
    ammoId: "heavy_shell",
    /** One shell in the breech. Everything else is the Loader's problem. */
    magazineSize: 1,
    roundsPerShot: 1,
    shotsPerSecond: 0.25,
    /** How long the crew - or the player - needs to seat a shell by hand. */
    reloadSeconds: 7,
    spreadDegrees: 0.2,
    rangeMetres: 600,
    penetration: 1,
    splash: { radiusMetres: 12 },
    projectileSpeed: 240,
    price: null,
    unlockedFromStart: false,
    traverseSpeed: 22,
    /** A full rotating turret on the wagon roof. */
    traverseLimitDegrees: 180,
  },

  enemy_rifle: {
    id: "enemy_rifle",
    slot: WEAPON_SLOT.enemy,
    damage: 12,
    damageClass: DAMAGE_CLASS.rifle,
    ammoId: null,
    magazineSize: 30,
    roundsPerShot: 1,
    shotsPerSecond: 5,
    reloadSeconds: 2.6,
    spreadDegrees: 3.5,
    rangeMetres: 150,
    penetration: 0.15,
    price: null,
    unlockedFromStart: false,
  },

  enemy_heavy_weapon: {
    id: "enemy_heavy_weapon",
    slot: WEAPON_SLOT.enemy,
    damage: 22,
    damageClass: DAMAGE_CLASS.heavyMachineGun,
    ammoId: null,
    magazineSize: 50,
    roundsPerShot: 1,
    shotsPerSecond: 6,
    reloadSeconds: 4.2,
    spreadDegrees: 4,
    rangeMetres: 170,
    penetration: 0.3,
    price: null,
    unlockedFromStart: false,
  },

  enemy_autocannon: {
    id: "enemy_autocannon",
    slot: WEAPON_SLOT.enemy,
    damage: 30,
    damageClass: DAMAGE_CLASS.heavyMachineGun,
    ammoId: null,
    magazineSize: 60,
    roundsPerShot: 1,
    shotsPerSecond: 4,
    reloadSeconds: 5,
    spreadDegrees: 2.4,
    rangeMetres: 220,
    penetration: 0.4,
    price: null,
    unlockedFromStart: false,
  },

  enemy_tank_cannon: {
    id: "enemy_tank_cannon",
    slot: WEAPON_SLOT.enemy,
    damage: 180,
    damageClass: DAMAGE_CLASS.explosiveHeavy,
    ammoId: null,
    magazineSize: 1,
    roundsPerShot: 1,
    shotsPerSecond: 0.18,
    reloadSeconds: 6,
    spreadDegrees: 0.6,
    rangeMetres: 500,
    penetration: 0.95,
    splash: { radiusMetres: 5 },
    projectileSpeed: 210,
    price: null,
    unlockedFromStart: false,
  },
};

/** Weapons the player can carry, in weapon-wheel order. */
export const PERSONAL_WEAPON_IDS = ["pistol", "assault_rifle", "rpg", "minigun"];

export function weaponSpec(id) {
  const spec = WEAPON_CATALOG[id];
  if (!spec) throw new Error(`Unknown weapon: ${id}`);
  return spec;
}

/** True when the weapon deals area damage rather than a single point hit. */
export function isExplosive(id) {
  return Boolean(weaponSpec(id).splash);
}

/** Rounds per second a weapon puts out while the trigger is held. */
export function sustainedRateOfFire(id) {
  const spec = weaponSpec(id);
  return spec.shotsPerSecond * spec.roundsPerShot;
}
