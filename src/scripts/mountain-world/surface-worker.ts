import { definitions, generateSurfacePixels, type PreparedSurfaces, type SurfaceKind } from './surface-pixels';

// This module runs once in a dedicated worker after the visitor enters.
const maps: PreparedSurfaces = new Map();
const buffers: ArrayBuffer[] = [];
for (const kind of Object.keys(definitions) as SurfaceKind[]) {
  const pixels = generateSurfacePixels(kind);
  maps.set(kind, pixels);
  buffers.push(pixels.albedo.buffer, pixels.normal.buffer, pixels.orm.buffer);
}
self.postMessage(maps, { transfer: buffers });
