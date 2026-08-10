/**
 * LAST TRAIN - event bus.
 *
 * Systems talk to each other through named events rather than by holding
 * references, so the encounter director can announce a kill without knowing
 * that the statistics screen, the audio mixer and the HUD all care.
 *
 * A listener that throws is reported and skipped. One broken HUD widget must
 * never be able to stop the train from being updated.
 */

export class EventBus {
  #listeners = new Map();

  /**
   * Subscribes to an event. Returns a function that removes the subscription -
   * keeping teardown next to setup, so no listener outlives its owner.
   */
  on(eventName, listener) {
    if (typeof listener !== "function") {
      throw new TypeError(`Listener for "${eventName}" must be a function`);
    }
    if (!this.#listeners.has(eventName)) this.#listeners.set(eventName, new Set());
    this.#listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }

  /** Subscribes for exactly one delivery. */
  once(eventName, listener) {
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off(eventName, listener) {
    const set = this.#listeners.get(eventName);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.#listeners.delete(eventName);
  }

  emit(eventName, payload) {
    const set = this.#listeners.get(eventName);
    if (!set) return;
    // Copy first: a listener is allowed to unsubscribe itself while running.
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Listener for "${eventName}" failed:`, error);
      }
    }
  }

  listenerCount(eventName) {
    return this.#listeners.get(eventName)?.size ?? 0;
  }

  /** Drops every subscription. Used when a run ends and systems are rebuilt. */
  clear() {
    this.#listeners.clear();
  }
}

/**
 * Every event name in the game. Using constants instead of loose strings means
 * a typo is a crash at startup rather than a listener that silently never runs.
 */
export const GAME_EVENT = {
  stateChanged: "game:state-changed",
  languageChanged: "settings:language-changed",
  settingsChanged: "settings:changed",

  throttleChanged: "train:throttle-changed",
  trainSpeedChanged: "train:speed-changed",
  vehicleAttached: "train:vehicle-attached",
  vehicleDamaged: "train:vehicle-damaged",
  vehicleRepaired: "train:vehicle-repaired",
  vehicleDestroyed: "train:vehicle-destroyed",
  vehicleDetached: "train:vehicle-detached",
  vehicleUpgraded: "train:vehicle-upgraded",
  vehicleArmoured: "train:vehicle-armoured",
  damageStateChanged: "train:damage-state-changed",

  cargoChanged: "cargo:changed",
  moneyChanged: "economy:money-changed",
  purchaseFailed: "economy:purchase-failed",

  playerDamaged: "player:damaged",
  playerHealed: "player:healed",
  playerDied: "player:died",
  staminaChanged: "player:stamina-changed",
  weaponEquipped: "player:weapon-equipped",
  weaponFired: "weapon:fired",
  weaponReloaded: "weapon:reloaded",
  ammunitionEmpty: "weapon:ammunition-empty",

  enemySpawned: "combat:enemy-spawned",
  enemyKilled: "combat:enemy-killed",
  encounterStarted: "combat:encounter-started",
  encounterCleared: "combat:encounter-cleared",

  outpostReached: "journey:outpost-reached",
  outpostDeparted: "journey:outpost-departed",
  distanceMilestone: "journey:distance-milestone",
  unlockGranted: "journey:unlock-granted",
  finalSequenceTriggered: "journey:final-sequence",

  runStarted: "run:started",
  runFailed: "run:failed",
  runCompleted: "run:completed",
  checkpointSaved: "run:checkpoint-saved",
};
