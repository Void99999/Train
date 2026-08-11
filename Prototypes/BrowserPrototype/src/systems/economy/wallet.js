/**
 * LAST TRAIN - the player's money.
 *
 * Displayed as a bare number with no symbol and no suffix. The shop it is
 * standing next to makes it obvious what it means, and "1250" reads better on
 * a dirty industrial interface than "1250 Credits" does.
 *
 * Lifetime earnings are tracked separately from the balance, because the run
 * summary wants to know what the player made, not what they still have.
 */

import { GAME_EVENT } from "../../core/events.js";
import { ECONOMY } from "../../data/balance.js";

export class Wallet {
  #balance;
  #totalEarned = 0;
  #events;

  constructor({ events, startingBalance = ECONOMY.startingMoney } = {}) {
    this.#events = events ?? null;
    this.#balance = startingBalance;
  }

  get balance() {
    return this.#balance;
  }

  /** Everything ever taken in during this run, for the statistics screen. */
  get totalEarned() {
    return this.#totalEarned;
  }

  canAfford(amount) {
    return this.#balance >= amount;
  }

  /** @returns {boolean} false when the player cannot afford it; nothing is spent */
  spend(amount) {
    if (amount < 0) throw new Error("Cannot spend a negative amount");
    if (!this.canAfford(amount)) return false;
    this.#balance -= amount;
    this.#events?.emit(GAME_EVENT.moneyChanged, { balance: this.#balance, delta: -amount });
    return true;
  }

  earn(amount) {
    if (amount <= 0) return 0;
    this.#balance += amount;
    this.#totalEarned += amount;
    this.#events?.emit(GAME_EVENT.moneyChanged, { balance: this.#balance, delta: amount });
    return amount;
  }

  /** Death penalty in Normal mode. @returns {number} the amount lost */
  loseFraction(fraction) {
    const lost = Math.floor(this.#balance * Math.max(0, Math.min(1, fraction)));
    if (lost <= 0) return 0;
    this.#balance -= lost;
    this.#events?.emit(GAME_EVENT.moneyChanged, { balance: this.#balance, delta: -lost });
    return lost;
  }

  serialize() {
    return { balance: this.#balance, totalEarned: this.#totalEarned };
  }

  restore(data) {
    this.#balance = data?.balance ?? ECONOMY.startingMoney;
    this.#totalEarned = data?.totalEarned ?? 0;
  }
}
