import * as THREE from 'three';
import type { Interaction } from './types';

export const FLOOR_HEIGHT = 0.3;
export const EYE_HEIGHT = 1.68;
export const SEATED_EYE_HEIGHT = 0.8;

/** Camera yaw zero looks down -Z. Forward and strafe share that convention. */
export function movementDirection(yaw: number, forward: number, right: number) {
  const length = Math.max(1, Math.hypot(forward, right));
  return {
    x: (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length,
  };
}

function isVisible(object: THREE.Object3D): boolean {
  for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
    if (!parent.visible || parent.userData.ignoreInteractionRay === true) return false;
  }
  return true;
}

const CHUNK_INDICES = 128 * 3;
interface TriangleChunks {
  position: THREE.BufferAttribute;
  positionVersion: number;
  index: THREE.BufferAttribute | null;
  indexVersion: number;
  count: number;
  /** Six bounds per consecutive triangle chunk, in the geometry's local space. */
  bounds: Float64Array;
}
const chunkCache = new WeakMap<THREE.BufferGeometry, TriangleChunks>();

function triangleChunks(geometry: THREE.BufferGeometry): TriangleChunks | null {
  const position = geometry.getAttribute('position'), index = geometry.index;
  if (!(position instanceof THREE.BufferAttribute) || geometry.morphAttributes.position?.length) return null;
  const count = index?.count ?? position.count;
  if (count < CHUNK_INDICES * 2 || count % 3) return null;
  const previous = chunkCache.get(geometry);
  if (previous?.position === position && previous.positionVersion === position.version
    && previous.index === index && previous.indexVersion === (index?.version ?? -1) && previous.count === count) return previous;

  const bounds = new Float64Array(Math.ceil(count / CHUNK_INDICES) * 6);
  for (let start = 0, offset = 0; start < count; start += CHUNK_INDICES, offset += 6) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = start, end = Math.min(count, start + CHUNK_INDICES); i < end; i++) {
      const vertex = index ? index.getX(i) : i;
      const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
    }
    // Conservative padding protects rays exactly on a chunk boundary. It only
    // admits more exact tests; these boxes never decide a hit or an occlusion.
    bounds.set([minX - 1e-5, minY - 1e-5, minZ - 1e-5, maxX + 1e-5, maxY + 1e-5, maxZ + 1e-5], offset);
  }
  const result = { position, positionVersion: position.version, index, indexVersion: index?.version ?? -1, count, bounds };
  chunkCache.set(geometry, result);
  // Mesh.raycast also uses this sphere. Refresh it when editable vertices change.
  if (!geometry.boundingSphere || previous) geometry.computeBoundingSphere();
  if (previous && geometry.boundingBox) geometry.computeBoundingBox();
  return result;
}

/** Slab test of a finite local-space ray segment against one conservative box. */
function segmentIntersects(bounds: Float64Array, offset: number, start: THREE.Vector3, end: THREE.Vector3): boolean {
  let near = 0, far = 1;
  for (let axis = 0; axis < 3; axis++) {
    const origin = start.getComponent(axis), direction = end.getComponent(axis) - origin;
    const low = bounds[offset + axis], high = bounds[offset + axis + 3];
    if (direction === 0) { if (origin < low || origin > high) return false; continue; }
    const a = (low - origin) / direction, b = (high - origin) / direction;
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    if (near > far) return false;
  }
  return true;
}

function solidMaterial(material: THREE.Material | undefined): boolean {
  return Boolean(material?.visible && !(material.transparent && material.opacity < 0.5));
}

function solidHit(hit: THREE.Intersection): boolean {
  if (!isVisible(hit.object)) return false;
  const material = (hit.object as THREE.Mesh).material;
  return solidMaterial(Array.isArray(material) ? material[hit.face?.materialIndex ?? 0] : material);
}

/** Exact target hits first; only a reachable target needs a finite occlusion ray. */
export function createInteractionPicker(roots: THREE.Object3D[], interactions: Interaction[]) {
  const objects: THREE.Mesh[] = [];
  const owner = new WeakMap<THREE.Object3D, Interaction>();
  const seen = new Set<THREE.Object3D>();
  roots.forEach(root => root.traverse(object => {
    if (object instanceof THREE.Mesh && !seen.has(object)) { seen.add(object); objects.push(object); }
  }));
  interactions.forEach(item => item.meshes.forEach(target => target.traverse(object => owner.set(object, item))));
  const targets = objects.map((mesh, order) => ({ mesh, order })).filter(({ mesh }) => owner.has(mesh));
  const blockers = objects.map((mesh, order) => ({ mesh, order })).filter(({ mesh }) => !owner.has(mesh));
  const raycaster = new THREE.Raycaster();
  const centre = new THREE.Vector2();
  const maximumReach = Math.max(0, ...interactions.map(item => item.radius));
  const inverse = new THREE.Matrix4(), segmentStart = new THREE.Vector3(), segmentEnd = new THREE.Vector3();
  const hits: THREE.Intersection[] = [];
  raycaster.near = 0.03;
  raycaster.far = maximumReach;

  function canChunk(mesh: THREE.Mesh) {
    // Skinned/instanced/custom raycasts own their transforms or vertex positions.
    // Their original Three raycast remains the safe exact fallback.
    return !(mesh instanceof THREE.InstancedMesh) && !(mesh instanceof THREE.SkinnedMesh)
      && mesh.raycast === THREE.Mesh.prototype.raycast
      && mesh.getVertexPosition === THREE.Mesh.prototype.getVertexPosition;
  }
  // Build once before exploration, instead of introducing a first-hover CPU spike.
  for (const mesh of objects) if (canChunk(mesh)) triangleChunks(mesh.geometry);

  function intersect(mesh: THREE.Mesh) {
    hits.length = 0;
    if (!mesh.layers.test(raycaster.layers) || !isVisible(mesh)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(solidMaterial)) return;
    const geometry = mesh.geometry;
    const chunks = canChunk(mesh) && geometry.drawRange.start % 3 === 0
      && geometry.groups.every(group => group.start % 3 === 0 && (!Number.isFinite(group.count) || group.count % 3 === 0))
      ? triangleChunks(geometry) : null;
    if (!chunks) { mesh.raycast(raycaster, hits); return; }

    inverse.copy(mesh.matrixWorld).invert();
    raycaster.ray.at(raycaster.near, segmentStart).applyMatrix4(inverse);
    raycaster.ray.at(raycaster.far, segmentEnd).applyMatrix4(inverse);
    const savedStart = geometry.drawRange.start, savedCount = geometry.drawRange.count;
    const end = Math.min(chunks.count, savedStart + savedCount);
    try {
      for (let start = 0, offset = 0; start < end; start += CHUNK_INDICES, offset += 6) {
        const from = Math.max(savedStart, start), to = Math.min(end, start + CHUNK_INDICES);
        if (from >= to || !segmentIntersects(chunks.bounds, offset, segmentStart, segmentEnd)) continue;
        // Reuse Three's triangle/material-group/side/faceIndex logic. No proxy
        // surface can invent an occluder. Restore the shared draw range below.
        geometry.setDrawRange(from, to - from);
        mesh.raycast(raycaster, hits);
      }
    } finally { geometry.setDrawRange(savedStart, savedCount); }
  }

  function pick(camera: THREE.Camera, point: THREE.Vector2 = centre): Interaction | null {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(point, camera);
    raycaster.far = maximumReach;
    let target: THREE.Intersection | null = null, targetOrder = Infinity;
    for (const { mesh, order } of targets) {
      intersect(mesh);
      for (const hit of hits) if (solidHit(hit) && (!target || hit.distance < target.distance)) {
        target = hit; targetOrder = order;
      }
      if (target) raycaster.far = target.distance;
    }
    if (!target) return null;
    const item = owner.get(target.object);
    if (!item || target.distance > item.radius) return null;

    // Preserve the old stable ordering for exactly coplanar target/blocker hits.
    for (const { mesh, order } of blockers) {
      intersect(mesh);
      if (hits.some(hit => solidHit(hit) && (hit.distance < target!.distance
        || (hit.distance === target!.distance && order < targetOrder)))) return null;
    }
    return item;
  }
  return { pick };
}
