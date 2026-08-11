/**
 * Just enough browser for the render layer to build its geometry in Node.
 *
 * The render modules generate all their textures procedurally onto a 2D
 * canvas. None of that matters to a test that asks where a door ended up, but
 * without a canvas the module cannot even be constructed - so the geometry,
 * which is the part worth checking, would go untested forever.
 *
 * This stub draws nothing. It hands back correctly sized pixel buffers and
 * swallows the drawing calls, which is all three.js needs to build a texture
 * object it will never upload to a GPU.
 *
 * Import this before anything under src/render.
 */

class StubContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = "#000";
    this.font = "";
    this.textAlign = "left";
    this.textBaseline = "alphabetic";
  }

  fillRect() {}
  fillText() {}

  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }

  getImageData(x, y, width, height) {
    return this.createImageData(width, height);
  }

  putImageData() {}
}

class StubCanvas {
  width = 300;
  height = 150;

  getContext() {
    return new StubContext(this);
  }
}

/** Installs the stub globals. Safe to call more than once. */
export function installDomStub() {
  if (globalThis.document) return;

  globalThis.document = {
    createElement(tag) {
      if (tag === "canvas") return new StubCanvas();
      throw new Error(`the DOM stub only makes canvases, not <${tag}>`);
    },
  };

  // three.js checks for these when deciding how to handle a texture source.
  globalThis.HTMLCanvasElement = StubCanvas;
  globalThis.ImageBitmap = class ImageBitmap {};
}

installDomStub();
