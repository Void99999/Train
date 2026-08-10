/**
 * LAST TRAIN - the shape of the railway.
 *
 * Two things in this file are secrets the player must never be shown:
 * the total length of the line, and which outpost is the last one. The HUD may
 * report how far the train has come and which outpost it just left. It may
 * never report what is left, and no outpost carries a "final" flag that could
 * leak into the interface.
 *
 * Outpost spacing is deliberately irregular. Perfectly even 10 km gaps would
 * let an attentive player count platforms and work out where the line ends,
 * which is exactly the surprise the ending depends on.
 */

/** Distance in km at which each supply outpost sits, in order. */
const OUTPOST_DISTANCES_KM = [5.2, 14.6, 24.1, 34.8, 44.3, 54.9, 64.2, 74.6, 84.1, 92.5];

/**
 * Outposts are small, half-abandoned railway facilities inside the war zone -
 * a workshop, a warehouse, a few working lights. Not friendly cities, and not
 * a way home.
 *
 * `services` decides which shops physically exist at that outpost. Every
 * outpost can trade cargo and patch the train up; the heavier services appear
 * as the line gets deeper and more desperate.
 */
export const SERVICE = {
  cargoTrader: "cargo_trader",
  weaponShop: "weapon_shop",
  ammunitionShop: "ammunition_shop",
  medicalService: "medical_service",
  repairArea: "repair_area",
  trainWorkshop: "train_workshop",
};

const ALWAYS = [SERVICE.cargoTrader, SERVICE.repairArea, SERVICE.trainWorkshop];

export const OUTPOSTS = OUTPOST_DISTANCES_KM.map((distanceKm, index) => {
  const number = index + 1;
  return {
    /** 1-based. Outpost 0 is "no outpost reached yet". */
    number,
    id: `outpost_${number}`,
    /** Localization key. Outpost names are localized, not hard-coded. */
    nameKey: `OUTPOST_${number}_NAME`,
    distanceKm,
    services: [
      ...ALWAYS,
      SERVICE.ammunitionShop,
      ...(number >= 1 ? [SERVICE.weaponShop] : []),
      ...(number >= 1 ? [SERVICE.medicalService] : []),
    ],
  };
});

/**
 * Difficulty bands along the line. The encounter director reads these; nothing
 * else should decide what spawns.
 *
 *  `weights`      relative spawn chance per enemy kind
 *  `groupSize`    how many hostiles one encounter fields
 *  `intervalSeconds` gap between encounters, before the peace timer
 */
export const DIFFICULTY_BANDS = [
  {
    fromKm: 0,
    toKm: 10,
    weights: { standard_soldier: 1 },
    groupSize: { min: 1, max: 3 },
    intervalSeconds: { min: 34, max: 52 },
  },
  {
    fromKm: 10,
    toKm: 30,
    weights: { standard_soldier: 4, heavy_soldier: 1, combat_vehicle: 1 },
    groupSize: { min: 2, max: 4 },
    intervalSeconds: { min: 28, max: 44 },
  },
  {
    fromKm: 30,
    toKm: 50,
    weights: { standard_soldier: 4, heavy_soldier: 2, combat_vehicle: 2 },
    groupSize: { min: 3, max: 6 },
    intervalSeconds: { min: 24, max: 38 },
  },
  {
    fromKm: 50,
    toKm: 70,
    weights: { standard_soldier: 4, heavy_soldier: 3, combat_vehicle: 3, tank: 1 },
    groupSize: { min: 4, max: 7 },
    intervalSeconds: { min: 22, max: 34 },
  },
  {
    fromKm: 70,
    toKm: 90,
    weights: { standard_soldier: 4, heavy_soldier: 3, combat_vehicle: 4, tank: 2 },
    groupSize: { min: 5, max: 8 },
    intervalSeconds: { min: 18, max: 30 },
  },
  {
    fromKm: 90,
    toKm: Infinity,
    weights: { standard_soldier: 4, heavy_soldier: 4, combat_vehicle: 4, tank: 3 },
    groupSize: { min: 6, max: 10 },
    intervalSeconds: { min: 15, max: 26 },
  },
];

export function difficultyBandAt(distanceKm) {
  return (
    DIFFICULTY_BANDS.find((band) => distanceKm >= band.fromKm && distanceKm < band.toKm) ??
    DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1]
  );
}

/** The outpost with this 1-based number, or null. */
export function outpostByNumber(number) {
  return OUTPOSTS.find((outpost) => outpost.number === number) ?? null;
}

/** The next outpost ahead of `distanceKm`, or null when none remain. */
export function nextOutpostAfter(distanceKm) {
  return OUTPOSTS.find((outpost) => outpost.distanceKm > distanceKm) ?? null;
}

/**
 * Distance at which the final scripted sequence fires. Kept next to the line
 * data because it is a property of the railway, not of any gameplay system -
 * and it is never rendered anywhere the player can see it.
 */
export const FINAL_SEQUENCE_DISTANCE_KM = 100;
