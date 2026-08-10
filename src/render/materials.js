/**
 * LAST TRAIN - materials.
 *
 * Every surface is generated at runtime onto a canvas rather than loaded from
 * an image file. That keeps the project dependency-free and downloadable as a
 * folder, and it means weathering is a parameter rather than an asset: the same
 * steel material can be asked for "lightly used" or "eight years in a war zone"
 * and produce a matching albedo and roughness map.
 *
 * Textures are cached by their parameters, because a ten-wagon train asking for
 * the same weathered green steel ten times should generate it once.
 */

import * as THREE from "../../vendor/three/three.module.js";

const textureCache = new Map();

/** Deterministic value noise, so a given surface looks the same every run. */
function makeNoise(seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const size = 64;
  const lattice = Array.from({ length: size * size }, random);
  const at = (x, y) => lattice[(y & (size - 1)) * size + (x & (size - 1))];

  /** Smoothed 2D noise in [0, 1). */
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const top = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
    const bottom = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

/** Layered noise, for surfaces that need both broad blotches and fine grain. */
function fractalNoise(noise, x, y, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < octaves; i += 1) {
    value += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return value / total;
}

function hexToRgb(hex) {
  const value = typeof hex === "number" ? hex : parseInt(String(hex).replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Generates an albedo + roughness pair for a painted metal surface.
 *
 * @param {object} options
 * @param {number} options.colour     base paint colour
 * @param {number} options.wear       0 = factory fresh, 1 = bare rusted steel
 * @param {number} options.seed
 * @param {number} [options.size]     texture resolution
 */
function createMetalTextures({ colour, wear, seed, size = 512 }) {
  const key = `metal:${colour}:${wear.toFixed(2)}:${seed}:${size}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const albedoCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  albedoCanvas.width = albedoCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;

  const albedoContext = albedoCanvas.getContext("2d");
  const roughContext = roughCanvas.getContext("2d");
  const albedoImage = albedoContext.createImageData(size, size);
  const roughImage = roughContext.createImageData(size, size);

  const noise = makeNoise(seed);
  const grime = makeNoise(seed + 977);
  const base = hexToRgb(colour);
  const rust = hexToRgb(0x6b3a20);
  const steel = hexToRgb(0x51565a);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * 8;
      const v = (y / size) * 8;

      // Broad patches of paint loss, plus vertical streaks where water runs.
      const patch = fractalNoise(noise, u, v, 5);
      const streak = fractalNoise(grime, u * 3, v * 0.35, 3);
      const exposure = Math.max(0, patch * 0.75 + streak * 0.45 - (1 - wear) * 0.9);
      const rustAmount = Math.min(1, exposure * 2.2);
      const bareAmount = Math.min(1, Math.max(0, exposure - 0.35) * 1.8);

      // Fine grain keeps large flat panels from reading as plastic.
      const grain = (fractalNoise(noise, u * 26, v * 26, 2) - 0.5) * 26;

      const mix = (channel, rustChannel, steelChannel) =>
        channel * (1 - rustAmount) + rustChannel * rustAmount * (1 - bareAmount) + steelChannel * bareAmount;

      const index = (y * size + x) * 4;
      albedoImage.data[index] = Math.max(0, Math.min(255, mix(base.r, rust.r, steel.r) + grain));
      albedoImage.data[index + 1] = Math.max(0, Math.min(255, mix(base.g, rust.g, steel.g) + grain));
      albedoImage.data[index + 2] = Math.max(0, Math.min(255, mix(base.b, rust.b, steel.b) + grain));
      albedoImage.data[index + 3] = 255;

      // Rust is rough, intact paint is smoother, bare steel is smoother still.
      const roughness = 0.42 + rustAmount * 0.5 - bareAmount * 0.28 + (fractalNoise(noise, u * 14, v * 14, 2) - 0.5) * 0.12;
      const level = Math.max(0, Math.min(255, roughness * 255));
      roughImage.data[index] = level;
      roughImage.data[index + 1] = level;
      roughImage.data[index + 2] = level;
      roughImage.data[index + 3] = 255;
    }
  }

  albedoContext.putImageData(albedoImage, 0, 0);
  roughContext.putImageData(roughImage, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  for (const texture of [albedo, roughness]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  albedo.colorSpace = THREE.SRGBColorSpace;

  const result = { albedo, roughness };
  textureCache.set(key, result);
  return result;
}

/**
 * Painted, weathered metal.
 *
 * @param {object} options
 * @param {number} options.colour
 * @param {number} [options.wear]    0-1, how badly used the surface is
 * @param {number} [options.repeat]  texture tiling across the surface
 */
export function metalMaterial({ colour, wear = 0.35, seed = 1, repeat = 2, metalness = 0.85 } = {}) {
  const { albedo, roughness } = createMetalTextures({ colour, wear, seed });
  const map = albedo.clone();
  const roughnessMap = roughness.clone();
  map.needsUpdate = true;
  roughnessMap.needsUpdate = true;
  map.repeat.set(repeat, repeat);
  roughnessMap.repeat.set(repeat, repeat);

  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    metalness,
    roughness: 1,
  });
}

/**
 * Ground surfaces: ballast, dirt, scrub.
 *
 * Kept separate from the metal generator on purpose. Metal weathers by losing
 * paint to rust, which is an orange process; ground weathers by being dry,
 * dusty and stony, which is not. Running terrain through the metal path is
 * what turns a war-zone verge into an orange carpet.
 */
function createTerrainTextures({ base, speck, grain = 0.5, seed, size = 256 }) {
  const key = `terrain:${base}:${speck}:${grain}:${seed}:${size}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const albedoCanvas = document.createElement("canvas");
  const roughCanvas = document.createElement("canvas");
  albedoCanvas.width = albedoCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;

  const albedoContext = albedoCanvas.getContext("2d");
  const roughContext = roughCanvas.getContext("2d");
  const albedoImage = albedoContext.createImageData(size, size);
  const roughImage = roughContext.createImageData(size, size);

  const noise = makeNoise(seed);
  const stones = makeNoise(seed + 613);
  const baseColour = hexToRgb(base);
  const speckColour = hexToRgb(speck);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * 10;
      const v = (y / size) * 10;

      // Broad tonal variation, plus hard-edged speckle for individual stones.
      const patch = fractalNoise(noise, u, v, 4);
      const stone = stones(u * 9, v * 9);
      const speckle = stone > 0.68 ? (stone - 0.68) * 3 : 0;
      const shade = 0.72 + patch * 0.5;
      const dust = (fractalNoise(noise, u * 22, v * 22, 2) - 0.5) * grain * 40;

      const channel = (baseValue, speckValue) =>
        Math.max(0, Math.min(255, baseValue * shade * (1 - speckle) + speckValue * speckle + dust));

      const index = (y * size + x) * 4;
      albedoImage.data[index] = channel(baseColour.r, speckColour.r);
      albedoImage.data[index + 1] = channel(baseColour.g, speckColour.g);
      albedoImage.data[index + 2] = channel(baseColour.b, speckColour.b);
      albedoImage.data[index + 3] = 255;

      // Ground is uniformly rough; stones are marginally less so.
      const level = Math.max(0, Math.min(255, (0.88 - speckle * 0.2 + patch * 0.08) * 255));
      roughImage.data[index] = level;
      roughImage.data[index + 1] = level;
      roughImage.data[index + 2] = level;
      roughImage.data[index + 3] = 255;
    }
  }

  albedoContext.putImageData(albedoImage, 0, 0);
  roughContext.putImageData(roughImage, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  for (const texture of [albedo, roughness]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  albedo.colorSpace = THREE.SRGBColorSpace;

  const result = { albedo, roughness };
  textureCache.set(key, result);
  return result;
}

function terrainMaterial({ base, speck, seed, repeatX, repeatY }) {
  const { albedo, roughness } = createTerrainTextures({ base, speck, seed });
  const map = albedo.clone();
  const roughnessMap = roughness.clone();
  map.needsUpdate = true;
  roughnessMap.needsUpdate = true;
  map.repeat.set(repeatX, repeatY);
  roughnessMap.repeat.set(repeatX, repeatY);

  return new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    metalness: 0,
    roughness: 1,
  });
}

/** Loose grey track ballast. */
export function ballastMaterial() {
  return terrainMaterial({
    base: 0x54524d,
    speck: 0x7d7a72,
    seed: 4021,
    repeatX: 8,
    repeatY: 420,
  });
}

/** Polished rail head - the one genuinely reflective surface in the scene. */
export function railMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9aa2a6,
    metalness: 1,
    roughness: 0.22,
  });
}

/** Dry, dark scrub and dirt alongside the line. */
export function groundMaterial() {
  return terrainMaterial({
    base: 0x38382c,
    speck: 0x4d4c3c,
    seed: 88,
    repeatX: 90,
    repeatY: 520,
  });
}

/** Glass for cab and wagon windows: dark, dirty, faintly reflective. */
export function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x11181a,
    metalness: 0,
    roughness: 0.28,
    transmission: 0.35,
    thickness: 0.05,
    transparent: true,
    opacity: 0.86,
  });
}

/** Emissive material for lamps and lit windows. */
export function lampMaterial(colour = 0xffdca8, intensity = 2.4) {
  return new THREE.MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: intensity,
    roughness: 0.5,
    metalness: 0,
  });
}

/** Drops every cached texture. Called when the renderer is torn down. */
export function disposeMaterialCache() {
  for (const { albedo, roughness } of textureCache.values()) {
    albedo.dispose();
    roughness.dispose();
  }
  textureCache.clear();
}
