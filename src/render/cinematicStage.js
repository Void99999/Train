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
  #gunCradle;
  #gunRecoil;
  #gunnerEye;
  #gunnerAim;
  #scratch = new THREE.Vector3();
  #scratchB = new THREE.Vector3();
  #scratchC = new THREE.Vector3();

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

  /**
   * The battlefield.
   *
   * Still a blockout - these are placeholder shapes, not final art - but the
   * shapes now describe something. Ruined buildings have standing walls with
   * window openings and collapsed corners rather than being single boxes;
   * there are trenches, revetments, wrecked vehicles, craters with raised
   * lips, and scattered structural debris.
   *
   * Two rules the previous version broke:
   *
   *  - Nothing is placed in the corridor the protagonist crawls along. He
   *    used to drag himself straight through solid blocks.
   *  - Fire is not a glowing ball. Each fire is a cluster of flickering
   *    tapered flames over a charred patch, lighting what is around it.
   */
  #buildBattlefield() {
    const group = new THREE.Group();
    group.visible = false;

    const ground = mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x2a251d, roughness: 1, metalness: 0 }),
      { cast: false },
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    group.add(ground);

    const rubbleMaterial = metalMaterial({ colour: 0x3a352e, wear: 0.9, seed: 700, repeat: 1 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.95 });
    const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x3c3833, roughness: 0.98 });
    const earth = new THREE.MeshStandardMaterial({ color: 0x231e17, roughness: 1 });

    /**
     * The crawl corridor. Nothing may be placed inside it.
     * The protagonist drags himself up the line of the track from far behind
     * the shelter, so the corridor is a lane either side of x = 0.
     */
    const inCrawlCorridor = (x, z, radius = 0) =>
      Math.abs(x) < 5.5 + radius && z > -70 && z < 30;

    /** Places a prop only if it stays out of the corridor. */
    const place = (object, x, z, radius = 1.5) => {
      if (inCrawlCorridor(x, z, radius)) return false;
      object.position.set(x, object.position.y, z);
      group.add(object);
      return true;
    };

    /* ------------------------------------------------------- ruined buildings */

    for (let i = 0; i < 26; i += 1) {
      const x = this.#rng.range(-70, 70);
      const z = this.#rng.range(-95, 55);
      if (inCrawlCorridor(x, z, 8)) continue;

      const ruin = new THREE.Group();
      const width = this.#rng.range(7, 18);
      const depth = this.#rng.range(6, 14);
      const height = this.#rng.range(3.5, 9);

      // Three standing walls and a collapsed fourth: the classic shell.
      const wallSpecs = [
        [-width / 2, 0, 0.5, depth, 1],
        [width / 2, 0, 0.5, depth, this.#rng.range(0.35, 1)],
        [0, -depth / 2, width, 0.5, this.#rng.range(0.5, 1)],
      ];

      for (const [dx, dz, sw, sd, heightScale] of wallSpecs) {
        const wallHeight = height * heightScale;
        const wall = mesh(
          new THREE.BoxGeometry(sw, wallHeight, sd),
          this.#rng.chance(0.5) ? concrete : darkConcrete,
        );
        wall.position.set(dx, wallHeight / 2, dz);
        ruin.add(wall);

        // Window openings, suggested by dark recesses in the wall face.
        const openings = Math.floor(Math.max(sw, sd) / 3);
        for (let w = 0; w < openings; w += 1) {
          if (wallHeight < 2.4) break;
          const hole = mesh(
            new THREE.BoxGeometry(
              sw > sd ? 1.1 : 0.6,
              1.1,
              sd > sw ? 1.1 : 0.6,
            ),
            earth,
            { cast: false },
          );
          hole.position.set(
            dx + (sw > sd ? -sw / 2 + 1.5 + w * 3 : 0),
            1.6,
            dz + (sd > sw ? -sd / 2 + 1.5 + w * 3 : 0),
          );
          ruin.add(hole);
        }
      }

      // The collapsed corner: a heap of slabs where the fourth wall was.
      for (let piece = 0; piece < 6; piece += 1) {
        const slab = mesh(
          new THREE.BoxGeometry(
            this.#rng.range(1.5, 3.5),
            this.#rng.range(0.2, 0.5),
            this.#rng.range(1.5, 3),
          ),
          darkConcrete,
        );
        slab.position.set(
          width / 2 - this.#rng.range(0, 4),
          this.#rng.range(0.2, 1.6),
          depth / 2 - this.#rng.range(0, 4),
        );
        slab.rotation.set(
          this.#rng.range(-0.5, 0.5),
          this.#rng.range(0, Math.PI),
          this.#rng.range(-0.5, 0.5),
        );
        ruin.add(slab);
      }

      ruin.rotation.y = this.#rng.range(0, Math.PI * 2);
      place(ruin, x, z, 10);
    }

    /* --------------------------------------------------------------- trenches */

    for (let i = 0; i < 8; i += 1) {
      const x = this.#rng.range(-60, 60);
      const z = this.#rng.range(-90, 40);
      if (inCrawlCorridor(x, z, 6)) continue;

      const trench = new THREE.Group();
      const length = this.#rng.range(10, 26);

      // The cut itself, and the spoil piled along its lip.
      const cut = mesh(new THREE.BoxGeometry(2.4, 1.6, length), earth, { cast: false });
      cut.position.y = -0.7;
      trench.add(cut);

      for (const side of [-1, 1]) {
        const parapet = mesh(new THREE.BoxGeometry(1.1, 0.7, length), earth);
        parapet.position.set(side * 1.7, 0.3, 0);
        trench.add(parapet);
      }

      // Revetment boards holding the walls up.
      for (let post = 0; post < Math.floor(length / 2.5); post += 1) {
        const board = mesh(
          new THREE.BoxGeometry(0.12, 1.2, 0.3),
          rubbleMaterial,
        );
        board.position.set(-1.2, 0.1, -length / 2 + 1 + post * 2.5);
        trench.add(board);
      }

      trench.rotation.y = this.#rng.range(-0.5, 0.5);
      place(trench, x, z, 8);
    }

    /* ---------------------------------------------------------------- craters */

    for (let i = 0; i < 30; i += 1) {
      const x = this.#rng.range(-75, 75);
      const z = this.#rng.range(-95, 50);
      const radius = this.#rng.range(1.6, 5);

      const crater = new THREE.Group();
      const hole = mesh(new THREE.CircleGeometry(radius, 14), earth, { cast: false });
      hole.rotation.x = -Math.PI / 2;
      hole.position.y = 0.015;
      crater.add(hole);

      // A raised lip of thrown earth, which is what makes it read as a crater
      // rather than a stain on the ground.
      const lip = mesh(
        new THREE.TorusGeometry(radius, radius * 0.16, 5, 14),
        earth,
        { cast: false },
      );
      lip.rotation.x = -Math.PI / 2;
      lip.position.y = 0.05;
      crater.add(lip);

      // Craters are allowed in the corridor - they are flat and he crawls
      // through them, which is the right image.
      crater.position.set(x, 0, z);
      group.add(crater);
    }

    /* --------------------------------------------------------------- wreckage */

    for (let i = 0; i < 10; i += 1) {
      const x = this.#rng.range(-55, 55);
      const z = this.#rng.range(-85, 35);
      if (inCrawlCorridor(x, z, 5)) continue;

      const wreck = new THREE.Group();
      const hull = mesh(new THREE.BoxGeometry(5.2, 1.3, 2.4), rubbleMaterial);
      hull.position.y = 0.9;
      wreck.add(hull);

      const glacis = mesh(new THREE.BoxGeometry(2.2, 1.0, 2.3), rubbleMaterial);
      glacis.rotation.x = 0.5;
      glacis.position.set(2.0, 0.9, 0);
      wreck.add(glacis);

      if (this.#rng.chance(0.6)) {
        const turret = mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.8, 6), rubbleMaterial);
        turret.position.set(-0.4, 1.9, 0);
        turret.rotation.y = this.#rng.range(0, Math.PI);
        wreck.add(turret);

        const barrel = mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.4, 8), rubbleMaterial);
        barrel.rotation.z = Math.PI / 2 - 0.25;
        barrel.position.set(1.2, 2.4, 0);
        wreck.add(barrel);
      }

      // Road wheels, some off their mounts.
      for (let w = 0; w < 5; w += 1) {
        const wheel = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 10), rubbleMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(-2.2 + w * 1.1, 0.45, this.#rng.chance(0.85) ? 1.2 : 2.6);
        wreck.add(wheel);
      }

      wreck.rotation.y = this.#rng.range(0, Math.PI * 2);
      wreck.rotation.z = this.#rng.range(-0.12, 0.12);
      place(wreck, x, z, 5);
    }

    /* ------------------------------------------------------ scattered debris */

    for (let i = 0; i < 160; i += 1) {
      const x = this.#rng.range(-80, 80);
      const z = this.#rng.range(-95, 55);

      // Small debris is allowed close to the corridor but not in the lane
      // itself, so the crawl has texture beside it without obstruction.
      if (inCrawlCorridor(x, z, -2.5)) continue;

      const size = this.#rng.range(0.15, 0.8);
      const piece = mesh(
        new THREE.BoxGeometry(size, size * this.#rng.range(0.15, 0.5), size * this.#rng.range(0.6, 2)),
        this.#rng.chance(0.5) ? darkConcrete : rubbleMaterial,
      );
      piece.position.set(x, size * 0.15, z);
      piece.rotation.set(
        this.#rng.range(-0.3, 0.3),
        this.#rng.range(0, Math.PI),
        this.#rng.range(-0.3, 0.3),
      );
      group.add(piece);
    }

    // Bent reinforcing bar and structural steel sticking out of the ground.
    for (let i = 0; i < 40; i += 1) {
      const x = this.#rng.range(-70, 70);
      const z = this.#rng.range(-90, 45);
      if (inCrawlCorridor(x, z, 1)) continue;

      const bar = mesh(
        new THREE.CylinderGeometry(0.05, 0.05, this.#rng.range(1.2, 3.5), 5),
        rubbleMaterial,
      );
      bar.position.set(x, 0.8, z);
      bar.rotation.set(this.#rng.range(-0.8, 0.8), 0, this.#rng.range(-0.8, 0.8));
      group.add(bar);
    }

    /* ------------------------------------------------------------------ fire */

    // Each fire is a cluster of tapered flames over a scorched patch, not a
    // glowing sphere. The cones flicker independently in height and tilt.
    for (let i = 0; i < 18; i += 1) {
      const x = this.#rng.range(-60, 60);
      const z = this.#rng.range(-90, 45);
      if (inCrawlCorridor(x, z, 3)) continue;

      const fire = new THREE.Group();

      const scorch = mesh(
        new THREE.CircleGeometry(this.#rng.range(1.2, 2.6), 10),
        new THREE.MeshStandardMaterial({ color: 0x0e0b08, roughness: 1 }),
        { cast: false },
      );
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.y = 0.02;
      fire.add(scorch);

      const flames = [];
      const flameCount = this.#rng.integer(3, 5);
      for (let f = 0; f < flameCount; f += 1) {
        const height = this.#rng.range(0.8, 2.2);
        const flame = mesh(
          new THREE.ConeGeometry(this.#rng.range(0.22, 0.5), height, 6),
          new THREE.MeshStandardMaterial({
            color: 0xff8a2a,
            emissive: 0xff6a10,
            emissiveIntensity: 2.6,
            transparent: true,
            opacity: 0.82,
          }),
          { cast: false },
        );
        flame.position.set(
          this.#rng.range(-0.7, 0.7),
          height / 2,
          this.#rng.range(-0.7, 0.7),
        );
        flame.userData.baseHeight = height;
        flame.userData.phase = this.#rng.range(0, Math.PI * 2);
        fire.add(flame);
        flames.push(flame);
      }

      const light = new THREE.PointLight(0xff7a28, 90, 30, 2);
      light.position.y = 1.4;
      fire.add(light);

      fire.position.set(x, 0, z);
      fire.userData.phase = this.#rng.range(0, Math.PI * 2);
      fire.userData.baseIntensity = this.#rng.range(60, 120);
      fire.userData.light = light;
      fire.userData.flames = flames;
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

  /**
   * The weapon the protagonist is operating, seen from behind in first person.
   *
   * The whole assembly hangs off the helicopter, not off the camera. That is
   * the difference between a weapon bolted into a doorway and one that floats
   * beside the aircraft: a pintle gun banks when the aircraft banks, drops
   * when it drops, and cannot drift, because it is simply part of it.
   *
   * Four nested frames, each with exactly one job:
   *
   *   pintle   bolted to the door sill. Traverse (left and right).
   *   cradle   elevation (up and down). The gunner's head hangs off this, so
   *            the camera looks wherever the weapon points.
   *   recoil   the gun rocking back on its buffer when it fires.
   *   parts    the metal.
   *
   * Recoil lives inside the cradle, so it moves the weapon and nothing else -
   * not the gunner's eye, and certainly not the aircraft.
   */
  #buildDoorGun() {
    const dark = metalMaterial({ colour: 0x1f2325, wear: 0.6, seed: 720, repeat: 1 });

    const pintle = new THREE.Group();
    pintle.visible = false;
    // In the left doorway, on the sill, just outside the cabin skin.
    pintle.position.set(-1.42, -0.34, -0.5);
    // Trained out of the door and forward, the way a door gunner works.
    pintle.rotation.y = -0.72;

    // The post it turns on. Part of the aircraft, so it stays put while the
    // gun above it elevates and recoils.
    const post = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), dark);
    post.position.y = -0.31;
    pintle.add(post);
    const collar = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 10), dark, { cast: false });
    pintle.add(collar);

    const cradle = new THREE.Group();
    pintle.add(cradle);

    const recoil = new THREE.Group();
    cradle.add(recoil);

    const receiver = mesh(new THREE.BoxGeometry(0.22, 0.24, 1.0), dark);
    recoil.add(receiver);

    const barrel = mesh(new THREE.CylinderGeometry(0.055, 0.06, 1.5, 10), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.2;
    recoil.add(barrel);

    // Perforated jacket, suggested with rings rather than modelled holes.
    for (let i = 0; i < 6; i += 1) {
      const ring = mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 12), dark, { cast: false });
      ring.rotation.y = Math.PI / 2;
      ring.position.z = 0.75 + i * 0.18;
      recoil.add(ring);
    }

    const grip = mesh(new THREE.BoxGeometry(0.1, 0.34, 0.12), dark);
    grip.position.set(0, -0.24, -0.5);
    recoil.add(grip);

    const spadeLeft = mesh(new THREE.BoxGeometry(0.05, 0.26, 0.09), dark);
    spadeLeft.position.set(-0.16, -0.16, -0.62);
    recoil.add(spadeLeft);
    const spadeRight = spadeLeft.clone();
    spadeRight.position.x = 0.16;
    recoil.add(spadeRight);

    // The ammunition box is strapped to the cradle, not to the gun body - it
    // does not travel back with the receiver.
    const ammoBox = mesh(new THREE.BoxGeometry(0.34, 0.3, 0.42), dark);
    ammoBox.position.set(0.28, -0.14, -0.12);
    cradle.add(ammoBox);

    const flash = mesh(new THREE.SphereGeometry(0.24, 8, 6), lampMaterial(0xffd08a, 0), {
      cast: false,
    });
    flash.position.z = 2;
    recoil.add(flash);
    this.muzzleFlash = flash;

    const light = new THREE.PointLight(0xffc070, 0, 18, 2);
    light.position.z = 2;
    recoil.add(light);
    this.muzzleLight = light;

    /*
     * Where the gunner is: standing at the pintle, behind and above the
     * breech. On the pintle rather than the cradle, because a man depressing
     * a gun leans over it - his head does not swing up in an arc behind it.
     */
    const eye = new THREE.Object3D();
    eye.position.set(0.16, 0.3, -1);
    pintle.add(eye);

    // A point far down the sightline. Aiming the camera at this rather than
    // computing angles keeps the view and the barrel permanently agreed.
    const aim = new THREE.Object3D();
    aim.position.set(0, 0, 40);
    cradle.add(aim);

    this.#gunCradle = cradle;
    this.#gunRecoil = recoil;
    this.#gunnerEye = eye;
    this.#gunnerAim = aim;

    this.doorGun = pintle;
    // Bolted to the airframe. This single line is what stops it floating.
    this.helicopter.add(pintle);
  }

  /* ---------------------------------------------------------------- shelter */

  /** The railway building the protagonist crawls towards. */
  #buildShelter() {
    const group = new THREE.Group();
    group.visible = false;

    const brick = new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.95 });
    const trim = metalMaterial({ colour: 0x3b3630, wear: 0.8, seed: 730, repeat: 1 });
    const sleeperMaterial = metalMaterial({ colour: 0x3b3128, wear: 0.85, seed: 731, repeat: 1 });
    const railSteel = new THREE.MeshStandardMaterial({
      color: 0x9aa2a6, metalness: 1, roughness: 0.25,
    });
    const ballast = new THREE.MeshStandardMaterial({ color: 0x54524d, roughness: 1 });

    /*
     * The railway comes first.
     *
     * A locomotive parked beside a building with no track under it is the
     * single least believable thing in the sequence. The line runs through the
     * whole scene, and the train stands on it.
     *
     * The group sits at the origin so the world's locomotive - which never
     * moves - is already standing on these rails.
     */
    const TRACK_LENGTH = 220;

    const bed = mesh(new THREE.BoxGeometry(7.4, 0.5, TRACK_LENGTH), ballast, { cast: false });
    bed.position.y = 0.05;
    group.add(bed);

    for (const side of [-0.7175, 0.7175]) {
      const head = mesh(new THREE.BoxGeometry(0.075, 0.16, TRACK_LENGTH), railSteel, { cast: false });
      head.position.set(side, 0.42, 0);
      group.add(head);

      const web = mesh(new THREE.BoxGeometry(0.04, 0.1, TRACK_LENGTH), railSteel, { cast: false });
      web.position.set(side, 0.3, 0);
      group.add(web);
    }

    // Sleepers, instanced - there are a few hundred of them.
    const sleeperCount = Math.floor(TRACK_LENGTH / 0.65);
    const sleepers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.6, 0.16, 0.26),
      sleeperMaterial,
      sleeperCount,
    );
    sleepers.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < sleeperCount; i += 1) {
      matrix.makeTranslation(0, 0.24, -TRACK_LENGTH / 2 + i * 0.65);
      sleepers.setMatrixAt(i, matrix);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    group.add(sleepers);

    // A short loading platform along the near side of the track.
    const platform = mesh(new THREE.BoxGeometry(4, 0.8, 26), brick, { cast: false });
    platform.position.set(-6.2, 0.4, 2);
    group.add(platform);

    /* --------------------------------------------------------- the building */

    const building = new THREE.Group();

    const walls = mesh(new THREE.BoxGeometry(9, 4.2, 7), brick);
    walls.position.y = 2.1;
    building.add(walls);

    const roof = mesh(new THREE.BoxGeometry(9.8, 0.35, 7.8), trim);
    roof.position.y = 4.3;
    building.add(roof);

    // A lit doorway facing the track - the one warm thing in the whole act.
    const doorway = mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), lampMaterial(0xffc880, 1.6), {
      cast: false,
    });
    doorway.position.set(-1.2, 1.2, 3.55);
    building.add(doorway);

    const doorLight = new THREE.PointLight(0xffb765, 90, 26, 2);
    doorLight.position.set(-1.2, 2.2, 4.6);
    building.add(doorLight);

    for (const x of [1.8, 3.2]) {
      const window = mesh(new THREE.BoxGeometry(0.9, 1.0, 0.15), glassMaterial(), { cast: false });
      window.position.set(x, 2.4, 3.52);
      building.add(window);
    }

    building.position.set(-13, 0, 6);
    group.add(building);

    // A water tower, so it reads as a railway facility rather than a shed.
    const tower = mesh(new THREE.CylinderGeometry(1.5, 1.7, 3.0, 10), trim);
    tower.position.set(-11, 6.0, -14);
    group.add(tower);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.6, 6), trim);
      leg.position.set(-11 + dx * 1.1, 2.3, -14 + dz * 1.1);
      group.add(leg);
    }

    // Yard lamps down the line, so the approach is readable at night.
    for (const z of [-26, 4, 30]) {
      const mast = mesh(new THREE.CylinderGeometry(0.11, 0.16, 8, 8), trim);
      mast.position.set(-5.5, 4, z);
      group.add(mast);

      const bulb = mesh(new THREE.SphereGeometry(0.18, 8, 6), lampMaterial(0xffd9a0, 3), {
        cast: false,
      });
      bulb.position.set(-5.5, 7.9, z);
      group.add(bulb);

      const lamp = new THREE.PointLight(0xffcf94, 140, 34, 2);
      lamp.position.set(-5.5, 7.7, z);
      group.add(lamp);
    }

    this.shelter = group;
    this.#scene.add(group);
  }

  /**
   * A gloved hand and forearm, for the shot where the protagonist opens the
   * throttle. Deliberately simple: it is on screen for two seconds.
   *
   * The local frame matters more than the shape. The origin is the middle of
   * the grip - where the knob sits - fingers curl forward along +z, and the
   * forearm runs *backward and upward* toward an implied elbow.
   *
   * That last part is the whole point. The previous version had the forearm
   * hanging back and *down*, so however carefully the hand was flown over the
   * desk, the arm behind it was ploughing through the console. An arm that
   * leaves the wrist heading up towards a shoulder cannot do that, whatever
   * path the hand takes.
   */
  #buildHand() {
    const group = new THREE.Group();
    group.visible = false;

    const glove = new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: 0.9 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x4a4f3f, roughness: 0.95 });

    /*
     * The forearm runs backward and only slightly up - about eight degrees.
     *
     * The first attempt at this angled it a full twenty-four degrees to be
     * certain it cleared the desk, and on screen that read as a post standing
     * on the console rather than as an arm. A man reaching for a lever whose
     * knob is a third of a metre above the desk holds his forearm nearly
     * level; the clearance comes from the lever being tall, not from the arm
     * being raised.
     */
    const ARM_RISE = 0.14;
    const armPitch = -(Math.PI / 2 - ARM_RISE);

    const forearm = mesh(new THREE.CylinderGeometry(0.052, 0.072, 0.54, 10), sleeve);
    forearm.rotation.x = armPitch;
    forearm.position.set(0, 0.05, -0.3);
    group.add(forearm);

    // The cuff, where the glove meets the sleeve.
    const cuff = mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10), glove);
    cuff.rotation.x = armPitch;
    cuff.position.set(0, 0.021, -0.11);
    group.add(cuff);

    const palm = mesh(new THREE.BoxGeometry(0.105, 0.075, 0.12), glove);
    palm.position.set(0, 0.015, 0.01);
    group.add(palm);

    // Fingers curled round the knob, and a thumb across the top of it.
    const fingers = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.075), glove);
    fingers.position.set(0, -0.035, 0.055);
    fingers.rotation.x = 0.5;
    group.add(fingers);

    const thumb = mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.085, 6), glove);
    thumb.rotation.z = Math.PI / 2;
    thumb.rotation.y = -0.4;
    thumb.position.set(0.055, 0.045, 0.035);
    group.add(thumb);

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

  /* --------------------------------------------------------- the door gun */

  /**
   * Elevation of the weapon, in radians. Positive is down, because every shot
   * in the sequence is firing at the ground.
   */
  setDoorGunElevation(radians) {
    if (this.#gunCradle) this.#gunCradle.rotation.x = radians;
  }

  /**
   * How far the gun is back on its buffer, 0-1.
   *
   * Nine centimetres and three degrees of muzzle rise. That is a lot for a
   * weapon and nothing at all for an aircraft, which is the point: the recoil
   * belongs to the gun. The helicopter is eight tonnes and does not care.
   */
  setDoorGunRecoil(amount) {
    if (!this.#gunRecoil) return;
    const kick = Math.max(0, Math.min(1, amount));
    this.#gunRecoil.position.z = -0.09 * kick;
    this.#gunRecoil.rotation.x = -0.05 * kick;
  }

  /**
   * The gunner's eye and a point down his sightline, both in world space.
   *
   * Both hang off the weapon's cradle inside the helicopter, so this already
   * accounts for wherever the aircraft has rolled, pitched and fallen to. The
   * camera never has to work any of that out.
   *
   * @returns {{eye: {x,y,z}, aim: {x,y,z}, up: {x,y,z}}}
   */
  gunnerView() {
    // The shot moved the helicopter this frame; the anchors hanging off it
    // have not caught up until the matrices are rebuilt.
    this.helicopter.updateWorldMatrix(true, true);

    const eye = this.#gunnerEye.getWorldPosition(this.#scratch);
    const aim = this.#gunnerAim.getWorldPosition(this.#scratchB);
    // The aircraft's own up, so the horizon banks with it instead of the
    // world staying stubbornly level while the machine rolls over.
    const up = this.#scratchC.set(0, 1, 0).applyQuaternion(this.helicopter.quaternion);

    return {
      eye: { x: eye.x, y: eye.y, z: eye.z },
      aim: { x: aim.x, y: aim.y, z: aim.z },
      up: { x: up.x, y: up.y, z: up.z },
    };
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

    // Fires flicker independently, and each flame within a fire moves on its
    // own rhythm - a fire where every tongue pulses together reads as a lamp.
    for (const fire of this.#fires) {
      const phase = fire.userData.phase;
      const flicker =
        0.75 + Math.sin(elapsed * 9 + phase) * 0.15 + Math.sin(elapsed * 23 + phase * 2) * 0.1;
      fire.userData.light.intensity = fire.userData.baseIntensity * flicker;

      for (const flame of fire.userData.flames ?? []) {
        const own = Math.sin(elapsed * 13 + flame.userData.phase);
        const lick = Math.sin(elapsed * 31 + flame.userData.phase * 3);
        flame.scale.y = 1 + own * 0.22 + lick * 0.08;
        flame.position.y = (flame.userData.baseHeight * flame.scale.y) / 2;
        flame.rotation.z = own * 0.14;
        flame.rotation.x = lick * 0.09;
        flame.material.emissiveIntensity = 2.2 + flicker * 0.9;
      }
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
      // The door gun hangs off the helicopter rather than off the scene, so
      // ask for its actual parent instead of assuming.
      target.parent?.remove(target);
      target.traverse((node) => {
        node.geometry?.dispose();
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material?.dispose();
      });
    }
  }
}
