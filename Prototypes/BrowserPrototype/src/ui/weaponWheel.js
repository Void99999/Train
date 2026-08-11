/**
 * LAST TRAIN - weapon wheel.
 *
 * Held on TAB. The mouse picks a segment, releasing TAB equips it.
 *
 * Only weapons the player actually owns appear. Locked weapons are not drawn
 * as greyed-out slots either: a wheel full of things you cannot use is a
 * shopping list, not a weapon selector, and the player already sees prices in
 * the weapon shop.
 *
 * The pointer stays locked the whole time, so selection works from accumulated
 * mouse movement rather than a cursor position. The accumulated vector is
 * clamped to the wheel's radius, which makes a small flick enough to select
 * and stops a fast movement from wrapping past the segment you wanted.
 */

import { el, clear } from "./dom.js";

/** How far the mouse must travel from centre before a segment is picked. */
const DEAD_ZONE = 26;
/** Radius the selection vector is clamped to. */
const MAX_RADIUS = 130;
/** Mouse pixels to wheel pixels. */
const SENSITIVITY = 0.85;

export class WeaponWheel {
  #root;
  #localization;
  #layer = null;
  #segments = [];
  #weaponIds = [];
  #selection = { x: 0, y: 0 };
  #selectedIndex = -1;
  #open = false;
  #pointer = null;

  constructor({ root, localization }) {
    this.#root = root;
    this.#localization = localization;
  }

  get isOpen() {
    return this.#open;
  }

  get selectedWeaponId() {
    return this.#weaponIds[this.#selectedIndex] ?? null;
  }

  /**
   * Opens the wheel.
   *
   * @param {string[]} weaponIds  owned weapons, in wheel order
   * @param {string} equippedId   pre-selected, so releasing TAB immediately
   *                              keeps the current weapon rather than changing it
   * @param {(id: string) => string} nameOf
   * @param {(id: string) => {magazine: number, reserve: number}} ammoOf
   */
  open(weaponIds, equippedId, nameOf, ammoOf) {
    this.#weaponIds = [...weaponIds];
    this.#selection = { x: 0, y: 0 };
    this.#selectedIndex = Math.max(0, this.#weaponIds.indexOf(equippedId));
    this.#open = true;
    this.#build(nameOf, ammoOf);
    this.#refresh();
  }

  /** Closes the wheel and reports what was chosen. */
  close() {
    this.#open = false;
    this.#layer?.remove();
    this.#layer = null;
    this.#segments = [];
    return this.selectedWeaponId;
  }

  /** Feeds mouse movement in while the pointer is locked. */
  applyMouseDelta(deltaX, deltaY) {
    if (!this.#open) return;

    this.#selection.x += deltaX * SENSITIVITY;
    this.#selection.y += deltaY * SENSITIVITY;

    const distance = Math.hypot(this.#selection.x, this.#selection.y);
    if (distance > MAX_RADIUS) {
      const scale = MAX_RADIUS / distance;
      this.#selection.x *= scale;
      this.#selection.y *= scale;
    }

    if (distance >= DEAD_ZONE && this.#weaponIds.length > 0) {
      // Screen y grows downward; negate it so "up" is the top segment.
      const angle = Math.atan2(this.#selection.x, -this.#selection.y);
      const turns = (angle + Math.PI * 2) % (Math.PI * 2);
      const slice = (Math.PI * 2) / this.#weaponIds.length;
      this.#selectedIndex = Math.round(turns / slice) % this.#weaponIds.length;
    }

    this.#refresh();
  }

  /** Direct selection, for the number keys and for tests. */
  selectIndex(index) {
    if (index < 0 || index >= this.#weaponIds.length) return false;
    this.#selectedIndex = index;
    this.#refresh();
    return true;
  }

  #build(nameOf, ammoOf) {
    this.#layer?.remove();
    this.#segments = [];

    const count = this.#weaponIds.length;
    const items = this.#weaponIds.map((id, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const radius = 118;
      const ammo = ammoOf(id);

      const node = el(
        "div",
        {
          class: "wheel__slot",
          style: `transform: translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${
            Math.sin(angle) * radius
          }px)`,
        },
        el("div", { class: "wheel__slot-name" }, nameOf(id)),
        el(
          "div",
          { class: "wheel__slot-ammo" },
          ammo.magazine === Infinity ? "-" : `${ammo.magazine} / ${ammo.reserve}`,
        ),
      );
      this.#segments.push(node);
      return node;
    });

    this.#pointer = el("div", { class: "wheel__pointer" });

    this.#layer = el(
      "div",
      { class: "wheel" },
      el(
        "div",
        { class: "wheel__dial" },
        el("div", { class: "wheel__ring" }),
        this.#pointer,
        ...items,
      ),
      el(
        "div",
        { class: "wheel__hint" },
        this.#localization.t("WEAPON_WHEEL_HINT", { key: "Tab" }),
      ),
    );

    this.#root.append(this.#layer);
  }

  #refresh() {
    this.#segments.forEach((node, index) => {
      node.dataset.selected = String(index === this.#selectedIndex);
    });

    if (this.#pointer) {
      const distance = Math.hypot(this.#selection.x, this.#selection.y);
      this.#pointer.style.opacity = distance >= DEAD_ZONE ? "1" : "0.25";
      this.#pointer.style.transform =
        `translate(-50%, -50%) translate(${this.#selection.x}px, ${this.#selection.y}px)`;
    }
  }
}
