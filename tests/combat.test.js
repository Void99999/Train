import test from "node:test";
import assert from "node:assert/strict";

import { createRunContext } from "./helpers.js";
import {
  splashFractionAt,
  resolveExplosion,
  damageThroughWall,
  wallProtectionOf,
} from "../src/systems/combat/damageResolver.js";
import {
  buildTargetCandidates,
  chooseTarget,
  selectTarget,
} from "../src/systems/combat/targetSelection.js";
import { Loader, LOADER_STATE, LOADER_ASSIGNMENT_AUTOMATIC } from "../src/systems/ai/loader.js";
import { Vehicle } from "../src/systems/train/vehicle.js";
import { Rng } from "../src/core/rng.js";
import { VEHICLE_KIND, MOUNT_TYPE } from "../src/data/wagons.js";
import { DAMAGE_CLASS, effectivenessOf } from "../src/data/damage.js";
import { ARMOUR_CLASS } from "../src/data/wagons.js";
import { weaponSpec } from "../src/data/weapons.js";
import { enemySpec } from "../src/data/enemies.js";
import { LOADER } from "../src/data/progression.js";
import { simulate } from "./helpers.js";

/* ------------------------------------------------- weapons versus armour */

/** Damage one shot of `weaponId` actually does to a target of `armourClass`. */
function shotDamage(weaponId, armourClass) {
  const spec = weaponSpec(weaponId);
  return spec.damage * effectivenessOf(spec.damageClass, armourClass);
}

test("a pistol is useless against a tank and lethal against a soldier", () => {
  const versusSoldier = shotDamage("pistol", ARMOUR_CLASS.unarmoured);
  const versusTank = shotDamage("pistol", ARMOUR_CLASS.heavyArmour);

  assert.equal(versusSoldier, 25);
  assert.ok(versusTank < 1, `${versusTank} damage to a tank is nothing`);

  const tankHealth = enemySpec("tank").maxHealth;
  assert.ok(tankHealth / versusTank > 1000, "emptying a pistol into a tank is a waste");
});

test("the assault rifle barely scratches heavy armour", () => {
  const versusTank = shotDamage("assault_rifle", ARMOUR_CLASS.heavyArmour);
  assert.ok(versusTank <= 2, `${versusTank} per round is extremely low, as intended`);
});

test("the mounted machine gun bites into light vehicles but not tanks", () => {
  const versusVehicle = shotDamage("mounted_machine_gun", ARMOUR_CLASS.lightVehicle);
  const versusTank = shotDamage("mounted_machine_gun", ARMOUR_CLASS.heavyArmour);

  assert.ok(versusVehicle > 15, "a real answer to a technical");
  assert.ok(versusTank < 5, "and no answer at all to a tank");
});

test("an RPG opens armoured vehicles", () => {
  const versusVehicle = shotDamage("rpg", ARMOUR_CLASS.lightVehicle);
  const vehicleHealth = enemySpec("combat_vehicle").maxHealth;

  // Not a one-shot kill, but close enough that a rocket is clearly the right
  // tool - and a second one finishes the job.
  assert.ok(versusVehicle / vehicleHealth > 0.75, "one rocket nearly does it");
  assert.ok(versusVehicle * 2 > vehicleHealth, "two certainly do");
  assert.ok(
    versusVehicle > shotDamage("assault_rifle", ARMOUR_CLASS.lightVehicle) * 20,
    "and it is not remotely a rifle's job",
  );
});

test("the heavy train cannon kills a tank in two shots", () => {
  const perShot = shotDamage("heavy_turret_cannon", ARMOUR_CLASS.heavyArmour);
  const tankHealth = enemySpec("tank").maxHealth;

  assert.equal(perShot, 1500);
  assert.ok(perShot * 2 >= tankHealth);
  assert.ok(perShot < tankHealth, "but not in one - a tank is still a tank");
});

test("weapons are ordered by how well they answer armour, not by damage alone", () => {
  const versusTank = ["pistol", "assault_rifle", "mounted_machine_gun", "rpg", "heavy_turret_cannon"]
    .map((id) => shotDamage(id, ARMOUR_CLASS.heavyArmour));

  for (let i = 1; i < versusTank.length; i += 1) {
    assert.ok(versusTank[i] > versusTank[i - 1], "each step up is a real step up");
  }
});

/* ---------------------------------------------------------------- splash */

test("explosive damage falls off from the centre of the blast", () => {
  assert.equal(splashFractionAt(0, 10), 1, "everything at the impact point");
  assert.ok(splashFractionAt(5, 10) < 1);
  assert.ok(splashFractionAt(5, 10) > splashFractionAt(8, 10));
  assert.equal(splashFractionAt(10, 10), 0, "nothing outside the radius");
  assert.equal(splashFractionAt(15, 10), 0);
});

test("anything caught in the blast takes a meaningful share of it", () => {
  // A grazing hit should still hurt, or explosives become a precision weapon.
  assert.ok(splashFractionAt(9.5, 10) >= 0.15);
});

test("one rocket hits everything standing close together", () => {
  const shot = { damage: 500, damageClass: DAMAGE_CLASS.explosiveLight, splash: { radiusMetres: 6 } };
  const soldiers = [{ id: "a" }, { id: "b" }, { id: "c" }];

  const results = resolveExplosion(shot, [
    { target: soldiers[0], distance: 0 },
    { target: soldiers[1], distance: 3 },
    { target: soldiers[2], distance: 20 },
  ]);

  assert.equal(results.length, 2, "the one twenty metres away is fine");
  assert.equal(results[0].amount, 500);
  assert.ok(results[1].amount > 0 && results[1].amount < 500);
});

test("a direct-fire weapon has no blast at all", () => {
  const shot = { damage: 35, damageClass: DAMAGE_CLASS.heavyMachineGun, splash: null };
  assert.deepEqual(resolveExplosion(shot, [{ target: {}, distance: 0 }]), []);
});

/* -------------------------------------------------- protection from walls */

test("rifle fire does not go through an intact wagon wall", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  const shot = { damage: 30, penetration: weaponSpec("enemy_rifle").penetration };

  const through = damageThroughWall(shot, wagon);
  assert.ok(through < 2, `${through.toFixed(2)} damage got through, which is near nothing`);
});

test("a tank shell goes through a wagon wall and finds the player", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  const shot = { damage: 180, penetration: weaponSpec("enemy_tank_cannon").penetration };

  assert.equal(damageThroughWall(shot, wagon), 180, "steel is no help against that");
});

test("armour on the wagon protects the player inside it too", () => {
  const bare = new Vehicle(VEHICLE_KIND.transport, 1);
  const armoured = new Vehicle(VEHICLE_KIND.transport, 1);
  armoured.fitArmour();

  const shot = { damage: 180, penetration: 0.95 };
  assert.ok(damageThroughWall(shot, armoured) < damageThroughWall(shot, bare));
});

test("a shot-up wagon protects worse than an intact one", () => {
  const wagon = new Vehicle(VEHICLE_KIND.transport, 1);
  const intact = wallProtectionOf(wagon);

  wagon.applyDamage({ amount: 500 });
  assert.ok(wallProtectionOf(wagon) < intact, "the holes are real");

  const shot = { damage: 30, penetration: 0.15 };
  assert.ok(damageThroughWall(shot, wagon) > 0);
});

/* ------------------------------------------------------ target selection */

test("enemies do not all lock onto the locomotive", () => {
  const { train } = createRunContext();
  for (let i = 0; i < 4; i += 1) train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  const candidates = buildTargetCandidates({ train, player: null });
  const rng = new Rng(1234);
  const counts = new Map();

  for (let i = 0; i < 2000; i += 1) {
    const pick = selectTarget(candidates, rng);
    counts.set(pick.target, (counts.get(pick.target) ?? 0) + 1);
  }

  const locomotiveShare = counts.get(train.locomotive) / 2000;
  assert.ok(locomotiveShare > 0.15, "the locomotive is still a priority");
  assert.ok(locomotiveShare < 0.55, `${locomotiveShare} - but not the only thing they shoot at`);

  for (const wagon of train.wagons) {
    assert.ok(counts.get(wagon) > 0, "every wagon draws some fire");
  }
});

test("a wagon that is shooting back draws more attention", () => {
  const { train } = createRunContext();
  const quiet = train.attach(new Vehicle(VEHICLE_KIND.combat, 2));
  const firing = train.attach(new Vehicle(VEHICLE_KIND.combat, 2));

  const candidates = buildTargetCandidates({
    train,
    firingVehicles: new Set([firing.id]),
  });

  const weightOf = (vehicle) => candidates.find((entry) => entry.target === vehicle).weight;
  assert.ok(weightOf(firing) > weightOf(quiet));
});

test("a player behind steel is a worse target than one in the open", () => {
  const { train } = createRunContext();
  const inside = buildTargetCandidates({ train, player: { isExposed: false, isDead: false } });
  const exposed = buildTargetCandidates({ train, player: { isExposed: true, isDead: false } });

  const playerWeight = (list) => list.find((entry) => entry.kind === "player").weight;
  assert.ok(playerWeight(exposed) > playerWeight(inside) * 3);
});

test("destroyed and unreachable vehicles are not targeted", () => {
  const { train } = createRunContext();
  const near = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));
  const far = train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  const candidates = buildTargetCandidates({
    train,
    canReach: (vehicle) => vehicle !== far,
  });

  assert.ok(candidates.some((entry) => entry.target === near));
  assert.ok(!candidates.some((entry) => entry.target === far));
});

test("enemies mostly stay on the target they picked", () => {
  const { train } = createRunContext();
  train.attach(new Vehicle(VEHICLE_KIND.transport, 1));

  const candidates = buildTargetCandidates({ train });
  const rng = new Rng(7);
  const first = chooseTarget(candidates, rng);

  let kept = 0;
  for (let i = 0; i < 200; i += 1) {
    if (chooseTarget(candidates, rng, first.target).target === first.target) kept += 1;
  }
  assert.ok(kept > 150, `kept the same target ${kept}/200 times - reads as intent`);
});

/* ---------------------------------------------------------------- Loader */

/** A train with a heavy turret at the back and shells stored at the front. */
function trainWithTurret() {
  const context = createRunContext({ money: 20000 });
  const storage = context.train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  const turretWagon = context.train.attach(new Vehicle(VEHICLE_KIND.combat, 4));
  context.mounts.sync();
  context.crew.hireLoader();
  storage.hold.add("heavy_shell", 3);
  return { ...context, storage, turretWagon };
}

test("the Loader walks the shell to the turret instead of teleporting it", () => {
  const context = trainWithTurret();
  const loader = context.crew.loader;
  const turret = context.mounts.weaponFor(context.turretWagon);

  assert.equal(turret.roundsInMagazine, 0, "a new turret arrives empty");

  // He has to walk to the shells, pick one up, walk back and load it.
  simulate(2, (delta) => context.crew.update(delta));
  assert.equal(turret.roundsInMagazine, 0, "two seconds in, nothing has happened yet");

  simulate(40, (delta) => context.crew.update(delta));
  assert.equal(turret.roundsInMagazine, 1, "one shell, seated by hand");
  assert.equal(context.storage.hold.quantityOf("heavy_shell"), 2);
});

test("the Loader carries exactly one shell at a time", () => {
  const context = trainWithTurret();
  const loader = context.crew.loader;

  let sawCarrying = false;
  simulate(40, (delta) => {
    context.crew.update(delta);
    if (loader.isCarryingShell) sawCarrying = true;
  });

  assert.ok(sawCarrying, "he was seen carrying one");
  assert.equal(LOADER.carryCapacity, 1);
});

test("the Loader takes a believable amount of time, not two seconds", () => {
  const context = trainWithTurret();
  const turret = context.mounts.weaponFor(context.turretWagon);

  let seconds = 0;
  while (turret.roundsInMagazine === 0 && seconds < 120) {
    context.crew.update(0.1);
    seconds += 0.1;
  }

  assert.ok(seconds > LOADER.pickUpSeconds + LOADER.loadSeconds, `took ${seconds.toFixed(1)} s`);
  assert.ok(seconds < 60, "but he does get there");
});

test("the Loader cannot reach ammunition that left with a destroyed wagon", () => {
  const context = trainWithTurret();
  const loader = context.crew.loader;

  // Blow up the wagon holding the shells. The turret behind it goes too.
  context.train.damageVehicle(context.storage, { amount: 99999 });
  context.mounts.sync();

  simulate(20, (delta) => context.crew.update(delta));
  assert.equal(context.train.wagonCount, 0, "everything behind the break is gone");
  assert.equal(loader.state, LOADER_STATE.idle, "there is no turret left to serve");
});

test("with the shells gone the Loader reports that he cannot get to them", () => {
  const context = trainWithTurret();
  const loader = context.crew.loader;

  context.storage.hold.remove("heavy_shell", 3);
  simulate(5, (delta) => context.crew.update(delta));

  assert.equal(loader.state, LOADER_STATE.noAccess);
  assert.equal(loader.statusKey, "BLUEPRINT_LOADER_NO_ACCESS");
});

test("the Loader serves the turret he is assigned to", () => {
  const context = createRunContext({ money: 20000 });
  const storage = context.train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  const first = context.train.attach(new Vehicle(VEHICLE_KIND.combat, 4));
  const second = context.train.attach(new Vehicle(VEHICLE_KIND.combat, 4));
  context.mounts.sync();
  context.crew.hireLoader();
  storage.hold.add("heavy_shell", 4);

  context.crew.loader.setAssignment(second.id);
  simulate(60, (delta) => context.crew.update(delta));

  assert.equal(context.mounts.weaponFor(second).roundsInMagazine, 1, "the assigned turret");
  assert.equal(context.mounts.weaponFor(first).roundsInMagazine, 0, "not the other one");
});

test("in automatic mode the Loader works through the turrets that need shells", () => {
  const context = createRunContext({ money: 20000 });
  const storage = context.train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  const first = context.train.attach(new Vehicle(VEHICLE_KIND.combat, 4));
  const second = context.train.attach(new Vehicle(VEHICLE_KIND.combat, 4));
  context.mounts.sync();
  context.crew.hireLoader();
  storage.hold.add("heavy_shell", 4);

  context.crew.loader.setAssignment(LOADER_ASSIGNMENT_AUTOMATIC);
  simulate(200, (delta) => context.crew.update(delta));

  assert.equal(context.mounts.weaponFor(first).roundsInMagazine, 1);
  assert.equal(context.mounts.weaponFor(second).roundsInMagazine, 1, "one after the other");
});

test("the Loader only serves heavy turrets", () => {
  const context = createRunContext({ money: 20000 });
  const storage = context.train.attach(new Vehicle(VEHICLE_KIND.transport, 2));
  const machineGunWagon = context.train.attach(new Vehicle(VEHICLE_KIND.combat, 2));
  context.mounts.sync();
  context.crew.hireLoader();
  storage.hold.add("rifle_ammo", 5);
  storage.hold.add("heavy_shell", 2);

  simulate(60, (delta) => context.crew.update(delta));

  assert.equal(context.mounts.weaponFor(machineGunWagon).roundsInMagazine, 0, "not his job");
  assert.equal(storage.hold.quantityOf("heavy_shell"), 2, "and he took no shells for it");
});

/* ---------------------------------------------------------------- mounts */

test("combat wagon levels carry the weapons the design lists", () => {
  assert.equal(new Vehicle(VEHICLE_KIND.combat, 1).mount, MOUNT_TYPE.none);
  assert.equal(new Vehicle(VEHICLE_KIND.combat, 2).mount, MOUNT_TYPE.machineGun);
  assert.equal(new Vehicle(VEHICLE_KIND.combat, 3).mount, MOUNT_TYPE.rocketLauncher);
  assert.equal(new Vehicle(VEHICLE_KIND.combat, 4).mount, MOUNT_TYPE.heavyCannon);
});

test("upgrading a combat wagon swaps its weapon and leaves it empty", () => {
  const context = createRunContext({ money: 20000 });
  const wagon = context.workshop.buyVehicle(VEHICLE_KIND.combat).vehicle;
  context.mounts.sync();
  assert.equal(context.mounts.weaponFor(wagon), null, "level 1 has no weapon");

  context.workshop.upgradeVehicle(wagon);
  context.mounts.sync();
  assert.equal(context.mounts.weaponFor(wagon).weaponId, MOUNT_TYPE.machineGun);
  assert.equal(context.mounts.weaponFor(wagon).roundsInMagazine, 0, "and no free ammunition");
});

test("a destroyed combat wagon takes its weapon off the register", () => {
  const context = createRunContext({ money: 20000 });
  const wagon = context.workshop.buyVehicle(VEHICLE_KIND.combat).vehicle;
  context.workshop.upgradeVehicle(wagon);
  context.mounts.sync();
  assert.ok(context.mounts.weaponFor(wagon));

  context.train.damageVehicle(wagon, { amount: 99999 });
  context.mounts.sync();
  assert.equal(context.mounts.weaponFor(wagon), null);
  assert.deepEqual(context.mounts.heavyTurrets(), []);
});
