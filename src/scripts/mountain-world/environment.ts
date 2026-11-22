import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceLibrary, type SurfaceLibrary } from './materials';
import { branchGeometry, gridSurface, mistTexture, naturalRock, pineCrown, pineSpray, roundedBlock, seeded } from './environment-geometry';
import { COURTYARD_POOL, createStudyArchitecture } from './environment-design';
import type { Collider, Environment } from './types';

/** A bright, inhabited mountain courtyard on a continuous level walking plane. */
export function createEnvironment(scene: THREE.Scene, surfaces?: SurfaceLibrary): Environment {
  const library = surfaces ?? createSurfaceLibrary();
  const ownsLibrary = !surfaces;
  const root = new THREE.Group(); root.name = 'Cloud courtyard — first-person environment'; scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), localTextures = new Set<THREE.Texture>();
  const colliders: Collider[] = [];
  const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const own = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const rng = seeded(23877);
  const stone = own(library.material('stone', { worldScale: .58, normalScale: .7 }));
  const darkStone = own(library.material('darkStone', { worldScale: .43, normalScale: .75 }));
  const cutStone = own(library.material('stone', { worldScale: .82, normalScale: .45, roughness: .88 }));
  const earth = own(library.material('ground', { worldScale: .55, normalScale: .55 }));
  const wood = own(library.material('wood', { repeat: [1, 1.35], normalScale: .45 }));
  const deckWood = own(library.material('paleWood', { color: '#dce1dc', repeat: [1.25, 2.1], normalScale: .32 }));
  const bark = own(library.material('bark', { repeat: [1.7, 1], normalScale: .85 }));
  const moss = own(library.material('moss', { worldScale: 1.1, normalScale: .4 }));
  const iron = own(new THREE.MeshStandardMaterial({ color: '#4b4c43', metalness: .63, roughness: .72 }));
  const ropeMaterial = own(new THREE.MeshStandardMaterial({ color: '#b4aa8b', roughness: 1 }));
  const leaves = own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: .92 }));
  const bambooMaterial = own(library.material('bark', { color: '#dae5c5', repeat: [1, 2], normalScale: .23 }));
  const bambooLeafMaterial = own(new THREE.MeshStandardMaterial({ color: '#596e4c', roughness: .95, side: THREE.DoubleSide }));
  const block = keep(roundedBlock()), cube = keep(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 12));
  const rocks = [keep(naturalRock(12)), keep(naturalRock(49)), keep(naturalRock(87))];
  const smallRock = keep(naturalRock(31, 1));
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), vector = new THREE.Vector3(), scale = new THREE.Vector3();

  interface Placed { x: number; y: number; z: number; sx: number; sy: number; sz: number; rx?: number; ry?: number; rz?: number; color?: THREE.Color; }
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = root) {
    const result = new THREE.Mesh(g, m); result.position.set(x, y, z); result.scale.set(sx, sy, sz);
    result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
  }
  function batch(g: THREE.BufferGeometry, m: THREE.Material, instances: Placed[], name: string, parent: THREE.Object3D = root) {
    const result = new THREE.InstancedMesh(g, m, instances.length); result.name = name;
    instances.forEach((item, i) => {
      quat.setFromEuler(new THREE.Euler(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0));
      matrix.compose(vector.set(item.x, item.y, item.z), quat, scale.set(item.sx, item.sy, item.sz)); result.setMatrixAt(i, matrix);
      if (item.color) result.setColorAt(i, item.color);
    });
    result.instanceMatrix.needsUpdate = true; if (result.instanceColor) result.instanceColor.needsUpdate = true;
    result.castShadow = true; result.receiveShadow = true; result.computeBoundingSphere(); parent.add(result); return result;
  }
  function obstacle(x: number, z: number, halfX: number, halfZ: number) { colliders.push({ x, z, halfX, halfZ }); }
  function boundsCollider(geometry: THREE.BufferGeometry, transform: THREE.Matrix4, padding = .025) {
    const bounds = new THREE.Box3(), p = new THREE.Vector3(), positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(p.fromBufferAttribute(positions, i).applyMatrix4(transform));
    if (bounds.max.y <= .35 || bounds.min.y >= 2.15) return;
    obstacle((bounds.min.x + bounds.max.x) / 2, (bounds.min.z + bounds.max.z) / 2,
      (bounds.max.x - bounds.min.x) / 2 + padding, (bounds.max.z - bounds.min.z) / 2 + padding);
  }
  function solid(object: THREE.Mesh) { object.updateMatrix(); boundsCollider(object.geometry, object.matrix); return object; }
  function branch(points: THREE.Vector3[], start: number, end: number, m: THREE.Material = bark) {
    return mesh(keep(branchGeometry(points, start, end, 12, 12)), m);
  }
  function timber(a: THREE.Vector3, b: THREE.Vector3, radius: number, m: THREE.Material = wood) {
    return branch([a, a.clone().lerp(b, .5), b], radius, radius * .93, m);
  }
  const white = new THREE.Color('#ffffff');

  // The ledge grows into a mountainside below the mist, rather than tapering into a floating toy island.
  const outline = [[-14.5, -11.7], [-7.8, -14.2], [.2, -13.2], [8.7, -12.4], [13.7, -8.4], [15, -1.2], [14.1, 8.3], [10.7, 12], [5.5, 14.4], [3.6, 17.1], [-1.1, 17.9], [-5.1, 15.1], [-11.4, 12], [-14.9, 6.1], [-16, -.8]];
  const strata = keep(gridSurface(outline.length, 7, (u, v) => {
    const t = u * outline.length, i = Math.floor(t) % outline.length, j = (i + 1) % outline.length, f = t - Math.floor(t);
    const x = THREE.MathUtils.lerp(outline[i][0], outline[j][0], f), z = THREE.MathUtils.lerp(outline[i][1], outline[j][1], f);
    const outward = 1 + Math.pow(1 - v, 1.3) * .55;
    return new THREE.Vector3(x * outward + Math.sin(v * 23 + i) * (1 - v) * .6, .275 - Math.pow(1 - v, 1.4) * 30, z * outward);
  }, true));
  mesh(strata, darkStone).castShadow = false;
  const groundShape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const poolHole = new THREE.Path();
  poolHole.moveTo(COURTYARD_POOL.x0 - .015, -COURTYARD_POOL.z0 + .015);
  poolHole.lineTo(COURTYARD_POOL.x1 + .015, -COURTYARD_POOL.z0 + .015);
  poolHole.lineTo(COURTYARD_POOL.x1 + .015, -COURTYARD_POOL.z1 - .015);
  poolHole.lineTo(COURTYARD_POOL.x0 - .015, -COURTYARD_POOL.z1 - .015); poolHole.closePath();
  groundShape.holes.push(poolHole);
  const ground = mesh(keep(new THREE.ShapeGeometry(groundShape)), earth, 0, .284, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;

  // Only the lower island edge remains rock. No mountain mass encloses or overshadows the house.
  const exterior: Placed[][] = [[], [], []];
  const outerRocks = [
    [-9.8, -1.8, -10.8, 2.4, 1.8, 2.6], [-1.5, -2.5, -13.0, 4.0, 2.2, 2.0],
    [9.0, -2.2, -12.0, 3.0, 2.0, 2.0], [-13.7, -.9, 3.0, 2.4, 1.7, 2.6],
    [-12.4, -1.0, 9.5, 2.3, 1.9, 2.3], [13.6, -1.2, 10.6, 2.35, 2.1, 2.5],
    [7.5, -2.0, 15.8, 2.7, 2.5, 2.7],
  ];
  outerRocks.forEach((r, i) => exterior[i % 3].push({ x: r[0], y: r[1], z: r[2], sx: r[3], sy: r[4], sz: r[5], ry: rng() * .35 }));
  exterior.forEach((items, i) => {
    const object = batch(rocks[i], i === 1 ? darkStone : stone, items, `Low island cliff-foot rocks ${i}`);
    for (let j = 0; j < object.count; j++) { object.getMatrixAt(j, matrix); boundsCollider(object.geometry, matrix); }
  });
  // Small fractured stones, moss islands and grass sit at edges, not across the path.
  const rubble: Placed[] = [], growth: Placed[] = [];
  for (const [cx, cz, radius] of [[-9.6, 6.7, 2], [-8.5, -.7, 1.3], [-7.2, 10.8, 1.3], [11.9, 10, 1.2], [9.4, -10.2, .9]]) {
    for (let i = 0; i < 22; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * radius;
      rubble.push({ x: cx + Math.cos(a) * d, y: .29, z: cz + Math.sin(a) * d,
        sx: .055 + rng() * .14, sy: .035 + rng() * .09, sz: .065 + rng() * .14, ry: rng() * 6 });
    }
    for (let i = 0; i < 7; i++) growth.push({ x: cx + (rng() - .5) * radius, y: .285, z: cz + (rng() - .5) * radius,
      sx: .25 + rng() * .4, sy: .012, sz: .23 + rng() * .3, ry: rng() * 6 });
  }
  batch(smallRock, cutStone, rubble, 'Small fractured edge stones');
  batch(rocks[0], moss, growth, 'Low moss islands').castShadow = false;

  // Timber veranda: separated, end-grained planks, pegged posts and two slender rails.
  const deckGeometry = keep(roundedBlock()), deckUV = deckGeometry.attributes.uv, deckPosition = deckGeometry.attributes.position;
  for (let i = 0; i < deckUV.count; i++) deckUV.setXY(i, deckPosition.getZ(i) + .5, (deckPosition.getX(i) + .5) * 2.1);
  mesh(cube, wood, 10.15, .111, .1, 5.65, .36, 16.4);
  const planks: Placed[] = [], nails: Placed[] = [];
  for (let i = 0; i < 39; i++) {
    const z = -7.88 + i * .42;
    planks.push({ x: 10.15, y: .274, z, sx: 5.58, sy: .048, sz: .402, color: white.clone().multiplyScalar(.89 + rng() * .15) });
    for (const x of [7.53, 12.77]) nails.push({ x, y: .298, z, sx: .009, sy: .004, sz: .009 });
  }
  batch(deckGeometry, deckWood, planks, 'Individual weathered veranda planks');
  batch(cylinder, iron, nails, 'Recessed iron plank nails').castShadow = false;
  const railPosts: Placed[] = [];
  for (let z = -7.8; z <= 8.2; z += 2) railPosts.push({ x: 12.87, y: .77, z, sx: .12, sy: .94, sz: .12 });
  for (let x = 7.9; x < 12.8; x += 2.3) railPosts.push({ x, y: .77, z: -7.9, sx: .12, sy: .94, sz: .12 });
  batch(block, wood, railPosts, 'Carved veranda posts');
  timber(new THREE.Vector3(12.87, 1.23, -7.9), new THREE.Vector3(12.87, 1.23, 8.2), .045, deckWood);
  timber(new THREE.Vector3(12.87, .68, -7.9), new THREE.Vector3(12.87, .68, 8.2), .026);
  timber(new THREE.Vector3(7.8, 1.23, -7.9), new THREE.Vector3(12.87, 1.23, -7.9), .045, deckWood);
  obstacle(12.87, .15, .11, 8.18); obstacle(10.3, -7.95, 2.75, .1);
  for (const z of [-6.3, -.2, 6.4]) {
    timber(new THREE.Vector3(9.8, -2.4, z), new THREE.Vector3(12.62, -.12, z), .105);
    mesh(block, wood, 11, -.17, z, 4.1, .28, .22);
  }

  // The lower stair is visibly closed by an old rope rail; the fixed-height walk plane stops here.
  const steps: Placed[] = [];
  for (let i = 0; i < 16; i++) steps.push({ x: 1.4 + Math.sin(i * .17) * .25, y: .115 - i * .29, z: 14.8 + i * .69,
    sx: 3.85 - i * .025, sy: .33, sz: .87, ry: Math.sin(i * .17) * .015 });
  batch(block, cutStone, steps, 'Descending distant mountain stair');
  for (const x of [-2, 1.4, 4.8]) solid(mesh(block, wood, x, .92, 14.03, .13, 1.24, .13));
  for (const y of [.88, 1.47]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-2, y, 14.03), new THREE.Vector3(-.3, y - .16, 14.03), new THREE.Vector3(1.4, y, 14.03), new THREE.Vector3(3.1, y - .16, 14.03), new THREE.Vector3(4.8, y, 14.03)]);
    mesh(keep(new THREE.TubeGeometry(curve, 42, .018, 6, false)), ropeMaterial);
  }
  obstacle(1.4, 14.04, 3.75, .07);

  // A bent pine has real branching and sprays of needles, rather than solid balls for foliage.
  const sprays: Placed[] = [], crowns: Placed[] = [];
  function pine(x: number, z: number, height: number, lean: number, seed: number, sparse = false) {
    const r = seeded(seed), base = new THREE.Vector3(x, .3, z), mid = base.clone().add(new THREE.Vector3(lean * .25, height * .44, .1)), top = base.clone().add(new THREE.Vector3(lean, height, -.16));
    branch([base, base.clone().lerp(mid, .5).add(new THREE.Vector3(-.09, 0, .07)), mid, top], height * .043, height * .008, bark);
    obstacle(x + lean * .1, z, height * .045, height * .045);
    for (let i = 0; i < (sparse ? 6 : 8); i++) {
      const t = sparse ? .56 + i * .065 : .48 + i * .057, start = base.clone().lerp(top, t), angle = i * 2.39 + seed;
      const reach = height * (.36 - i * .023), end = start.clone().add(new THREE.Vector3(Math.cos(angle) * reach, .18 + i * .025, Math.sin(angle) * reach * .8));
      const elbow = start.clone().lerp(end, .58).add(new THREE.Vector3(0, -.12, 0));
      branch([start, elbow, end], height * .013 * (1 - i * .045), .016, bark);
      for (let twig = 0; twig < (sparse ? 3 : 5); twig++) {
        const u = .35 + twig * (sparse ? .3 : .15), center = elbow.clone().lerp(end, u), side = twig % 2 ? 1 : -1;
        center.x += Math.sin(angle) * side * .18; center.z -= Math.cos(angle) * side * .18;
        const size = height * (.17 - i * .008) * (.8 + r() * .35);
        sprays.push({ x: center.x, y: center.y + .13, z: center.z, sx: size, sy: size, sz: size, ry: angle + (r() - .5) * 1.2, rx: (r() - .5) * .15 });
      }
    }
    // Three asymmetric, flattened needle layers give the silhouette a living
    // mass. The existing branch-tip sprays retain a fine, open fringe around it.
    for (let layer = 0; layer < 3; layer++) {
      const t = .65 + layer * .145, angle = seed * .61 + layer * 2.41;
      const center = base.clone().lerp(top, t);
      center.x += Math.cos(angle) * height * (.045 - layer * .009);
      center.z += Math.sin(angle) * height * (.05 - layer * .008);
      crowns.push({ x: center.x, y: center.y, z: center.z,
        sx: height * (.27 - layer * .045), sy: height * (.30 - layer * .025), sz: height * (.27 - layer * .035),
        ry: angle, rx: (r() - .5) * .10, rz: (r() - .5) * .08 });
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256, end = base.clone().add(new THREE.Vector3(Math.cos(a) * .85, -.02, Math.sin(a) * .64));
      branch([base.clone().add(new THREE.Vector3(0, .2, 0)), base.clone().lerp(end, .55), end], .075, .018, bark);
    }
  }
  pine(-5.0, 3.7, 4.1, .15, 119, true);
  pine(-9.05, 3.5, 5.7, 1.15, 13);
  pine(-11.75, 9, 4.0, -.6, 42);
  pine(-10.8, -10.4, 4.4, -.4, 77);
  pine(10.5, -10.4, 4.1, .4, 31);
  // Outside the playable deck: a sparse near silhouette, with the seated northward view left open.
  pine(13.35, 7.6, 4.2, -.45, 108, true);
  const foliageGroup = new THREE.Group(); foliageGroup.name = 'Subtle pine needle movement'; foliageGroup.userData.dynamic = true; root.add(foliageGroup);
  batch(keep(pineCrown(27)), leaves, crowns, 'Layered irregular pine needle crowns', foliageGroup);
  batch(keep(pineSpray(8)), leaves, sprays, 'Detailed pine needle sprays', foliageGroup);

  // Slender bamboo and small ferns occupy the western rock edge only.
  const bambooStems: Placed[] = [], bambooNodes: Placed[] = [], bambooLeaves: Placed[] = [];
  const leafShape = keep(new THREE.BufferGeometry());
  leafShape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.07, .012, .24, 0, .025, .58, 0, 0, 0, 0, .025, .58, .055, -.006, .24], 3));
  leafShape.setAttribute('uv', new THREE.Float32BufferAttribute([.5, 0, 0, .45, .5, 1, .5, 0, .5, 1, 1, .45], 2)); leafShape.computeVertexNormals();
  for (let i = 0; i < 15; i++) {
    const x = -8.15 + (rng() - .5) * 1.2, z = -.75 + (rng() - .5) * 2.5, height = 2.3 + rng() * 1.9;
    bambooStems.push({ x, y: .3 + height / 2, z, sx: .028 + rng() * .012, sy: height, sz: .034 });
    for (let y = .65; y < height; y += .44) bambooNodes.push({ x, y, z, sx: .043, sy: .022, sz: .043 });
    for (let j = 0; j < 12; j++) bambooLeaves.push({ x, y: height * (.48 + j / 24), z, sx: .75, sy: .75, sz: .75, ry: j * 2.4 + i, rx: -.25 + rng() * .5 });
  }
  batch(cylinder, bambooMaterial, bambooStems, 'Fine bamboo stems'); batch(cylinder, cutStone, bambooNodes, 'Bamboo joints');
  const bambooGroup = new THREE.Group(); bambooGroup.userData.dynamic = true; root.add(bambooGroup);
  batch(leafShape, bambooLeafMaterial, bambooLeaves, 'Lanceolate bamboo leaves', bambooGroup); obstacle(-8.15, -.75, .72, 1.38);
  const ferns: Placed[] = [];
  for (const [x, z] of [[-7.4, 6.8], [-10.1, 6.2], [-7.4, -.1], [11.8, 9.4]]) for (let j = 0; j < 12; j++)
    ferns.push({ x, y: .3, z, sx: .6, sy: .7, sz: .7, ry: j * Math.PI / 6, rx: -.8 + (j % 3) * .1 });
  batch(leafShape, bambooLeafMaterial, ferns, 'Low edge ferns');

  // Low stones guard the outer ledge without obstructing the entrance or the lookout.
  const edging: Placed[] = [];
  for (let i = 0; i < 10; i++) edging.push({ x: -11.45 + Math.sin(i * .35) * .25, y: .48, z: .3 + i * 1.02, sx: .61, sy: .43 + rng() * .15, sz: .76, ry: rng() * .3 });
  const edgeBatch = batch(smallRock, stone, edging, 'Low natural ledge boundary');
  for (let i = 0; i < edgeBatch.count; i++) { edgeBatch.getMatrixAt(i, matrix); boundsCollider(edgeBatch.geometry, matrix); }

  // The distant mountains belong to the generated landscape backdrop, not opaque polygon rings.
  const mistMap = mistTexture(); localTextures.add(mistMap);
  const clouds: { sprite: THREE.Sprite; x: number; z: number; phase: number }[] = [];
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2, x = Math.cos(a) * (18 + rng() * 7), z = Math.sin(a) * (19 + rng() * 8);
    const sprite = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: mistMap, color: '#e6ebe3', opacity: .11, transparent: true, depthWrite: false, fog: true })));
    sprite.position.set(x, -3.5 - rng() * 4, z); sprite.scale.set(22 + rng() * 10, 5 + rng() * 4, 1); root.add(sprite);
    clouds.push({ sprite, x, z, phase: rng() * 6 });
  }
  const dustGeometry = keep(new THREE.BufferGeometry()), dust = new Float32Array(38 * 3), origins: number[] = [];
  for (let i = 0; i < 38; i++) { const x = (rng() - .5) * 5.7, y = .7 + rng() * 3.5, z = -5.5 + rng() * 6.5; dust.set([x, y, z], i * 3); origins.push(x, y, z, rng() * 6); }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustPoints = new THREE.Points(dustGeometry, own(new THREE.PointsMaterial({ size: .017, color: '#e8d4ad', transparent: true, opacity: .37, depthWrite: false }))); root.add(dustPoints);

  const architecture = createStudyArchitecture(root, library);
  const walkAreas = architecture.walkAreas;
  architecture.geometries.forEach(geometry => geometries.add(geometry));
  architecture.materials.forEach(material => materials.add(material));
  colliders.push(...architecture.colliders);
  mergeStatic();
  return {
    root, colliders, walkAreas, roofOccluders: [],
    update(time, delta, _indoor) {
      // All three roofs remain real geometry. Only leaves, pool and mist move.
      architecture.update(time);
      foliageGroup.rotation.z = Math.sin(time * .34) * .002;
      bambooGroup.rotation.z = Math.sin(time * .47) * .003;
      for (const cloud of clouds) { cloud.sprite.position.x = cloud.x + Math.sin(time * .025 + cloud.phase) * 1.9; cloud.sprite.position.z = cloud.z + Math.cos(time * .021 + cloud.phase) * 1.3; }
      for (let i = 0; i < 38; i++) { const j = i * 4; dust[i * 3] = origins[j] + Math.sin(time * .17 + origins[j + 3]) * .18; dust[i * 3 + 1] = origins[j + 1] + Math.sin(time * .25 + origins[j + 3]) * .13; }
      dustGeometry.attributes.position.needsUpdate = delta > 0;
    },
    dispose() {
      root.removeFromParent(); root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of localTextures) t.dispose();
      if (ownsLibrary) library.dispose(); root.clear();
    },
  };

  function mergeStatic() {
    root.updateWorldMatrix(true, true);
    const groups = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geometries: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
      let ancestor: THREE.Object3D | null = object;
      while (ancestor) { if (ancestor.userData.dynamic) return; ancestor = ancestor.parent; }
      const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
      if (!groups.has(key)) groups.set(key, { material: object.material, cast: object.castShadow, receive: object.receiveShadow, geometries: [], sources: [] });
      const group = groups.get(key)!;
      let copy = object.geometry.clone(); copy.applyMatrix4(object.matrixWorld);
      if (copy.index) { const flat = copy.toNonIndexed(); copy.dispose(); copy = flat; }
      if (!copy.attributes.uv) copy.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(copy.attributes.position.count * 2), 2));
      if (object.material instanceof THREE.MeshStandardMaterial && object.material.vertexColors && !copy.attributes.color)
        copy.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(copy.attributes.position.count * 3).fill(1), 3));
      for (const name of Object.keys(copy.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) copy.deleteAttribute(name);
      group.geometries.push(copy); group.sources.push(object);
    });
    for (const group of groups.values()) {
      if (group.geometries.length < 2) { group.geometries.forEach(g => g.dispose()); continue; }
      const geometry = mergeGeometries(group.geometries, false); group.geometries.forEach(g => g.dispose());
      if (!geometry) continue;
      group.sources.forEach(object => object.removeFromParent());
      const merged = mesh(keep(geometry), group.material); merged.name = `Static environment ${group.material.name || group.material.type}`; merged.castShadow = group.cast; merged.receiveShadow = group.receive;
    }
  }
}
