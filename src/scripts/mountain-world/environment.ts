import * as THREE from 'three';
import type { Collider, Environment, WalkArea } from './types';

/** A small, continuous mountain ledge. All accessible surfaces meet at y = .3. */
export function createEnvironment(scene: THREE.Scene): Environment {
  const root = new THREE.Group();
  root.name = 'Mountain — the inhabited ledge';
  scene.add(root);
  const colliders: Collider[] = [];
  const roofOccluders: THREE.Object3D[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const keepGeometry = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const keepMaterial = <T extends THREE.Material>(m: T): T => { materials.add(m); return m; };
  const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const random = rng(12391);
  const standard = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => keepMaterial(new THREE.MeshStandardMaterial({ color, roughness: .94, metalness: 0, ...extra }));
  const mat = {
    stone: standard('#7b8076', { flatShading: true }),
    darkStone: standard('#535f5c', { flatShading: true }),
    lightStone: standard('#a5a997', { flatShading: true }),
    warmStone: standard('#9d967d', { flatShading: true }),
    path: standard('#b3b39f', { flatShading: true }),
    moss: standard('#536a57', { flatShading: true }),
    wood: standard('#514735'),
    weatheredWood: standard('#8c7e60'),
    timberEdge: standard('#322d25'),
    leaf: standard('#38584e', { flatShading: true }),
    bamboo: standard('#72806a'),
    bambooLeaf: standard('#516e5d', { side: THREE.DoubleSide, flatShading: true }),
    rope: standard('#b6a78a'),
    brass: standard('#b99a59', { roughness: .55, metalness: .38 }),
  };
  const box = keepGeometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = keepGeometry(new THREE.CylinderGeometry(1, 1, 1, 7));
  const sphere = keepGeometry(new THREE.IcosahedronGeometry(1, 1));
  const pineCrown = keepGeometry(new THREE.IcosahedronGeometry(1, 1));
  const block = keepGeometry(makeWeatheredBlock());
  const rockGeometries = [0, 1, 2].map(n => keepGeometry(makeRock(49 + n * 31)));
  const pathStone = keepGeometry(new THREE.CylinderGeometry(1, 1.05, 1, 6, 1));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const vector = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function mesh(g: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number,
    sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = root) {
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function beam(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, parent: THREE.Object3D = root) {
    const delta = b.clone().sub(a);
    const m = mesh(cylinder, material, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, radius, delta.length(), radius, parent);
    m.quaternion.setFromUnitVectors(up, delta.normalize()); return m;
  }
  interface Instance { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry?: number; rx?: number; rz?: number; color?: THREE.Color; }
  function instances(g: THREE.BufferGeometry, material: THREE.Material, items: Instance[], parent: THREE.Object3D = root) {
    const m = new THREE.InstancedMesh(g, material, items.length);
    items.forEach((item, i) => {
      quaternion.setFromEuler(new THREE.Euler(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0));
      matrix.compose(vector.set(item.x, item.y, item.z), quaternion, scale.set(item.sx, item.sy, item.sz));
      m.setMatrixAt(i, matrix);
      if (item.color) m.setColorAt(i, item.color);
    });
    m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere(); parent.add(m); return m;
  }
  function collider(x: number, z: number, halfX: number, halfZ: number) { colliders.push({ x, z, halfX, halfZ }); }
  // Project the actual transformed vertices, rather than rotating an existing AABB:
  // the latter greatly overestimates the footprint of our irregular cliff rocks.
  function colliderFromGeometry(geometry: THREE.BufferGeometry, transform: THREE.Matrix4) {
    const bounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(transform);
      bounds.expandByPoint(vertex);
    }
    // Decorative strata wholly below the floor, or above the visitor, are not walls.
    if (bounds.max.y <= .35 || bounds.min.y >= 1.95) return;
    const padding = .025;
    collider((bounds.min.x + bounds.max.x) / 2, (bounds.min.z + bounds.max.z) / 2,
      (bounds.max.x - bounds.min.x) / 2 + padding, (bounds.max.z - bounds.min.z) / 2 + padding);
  }
  function colliderForMesh(object: THREE.Mesh) {
    object.updateMatrix();
    colliderFromGeometry(object.geometry, object.matrix);
  }

  // The ledge has a hand-shaped silhouette and a clearly visible layered rock face.
  const outline = [
    [-14.5, -11.7], [-7.8, -14.2], [.2, -13.2], [8.7, -12.4], [13.7, -8.4],
    [15.0, -1.2], [14.1, 8.3], [10.7, 12.0], [5.5, 14.4], [3.6, 17.1],
    [-1.1, 17.9], [-5.1, 15.1], [-11.4, 12.0], [-14.9, 6.1], [-16.0, -.8],
  ];
  const cliffMaterial = keepMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  const cliff = mesh(keepGeometry(makeLedge(outline)), cliffMaterial, 0, 0, 0);
  cliff.name = 'Layered rock ledge';
  cliff.castShadow = false;

  // A slight top layer keeps the playable plane precise while the edge is irregular.
  const groundShape = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], -p[1])));
  const ground = mesh(keepGeometry(new THREE.ShapeGeometry(groundShape)), standard('#8e9581'), 0, .255, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;

  // Lichen, pebbles and seam stones form restrained patches, never a noisy all-over scatter.
  const pebbles: Instance[] = [];
  const moss: Instance[] = [];
  const patches = [[-11, 7, 2.8], [-10.5, -3, 2], [11.7, 10, 1.7], [-5.7, 11.7, 2.2], [7.3, -10.5, 2]];
  for (const [cx, cz, radius] of patches) {
    for (let i = 0; i < 16; i++) {
      const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius;
      pebbles.push({ x: cx + Math.cos(angle) * distance, y: .31, z: cz + Math.sin(angle) * distance,
        sx: .1 + random() * .3, sy: .06 + random() * .12, sz: .1 + random() * .24, ry: random() * 6 });
    }
    for (let i = 0; i < 5; i++) moss.push({ x: cx + (random() - .5) * radius, y: .27, z: cz + (random() - .5) * radius,
      sx: .45 + random() * .6, sy: .015, sz: .3 + random() * .5, ry: random() * 6 });
  }
  instances(rockGeometries[0], mat.lightStone, pebbles);
  instances(sphere, mat.moss, moss).castShadow = false;

  // Uneven flagstones make a quiet path from the entry to the wide, warm doorway.
  // Their whole six-sided footprints (including the wider bottom ring) fit inside
  // the row/column spacing. Coplanar overlap here produces visible depth fighting.
  const paving: Instance[] = [];
  for (let i = 0; i < 13; i++) {
    const z = 13.6 - i * 1.12, center = 1.4 + Math.sin(i * .42) * .65;
    for (let side = -1; side <= 1; side++) paving.push({
      x: center + side * .91 + (random() - .5) * .03, y: .278, z: z + (random() - .5) * .03,
      sx: .385 + random() * .025, sy: .062, sz: .45 + random() * .03, ry: (random() - .5) * .08,
      color: new THREE.Color().setScalar(.88 + random() * .15),
    });
  }
  // The branch starts beyond the main stones and ends at the timber veranda,
  // leaving the material transition clear instead of overlapping either surface.
  for (let i = 0; i < 5; i++) {
    const x = 3.7 + i * .8, z = 6.6 - Math.sin(i / 4 * Math.PI) * .75;
    paving.push({ x, y: .278, z, sx: .34, sy: .062, sz: .42, ry: (random() - .5) * .1 });
  }
  instances(pathStone, mat.path, paving).name = 'Separated flagstones';

  // The room is carved into stone, with an inset, warm-toned floor and a real threshold.
  // Base top = .290; tile top = .308; the .018 relief exposes real grout gaps.
  mesh(box, mat.warmStone, 0, .145, -5.5, 12.2, .29, 9.2).name = 'Recessed room floor base';
  const floorTiles: Instance[] = [];
  for (let x = -5.25; x < 6; x += 1.5) for (let z = -9.25; z < -1; z += 1.5)
    floorTiles.push({ x, y: .296, z, sx: 1.46, sy: .024, sz: 1.46, color: new THREE.Color().setScalar(.92 + random() * .14) });
  const tiles = instances(box, mat.warmStone, floorTiles);
  tiles.name = 'Raised room floor tiles'; tiles.castShadow = false;
  mesh(block, mat.lightStone, 0, .243, -.94, 5.3, .14, .75);
  mesh(box, mat.wood, 0, .25, -.6, 5.12, .1, .16);

  // The north and west walls remain visible when the front roof is faded out.
  mesh(block, mat.darkStone, 0, 2.8, -10.4, 13.4, 5.6, 1.1);
  mesh(block, mat.darkStone, -6.35, 2.6, -5.5, 1.15, 5.2, 10.5);
  collider(0, -10.38, 6.55, .55);
  collider(-6.35, -5.5, .6, 5.25);
  // The side door is centred at z=-5 and stays clear over z[-6.6,-3.4].
  mesh(block, mat.stone, 6.35, .9, -8.55, 1.15, 1.8, 3.9);
  mesh(block, mat.stone, 6.35, .9, -2.18, 1.15, 1.8, 2.45);
  collider(6.35, -8.55, .6, 1.95);
  collider(6.35, -2.18, .6, 1.22);
  const sideLintel = mesh(block, mat.stone, 6.35, 4.6, -5, 1.2, 1.1, 3.25);
  // Low interior stone skirting and wood rails lend the room a lived-in scale.
  mesh(box, mat.wood, 0, .55, -9.8, 11.7, .28, .17);
  mesh(box, mat.wood, -5.76, .55, -5.5, .17, .28, 8.55);
  mesh(box, mat.weatheredWood, 0, 4.35, -9.79, 11.7, .17, .2);
  for (const x of [-5.45, 5.45]) mesh(block, mat.wood, x, 2.43, -1.28, .25, 4.3, .3);

  // Thick asymmetrical entrance piers have a deliberately generous central opening.
  const leftPier = mesh(block, mat.stone, -4.65, 2.66, -.93, 4.05, 5.3, 1.55);
  leftPier.rotation.z = -.035;
  const rightPier = mesh(block, mat.stone, 4.65, 2.3, -.95, 4.05, 4.6, 1.5);
  rightPier.rotation.z = .025;
  colliderForMesh(leftPier);
  colliderForMesh(rightPier);
  mesh(block, mat.lightStone, -2.77, 2.5, -.76, .34, 4.6, .68);
  mesh(block, mat.lightStone, 2.77, 2.5, -.76, .34, 4.6, .68);
  mesh(block, mat.wood, 0, 4.68, -.66, 5.55, .28, .52);
  mesh(box, mat.weatheredWood, 0, 4.55, -.37, 5.1, .05, .09);
  // Small dowels and the underside of the eave catch the afternoon light.
  for (const x of [-2.32, -1.18, 0, 1.18, 2.32]) mesh(block, mat.wood, x, 4.77, -.43, .18, .19, 1.5);
  // A dark grain line makes the wooden structure readable without texture downloads.
  mesh(box, mat.timberEdge, 0, 4.73, -.38, 5.48, .032, .024);

  // The cutaway has its own materials: changing its opacity never fades distant rocks.
  const roof = new THREE.Group(); roof.name = 'Cave roof — controlled cutaway'; root.add(roof);
  const roofStone = keepMaterial(mat.stone.clone());
  const roofDark = keepMaterial(mat.darkStone.clone());
  roofStone.transparent = true; roofDark.transparent = true;
  mesh(block, roofDark, 0, 5.67, -6.04, 13.25, 1.24, 9.5, roof);
  const arch = mesh(rockGeometries[1], roofStone, -.2, 5.66, -.72, 6.95, 1.0, 1.3, roof);
  arch.rotation.z = -.035;
  mesh(rockGeometries[0], roofStone, -4.4, 6.28, -4.15, 3.9, 1.45, 3.3, roof);
  mesh(rockGeometries[2], roofDark, 2.6, 6.0, -7.75, 4.4, 1.15, 3.6, roof);
  // The near-side upper rim can disappear with the roof; the side door remains tangible.
  mesh(block, roofStone, 6.35, 3.1, -8.55, 1.15, 2.6, 3.9, roof);
  mesh(block, roofStone, 6.35, 2.85, -2.18, 1.15, 2.1, 2.45, roof);
  const upperSide = mesh(block, roofStone, 6.35, 4.5, -8.45, 1.18, .75, 3.9, roof);
  upperSide.name = 'East upper rim';
  sideLintel.material = roofStone; roof.attach(sideLintel);
  roofOccluders.push(roof);
  const roofMeshes: THREE.Mesh[] = [];
  const roofMaterials = new Set<THREE.Material>();
  roof.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    roofMeshes.push(object);
    const assigned = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of assigned) {
      material.transparent = true;
      material.opacity = 1;
      material.depthWrite = true;
      roofMaterials.add(material);
    }
  });
  let roofOpacity = 1;

  // The mountain is behind and beside the room, never a solid lump over its centre.
  const flankRocks: Instance[][] = [[], [], []];
  const bigRocks = [
    [-9.4, 2.2, -7.3, 3.5, 4.0, 4.6], [-10.1, 1.8, -1.7, 3.15, 3.15, 3.65],
    [-7.6, 4.8, -12.15, 4.0, 4.9, 3.2], [-2.8, 5.7, -13.0, 3.7, 5.8, 2.7],
    [2.8, 4.4, -13.4, 3.7, 4.5, 2.8], [8.0, 2.7, -13.4, 3.2, 3.2, 2.6],
    [-12.9, -.8, 2.3, 2.5, 2.0, 3.0], [-12.1, -.8, 9.6, 3.0, 2.2, 2.3],
    [12.8, -1.6, 10.6, 2.9, 2.5, 2.4], [6.8, -2.2, 15.2, 3.2, 2.7, 2.4],
  ];
  bigRocks.forEach((r, i) => flankRocks[i % 3].push({ x: r[0], y: r[1], z: r[2], sx: r[3], sy: r[4], sz: r[5], ry: random() * .8, rz: (random() - .5) * .2 }));
  flankRocks.forEach((r, i) => {
    const rocks = instances(rockGeometries[i], i === 1 ? mat.darkStone : mat.stone, r);
    rocks.name = `Solid cliff rocks ${i + 1}`;
    for (let instance = 0; instance < rocks.count; instance++) {
      rocks.getMatrixAt(instance, matrix);
      colliderFromGeometry(rocks.geometry, matrix);
    }
  });
  // Additional strata, protruding from the cliff, make the diorama feel like geology.
  const strata: Instance[] = [];
  for (let i = 0; i < 18; i++) {
    const t = i / 17 * Math.PI;
    strata.push({ x: Math.cos(t) * (11.8 + random()), y: -1.0 - random() * 4.0,
      z: Math.sin(t) * 9.5 + 2.4, sx: 1.0 + random() * 2.8, sy: .35 + random() * .5, sz: 1 + random() * 1.4,
      ry: -.25 + random() * .5, rz: (random() - .5) * .15 });
  }
  instances(block, mat.darkStone, strata);

  // Eastern veranda: a narrow, safe loop from the side door to the lookout and yard.
  mesh(box, mat.wood, 10.15, .1, .1, 5.65, .34, 16.4);
  const deckBoards: Instance[] = [];
  for (let i = 0; i < 32; i++) deckBoards.push({ x: 10.15, y: .278, z: -7.85 + i * .5, sx: 5.57, sy: .044, sz: .465,
    color: new THREE.Color().setScalar(.86 + random() * .23) });
  instances(box, mat.weatheredWood, deckBoards);
  // Two boards bridge the small threshold between stone and timber.
  mesh(box, mat.weatheredWood, 6.85, .28, -5, 1.05, .04, 3.15);
  const railPosts: Instance[] = [];
  for (let z = -7.7; z <= 8.4; z += 2.2) railPosts.push({ x: 12.83, y: .91, z, sx: .14, sy: 1.22, sz: .14 });
  for (let x = 8.0; x <= 12.7; x += 2.25) railPosts.push({ x, y: .91, z: -7.9, sx: .14, sy: 1.22, sz: .14 });
  instances(block, mat.wood, railPosts);
  beam(new THREE.Vector3(12.83, 1.5, -7.9), new THREE.Vector3(12.83, 1.5, 8.3), .065, mat.weatheredWood);
  beam(new THREE.Vector3(12.83, .9, -7.9), new THREE.Vector3(12.83, .9, 8.3), .04, mat.wood);
  beam(new THREE.Vector3(7.8, 1.5, -7.9), new THREE.Vector3(12.83, 1.5, -7.9), .065, mat.weatheredWood);
  collider(12.9, .2, .12, 8.3);
  collider(10.3, -7.95, 2.7, .12);
  // Exterior braces visibly support the overhanging deck.
  for (const z of [-6.3, -.2, 6.4]) {
    beam(new THREE.Vector3(9.7, -2.1, z), new THREE.Vector3(12.6, -.1, z), .11, mat.wood);
    mesh(box, mat.wood, 11, -.18, z, 4.1, .3, .24);
  }

  // The southward stair continues below the walk boundary; no invisible elevation changes.
  const stairs: Instance[] = [];
  for (let i = 0; i < 15; i++) stairs.push({ x: 1.4 + Math.sin(i * .17) * .25, y: .12 - i * .3,
    z: 14.6 + i * .69, sx: 4.0 - i * .035, sy: .34, sz: .89, ry: Math.sin(i * .18) * .02 });
  instances(block, mat.lightStone, stairs);
  mesh(rockGeometries[1], mat.darkStone, -2.1, -1.8, 17.3, 1.4, 2.2, 3.0);
  mesh(rockGeometries[0], mat.stone, 4.1, -2.2, 18.8, 1.4, 2.6, 3.2);

  // Trees use one instanced batch for timber and one for foliage, including the bent pine.
  const branches: Instance[] = [], crowns: Instance[] = [];
  function branchInstance(a: THREE.Vector3, b: THREE.Vector3, width: number) {
    const length = a.distanceTo(b); quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    const e = new THREE.Euler().setFromQuaternion(quaternion);
    branches.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, sx: width, sy: length, sz: width, rx: e.x, ry: e.y, rz: e.z });
  }
  function pine(x: number, z: number, height: number, lean: number, seed: number) {
    const r = rng(seed), base = new THREE.Vector3(x, .3, z);
    const middle = base.clone().add(new THREE.Vector3(lean * .25, height * .46, 0));
    const top = base.clone().add(new THREE.Vector3(lean, height, -.25));
    branchInstance(base, middle, height * .047);
    branchInstance(middle, top, height * .032);
    for (let i = 0; i < 5; i++) {
      const theta = i * 2.2 + seed, y = .42 + i * .1;
      const start = base.clone().lerp(top, y);
      const reach = height * (.48 - i * .05);
      const end = start.clone().add(new THREE.Vector3(Math.cos(theta) * reach, height * .1, Math.sin(theta) * reach * .66));
      branchInstance(start, end, height * .018);
      crowns.push({ x: end.x, y: end.y + .17, z: end.z, sx: height * (.27 - i * .019), sy: height * (.115 + r() * .025), sz: height * (.22 - i * .012),
        ry: r() * 6, color: new THREE.Color().setScalar(.8 + r() * .36) });
    }
    crowns.push({ x: top.x, y: top.y, z: top.z, sx: height * .22, sy: height * .14, sz: height * .2, color: new THREE.Color().setScalar(1.03) });
    collider(x + lean * .12, z, .35, .35);
  }
  pine(-9.0, 3.3, 6.1, 1.6, 98);
  pine(-11.8, 8.8, 4.1, -.75, 42);
  pine(-10.6, -9.5, 4.0, -.7, 11);
  pine(10.6, -10.5, 3.8, .5, 35);
  instances(cylinder, mat.wood, branches);
  const foliage = instances(pineCrown, mat.leaf, crowns);
  foliage.name = 'Wind-carved pine crowns';
  // Exposed rootwork seats the main tree against the stone, not in a perfect circle.
  for (let i = 0; i < 5; i++) {
    const a = i * 1.28;
    beam(new THREE.Vector3(-9, .5, 3.3), new THREE.Vector3(-9 + Math.cos(a) * 1.15, .28, 3.3 + Math.sin(a) * .75), .09, mat.wood);
  }

  // A small bamboo cluster creates a soft west edge. Only its upper leaves sway.
  const bambooGroup = new THREE.Group(); root.add(bambooGroup);
  const bambooStalks: Instance[] = [], bambooNodes: Instance[] = [], bambooLeaves: Instance[] = [];
  for (let i = 0; i < 11; i++) {
    const x = -7.65 + (random() - .5) * 1.6, z = -2.4 + random() * 3.2, height = 2.4 + random() * 1.8;
    bambooStalks.push({ x, y: .3 + height / 2, z, sx: .047, sy: height, sz: .047 });
    for (let y = .55; y < height; y += .48) bambooNodes.push({ x, y, z, sx: .055, sy: .035, sz: .055 });
    for (let j = 0; j < 5; j++) {
      const angle = random() * Math.PI * 2;
      bambooLeaves.push({ x: x + Math.cos(angle) * .26, y: height * (.6 + j * .075), z: z + Math.sin(angle) * .26,
        sx: .17, sy: .035, sz: .57, ry: angle, rz: .35 + random() * .7, rx: random() * .8 });
    }
  }
  instances(cylinder, mat.bamboo, bambooStalks);
  instances(cylinder, mat.lightStone, bambooNodes);
  instances(sphere, mat.bambooLeaf, bambooLeaves, bambooGroup);
  collider(-7.7, -.8, 1, 1.85);

  // A few planted rocks frame the open court; the centre stays spacious.
  colliderForMesh(mesh(rockGeometries[2], mat.stone, -5.9, .7, 7.9, 1.15, .75, .95));
  colliderForMesh(mesh(rockGeometries[0], mat.lightStone, -6.75, .38, 8.1, .65, .4, .6));
  // A low boundary on the west leaves a view over the drop.
  const edging: Instance[] = [];
  for (let i = 0; i < 9; i++) edging.push({ x: -11.7 + Math.sin(i * .4) * .45, y: .5, z: .2 + i * 1.15, sx: .65, sy: .5 + random() * .25, sz: .98, ry: random() * .3 });
  instances(block, mat.darkStone, edging);
  collider(-11.75, 4.8, .42, 5.5);

  // Layered ridges are real geometry, deliberately outside the tiny traversable map.
  const ridges = [
    { z: -116, y: -18, height: 38, color: '#667f87', seed: 16, width: 260 },
    { z: -83, y: -17, height: 31, color: '#536d74', seed: 33, width: 220 },
    { z: -56, y: -19, height: 28, color: '#3e5960', seed: 81, width: 160 },
  ];
  ridges.forEach(r => {
    const mountain = mesh(keepGeometry(makeRidge(r.width, r.height, r.seed)), keepMaterial(new THREE.MeshBasicMaterial({ color: r.color, fog: true, side: THREE.DoubleSide })), 0, r.y, r.z);
    mountain.castShadow = false; mountain.receiveShadow = false;
  });
  const sideRidge = mesh(keepGeometry(makeRidge(170, 28, 19)), keepMaterial(new THREE.MeshBasicMaterial({ color: '#4a646b', fog: true, side: THREE.DoubleSide })), -68, -24, -30);
  sideRidge.rotation.y = Math.PI * .3; sideRidge.castShadow = false;

  // Soft mist lives below the edge, so the route and the book-room never disappear into it.
  const mistTexture = keepTexture(makeMistTexture());
  const mistSprites: { sprite: THREE.Sprite; x: number; z: number; phase: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const angle = i / 11 * Math.PI * 2;
    const material = keepMaterial(new THREE.SpriteMaterial({ map: mistTexture, color: '#a6bbba', opacity: .13, transparent: true, depthWrite: false, fog: true }));
    const sprite = new THREE.Sprite(material);
    const x = Math.cos(angle) * (17 + random() * 5), z = Math.sin(angle) * (16 + random() * 5);
    sprite.position.set(x, -3.3 - random() * 3, z); sprite.scale.set(22 + random() * 9, 5 + random() * 3, 1);
    root.add(sprite); mistSprites.push({ sprite, x, z, phase: random() * 6 });
  }
  const motesGeometry = keepGeometry(new THREE.BufferGeometry());
  const motePositions = new Float32Array(48 * 3), moteOrigins: number[] = [];
  for (let i = 0; i < 48; i++) {
    const x = (random() - .5) * 19, y = .7 + random() * 4.4, z = random() * 13 - 1;
    motePositions.set([x, y, z], i * 3); moteOrigins.push(x, y, z, random() * 6);
  }
  motesGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motesMaterial = keepMaterial(new THREE.PointsMaterial({ size: .035, color: '#f0d8a3', opacity: .48, transparent: true, depthWrite: false, sizeAttenuation: true }));
  const motes = new THREE.Points(motesGeometry, motesMaterial); root.add(motes);

  const walkAreas: WalkArea[] = [
    { x: 0, z: -5.5, halfX: 5.85, halfZ: 4.45 },       // Room, connected directly to the entrance.
    { x: 0, z: -.7, halfX: 2.5, halfZ: 1.15 },         // Main portal.
    { x: .15, z: 5.45, halfX: 10.85, halfZ: 6.3 },    // Spacious front court.
    { x: 9.45, z: .05, halfX: 3.3, halfZ: 7.7 },      // Eastern loop / lookout.
    { x: 6.1, z: -5, halfX: 1.35, halfZ: 1.45 },      // Side portal.
    { x: 1.4, z: 12.1, halfX: 3.6, halfZ: 2.2 },      // South landing above the scenic stair.
  ];

  return {
    root, colliders, walkAreas, roofOccluders,
    update(time: number, delta: number, indoor: boolean) {
      // Only the upper/near-side cutaway fades: the north and west walls retain
      // the room's spatial frame. Hidden geometry must not keep casting a roof shadow.
      const targetOpacity = indoor ? 0 : 1;
      const dt = Number.isFinite(delta) ? THREE.MathUtils.clamp(delta, 0, .1) : 1 / 60;
      roofOpacity = THREE.MathUtils.damp(roofOpacity, targetOpacity, 7.5, dt);
      if (Math.abs(roofOpacity - targetOpacity) < .002) roofOpacity = targetOpacity;
      for (const material of roofMaterials) {
        material.opacity = roofOpacity;
        material.depthWrite = roofOpacity > .95;
      }
      for (const roofMesh of roofMeshes) {
        roofMesh.visible = roofOpacity > .01;
        roofMesh.castShadow = roofOpacity > .95;
      }
      bambooGroup.rotation.z = Math.sin(time * .43) * .004;
      bambooGroup.rotation.x = Math.sin(time * .31 + 2) * .003;
      for (const mist of mistSprites) {
        mist.sprite.position.x = mist.x + Math.sin(time * .037 + mist.phase) * 2;
        mist.sprite.position.z = mist.z + Math.cos(time * .029 + mist.phase) * 1.1;
      }
      const positions = motesGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < 48; i++) {
        const j = i * 4, phase = moteOrigins[j + 3];
        positions[i * 3] = moteOrigins[j] + Math.sin(time * .21 + phase) * .25;
        positions[i * 3 + 1] = moteOrigins[j + 1] + Math.sin(time * .36 + phase) * .2;
      }
      motesGeometry.attributes.position.needsUpdate = true;
      motesMaterial.opacity = indoor ? .18 : .48;
    },
    dispose() {
      scene.remove(root);
      root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      root.clear();
    },
  };

  function keepTexture<T extends THREE.Texture>(texture: T): T { textures.add(texture); return texture; }
  function makeWeatheredBlock() {
    const g = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const inner = new THREE.Vector3(THREE.MathUtils.clamp(x, -.41, .41), THREE.MathUtils.clamp(y, -.41, .41), THREE.MathUtils.clamp(z, -.41, .41));
      const delta = new THREE.Vector3(x, y, z).sub(inner).normalize().multiplyScalar(.09);
      const noise = Math.sin(x * 37 + y * 11 + z * 23) * .016;
      inner.add(delta).multiplyScalar(1 + noise);
      p.setXYZ(i, inner.x, inner.y, inner.z);
    }
    g.computeVertexNormals(); return g;
  }
  function makeRock(seed: number) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + Math.sin(x * 8.3 + y * 5.8 + z * 4.7 + seed) * .1 + Math.cos(x * 17 + z * 12 + seed) * .035;
      p.setXYZ(i, x * n, y * n, z * n);
    }
    g.computeVertexNormals(); return g;
  }
  function makeLedge(points: number[][]) {
    const vertices: number[] = [], colors: number[] = [];
    const r = rng(951), rings = [0, 1, 2, 3].map(i => points.map(([x, z], j) => {
      const factor = [1, 1.015, .88, .66][i];
      return new THREE.Vector3(x * factor + (i ? Math.sin(j * 8 + i) * .45 : 0), [.25, -1.75, -5.5, -10][i] + (i ? Math.sin(j * 4 + i) * .6 : 0), z * factor);
    }));
    const shades = ['#7d8577', '#676f66', '#4b5752'];
    function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
      for (const v of [a, b, c]) { vertices.push(v.x, v.y, v.z); colors.push(color.r, color.g, color.b); }
    }
    for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < points.length; j++) {
      const next = (j + 1) % points.length;
      const color = new THREE.Color(shades[k]).multiplyScalar(.9 + r() * .2);
      triangle(rings[k][j], rings[k][next], rings[k + 1][j], color);
      triangle(rings[k][next], rings[k + 1][next], rings[k + 1][j], color.clone().multiplyScalar(.93 + r() * .1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals(); return g;
  }
  function makeRidge(width: number, height: number, seed: number) {
    const r = rng(seed), peaks = Array.from({ length: 8 }, (_, i) => ({ x: -.5 * width + i / 7 * width, y: .28 + r() * .72, breadth: width * (.04 + r() * .075) }));
    const vertices: number[] = [], indices: number[] = [], steps = 80;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps - .5) * width;
      let y = 0;
      for (const peak of peaks) y = Math.max(y, Math.exp(-Math.pow((x - peak.x) / peak.breadth, 2)) * peak.y * height);
      y += Math.sin(i * 1.7 + seed) * .45;
      vertices.push(x, -30, 0, x, y, Math.sin(i * .45) * 2);
      if (i < steps) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 2, j + 3, j + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  function makeMistTexture() {
    const size = 64, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      const alpha = Math.max(0, 1 - radius * radius);
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = 255; data[index + 3] = Math.round(alpha * alpha * alpha * 180);
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; return texture;
  }
}
