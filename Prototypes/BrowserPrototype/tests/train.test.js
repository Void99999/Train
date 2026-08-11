import test from "node:test";
import assert from "node:assert/strict";

import { Train } from "../src/systems/train/train.js";
import { Vehicle, DAMAGE_STATE, resetVehicleIds } from "../src/systems/train/vehicle.js";
import { CargoHold } from "../src/systems/train/cargoHold.js";
import { EventBus, GAME_EVENT } from "../src/core/events.js";
import { VEHICLE_KIND } from "../src/data/wagons.js";
import { DAMAGE_CLASS } from "../src/data/damage.js";
import { TRAIN, ARMOUR, UNITS } from "../src/data/balance.js";

/* --------------------------------------------------------------- cargo hold */

test("cargo hold counts space in slots, not in items", () => {
  const hold = new CargoHold(20);

  assert.equal(hold.add("coal", 5), 5, "coal costs one slot each");
  assert.equal(hold.usedSlots, 5);

  assert.equal(hold.add("oil_barrel", 3), 3, "oil costs four slots each");
  assert.equal(hold.usedSlots, 5 + 12);
  assert.equal(hold.freeSlots, 3);

  // Only three slots left, and a barrel needs four.
  assert.equal(hold.spaceFor("oil_barrel"), 0);
  assert.equal(hold.add("oil_barrel", 1), 0);
  assert.equal(hold.add("coal", 10), 3, "partial fill stores what fits");
  assert.equal(hold.freeSlots, 0);
});

test("cargo hold removes only what is there", () => {
  const hold = new CargoHold(20);
  hold.add("fuel_can", 4);

  assert.equal(hold.remove("fuel_can", 10), 4);
  assert.equal(hold.quantityOf("fuel_can"), 0);
  assert.equal(hold.remove("coal", 1), 0);
  assert.ok(hold.isEmpty);
});

test("cargo hold refuses to shrink below what it holds", () => {
  const hold = new CargoHold(20);
  hold.add("coal", 15);
  assert.throws(() => hold.setCapacity(10), /Cannot shrink/);
  hold.setCapacity(35);
  assert.equal(hold.capacity, 35);
});

test("cargo hold survives a save round trip", () => {
  const hold = new CargoHold(35);
  hold.add("coal", 7);
  hold.add("heavy_shell", 3);

  const restored = CargoHold.deserialize(hold.serialize());
  assert.equal(restored.capacity, 35);
  assert.equal(restored.quantityOf("coal"), 7);
  assert.equal(restored.quantityOf("heavy_shell"), 3);
  assert.equal(restored.usedSlots, hold.usedSlots);
});

/* ------------------------------------------------------------------ vehicle */

test("vehicles start at the health their level specifies", () => {
  assert.equal(new Vehicle(VEHICLE_KIND.locomotive).maxHealth, 1500);
  assert.equal(new Vehicle(VEHICLE_KIND.transport, 1).maxHealth, 600);
  assert.equal(new Vehicle(VEHICLE_KIND.transport, 4).maxHealth, 900);
  assert.equal(new Vehicle(VEHICLE_KIND.combat, 1).maxHealth, 750);
  assert.equal(new Vehicle(VEHICLE_KIND.combat, 4).maxHealth, 1100);
});

test("weapon type decides how much a hit is worth against the train", () => {
  const rifleHit = new Vehicle(VEHICLE_KIND.transport, 1);
  const shellHit = new Vehicle(VEHICLE_KIND.transport, 1);

  rifleHit.applyDamage({ amount: 100, damageClass: DAMAGE_CLASS.rifle });
  shellHit.applyDamage({ amount: 100, damageClass: DAMAGE_CLASS.explosiveHeavy });

  assert.equal(rifleHit.health, 600 - 40, "rifle rounds do 40% against rolled steel");
  assert.equal(shellHit.health, 600 - 100, "a heavy shell does all of it");
});

test("armour takes 30% off and can only be fitted once", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  assert.ok(wagon.fitArmour());
  assert.equal(wagon.fitArmour(), false, "no second layer of armour exists");
  assert.equal(wagon.armourReduction, ARMOUR.damageReduction);

  wagon.applyDamage({ amount: 100 });
  assert.equal(wagon.health, 600 - 70, "100 incoming becomes 70");
});

test("armour wears down and keeps a little value once stripped", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  wagon.fitArmour();
  const capacity = wagon.armourCapacity;

  // Wear is half of incoming, so this exactly strips the plating.
  wagon.repair(1000);
  wagon.applyDamage({ amount: capacity / ARMOUR.integrity.wearFactor });

  assert.equal(wagon.armourIntegrity, 0, "plating is gone");
  assert.ok(wagon.armourReduction > 0, "shredded plates still help a little");
  assert.ok(wagon.armourReduction < ARMOUR.damageReduction, "but much less than intact ones");
});

test("damage state walks down the visual bands and back up after repair", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  assert.equal(wagon.damageState, DAMAGE_STATE.pristine);

  wagon.applyDamage({ amount: 100 });
  assert.equal(wagon.damageState, DAMAGE_STATE.light, "500/600 - scratches and dents");

  wagon.applyDamage({ amount: 150 });
  assert.equal(wagon.damageState, DAMAGE_STATE.medium, "350/600 - panels and holes");

  wagon.applyDamage({ amount: 150 });
  assert.equal(wagon.damageState, DAMAGE_STATE.heavy, "200/600 - smoke and sparks");

  wagon.applyDamage({ amount: 150 });
  assert.equal(wagon.damageState, DAMAGE_STATE.critical, "50/600 - about to go");

  wagon.repair(600);
  assert.equal(wagon.damageState, DAMAGE_STATE.pristine, "repairs restore the visual state");
  assert.equal(wagon.health, wagon.maxHealth);
});

test("upgrading keeps the wagon as battered as it was", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  wagon.applyDamage({ amount: 300 });
  assert.equal(wagon.healthFraction, 0.5);

  assert.ok(wagon.upgrade());
  assert.equal(wagon.level, 2);
  assert.equal(wagon.maxHealth, 700);
  assert.equal(wagon.health, 350, "still at half, on a bigger hull");
  assert.equal(wagon.cargoSlots, 35, "and the bigger hull holds more");
});

test("a vehicle cannot be upgraded past its top level", () => {
  const wagon = new Vehicle(VEHICLE_KIND.combat, 4);
  assert.equal(wagon.canUpgrade, false);
  assert.equal(wagon.upgrade(), false);
});

test("destroyed vehicles stop taking damage and stop being repairable", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  const result = wagon.applyDamage({ amount: 5000 });

  assert.ok(result.destroyed);
  assert.equal(wagon.health, 0);
  assert.equal(wagon.damageState, DAMAGE_STATE.destroyed);
  assert.equal(wagon.applyDamage({ amount: 100 }).applied, 0);
  assert.equal(wagon.repair(100), 0);
});

/* -------------------------------------------------------------------- train */

test("a fresh run starts with the locomotive and nothing else", () => {
  const train = new Train();
  assert.equal(train.vehicles.length, 1);
  assert.equal(train.wagonCount, 0);
  assert.ok(train.locomotive.isLocomotive);
});

test("throttle notches produce the intended speeds on a light train", () => {
  const train = new Train();
  const expected = [0, 20, 40, 60, 80];

  for (let index = 0; index < expected.length; index += 1) {
    train.setThrottleIndex(index);
    const speed = train.maxSpeedKmh * train.throttleFraction;
    assert.equal(Math.round(speed), expected[index], `notch ${index}`);
  }
});

test("a light train covers 10 km in about seven and a half minutes", () => {
  const train = new Train();
  train.setThrottleIndex(4);

  let seconds = 0;
  const step = 0.1;
  while (train.distanceKm < 10 && seconds < 3600) {
    train.update(step);
    seconds += step;
  }

  // 450 s at speed, plus the time spent accelerating up to it.
  assert.ok(seconds > 450, `took ${seconds.toFixed(0)} s, expected a little over 450`);
  assert.ok(seconds < 500, `took ${seconds.toFixed(0)} s, expected a little over 450`);
});

test("quarter throttle takes roughly four times as long as full throttle", () => {
  // Measured over a full 10 km leg, which is the unit the player actually
  // experiences. Over a much shorter sample the ratio comes out lower, because
  // the full-throttle run spends a larger share of the distance still
  // accelerating - that is honest physics, not a balancing error.
  const timeToTravel = (throttleIndex) => {
    const train = new Train();
    train.setThrottleIndex(throttleIndex);
    let seconds = 0;
    while (train.distanceKm < 10 && seconds < 20000) {
      train.update(0.25);
      seconds += 0.25;
    }
    return seconds;
  };

  const ratio = timeToTravel(1) / timeToTravel(4);
  assert.ok(ratio > 3.6 && ratio < 4.2, `ratio was ${ratio.toFixed(2)}, expected about 4`);
});

test("weight costs performance, with a floor that keeps the train playable", () => {
  const train = new Train();
  assert.equal(train.performanceMultiplier, 1);

  train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  assert.ok(Math.abs(train.performanceMultiplier - 0.97) < 1e-9, "one wagon costs 3%");

  train.vehicles[1].fitArmour();
  assert.ok(Math.abs(train.performanceMultiplier - 0.95) < 1e-9, "armour costs another 2%");

  for (let i = 0; i < 25; i += 1) train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  assert.equal(
    train.performanceMultiplier,
    TRAIN.performance.minimumMultiplier,
    "a huge train is slow, never immobile",
  );
});

test("loaded cargo weighs something", () => {
  const train = new Train();
  train.attach(new Vehicle(VEHICLE_KIND.transport, 4));
  const empty = train.performanceMultiplier;

  train.addCargo("coal", 80);
  assert.ok(train.performanceMultiplier < empty, "a full wagon is slower than an empty one");
});

test("cargo fills the train from the front and can be taken back out", () => {
  const train = new Train();
  const wagon = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  // Locomotive holds 12, the wagon another 20.
  assert.equal(train.cargoCapacity, 32);
  assert.equal(train.addCargo("coal", 32), 32);
  assert.equal(train.locomotive.hold.quantityOf("coal"), 12);
  assert.equal(wagon.hold.quantityOf("coal"), 20);
  assert.equal(train.addCargo("coal", 5), 0, "the train is full");

  assert.equal(train.removeCargo("coal", 20), 20);
  assert.equal(train.quantityOf("coal"), 12);
});

test("destroying a wagon cuts loose everything behind it", () => {
  const events = new EventBus();
  const detachments = [];
  events.on(GAME_EVENT.vehicleDetached, (payload) => detachments.push(payload));

  const train = new Train({ events });
  const a = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  const b = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  const c = train.attach(new Vehicle(VEHICLE_KIND.combat, 1));
  const d = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  const result = train.damageVehicle(b, { amount: 10000 });

  assert.ok(result.destroyed);
  assert.deepEqual(result.detached, [c, d], "c and d go with it");
  assert.deepEqual(train.vehicles, [train.locomotive, a], "only the front of the train remains");
  assert.equal(detachments.length, 1);
  assert.ok(c.isDetached && d.isDetached);
  assert.equal(train.wagonCount, 1);
});

test("cargo in a cut-loose wagon is gone from the train", () => {
  const train = new Train();
  const front = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  const rear = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  train.addCargo("coal", 32);
  assert.equal(rear.hold.quantityOf("coal"), 0);
  train.addCargo("oil_barrel", 5);
  assert.ok(rear.hold.quantityOf("oil_barrel") > 0);

  train.damageVehicle(front, { amount: 10000 });
  assert.equal(train.quantityOf("oil_barrel"), 0, "it left with the wagon");
  assert.equal(train.vehicles.length, 1);
});

test("cut-loose wagons roll to a stop and fall behind", () => {
  const train = new Train();
  train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  const rear = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  train.setThrottleIndex(4);
  for (let i = 0; i < 400; i += 1) train.update(0.1);
  const speedAtCut = train.speedMetresPerSecond;

  train.damageVehicle(train.vehicles[1], { amount: 10000 });
  const section = train.detachedSections[0];
  assert.equal(section.speed, speedAtCut, "it leaves at the speed it was doing");
  assert.ok(section.vehicles.includes(rear));

  for (let i = 0; i < 50; i += 1) train.update(0.1);
  assert.ok(section.speed < speedAtCut, "with no locomotive it slows down");
  assert.ok(section.distanceBehind > 0, "and drops behind the train");
});

test("losing the locomotive ends the run", () => {
  const train = new Train();
  train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  assert.equal(train.isDead, false);

  train.damageVehicle(train.locomotive, { amount: 99999 });
  assert.ok(train.isDead);
  assert.equal(train.wagonCount, 0);
});

test("a dead train coasts to a stop instead of stopping dead", () => {
  const train = new Train();
  train.setThrottleIndex(4);
  for (let i = 0; i < 400; i += 1) train.update(0.1);

  train.damageVehicle(train.locomotive, { amount: 99999 });
  const speedAtDeath = train.speedMetresPerSecond;
  train.update(1);

  assert.ok(train.speedMetresPerSecond < speedAtDeath);
  assert.ok(train.speedMetresPerSecond > 0);
});

test("train state survives a save round trip, minus what was lost", () => {
  resetVehicleIds();
  const train = new Train();
  const wagon = train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  wagon.fitArmour();
  train.addCargo("oil_barrel", 5);
  train.setThrottleIndex(3);
  train.update(10);

  const restored = Train.deserialize(train.serialize());
  assert.equal(restored.vehicles.length, 2);
  assert.equal(restored.wagons[0].level, 2);
  assert.ok(restored.wagons[0].isArmoured);
  assert.equal(restored.quantityOf("oil_barrel"), 5);
  assert.equal(restored.throttleIndex, 3);
  assert.equal(restored.distanceMetres, train.distanceMetres);
});

test("offsets place vehicles one behind the other", () => {
  const train = new Train();
  const first = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  const second = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  const locomotiveOffset = train.offsetOf(train.locomotive);
  assert.ok(train.offsetOf(first) > locomotiveOffset);
  assert.ok(train.offsetOf(second) > train.offsetOf(first));

  const gap = train.offsetOf(second) - train.offsetOf(first);
  assert.ok(Math.abs(gap - (9 + TRAIN.couplingLengthMetres)) < 1e-9);
});

test("speed conversion between metres per second and km/h holds", () => {
  const train = new Train();
  train.setThrottleIndex(4);
  for (let i = 0; i < 2000; i += 1) train.update(0.1);

  assert.ok(Math.abs(train.speedKmh - 80) < 0.5);
  assert.ok(Math.abs(train.speedMetresPerSecond - 80 * UNITS.kmhToMetresPerSecond) < 0.01);
});
