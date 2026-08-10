/**
 * LAST TRAIN - storage space inside one vehicle.
 *
 * Capacity is counted in slots, not in items, because a barrel of oil and a
 * lump of coal are not the same problem. That single decision is what makes
 * the mid-game interesting: the player is always trading storage between
 * money and firepower.
 *
 * Every operation is partial-safe. Adding 40 coal to a hold with room for 12
 * stores 12 and reports 12, rather than failing outright or silently
 * overfilling. Shops rely on that to offer a "fill up" button that does the
 * sensible thing.
 */

import { cargoSpec } from "../../data/cargo.js";

export class CargoHold {
  #capacity;
  #items = new Map();

  constructor(capacitySlots = 0) {
    this.#capacity = Math.max(0, capacitySlots);
  }

  get capacity() {
    return this.#capacity;
  }

  /**
   * Capacity changes when a transport wagon is upgraded. Upgrades only ever
   * grow, but the guard is here so a data change can never silently delete
   * cargo the player paid for.
   */
  setCapacity(slots) {
    const next = Math.max(0, slots);
    if (next < this.usedSlots) {
      throw new Error(`Cannot shrink hold to ${next} slots: ${this.usedSlots} are in use`);
    }
    this.#capacity = next;
  }

  get usedSlots() {
    let used = 0;
    for (const [id, quantity] of this.#items) used += cargoSpec(id).slots * quantity;
    return used;
  }

  get freeSlots() {
    return this.#capacity - this.usedSlots;
  }

  get isEmpty() {
    return this.#items.size === 0;
  }

  quantityOf(id) {
    return this.#items.get(id) ?? 0;
  }

  /** How many units of `id` would still fit. */
  spaceFor(id) {
    const slots = cargoSpec(id).slots;
    return slots <= 0 ? Infinity : Math.floor(this.freeSlots / slots);
  }

  /** Stores up to `quantity` units. Returns how many were actually stored. */
  add(id, quantity) {
    if (quantity <= 0) return 0;
    const accepted = Math.min(Math.floor(quantity), this.spaceFor(id));
    if (accepted <= 0) return 0;
    this.#items.set(id, this.quantityOf(id) + accepted);
    return accepted;
  }

  /** Takes up to `quantity` units. Returns how many were actually taken. */
  remove(id, quantity) {
    if (quantity <= 0) return 0;
    const taken = Math.min(Math.floor(quantity), this.quantityOf(id));
    if (taken <= 0) return 0;
    const left = this.quantityOf(id) - taken;
    if (left > 0) this.#items.set(id, left);
    else this.#items.delete(id);
    return taken;
  }

  /** `[cargoId, quantity]` pairs, for interfaces and for the Loader's search. */
  entries() {
    return [...this.#items.entries()];
  }

  clear() {
    this.#items.clear();
  }

  serialize() {
    return { capacity: this.#capacity, items: Object.fromEntries(this.#items) };
  }

  static deserialize(data) {
    const hold = new CargoHold(data?.capacity ?? 0);
    for (const [id, quantity] of Object.entries(data?.items ?? {})) {
      // Straight into the map: a save must round-trip exactly, even if a
      // later balance change made the same load no longer fit.
      if (quantity > 0) hold.#items.set(id, quantity);
    }
    return hold;
  }
}
