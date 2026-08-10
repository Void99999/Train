/**
 * LAST TRAIN - menus.
 *
 * Main menu, options, language and pause. All four are one vertical stack of
 * buttons with no decoration around them, so the night railway behind the main
 * menu stays the thing the player is looking at.
 *
 * Exit Game is the last button in the stack, not a separate control parked at
 * the bottom of the screen.
 *
 * Every screen rebuilds itself when the language changes, which is what lets
 * the player switch to German from inside the pause menu and see it take
 * effect behind them without reopening anything.
 */

import { el, clear, makeKeyboardNavigable } from "./dom.js";
import { STATE } from "../core/gameState.js";
import { GAME_EVENT } from "../core/events.js";
import { MODES } from "../data/balance.js";

export class MenuSystem {
  #root;
  #localization;
  #settings;
  #state;
  #events;
  #actions;
  #teardown = null;
  #currentScreen = null;

  /**
   * @param {object} deps
   * @param {HTMLElement} deps.root       the overlay element
   * @param {object} deps.actions         { startRun, resumeRun, exitGame, ... }
   */
  constructor({ root, localization, settings, state, events, actions }) {
    this.#root = root;
    this.#localization = localization;
    this.#settings = settings;
    this.#state = state;
    this.#events = events;
    this.#actions = actions;

    // Redraw in place when the language changes, so switching from the pause
    // menu updates the menu the player is standing in.
    events.on(GAME_EVENT.languageChanged, () => {
      if (this.#currentScreen) this.show(this.#currentScreen);
    });
  }

  get t() {
    return (key, params) => this.#localization.t(key, params);
  }

  /** Renders a screen by name, replacing whatever was there. */
  show(name) {
    this.#teardown?.();
    clear(this.#root);
    this.#currentScreen = name;

    const builders = {
      mainMenu: () => this.#buildMainMenu(),
      options: () => this.#buildOptions(),
      language: () => this.#buildLanguage(),
      pause: () => this.#buildPause(),
    };

    const builder = builders[name];
    if (!builder) throw new Error(`Unknown screen: ${name}`);

    const screen = builder();
    this.#root.append(screen);
    this.#teardown = makeKeyboardNavigable(screen, {
      onCancel: () => this.#cancelFrom(name),
    });
    return screen;
  }

  hide() {
    this.#teardown?.();
    this.#teardown = null;
    this.#currentScreen = null;
    clear(this.#root);
  }

  get isOpen() {
    return this.#currentScreen !== null;
  }

  get currentScreen() {
    return this.#currentScreen;
  }

  #cancelFrom(name) {
    if (name === "options" || name === "language") this.#goBack();
    else if (name === "pause") this.#actions.resumeRun();
  }

  /** Options and Language are reachable from both menus and return to the right one. */
  #goBack() {
    const returningToPause = this.#state.previous === STATE.paused;
    this.#state.returnToPrevious();
    this.show(returningToPause ? "pause" : "mainMenu");
  }

  #openSubScreen(name, targetState) {
    this.#state.transitionTo(targetState);
    this.show(name);
  }

  /* ------------------------------------------------------------ main menu */

  #buildMainMenu() {
    const t = this.t;
    const hasSavedRun = Boolean(this.#actions.hasSavedRun?.());

    return el(
      "section",
      { class: "screen screen--menu", role: "navigation" },
      el("h1", { class: "title" }, t("GAME_TITLE")),
      el("div", { class: "title__rule" }),
      el("p", { class: "subtitle" }, t("GAME_SUBTITLE")),
      el(
        "div",
        { class: "menu-stack" },
        el("button", { class: "button", onclick: () => this.#actions.startRun() }, t("MENU_START")),
        hasSavedRun &&
          el(
            "button",
            { class: "button", onclick: () => this.#actions.resumeSavedRun() },
            t("MENU_RESUME_RUN"),
          ),
        el(
          "button",
          { class: "button", onclick: () => this.#openSubScreen("options", STATE.options) },
          t("MENU_OPTIONS"),
        ),
        el(
          "button",
          { class: "button", onclick: () => this.#openSubScreen("language", STATE.languageMenu) },
          t("MENU_LANGUAGE"),
        ),
        // Last in the stack. Not parked at the bottom of the screen.
        el("button", { class: "button", onclick: () => this.#actions.exitGame() }, t("MENU_EXIT")),
      ),
    );
  }

  /* --------------------------------------------------------------- pause */

  #buildPause() {
    const t = this.t;
    return el(
      "section",
      { class: "screen screen--panel" },
      el(
        "div",
        { class: "panel" },
        el("h2", { class: "panel-title" }, t("PAUSE_TITLE")),
        el(
          "div",
          { class: "menu-stack" },
          el(
            "button",
            { class: "button", onclick: () => this.#actions.resumeRun() },
            t("MENU_CONTINUE"),
          ),
          el(
            "button",
            { class: "button", onclick: () => this.#openSubScreen("options", STATE.options) },
            t("MENU_OPTIONS"),
          ),
          el(
            "button",
            { class: "button", onclick: () => this.#openSubScreen("language", STATE.languageMenu) },
            t("MENU_LANGUAGE"),
          ),
          el(
            "button",
            { class: "button", onclick: () => this.#actions.exitGame() },
            t("MENU_EXIT"),
          ),
        ),
      ),
    );
  }

  /* ------------------------------------------------------------- options */

  #buildOptions() {
    const t = this.t;
    const settings = this.#settings;

    const volumeValue = el("span", { class: "setting__value" }, `${settings.volume}%`);
    const volumeSlider = el("input", {
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      value: String(settings.volume),
      "aria-label": t("OPTIONS_VOLUME"),
      oninput: (event) => {
        const value = settings.set("volume", event.target.value);
        volumeValue.textContent = `${value}%`;
      },
    });

    const bloodToggle = this.#buildToggle({
      label: t("OPTIONS_BLOOD"),
      value: settings.blood,
      onLabel: t("OPTIONS_ON"),
      offLabel: t("OPTIONS_OFF"),
      onChange: (value) => settings.set("blood", value),
    });

    const modeToggle = this.#buildToggle({
      label: t("MODE_TITLE"),
      value: settings.mode === MODES.normal.id,
      onLabel: t("MODE_NORMAL"),
      offLabel: t("MODE_HARDCORE"),
      onChange: (isNormal) =>
        settings.set("mode", isNormal ? MODES.normal.id : MODES.hardcore.id),
    });

    return el(
      "section",
      { class: "screen screen--panel" },
      el(
        "div",
        { class: "panel" },
        el("h2", { class: "panel-title" }, t("OPTIONS_TITLE")),

        el(
          "div",
          { class: "setting" },
          el("span", { class: "setting__label" }, t("OPTIONS_VOLUME")),
          el("div", { class: "setting__control" }, volumeSlider, volumeValue),
        ),

        el(
          "div",
          { class: "setting" },
          el("span", { class: "setting__label" }, t("OPTIONS_BLOOD")),
          bloodToggle,
          el("p", { class: "setting__hint" }, t("OPTIONS_BLOOD_HINT")),
        ),

        // The mode choice only means anything before a run begins.
        this.#actions.isRunInProgress?.()
          ? null
          : el(
              "div",
              { class: "setting" },
              el("span", { class: "setting__label" }, t("MODE_TITLE")),
              modeToggle,
              el(
                "p",
                { class: "setting__hint" },
                settings.mode === MODES.normal.id ? t("MODE_NORMAL_HINT") : t("MODE_HARDCORE_HINT"),
              ),
            ),

        el(
          "div",
          { class: "panel__actions" },
          el(
            "button",
            { class: "button button--compact", onclick: () => this.#goBack() },
            t("MENU_BACK"),
          ),
        ),
      ),
    );
  }

  #buildToggle({ label, value, onLabel, offLabel, onChange }) {
    const group = el("div", { class: "toggle", role: "group", "aria-label": label });

    const buttons = [
      { text: onLabel, matches: true },
      { text: offLabel, matches: false },
    ].map(({ text, matches }) =>
      el(
        "button",
        {
          class: "toggle__option",
          type: "button",
          "aria-pressed": String(value === matches),
          onclick: () => {
            onChange(matches);
            // Redraw so a dependent hint line updates with the choice.
            this.show(this.#currentScreen);
          },
        },
        text,
      ),
    );

    group.append(...buttons);
    return group;
  }

  /* ------------------------------------------------------------ language */

  #buildLanguage() {
    const t = this.t;
    const active = this.#localization.language;

    const options = this.#localization.availableLanguages.map((code) =>
      el(
        "button",
        {
          class: "button",
          "aria-current": String(code === active),
          onclick: () => {
            this.#settings.set("language", code);
            // The language-changed event redraws this screen for us.
          },
        },
        this.#localization.languageName(code),
      ),
    );

    return el(
      "section",
      { class: "screen screen--panel" },
      el(
        "div",
        { class: "panel" },
        el("h2", { class: "panel-title" }, t("LANGUAGE_TITLE")),
        el("div", { class: "menu-stack" }, ...options),
        el(
          "div",
          { class: "panel__actions" },
          el(
            "button",
            { class: "button button--compact", onclick: () => this.#goBack() },
            t("MENU_BACK"),
          ),
        ),
      ),
    );
  }
}
