/**
 * LAST TRAIN - who the enemy shoots at.
 *
 * The failure mode this file exists to prevent: every hostile on the map
 * ignoring six fully-loaded wagons and emptying itself into the locomotive
 * until the run ends. That is technically tactical and completely miserable to
 * play against - the player never gets to defend anything, and the wagons they
 * spent an hour building are never in danger, only their run.
 *
 * So targets are chosen by weight, not by rule. The locomotive is attractive
 * but not overwhelming, the player is attractive when exposed, and combat
 * wagons draw fire because they are visibly shooting back. Any given enemy
 * still behaves tactically; the crowd spreads out.
 */

import { VEHICLE_KIND } from "../../data/wagons.js";

export const TARGET_WEIGHTS = {
  /** The locomotive matters, and enemies know it - but not to the exclusion of all else. */
  locomotive: 2.4,
  /** A wagon that is shooting back is the immediate problem. */
  combatWagonFiring: 3,
  combatWagon: 1.8,
  transportWagon: 1,
  /** An exposed player, on a roof or at a firing position. */
  playerExposed: 3.2,
  /** A player behind steel is a much worse bet, and enemies act like it. */
  playerInside: 0.7,
};

/**
 * Wounded things are slightly more attractive, so a crippled wagon does get
 * finished off rather than being ignored forever. Deliberately mild: a strong
 * bias here recreates the focus-fire problem in a different shape.
 */
const WOUNDED_BONUS = 0.6;

function weightForVehicle(vehicle, { firingVehicles }) {
  if (vehicle.isDestroyed) return 0;

  let base;
  if (vehicle.kind === VEHICLE_KIND.locomotive) base = TARGET_WEIGHTS.locomotive;
  else if (vehicle.kind === VEHICLE_KIND.combat) {
    base = firingVehicles.has(vehicle.id)
      ? TARGET_WEIGHTS.combatWagonFiring
      : TARGET_WEIGHTS.combatWagon;
  } else base = TARGET_WEIGHTS.transportWagon;

  return base * (1 + WOUNDED_BONUS * (1 - vehicle.healthFraction));
}

/**
 * Builds the weighted candidate list for one enemy.
 *
 * @param {object} options
 * @param {import("../train/train.js").Train} options.train
 * @param {object|null} options.player           `{ isExposed }`, or null if not targetable
 * @param {Set<string>} [options.firingVehicles] ids of wagons currently shooting
 * @param {(vehicle: object) => boolean} [options.canReach] range/line-of-sight filter
 * @returns {Array<{ target: object, kind: string, weight: number }>}
 */
export function buildTargetCandidates({
  train,
  player = null,
  firingVehicles = new Set(),
  canReach = () => true,
}) {
  const candidates = [];

  for (const vehicle of train.vehicles) {
    if (!canReach(vehicle)) continue;
    const weight = weightForVehicle(vehicle, { firingVehicles });
    if (weight > 0) candidates.push({ target: vehicle, kind: "vehicle", weight });
  }

  if (player && !player.isDead) {
    const weight = player.isExposed ? TARGET_WEIGHTS.playerExposed : TARGET_WEIGHTS.playerInside;
    candidates.push({ target: player, kind: "player", weight });
  }

  return candidates;
}

/**
 * Picks one target from a weighted candidate list.
 * @param {Rng} rng
 */
export function selectTarget(candidates, rng) {
  if (candidates.length === 0) return null;
  const weights = Object.fromEntries(candidates.map((entry, index) => [index, entry.weight]));
  const index = Number(rng.weighted(weights));
  return candidates[index];
}

/**
 * Chooses a target for one enemy, honouring a little target persistence:
 * an enemy that already has a valid target usually keeps shooting at it rather
 * than re-rolling every second, which reads as intent instead of confusion.
 *
 * @param {object|null} currentTarget
 * @param {number} [switchChance] probability of reconsidering this tick
 */
export function chooseTarget(candidates, rng, currentTarget = null, switchChance = 0.15) {
  const stillValid =
    currentTarget && candidates.some((entry) => entry.target === currentTarget);

  if (stillValid && !rng.chance(switchChance)) {
    return candidates.find((entry) => entry.target === currentTarget);
  }
  return selectTarget(candidates, rng);
}
