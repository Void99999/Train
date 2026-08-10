/**
 * LAST TRAIN - the world.
 *
 * Track, ground, sky, lighting, scenery and the train itself. The train never
 * actually moves: the world slides past underneath it. That keeps the player
 * and the train near the origin, which avoids floating-point precision falling
 * apart a hundred kilometres down the line, and makes an endless railway a
 * matter of recycling scenery rather than building it.
 *
 * The same scene serves the main menu and the game. The menu simply parks the
 * camera beside a stationary train at night; nothing has to be torn down and
 * rebuilt when the player presses Start.
 */

import * as THREE from "../../vendor/three/three.module.js";
import { buildVehicleMesh, disposeMesh } from "./trainMeshes.js";
import { ballastMaterial, railMaterial, groundMaterial, metalMaterial, lampMaterial } from "./materials.js";
import { Box, ColliderSet } from "../systems/world/collision.js";
import { Rng } from "../core/rng.js";
import { TRAIN, UNITS } from "../data/balance.js";

/** How far ahead and behind the track and scenery are built, in metres. */
const WORLD_LENGTH = 900;
/** Spacing of the sleepers under the track. */
const SLEEPER_SPACING = 0.65;

export class World {
  scene = new THREE.Scene();

  #sun;
  #moon;
  #ambient;
  #hemisphere;
  #sky;
  #stars;
  #trackGroup = new THREE.Group();
  #sceneryGroup = new THREE.Group();
  #trainGroup = new THREE.Group();
  /* Everything that makes the scene a railway. Hidden during the battlefield
     acts of the intro, so the cinematic can reuse the same space. */
  #railwayGroup = new THREE.Group();
  #vehicleMeshes = new Map();
  #scrollOffset = 0;
  #headlights = [];
  #fill;

  /** Walkable geometry, in train space. Rebuilt whenever the consist changes. */
  colliders = new ColliderSet();
  /** Things the player can look at and press E on. */
  interactables = [];
  #throttleLights = [];
  #speedNeedle = null;
  #scrollingProps = [];
  #wheels = [];
  #wheelAngle = 0;

  constructor({ quality }) {
    this.quality = quality;

    this.scene.add(this.#railwayGroup, this.#trainGroup);
    this.#railwayGroup.add(this.#trackGroup, this.#sceneryGroup);
    this.#buildSky();
    this.#buildLighting();
    this.#buildGround();
    this.#buildTrack();
    this.#buildScenery();
  }

  /* ------------------------------------------------------------------ sky */

  #buildSky() {
    // A large inverted sphere with a vertical gradient. Cheap, and it takes
    // colour from the day/night cycle without needing a skybox asset.
    const geometry = new THREE.SphereGeometry(1200, 32, 20);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        horizonColour: { value: new THREE.Color(0x0a0e16) },
        zenithColour: { value: new THREE.Color(0x02040a) },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 horizonColour;
        uniform vec3 zenithColour;
        varying vec3 vPosition;
        void main() {
          float height = clamp(normalize(vPosition).y * 1.4 + 0.15, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizonColour, zenithColour, height), 1.0);
        }
      `,
    });

    this.#sky = new THREE.Mesh(geometry, material);
    this.#sky.name = "sky";
    this.scene.add(this.#sky);

    this.#buildStars();
  }

  #buildStars() {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      // Upper hemisphere only - stars below the horizon are never seen.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.92 + 0.04);
      const radius = 1000;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 1 + Math.random() * 2.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    this.#stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xdce6ff,
        size: 2.2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.#stars.name = "stars";
    this.scene.add(this.#stars);
  }

  /* -------------------------------------------------------------- lighting */

  #buildLighting() {
    this.#ambient = new THREE.AmbientLight(0x8899aa, 0.3);
    this.scene.add(this.#ambient);

    // Sky/ground bounce. Does most of the work of making an outdoor scene look
    // like it is outdoors rather than lit by a single lamp.
    this.#hemisphere = new THREE.HemisphereLight(0x94b0cc, 0x3a3227, 0.5);
    this.scene.add(this.#hemisphere);

    this.#sun = new THREE.DirectionalLight(0xfff3dc, 0);
    this.#sun.castShadow = this.quality.shadows;
    if (this.quality.shadows) {
      this.#sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
      this.#sun.shadow.camera.near = 1;
      this.#sun.shadow.camera.far = 260;
      this.#sun.shadow.camera.left = -70;
      this.#sun.shadow.camera.right = 70;
      this.#sun.shadow.camera.top = 70;
      this.#sun.shadow.camera.bottom = -70;
      this.#sun.shadow.bias = -0.0006;
    }
    this.scene.add(this.#sun, this.#sun.target);

    this.#moon = new THREE.DirectionalLight(0x9fb6d8, 0.3);
    this.#moon.position.set(-60, 90, -40);
    this.scene.add(this.#moon);

    // A visible moon disc, so the night sky has something in it.
    const moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(28, 24, 18),
      lampMaterial(0xe8eef8, 1.1),
    );
    moonDisc.position.set(-380, 460, -620);
    moonDisc.name = "moon";
    this.scene.add(moonDisc);
    this.moonDisc = moonDisc;

    this.#buildYardLighting();
  }

  /**
   * A working lamp beside the track, and a cold fill from the opposite side.
   *
   * Moonlight alone leaves the train as a black cut-out. A real railway
   * facility has lights on it, so putting one here is both what the place
   * would look like and what makes the machine readable at night. The fill
   * light has no fixture because it stands in for sky bounce.
   */
  #buildYardLighting() {
    const poleMaterial = metalMaterial({ colour: 0x2e3230, wear: 0.75, seed: 520, repeat: 1 });
    const group = new THREE.Group();

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 9, 8), poleMaterial);
    mast.position.y = 4.5;
    mast.castShadow = true;
    group.add(mast);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), poleMaterial);
    arm.position.set(-1.1, 8.8, 0);
    group.add(arm);

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.45, 10, 1, true),
      poleMaterial,
    );
    shade.position.set(-2.2, 8.7, 0);
    group.add(shade);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampMaterial(0xffd9a0, 3.5));
    bulb.position.set(-2.2, 8.5, 0);
    group.add(bulb);

    const lamp = new THREE.PointLight(0xffcf94, 240, 46, 1.8);
    lamp.position.set(-2.2, 8.4, 0);
    lamp.castShadow = false;
    group.add(lamp);

    // Set back and behind the locomotive, so it lights the machine without
    // standing in front of the camera.
    //
    // Registered as a scrolling prop like every other piece of lineside
    // furniture. It was previously added to the railway group but never
    // registered, so while the rest of the world slid past it stayed put -
    // which reads exactly as a lamp bolted to the moving train, and it drove
    // straight through the poles that were scrolling correctly.
    group.position.set(9.5, 0, -12);
    group.userData.baseZ = -12;
    group.userData.spacing = 34;
    this.#railwayGroup.add(group);
    this.#scrollingProps.push(group);
    this.yardLight = lamp;
    this.yardBulb = bulb;

    // Cold fill from the far side, standing in for sky bounce off the ground.
    this.#fill = new THREE.PointLight(0x7f9bc4, 90, 70, 1.6);
    this.#fill.position.set(-12, 9, -6);
    this.scene.add(this.#fill);
  }

  /* ---------------------------------------------------------------- ground */

  #buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, WORLD_LENGTH * 2, 1, 1),
      groundMaterial(),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "ground";
    this.#railwayGroup.add(ground);

    const ballast = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.5, WORLD_LENGTH * 2),
      ballastMaterial(),
    );
    ballast.position.y = 0.05;
    ballast.receiveShadow = true;
    this.#railwayGroup.add(ballast);
  }

  /* ----------------------------------------------------------------- track */

  #buildTrack() {
    const rail = railMaterial();
    const sleeperMaterial = metalMaterial({ colour: 0x3b3128, wear: 0.85, seed: 300, repeat: 1 });

    // Rails run the length of the world and never move; only the sleepers and
    // the scenery are recycled, which is enough to sell motion.
    for (const side of [-0.7175, 0.7175]) {
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.16, WORLD_LENGTH * 2),
        rail,
      );
      head.position.set(side, 0.42, 0);
      head.castShadow = false;
      head.receiveShadow = true;
      this.#railwayGroup.add(head);

      const web = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, WORLD_LENGTH * 2), rail);
      web.position.set(side, 0.3, 0);
      this.#railwayGroup.add(web);
    }

    // Sleepers, instanced: there are several thousand of them.
    const count = Math.floor((WORLD_LENGTH * 2) / SLEEPER_SPACING);
    const sleepers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.6, 0.16, 0.26),
      sleeperMaterial,
      count,
    );
    sleepers.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) {
      matrix.makeTranslation(0, 0.24, -WORLD_LENGTH + i * SLEEPER_SPACING);
      sleepers.setMatrixAt(i, matrix);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    sleepers.name = "sleepers";
    this.#trackGroup.add(sleepers);
    this.sleepers = sleepers;
  }

  /* --------------------------------------------------------------- scenery */

  /**
   * Scenery, in four depth layers.
   *
   * This is what actually sells forward motion. One layer of poles at forty
   * metre spacing gives the eye almost nothing to measure speed against; near
   * clutter streaking past the window while distant hills barely shift is what
   * makes the train feel like it is travelling rather than idling inside a
   * moving skybox.
   *
   * Each layer scrolls at the same world speed but sits at a different
   * distance, so perspective produces the parallax for free.
   */
  #buildScenery() {
    const rng = new Rng(90210);

    const poleMaterial = metalMaterial({ colour: 0x36302a, wear: 0.8, seed: 410, repeat: 1 });
    const scrubMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4230, roughness: 1 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2721, roughness: 1 });
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x2f3a26, roughness: 1 });
    const concreteMaterial = new THREE.MeshStandardMaterial({ color: 0x4a463f, roughness: 0.95 });
    const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3128, roughness: 1 });

    /** Adds one prop and registers it for scrolling. */
    const place = (object, x, z, spacing) => {
      object.position.set(x, 0, z);
      object.userData.baseZ = z;
      object.userData.spacing = spacing;
      this.#sceneryGroup.add(object);
      this.#scrollingProps.push(object);
    };

    /* Layer 1: lineside clutter, close enough to streak past the windows. */
    const nearSpacing = 9;
    for (let i = 0; i < Math.floor((WORLD_LENGTH * 2) / nearSpacing); i += 1) {
      const z = -WORLD_LENGTH + i * nearSpacing;
      const side = rng.chance(0.5) ? 1 : -1;

      const bush = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rng.range(0.5, 1.3), 0),
        scrubMaterial,
      );
      bush.scale.y = rng.range(0.5, 0.9);
      bush.castShadow = true;
      bush.receiveShadow = true;
      place(bush, side * rng.range(6.5, 13), z + rng.range(-3, 3), nearSpacing);

      // Occasional marker post, ballast pile or sleeper stack.
      if (rng.chance(0.4)) {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, rng.range(0.7, 1.2), 0.22),
          poleMaterial,
        );
        marker.position.y = 0.5;
        const holder = new THREE.Group();
        holder.add(marker);
        place(holder, side * rng.range(5.2, 6.2), z + rng.range(-4, 4), nearSpacing);
      }
    }

    /* Layer 2: telegraph poles, the classic speed reference. */
    const poleSpacing = 34;
    for (let i = 0; i < Math.floor((WORLD_LENGTH * 2) / poleSpacing); i += 1) {
      const pole = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 8.5, 6), poleMaterial);
      mast.position.y = 4.25;
      mast.castShadow = true;
      pole.add(mast);

      for (const height of [7.6, 6.9]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMaterial);
        arm.position.set(0, height, 0);
        pole.add(arm);
      }
      place(pole, 9.5, -WORLD_LENGTH + i * poleSpacing, poleSpacing);
    }

    /* Layer 3: middle distance - trees, ruins, fences, abandoned structures. */
    const midSpacing = 46;
    for (let i = 0; i < Math.floor((WORLD_LENGTH * 2) / midSpacing); i += 1) {
      const z = -WORLD_LENGTH + i * midSpacing;
      const side = rng.chance(0.5) ? 1 : -1;
      const roll = rng.next();

      let prop;
      if (roll < 0.45) {
        // A dead tree. Nothing here has leaves worth speaking of.
        prop = new THREE.Group();
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.34, rng.range(5, 9), 6),
          trunkMaterial,
        );
        trunk.position.y = 3.5;
        trunk.castShadow = true;
        prop.add(trunk);
        if (rng.chance(0.6)) {
          const crown = new THREE.Mesh(
            new THREE.IcosahedronGeometry(rng.range(1.6, 2.8), 0),
            foliageMaterial,
          );
          crown.position.y = rng.range(6, 8);
          crown.scale.y = 0.7;
          crown.castShadow = true;
          prop.add(crown);
        }
      } else if (roll < 0.75) {
        // A shell of a building: walls standing, roof long gone.
        prop = new THREE.Group();
        const w = rng.range(5, 11);
        const h = rng.range(3, 7);
        const d = rng.range(4, 9);
        for (const [dx, dz, sw, sd] of [
          [-w / 2, 0, 0.4, d],
          [w / 2, 0, 0.4, d],
          [0, -d / 2, w, 0.4],
        ]) {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(sw, h * rng.range(0.6, 1), sd),
            concreteMaterial,
          );
          wall.position.set(dx, (h * 0.8) / 2, dz);
          wall.castShadow = true;
          wall.receiveShadow = true;
          prop.add(wall);
        }
      } else {
        // A fence line running away from the track.
        prop = new THREE.Group();
        for (let post = 0; post < 8; post += 1) {
          const stake = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 1.4, 0.12),
            poleMaterial,
          );
          stake.position.set(post * 2.4, 0.7, 0);
          prop.add(stake);
        }
      }

      place(prop, side * rng.range(22, 48), z, midSpacing);
    }

    /* Layer 4: the horizon. Barely moves, which is exactly the point. */
    const hillSpacing = 150;
    for (let i = 0; i < Math.floor((WORLD_LENGTH * 2) / hillSpacing); i += 1) {
      for (const side of [-1, 1]) {
        const hill = new THREE.Mesh(
          new THREE.ConeGeometry(rng.range(40, 90), rng.range(14, 34), 6),
          hillMaterial,
        );
        hill.position.y = -2;
        const holder = new THREE.Group();
        holder.add(hill);
        place(
          holder,
          side * rng.range(140, 260),
          -WORLD_LENGTH + i * hillSpacing + rng.range(-40, 40),
          hillSpacing,
        );
      }
    }
  }

  /* ----------------------------------------------------------------- train */

  /**
   * Rebuilds the train's meshes to match the simulation.
   *
   * Called whenever the consist changes and cheap enough to call on damage
   * state changes too: only the vehicles whose appearance actually changed are
   * rebuilt, so a wagon dropping from light to medium damage does not disturb
   * the rest of the train.
   */
  syncTrain(train) {
    const seen = new Set();
    let offset = 0;

    for (const vehicle of train.vehicles) {
      seen.add(vehicle.id);
      const half = vehicle.spec.size.length / 2;
      offset += half;

      let entry = this.#vehicleMeshes.get(vehicle.id);
      const needsRebuild =
        !entry ||
        entry.mesh.userData.damageState !== vehicle.damageState ||
        entry.mesh.userData.armoured !== vehicle.isArmoured ||
        entry.mesh.userData.level !== vehicle.level;

      if (needsRebuild) {
        if (entry) {
          this.#trainGroup.remove(entry.mesh);
          disposeMesh(entry.mesh);
        }
        const mesh = buildVehicleMesh(vehicle);
        this.#trainGroup.add(mesh);
        entry = { mesh, vehicle };
        this.#vehicleMeshes.set(vehicle.id, entry);
      }

      // The locomotive sits at the origin; wagons trail behind it.
      entry.mesh.position.z = -offset + train.vehicles[0].spec.size.length / 2;
      offset += half + TRAIN.couplingLengthMetres;
    }

    for (const [id, entry] of this.#vehicleMeshes) {
      if (seen.has(id)) continue;
      this.#trainGroup.remove(entry.mesh);
      disposeMesh(entry.mesh);
      this.#vehicleMeshes.delete(id);
    }

    this.#headlights = [];
    this.#wheels = [];
    this.#trainGroup.traverse((node) => {
      if (node.name === "headlight") this.#headlights.push(node);
      if (node.name === "wheel") this.#wheels.push(node);
    });

    this.#rebuildColliders();

    // Cache the cab's throttle notch lamps so the indicator can be driven from
    // the simulation every frame rather than set once and hoped about.
    this.#throttleLights = [1, 2, 3, 4].map((index) => this.findInTrain(`throttle-light-${index}`));
    this.#speedNeedle = this.findInTrain("gauge-speed");
  }

  /**
   * Swings the cab speedometer.
   *
   * The dial reads the same number the HUD does, because both come from the
   * train. An instrument that disagrees with the interface is worse than no
   * instrument at all.
   */
  setSpeedIndicator(fraction) {
    if (!this.#speedNeedle) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    // Sweeps from about eight o'clock round to four o'clock.
    this.#speedNeedle.rotation.z = 2.35 - clamped * 4.7;
  }

  /**
   * Lights the driver's notches to match the throttle.
   * Cumulative, like the HUD: three lit means three quarters.
   */
  setThrottleIndicator(index) {
    for (let i = 0; i < this.#throttleLights.length; i += 1) {
      const light = this.#throttleLights[i];
      if (light) light.material.emissiveIntensity = i < index ? 3.2 : 0;
    }
  }

  /**
   * Collects the walkable geometry from every vehicle into one set, shifted
   * into train space by each vehicle's position in the consist.
   *
   * Rebuilt whenever the train changes shape, so a wagon that is bought,
   * upgraded or blown off the back takes its floors and walls with it.
   */
  #rebuildColliders() {
    this.colliders.clear();
    this.interactables = [];

    for (const { mesh } of this.#vehicleMeshes.values()) {
      const offset = mesh.position.z;

      for (const box of mesh.userData.colliders ?? []) {
        this.colliders.add(
          new Box(
            box.minX, box.minY, box.minZ + offset,
            box.maxX, box.maxY, box.maxZ + offset,
            { tag: box.tag },
          ),
        );
      }

      for (const item of mesh.userData.interactables ?? []) {
        this.interactables.push({
          ...item,
          vehicleId: mesh.userData.vehicleId,
          box: new Box(
            item.box.minX, item.box.minY, item.box.minZ + offset,
            item.box.maxX, item.box.maxY, item.box.maxZ + offset,
            { tag: item.id },
          ),
        });
      }
    }
  }

  /**
   * Shows or hides the railway. The intro's battlefield acts occupy the same
   * space, so the two are swapped rather than placed apart.
   */
  setRailwayVisible(visible) {
    this.#railwayGroup.visible = visible;
  }

  setTrainVisible(visible) {
    this.#trainGroup.visible = visible;
  }

  /** Finds a named part of the train, such as a throttle notch light. */
  findInTrain(name) {
    let found = null;
    this.#trainGroup.traverse((node) => {
      if (!found && node.name === name) found = node;
    });
    return found;
  }

  /** Where the player should stand when a run begins, in train space. */
  spawnPointFor(vehicleId) {
    const entry = this.#vehicleMeshes.get(vehicleId);
    if (!entry?.mesh.userData.spawn) return null;
    const spawn = entry.mesh.userData.spawn;
    return { x: spawn.x, y: spawn.y, z: spawn.z + entry.mesh.position.z };
  }

  meshFor(vehicleId) {
    return this.#vehicleMeshes.get(vehicleId)?.mesh ?? null;
  }

  /* ---------------------------------------------------------------- update */

  /**
   * Advances the world.
   *
   * @param {number} deltaSeconds
   * @param {number} speedMetresPerSecond how fast the train is moving
   * @param {object} sky day/night snapshot
   */
  update(deltaSeconds, speedMetresPerSecond, sky, elapsed = 0) {
    this.#scrollWorld(deltaSeconds * speedMetresPerSecond);
    this.#rotateWheels(deltaSeconds, speedMetresPerSecond);

    const topSpeed = TRAIN.baseMaxSpeedKmh * UNITS.kmhToMetresPerSecond;
    this.#vibrate(elapsed, Math.min(1, speedMetresPerSecond / topSpeed));

    this.#applySky(sky);
  }

  /**
   * Slides the scenery backwards and wraps it round, which is what makes an
   * endless line out of nine hundred metres of geometry.
   *
   * Each prop wraps on its own layer spacing, so the near clutter recycles
   * every few metres while the hills recycle every hundred and fifty - and the
   * eye reads the difference as depth.
   */
  #scrollWorld(distance) {
    if (distance === 0) return;
    this.#scrollOffset += distance;

    for (const prop of this.#scrollingProps) {
      const spacing = prop.userData.spacing;
      let z = prop.userData.baseZ - (this.#scrollOffset % (WORLD_LENGTH * 2));
      if (z < -WORLD_LENGTH) z += WORLD_LENGTH * 2;
      if (z > WORLD_LENGTH) z -= WORLD_LENGTH * 2;
      prop.position.z = z;
    }

    // Sleepers scroll on their own, much shorter cycle. Directly under the
    // window, they are the fastest-moving thing in view and the clearest
    // reading of raw speed.
    const sleeperPhase = this.#scrollOffset % SLEEPER_SPACING;
    this.#trackGroup.position.z = -sleeperPhase;
  }

  /**
   * Turns the wheels at the speed the train is actually doing.
   *
   * Rolling without slipping: angular velocity is ground speed over wheel
   * radius. Getting this right matters more than it sounds - wheels that turn
   * at the wrong rate are one of the few things almost everyone notices.
   */
  #rotateWheels(deltaSeconds, speed) {
    if (this.#wheels.length === 0 || speed === 0) return;
    for (const wheel of this.#wheels) {
      const radius = wheel.userData.radius ?? 0.52;
      wheel.rotation.x -= (speed / radius) * deltaSeconds;
    }
  }

  /**
   * Rocks the train on its springs.
   *
   * Small: a couple of centimetres of sway and bounce, plus a slow roll. The
   * point is that the cab is never perfectly still while the train is running,
   * because a perfectly still interior is what makes a moving train feel like
   * a stationary room.
   */
  #vibrate(elapsed, speedFraction) {
    if (speedFraction <= 0.001) {
      this.#trainGroup.position.set(0, 0, 0);
      this.#trainGroup.rotation.set(0, 0, 0);
      return;
    }

    const intensity = 0.4 + speedFraction * 0.6;
    this.#trainGroup.position.y =
      (Math.sin(elapsed * 11.3) * 0.006 + Math.sin(elapsed * 27.7) * 0.003) * intensity;
    this.#trainGroup.position.x =
      (Math.sin(elapsed * 7.9 + 1.4) * 0.008 + Math.sin(elapsed * 19.1) * 0.004) * intensity;
    this.#trainGroup.rotation.z = Math.sin(elapsed * 5.3) * 0.0016 * intensity;
    this.#trainGroup.rotation.x = Math.sin(elapsed * 8.7 + 0.6) * 0.0011 * intensity;
  }

  #applySky(sky) {
    if (!sky) return;

    this.#sky.material.uniforms.horizonColour.value.setHex(sky.skyColour);
    this.#sky.material.uniforms.zenithColour.value.setHex(sky.skyColour).multiplyScalar(0.35);

    this.#stars.material.opacity = Math.max(0, sky.darkness - 0.25) * 1.3;
    this.moonDisc.visible = sky.darkness > 0.1;
    this.moonDisc.material.emissiveIntensity = 0.4 + sky.darkness * 1.2;

    this.#sun.color.setHex(sky.sunColour);
    this.#sun.intensity = sky.sunIntensity;

    const distance = 120;
    this.#sun.position.set(
      Math.cos(sky.sunAzimuth) * distance,
      Math.max(-20, Math.sin(sky.sunElevation) * distance),
      Math.sin(sky.sunAzimuth) * distance * 0.4,
    );
    this.#sun.target.position.set(0, 0, 0);

    this.#moon.intensity = sky.moonIntensity;
    this.#ambient.intensity = sky.ambientIntensity;
    this.#hemisphere.intensity = sky.ambientIntensity;
    // At night the sky is nearly black, and tinting the bounce light with it
    // would remove the only fill the scene has. Keep a cold blue instead.
    this.#hemisphere.color.setHex(sky.darkness > 0.5 ? 0x39506e : sky.skyColour);

    // Artificial light comes on as it gets dark, not at a fixed clock time.
    const headlightIntensity = sky.needsArtificialLight ? 420 : 40;
    for (const light of this.#headlights) light.intensity = headlightIntensity;

    if (this.yardLight) {
      this.yardLight.intensity = sky.needsArtificialLight ? 300 : 0;
      this.yardBulb.material.emissiveIntensity = sky.needsArtificialLight ? 3.5 : 0;
      this.#fill.intensity = 30 + sky.darkness * 70;
    }

    // Reuse one Fog object rather than allocating a new one every frame, and
    // keep the far plane well out: fog that closes to 220 m at night hides the
    // scenery the player needs in order to feel the train moving at all.
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(sky.skyColour, 60, 700);
    this.scene.fog.color.setHex(sky.skyColour);
    this.scene.fog.near = sky.isNight ? 90 : 120;
    this.scene.fog.far = sky.isNight ? 620 : 900;
  }

  dispose() {
    for (const { mesh } of this.#vehicleMeshes.values()) disposeMesh(mesh);
    this.#vehicleMeshes.clear();
  }
}
