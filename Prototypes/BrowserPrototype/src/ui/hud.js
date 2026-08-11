/**
 * LAST TRAIN - heads-up display.
 *
 * Sparse on purpose. Money and journey top left, condition bottom left,
 * ammunition bottom right, a small crosshair, and nothing else unless
 * something is happening. The stamina bar appears when it is being used and
 * disappears when it is full.
 *
 * The journey readout shows how far the train has come and which outpost it
 * last pulled into. It never shows distance remaining, outposts remaining, or
 * anything else that would tell the player the line has an end in sight - the
 * whole ending depends on that being a surprise.
 */

import { el } from "./dom.js";
import { formatMoney, formatDistanceKm, formatSpeedKmh } from "../core/localization.js";
import { TRAIN } from "../data/balance.js";

const TOAST_LIFETIME_MS = 3200;

export class Hud {
  #root;
  #layer;
  #localization;
  #nodes = {};
  #toasts = [];

  constructor({ root, localization }) {
    this.#root = root;
    this.#localization = localization;
    this.#build();
  }

  get t() {
    return (key, params) => this.#localization.t(key, params);
  }

  /**
   * Builds the HUD into a container of its own.
   *
   * Rebuilding must never clear the shared root: other layers live there too,
   * and wiping it takes them with it. This is not hypothetical - the cinematic
   * overlay and the HUD shared a root, each cleared it on build, and whichever
   * built second silently deleted the other.
   */
  #build() {
    this.#layer?.remove();
    const t = this.t;

    this.#nodes.money = el("span", { class: "hud__value hud__value--money" }, "0");
    this.#nodes.distance = el("span", { class: "hud__value" }, "0.0 km");
    this.#nodes.outpost = el("span", { class: "hud__value" }, t("HUD_NO_OUTPOST_YET"));

    this.#nodes.healthFill = el("div", { class: "hud__bar-fill" });
    this.#nodes.healthBar = el(
      "div",
      { class: "hud__bar hud__bar--health" },
      this.#nodes.healthFill,
    );
    this.#nodes.healthValue = el("span", { class: "hud__value" }, "100");

    this.#nodes.staminaFill = el("div", { class: "hud__bar-fill" });
    this.#nodes.staminaBar = el(
      "div",
      { class: "hud__bar hud__bar--stamina", hidden: true },
      this.#nodes.staminaFill,
    );

    this.#nodes.throttleNotches = TRAIN.throttleSteps.slice(1).map(() =>
      el("span", { class: "hud__throttle-notch" }),
    );
    this.#nodes.speed = el("span", { class: "hud__value" }, "0 km/h");

    this.#nodes.magazine = el("span", { class: "hud__ammo-magazine" }, "12");
    this.#nodes.reserve = el("span", { class: "hud__ammo-reserve" }, "0");
    this.#nodes.weaponName = el("div", { class: "hud__weapon" }, t("WEAPON_PISTOL"));

    this.#nodes.prompt = el("div", { class: "hud__prompt", hidden: true });
    this.#nodes.vignette = el("div", { class: "hud__vignette" });
    this.#nodes.toastStack = el("div", { class: "toast-stack" });

    this.#layer = el(
      "div",
      { class: "hud__layer" },
      el(
        "div",
        { class: "hud__corner hud__corner--top-left" },
        el(
          "div",
          { class: "hud__readout" },
          el("span", { class: "hud__label" }, t("HUD_MONEY")),
          this.#nodes.money,
        ),
        el(
          "div",
          { class: "hud__readout" },
          el("span", { class: "hud__label" }, t("HUD_DISTANCE_TRAVELLED")),
          this.#nodes.distance,
        ),
        el(
          "div",
          { class: "hud__readout" },
          el("span", { class: "hud__label" }, t("HUD_LAST_OUTPOST")),
          this.#nodes.outpost,
        ),
      ),

      el(
        "div",
        { class: "hud__corner hud__corner--bottom-left" },
        el(
          "div",
          { class: "hud__readout" },
          el("span", { class: "hud__label" }, t("HUD_HEALTH")),
          this.#nodes.healthValue,
        ),
        this.#nodes.healthBar,
        this.#nodes.staminaBar,
      ),

      el(
        "div",
        { class: "hud__corner hud__corner--bottom-right" },
        el(
          "div",
          { class: "hud__readout" },
          el("span", { class: "hud__label" }, t("HUD_SPEED")),
          this.#nodes.speed,
        ),
        el("div", { class: "hud__throttle" }, ...this.#nodes.throttleNotches),
        el(
          "div",
          { class: "hud__ammo" },
          this.#nodes.magazine,
          " / ",
          this.#nodes.reserve,
        ),
        this.#nodes.weaponName,
      ),

      el("div", { class: "hud__crosshair" }),
      this.#nodes.prompt,
      this.#nodes.vignette,
      this.#nodes.toastStack,
    );

    this.#root.append(this.#layer);
  }

  /** Rebuilds every label in the new language. */
  refreshLanguage() {
    this.#build();
  }

  show() {
    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }

  /**
   * One update per frame with everything the HUD draws.
   * Deliberately takes a flat snapshot rather than the live systems, so the
   * HUD cannot reach into the simulation and read something it should not.
   */
  update(snapshot) {
    const t = this.t;

    this.#nodes.money.textContent = formatMoney(snapshot.money);
    this.#nodes.distance.textContent = formatDistanceKm(snapshot.distanceKm);
    this.#nodes.outpost.textContent = snapshot.lastOutpostNameKey
      ? t(snapshot.lastOutpostNameKey)
      : t("HUD_NO_OUTPOST_YET");

    const healthFraction = Math.max(0, Math.min(1, snapshot.healthFraction));
    this.#nodes.healthValue.textContent = String(Math.ceil(snapshot.health));
    this.#nodes.healthFill.style.transform = `scaleX(${healthFraction})`;
    this.#nodes.healthBar.dataset.critical = String(healthFraction <= 0.25);
    this.#nodes.vignette.style.opacity = String(
      healthFraction >= 0.5 ? 0 : (0.5 - healthFraction) * 1.6,
    );

    this.#nodes.staminaBar.hidden = !snapshot.staminaVisible;
    this.#nodes.staminaFill.style.transform = `scaleX(${snapshot.staminaFraction})`;

    this.#nodes.speed.textContent = formatSpeedKmh(snapshot.speedKmh);
    this.#nodes.throttleNotches.forEach((notch, index) => {
      notch.dataset.active = String(index < snapshot.throttleIndex);
    });

    this.#nodes.magazine.textContent =
      snapshot.magazine === Infinity ? "-" : String(snapshot.magazine);
    this.#nodes.reserve.textContent =
      snapshot.reserve === Infinity ? "-" : String(snapshot.reserve);
    this.#nodes.weaponName.textContent = snapshot.reloading
      ? t("WEAPON_RELOADING")
      : t(snapshot.weaponNameKey);
  }

  /**
   * Shows or clears the interaction prompt.
   * @param {string|null} text already localized, or null to hide
   */
  setPrompt(text) {
    this.#nodes.prompt.hidden = !text;
    if (text) this.#nodes.prompt.textContent = text;
  }

  /** A short, self-clearing message. Used sparingly - this is not a feed. */
  toast(text, { variant = "default" } = {}) {
    const node = el("div", { class: `toast${variant === "default" ? "" : ` toast--${variant}`}` }, text);
    this.#nodes.toastStack.append(node);
    this.#toasts.push(node);

    setTimeout(() => {
      node.remove();
      this.#toasts = this.#toasts.filter((entry) => entry !== node);
    }, TOAST_LIFETIME_MS);
  }
}
