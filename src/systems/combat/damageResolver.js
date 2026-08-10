/**
 * LAST TRAIN - turning a shot into damage.
 *
 * Three rules live here, and all three exist so that combat rewards the right
 * decision rather than the biggest number:
 *
 *  1. Explosions spread. A rocket that lands between two soldiers should kill
 *     both, and a heavy shell near a wagon should hurt the wagon.
 *  2. Steel walls protect the people behind them. Standing inside a transport
 *     wagon while riflemen shoot at it should be survivable; standing there
 *     while a tank shoots at it should not.
 *  3. A shot-up wagon protects worse than an intact one. The holes are real.
 */

import { COMBAT } from "../../data/balance.js";

/**
 * Share of an explosion's damage delivered at `distance` from the centre.
 * Returns 0 outside the blast.
 */
export function splashFractionAt(distanceMetres, radiusMetres) {
  if (radiusMetres <= 0) return distanceMetres === 0 ? 1 : 0;
  if (distanceMetres >= radiusMetres) return 0;
  const linear = 1 - distanceMetres / radiusMetres;
  const shaped = Math.pow(linear, COMBAT.splashFalloffExponent);
  return Math.max(shaped, COMBAT.splashMinimumFraction);
}

/**
 * Distributes one explosive shot over everything in range.
 *
 * @param {object} shot     as produced by WeaponState.fire()
 * @param {Array<{ target: object, distance: number }>} candidates
 * @returns {Array<{ target: object, amount: number, damageClass: string }>}
 */
export function resolveExplosion(shot, candidates) {
  const radius = shot.splash?.radiusMetres ?? 0;
  if (radius <= 0) return [];

  return candidates
    .map(({ target, distance }) => ({
      target,
      amount: shot.damage * splashFractionAt(distance, radius),
      damageClass: shot.damageClass,
    }))
    .filter((entry) => entry.amount > 0);
}

/**
 * How much protection a vehicle's wall actually offers right now.
 *
 * A pristine hull gives the full value. A wreck at zero health gives half of
 * it - the plating is still there, but it is no longer a wall.
 */
export function wallProtectionOf(vehicle) {
  const condition = 0.5 + 0.5 * Math.max(0, Math.min(1, vehicle.healthFraction));
  return COMBAT.wallProtection * condition;
}

/**
 * Damage that reaches a person standing inside a vehicle that was hit.
 *
 * Weapons that cannot defeat the wall deliver only a small fraction, scaled by
 * how close their penetration gets to the wall's protection. Weapons that can
 * defeat it deliver everything, less whatever the armour takes off.
 *
 * @param {object} shot
 * @param {object} vehicle the vehicle the person is inside
 * @returns {number}
 */
export function damageThroughWall(shot, vehicle) {
  const protection = wallProtectionOf(vehicle);
  const penetration = shot.penetration ?? 0;

  let fraction;
  if (penetration >= protection) {
    fraction = 1;
  } else {
    // Scaled by how close the weapon gets to defeating the wall, and capped by
    // whatever the wall does not stop in the first place.
    fraction = (penetration / protection) * (1 - protection);
  }

  const afterArmour = vehicle.isArmoured ? fraction * (1 - vehicle.armourReduction) : fraction;
  return shot.damage * afterArmour;
}

/**
 * Applies a direct hit to a vehicle through the train, so that destruction and
 * uncoupling are handled in one place.
 *
 * @returns {{ applied: number, destroyed: boolean, detached: Array }}
 */
export function applyShotToVehicle(train, vehicle, shot) {
  return train.damageVehicle(vehicle, {
    amount: shot.damage,
    damageClass: shot.damageClass,
  });
}
