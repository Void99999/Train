/**
 * LAST TRAIN - input.
 *
 * Systems ask for actions ("is `sprint` held?"), never for keys. That keeps
 * rebinding to a single map, and it means the tutorial prompt and the key that
 * actually works can never drift apart - the prompt asks this for its label.
 *
 * PC first: keyboard and mouse, conventional bindings, nothing that assumes a
 * controller is present.
 */

import { GAME_EVENT } from "./events.js";

export const ACTION = {
  moveForward: "move_forward",
  moveBackward: "move_backward",
  moveLeft: "move_left",
  moveRight: "move_right",
  sprint: "sprint",
  jump: "jump",
  crouch: "crouch",
  interact: "interact",
  fire: "fire",
  aim: "aim",
  reload: "reload",
  weaponWheel: "weapon_wheel",
  pause: "pause",
  useMedkit: "use_medkit",
  throttleUp: "throttle_up",
  throttleDown: "throttle_down",
};

/**
 * Default bindings. Values are KeyboardEvent.code, or "Mouse0"/"Mouse2" for
 * mouse buttons. `code` rather than `key` so WASD stays in the same physical
 * place on a QWERTZ keyboard - which matters, given the game ships in German.
 */
export const DEFAULT_BINDINGS = {
  [ACTION.moveForward]: ["KeyW"],
  [ACTION.moveBackward]: ["KeyS"],
  [ACTION.moveLeft]: ["KeyA"],
  [ACTION.moveRight]: ["KeyD"],
  [ACTION.sprint]: ["ShiftLeft", "ShiftRight"],
  [ACTION.jump]: ["Space"],
  [ACTION.crouch]: ["ControlLeft", "KeyC"],
  [ACTION.interact]: ["KeyE"],
  [ACTION.fire]: ["Mouse0"],
  [ACTION.aim]: ["Mouse2"],
  [ACTION.reload]: ["KeyR"],
  [ACTION.weaponWheel]: ["Tab"],
  [ACTION.pause]: ["Escape"],
  [ACTION.useMedkit]: ["KeyH"],
  [ACTION.throttleUp]: ["ArrowUp"],
  [ACTION.throttleDown]: ["ArrowDown"],
};

/** Human-readable label for a binding, for on-screen prompts. */
const KEY_LABELS = {
  Mouse0: "LMB",
  Mouse2: "RMB",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  Space: "Space",
  Escape: "Esc",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Tab: "Tab",
};

export function labelForBinding(binding) {
  if (KEY_LABELS[binding]) return KEY_LABELS[binding];
  if (binding.startsWith("Key")) return binding.slice(3);
  if (binding.startsWith("Digit")) return binding.slice(5);
  return binding;
}

export class InputManager {
  #bindings;
  #held = new Set();
  /** Actions that went down since the last frame was consumed. */
  #pressed = new Set();
  #released = new Set();
  #mouseDelta = { x: 0, y: 0 };
  #wheelDelta = 0;
  #events;
  #target = null;
  #enabled = true;
  #listeners = [];

  constructor({ events, bindings } = {}) {
    this.#events = events ?? null;
    this.#bindings = structuredClone(bindings ?? DEFAULT_BINDINGS);
  }

  /** Starts listening. Safe to call without a DOM - the tests drive it directly. */
  attach(target = globalThis) {
    if (!target?.addEventListener) return this;
    this.#target = target;

    const add = (type, handler, options) => {
      target.addEventListener(type, handler, options);
      this.#listeners.push([type, handler, options]);
    };

    add("keydown", (event) => {
      // Tab would move focus out of the canvas and Escape would drop pointer
      // lock behind our back; both are gameplay keys here.
      if (this.#isBound(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.#press(event.code);
    });
    add("keyup", (event) => this.#release(event.code));
    add("mousedown", (event) => this.#press(`Mouse${event.button}`));
    add("mouseup", (event) => this.#release(`Mouse${event.button}`));
    add("contextmenu", (event) => event.preventDefault());
    add("wheel", (event) => {
      this.#wheelDelta += Math.sign(event.deltaY);
    }, { passive: true });
    add("mousemove", (event) => {
      this.#mouseDelta.x += event.movementX ?? 0;
      this.#mouseDelta.y += event.movementY ?? 0;
    });
    // Losing focus mid-sprint must not leave the key stuck down forever.
    add("blur", () => this.releaseAll());

    return this;
  }

  detach() {
    if (!this.#target) return;
    for (const [type, handler, options] of this.#listeners) {
      this.#target.removeEventListener(type, handler, options);
    }
    this.#listeners = [];
    this.#target = null;
  }

  /** Turns input off without unbinding - used while a menu owns the keyboard. */
  setEnabled(enabled) {
    this.#enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  #isBound(binding) {
    return Object.values(this.#bindings).some((list) => list.includes(binding));
  }

  #actionsFor(binding) {
    return Object.entries(this.#bindings)
      .filter(([, list]) => list.includes(binding))
      .map(([action]) => action);
  }

  #press(binding) {
    if (!this.#enabled) return;
    for (const action of this.#actionsFor(binding)) {
      if (!this.#held.has(action)) this.#pressed.add(action);
      this.#held.add(action);
    }
  }

  #release(binding) {
    for (const action of this.#actionsFor(binding)) {
      if (this.#held.delete(action)) this.#released.add(action);
    }
  }

  releaseAll() {
    for (const action of this.#held) this.#released.add(action);
    this.#held.clear();
  }

  isHeld(action) {
    return this.#held.has(action);
  }

  /** True on the frame the action went down. */
  wasPressed(action) {
    return this.#pressed.has(action);
  }

  /** True on the frame the action came back up. */
  wasReleased(action) {
    return this.#released.has(action);
  }

  /** Accumulated mouse movement since the last frame, then reset. */
  consumeMouseDelta() {
    const delta = { ...this.#mouseDelta };
    this.#mouseDelta.x = 0;
    this.#mouseDelta.y = 0;
    return delta;
  }

  consumeWheelDelta() {
    const delta = this.#wheelDelta;
    this.#wheelDelta = 0;
    return delta;
  }

  /** Called once at the end of every frame, after systems have read the state. */
  endFrame() {
    this.#pressed.clear();
    this.#released.clear();
  }

  /** First binding for an action, for "Press E" style prompts. */
  primaryLabel(action) {
    const binding = this.#bindings[action]?.[0];
    return binding ? labelForBinding(binding) : "?";
  }

  bindingsFor(action) {
    return [...(this.#bindings[action] ?? [])];
  }

  /** Replaces an action's bindings. Rebinding is a settings-screen concern. */
  rebind(action, bindings) {
    if (!(action in this.#bindings)) throw new Error(`Unknown action: ${action}`);
    this.#bindings[action] = [...bindings];
    this.#events?.emit(GAME_EVENT.settingsChanged, { key: "bindings", value: action });
  }

  snapshotBindings() {
    return structuredClone(this.#bindings);
  }
}
