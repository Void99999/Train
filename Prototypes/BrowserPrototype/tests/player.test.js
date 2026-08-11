import test from "node:test";
import assert from "node:assert/strict";

import { createRunContext, simulate } from "./helpers.js";
import { Health } from "../src/systems/player/health.js";
import { Stamina } from "../src/systems/player/stamina.js";
import { Inventory } from "../src/systems/player/inventory.js";
import { WeaponState } from "../src/systems/combat/weaponState.js";
import { PLAYER } from "../src/data/balance.js";
import { SERVICE } from "../src/data/journey.js";

/**
 * Fires `count` shots, letting the cooldown expire between each one.
 * Calling fire() twice in the same instant is correctly refused by the rate of
 * fire, so a test that wants two rounds gone has to let time pass.
 */
function fireShots(weapon, count) {
  let fired = 0;
  for (let i = 0; i < count; i += 1) {
    if (weapon.fire()) fired += 1;
    weapon.update(1, { triggerHeld: true });
  }
  return fired;
}

/* ------------------------------------------------------------------- health */

test("the player has 100 health and never regenerates it", () => {
  const health = new Health();
  assert.equal(health.max, 100);
  assert.equal(health.value, 100);

  health.damage(40);
  assert.equal(health.value, 60);

  // There is no update() to call. Health only moves when something moves it.
  assert.equal(PLAYER.healthRegenPerSecond, 0);
  assert.equal(health.value, 60);
});

test("healing stops at full and damage stops at dead", () => {
  const health = new Health();
  health.damage(30);
  assert.equal(health.heal(100), 30, "only the missing 30 is restored");
  assert.equal(health.value, 100);

  const killing = health.damage(500);
  assert.equal(killing.applied, 100, "you can only lose what you have");
  assert.ok(killing.died);
  assert.equal(health.value, 0);
  assert.equal(health.heal(50), 0, "the dead do not heal");
});

test("a medkit restores 50 and is consumed", () => {
  const { inventory, health, trade } = createRunContext({ money: 1000 });
  trade.buyMedkit(inventory);
  health.damage(80);

  assert.equal(inventory.useMedkit(health), 50);
  assert.equal(health.value, 70);
  assert.equal(inventory.medkits, 0);
  assert.equal(inventory.useMedkit(health), 0, "none left");
});

test("a medkit is not wasted on a healthy player", () => {
  const { inventory, health, trade } = createRunContext({ money: 1000 });
  trade.buyMedkit(inventory);
  assert.equal(inventory.useMedkit(health), 0);
  assert.equal(inventory.medkits, 1, "still in the pocket");
});

/* ------------------------------------------------------------------ stamina */

test("sprinting lasts about eight seconds", () => {
  const stamina = new Stamina();
  let seconds = 0;
  while (stamina.value > 0 && seconds < 30) {
    stamina.update(0.1, { wantsToSprint: true, isMoving: true });
    seconds += 0.1;
  }
  assert.ok(Math.abs(seconds - 8) < 0.3, `sprinted for ${seconds.toFixed(1)} s`);
});

test("stamina waits a second before it starts coming back", () => {
  const stamina = new Stamina();
  simulate(4, (delta) => stamina.update(delta, { wantsToSprint: true, isMoving: true }));
  const afterSprint = stamina.value;

  simulate(0.9, (delta) => stamina.update(delta, {}));
  assert.equal(stamina.value, afterSprint, "nothing recovers during the delay");

  simulate(0.5, (delta) => stamina.update(delta, {}));
  assert.ok(stamina.value > afterSprint, "then it starts to come back");
});

test("empty stamina refills in about six seconds", () => {
  const stamina = new Stamina();
  while (stamina.value > 0) stamina.update(0.1, { wantsToSprint: true, isMoving: true });

  // One second of delay, then the refill itself.
  let seconds = 0;
  while (stamina.value < stamina.max && seconds < 30) {
    stamina.update(0.1, {});
    seconds += 0.1;
  }
  assert.ok(Math.abs(seconds - 7) < 0.4, `refilled in ${seconds.toFixed(1)} s including the delay`);
});

test("an exhausted player cannot immediately sprint again", () => {
  const stamina = new Stamina();
  while (stamina.value > 0) stamina.update(0.1, { wantsToSprint: true, isMoving: true });
  assert.equal(stamina.isSprinting, false);

  // Recovered a little, but not past the threshold that allows a new sprint.
  simulate(1.4, (delta) => stamina.update(delta, {}));
  assert.ok(stamina.value < PLAYER.stamina.minimumToStartSprinting);
  assert.equal(stamina.update(0.1, { wantsToSprint: true, isMoving: true }), false);
});

test("standing still does not drain stamina even with sprint held", () => {
  const stamina = new Stamina();
  simulate(3, (delta) => stamina.update(delta, { wantsToSprint: true, isMoving: false }));
  assert.equal(stamina.value, stamina.max);
});

test("the stamina bar hides itself when it has nothing to say", () => {
  const stamina = new Stamina();
  assert.equal(stamina.shouldDisplay, false);
  stamina.update(0.5, { wantsToSprint: true, isMoving: true });
  assert.ok(stamina.shouldDisplay);
});

test("sprinting is faster than walking, crouching is slower", () => {
  const stamina = new Stamina();
  const walk = stamina.currentSpeed();
  stamina.update(0.1, { wantsToSprint: true, isMoving: true });
  assert.ok(stamina.currentSpeed() > walk);
  assert.ok(stamina.currentSpeed({ crouching: true }) < walk);
});

/* ---------------------------------------------------------------- inventory */

test("a run starts with a loaded pistol and nothing else", () => {
  const inventory = new Inventory();
  assert.deepEqual(inventory.ownedWeapons, ["pistol"]);
  assert.equal(inventory.equippedWeaponId, "pistol");
  assert.equal(inventory.equippedWeapon.roundsInMagazine, 12);
  assert.equal(inventory.medkits, 0);
});

test("the weapon wheel lists owned weapons in a fixed order", () => {
  const inventory = new Inventory();
  inventory.addWeapon("minigun");
  inventory.addWeapon("assault_rifle");
  assert.deepEqual(inventory.wheelOrder, ["pistol", "assault_rifle", "minigun"]);
});

test("a weapon that is not owned cannot be equipped", () => {
  const inventory = new Inventory();
  assert.equal(inventory.equip("rpg"), false);
  assert.equal(inventory.equippedWeaponId, "pistol");
});

/* -------------------------------------------------------- ammunition supply */

test("reloading opens packs from the train and wastes no rounds", () => {
  const { inventory, train, trade } = createRunContext({ money: 1000 });
  trade.buyCargo(SERVICE.ammunitionShop, "pistol_ammo", 1);
  assert.equal(train.quantityOf("pistol_ammo"), 1);

  const pistol = inventory.equippedWeapon;
  fireShots(pistol, 2);
  assert.equal(pistol.roundsInMagazine, 10);

  assert.ok(inventory.reloadEquipped(train));
  assert.equal(pistol.roundsInMagazine, 12);
  assert.equal(train.quantityOf("pistol_ammo"), 0, "the pack was opened");
  assert.equal(inventory.looseRoundsOf("pistol_ammo"), 28, "the rest is kept, not thrown away");
});

test("with no ammunition aboard, a reload does nothing", () => {
  const { inventory, train } = createRunContext({ money: 0 });
  const pistol = inventory.equippedWeapon;
  assert.equal(fireShots(pistol, 12), 12);

  assert.equal(pistol.roundsInMagazine, 0);
  assert.equal(inventory.reloadEquipped(train), false);
  assert.equal(pistol.roundsInMagazine, 0);
});

test("the HUD can report magazine and reserve separately", () => {
  const { inventory, train, trade } = createRunContext({ money: 1000 });
  trade.buyCargo(SERVICE.ammunitionShop, "pistol_ammo", 2);

  assert.equal(inventory.totalRoundsFor("pistol", train), 12 + 60);
  assert.equal(inventory.reserveRoundsFor("pistol", train), 60);
});

/* ------------------------------------------------------------ weapon timing */

test("rate of fire is respected", () => {
  const rifle = new WeaponState("assault_rifle");
  assert.ok(rifle.fire(), "first round leaves immediately");
  assert.equal(rifle.canFire(), false, "the next one has to wait");

  rifle.update(1 / 9 + 0.001);
  assert.ok(rifle.canFire());
});

test("an empty weapon cannot fire", () => {
  const pistol = new WeaponState("pistol");
  for (let i = 0; i < 12; i += 1) {
    assert.ok(pistol.fire());
    pistol.update(1);
  }
  assert.equal(pistol.fire(), null);
  assert.ok(pistol.isEmpty);
});

test("a weapon cannot fire while it is reloading", () => {
  const pistol = new WeaponState("pistol");
  pistol.fire();
  const supply = { take: (id, rounds) => rounds };

  assert.ok(pistol.beginReload(supply));
  assert.ok(pistol.isReloading);
  assert.equal(pistol.fire(), null);

  pistol.update(2);
  assert.equal(pistol.isReloading, false);
  assert.ok(pistol.fire());
});

test("the minigun has to spin up before it fires", () => {
  const minigun = new WeaponState("minigun");
  assert.equal(minigun.canFire(), false, "barrels are not turning yet");

  minigun.update(0.4, { triggerHeld: true });
  assert.equal(minigun.canFire(), false);

  minigun.update(0.5, { triggerHeld: true });
  assert.ok(minigun.canFire());

  // Let go and the barrels wind down again.
  minigun.update(1, { triggerHeld: false });
  assert.equal(minigun.canFire(), false);
});

test("a full magazine cannot be reloaded", () => {
  const rifle = new WeaponState("assault_rifle");
  assert.equal(rifle.beginReload({ take: () => 30 }), false);
});

test("weapon state survives a save round trip", () => {
  const rifle = new WeaponState("assault_rifle");
  fireShots(rifle, 2);

  const restored = WeaponState.deserialize(rifle.serialize());
  assert.equal(restored.weaponId, "assault_rifle");
  assert.equal(restored.roundsInMagazine, 28);
});

test("inventory survives a save round trip", () => {
  const { inventory, train, trade } = createRunContext({ money: 5000 });
  trade.buyWeapon("assault_rifle", inventory);
  trade.buyMedkit(inventory);
  trade.buyCargo(SERVICE.ammunitionShop, "rifle_ammo", 1);
  inventory.equip("assault_rifle");
  inventory.reloadEquipped(train);

  const restored = Inventory.deserialize(inventory.serialize());
  assert.deepEqual(restored.ownedWeapons.sort(), ["assault_rifle", "pistol"]);
  assert.equal(restored.equippedWeaponId, "assault_rifle");
  assert.equal(restored.medkits, 1);
  assert.equal(
    restored.equippedWeapon.roundsInMagazine,
    inventory.equippedWeapon.roundsInMagazine,
  );
});
