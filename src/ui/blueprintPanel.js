/**
 * LAST TRAIN - the blueprint panel.
 *
 * What the player sees when they read the blue panel in the cab: the train as
 * it currently is, front to back, with each vehicle's condition.
 *
 * It is drawn from the live train every time it opens, so a wagon that has
 * just been shot off the back is simply not on the diagram. That is the point
 * of it - the blueprint is the player's only reliable answer to "what is
 * actually still attached to me".
 */

import { el } from "./dom.js";

const KIND_KEYS = {
  locomotive: "VEHICLE_LOCOMOTIVE",
  transport: "VEHICLE_TRANSPORT",
  combat: "VEHICLE_COMBAT",
};

export class BlueprintPanel {
  #root;
  #localization;
  #layer = null;

  constructor({ root, localization }) {
    this.#root = root;
    this.#localization = localization;
  }

  get isOpen() {
    return this.#layer !== null;
  }

  toggle(train, crew) {
    if (this.isOpen) {
      this.close();
      return false;
    }
    this.open(train, crew);
    return true;
  }

  open(train, crew = null) {
    this.close();
    const t = (key, params) => this.#localization.t(key, params);

    const cars = train.vehicles.map((vehicle, index) => {
      const fraction = Math.max(0, Math.min(1, vehicle.healthFraction));
      return el(
        "div",
        { class: "blueprint__car", "data-kind": vehicle.kind },
        el(
          "div",
          { class: "blueprint__car-head" },
          el("span", { class: "blueprint__car-name" }, t(KIND_KEYS[vehicle.kind])),
          el(
            "span",
            { class: "blueprint__car-level" },
            index === 0 ? "" : t("VEHICLE_LEVEL", { level: vehicle.level }),
          ),
        ),
        el(
          "div",
          { class: "blueprint__bar" },
          el("div", {
            class: "blueprint__bar-fill",
            style: `transform: scaleX(${fraction})`,
            "data-state": vehicle.damageState,
          }),
        ),
        el(
          "div",
          { class: "blueprint__car-foot" },
          el("span", {}, `${Math.ceil(vehicle.health)} / ${vehicle.maxHealth}`),
          el(
            "span",
            {},
            vehicle.isArmoured ? t("BLUEPRINT_ARMOURED") : t("BLUEPRINT_UNARMOURED"),
          ),
        ),
      );
    });

    const loaderLine = crew?.hasLoader
      ? t(crew.loader.statusKey)
      : t("BLUEPRINT_LOADER_NONE");

    this.#layer = el(
      "div",
      { class: "blueprint" },
      el(
        "div",
        { class: "blueprint__sheet" },
        el("h2", { class: "blueprint__title" }, t("BLUEPRINT_TITLE")),
        el("div", { class: "blueprint__train" }, ...cars),
        el(
          "div",
          { class: "blueprint__stats" },
          el(
            "span",
            {},
            `${t("STAT_WAGON_COUNT")}: ${train.wagonCount}`,
          ),
          el(
            "span",
            {},
            `${t("STAT_CARGO_CAPACITY")}: ${train.usedCargoSlots} / ${train.cargoCapacity}`,
          ),
          el(
            "span",
            {},
            `${t("STAT_TOP_SPEED")}: ${Math.round(train.maxSpeedKmh)} km/h`,
          ),
          el("span", {}, `${t("BLUEPRINT_LOADER")}: ${loaderLine}`),
        ),
        el("div", { class: "blueprint__hint" }, t("MENU_BACK")),
      ),
    );

    this.#root.append(this.#layer);
  }

  close() {
    this.#layer?.remove();
    this.#layer = null;
  }
}
