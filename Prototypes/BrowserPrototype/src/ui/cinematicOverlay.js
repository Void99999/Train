/**
 * LAST TRAIN - cinematic overlay.
 *
 * Letterbox bars, the fade to black, the alarm flash, and the skip hint. It
 * owns nothing else, and critically it owns its own teardown: `clear()` puts
 * every element back to its resting state.
 *
 * That matters because the single worst failure a cutscene can have is ending
 * without cleaning up - the player gets control back but is still looking at
 * black bars, or worse, a black screen. `clear()` is called on the way out of
 * the cutscene whether it was watched or skipped.
 */

import { el } from "./dom.js";

export class CinematicOverlay {
  #root;
  #nodes = {};
  #localization;

  constructor({ root, localization }) {
    this.#root = root;
    this.#localization = localization;
    this.#build();
  }

  /**
   * Builds into a container of its own and appends it.
   *
   * Deliberately does not clear the root: the HUD lives in the same element,
   * and clearing here deleted it.
   */
  #build() {
    this.#nodes.layer?.remove();

    this.#nodes.top = el("div", { class: "cinematic__bar cinematic__bar--top" });
    this.#nodes.bottom = el("div", { class: "cinematic__bar cinematic__bar--bottom" });
    this.#nodes.fade = el("div", { class: "cinematic__fade" });
    this.#nodes.flash = el("div", { class: "cinematic__flash" });
    this.#nodes.alarm = el("div", { class: "cinematic__alarm" });
    this.#nodes.skip = el("div", { class: "cinematic__skip" });

    this.#nodes.layer = el(
      "div",
      { class: "cinematic", "data-active": "false" },
      this.#nodes.top,
      this.#nodes.bottom,
      this.#nodes.fade,
      this.#nodes.flash,
      this.#nodes.alarm,
      this.#nodes.skip,
    );

    this.#root.append(this.#nodes.layer);
  }

  /** Brings the bars in and shows the skip hint. */
  begin({ skipLabel } = {}) {
    this.#nodes.layer.dataset.active = "true";
    this.#nodes.skip.textContent = skipLabel ?? "";
    this.#nodes.skip.hidden = !skipLabel;
  }

  /** 0 = fully visible, 1 = fully black. */
  setFade(amount) {
    this.#nodes.fade.style.opacity = String(Math.max(0, Math.min(1, amount)));
  }

  /** A brief white flash, for explosions and impacts. */
  setFlash(amount) {
    this.#nodes.flash.style.opacity = String(Math.max(0, Math.min(1, amount)));
  }

  /** Red cockpit warning wash, for the helicopter losing power. */
  setAlarm(amount) {
    this.#nodes.alarm.style.opacity = String(Math.max(0, Math.min(1, amount)));
  }

  /** 0 = no bars, 1 = full cinema bars. */
  setLetterbox(amount) {
    const height = `${Math.max(0, Math.min(1, amount)) * 11}vh`;
    this.#nodes.top.style.height = height;
    this.#nodes.bottom.style.height = height;
  }

  /**
   * Returns everything to its resting state and removes the overlay from play.
   * Safe to call more than once.
   */
  clear() {
    this.#nodes.layer.dataset.active = "false";
    this.setFade(0);
    this.setFlash(0);
    this.setAlarm(0);
    this.setLetterbox(0);
    this.#nodes.skip.hidden = true;
  }

  get isActive() {
    return this.#nodes.layer.dataset.active === "true";
  }
}
