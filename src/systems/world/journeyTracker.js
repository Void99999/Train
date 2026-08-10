/**
 * LAST TRAIN - where the train is on the line, and what that means.
 *
 * This system knows the whole shape of the journey, including where it ends.
 * The interface must never learn that. Everything exposed for display is
 * phrased in terms of what has already happened - distance travelled, last
 * outpost reached - and there is deliberately no method here that returns
 * distance remaining, outposts remaining, or "is this the last one".
 *
 * The one number that does escape is `isFinalSequenceDue`, and only the ending
 * system is allowed to read it.
 */

import {
  FINAL_SEQUENCE_DISTANCE_KM,
  OUTPOSTS,
  difficultyBandAt,
  nextOutpostAfter,
} from "../../data/journey.js";
import { JOURNEY } from "../../data/balance.js";
import { GAME_EVENT } from "../../core/events.js";

export const JOURNEY_PHASE = {
  /** Running the line. Enemies may attack. */
  travelling: "travelling",
  /** Docked at an outpost. Nothing attacks here, for as long as the player likes. */
  docked: "docked",
  /** Just left an outpost. Still safe, briefly. */
  grace: "grace",
};

export class JourneyTracker {
  #train;
  #unlocks;
  #events;

  #phase = JOURNEY_PHASE.travelling;
  #currentOutpost = null;
  #highestOutpostReached = 0;
  #graceRemaining = 0;
  #finalSequenceFired = false;
  #elapsedSeconds = 0;

  constructor({ train, unlocks, events } = {}) {
    this.#train = train;
    this.#unlocks = unlocks;
    this.#events = events ?? null;
  }

  get phase() {
    return this.#phase;
  }

  get distanceKm() {
    return this.#train.distanceKm;
  }

  /** The outpost the train is standing at, or null while running. */
  get currentOutpost() {
    return this.#currentOutpost;
  }

  /** Highest outpost number reached this run. 0 before the first one. */
  get highestOutpostReached() {
    return this.#highestOutpostReached;
  }

  get elapsedSeconds() {
    return this.#elapsedSeconds;
  }

  /**
   * True while enemies are allowed to attack: running the line, and past the
   * quiet period that follows leaving an outpost.
   */
  get isHostile() {
    return this.#phase === JOURNEY_PHASE.travelling;
  }

  get graceRemainingSeconds() {
    return this.#graceRemaining;
  }

  get difficultyBand() {
    return difficultyBandAt(this.distanceKm);
  }

  /**
   * Only the ending sequence may read this. Nothing may render it, and nothing
   * may derive a progress bar from it.
   */
  get isFinalSequenceDue() {
    return !this.#finalSequenceFired && this.distanceKm >= FINAL_SEQUENCE_DISTANCE_KM;
  }

  markFinalSequenceFired() {
    this.#finalSequenceFired = true;
    this.#events?.emit(GAME_EVENT.finalSequenceTriggered, { distanceKm: this.distanceKm });
  }

  /**
   * Everything the HUD is allowed to know. Note what is absent: no total, no
   * remaining, no count of outposts left.
   */
  hudSnapshot() {
    return {
      distanceKm: this.distanceKm,
      lastOutpostNumber: this.#highestOutpostReached,
      lastOutpostNameKey:
        this.#highestOutpostReached > 0
          ? OUTPOSTS[this.#highestOutpostReached - 1].nameKey
          : null,
      docked: this.#phase === JOURNEY_PHASE.docked,
    };
  }

  update(deltaSeconds) {
    this.#elapsedSeconds += deltaSeconds;

    if (this.#phase === JOURNEY_PHASE.grace) {
      this.#graceRemaining -= deltaSeconds;
      if (this.#graceRemaining <= 0) {
        this.#graceRemaining = 0;
        this.#phase = JOURNEY_PHASE.travelling;
      }
    }

    if (this.#phase === JOURNEY_PHASE.travelling) this.#checkForArrival();
  }

  /**
   * An outpost is reached by rolling into it slowly enough to stop there.
   * Running past at 80 km/h does not count - the player has to choose to pull
   * in, which is what makes the throttle a real decision on approach.
   */
  #checkForArrival() {
    const candidate = this.#nextUnreachedOutpost();
    if (!candidate) return;

    const distanceToOutpost = Math.abs(candidate.distanceKm - this.distanceKm) * 1000;
    if (distanceToOutpost > JOURNEY.outpostDockRadiusMetres) return;
    if (this.#train.speedMetresPerSecond > 0.5) return;

    this.#dockAt(candidate);
  }

  /**
   * The next outpost the train could still pull into.
   *
   * An outpost the train has already run past is skipped for good. That is a
   * real consequence of thundering through at full throttle - the supplies
   * were there, and now they are behind you - and it also stops a missed
   * outpost from blocking every outpost after it.
   */
  #nextUnreachedOutpost() {
    const behindLimit = this.#train.distanceMetres - JOURNEY.outpostDockRadiusMetres;
    return (
      OUTPOSTS.find(
        (outpost) =>
          outpost.number > this.#highestOutpostReached &&
          outpost.distanceKm * 1000 >= behindLimit,
      ) ?? null
    );
  }

  /** True when the train is close enough to an outpost to be able to stop there. */
  get isWithinDockingRange() {
    const candidate = this.#nextUnreachedOutpost();
    if (!candidate) return false;
    return Math.abs(candidate.distanceKm - this.distanceKm) * 1000 <= JOURNEY.outpostDockRadiusMetres;
  }

  #dockAt(outpost) {
    this.#phase = JOURNEY_PHASE.docked;
    this.#currentOutpost = outpost;
    this.#highestOutpostReached = Math.max(this.#highestOutpostReached, outpost.number);
    this.#train.halt();

    const granted = this.#unlocks?.grantForOutpost(outpost.number) ?? [];
    this.#events?.emit(GAME_EVENT.outpostReached, { outpost, granted });
  }

  /**
   * Leaves the outpost. The player gets a quiet stretch before anything comes
   * for them - long enough to get the train moving and be somewhere else
   * before the first shot, rather than being ambushed on the platform.
   */
  depart() {
    if (this.#phase !== JOURNEY_PHASE.docked) return false;
    const outpost = this.#currentOutpost;
    this.#phase = JOURNEY_PHASE.grace;
    this.#graceRemaining = JOURNEY.postOutpostPeaceSeconds;
    this.#currentOutpost = null;
    this.#events?.emit(GAME_EVENT.outpostDeparted, { outpost });
    return true;
  }

  /** Used by the checkpoint system when a run resumes at an outpost. */
  restoreToOutpost(outpostNumber) {
    const outpost = OUTPOSTS[outpostNumber - 1] ?? null;
    this.#highestOutpostReached = outpostNumber;
    this.#currentOutpost = outpost;
    this.#phase = outpost ? JOURNEY_PHASE.docked : JOURNEY_PHASE.travelling;
    this.#graceRemaining = 0;
    if (outpost) this.#train.setDistanceMetres(outpost.distanceKm * 1000);
  }

  serialize() {
    return {
      phase: this.#phase,
      currentOutpostNumber: this.#currentOutpost?.number ?? null,
      highestOutpostReached: this.#highestOutpostReached,
      graceRemaining: this.#graceRemaining,
      finalSequenceFired: this.#finalSequenceFired,
      elapsedSeconds: this.#elapsedSeconds,
    };
  }

  restore(data) {
    this.#phase = data?.phase ?? JOURNEY_PHASE.travelling;
    this.#currentOutpost = data?.currentOutpostNumber
      ? OUTPOSTS[data.currentOutpostNumber - 1] ?? null
      : null;
    this.#highestOutpostReached = data?.highestOutpostReached ?? 0;
    this.#graceRemaining = data?.graceRemaining ?? 0;
    this.#finalSequenceFired = Boolean(data?.finalSequenceFired);
    this.#elapsedSeconds = data?.elapsedSeconds ?? 0;
  }

  /** Diagnostic only - never rendered. Used by tools and tests. */
  static get lineLengthKm() {
    return FINAL_SEQUENCE_DISTANCE_KM;
  }

  static nextOutpostAfter(distanceKm) {
    return nextOutpostAfter(distanceKm);
  }
}
