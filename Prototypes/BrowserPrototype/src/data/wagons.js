/**
 * LAST TRAIN - catalog of everything that rolls on the rails.
 *
 * A "vehicle" here is the locomotive or any wagon coupled behind it. Each
 * vehicle kind has up to four levels; a level carries its own health, price,
 * capacity, mounted weapon and physical size, so upgrading a wagon changes how
 * it looks and how much it weighs, not just a number on a sheet.
 *
 * Dimensions are metres and feed both the renderer and the walkable interior
 * layout, so a level 4 transport wagon really is the biggest one to walk
 * through.
 */

/** Armour classification used by the damage model in src/data/damage.js. */
export const ARMOUR_CLASS = {
  unarmoured: "unarmoured",
  lightVehicle: "light_vehicle",
  heavyArmour: "heavy_armour",
  structure: "structure",
};

export const VEHICLE_KIND = {
  locomotive: "locomotive",
  transport: "transport",
  combat: "combat",
};

/** Weapon mounted on a combat wagon at a given level, or null for none. */
export const MOUNT_TYPE = {
  none: null,
  machineGun: "mounted_machine_gun",
  rocketLauncher: "mounted_rocket_launcher",
  heavyCannon: "heavy_turret_cannon",
};

/**
 * Price of armouring a vehicle. Armour may be applied exactly once, and it
 * changes the silhouette: plates, reinforced doors, heavy bolts.
 */
const ARMOUR_PRICES = {
  [VEHICLE_KIND.locomotive]: 1000,
  [VEHICLE_KIND.transport]: 500,
  [VEHICLE_KIND.combat]: 700,
};

/**
 * The locomotive is not purchasable and has no levels - the player finds it
 * abandoned at the start of the run and keeps it until the end.
 */
const LOCOMOTIVE = {
  kind: VEHICLE_KIND.locomotive,
  levels: [
    {
      level: 1,
      maxHealth: 1500,
      purchasePrice: null,
      upgradePrice: null,
      /**
       * The cab and bunker hold a little. Small on purpose - just enough that
       * a player who owns nothing but the locomotive can still run a first
       * load of coal to the next outpost and buy their way into a real wagon.
       */
      cargoSlots: 12,
      mount: MOUNT_TYPE.none,
      /** length x width x height in metres. */
      size: { length: 12.5, width: 3.1, height: 4.2 },
      /** Structural mass in tonnes. Display only - performance uses balance.js. */
      massTonnes: 68,
    },
  ],
  armourPrice: ARMOUR_PRICES[VEHICLE_KIND.locomotive],
  armourClass: ARMOUR_CLASS.structure,
};

/**
 * Enclosed freight wagons. They are walkable and hold coal, fuel, oil and
 * ammunition alike - the player decides what the space is worth.
 */
const TRANSPORT_WAGON = {
  kind: VEHICLE_KIND.transport,
  levels: [
    {
      level: 1,
      maxHealth: 600,
      purchasePrice: 300,
      upgradePrice: null,
      cargoSlots: 20,
      mount: MOUNT_TYPE.none,
      size: { length: 9.0, width: 2.9, height: 3.4 },
      massTonnes: 18,
    },
    {
      level: 2,
      maxHealth: 700,
      purchasePrice: null,
      upgradePrice: 250,
      cargoSlots: 35,
      mount: MOUNT_TYPE.none,
      size: { length: 10.0, width: 3.0, height: 3.6 },
      massTonnes: 21,
    },
    {
      level: 3,
      maxHealth: 800,
      purchasePrice: null,
      upgradePrice: 500,
      cargoSlots: 55,
      mount: MOUNT_TYPE.none,
      size: { length: 11.2, width: 3.1, height: 3.9 },
      massTonnes: 25,
    },
    {
      level: 4,
      maxHealth: 900,
      purchasePrice: null,
      upgradePrice: 900,
      cargoSlots: 80,
      mount: MOUNT_TYPE.none,
      size: { length: 12.4, width: 3.2, height: 4.2 },
      massTonnes: 30,
    },
  ],
  armourPrice: ARMOUR_PRICES[VEHICLE_KIND.transport],
  armourClass: ARMOUR_CLASS.structure,
};

/**
 * Fighting platforms. Level 1 is bare - it is a hardened wagon, not a weapon.
 * Each further level opens a real firing position the player operates by hand.
 */
const COMBAT_WAGON = {
  kind: VEHICLE_KIND.combat,
  levels: [
    {
      level: 1,
      maxHealth: 750,
      purchasePrice: 500,
      upgradePrice: null,
      cargoSlots: 0,
      mount: MOUNT_TYPE.none,
      size: { length: 9.4, width: 3.0, height: 3.5 },
      massTonnes: 22,
    },
    {
      level: 2,
      maxHealth: 850,
      purchasePrice: null,
      upgradePrice: 450,
      cargoSlots: 0,
      mount: MOUNT_TYPE.machineGun,
      size: { length: 9.8, width: 3.1, height: 3.6 },
      massTonnes: 25,
    },
    {
      level: 3,
      maxHealth: 950,
      purchasePrice: null,
      upgradePrice: 900,
      cargoSlots: 0,
      mount: MOUNT_TYPE.rocketLauncher,
      size: { length: 10.4, width: 3.2, height: 3.8 },
      massTonnes: 29,
    },
    {
      level: 4,
      maxHealth: 1100,
      purchasePrice: null,
      upgradePrice: 1800,
      cargoSlots: 0,
      mount: MOUNT_TYPE.heavyCannon,
      size: { length: 11.0, width: 3.3, height: 4.6 },
      massTonnes: 38,
    },
  ],
  armourPrice: ARMOUR_PRICES[VEHICLE_KIND.combat],
  armourClass: ARMOUR_CLASS.structure,
};

export const VEHICLE_CATALOG = {
  [VEHICLE_KIND.locomotive]: LOCOMOTIVE,
  [VEHICLE_KIND.transport]: TRANSPORT_WAGON,
  [VEHICLE_KIND.combat]: COMBAT_WAGON,
};

/** Highest level a vehicle kind can reach. */
export function maxLevel(kind) {
  return VEHICLE_CATALOG[kind].levels.length;
}

/**
 * Looks up one level of one vehicle kind.
 * Throws rather than returning undefined: a bad key here is a data bug, and it
 * should surface at the call site instead of turning into NaN health later.
 */
export function vehicleSpec(kind, level) {
  const entry = VEHICLE_CATALOG[kind];
  if (!entry) throw new Error(`Unknown vehicle kind: ${kind}`);
  const spec = entry.levels[level - 1];
  if (!spec) throw new Error(`${kind} has no level ${level}`);
  return spec;
}

/** Price to buy a fresh vehicle of this kind at level 1, or null if not for sale. */
export function purchasePrice(kind) {
  return VEHICLE_CATALOG[kind].levels[0].purchasePrice;
}

/** Price to move a vehicle from `level` to `level + 1`, or null at max level. */
export function upgradePrice(kind, level) {
  const entry = VEHICLE_CATALOG[kind];
  const next = entry.levels[level];
  return next ? next.upgradePrice : null;
}

export function armourPrice(kind) {
  return VEHICLE_CATALOG[kind].armourPrice;
}
