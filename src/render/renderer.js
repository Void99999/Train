/**
 * LAST TRAIN - the rendering context.
 *
 * Owns the WebGL renderer, the camera and the resize handling, and nothing
 * about the game. Quality settings live here so that a machine that cannot
 * hold the frame rate can be stepped down without any other file knowing.
 */

import * as THREE from "../../vendor/three/three.module.js";

export const QUALITY = {
  low: {
    id: "low",
    shadows: false,
    shadowMapSize: 512,
    maxPixelRatio: 1,
    anisotropy: 1,
  },
  medium: {
    id: "medium",
    shadows: true,
    shadowMapSize: 1024,
    maxPixelRatio: 1.5,
    anisotropy: 4,
  },
  high: {
    id: "high",
    shadows: true,
    shadowMapSize: 2048,
    maxPixelRatio: 2,
    anisotropy: 8,
  },
};

export class Renderer {
  #renderer;
  #camera;
  #canvas;
  #quality;
  #onResize;

  constructor({ canvas, quality = QUALITY.high }) {
    this.#canvas = canvas;
    this.#quality = quality;

    this.#renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });

    // Filmic tone mapping and sRGB output: the difference between "3D shapes"
    // and something that reads as photographed.
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Slightly hot on purpose: ACES rolls the highlights off gently, so a
    // little extra exposure lifts the shadows without blowing the lamps out.
    this.#renderer.toneMappingExposure = 1.35;
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.shadowMap.enabled = quality.shadows;
    this.#renderer.shadowMap.type = THREE.PCFShadowMap;

    this.#camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

    this.#onResize = () => this.resize();
    globalThis.addEventListener?.("resize", this.#onResize);
    this.resize();
  }

  get camera() {
    return this.#camera;
  }

  get quality() {
    return this.#quality;
  }

  get three() {
    return this.#renderer;
  }

  resize() {
    const width = this.#canvas.clientWidth || globalThis.innerWidth || 1;
    const height = this.#canvas.clientHeight || globalThis.innerHeight || 1;

    this.#renderer.setPixelRatio(
      Math.min(globalThis.devicePixelRatio ?? 1, this.#quality.maxPixelRatio),
    );
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  render(scene) {
    this.#renderer.render(scene, this.#camera);
  }

  dispose() {
    globalThis.removeEventListener?.("resize", this.#onResize);
    this.#renderer.dispose();
  }
}
