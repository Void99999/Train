/**
 * LAST TRAIN - the live state of one weapon.
 *
 * Used for everything that shoots: the pistol in the player's hands, the
 * machine gun on a combat wagon, the heavy cannon on the roof. They differ in
 * their data, not in their behaviour, so one class covers all of them and the
 * heavy turret does not need its own special reload path.
 *
 * Ammunition is never invented here. Reloading pulls from a supply, and if the
 * supply is empty the weapon stays empty - which is the point of storing
 * shells three wagons away.
 */

import { weaponSpec } from "../../data/weapons.js";

export class WeaponState {
  #spec;
  #rounds;
  #cooldown = 0;
  #reloadRemaining = 0;
  #spinUp = 0;

  constructor(weaponId, { startLoaded = true } = {}) {
    this.#spec = weaponSpec(weaponId);
    this.weaponId = weaponId;
    this.#rounds = startLoaded ? this.#spec.magazineSize : 0;
  }

  get spec() {
    return this.#spec;
  }

  get roundsInMagazine() {
    return this.#rounds;
  }

  get magazineSize() {
    return this.#spec.magazineSize;
  }

  get isReloading() {
    return this.#reloadRemaining > 0;
  }

  get reloadProgress() {
    if (!this.isReloading) return 1;
    return 1 - this.#reloadRemaining / this.#spec.reloadSeconds;
  }

  get isEmpty() {
    return this.#rounds <= 0;
  }

  /** 0-1. Only miniguns have a spin-up; everything else reports 1 instantly. */
  get spinUpFraction() {
    const required = this.#spec.spinUpSeconds ?? 0;
    return required === 0 ? 1 : Math.min(1, this.#spinUp / required);
  }

  /**
   * Advances timers.
   * @param {boolean} triggerHeld keeps the barrels spinning between bursts
   */
  update(deltaSeconds, { triggerHeld = false } = {}) {
    if (this.#cooldown > 0) this.#cooldown = Math.max(0, this.#cooldown - deltaSeconds);
    if (this.#reloadRemaining > 0) {
      this.#reloadRemaining = Math.max(0, this.#reloadRemaining - deltaSeconds);
    }

    const spinUpSeconds = this.#spec.spinUpSeconds ?? 0;
    if (spinUpSeconds > 0) {
      // Barrels wind down about twice as fast as they wind up.
      this.#spinUp = triggerHeld
        ? Math.min(spinUpSeconds, this.#spinUp + deltaSeconds)
        : Math.max(0, this.#spinUp - deltaSeconds * 2);
    }
  }

  canFire() {
    return (
      !this.isReloading &&
      this.#cooldown <= 0 &&
      this.#rounds >= this.#spec.roundsPerShot &&
      this.spinUpFraction >= 1
    );
  }

  /**
   * Fires one shot.
   * @returns {{ weaponId: string, damage: number, damageClass: string, splash: object|null,
   *             penetration: number, rounds: number }|null} null if it could not fire
   */
  fire() {
    if (!this.canFire()) return null;
    this.#rounds -= this.#spec.roundsPerShot;
    this.#cooldown = 1 / this.#spec.shotsPerSecond;
    return {
      weaponId: this.weaponId,
      damage: this.#spec.damage,
      damageClass: this.#spec.damageClass,
      splash: this.#spec.splash ?? null,
      penetration: this.#spec.penetration,
      spreadDegrees: this.#spec.spreadDegrees,
      rangeMetres: this.#spec.rangeMetres,
      projectileSpeed: this.#spec.projectileSpeed ?? null,
      rounds: this.#spec.roundsPerShot,
    };
  }

  /**
   * Starts a reload, taking rounds from `supply`.
   *
   * @param {{ take: (ammoId: string, rounds: number) => number }} supply
   * @returns {boolean} whether a reload actually started
   */
  beginReload(supply) {
    if (this.isReloading) return false;
    const needed = this.#spec.magazineSize - this.#rounds;
    if (needed <= 0) return false;

    const taken = supply.take(this.#spec.ammoId, needed);
    if (taken <= 0) return false;

    this.#rounds += taken;
    this.#reloadRemaining = this.#spec.reloadSeconds;
    return true;
  }

  /**
   * Seats rounds without a reload timer. The Loader uses this: he has already
   * spent the time walking the shell to the turret by hand.
   */
  loadDirectly(rounds) {
    const accepted = Math.min(rounds, this.#spec.magazineSize - this.#rounds);
    this.#rounds += accepted;
    return accepted;
  }

  cancelReload() {
    this.#reloadRemaining = 0;
  }

  serialize() {
    return { weaponId: this.weaponId, rounds: this.#rounds };
  }

  static deserialize(data) {
    const state = new WeaponState(data.weaponId, { startLoaded: false });
    state.#rounds = data.rounds ?? 0;
    return state;
  }
}
