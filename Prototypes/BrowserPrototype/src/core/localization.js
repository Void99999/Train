/**
 * LAST TRAIN - localization.
 *
 * No user-facing string is written into a system, a widget or a template. Code
 * asks for a key; this decides what the player reads. Adding a language means
 * adding one file under src/data/locales and registering it - nothing else in
 * the project has to change.
 *
 * Translations are written to sound natural in the target language rather than
 * to mirror the English word for word. Proper nouns, the game title and
 * established English terms stay as they are where translating them would read
 * like a machine did it.
 */

import { GAME_EVENT } from "./events.js";

/** A missing key renders as the key itself, which is loud and unmistakable. */
const MISSING_KEY_PREFIX = "!";

export class Localization {
  #locales = new Map();
  #language = null;
  #fallbackLanguage = "en";
  #events;
  #warnedKeys = new Set();

  constructor({ events, fallbackLanguage = "en" } = {}) {
    this.#events = events ?? null;
    this.#fallbackLanguage = fallbackLanguage;
  }

  /**
   * @param {string} code       language code, e.g. "en"
   * @param {object} descriptor { nameKey, strings }
   */
  register(code, descriptor) {
    this.#locales.set(code, descriptor);
    if (this.#language === null) this.#language = code;
    return this;
  }

  get availableLanguages() {
    return [...this.#locales.keys()];
  }

  get language() {
    return this.#language;
  }

  has(code) {
    return this.#locales.has(code);
  }

  /** Switches language. Unknown codes are ignored so a bad save cannot brick the menu. */
  setLanguage(code) {
    if (!this.#locales.has(code)) {
      console.warn(`Unknown language "${code}", keeping "${this.#language}"`);
      return false;
    }
    if (code === this.#language) return true;
    this.#language = code;
    this.#events?.emit(GAME_EVENT.languageChanged, { language: code });
    return true;
  }

  /**
   * Looks up a key and fills in `{placeholders}`.
   *
   *   t("PROMPT_INTERACT", { key: "E" })  ->  "Press E"
   *
   * Falls back to the fallback language, then to a visibly broken string, so a
   * missing translation shows up during testing instead of rendering as blank.
   */
  t(key, params) {
    const template = this.#lookup(key);
    if (template === null) {
      if (!this.#warnedKeys.has(key)) {
        this.#warnedKeys.add(key);
        console.warn(`Missing localization key: ${key}`);
      }
      return `${MISSING_KEY_PREFIX}${key}`;
    }
    return params ? interpolate(template, params) : template;
  }

  #lookup(key) {
    const active = this.#locales.get(this.#language)?.strings;
    if (active && key in active) return active[key];
    const fallback = this.#locales.get(this.#fallbackLanguage)?.strings;
    if (fallback && key in fallback) return fallback[key];
    return null;
  }

  /** The language's own name, for the language menu ("English", "Deutsch"). */
  languageName(code) {
    return this.#locales.get(code)?.nameKey ?? code;
  }

  /** Keys present in the fallback language but missing from `code`. */
  missingKeys(code) {
    const reference = this.#locales.get(this.#fallbackLanguage)?.strings ?? {};
    const target = this.#locales.get(code)?.strings ?? {};
    return Object.keys(reference).filter((key) => !(key in target));
  }
}

/**
 * Replaces `{name}` with `params.name`. An unknown placeholder is left in
 * place rather than replaced with "undefined", so the mistake stays readable.
 */
export function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/**
 * Money is displayed as a bare number. No symbol, no suffix, no "credits" -
 * the shop around the number makes it obvious what it is.
 */
export function formatMoney(amount) {
  return String(Math.round(amount));
}

/** Distance for the HUD. Never used to display anything that is *remaining*. */
export function formatDistanceKm(km) {
  return `${km.toFixed(1)} km`;
}

export function formatSpeedKmh(kmh) {
  return `${Math.round(kmh)} km/h`;
}

/** Run time as m:ss or h:mm:ss, for the statistics screen. */
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}
