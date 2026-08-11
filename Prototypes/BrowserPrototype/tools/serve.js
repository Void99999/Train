/**
 * Minimal static file server for local development.
 *
 * The game is delivered as native ES modules, and browsers refuse to load
 * those over `file://`. Opening index.html by double-click therefore shows a
 * blank page - the modules are blocked by CORS, not broken. Serving the
 * folder over HTTP is all that is needed:
 *
 *     npm start            ->  http://localhost:8080
 *     npm start -- 3000    ->  http://localhost:3000
 *
 * No dependencies on purpose: the toolchain should never be a reason the
 * project fails to run on a fresh machine.
 */

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

/**
 * Resolves a request path to a file inside the project. Returns null when the
 * path would escape the project root, so a crafted URL cannot read the rest of
 * the machine.
 */
function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const target = join(ROOT, relative);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

async function resolveFile(target) {
  try {
    const info = await stat(target);
    if (info.isDirectory()) return resolveFile(join(target, "index.html"));
    return target;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const target = resolveRequestPath(request.url || "/");
  const file = target ? await resolveFile(target) : null;

  if (!file) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("404 Not Found");
    return;
  }

  response.writeHead(200, {
    "content-type": MIME_TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    // Development server: never let a stale module linger after an edit.
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`LAST TRAIN dev server:  http://localhost:${PORT}`);
  console.log(`Serving:                ${ROOT}`);
  console.log(`Prototype intro:        http://localhost:${PORT}/prototype/`);
});
