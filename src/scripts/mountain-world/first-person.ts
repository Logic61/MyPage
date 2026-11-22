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

/** A centre-screen ray stops at the first solid surface, even if it is not interactive. */
export function createInteractionPicker(roots: THREE.Object3D[], interactions: Interaction[]) {
  const objects: THREE.Mesh[] = [];
  const owner = new WeakMap<THREE.Object3D, Interaction>();
  roots.forEach(root => root.traverse(object => {
    if (object instanceof THREE.Mesh) objects.push(object);
  }));
  interactions.forEach(item => item.meshes.forEach(target => target.traverse(object => owner.set(object, item))));
  const raycaster = new THREE.Raycaster();
  const centre = new THREE.Vector2();
  const maximumReach = Math.max(0, ...interactions.map(item => item.radius));
  raycaster.near = 0.03;
  raycaster.far = maximumReach;

  function pick(camera: THREE.Camera): Interaction | null {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(centre, camera);
    const hits = raycaster.intersectObjects(objects, false);
    for (const hit of hits) {
      if (!isVisible(hit.object)) continue;
      const mesh = hit.object as THREE.Mesh;
      const material = Array.isArray(mesh.material)
        ? mesh.material[hit.face?.materialIndex || 0] : mesh.material;
      if (!material?.visible || (material.transparent && material.opacity < 0.5)) continue;
      const item = owner.get(hit.object);
      return item && hit.distance <= item.radius ? item : null;
    }
    return null;
  }
  return { pick };
}
