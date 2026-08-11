/**
 * LAST TRAIN - buying and selling.
 *
 * A deliberate concession to playability: selling fifty lumps of coal does not
 * mean carrying fifty lumps of coal across a rail yard one at a time. The
 * player picks a cargo type, picks an amount, and confirms. The cargo leaves
 * the connected wagons and the money arrives.
 *
 * Everything the interface needs in order to *not* offer an impossible action
 * is available before the action is taken - maximum affordable, maximum that
 * fits, how much is aboard - so a shop can present a slider that already knows
 * its own limits instead of failing after the fact.
 *
 * Failures come back as localization keys rather than sentences, so the shop
 * can say the same thing in German without this file knowing any German.
 */

import { cargoSpec } from "../../data/cargo.js";
import { shopDefinition } from "../../data/shops.js";
import { weaponSpec } from "../../data/weapons.js";
import { WEAPON_UNLOCKS } from "../../data/progression.js";
import { PLAYER } from "../../data/balance.js";
import { SHOP_DEFINITIONS } from "../../data/shops.js";
import { SERVICE } from "../../data/journey.js";

const ok = (details = {}) => ({ ok: true, ...details });
const fail = (reasonKey) => ({ ok: false, reasonKey });

export class TradeService {
  #train;
  #wallet;
  #unlocks;

  /**
   * @param {object} deps
   * @param {import("../train/train.js").Train} deps.train  storage and delivery
   * @param {import("./wallet.js").Wallet} deps.wallet
   * @param {{ has: (id: string) => boolean }} deps.unlocks
   */
  constructor({ train, wallet, unlocks }) {
    this.#train = train;
    this.#wallet = wallet;
    this.#unlocks = unlocks;
  }

  /* ---------------------------------------------------------------- cargo */

  /** How many units of `cargoId` the player could buy here right now. */
  maximumPurchasable(serviceId, cargoId) {
    const shop = shopDefinition(serviceId);
    if (!shop.sells.includes(cargoId)) return 0;
    const spec = cargoSpec(cargoId);
    if (!spec.buyPrice) return 0;

    const affordable = Math.floor(this.#wallet.balance / spec.buyPrice);
    return Math.min(affordable, this.#train.spaceFor(cargoId));
  }

  /**
   * Buys cargo. Partial purchases are refused rather than silently trimmed -
   * a player who asked for 20 barrels and can only fit 12 should be told, not
   * charged for 12 and left wondering.
   */
  buyCargo(serviceId, cargoId, quantity) {
    const shop = shopDefinition(serviceId);
    if (!shop.sells.includes(cargoId)) return fail("TRADE_ERROR_NOT_SOLD_HERE");

    const amount = Math.floor(quantity);
    if (amount <= 0) return fail("TRADE_ERROR_NOT_SOLD_HERE");

    const spec = cargoSpec(cargoId);
    const cost = spec.buyPrice * amount;
    if (!this.#wallet.canAfford(cost)) return fail("TRADE_ERROR_NO_MONEY");
    if (this.#train.spaceFor(cargoId) < amount) return fail("TRADE_ERROR_NO_SPACE");

    // Space was checked first, so this cannot half-succeed.
    this.#wallet.spend(cost);
    const stored = this.#train.addCargo(cargoId, amount);
    return ok({ quantity: stored, cost });
  }

  /** Sells cargo out of the connected wagons. */
  sellCargo(serviceId, cargoId, quantity) {
    const shop = shopDefinition(serviceId);
    if (!shop.buys.includes(cargoId)) return fail("TRADE_ERROR_NOT_SOLD_HERE");

    const spec = cargoSpec(cargoId);
    if (!spec.sellPrice) return fail("TRADE_ERROR_NOT_SOLD_HERE");

    const owned = this.#train.quantityOf(cargoId);
    if (owned <= 0) return fail("TRADE_ERROR_NOTHING_TO_SELL");

    const amount = Math.min(Math.floor(quantity), owned);
    if (amount <= 0) return fail("TRADE_ERROR_NOTHING_TO_SELL");

    const removed = this.#train.removeCargo(cargoId, amount);
    const income = spec.sellPrice * removed;
    this.#wallet.earn(income);
    return ok({ quantity: removed, income });
  }

  sellAll(serviceId, cargoId) {
    return this.sellCargo(serviceId, cargoId, this.#train.quantityOf(cargoId));
  }

  sellHalf(serviceId, cargoId) {
    const owned = this.#train.quantityOf(cargoId);
    return this.sellCargo(serviceId, cargoId, Math.floor(owned / 2));
  }

  /** Everything a cargo shop needs to draw one row, without asking twice. */
  cargoOffer(serviceId, cargoId) {
    const spec = cargoSpec(cargoId);
    const shop = shopDefinition(serviceId);
    return {
      cargoId,
      slots: spec.slots,
      buyPrice: spec.buyPrice,
      sellPrice: spec.sellPrice,
      canBuy: shop.sells.includes(cargoId) && Boolean(spec.buyPrice),
      canSell: shop.buys.includes(cargoId) && Boolean(spec.sellPrice),
      owned: this.#train.quantityOf(cargoId),
      maximumPurchasable: this.maximumPurchasable(serviceId, cargoId),
      spaceFor: this.#train.spaceFor(cargoId),
    };
  }

  /* -------------------------------------------------------------- weapons */

  weaponOffer(weaponId) {
    const spec = weaponSpec(weaponId);
    const requirement = WEAPON_UNLOCKS[weaponId] ?? null;
    return {
      weaponId,
      price: spec.price,
      unlocked: requirement === null || this.#unlocks.has(requirement),
      affordable: spec.price !== null && this.#wallet.canAfford(spec.price),
    };
  }

  /**
   * @param {import("../player/inventory.js").Inventory} inventory
   */
  buyWeapon(weaponId, inventory) {
    const spec = weaponSpec(weaponId);
    if (spec.price === null) return fail("TRADE_ERROR_NOT_SOLD_HERE");
    if (inventory.has(weaponId)) return fail("TRADE_ERROR_ALREADY_OWNED");

    const requirement = WEAPON_UNLOCKS[weaponId] ?? null;
    if (requirement && !this.#unlocks.has(requirement)) return fail("TRADE_ERROR_LOCKED");
    if (!this.#wallet.spend(spec.price)) return fail("TRADE_ERROR_NO_MONEY");

    inventory.addWeapon(weaponId);
    return ok({ weaponId, cost: spec.price });
  }

  /* -------------------------------------------------------------- medical */

  /** Patches the player up completely for a flat fee. */
  buyFullHeal(health) {
    const shop = SHOP_DEFINITIONS[SERVICE.medicalService];
    if (health.missing <= 0) return fail("MEDICAL_ALREADY_HEALTHY");
    if (!this.#wallet.spend(shop.fullHealPrice)) return fail("TRADE_ERROR_NO_MONEY");
    const restored = health.heal(health.max);
    return ok({ restored, cost: shop.fullHealPrice });
  }

  buyMedkit(inventory) {
    const shop = SHOP_DEFINITIONS[SERVICE.medicalService];
    if (!inventory.canCarryMoreMedkits) return fail("MEDICAL_MEDKITS_FULL");
    if (!this.#wallet.spend(shop.medkitPrice)) return fail("TRADE_ERROR_NO_MONEY");
    inventory.addMedkit(1);
    return ok({ cost: shop.medkitPrice, carried: inventory.medkits });
  }

  get medkitPrice() {
    return SHOP_DEFINITIONS[SERVICE.medicalService].medkitPrice;
  }

  get fullHealPrice() {
    return SHOP_DEFINITIONS[SERVICE.medicalService].fullHealPrice;
  }

  get maxMedkits() {
    return PLAYER.medkit.maxCarried;
  }
}
