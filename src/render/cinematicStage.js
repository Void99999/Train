/**
 * LAST TRAIN - props for the opening cinematic.
 *
 * The helicopter, the battlefield, the railway shelter and the explosion
 * effect. All original designs; nothing here is modelled on a real machine or
 * on another game's assets.
 *
 * Everything is built once when the stage is created and then shown or hidden,
 * rather than being constructed and thrown away per shot. Building a hundred
 * rubble blocks in the middle of a cut would drop frames exactly where the
 * player is supposed to be watching something.
 *
 * The battlefield deliberately occupies the same space as the railway. The
 * world hides its track and scenery while the battlefield is up, so the two
 * never have to be kept apart in space.
 */

import * as THREE from "../../vendor/three/three.module.js";
import { metalMaterial, lampMaterial, glassMaterial } from "./materials.js";
import { Rng } from "../core/rng.js";

function mesh(geometry, material, { cast = true } = {}) {
  const node = new THREE.Mesh(geometry, material);
  node.castShadow = cast;
  node.receiveShadow = true;
  return node;
}

/**
 * A single burst: flash, fireball, smoke column and tumbling debris.
 * Reused rather than reallocated - the intro sets off several.
 */
class Explosion {
  #group = new THREE.Group();
  #fireball;
  #smoke;
  #light;
  #debris = [];
  #elapsed = 0;
  #duration = 0;
  #active = false;

  constructor(rng) {
    this.#fireball = mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffb347,
        emissive: 0xff7519,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 1,
      }),
      { cast: false },
    );
    this.#group.add(this.#fireball);

    this.#smoke = mesh(
      new THREE.SphereGeometry(1, 14, 10),
      new THREE.MeshStandardMaterial({
        color: 0x1c1a18,
        roughness: 1,
        transparent: true,
        opacity: 0.9,
      }),
      { cast: false },
    );
    this.#group.add(this.#smoke);

    this.#light = new THREE.PointLight(0xff8a33, 0, 90, 2);
    this.#group.add(this.#light);

    const debrisMaterial = metalMaterial({ colour: 0x2c2a27, wear: 0.9, seed: 640, repeat: 1 });
    for (let i = 0; i < 26; i += 1) {
      const size = rng.range(0.18, 0.62);
      const piece = mesh(
        new THREE.BoxGeometry(size, size * rng.range(0.4, 1.2), size * rng.range(0.5, 1.4)),
        debrisMaterial,
      );
      piece.userData.velocity = new THREE.Vector3();
      piece.userData.spin = new THREE.Vector3();
      this.#group.add(piece);
      this.#debris.push(piece);
    }

    this.#group.visible = false;
  }

  get object() {
    return this.#group;
  }

  get isActive() {
    return this.#active;
  }

  /** Sets a burst going at a point, in world space. */
  fire(position, { scale = 1, duration = 6, rng }) {
    this.#group.position.copy(position);
    this.#group.visible = true;
    this.#active = true;
    this.#elapsed = 0;
    this.#duration = duration;
    this.scale = scale;

    for (const piece of this.#debris) {
      piece.position.set(0, 0, 0);
      piece.visible = true;
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(6, 20) * scale;
      piece.userData.velocity.set(
        Math.cos(angle) * speed * rng.range(0.3, 1),
        rng.range(7, 18) * scale,
        Math.sin(angle) * speed * rng.range(0.3, 1),
      );
      piece.userData.spin.set(rng.range(-6, 6), rng.range(-6, 6), rng.range(-6, 6));
    }
  }

  update(delta) {
    if (!this.#active) return;
    this.#elapsed += delta;
    const t = this.#elapsed / this.#duration;

    if (t >= 1) {
      this.#active = false;
      this.#group.visible = false;
      return;
    }

    const scale = this.scale;

    // Fireball: fast expansion, fast fade. It is the flash, not the smoke.
    const fireT = Math.min(1, this.#elapsed / 0.9);
    this.#fireball.scale.setScalar((1.2 + fireT * 5.5) * scale);
    this.#fireball.material.opacity = Math.max(0, 1 - fireT * 1.15);
    this.#fireball.material.emissiveIntensity = 4 * (1 - fireT);
    this.#fireball.visible = fireT < 1;

    // Smoke: slower, keeps rising and spreading long after the fire is out.
    this.#smoke.scale.setScalar((1.6 + t * 9) * scale);
    this.#smoke.position.y = t * 9 * scale;
    this.#smoke.material.opacity = Math.max(0, 0.85 * (1 - t));

    this.#light.intensity = Math.max(0, 900 * scale * (1 - Math.min(1, this.#elapsed / 1.4)));

    for (const piece of this.#debris) {
      const velocity = piece.userData.velocity;
      velocity.y -= 22 * delta;
      piece.position.addScaledVector(velocity, delta);
      piece.rotation.x += piece.userData.spin.x * delta;
      piece.rotation.y += piece.userData.spin.y * delta;
      piece.rotation.z += piece.userData.spin.z * delta;

      // Debris settles on the ground rather than falling through it.
      if (piece.position.y < 0.15) {
        piece.position.y = 0.15;
        velocity.set(0, 0, 0);
      }
    }
  }
}

export class CinematicStage {
  #scene;
  #rng = new Rng(20260810);

  openingTrainDebris;
  helicopter;
  battlefield;
  shelter;
  doorGun;
  hand;

  #explosions = [];
  #fires = [];
  #rotorDisc;
  #tailRotor;

  constructor({ scene }) {
    this.#scene = scene;

    this.#buildBattlefield();
    this.#buildHelicopter();
    this.#buildShelter();
    this.#buildDoorGun();
    this.#buildHand();

    for (let i = 0; i < 3; i += 1) {
      const explosion = new Explosion(this.#rng);
      this.#scene.add(explosion.object);
      this.#explosions.push(explosion);
    }
  }

  /* ------------------------------------------------------------ battlefield */

  #buildBattlefield() {
    const group = new THREE.Group();
    group.visible = false;

    const ground = mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x241f18, roughness: 1, metalness: 0 }),
      { cast: false },
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    group.add(ground);

    const rubbleMaterial = metalMaterial({ colour: 0x3a352e, wear: 0.9, seed: 700, repeat: 1 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x4a463f, roughness: 0.95 });

    // Broken structures and rubble, thinning out towards the far end so the
    // player crawls out of the fighting rather than through it.
    for (let i = 0; i < 90; i += 1) {
      const z = this.#rng.range(-90, 70);
      const density = 1 - (z + 90) / 170;
      if (this.#rng.next() > density * 0.9 + 0.15) continue;

      const width = this.#rng.range(0.6, 3.4);
      const height = this.#rng.range(0.4, 4.5);
      const block = mesh(
        new THREE.BoxGeometry(width, height, this.#rng.range(0.6, 3)),
        this.#rng.chance(0.5) ? rubbleMaterial : concrete,
      );
      block.position.set(this.#rng.range(-45, 45), height / 2, z);
      block.rotation.y = this.#rng.range(0, Math.PI);
      block.rotation.z = this.#rng.range(-0.25, 0.25);
      group.add(block);
    }

    // Shell craters.
    for (let i = 0; i < 22; i += 1) {
      const crater = mesh(
        new THREE.CircleGeometry(this.#rng.range(1.2, 4), 12),
        new THREE.MeshStandardMaterial({ color: 0x15120e, roughness: 1 }),
        { cast: false },
      );
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(this.#rng.range(-50, 50), 0.01, this.#rng.range(-90, 60));
      group.add(crater);
    }

    // Burnt-out vehicles: suggestions, not models.
    for (let i = 0; i < 7; i += 1) {
      const wreck = new THREE.Group();
      const hull = mesh(new THREE.BoxGeometry(4.6, 1.5, 2.3), rubbleMaterial);
      hull.position.y = 0.9;
      wreck.add(hull);
      const turret = mesh(new THREE.BoxGeometry(2, 0.9, 1.8), rubbleMaterial);
      turret.position.y = 2;
      wreck.add(turret);
      wreck.position.set(this.#rng.range(-40, 40), 0, this.#rng.range(-80, 30));
      wreck.rotation.y = this.#rng.range(0, Math.PI * 2);
      group.add(wreck);
    }

    // Fires. Each is an emissive core with a light, and each flickers on its
    // own rhythm so the field does not pulse in unison.
    for (let i = 0; i < 16; i += 1) {
      const fire = new THREE.Group();
      const core = mesh(
        new THREE.SphereGeometry(this.#rng.range(0.4, 1.1), 8, 6),
        lampMaterial(0xff7a2a, 3),
        { cast: false },
      );
      core.position.y = 0.5;
      fire.add(core);

      const light = new THREE.PointLight(0xff8330, 60, 26, 2);
      light.position.y = 1.2;
      fire.add(light);

      fire.position.set(this.#rng.range(-48, 48), 0, this.#rng.range(-90, 55));
      fire.userData.phase = this.#rng.range(0, Math.PI * 2);
      fire.userData.baseIntensity = this.#rng.range(35, 75);
      fire.userData.light = light;
      fire.userData.core = core;
      group.add(fire);
      this.#fires.push(fire);
    }

    this.battlefield = group;
    this.#scene.add(group);
  }

  /* ------------------------------------------------------------- helicopter */

  /**
   * Original design: a squat utility helicopter with a boxy cabin, a wide
   * sliding door, a boom tail and a four-blade rotor.
   */
  #buildHelicopter() {
    const group = new THREE.Group();
    group.visible = false;

    const body = metalMaterial({ colour: 0x2f3a33, wear: 0.5, seed: 710, repeat: 2 });
    const dark = metalMaterial({ colour: 0x22262a, wear: 0.6, seed: 711, repeat: 1 });

    const cabin = mesh(new THREE.BoxGeometry(2.6, 2.2, 5.4), body);
    cabin.position.y = 0;
    group.add(cabin);

    const nose = mesh(new THREE.SphereGeometry(1.3, 14, 10), body);
    nose.scale.set(1, 0.85, 1.1);
    nose.position.set(0, -0.1, 3);
    group.add(nose);

    const windscreen = mesh(new THREE.SphereGeometry(1.15, 14, 10), glassMaterial(), { cast: false });
    windscreen.scale.set(1, 0.8, 1);
    windscreen.position.set(0, 0.15, 3.1);
    group.add(windscreen);

    // Open sliding door on the left, which is where the protagonist is.
    const doorFrame = mesh(new THREE.BoxGeometry(0.12, 2.2, 0.18), dark);
    doorFrame.position.set(-1.3, 0, 0.6);
    group.add(doorFrame);
    const doorFrameRear = doorFrame.clone();
    doorFrameRear.position.z = -1.9;
    group.add(doorFrameRear);

    const boom = mesh(new THREE.CylinderGeometry(0.32, 0.5, 5.2, 10), body);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.35, -5);
    group.add(boom);

    const fin = mesh(new THREE.BoxGeometry(0.12, 1.5, 1.1), body);
    fin.position.set(0, 1.1, -7.2);
    group.add(fin);

    const stabiliser = mesh(new THREE.BoxGeometry(2.6, 0.1, 0.7), body);
    stabiliser.position.set(0, 0.5, -6.9);
    group.add(stabiliser);

    // Rotor mast and disc.
    const mast = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 8), dark);
    mast.position.y = 1.5;
    group.add(mast);

    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const blade = mesh(new THREE.BoxGeometry(0.34, 0.06, 7.4), dark, { cast: false });
      blade.rotation.y = (i * Math.PI) / 2;
      rotor.add(blade);
    }
    // A translucent disc sells the blur that four blades at speed cannot.
    const disc = mesh(
      new THREE.CircleGeometry(7.6, 28),
      new THREE.MeshStandardMaterial({
        color: 0x0c0f11,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      { cast: false },
    );
    disc.rotation.x = -Math.PI / 2;
    rotor.add(disc);
    rotor.position.y = 1.95;
    group.add(rotor);
    this.#rotorDisc = rotor;

    const tailRotor = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const blade = mesh(new THREE.BoxGeometry(0.12, 1.7, 0.05), dark, { cast: false });
      blade.rotation.z = (i * Math.PI * 2) / 3;
      tailRotor.add(blade);
    }
    tailRotor.position.set(0.22, 1.1, -7.2);
    group.add(tailRotor);
    this.#tailRotor = tailRotor;

    for (const side of [-1, 1]) {
      const skid = mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 8), dark);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(side * 1.15, -1.7, 0.4);
      group.add(skid);

      for (const z of [1.4, -0.9]) {
        const strut = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), dark);
        strut.position.set(side * 1.15, -1.15, z);
        group.add(strut);
      }
    }

    // Damage effects, switched on when the helicopter is hit.
    const smoke = mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x14120f, transparent: true, opacity: 0 }),
      { cast: false },
    );
    smoke.position.set(0, 0.6, -5.5);
    smoke.name = "engine-smoke";
    group.add(smoke);
    this.helicopterSmoke = smoke;

    const engineFire = mesh(
      new THREE.SphereGeometry(0.7, 10, 8),
      lampMaterial(0xff6a1e, 0),
      { cast: false },
    );
    engineFire.position.set(0, 0.7, -4.6);
    group.add(engineFire);
    this.helicopterFire = engineFire;

    this.helicopter = group;
    this.#scene.add(group);
  }

  /** The weapon the protagonist is operating, seen from behind in first person. */
  #buildDoorGun() {
    const group = new THREE.Group();
    group.visible = false;

    const dark = metalMaterial({ colour: 0x1f2325, wear: 0.6, seed: 720, repeat: 1 });

    const receiver = mesh(new THREE.BoxGeometry(0.22, 0.24, 1.0), dark);
    group.add(receiver);

    const barrel = mesh(new THREE.CylinderGeometry(0.055, 0.06, 1.5, 10), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.2;
    group.add(barrel);

    // Perforated jacket, suggested with rings rather than modelled holes.
    for (let i = 0; i < 6; i += 1) {
      const ring = mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 12), dark, { cast: false });
      ring.rotation.y = Math.PI / 2;
      ring.position.z = 0.75 + i * 0.18;
      group.add(ring);
    }

    const mount = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), dark);
    mount.position.y = -0.55;
    group.add(mount);

    const grip = mesh(new THREE.BoxGeometry(0.1, 0.34, 0.12), dark);
    grip.position.set(0, -0.24, -0.5);
    group.add(grip);

    const ammoBox = mesh(new THREE.BoxGeometry(0.34, 0.3, 0.42), dark);
    ammoBox.position.set(0.26, -0.1, -0.1);
    group.add(ammoBox);

    const flash = mesh(new THREE.SphereGeometry(0.24, 8, 6), lampMaterial(0xffd08a, 0), {
      cast: false,
    });
    flash.position.z = 2;
    group.add(flash);
    this.muzzleFlash = flash;

    const light = new THREE.PointLight(0xffc070, 0, 18, 2);
    light.position.z = 2;
    group.add(light);
    this.muzzleLight = light;

    this.doorGun = group;
    this.#scene.add(group);
  }

  /* ---------------------------------------------------------------- shelter */

  /** The railway building the protagonist crawls towards. */
  #buildShelter() {
    const group = new THREE.Group();
    group.visible = false;

    const brick = new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.95 });
    const trim = metalMaterial({ colour: 0x3b3630, wear: 0.8, seed: 730, repeat: 1 });

    const walls = mesh(new THREE.BoxGeometry(9, 4.2, 6), brick);
    walls.position.y = 2.1;
    group.add(walls);

    const roof = mesh(new THREE.BoxGeometry(9.8, 0.35, 6.8), trim);
    roof.position.y = 4.3;
    group.add(roof);

    // A lit doorway - the one warm thing in the whole act.
    const doorway = mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), lampMaterial(0xffc880, 1.4), {
      cast: false,
    });
    doorway.position.set(-1.2, 1.2, 3.05);
    group.add(doorway);

    const doorLight = new THREE.PointLight(0xffb765, 55, 22, 2);
    doorLight.position.set(-1.2, 2.2, 4);
    group.add(doorLight);

    for (const x of [1.8, 3.2]) {
      const window = mesh(new THREE.BoxGeometry(0.9, 1.0, 0.15), glassMaterial(), { cast: false });
      window.position.set(x, 2.4, 3.02);
      group.add(window);
    }

    // A water tower and a couple of posts, so it reads as a railway facility.
    const tower = mesh(new THREE.CylinderGeometry(1.3, 1.5, 2.6, 10), trim);
    tower.position.set(7, 5.4, -2);
    group.add(tower);

    for (const side of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 6), trim);
      leg.position.set(7 + side * 0.9, 2.1, -2);
      group.add(leg);
    }

    this.shelter = group;
    this.#scene.add(group);
  }

  /**
   * A gloved hand and forearm, for the shot where the protagonist selects
   * full power. Deliberately simple: it is on screen for two seconds.
   */
  #buildHand() {
    const group = new THREE.Group();
    group.visible = false;

    const glove = new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: 0.9 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x4a4f3f, roughness: 0.95 });

    const forearm = mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.5, 8), sleeve);
    forearm.rotation.x = Math.PI / 2.4;
    forearm.position.set(0, -0.16, -0.22);
    group.add(forearm);

    const palm = mesh(new THREE.BoxGeometry(0.1, 0.055, 0.14), glove);
    group.add(palm);

    // One extended finger, which is what actually touches the notch.
    const finger = mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 6), glove);
    finger.rotation.x = Math.PI / 2;
    finger.position.set(0, 0, 0.11);
    group.add(finger);

    this.hand = group;
    this.#scene.add(group);
  }

  /* ----------------------------------------------------------------- effects */

  /** Sets off the next free explosion at a point. */
  explodeAt(position, options = {}) {
    const explosion = this.#explosions.find((entry) => !entry.isActive) ?? this.#explosions[0];
    explosion.fire(position, { rng: this.#rng, ...options });
    return explosion;
  }

  setHelicopterDamage(amount) {
    this.helicopterSmoke.material.opacity = Math.min(0.85, amount * 0.85);
    this.helicopterSmoke.scale.setScalar(1 + amount * 2.5);
    this.helicopterFire.material.emissiveIntensity = amount * 3;
  }

  setMuzzleFlash(amount) {
    this.muzzleFlash.material.emissiveIntensity = amount * 6;
    this.muzzleFlash.visible = amount > 0.02;
    this.muzzleLight.intensity = amount * 40;
  }

  /** Rotor speed, 0-1. Drops as the engine dies. */
  setRotorSpeed(fraction) {
    this.rotorSpeed = fraction;
  }

  update(delta, elapsed) {
    for (const explosion of this.#explosions) explosion.update(delta);

    const speed = this.rotorSpeed ?? 1;
    if (this.#rotorDisc) this.#rotorDisc.rotation.y += delta * 28 * speed;
    if (this.#tailRotor) this.#tailRotor.rotation.z += delta * 40 * speed;

    // Fires flicker independently.
    for (const fire of this.#fires) {
      const flicker = 0.75 + Math.sin(elapsed * 9 + fire.userData.phase) * 0.15 +
        Math.sin(elapsed * 23 + fire.userData.phase * 2) * 0.1;
      fire.userData.light.intensity = fire.userData.baseIntensity * flicker;
      fire.userData.core.material.emissiveIntensity = 2.4 * flicker;
    }
  }

  setVisible(name, visible) {
    const target = this[name];
    if (target) target.visible = visible;
  }

  /** Hides every cinematic prop. Called when the intro ends, however it ends. */
  hideAll() {
    for (const name of ["helicopter", "battlefield", "shelter", "doorGun", "hand"]) {
      this.setVisible(name, false);
    }
  }

  dispose() {
    for (const name of ["helicopter", "battlefield", "shelter", "doorGun", "hand"]) {
      const target = this[name];
      if (!target) continue;
      this.#scene.remove(target);
      target.traverse((node) => {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material?.dispose();
      });
    }
  }
}
