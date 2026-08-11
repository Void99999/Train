/**
 * LAST TRAIN - what the player is carrying.
 *
 * Weapons, medkits, and the rounds currently in a magazine. Bulk ammunition is
 * deliberately *not* here: packs live in the train's cargo hold, competing for
 * space with the oil the player wanted to sell. Reloading opens a pack out of
 * the train, which is what makes ammunition a logistics problem rather than a
 * number that only ever goes down.
 *
 * Loose rounds are tracked separately from packs so that reloading a 12-round
 * pistol magazine out of a 30-round pack does not throw 18 rounds away.
 */

import { WeaponState } from "../combat/weaponState.js";
import { PERSONAL_WEAPON_IDS, weaponSpec } from "../../data/weapons.js";
import { cargoSpec } from "../../data/cargo.js";
import { PLAYER } from "../../data/balance.js";
import { GAME_EVENT } from "../../core/events.js";

/**
 * Adapts the train's cargo hold into something a weapon can reload from,
 * opening packs into loose rounds as needed.
 */
class AmmunitionSupply {
  constructor(inventory, store) {
    this.inventory = inventory;
    this.store = store;
  }

  /** @returns {number} rounds actually handed over */
  take(ammoId, rounds) {
    if (!ammoId) return 0;
    const spec = cargoSpec(ammoId);
    let loose = this.inventory.looseRoundsOf(ammoId);

    while (loose < rounds && this.store && this.store.quantityOf(ammoId) > 0) {
      if (this.store.removeCargo(ammoId, 1) <= 0) break;
      loose += spec.roundsPerUnit;
    }

    const given = Math.min(rounds, loose);
    this.inventory.setLooseRounds(ammoId, loose - given);
    return given;
  }
}

export class Inventory {
  #owned = new Set();
  #weapons = new Map();
  #loose = new Map();
  #medkits = 0;
  #equipped = null;
  #events;

  constructor({ events } = {}) {
    this.#events = events ?? null;
    // The run begins with a pistol and a full magazine. Nothing else.
    this.addWeapon("pistol");
    this.equip("pistol");
  }

  get ownedWeapons() {
    return [...this.#owned];
  }

  /** Owned weapons in weapon-wheel order. */
  get wheelOrder() {
    return PERSONAL_WEAPON_IDS.filter((id) => this.#owned.has(id));
  }

  get equippedWeaponId() {
    return this.#equipped;
  }

  get equippedWeapon() {
    return this.#equipped ? this.#weapons.get(this.#equipped) : null;
  }

  get medkits() {
    return this.#medkits;
  }

  get canCarryMoreMedkits() {
    return this.#medkits < PLAYER.medkit.maxCarried;
  }

  has(weaponId) {
    return this.#owned.has(weaponId);
  }

  addWeapon(weaponId) {
    if (this.#owned.has(weaponId)) return false;
    weaponSpec(weaponId);
    this.#owned.add(weaponId);
    this.#weapons.set(weaponId, new WeaponState(weaponId, { startLoaded: weaponId === "pistol" }));
    return true;
  }

  equip(weaponId) {
    if (!this.#owned.has(weaponId)) return false;
    if (this.#equipped === weaponId) return true;
    this.#equipped = weaponId;
    this.#events?.emit(GAME_EVENT.weaponEquipped, { weaponId });
    return true;
  }

  weaponState(weaponId) {
    return this.#weapons.get(weaponId) ?? null;
  }

  /* --------------------------------------------------------- ammunition */

  looseRoundsOf(ammoId) {
    return this.#loose.get(ammoId) ?? 0;
  }

  setLooseRounds(ammoId, rounds) {
    if (rounds <= 0) this.#loose.delete(ammoId);
    else this.#loose.set(ammoId, rounds);
  }

  /**
   * Rounds the player could still fire for a weapon, counting the magazine,
   * loose rounds, and unopened packs in the train.
   */
  totalRoundsFor(weaponId, store) {
    const spec = weaponSpec(weaponId);
    if (!spec.ammoId) return Infinity;
    const state = this.#weapons.get(weaponId);
    const packs = store ? store.quantityOf(spec.ammoId) : 0;
    return (
      (state?.roundsInMagazine ?? 0) +
      this.looseRoundsOf(spec.ammoId) +
      packs * cargoSpec(spec.ammoId).roundsPerUnit
    );
  }

  /** Reserve rounds only - what the HUD shows next to the magazine count. */
  reserveRoundsFor(weaponId, store) {
    const state = this.#weapons.get(weaponId);
    return this.totalRoundsFor(weaponId, store) - (state?.roundsInMagazine ?? 0);
  }

  /**
   * Reloads the equipped weapon out of the train's stores.
   * @param {{ quantityOf: Function, removeCargo: Function }} store
   */
  reloadEquipped(store) {
    const state = this.equippedWeapon;
    if (!state) return false;
    const started = state.beginReload(new AmmunitionSupply(this, store));
    if (started) this.#events?.emit(GAME_EVENT.weaponReloaded, { weaponId: state.weaponId });
    else if (state.isEmpty) this.#events?.emit(GAME_EVENT.ammunitionEmpty, { weaponId: state.weaponId });
    return started;
  }

  /* ------------------------------------------------------------ medkits */

  addMedkit(count = 1) {
    const accepted = Math.min(count, PLAYER.medkit.maxCarried - this.#medkits);
    if (accepted <= 0) return 0;
    this.#medkits += accepted;
    return accepted;
  }

  /**
   * Uses one medkit on the given health system.
   * @returns {number} health restored, or 0 if nothing happened
   */
  useMedkit(health) {
    if (this.#medkits <= 0 || health.missing <= 0) return 0;
    const restored = health.heal(PLAYER.medkit.healAmount);
    if (restored > 0) this.#medkits -= 1;
    return restored;
  }

  update(deltaSeconds, { triggerHeld = false } = {}) {
    for (const [id, state] of this.#weapons) {
      state.update(deltaSeconds, { triggerHeld: triggerHeld && id === this.#equipped });
    }
  }

  serialize() {
    return {
      owned: [...this.#owned],
      equipped: this.#equipped,
      medkits: this.#medkits,
      loose: Object.fromEntries(this.#loose),
      weapons: [...this.#weapons.values()].map((state) => state.serialize()),
    };
  }

  static deserialize(data, { events } = {}) {
    const inventory = new Inventory({ events });
    inventory.#owned = new Set(data.owned ?? ["pistol"]);
    inventory.#medkits = data.medkits ?? 0;
    inventory.#loose = new Map(Object.entries(data.loose ?? {}));
    inventory.#weapons = new Map(
      (data.weapons ?? []).map((entry) => [entry.weaponId, WeaponState.deserialize(entry)]),
    );
    for (const id of inventory.#owned) {
      if (!inventory.#weapons.has(id)) {
        inventory.#weapons.set(id, new WeaponState(id, { startLoaded: false }));
      }
    }
    inventory.#equipped = inventory.#owned.has(data.equipped) ? data.equipped : "pistol";
    return inventory;
  }
}
