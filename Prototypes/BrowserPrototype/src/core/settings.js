/**
 * LAST TRAIN - player settings.
 *
 * Everything the options and language menus touch lives here, and every change
 * is written to disk immediately. A player who sets the volume and then closes
 * the game with alt-F4 should not lose that.
 *
 * Values are validated on the way in, so a hand-edited or half-migrated save
 * cannot put the volume at 4000 or the language at something that does not
 * exist.
 */

import { GAME_EVENT } from "./events.js";
import { SAVE_SLOT } from "./saveSystem.js";
import { SETTINGS_DEFAULTS, MODES } from "../data/balance.js";

const VALIDATORS = {
  volume: (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return SETTINGS_DEFAULTS.volume;
    return Math.min(100, Math.max(0, Math.round(number)));
  },
  blood: (value) => Boolean(value),
  language: (value) => (typeof value === "string" && value.length > 0 ? value : SETTINGS_DEFAULTS.language),
  mode: (value) => (value === MODES.hardcore.id ? MODES.hardcore.id : MODES.normal.id),
};

export class Settings {
  #values;
  #save;
  #events;
  #localization;

  constructor({ saveSystem, events, localization = null } = {}) {
    this.#save = saveSystem;
    this.#events = events;
    this.#localization = localization;

    const stored = saveSystem?.load(SAVE_SLOT.settings, null);
    this.#values = { ...SETTINGS_DEFAULTS };
    if (stored && typeof stored === "object") {
      for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        if (key in stored) this.#values[key] = VALIDATORS[key](stored[key]);
      }
    }

    // A stored language that this build no longer ships falls back rather than
    // leaving the menus rendering raw keys.
    if (this.#localization && !this.#localization.has(this.#values.language)) {
      this.#values.language = SETTINGS_DEFAULTS.language;
    }
    this.#localization?.setLanguage(this.#values.language);
  }

  get volume() {
    return this.#values.volume;
  }

  /** Volume as a 0-1 gain for the audio mixer. */
  get volumeGain() {
    return this.#values.volume / 100;
  }

  get blood() {
    return this.#values.blood;
  }

  get language() {
    return this.#values.language;
  }

  get mode() {
    return this.#values.mode;
  }

  /** Every setting at once, for the options screen. */
  snapshot() {
    return { ...this.#values };
  }

  set(key, value) {
    if (!(key in SETTINGS_DEFAULTS)) throw new Error(`Unknown setting: ${key}`);
    const clean = VALIDATORS[key](value);
    if (this.#values[key] === clean) return clean;

    this.#values[key] = clean;
    if (key === "language") this.#localization?.setLanguage(clean);

    this.#persist();
    this.#events?.emit(GAME_EVENT.settingsChanged, { key, value: clean });
    return clean;
  }

  /** Convenience for the checkbox in the options menu. */
  toggle(key) {
    return this.set(key, !this.#values[key]);
  }

  resetToDefaults() {
    for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) this.set(key, value);
  }

  #persist() {
    this.#save?.save(SAVE_SLOT.settings, this.#values);
  }
}
