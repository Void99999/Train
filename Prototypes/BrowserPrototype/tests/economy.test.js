import test from "node:test";
import assert from "node:assert/strict";

import { createRunContext } from "./helpers.js";
import { Vehicle } from "../src/systems/train/vehicle.js";
import { Workshop } from "../src/systems/economy/workshop.js";
import { VEHICLE_KIND } from "../src/data/wagons.js";
import { SERVICE } from "../src/data/journey.js";
import { UNLOCK } from "../src/data/progression.js";
import { Unlocks } from "../src/systems/world/unlocks.js";
import { TradeService } from "../src/systems/economy/trade.js";
import { ECONOMY } from "../src/data/balance.js";

/* ------------------------------------------------------------------ trading */

test("trade goods sell for exactly double what they cost", () => {
  const { trade, train, wallet } = createRunContext({ money: 1000 });

  const bought = trade.buyCargo(SERVICE.cargoTrader, "coal", 10);
  assert.ok(bought.ok);
  assert.equal(bought.cost, 100);
  assert.equal(wallet.balance, 900);
  assert.equal(train.quantityOf("coal"), 10);

  const sold = trade.sellCargo(SERVICE.cargoTrader, "coal", 10);
  assert.ok(sold.ok);
  assert.equal(sold.income, 200);
  assert.equal(wallet.balance, 1100);
});

test("a purchase that does not fit is refused rather than trimmed", () => {
  const { trade, wallet, train } = createRunContext({ money: 10000 });

  // Only the locomotive: 12 slots, and a barrel takes four.
  assert.equal(train.spaceFor("oil_barrel"), 3);

  const result = trade.buyCargo(SERVICE.cargoTrader, "oil_barrel", 4);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_NO_SPACE");
  assert.equal(wallet.balance, 10000, "nothing was charged");
  assert.equal(train.quantityOf("oil_barrel"), 0);
});

test("a purchase that cannot be afforded is refused", () => {
  const { trade, wallet } = createRunContext({ money: 50 });
  const result = trade.buyCargo(SERVICE.cargoTrader, "oil_barrel", 1);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_NO_MONEY");
  assert.equal(wallet.balance, 50);
});

test("the shop knows its own limits before the player clicks", () => {
  const { trade, train } = createRunContext({ money: 55 });
  train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  // 55 money buys 5 coal; space is not the binding constraint here.
  assert.equal(trade.maximumPurchasable(SERVICE.cargoTrader, "coal"), 5);

  const offer = trade.cargoOffer(SERVICE.cargoTrader, "coal");
  assert.equal(offer.buyPrice, 10);
  assert.equal(offer.sellPrice, 20);
  assert.ok(offer.canBuy && offer.canSell);
  assert.equal(offer.maximumPurchasable, 5);
});

test("sell all and sell half take the right amounts", () => {
  const { trade, train, wallet } = createRunContext({ money: 0 });
  train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  train.addCargo("coal", 21);

  const half = trade.sellHalf(SERVICE.cargoTrader, "coal");
  assert.equal(half.quantity, 10, "21 halved and rounded down");
  assert.equal(train.quantityOf("coal"), 11);

  const rest = trade.sellAll(SERVICE.cargoTrader, "coal");
  assert.equal(rest.quantity, 11);
  assert.equal(train.quantityOf("coal"), 0);
  assert.equal(wallet.balance, 21 * 20);
});

test("selling something you do not have says so", () => {
  const { trade } = createRunContext();
  const result = trade.sellCargo(SERVICE.cargoTrader, "coal", 5);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_NOTHING_TO_SELL");
});

test("ammunition is bought but never sold back", () => {
  const { trade, train } = createRunContext({ money: 500 });
  assert.ok(trade.buyCargo(SERVICE.ammunitionShop, "rifle_ammo", 2).ok);
  assert.equal(train.quantityOf("rifle_ammo"), 2);

  const sale = trade.sellCargo(SERVICE.cargoTrader, "rifle_ammo", 1);
  assert.equal(sale.ok, false);
  assert.equal(sale.reasonKey, "TRADE_ERROR_NOT_SOLD_HERE");
});

test("a cargo trader does not sell weapons", () => {
  const { trade } = createRunContext({ money: 5000 });
  const result = trade.buyCargo(SERVICE.cargoTrader, "rocket", 1);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_NOT_SOLD_HERE");
});

/* ------------------------------------------------------------------ weapons */

test("locked weapons cannot be bought, unlocked ones can", () => {
  const events = { emit() {}, on() {} };
  const { trade: openTrade, inventory, wallet } = createRunContext({ money: 5000 });

  assert.ok(openTrade.buyWeapon("assault_rifle", inventory).ok);
  assert.ok(inventory.has("assault_rifle"));
  assert.equal(wallet.balance, 5000 - 450);

  const lockedUnlocks = new Unlocks({ events });
  const locked = new TradeService({
    train: { quantityOf: () => 0, spaceFor: () => 0 },
    wallet,
    unlocks: lockedUnlocks,
  });
  const result = locked.buyWeapon("minigun", inventory);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_LOCKED");
});

test("a weapon already owned is not sold twice", () => {
  const { trade, inventory } = createRunContext({ money: 5000 });
  assert.ok(trade.buyWeapon("rpg", inventory).ok);
  const second = trade.buyWeapon("rpg", inventory);
  assert.equal(second.ok, false);
  assert.equal(second.reasonKey, "TRADE_ERROR_ALREADY_OWNED");
});

/* ----------------------------------------------------------------- workshop */

test("buying a wagon costs the listed price and lengthens the train", () => {
  const { workshop, wallet, train } = createRunContext({ money: 1000 });

  const result = workshop.buyVehicle(VEHICLE_KIND.transport);
  assert.ok(result.ok);
  assert.equal(result.price, 300);
  assert.equal(wallet.balance, 700);
  assert.equal(train.wagonCount, 1);
});

test("wagon and upgrade prices match the approved balance table", () => {
  const { workshop, wallet } = createRunContext({ money: 10000 });

  const transport = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;
  assert.equal(workshop.upgradeVehicle(transport).price, 250);
  assert.equal(workshop.upgradeVehicle(transport).price, 500);
  assert.equal(workshop.upgradeVehicle(transport).price, 900);
  assert.equal(transport.level, 4);

  const combat = workshop.buyVehicle(VEHICLE_KIND.combat).vehicle;
  assert.equal(combat.level, 1);
  assert.equal(workshop.upgradeVehicle(combat).price, 450);
  assert.equal(workshop.upgradeVehicle(combat).price, 900);
  assert.equal(workshop.upgradeVehicle(combat).price, 1800);

  const spent = 300 + 250 + 500 + 900 + 500 + 450 + 900 + 1800;
  assert.equal(wallet.balance, 10000 - spent);
});

test("armour costs the listed price and can only be fitted once", () => {
  const { workshop, wallet, train } = createRunContext({ money: 5000 });
  const wagon = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;

  assert.equal(workshop.fitArmour(wagon).price, 500);
  assert.ok(wagon.isArmoured);

  const second = workshop.fitArmour(wagon);
  assert.equal(second.ok, false);
  assert.equal(second.reasonKey, "TRADE_ERROR_ALREADY_OWNED");

  assert.equal(workshop.fitArmour(train.locomotive).price, 1000);
  assert.equal(wallet.balance, 5000 - 300 - 500 - 1000);
});

test("armour is refused until the outpost that unlocks it", () => {
  const { workshop } = createRunContext({ money: 5000, unlockedUpTo: 1 });
  const wagon = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;
  const result = workshop.fitArmour(wagon);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_LOCKED");
});

test("combat wagon levels are gated by the outposts that grant them", () => {
  const { workshop, unlocks } = createRunContext({ money: 20000, unlockedUpTo: 1 });
  const combat = workshop.buyVehicle(VEHICLE_KIND.combat).vehicle;

  assert.ok(workshop.upgradeVehicle(combat).ok, "level 2 is available at outpost 1");
  assert.equal(workshop.upgradeVehicle(combat).reasonKey, "TRADE_ERROR_LOCKED");

  unlocks.grant([UNLOCK.combatWagonLevel3]);
  assert.ok(workshop.upgradeVehicle(combat).ok);
  assert.equal(workshop.upgradeVehicle(combat).reasonKey, "TRADE_ERROR_LOCKED");

  unlocks.grant([UNLOCK.combatWagonLevel4]);
  assert.ok(workshop.upgradeVehicle(combat).ok);
  assert.equal(combat.level, 4);
});

test("repairs cost one unit of money for five points of condition", () => {
  const { workshop, wallet } = createRunContext({ money: 1000 });
  const wagon = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;
  wagon.applyDamage({ amount: 500 });

  const quote = workshop.repairQuote(wagon, 1);
  assert.equal(quote.healthPoints, 500);
  assert.equal(quote.price, 100, "500 missing condition costs 100");

  const before = wallet.balance;
  const result = workshop.repairVehicle(wagon, 1);
  assert.ok(result.ok);
  assert.equal(wallet.balance, before - 100);
  assert.equal(wagon.health, wagon.maxHealth);
  assert.equal(Workshop.repairCostFor(500), 500 / ECONOMY.healthPointsPerCurrencyUnit);
});

test("partial repairs restore and charge in proportion", () => {
  const { workshop, wallet } = createRunContext({ money: 1000 });
  const wagon = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;
  wagon.applyDamage({ amount: 400 });

  const before = wallet.balance;
  workshop.repairVehicle(wagon, 0.5);
  assert.equal(wagon.health, 200 + 200);
  assert.equal(wallet.balance, before - 40);
});

test("repairing an undamaged wagon is refused, not charged", () => {
  const { workshop, wallet } = createRunContext({ money: 1000 });
  const wagon = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;
  const before = wallet.balance;

  const result = workshop.repairVehicle(wagon, 1);
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "WORKSHOP_UNDAMAGED");
  assert.equal(wallet.balance, before);
});

test("the workshop previews a purchase before the player commits", () => {
  const { workshop, train } = createRunContext({ money: 5000 });
  train.addCargo("coal", 12);

  const preview = workshop.preview(VEHICLE_KIND.transport);
  assert.equal(preview.price, 300);
  assert.equal(preview.current.wagonCount, 0);
  assert.equal(preview.proposed.wagonCount, 1);
  assert.ok(preview.proposed.cargoCapacity > preview.current.cargoCapacity);
  assert.ok(preview.proposed.maxSpeedKmh < preview.current.maxSpeedKmh, "more wagon, less speed");
  assert.equal(train.wagonCount, 0, "the preview bought nothing");
});

test("the workshop previews an upgrade before the player commits", () => {
  const { workshop } = createRunContext({ money: 5000 });
  const wagon = workshop.buyVehicle(VEHICLE_KIND.transport).vehicle;

  const preview = workshop.previewUpgrade(wagon);
  assert.equal(preview.nextLevel, 2);
  assert.equal(preview.price, 250);
  assert.ok(preview.proposed.cargoCapacity > preview.current.cargoCapacity);
  assert.equal(wagon.level, 1, "the preview upgraded nothing");
});

test("the Loader is hired once, costs 1500, and has no second copy", () => {
  const { workshop, crew, wallet } = createRunContext({ money: 5000 });

  assert.ok(workshop.hireLoader().ok);
  assert.ok(crew.hasLoader);
  assert.equal(wallet.balance, 3500);

  const second = workshop.hireLoader();
  assert.equal(second.ok, false);
  assert.equal(second.reasonKey, "TRADE_ERROR_ALREADY_OWNED");
});

test("the Loader is not for hire before outpost 4", () => {
  const { workshop } = createRunContext({ money: 5000, unlockedUpTo: 3 });
  const result = workshop.hireLoader();
  assert.equal(result.ok, false);
  assert.equal(result.reasonKey, "TRADE_ERROR_LOCKED");
});

/* -------------------------------------------------------------- medical */

test("a full heal costs 50 and is refused when unhurt", () => {
  const { trade, health, wallet } = createRunContext({ money: 200 });

  const untouched = trade.buyFullHeal(health);
  assert.equal(untouched.ok, false);
  assert.equal(untouched.reasonKey, "MEDICAL_ALREADY_HEALTHY");

  health.damage(60);
  const result = trade.buyFullHeal(health);
  assert.ok(result.ok);
  assert.equal(result.cost, 50);
  assert.equal(health.value, 100);
  assert.equal(wallet.balance, 150);
});

test("medkits cost 75 and stop at three", () => {
  const { trade, inventory, wallet } = createRunContext({ money: 1000 });

  for (let i = 0; i < 3; i += 1) assert.ok(trade.buyMedkit(inventory).ok);
  assert.equal(inventory.medkits, 3);
  assert.equal(wallet.balance, 1000 - 225);

  const fourth = trade.buyMedkit(inventory);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reasonKey, "MEDICAL_MEDKITS_FULL");
});

/* --------------------------------------------------------------- wallet */

test("money cannot be overspent and losses are proportional", () => {
  const { wallet } = createRunContext({ money: 100 });
  assert.equal(wallet.spend(150), false);
  assert.equal(wallet.balance, 100);

  wallet.earn(400);
  assert.equal(wallet.balance, 500);
  assert.equal(wallet.totalEarned, 400);

  assert.equal(wallet.loseFraction(0.2), 100);
  assert.equal(wallet.balance, 400);
});
