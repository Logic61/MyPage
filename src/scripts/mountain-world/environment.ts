import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceLibrary, type SurfaceLibrary } from './materials';
import { branchGeometry, gridSurface, mistTexture, mountainRing, naturalRock, pavingSlab, pineSpray, rockNoise, roundedBlock, seeded } from './environment-geometry';
import type { Collider, Environment, WalkArea } from './types';

/** Eye-level mountain dwelling. The cave is a thick, continuous shell, never a cutaway. */
export function createEnvironment(scene: THREE.Scene, surfaces?: SurfaceLibrary): Environment {
  const library = surfaces ?? createSurfaceLibrary();
  const ownsLibrary = !surfaces;
  const root = new THREE.Group(); root.name = 'Mountain dwelling — first-person environment'; scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), localTextures = new Set<THREE.Texture>();
  const colliders: Collider[] = [];
  const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const own = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const rng = seeded(23877), up = new THREE.Vector3(0, 1, 0);
  const stone = own(library.material('stone', { worldScale: .58, normalScale: .7 }));
  const innerStone = own(library.material('stone', { worldScale: .68, normalScale: .62, side: THREE.DoubleSide }));
  innerStone.vertexColors = true;
  const darkStone = own(library.material('darkStone', { worldScale: .43, normalScale: .75 }));
  const cutStone = own(library.material('stone', { worldScale: .82, normalScale: .45, roughness: .88 }));
  const earth = own(library.material('ground', { worldScale: .55, normalScale: .55 }));
  const wood = own(library.material('wood', { repeat: [1, 1.35], normalScale: .45 }));
  const deckWood = own(library.material('wood', { repeat: [1.25, 2.1], normalScale: .48 }));
  const bark = own(library.material('bark', { repeat: [1.7, 1], normalScale: .85 }));
  const moss = own(library.material('moss', { worldScale: 1.1, normalScale: .4 }));
  const iron = own(new THREE.MeshStandardMaterial({ color: '#4b4c43', metalness: .63, roughness: .72 }));
  const ropeMaterial = own(new THREE.MeshStandardMaterial({ color: '#b4aa8b', roughness: 1 }));
  const fissureMaterial = own(new THREE.MeshStandardMaterial({ color: '#37413d', roughness: 1 }));
  const leaves = own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: .92 }));
  const bambooMaterial = own(library.material('bark', { color: '#dae5c5', repeat: [1, 2], normalScale: .23 }));
  const bambooLeafMaterial = own(new THREE.MeshStandardMaterial({ color: '#596e4c', roughness: .95, side: THREE.DoubleSide }));
  const block = keep(roundedBlock()), cube = keep(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 12));
  const rocks = [keep(naturalRock(12)), keep(naturalRock(49)), keep(naturalRock(87))];
  const smallRock = keep(naturalRock(31, 1));
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), vector = new THREE.Vector3(), scale = new THREE.Vector3();
  const MIN_Z = -9.9, MOUTH_Z = -.8, SPRING = 3.05;

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
  const rockShade = (_u: number, _v: number, p: THREE.Vector3) => white.clone().multiplyScalar(.70 + .26 * THREE.MathUtils.smoothstep(p.y, .25, 2.5) + rockNoise(p.x, p.y, p.z) * .035);

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
  const ground = mesh(keep(new THREE.ShapeGeometry(groundShape)), earth, 0, .284, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;

  // The room opens gently into a generous natural mouth. No rectangular block is used as the cave roof.
  function widthAt(z: number) { return THREE.MathUtils.lerp(3.25, 6.05, THREE.MathUtils.smoothstep(-z, .8, 3.25)); }
  function heightAt(z: number) { return THREE.MathUtils.lerp(1.55, 2.38, THREE.MathUtils.smoothstep(-z, .8, 3)); }
  function sideTop(z: number) {
    const t = (z + 5) / 1.6;
    return Math.abs(t) <= 1 ? 2.12 + Math.sqrt(Math.max(0, 1 - t * t)) * .86 : .3;
  }
  function wallPoint(sign: number, z: number, y: number, outer = false) {
    const edgeFade = Math.pow(Math.max(0, Math.sin((y - .3) / (SPRING - .3) * Math.PI)), .72);
    const strata = Math.sin(z * .77 + sign * .91) * .13
      + Math.cos(y * 1.63 + z * .43 - sign) * .085
      + rockNoise(sign * 6, y * .7, z * .72) * .035;
    // Keep the existing collision envelope at body height. The upper rock can
    // swell more deeply without narrowing either doorway or the furniture aisles.
    const relief = THREE.MathUtils.lerp(.075, .25, THREE.MathUtils.smoothstep(y, 2.15, 2.58));
    const warp = THREE.MathUtils.clamp(strata, -relief, relief) * edgeFade;
    return new THREE.Vector3(sign * (widthAt(z) + (outer ? 1.35 : 0) + warp), y, z);
  }
  function vaultPoint(theta: number, z: number, outer = false) {
    const edgeFade = Math.sin(theta);
    const longFold = Math.sin(theta * 2.25 + z * .58 + .9) * .28;
    const crossFold = Math.sin(theta * 4.65 - z * .34 + .2) * .16;
    const weatheredShelf = -.19 * Math.exp(-Math.pow((theta - .92) / .4, 2))
      * (.75 + Math.cos(z * .42) * .25);
    const grain = rockNoise(Math.cos(theta) * 4.2, Math.sin(theta) * 2.3, z * .7) * .055;
    // The same asymmetric displacement is applied to both skins. Its zero-valued
    // side edges preserve the wall/vault seams and the rock's full thickness.
    const wave = THREE.MathUtils.clamp(longFold + crossFold + weatheredShelf + grain, -.35, .34) * edgeFade;
    return new THREE.Vector3(Math.cos(theta) * (widthAt(z) + (outer ? 1.35 : 0)),
      SPRING + Math.sin(theta) * (heightAt(z) + (outer ? 1.25 : 0)) + wave, z);
  }
  function makeWall(sign: number, z0: number, z1: number, outer: boolean, arch = false) {
    const surface = keep(gridSurface(Math.max(2, Math.ceil((z1 - z0) / .22)), 14, (u, v) => {
      const z = THREE.MathUtils.lerp(z0, z1, u);
      const bottom = arch ? sideTop(z) + (outer ? .05 : 0) : .3;
      return wallPoint(sign, z, THREE.MathUtils.lerp(bottom, SPRING, v), outer);
    }, sign < 0 !== outer, outer ? undefined : rockShade));
    const result = mesh(surface, outer ? stone : innerStone); result.name = `${outer ? 'Outer' : 'Inner'} cave wall ${sign < 0 ? 'west' : 'east'} ${z0}`; return result;
  }
  for (const outer of [false, true]) {
    const vault = mesh(keep(gridSurface(48, 42, (u, v) => vaultPoint(u * Math.PI, THREE.MathUtils.lerp(MIN_Z, MOUTH_Z, v), outer), !outer, outer ? undefined : rockShade)), outer ? stone : innerStone);
    vault.name = outer ? 'Continuous exterior rock vault' : 'Continuous interior rock vault';
    makeWall(-1, MIN_Z, MOUTH_Z, outer);
    makeWall(1, MIN_Z, -6.6, outer);
    makeWall(1, -6.6, -3.4, outer, true);
    makeWall(1, -3.4, MOUTH_Z, outer);
  }
  const backWall = mesh(keep(gridSurface(44, 24, (u, v) => {
    const x = (u * 2 - 1) * widthAt(MIN_Z);
    const ceiling = vaultPoint(Math.acos(THREE.MathUtils.clamp(x / widthAt(MIN_Z), -1, 1)), MIN_Z).y;
    const y = THREE.MathUtils.lerp(.3, ceiling, v);
    return new THREE.Vector3(x, y, MIN_Z + rockNoise(x, y * .9, -9.9) * .045 * Math.sin(v * Math.PI));
  }, false, rockShade)), innerStone); backWall.name = 'Continuous rear rock wall';
  obstacle(0, -10.35, 6.8, .5);

  // Connect both shells across a deep, irregular lip: a real arch section visible from either side.
  function mouthCurve(t: number, outer: boolean) {
    const vertical = .24, z = MOUTH_Z;
    let p: THREE.Vector3;
    if (t < vertical) p = wallPoint(-1, z, THREE.MathUtils.lerp(.3, SPRING, t / vertical), outer);
    else if (t > 1 - vertical) p = wallPoint(1, z, THREE.MathUtils.lerp(SPRING, .3, (t - 1 + vertical) / vertical), outer);
    else p = vaultPoint(Math.PI * (1 - (t - vertical) / (1 - vertical * 2)), z, outer);
    return p;
  }
  const mouth = mesh(keep(gridSurface(88, 9, (u, v) => {
    const inside = mouthCurve(u, false), outside = mouthCurve(u, true), p = inside.lerp(outside, v);
    p.z += Math.sin(v * Math.PI) * rockNoise(p.x * 1.2, p.y * 1.3, 1) * .12;
    return p;
  }, false)), stone); mouth.material.side = THREE.DoubleSide; mouth.name = 'Thick irregular entrance arch';
  // Two broad, embedded weathering ledges interrupt the otherwise smooth lip.
  // Their lowest surfaces stay well above standing eye/head height.
  for (const [theta, sx, sy, sz, lift, index] of [[.68, .72, .31, .49, .13, 0], [1.87, .93, .26, .53, .12, 2]]) {
    const p = vaultPoint(theta, MOUTH_Z);
    const ledge = mesh(rocks[index], stone, p.x, p.y + lift, MOUTH_Z - .02, sx, sy, sz);
    ledge.rotation.z = theta < 1 ? -.17 : .11;
    ledge.name = 'Embedded weathered entrance ledge';
  }

  // The side portal is cut through the rock, with a continuous reveal connecting both skins.
  const sideReveal = mesh(keep(gridSurface(44, 7, (u, v) => {
    const z = THREE.MathUtils.lerp(-6.6, -3.4, u);
    return wallPoint(1, z, sideTop(z)).lerp(wallPoint(1, z, sideTop(z) + .05, true), v);
  }, true)), cutStone); sideReveal.material.side = THREE.DoubleSide;
  for (const z of [-6.6, -3.4]) {
    const jamb = mesh(keep(gridSurface(7, 15, (u, v) => wallPoint(1, z, .3 + v * 1.82)
      .lerp(wallPoint(1, z, .3 + v * 1.87, true), u), z < -5)), cutStone);
    jamb.material.side = THREE.DoubleSide;
  }
  mesh(block, cutStone, 6.72, .25, -5, 1.55, .105, 3.08);

  // Short wall segments follow the taper accurately enough to walk naturally up to it.
  function wallStrip(sign: number, start: number, end: number) {
    let inner = Infinity, outer = -Infinity;
    // Include the upper relief too, so an overhang cannot hang over a nominally
    // walkable shoulder space. The sampling is denser than the rendered wall grid.
    for (let zz = 0; zz <= 4; zz++) for (let yy = 0; yy <= 18; yy++) {
      const z = THREE.MathUtils.lerp(start, end, zz / 4);
      const y = THREE.MathUtils.lerp(.3, SPRING, yy / 18);
      const radius = Math.abs(wallPoint(sign, z, y).x);
      inner = Math.min(inner, radius); outer = Math.max(outer, radius + 1.35);
    }
    const low = Math.min(inner - .025, Math.min(widthAt(start), widthAt(end)) - .09);
    const high = Math.max(outer + .025, Math.max(widthAt(start), widthAt(end)) + 1.42);
    obstacle(sign * (low + high) / 2, (start + end) / 2, (high - low) / 2, (end - start) / 2 + .015);
  }
  for (let z = MIN_Z; z < MOUTH_Z; z += .34) {
    const end = Math.min(MOUTH_Z, z + .34);
    wallStrip(-1, z, end);
    if (z >= -3.4 || end <= -6.6) wallStrip(1, z, end);
    else {
      if (z < -6.6) wallStrip(1, z, -6.6);
      if (end > -3.4) wallStrip(1, -3.4, end);
    }
  }

  // Hairline seams emerge from the same surface instead of floating above it.
  for (let seam = 0; seam < 8; seam++) {
    const z = -8.9 + seam * .8, points: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      const y = .55 + i * .23, p = wallPoint(-1, z + Math.sin(i * .8 + seam) * .035, y);
      p.x += .009; points.push(p);
    }
    mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, .005 + seam % 3 * .0015, 3, false)), fissureMaterial).castShadow = false;
  }
  // A modest timber support remains recognisably built by a person, inside the natural cave.
  for (const x of [-5.54, 5.54]) {
    const post = mesh(block, wood, x, 1.86, -7.9, .21, 3.12, .23); solid(post);
    mesh(block, cutStone, x, .38, -7.9, .39, .16, .42);
    for (const y of [.62, 2.92]) mesh(cube, iron, x, y, -7.9, .226, .065, .246);
  }
  timber(new THREE.Vector3(-5.54, 3.38, -7.9), new THREE.Vector3(5.54, 3.38, -7.9), .115);
  for (const x of [-5.54, 5.54]) timber(new THREE.Vector3(x, 2.65, -7.9), new THREE.Vector3(x - Math.sign(x) * .7, 3.38, -7.9), .065);

  // Inset stone floor: readable joints and bevels, all close to the fixed walk plane.
  mesh(cube, darkStone, 0, .144, -5.5, 12.1, .29, 9.12);
  const floor: Placed[] = [];
  for (let row = 0; row < 9; row++) for (let col = 0; col < 12; col++) {
    const x = -5.5 + col, z = -9.45 + row;
    if (Math.abs(x) > widthAt(z) - .18) continue;
    floor.push({ x, y: .292, z, sx: .976, sy: .028, sz: .976, color: white.clone().multiplyScalar(.89 + rng() * .14) });
  }
  batch(block, cutStone, floor, 'Bevelled stone floor tiles').castShadow = false;
  mesh(block, cutStone, 0, .259, -.73, 5.75, .11, .74);
  const path: Placed[][] = [[], [], [], []];
  for (let i = 0; i < 13; i++) {
    const z = 13.5 - i * 1.1, center = 1.35 + Math.sin(i * .36) * .55;
    for (let side = -1; side <= 1; side++) {
      const index = i * 3 + side + 1;
      path[index % 4].push({ x: center + side * .9 + (rng() - .5) * .025, y: .274, z: z + (rng() - .5) * .025,
        sx: .82, sy: 1, sz: .99, ry: (rng() - .5) * .06, color: white.clone().multiplyScalar(.9 + rng() * .12) });
    }
  }
  for (let i = 0; i < 5; i++) path[i % 4].push({ x: 3.65 + i * .8, y: .274, z: 6.5 - Math.sin(i / 4 * Math.PI) * .65, sx: .73, sy: 1, sz: .9, ry: (rng() - .5) * .08 });
  path.forEach((items, i) => batch(keep(pavingSlab(123 + i)), cutStone, items, `Separate irregular path stones ${i}`));

  // Mountain mass sits outside the inner shell; nothing protrudes through the room.
  const exterior: Placed[][] = [[], [], []];
  const outerRocks = [
    [-10.1, 2.45, -7.3, 3.15, 4.1, 3.7], [-10.5, 1.65, -1.5, 2.45, 2.6, 2.7],
    [-7.8, 5.8, -12.5, 3.9, 6.2, 2.4], [-2.5, 7.0, -13.2, 3.8, 7.0, 2.3],
    [2.9, 6.0, -13.3, 3.8, 6.1, 2.5], [8.1, 4.1, -12.4, 3.3, 4.4, 2.2],
    [-13.7, -.5, 3.0, 2.4, 1.9, 2.6], [-12.4, -.6, 9.5, 2.3, 2.1, 2.3],
    [13.6, -1.2, 10.6, 2.35, 2.1, 2.5], [7.5, -2.0, 15.8, 2.7, 2.5, 2.7],
  ];
  outerRocks.forEach((r, i) => exterior[i % 3].push({ x: r[0], y: r[1], z: r[2], sx: r[3], sy: r[4], sz: r[5], ry: rng() * .35 }));
  exterior.forEach((items, i) => {
    const object = batch(rocks[i], i === 1 ? darkStone : stone, items, `Outer mountain rocks ${i}`);
    for (let j = 0; j < object.count; j++) { object.getMatrixAt(j, matrix); boundsCollider(object.geometry, matrix); }
  });
  // Small fractured stones, moss islands and grass sit at edges, not across the path.
  const rubble: Placed[] = [], growth: Placed[] = [];
  for (const [cx, cz, radius] of [[-9.6, 6.7, 2], [-8.5, -.7, 1.3], [-5.9, 9.0, 1.4], [11.9, 10, 1.2], [8.3, -9.1, 1.3]]) {
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
  solid(mesh(rocks[2], stone, -5.9, .6, 7.9, .85, .62, .73));
  solid(mesh(rocks[0], cutStone, -6.62, .39, 8.05, .45, .31, .43));

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
  mesh(deckGeometry, deckWood, 6.78, .274, -5, 1.3, .048, 3.1);
  const railPosts: Placed[] = [];
  for (let z = -7.8; z <= 8.2; z += 2) railPosts.push({ x: 12.87, y: .94, z, sx: .12, sy: 1.28, sz: .12 });
  for (let x = 7.9; x < 12.8; x += 2.3) railPosts.push({ x, y: .94, z: -7.9, sx: .12, sy: 1.28, sz: .12 });
  batch(block, wood, railPosts, 'Carved veranda posts');
  timber(new THREE.Vector3(12.87, 1.57, -7.9), new THREE.Vector3(12.87, 1.57, 8.2), .055, deckWood);
  timber(new THREE.Vector3(12.87, .91, -7.9), new THREE.Vector3(12.87, .91, 8.2), .032);
  timber(new THREE.Vector3(7.8, 1.57, -7.9), new THREE.Vector3(12.87, 1.57, -7.9), .055, deckWood);
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
  const sprays: Placed[] = [];
  function pine(x: number, z: number, height: number, lean: number, seed: number) {
    const r = seeded(seed), base = new THREE.Vector3(x, .3, z), mid = base.clone().add(new THREE.Vector3(lean * .25, height * .44, .1)), top = base.clone().add(new THREE.Vector3(lean, height, -.16));
    branch([base, base.clone().lerp(mid, .5).add(new THREE.Vector3(-.09, 0, .07)), mid, top], height * .043, height * .008, bark);
    obstacle(x + lean * .1, z, height * .045, height * .045);
    for (let i = 0; i < 8; i++) {
      const t = .48 + i * .057, start = base.clone().lerp(top, t), angle = i * 2.39 + seed;
      const reach = height * (.36 - i * .023), end = start.clone().add(new THREE.Vector3(Math.cos(angle) * reach, .18 + i * .025, Math.sin(angle) * reach * .8));
      const elbow = start.clone().lerp(end, .58).add(new THREE.Vector3(0, -.12, 0));
      branch([start, elbow, end], height * .013 * (1 - i * .045), .016, bark);
      for (let twig = 0; twig < 5; twig++) {
        const u = .35 + twig * .15, center = elbow.clone().lerp(end, u), side = twig % 2 ? 1 : -1;
        center.x += Math.sin(angle) * side * .18; center.z -= Math.cos(angle) * side * .18;
        const size = height * (.17 - i * .008) * (.8 + r() * .35);
        sprays.push({ x: center.x, y: center.y + .13, z: center.z, sx: size, sy: size, sz: size, ry: angle + (r() - .5) * 1.2, rx: (r() - .5) * .15 });
      }
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256, end = base.clone().add(new THREE.Vector3(Math.cos(a) * .85, -.02, Math.sin(a) * .64));
      branch([base.clone().add(new THREE.Vector3(0, .2, 0)), base.clone().lerp(end, .55), end], .075, .018, bark);
    }
  }
  pine(-9.05, 3.5, 5.7, 1.15, 13);
  pine(-11.75, 9, 4.0, -.6, 42);
  pine(-10.8, -10.4, 4.4, -.4, 77);
  pine(10.5, -10.4, 4.1, .4, 31);
  const foliageGroup = new THREE.Group(); foliageGroup.name = 'Subtle pine needle movement'; foliageGroup.userData.dynamic = true; root.add(foliageGroup);
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

  // Every viewing direction has a landscape; these rings remain far outside the tiny playable ledge.
  for (const [radius, base, height, color, seed] of [[62, -19, 28, '#425c65', 23], [105, -20, 39, '#5b7580', 64], [163, -25, 52, '#718b94', 91]] as const) {
    const mountain = mesh(keep(mountainRing(radius, base, height, seed)), own(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true })));
    mountain.castShadow = false; mountain.receiveShadow = false;
  }
  const mistMap = mistTexture(); localTextures.add(mistMap);
  const clouds: { sprite: THREE.Sprite; x: number; z: number; phase: number }[] = [];
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2, x = Math.cos(a) * (18 + rng() * 7), z = Math.sin(a) * (19 + rng() * 8);
    const sprite = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: mistMap, color: '#bdcccb', opacity: .14, transparent: true, depthWrite: false, fog: true })));
    sprite.position.set(x, -3.5 - rng() * 4, z); sprite.scale.set(22 + rng() * 10, 5 + rng() * 4, 1); root.add(sprite);
    clouds.push({ sprite, x, z, phase: rng() * 6 });
  }
  const dustGeometry = keep(new THREE.BufferGeometry()), dust = new Float32Array(38 * 3), origins: number[] = [];
  for (let i = 0; i < 38; i++) { const x = (rng() - .5) * 5.7, y = .7 + rng() * 3.5, z = -1 + rng() * 5; dust.set([x, y, z], i * 3); origins.push(x, y, z, rng() * 6); }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustPoints = new THREE.Points(dustGeometry, own(new THREE.PointsMaterial({ size: .017, color: '#e8d4ad', transparent: true, opacity: .37, depthWrite: false }))); root.add(dustPoints);

  const walkAreas: WalkArea[] = [
    { x: 0, z: -5.5, halfX: 5.85, halfZ: 4.45 },
    { x: 0, z: -.7, halfX: 2.5, halfZ: 1.15 },
    { x: .15, z: 5.45, halfX: 10.85, halfZ: 6.3 },
    { x: 9.45, z: .05, halfX: 3.3, halfZ: 7.7 },
    { x: 6.1, z: -5, halfX: 1.35, halfZ: 1.45 },
    { x: 1.4, z: 12.1, halfX: 3.6, halfZ: 2.2 },
  ];
  mergeStatic();
  return {
    root, colliders, walkAreas, roofOccluders: [],
    update(time, delta, _indoor) {
      // The full cave stays in place in first person, including its roof and shadows.
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
