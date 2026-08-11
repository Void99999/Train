/**
 * LAST TRAIN - entry point.
 *
 * Finds the surfaces the interface draws on, builds the game, and starts it.
 * Anything that can go wrong before the first frame is thrown so that
 * index.html can show the player something more useful than a black screen.
 */

import { Game } from "./game.js";

export async function boot() {
  const canvas = document.getElementById("scene");
  const overlay = document.getElementById("overlay");
  const hudRoot = document.getElementById("hud");

  if (!canvas || !overlay || !hudRoot) {
    throw new Error("The page is missing its canvas or interface containers.");
  }

  if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) {
    throw new Error("This browser or machine does not support WebGL.");
  }

  const game = new Game({ canvas, overlay, hudRoot });
  game.start();

  // Handy while developing; harmless in a build.
  globalThis.lastTrain = game;
  return game;
}
