/**
 * LAST TRAIN - cutscene director.
 *
 * A cutscene is a list of shots. Each shot has a duration and up to three
 * callbacks: `onEnter` when it starts, `onUpdate` every frame with its
 * progress, and `onExit` when it ends. The director advances through them and
 * guarantees two things that are easy to get wrong by hand:
 *
 *  - Every shot's `onEnter` and `onExit` runs exactly once, in order, even if
 *    a single long frame skips clean over a short shot.
 *  - Skipping runs the remaining `onExit` callbacks rather than abandoning
 *    them. That is what stops a skipped intro from leaving the letterbox on
 *    screen, the player frozen, or a prop still parked in the world.
 *
 * There is no rendering in this file. The shots receive a context object and
 * do whatever they need with it, which keeps the timing logic testable.
 */

export class Cutscene {
  #shots;
  #index = -1;
  #elapsedInShot = 0;
  #finished = false;
  #onFinished;

  /**
   * @param {Array<{ name?: string, duration: number, onEnter?: Function,
   *                 onUpdate?: Function, onExit?: Function }>} shots
   * @param {object} [options]
   * @param {Function} [options.onFinished] called once, after the last shot
   */
  constructor(shots, { onFinished = null } = {}) {
    if (!Array.isArray(shots) || shots.length === 0) {
      throw new Error("A cutscene needs at least one shot");
    }
    this.#shots = shots;
    this.#onFinished = onFinished;
  }

  get shots() {
    return this.#shots;
  }

  get shotIndex() {
    return this.#index;
  }

  get currentShot() {
    return this.#shots[this.#index] ?? null;
  }

  get isFinished() {
    return this.#finished;
  }

  get hasStarted() {
    return this.#index >= 0;
  }

  get totalDuration() {
    return this.#shots.reduce((sum, shot) => sum + shot.duration, 0);
  }

  /** How far through the whole cutscene, 0-1. For a progress indicator. */
  get progress() {
    if (this.#finished) return 1;
    if (this.#index < 0) return 0;
    const before = this.#shots.slice(0, this.#index).reduce((sum, shot) => sum + shot.duration, 0);
    return Math.min(1, (before + this.#elapsedInShot) / this.totalDuration);
  }

  /**
   * Advances the cutscene.
   *
   * A frame longer than a shot is handled by looping: the shot is completed
   * and the leftover time is carried into the next one. Without that, a hitch
   * during loading could silently swallow a beat of the story.
   */
  update(deltaSeconds, context = {}) {
    if (this.#finished) return;

    if (this.#index < 0) {
      this.#index = 0;
      this.#elapsedInShot = 0;
      this.currentShot.onEnter?.(context);
    }

    let remaining = deltaSeconds;

    while (remaining > 0 && !this.#finished) {
      const shot = this.currentShot;
      const left = shot.duration - this.#elapsedInShot;

      if (remaining < left) {
        const step = remaining;
        this.#elapsedInShot += step;
        remaining = 0;
        // The fourth argument is how much time this call covers. A shot that
        // moves something by a fixed amount per call rather than per second
        // travels a different distance on a fast machine than on a slow one.
        shot.onUpdate?.(this.#elapsedInShot / shot.duration, this.#elapsedInShot, context, step);
        continue;
      }

      // Finish this shot exactly at its end, then carry the rest forward.
      this.#elapsedInShot = shot.duration;
      remaining -= left;
      shot.onUpdate?.(1, this.#elapsedInShot, context, left);
      shot.onExit?.(context);
      this.#advance(context);
    }
  }

  #advance(context) {
    if (this.#index >= this.#shots.length - 1) {
      this.#finish(context);
      return;
    }
    this.#index += 1;
    this.#elapsedInShot = 0;
    this.currentShot.onEnter?.(context);
  }

  #finish(context) {
    this.#finished = true;
    this.#onFinished?.(context);
  }

  /**
   * Ends the cutscene now.
   *
   * Every shot that has not run yet still gets its `onEnter` and `onExit`, in
   * order, so anything a later shot was going to clean up is still cleaned up.
   * Skipping must leave the world in the same state as watching it through.
   */
  skip(context = {}) {
    if (this.#finished) return;

    if (this.#index < 0) {
      // Skipped before the first shot ever ran. It still needs its callbacks,
      // or whatever it was going to set up is never torn down.
      this.#index = 0;
      this.currentShot.onEnter?.(context);
    }
    this.currentShot.onExit?.(context);

    for (let i = this.#index + 1; i < this.#shots.length; i += 1) {
      const shot = this.#shots[i];
      shot.onEnter?.(context);
      shot.onExit?.(context);
    }

    this.#index = this.#shots.length - 1;
    this.#elapsedInShot = this.currentShot.duration;
    this.#finish(context);
  }
}

/** Smoothstep, for camera moves that do not start and stop abruptly. */
export function ease(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Linear interpolation between two `{x,y,z}` points. */
export function lerpPoint(from, to, t) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}
