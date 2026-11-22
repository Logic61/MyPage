import * as THREE from 'three';
import { gridSurface } from './environment-geometry';

type Ring = THREE.Vector2[];

export function rectangularRing(x: number, z: number, halfWidth: number, halfDepth: number): Ring {
  return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([u, v]) =>
    new THREE.Vector2(x + u * halfWidth, z + v * halfDepth));
}

export function hexagonalRing(x: number, z: number, radius: number): Ring {
  return Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3;
    return new THREE.Vector2(x + Math.cos(a) * radius, z - Math.sin(a) * radius);
  });
}

interface RoofSpec {
  name: string;
  eave: Ring;
  ridge: Ring;
  height: number;
  rise: number;
  lift: number;
  tileWidth?: number;
}

interface RoofMaterials {
  tile: THREE.Material;
  ridge: THREE.Material;
  soffit: THREE.Material;
  timber: THREE.Material;
}

/** Each face runs from a real overhanging eave to a hip, ridge or lantern drum.
 * Barrel tiles, fascia and rafters share that surface, including its lifted corners. */
export function tiledRoof({ name, eave, ridge, height, rise, lift, tileWidth = .215 }: RoofSpec, m: RoofMaterials) {
  const group = new THREE.Group();
  group.name = name;
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, label: string) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = label; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  };
  function moulding(points: THREE.Vector3[], radius: number, material: THREE.Material, label: string) {
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length, radius, 8, false), material, label);
  }
  for (let i = 0; i < eave.length; i++) {
    const next = (i + 1) % eave.length;
    const a = eave[i], b = eave[next], c = ridge[i], d = ridge[next];
    const runs = Math.max(4, Math.round(a.distanceTo(b) / tileWidth));
    const point = (u: number, t: number, offset = 0) => {
      const outerX = THREE.MathUtils.lerp(a.x, b.x, u), outerZ = THREE.MathUtils.lerp(a.y, b.y, u);
      const innerX = THREE.MathUtils.lerp(c.x, d.x, u), innerZ = THREE.MathUtils.lerp(c.y, d.y, u);
      const corner = Math.pow(Math.abs(2 * u - 1), 4);
      const y = height + rise * (.20 * t + .80 * t * t) + lift * corner * (1 - t) ** 2;
      return new THREE.Vector3(THREE.MathUtils.lerp(outerX, innerX, t), y + offset, THREE.MathUtils.lerp(outerZ, innerZ, t));
    };
    const windward = new THREE.Color('#8caaa5'), shadow = new THREE.Color('#536e70');
    const rib = (u: number) => Math.max(0, Math.cos(u * runs * Math.PI * 2));
    // Five samples across each cover tile give a rounded silhouette without separate tile meshes.
    add(gridSurface(runs * 6, 20, (u, t) => point(u, t, rib(u) * .046 * (1 - .34 * t)),
      false, (u, t) => {
        const course = Math.floor(t * 10), run = Math.round(u * runs);
        const variation = .5 + .5 * Math.sin(run * 13.1 + course * .91);
        return shadow.clone().lerp(windward, .17 + .62 * rib(u) + .16 * variation);
      }), m.tile, 'Glazed pan and cover tiles');
    add(gridSurface(20, 8, (u, t) => point(u, t, -.12), true), m.soffit, 'Boarded eave underside');
    add(gridSurface(runs * 3, 1, (u, v) => point(u, 0, -.12 + v * (.12 + .043 * rib(u)))), m.ridge, 'Closed eave and tile lips');
    const eaveLine = Array.from({ length: 21 }, (_, j) => point(j / 20, 0, -.10));
    moulding(eaveLine, .035, m.timber, 'Swept eave fascia');
    const hip = Array.from({ length: 13 }, (_, j) => point(0, j / 12, .055));
    moulding(hip, .065, m.ridge, 'Raised hip ridge');
    // Clay antefix discs and exposed rafter ends are perceptible looking up from the path.
    const outward = new THREE.Vector3(a.y - b.y, 0, b.x - a.x).normalize();
    const capTemplate = new THREE.CylinderGeometry(.049, .051, .058, 10).rotateX(Math.PI / 2);
    const rafterTemplate = new THREE.CylinderGeometry(.042, .054, 1, 8);
    const caps = new THREE.InstancedMesh(capTemplate, m.ridge, runs);
    const rafters = new THREE.InstancedMesh(rafterTemplate, m.timber, Math.ceil(runs / 2));
    caps.name = 'Round clay tile ends'; rafters.name = 'Splayed eave rafters';
    const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < runs; k++) {
      const u = k / runs, end = point(u, 0, -.015).addScaledVector(outward, .012);
      transform.position.copy(end); transform.rotation.set(0, Math.atan2(outward.x, outward.z), 0);
      transform.scale.set(1, 1, 1); transform.updateMatrix(); caps.setMatrixAt(k, transform.matrix);
      if (k % 2) continue;
      const foot = point(u, .005, -.15), head = point(u, .56, -.16), dir = head.clone().sub(foot);
      transform.position.copy(foot).lerp(head, .5); transform.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      transform.scale.set(1, dir.length(), 1); transform.updateMatrix(); rafters.setMatrixAt(k / 2, transform.matrix);
    }
    group.add(caps, rafters);
  }
  return group;
}
