/**
 * LAST TRAIN - top-level state machine.
 *
 * One place decides what the game currently is: a menu, a cutscene, a running
 * simulation, a paused simulation, an interface the player is standing in
 * front of. Systems ask this instead of keeping their own "am I active" flags,
 * which is what stops the train from creeping forward while the workshop is
 * open, or enemies from spawning during a cinematic.
 *
 * Transitions are declared, not implied. An illegal transition throws in
 * development instead of leaving the game in a state nothing tests.
 */

import { GAME_EVENT } from "./events.js";

export const STATE = {
  boot: "boot",
  mainMenu: "main_menu",
  options: "options",
  languageMenu: "language_menu",
  /** Opening cinematic: train, helicopter, crash, crawl, cab. */
  intro: "intro",
  /** Simulation running, player in control. */
  playing: "playing",
  paused: "paused",
  /** Docked at a supply outpost. Safe; the encounter director is idle. */
  outpost: "outpost",
  /** A shop or workshop interface is open on top of the world. */
  interface: "interface",
  /** Final derailment and the escape from the wreck. */
  ending: "ending",
  runFailed: "run_failed",
  victory: "victory",
};

/** state -> states it may move to. */
const TRANSITIONS = {
  [STATE.boot]: [STATE.mainMenu],
  [STATE.mainMenu]: [STATE.options, STATE.languageMenu, STATE.intro, STATE.playing],
  [STATE.options]: [STATE.mainMenu, STATE.paused],
  [STATE.languageMenu]: [STATE.mainMenu, STATE.paused],
  [STATE.intro]: [STATE.playing, STATE.mainMenu],
  [STATE.playing]: [STATE.paused, STATE.outpost, STATE.interface, STATE.ending, STATE.runFailed],
  [STATE.paused]: [STATE.playing, STATE.outpost, STATE.options, STATE.languageMenu, STATE.mainMenu],
  [STATE.outpost]: [STATE.playing, STATE.paused, STATE.interface, STATE.runFailed],
  [STATE.interface]: [STATE.playing, STATE.outpost, STATE.paused],
  [STATE.ending]: [STATE.victory, STATE.runFailed, STATE.mainMenu],
  [STATE.runFailed]: [STATE.playing, STATE.outpost, STATE.mainMenu],
  [STATE.victory]: [STATE.mainMenu],
};

/** States in which the world simulation advances. */
const SIMULATING = new Set([STATE.playing, STATE.outpost, STATE.ending]);

/** States in which enemies may be spawned and may shoot. */
const HOSTILE = new Set([STATE.playing]);

/** States in which the mouse is captured for looking around. */
const POINTER_LOCKED = new Set([STATE.playing, STATE.outpost, STATE.intro, STATE.ending]);

export class GameStateManager {
  #state = STATE.boot;
  #previous = null;
  #events;

  constructor({ events } = {}) {
    this.#events = events ?? null;
  }

  get current() {
    return this.#state;
  }

  get previous() {
    return this.#previous;
  }

  /** True while the world clock, train and AI should be advanced. */
  get isSimulating() {
    return SIMULATING.has(this.#state);
  }

  /** True while the encounter director may act. */
  get allowsCombat() {
    return HOSTILE.has(this.#state);
  }

  get wantsPointerLock() {
    return POINTER_LOCKED.has(this.#state);
  }

  canTransitionTo(next) {
    return (TRANSITIONS[this.#state] ?? []).includes(next);
  }

  /**
   * Moves to a new state. Returns false for a transition that is not allowed,
   * after complaining loudly - a refused transition is a bug in the caller,
   * but crashing out of a menu click is worse than logging it.
   */
  transitionTo(next) {
    if (next === this.#state) return true;
    if (!this.canTransitionTo(next)) {
      console.error(`Illegal state transition: ${this.#state} -> ${next}`);
      return false;
    }
    this.#previous = this.#state;
    this.#state = next;
    this.#events?.emit(GAME_EVENT.stateChanged, { from: this.#previous, to: next });
    return true;
  }

  /**
   * Returns to whatever was on screen before. Used by "Back" in the options
   * and language menus, which can be reached from the main menu and from the
   * pause menu and must return to the right one.
   */
  returnToPrevious() {
    if (this.#previous === null) return false;
    return this.transitionTo(this.#previous);
  }
}
