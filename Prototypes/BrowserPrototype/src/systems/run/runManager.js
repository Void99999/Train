/**
 * LAST TRAIN - starting, checkpointing and ending a run.
 *
 * Checkpoints are taken at outposts, because an outpost is the only place in
 * the game where the world is guaranteed to be safe and the train is
 * guaranteed to be stopped. Restoring one always produces a state the player
 * can actually continue from.
 *
 * Normal mode sends a failed run back to the last outpost the player genuinely
 * reached - never the next one, which would turn dying into a way of skipping
 * a difficult leg. Hardcore mode has one life and no checkpoint at all.
 *
 * Design note on the death penalty: the checkpoint is restored whole, and the
 * money and cargo penalties are then applied on top of the restored state. So
 * a death costs everything earned since the last outpost, plus a fifth of what
 * was banked before it. Harsh enough to matter, never unrecoverable.
 */

import { Train } from "../train/train.js";
import { Inventory } from "../player/inventory.js";
import { MODES } from "../../data/balance.js";
import { TRADE_GOOD_IDS } from "../../data/cargo.js";
import { OUTPOSTS } from "../../data/journey.js";
import { GAME_EVENT } from "../../core/events.js";
import { SAVE_SLOT } from "../../core/saveSystem.js";

export const RUN_FAILURE = {
  playerDied: "player_died",
  locomotiveDestroyed: "locomotive_destroyed",
};

export class RunManager {
  #context;
  #events;
  #save;
  #mode;
  #checkpoint = null;
  #failed = false;

  /**
   * @param {object} deps
   * @param {object} deps.context  the live run: train, wallet, inventory, health,
   *                               stamina, unlocks, journey, statistics
   */
  constructor({ context, events, saveSystem, mode = MODES.normal.id }) {
    this.#context = context;
    this.#events = events ?? null;
    this.#save = saveSystem ?? null;
    this.#mode = mode;

    this.#events?.on(GAME_EVENT.outpostReached, () => this.saveCheckpoint());
    this.#events?.on(GAME_EVENT.outpostDeparted, () => this.saveCheckpoint());
  }

  get mode() {
    return this.#mode;
  }

  get modeConfig() {
    return MODES[this.#mode] ?? MODES.normal;
  }

  get isHardcore() {
    return this.#mode === MODES.hardcore.id;
  }

  get hasCheckpoint() {
    return this.#checkpoint !== null;
  }

  get hasFailed() {
    return this.#failed;
  }

  /* ----------------------------------------------------------- checkpoint */

  /** Captures the whole run. Hardcore keeps no checkpoint by design. */
  saveCheckpoint() {
    if (this.isHardcore) return null;
    const { train, wallet, inventory, unlocks, journey, statistics } = this.#context;

    this.#checkpoint = {
      mode: this.#mode,
      train: train.serialize(),
      wallet: wallet.serialize(),
      inventory: inventory.serialize(),
      unlocks: unlocks.serialize(),
      journey: journey.serialize(),
      statistics: statistics.serialize(),
      outpostNumber: journey.highestOutpostReached,
    };

    this.#save?.save(SAVE_SLOT.run, this.#checkpoint);
    this.#events?.emit(GAME_EVENT.checkpointSaved, { outpostNumber: this.#checkpoint.outpostNumber });
    return this.#checkpoint;
  }

  /** Reads a checkpoint written by a previous session. */
  loadCheckpoint() {
    const stored = this.#save?.load(SAVE_SLOT.run, null);
    if (!stored) return null;
    this.#checkpoint = stored;
    this.#mode = stored.mode ?? this.#mode;
    return stored;
  }

  clearCheckpoint() {
    this.#checkpoint = null;
    this.#save?.clear(SAVE_SLOT.run);
  }

  /* --------------------------------------------------------------- events */

  /**
   * Ends the run.
   *
   * @param {string} reason one of RUN_FAILURE
   * @returns {{ recoverable: boolean, outpostNumber: number|null }}
   */
  fail(reason) {
    if (this.#failed) return { recoverable: false, outpostNumber: null };
    this.#failed = true;

    const recoverable = !this.isHardcore && this.#checkpoint !== null;
    this.#events?.emit(GAME_EVENT.runFailed, {
      reason,
      recoverable,
      mode: this.#mode,
      statistics: this.#context.statistics.current,
    });

    if (!recoverable) {
      this.#context.statistics.commitRecords();
      this.clearCheckpoint();
    }

    return {
      recoverable,
      outpostNumber: recoverable ? this.#checkpoint.outpostNumber : null,
    };
  }

  /**
   * Puts the player back at the last outpost they reached, applies the death
   * penalty, and returns the rebuilt run context.
   *
   * The caller swaps the returned objects into the world, because the train
   * and inventory are rebuilt rather than mutated - a half-restored train that
   * still holds references to destroyed wagons is a whole class of bug that
   * this avoids entirely.
   */
  respawn() {
    if (this.isHardcore || !this.#checkpoint) return null;

    const config = this.modeConfig;
    const { events } = this.#context;

    const train = Train.deserialize(this.#checkpoint.train, { events });
    const inventory = Inventory.deserialize(this.#checkpoint.inventory, { events });

    this.#context.wallet.restore(this.#checkpoint.wallet);
    this.#context.unlocks.restore(this.#checkpoint.unlocks);
    this.#context.statistics.restore(this.#checkpoint.statistics);

    // The penalty lands on the restored state, not on the state at death.
    this.#context.wallet.loseFraction(config.moneyLossOnDeath);
    for (const cargoId of TRADE_GOOD_IDS) {
      const held = train.quantityOf(cargoId);
      train.removeCargo(cargoId, Math.floor(held * config.cargoLossOnDeath));
    }

    // Bring the train back to something worth driving.
    for (const vehicle of train.vehicles) {
      const floor = vehicle.maxHealth * config.respawnVehicleHealthFraction;
      if (vehicle.health < floor) vehicle.repair(floor - vehicle.health);
      vehicle.repairArmour(1);
    }

    this.#context.health.setFraction(config.respawnHealthFraction);
    this.#context.stamina.refill();

    const outpostNumber = this.#checkpoint.outpostNumber;
    this.#context.journey.restore(this.#checkpoint.journey);
    this.#context.journey.restoreToOutpost(outpostNumber);
    train.halt();

    this.#failed = false;
    return {
      train,
      inventory,
      outpost: OUTPOSTS[outpostNumber - 1] ?? null,
      outpostNumber,
    };
  }

  /** The player reached the end of the line and got out. */
  complete() {
    this.#context.statistics.commitRecords();
    this.clearCheckpoint();
    this.#events?.emit(GAME_EVENT.runCompleted, {
      statistics: this.#context.statistics.current,
      mode: this.#mode,
    });
  }
}
