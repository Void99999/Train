/**
 * LAST TRAIN - deterministic random numbers.
 *
 * Encounters, outpost layout and scenery all draw from a seeded generator
 * instead of Math.random. That buys three things: a run can be reproduced from
 * its seed when a bug report arrives, a reloaded checkpoint behaves the same
 * way it did before, and the tests can assert on spawn behaviour.
 *
 * Algorithm is mulberry32 - small, fast, and good enough for gameplay. It is
 * not cryptographic and must never be used for anything that needs to be.
 */

export class Rng {
  #state;

  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.#state = this.seed;
  }

  /** Float in [0, 1). */
  next() {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max], both inclusive. */
  integer(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with the given probability. */
  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    if (items.length === 0) throw new Error("Cannot pick from an empty list");
    return items[this.integer(0, items.length - 1)];
  }

  /**
   * Picks a key from a `{ key: weight }` map, proportional to the weights.
   * Used for enemy composition, where a difficulty band says "mostly riflemen,
   * occasionally a tank" rather than listing every possible group.
   */
  weighted(weights) {
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
    if (entries.length === 0) throw new Error("Cannot pick from empty weights");
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  /** Fisher-Yates, in place. */
  shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = this.integer(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /** Snapshot for the save file, so a reload resumes the same sequence. */
  serialize() {
    return { seed: this.seed, state: this.#state };
  }

  static deserialize(data) {
    const rng = new Rng(data.seed);
    rng.#state = data.state >>> 0;
    return rng;
  }
}
