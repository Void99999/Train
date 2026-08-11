/**
 * LAST TRAIN - the weapons bolted to the train.
 *
 * A combat wagon's mount is a property of its level, so this registry watches
 * the train and keeps one live weapon per armed wagon: created when a wagon is
 * upgraded into a weapon, discarded when the wagon is destroyed or cut loose.
 *
 * Keeping it separate from the vehicles means a wagon can be serialised,
 * rebuilt, upgraded or blown off the back of the train without anybody having
 * to remember to fix up firing state by hand.
 */

import { WeaponState } from "../combat/weaponState.js";
import { MOUNT_TYPE } from "../../data/wagons.js";

export class MountRegistry {
  /** vehicle id -> WeaponState */
  #weapons = new Map();
  #train;

  constructor({ train }) {
    this.#train = train;
    this.sync();
  }

  /**
   * Brings the registry in line with the train. Cheap enough to call whenever
   * the consist changes - after an upgrade, a purchase, or a destruction.
   */
  sync() {
    const live = new Set();

    for (const vehicle of this.#train.vehicles) {
      const mount = vehicle.mount;
      if (!mount) continue;
      live.add(vehicle.id);

      const existing = this.#weapons.get(vehicle.id);
      if (!existing || existing.weaponId !== mount) {
        // A new mount arrives empty. Upgrading into a heavy turret does not
        // come with a free shell in the breech.
        this.#weapons.set(vehicle.id, new WeaponState(mount, { startLoaded: false }));
      }
    }

    for (const id of [...this.#weapons.keys()]) {
      if (!live.has(id)) this.#weapons.delete(id);
    }
  }

  weaponFor(vehicle) {
    return this.#weapons.get(vehicle.id) ?? null;
  }

  /** Every armed wagon, front to back, paired with its weapon. */
  armedVehicles() {
    return this.#train.vehicles
      .filter((vehicle) => this.#weapons.has(vehicle.id))
      .map((vehicle) => ({ vehicle, weapon: this.#weapons.get(vehicle.id) }));
  }

  /** Armed wagons carrying the heavy turret - the only thing the Loader serves. */
  heavyTurrets() {
    return this.armedVehicles().filter(
      ({ weapon }) => weapon.weaponId === MOUNT_TYPE.heavyCannon,
    );
  }

  update(deltaSeconds) {
    for (const weapon of this.#weapons.values()) weapon.update(deltaSeconds);
  }

  serialize() {
    return [...this.#weapons.entries()].map(([id, weapon]) => ({ id, ...weapon.serialize() }));
  }

  restore(data) {
    for (const entry of data ?? []) {
      const existing = this.#weapons.get(entry.id);
      if (existing && existing.weaponId === entry.weaponId) {
        existing.loadDirectly(entry.rounds - existing.roundsInMagazine);
      }
    }
  }
}
