/**
 * Shared fixtures for the test suite.
 *
 * Builds the same object graph the game builds at runtime, so tests exercise
 * the real wiring rather than a simplified stand-in.
 */

import { EventBus } from "../src/core/events.js";
import { SaveSystem, MemoryStorage } from "../src/core/saveSystem.js";
import { Train } from "../src/systems/train/train.js";
import { MountRegistry } from "../src/systems/train/mounts.js";
import { Wallet } from "../src/systems/economy/wallet.js";
import { TradeService } from "../src/systems/economy/trade.js";
import { Workshop } from "../src/systems/economy/workshop.js";
import { Unlocks } from "../src/systems/world/unlocks.js";
import { JourneyTracker } from "../src/systems/world/journeyTracker.js";
import { Health } from "../src/systems/player/health.js";
import { Stamina } from "../src/systems/player/stamina.js";
import { Inventory } from "../src/systems/player/inventory.js";
import { Statistics } from "../src/systems/run/statistics.js";
import { Crew } from "../src/systems/ai/loader.js";
import { unlocksUpTo } from "../src/data/progression.js";

/**
 * A complete run context.
 *
 * @param {object} options
 * @param {number} [options.money]         starting balance
 * @param {number} [options.unlockedUpTo]  grant every unlock up to this outpost
 */
export function createRunContext({ money = 1000, unlockedUpTo = 10 } = {}) {
  const events = new EventBus();
  const saveSystem = new SaveSystem(new MemoryStorage());

  const train = new Train({ events });
  const mounts = new MountRegistry({ train });
  const wallet = new Wallet({ events, startingBalance: money });
  const unlocks = new Unlocks({ events });
  unlocks.grant([...unlocksUpTo(unlockedUpTo)]);

  const crew = new Crew({ train, mounts });
  const health = new Health({ events });
  const stamina = new Stamina({ events });
  const inventory = new Inventory({ events });
  const journey = new JourneyTracker({ train, unlocks, events });
  const statistics = new Statistics({ events, saveSystem });

  const trade = new TradeService({ train, wallet, unlocks });
  const workshop = new Workshop({ train, wallet, unlocks, crew, events });

  return {
    events,
    saveSystem,
    train,
    mounts,
    wallet,
    unlocks,
    crew,
    health,
    stamina,
    inventory,
    journey,
    statistics,
    trade,
    workshop,
  };
}

/** Runs a fixed-step simulation for `seconds`, calling `step(delta)` each tick. */
export function simulate(seconds, step, delta = 1 / 60) {
  const ticks = Math.ceil(seconds / delta);
  for (let i = 0; i < ticks; i += 1) step(delta);
}
