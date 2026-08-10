/**
 * LAST TRAIN - what becomes available, and when.
 *
 * Two rules shape this table:
 *
 *  1. Basic mechanics are never gated. Driving, walking the train, trading,
 *     buying a wagon - the player can do all of that almost immediately.
 *     Only genuinely powerful content waits.
 *
 *  2. Nothing arrives so late that the player never gets to use it. The
 *     minigun lands at outpost 6 of 10, leaving four legs of the journey to
 *     enjoy owning it.
 *
 * An unlock, once granted, stays granted for the rest of the run.
 */

export const UNLOCK = {
  weaponAssaultRifle: "weapon.assault_rifle",
  weaponRpg: "weapon.rpg",
  weaponMinigun: "weapon.minigun",

  vehicleTransport: "vehicle.transport",
  vehicleCombat: "vehicle.combat",

  combatWagonLevel2: "upgrade.combat.2",
  combatWagonLevel3: "upgrade.combat.3",
  combatWagonLevel4: "upgrade.combat.4",

  wagonArmour: "upgrade.armour",
  crewLoader: "crew.loader",
};

/**
 * Unlocks keyed by the outpost that grants them.
 * Index 0 is the start of the run, before the player has reached anything.
 */
export const UNLOCKS_BY_OUTPOST = {
  0: [],
  1: [
    UNLOCK.weaponAssaultRifle,
    UNLOCK.vehicleTransport,
    UNLOCK.vehicleCombat,
    UNLOCK.combatWagonLevel2,
  ],
  2: [UNLOCK.wagonArmour],
  3: [UNLOCK.weaponRpg, UNLOCK.combatWagonLevel3],
  4: [UNLOCK.combatWagonLevel4, UNLOCK.crewLoader],
  6: [UNLOCK.weaponMinigun],
};

/** Things the player owns or can do before reaching any outpost at all. */
export const STARTING_UNLOCKS = Object.freeze([]);

/**
 * Every unlock granted once `outpostIndex` has been reached.
 * Outpost 0 means "the run just started".
 */
export function unlocksUpTo(outpostIndex) {
  const granted = new Set(STARTING_UNLOCKS);
  for (const [key, ids] of Object.entries(UNLOCKS_BY_OUTPOST)) {
    if (Number(key) <= outpostIndex) ids.forEach((id) => granted.add(id));
  }
  return granted;
}

/** The outpost that first grants an unlock, or null if it is never granted. */
export function outpostGranting(unlockId) {
  const entries = Object.entries(UNLOCKS_BY_OUTPOST)
    .filter(([, ids]) => ids.includes(unlockId))
    .map(([key]) => Number(key));
  return entries.length ? Math.min(...entries) : null;
}

/**
 * Unlock required to buy a vehicle kind, or null when the kind needs none.
 * The locomotive is never bought, so it is absent from this map.
 */
export const VEHICLE_UNLOCKS = {
  transport: UNLOCK.vehicleTransport,
  combat: UNLOCK.vehicleCombat,
};

/**
 * Unlock required to raise a vehicle to a given level.
 * Transport upgrades are deliberately ungated: once the player may own a
 * transport wagon, making it bigger is a plain economic decision.
 */
export const UPGRADE_UNLOCKS = {
  combat: {
    2: UNLOCK.combatWagonLevel2,
    3: UNLOCK.combatWagonLevel3,
    4: UNLOCK.combatWagonLevel4,
  },
  transport: {},
};

/** Unlock required to buy a personal weapon, or null if it needs none. */
export const WEAPON_UNLOCKS = {
  pistol: null,
  assault_rifle: UNLOCK.weaponAssaultRifle,
  rpg: UNLOCK.weaponRpg,
  minigun: UNLOCK.weaponMinigun,
};

/** Price of hiring the Loader. Exactly one may be aboard, and he has no levels. */
export const LOADER = {
  price: 1500,
  unlock: UNLOCK.crewLoader,
  maxPerTrain: 1,
  /** He walks. He does not sprint, and he does not teleport shells. */
  walkSpeed: 1.35,
  /** Seconds spent picking a shell out of a crate. */
  pickUpSeconds: 2.2,
  /** Seconds spent seating a shell in the breech. */
  loadSeconds: 3.5,
  /** He can carry exactly one heavy artillery shell at a time. */
  carryCapacity: 1,
};
