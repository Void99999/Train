/**
 * LAST TRAIN - sprint stamina.
 *
 * Eight seconds of running, six to get it back, and a second of standing still
 * before recovery even begins. That last delay is what stops the player from
 * tapping sprint forever and turns "can I make it to the rear wagon before the
 * tank fires again" into a real question.
 *
 * The bar is only worth showing while it matters, which is what `shouldDisplay`
 * is for - a permanent stamina bar in the corner is HUD clutter.
 */

import { PLAYER } from "../../data/balance.js";
import { GAME_EVENT } from "../../core/events.js";

export class Stamina {
  #value = PLAYER.stamina.max;
  #sprinting = false;
  #secondsSinceSprintEnded = Infinity;
  #events;

  constructor({ events } = {}) {
    this.#events = events ?? null;
  }

  get value() {
    return this.#value;
  }

  get max() {
    return PLAYER.stamina.max;
  }

  get fraction() {
    return this.#value / PLAYER.stamina.max;
  }

  get isSprinting() {
    return this.#sprinting;
  }

  get isExhausted() {
    return this.#value <= 0;
  }

  /** Hide the bar when it is full and nothing is happening to it. */
  get shouldDisplay() {
    return this.#sprinting || this.#value < PLAYER.stamina.max;
  }

  /**
   * Advances one step.
   *
   * @param {number} deltaSeconds
   * @param {object} intent
   * @param {boolean} intent.wantsToSprint  sprint key held
   * @param {boolean} intent.isMoving       actually moving on the ground
   * @returns {boolean} whether the player is sprinting this step
   */
  update(deltaSeconds, { wantsToSprint = false, isMoving = false } = {}) {
    const wasSprinting = this.#sprinting;
    const threshold = this.#sprinting ? 0 : PLAYER.stamina.minimumToStartSprinting;
    this.#sprinting = wantsToSprint && isMoving && this.#value > threshold;

    if (this.#sprinting) {
      this.#value = Math.max(0, this.#value - PLAYER.stamina.drainPerSecond * deltaSeconds);
      this.#secondsSinceSprintEnded = 0;
      if (this.#value === 0) this.#sprinting = false;
    } else {
      this.#secondsSinceSprintEnded += deltaSeconds;
      if (this.#secondsSinceSprintEnded >= PLAYER.stamina.regenDelaySeconds) {
        this.#value = Math.min(
          PLAYER.stamina.max,
          this.#value + PLAYER.stamina.regenPerSecond * deltaSeconds,
        );
      }
    }

    if (wasSprinting !== this.#sprinting || this.#value !== PLAYER.stamina.max) {
      this.#events?.emit(GAME_EVENT.staminaChanged, {
        value: this.#value,
        fraction: this.fraction,
        sprinting: this.#sprinting,
      });
    }

    return this.#sprinting;
  }

  /** Movement speed for the current state, in metres per second. */
  currentSpeed({ crouching = false } = {}) {
    if (crouching) return PLAYER.movement.crouchSpeed;
    return this.#sprinting ? PLAYER.movement.sprintSpeed : PLAYER.movement.walkSpeed;
  }

  refill() {
    this.#value = PLAYER.stamina.max;
    this.#sprinting = false;
    this.#secondsSinceSprintEnded = Infinity;
  }

  serialize() {
    return { value: this.#value };
  }

  restore(data) {
    this.#value = Math.min(PLAYER.stamina.max, Math.max(0, data?.value ?? PLAYER.stamina.max));
  }
}
