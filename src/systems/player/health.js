/**
 * LAST TRAIN - player condition.
 *
 * 100 points and no regeneration anywhere. Health is a resource the player
 * buys back with money at an outpost or with a medkit they chose to carry
 * instead of something else. That is the whole design: taking a hit has to
 * still cost something twenty minutes later.
 */

import { PLAYER } from "../../data/balance.js";
import { GAME_EVENT } from "../../core/events.js";

export class Health {
  #value = PLAYER.maxHealth;
  #events;

  constructor({ events } = {}) {
    this.#events = events ?? null;
  }

  get value() {
    return this.#value;
  }

  get max() {
    return PLAYER.maxHealth;
  }

  get fraction() {
    return this.#value / PLAYER.maxHealth;
  }

  get missing() {
    return PLAYER.maxHealth - this.#value;
  }

  get isDead() {
    return this.#value <= 0;
  }

  /** True while the screen effects should show the player is badly hurt. */
  get isCritical() {
    return this.fraction <= 0.25 && !this.isDead;
  }

  /** @returns {{ applied: number, died: boolean }} */
  damage(amount, { source = null } = {}) {
    if (amount <= 0 || this.isDead) return { applied: 0, died: false };
    const applied = Math.min(amount, this.#value);
    this.#value -= applied;

    this.#events?.emit(GAME_EVENT.playerDamaged, {
      amount: applied,
      remaining: this.#value,
      fraction: this.fraction,
      source,
    });

    if (this.isDead) this.#events?.emit(GAME_EVENT.playerDied, { source });
    return { applied, died: this.isDead };
  }

  /** @returns {number} how much was actually restored */
  heal(amount) {
    if (amount <= 0 || this.isDead) return 0;
    const restored = Math.min(amount, this.missing);
    this.#value += restored;
    if (restored > 0) {
      this.#events?.emit(GAME_EVENT.playerHealed, { amount: restored, value: this.#value });
    }
    return restored;
  }

  /** Used on respawn and when a run begins. */
  setFraction(fraction) {
    this.#value = Math.max(0, Math.min(PLAYER.maxHealth, PLAYER.maxHealth * fraction));
  }

  serialize() {
    return { value: this.#value };
  }

  restore(data) {
    this.#value = Math.min(PLAYER.maxHealth, Math.max(0, data?.value ?? PLAYER.maxHealth));
  }
}
