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
  gildedVerge?: boolean;
}

interface RoofMaterials {
  tile: THREE.Material;
  ridge: THREE.Material;
  soffit: THREE.Material;
  timber: THREE.Material;
  bronze: THREE.Material;
}

/** Each face runs from a real overhanging eave to a hip, ridge or lantern drum.
 * Barrel tiles, fascia and rafters share that surface, including its lifted corners. */
export function tiledRoof({ name, eave, ridge, height, rise, lift, tileWidth = .215, gildedVerge = false }: RoofSpec, m: RoofMaterials) {
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
    const windward = new THREE.Color('#a9aeb1'), shadow = new THREE.Color('#52616a');
    const rib = (u: number) => Math.max(0, -Math.cos(u * runs * Math.PI * 2));
    // Each course laps the one below it. Paired rows form a rounded lip with a small shadow line.
    const slope = point(.5, 0).distanceTo(point(.5, 1));
    const courses = Math.max(3, Math.round(slope / .32));
    const tileFace = gridSurface(runs * 6, courses * 5, (u, t) => {
      const courseT = (t * courses) % 1;
      const lap = .022 * Math.max(0, 1 - courseT * 2.6) * (1 - t);
      return point(u, t, lap + rib(u) * .046 * (1 - .34 * t));
    }, false, (u, t) => {
      const course = Math.floor(t * courses + .0001), run = Math.min(runs - 1, Math.floor(u * runs));
      const variation = .5 + .5 * Math.sin(run * 13.1 + course * 5.23 + i);
      return shadow.clone().lerp(windward, .22 + .48 * rib(u) + .28 * variation);
    });
    const tileUV = tileFace.getAttribute('uv');
    for (let j = 0; j < tileUV.count; j++) tileUV.setXY(j, tileUV.getX(j) * a.distanceTo(b) / 2, tileUV.getY(j) * slope / 2);
    add(tileFace, m.tile, 'Glazed pan and cover tiles');
    add(gridSurface(20, 8, (u, t) => point(u, t, -.12), true), m.soffit, 'Boarded eave underside');
    add(gridSurface(runs * 3, 1, (u, v) => point(u, 0, -.12 + v * (.12 + .043 * rib(u)))), m.ridge, 'Closed eave and tile lips');
    const eaveLine = Array.from({ length: 21 }, (_, j) => point(j / 20, 0, -.10));
    moulding(eaveLine, .035, m.timber, 'Swept eave fascia');
    const hip = Array.from({ length: 13 }, (_, j) => point(0, j / 12, .055));
    moulding(hip, .065, m.ridge, 'Raised hip ridge');
    if (gildedVerge) {
      const inset = Array.from({length:33}, (_,j) => point(j/32, .014, -.045));
      moulding(inset, .021, m.bronze, 'Bronze seam along the eave');
      // The metal ridge shoe curls past the last tile. In profile it narrows to a lifted beak.
      const tip = hip[0], outward = tip.clone().sub(hip[2]).setY(0).normalize();
      const curve = new THREE.CatmullRomCurve3([
        hip[1].clone().add(new THREE.Vector3(0,.042,0)),
        tip.clone().add(new THREE.Vector3(0,.065,0)),
        tip.clone().addScaledVector(outward,.13).add(new THREE.Vector3(0,.19,0)),
        tip.clone().addScaledVector(outward,.21).add(new THREE.Vector3(0,.43,0)),
      ]);
      const blade = gridSurface(14,7,(t,v) => {
        const p=curve.getPointAt(t), a=v*Math.PI*2, taper=1-t;
        return p.addScaledVector(new THREE.Vector3(-outward.z,0,outward.x),Math.cos(a)*(.075*taper+.004))
          .addScaledVector(new THREE.Vector3(0,1,0),Math.sin(a)*(.065*taper+.002));
      });
      add(blade,m.bronze,'Lifted bronze hip shoe');
    }
    // Clay antefix discs and exposed rafter ends are perceptible looking up from the path.
    const outward = new THREE.Vector3(a.y - b.y, 0, b.x - a.x).normalize();
    const capTemplate = new THREE.CylinderGeometry(.049, .051, .058, 10).rotateX(Math.PI / 2);
    const rafterTemplate = new THREE.CylinderGeometry(.042, .054, 1, 8);
    const caps = new THREE.InstancedMesh(capTemplate, m.ridge, runs);
    const rafterCount = Math.ceil(runs / 2);
    const rafters = new THREE.InstancedMesh(rafterTemplate, m.timber, rafterCount);
    caps.name = 'Round clay tile ends'; rafters.name = 'Splayed eave rafters';
    const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < runs; k++) {
      const end = point((k + .5) / runs, 0, -.015).addScaledVector(outward, .012);
      transform.position.copy(end); transform.rotation.set(0, Math.atan2(outward.x, outward.z), 0);
      transform.scale.set(1, 1, 1); transform.updateMatrix(); caps.setMatrixAt(k, transform.matrix);
    }
    // Centre each run between the hips so both ends, including even-sized bays, have the same margin.
    for (let k = 0; k < rafterCount; k++) {
      const u = (k + .5) / rafterCount;
      const foot = point(u, .005, -.15), head = point(u, .56, -.16), dir = head.clone().sub(foot);
      transform.position.copy(foot).lerp(head, .5); transform.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      transform.scale.set(1, dir.length(), 1); transform.updateMatrix(); rafters.setMatrixAt(k, transform.matrix);
    }
    group.add(caps, rafters);
  }
  return group;
}
