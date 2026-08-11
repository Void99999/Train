/**
 * LAST TRAIN - run statistics and personal bests.
 *
 * Shown after a Hardcore failure, and after the ending. The numbers are chosen
 * to tell the story of the run back to the player: how far they got, what they
 * built, what they killed, how long it took.
 *
 * Records persist across runs. Losing badly must never cost the player a
 * personal best they already earned.
 */

import { GAME_EVENT } from "../../core/events.js";
import { SAVE_SLOT } from "../../core/saveSystem.js";

const EMPTY = {
  distanceKm: 0,
  outpostsReached: 0,
  enemiesKilled: 0,
  vehiclesDestroyed: 0,
  moneyEarned: 0,
  largestTrainWagons: 0,
  runTimeSeconds: 0,
};

/** Higher is better for every tracked record, which keeps comparison trivial. */
const RECORD_KEYS = Object.keys(EMPTY);

export class Statistics {
  #current = { ...EMPTY };
  #save;
  #records;

  constructor({ events, saveSystem } = {}) {
    this.#save = saveSystem ?? null;
    this.#records = this.#loadRecords();
    if (events) this.#subscribe(events);
  }

  get current() {
    return { ...this.#current };
  }

  get records() {
    return { ...this.#records };
  }

  #loadRecords() {
    const stored = this.#save?.load(SAVE_SLOT.records, null);
    return { ...EMPTY, ...(stored ?? {}) };
  }

  #subscribe(events) {
    events.on(GAME_EVENT.enemyKilled, ({ isVehicle = false } = {}) => {
      this.#current.enemiesKilled += 1;
      if (isVehicle) this.#current.vehiclesDestroyed += 1;
    });
    events.on(GAME_EVENT.outpostReached, ({ outpost }) => {
      this.#current.outpostsReached = Math.max(this.#current.outpostsReached, outpost.number);
    });
    events.on(GAME_EVENT.vehicleAttached, ({ index }) => {
      this.#current.largestTrainWagons = Math.max(this.#current.largestTrainWagons, index);
    });
  }

  /** Called every frame with the live values that are not event-driven. */
  sample({ distanceKm, moneyEarned, runTimeSeconds }) {
    this.#current.distanceKm = Math.max(this.#current.distanceKm, distanceKm);
    this.#current.moneyEarned = Math.max(this.#current.moneyEarned, moneyEarned);
    this.#current.runTimeSeconds = runTimeSeconds;
  }

  reset() {
    this.#current = { ...EMPTY };
  }

  /**
   * Folds the finished run into the stored records.
   * @returns {string[]} the keys that are new personal bests
   */
  commitRecords() {
    const beaten = RECORD_KEYS.filter((key) => this.#current[key] > this.#records[key]);
    for (const key of beaten) this.#records[key] = this.#current[key];
    if (beaten.length > 0) this.#save?.save(SAVE_SLOT.records, this.#records);
    return beaten;
  }

  /** Rows for the summary screen, paired with their localization keys. */
  summaryRows() {
    return [
      { labelKey: "STATS_DISTANCE", value: this.#current.distanceKm, format: "distance" },
      { labelKey: "STATS_OUTPOSTS", value: this.#current.outpostsReached, format: "number" },
      { labelKey: "STATS_ENEMIES_KILLED", value: this.#current.enemiesKilled, format: "number" },
      {
        labelKey: "STATS_VEHICLES_DESTROYED",
        value: this.#current.vehiclesDestroyed,
        format: "number",
      },
      { labelKey: "STATS_MONEY_EARNED", value: this.#current.moneyEarned, format: "money" },
      {
        labelKey: "STATS_LARGEST_TRAIN",
        value: this.#current.largestTrainWagons,
        format: "wagons",
      },
      { labelKey: "STATS_RUN_TIME", value: this.#current.runTimeSeconds, format: "duration" },
    ];
  }

  serialize() {
    return { ...this.#current };
  }

  restore(data) {
    this.#current = { ...EMPTY, ...(data ?? {}) };
  }
}
