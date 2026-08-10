/**
 * LAST TRAIN - persistence.
 *
 * Three separate records, because they have different lifetimes and different
 * failure consequences:
 *
 *   settings  language, volume, blood - survives everything
 *   records   personal bests, mostly for Hardcore - never reset by a failed run
 *   run       the current checkpoint - replaced constantly, wiped on run end
 *
 * Every record carries a schema version. Loading runs the record forward
 * through the migration chain, so a save written by an older build keeps
 * working after an update instead of being silently discarded.
 *
 * A save is only ever replaced once the new payload has been fully serialised.
 * If serialisation throws halfway through, the previous save is still there.
 */

const STORAGE_PREFIX = "lasttrain";

export const SAVE_SLOT = {
  settings: "settings",
  records: "records",
  run: "run",
};

/** Bump when a slot's shape changes, and add the matching migration below. */
export const SCHEMA_VERSIONS = {
  [SAVE_SLOT.settings]: 1,
  [SAVE_SLOT.records]: 1,
  [SAVE_SLOT.run]: 1,
};

/**
 * Migrations are keyed by the version they upgrade *from*.
 * A migration takes the old payload and returns the next version's payload.
 *
 *   [SAVE_SLOT.run]: { 1: (data) => ({ ...data, newField: 0 }) }
 */
export const MIGRATIONS = {
  [SAVE_SLOT.settings]: {},
  [SAVE_SLOT.records]: {},
  [SAVE_SLOT.run]: {},
};

/**
 * In-memory stand-in for localStorage. Used by the tests, and as the fallback
 * when a browser blocks storage - the game must stay playable, it just will
 * not remember anything.
 */
export class MemoryStorage {
  #map = new Map();

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }

  get length() {
    return this.#map.size;
  }
}

/** localStorage if it is usable, otherwise an in-memory replacement. */
export function detectStorage() {
  try {
    const probe = `${STORAGE_PREFIX}.probe`;
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return new MemoryStorage();
  }
}

export class SaveSystem {
  #storage;
  #lastError = null;

  constructor(storage = detectStorage()) {
    this.#storage = storage;
  }

  /** The error from the most recent failed save, or null. */
  get lastError() {
    return this.#lastError;
  }

  #keyFor(slot) {
    return `${STORAGE_PREFIX}.${slot}`;
  }

  /**
   * Writes a slot. Returns true on success; a false return is worth surfacing
   * to the player once, but must never stop the game.
   */
  save(slot, data) {
    const version = SCHEMA_VERSIONS[slot];
    if (version === undefined) throw new Error(`Unknown save slot: ${slot}`);
    try {
      // Serialise before touching storage: a payload containing something
      // unserialisable must not be able to destroy the previous save.
      const payload = JSON.stringify({ version, savedAt: Date.now(), data });
      this.#storage.setItem(this.#keyFor(slot), payload);
      this.#lastError = null;
      return true;
    } catch (error) {
      this.#lastError = error;
      console.warn(`Could not save "${slot}":`, error);
      return false;
    }
  }

  /**
   * Reads a slot, migrating it forward if it was written by an older build.
   * Returns `fallback` when the slot is empty, unreadable or beyond repair -
   * a corrupt save should drop the player back to a clean state, not crash.
   */
  load(slot, fallback = null) {
    const raw = this.#storage.getItem(this.#keyFor(slot));
    if (raw === null) return fallback;

    let record;
    try {
      record = JSON.parse(raw);
    } catch (error) {
      console.warn(`Save slot "${slot}" is corrupt and was ignored:`, error);
      return fallback;
    }

    if (!record || typeof record !== "object" || !("data" in record)) {
      console.warn(`Save slot "${slot}" has an unexpected shape and was ignored.`);
      return fallback;
    }

    try {
      return this.#migrate(slot, record.version ?? 0, record.data);
    } catch (error) {
      console.warn(`Save slot "${slot}" could not be migrated:`, error);
      return fallback;
    }
  }

  #migrate(slot, fromVersion, data) {
    const target = SCHEMA_VERSIONS[slot];
    const chain = MIGRATIONS[slot] ?? {};
    let version = fromVersion;
    let current = data;

    if (version > target) {
      // Written by a newer build than this one. Refusing is safer than
      // guessing at fields we do not understand.
      throw new Error(`save version ${version} is newer than supported ${target}`);
    }

    while (version < target) {
      const step = chain[version];
      if (!step) throw new Error(`no migration from version ${version}`);
      current = step(current);
      version += 1;
    }
    return current;
  }

  clear(slot) {
    this.#storage.removeItem(this.#keyFor(slot));
  }

  has(slot) {
    return this.#storage.getItem(this.#keyFor(slot)) !== null;
  }
}
