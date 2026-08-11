/**
 * LAST TRAIN - what the player has earned the right to buy.
 *
 * Unlocks are granted by reaching outposts and are never taken away again.
 * Once the assault rifle is available at outpost 1 it is available at every
 * outpost after it - the player should never arrive somewhere and find that
 * the thing they were saving up for has gone.
 */

import { UNLOCKS_BY_OUTPOST, STARTING_UNLOCKS, unlocksUpTo } from "../../data/progression.js";
import { GAME_EVENT } from "../../core/events.js";

export class Unlocks {
  #granted = new Set(STARTING_UNLOCKS);
  #events;

  constructor({ events } = {}) {
    this.#events = events ?? null;
  }

  has(unlockId) {
    return this.#granted.has(unlockId);
  }

  get all() {
    return [...this.#granted];
  }

  /** @returns {string[]} the unlocks that were newly granted */
  grant(unlockIds) {
    const fresh = unlockIds.filter((id) => !this.#granted.has(id));
    for (const id of fresh) {
      this.#granted.add(id);
      this.#events?.emit(GAME_EVENT.unlockGranted, { unlockId: id });
    }
    return fresh;
  }

  /** Grants everything an outpost hands out. Safe to call twice. */
  grantForOutpost(outpostNumber) {
    return this.grant(UNLOCKS_BY_OUTPOST[outpostNumber] ?? []);
  }

  /** Used when a checkpoint restores a run at a given outpost. */
  restoreToOutpost(outpostNumber) {
    this.#granted = unlocksUpTo(outpostNumber);
  }

  serialize() {
    return [...this.#granted];
  }

  restore(data) {
    this.#granted = new Set(Array.isArray(data) ? data : STARTING_UNLOCKS);
  }
}
