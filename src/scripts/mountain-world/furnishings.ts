import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceLibrary, type SurfaceLibrary, type SurfaceKind, type SurfaceOptions } from './materials';
import { createFurnishingInk } from './furnishing-ink';
import type { Collider, Furnishings, Interaction } from './types';

/** Human-scale furnishings: all dimensions are metres; the common floor is y=.3. */
export function createFurnishings(scene: THREE.Scene, isEn: boolean, surfaces?: SurfaceLibrary): Furnishings {
  const library = surfaces ?? createSurfaceLibrary();
  const ownsLibrary = !surfaces;
  const root = new THREE.Group();
  root.name = 'mountain-furnishings';
  scene.add(root);
  const colliders: Collider[] = [];
  const interactions: Interaction[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const lettering = createFurnishingInk(isEn);
  const focusMaterials: { id: string; material: THREE.MeshStandardMaterial }[] = [];

  function geometry(key: string, create: () => THREE.BufferGeometry) {
    let result = geometryCache.get(key);
    if (!result) { result = create(); geometries.add(result); geometryCache.set(key, result); }
    return result;
  }
  function surface(kind: SurfaceKind, options: SurfaceOptions = {}) {
    const result = library.material(kind, options);
    materials.add(result);
    return result;
  }
  function material(parameters: THREE.MeshStandardMaterialParameters) {
    const result = new THREE.MeshStandardMaterial(parameters);
    materials.add(result);
    return result;
  }
  function written(kind: Parameters<typeof lettering.page>[0], id?: string) {
    const mat = surface('paper', { roughness: .95, normalScale: .32, side: THREE.DoubleSide });
    mat.map = lettering.page(kind);
    if (id) { mat.emissive.set('#c49351'); mat.emissiveIntensity = 0; focusMaterials.push({ id, material: mat }); }
    return mat;
  }
  const wood = surface('wood', { worldScale: .9, roughness: .88, normalScale: .55 });
  const woodDark = surface('wood', { color: '#b9b2a8', worldScale: .9, roughness: 1, normalScale: .55 });
  const woodEdge = surface('wood', { color: '#fff3dc', worldScale: .9, roughness: .8, normalScale: .42 });
  const paper = surface('paper', { roughness: 1, normalScale: .35 });
  const paperEdge = surface('paper', { roughness: 1, normalScale: .25 });
  paperEdge.map = lettering.pageEdges;
  const brass = surface('brass', { roughness: .85, metalness: .88, normalScale: .25, worldScale: 3 });
  const brassDark = surface('brass', { color: '#d2d8ca', roughness: 1.3, metalness: .72, normalScale: .25, worldScale: 3 });
  const ceramic = surface('ceramic', { roughness: 1, normalScale: .28, worldScale: 5 });
  const inkstone = surface('darkStone', { color: '#b8bfbd', roughness: .85, normalScale: .25, worldScale: 4 });
  const ink = material({ color: '#182724', roughness: .23, metalness: .08 });
  const cord = material({ color: '#c5b38a', roughness: .97 });
  const red = material({ color: '#934b38', roughness: .64 });
  const wax = material({ color: '#9a4938', roughness: .46 });
  const cloth = surface('cloth', { color: '#d6e1d6', roughness: 1, normalScale: .65, side: THREE.DoubleSide, worldScale: 2 });
  const bindings = ['#cee2dc', '#e6c7ac', '#a4bce2', '#e4dbae', '#c7cfb3', '#e4bab0'].map(color =>
    surface('cloth', { color, roughness: 1, normalScale: .42 }));
  const tagMaterial = surface('paper', { normalScale: .22 });
  tagMaterial.map = lettering.bookAtlas;

  function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material,
    x = 0, y = 0, z = 0, cast = true) {
    const object = new THREE.Mesh(geo, mat);
    object.position.set(x, y, z);
    object.castShadow = cast;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(parent: THREE.Object3D, mat: THREE.Material,
    width: number, height: number, depth: number, x = 0, y = 0, z = 0) {
    const object = mesh(parent, geometry('cube', () => new THREE.BoxGeometry(1, 1, 1)), mat, x, y, z);
    object.scale.set(width, height, depth);
    return object;
  }
  function cylinder(parent: THREE.Object3D, mat: THREE.Material,
    top: number, bottom: number, height: number, x = 0, y = 0, z = 0, segments = 16) {
    return mesh(parent, geometry(`cylinder:${top}:${bottom}:${height}:${segments}`,
      () => new THREE.CylinderGeometry(top, bottom, height, segments)), mat, x, y, z);
  }
  function torus(parent: THREE.Object3D, mat: THREE.Material,
    radius: number, tube: number, x = 0, y = 0, z = 0, segments = 64) {
    return mesh(parent, geometry(`torus:${radius}:${tube}:${segments}`,
      () => new THREE.TorusGeometry(radius, tube, 6, segments)), mat, x, y, z);
  }
  function bevel(parent: THREE.Object3D, mat: THREE.Material,
    width: number, height: number, depth: number, x = 0, y = 0, z = 0, radius = .007) {
    const r = Math.min(radius, width * .2, height * .2, depth * .2);
    const geo = geometry(`bevel:${width}:${height}:${depth}:${r}`, () => {
      const shape = new THREE.Shape();
      const w = width / 2 - r, h = height / 2 - r;
      shape.moveTo(-w, -h); shape.lineTo(w, -h); shape.lineTo(w, h); shape.lineTo(-w, h); shape.closePath();
      const result = new THREE.ExtrudeGeometry(shape, {
        depth: depth - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r,
        bevelSegments: 2, curveSegments: 1, steps: 1,
      });
      result.translate(0, 0, -depth / 2 + r);
      return result;
    });
    return mesh(parent, geo, mat, x, y, z);
  }
  function rod(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, radius = .004, segments = 8) {
    const object = cylinder(parent, mat, radius, radius, a.distanceTo(b), 0, 0, 0, segments);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return object;
  }
  function tube(parent: THREE.Object3D, mat: THREE.Material, key: string, points: THREE.Vector3[], radius: number, segments = 20) {
    return mesh(parent, geometry(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false)), mat);
  }
  function lathe(parent: THREE.Object3D, mat: THREE.Material, key: string, profile: number[][], x = 0, y = 0, z = 0, segments = 32) {
    return mesh(parent, geometry(key, () => new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0], p[1])), segments)), mat, x, y, z);
  }
  function group(name: string, x: number, z: number) {
    const object = new THREE.Group(); object.name = name; object.position.set(x, .3, z); root.add(object); return object;
  }
  function label(parent: THREE.Object3D, mat: THREE.Material, width: number, height: number, x: number, y: number, z: number) {
    const object = mesh(parent, geometry('plane', () => new THREE.PlaneGeometry(1, 1)), mat, x, y, z, false);
    object.scale.set(width, height, 1); return object;
  }
  function bookTag(parent: THREE.Object3D, index: number, width: number, height: number, x: number, y: number, z: number) {
    const n = index % lettering.titles.length;
    const geo = geometry(`book-title:${n}`, () => {
      const result = new THREE.PlaneGeometry(1, 1);
      const uv = result.attributes.uv;
      // Canvas atlas starts at its top left; Three's flipped texture uses bottom-left UVs.
      for (let i = 0; i < uv.count; i++) uv.setXY(i,
        (n % 4 + .025 + uv.getX(i) * .95) / 4, (3 - Math.floor(n / 4) + .015 + uv.getY(i) * .97) / 4);
      return result;
    });
    const result = mesh(parent, geo, tagMaterial, x, y, z, false);
    result.scale.set(width, height, 1); return result;
  }

  /** Keep moving parts and semantic raycast groups separate, merge all remaining static surfaces. */
  function batchStatic(parent: THREE.Group, excluded: THREE.Object3D[] = []) {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const originals: THREE.Mesh[] = [];
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      for (let current: THREE.Object3D | null = object; current && current !== parent; current = current.parent) {
        if (excluded.includes(current)) return;
      }
      let copy = object.geometry.clone();
      const transform = inverse.clone().multiply(object.matrixWorld);
      copy.applyMatrix4(transform);
      if (copy.index) { const next = copy.toNonIndexed(); copy.dispose(); copy = next; }
      // Reflected joinery must keep its front-face winding after the transform is baked.
      if (transform.determinant() < 0) {
        for (const attribute of Object.values(copy.attributes) as THREE.BufferAttribute[]) {
          const data = attribute.array;
          for (let vertex = 0; vertex < attribute.count; vertex += 3) {
            for (let component = 0; component < attribute.itemSize; component++) {
              const a = (vertex + 1) * attribute.itemSize + component;
              const b = (vertex + 2) * attribute.itemSize + component;
              const previous = data[a]; data[a] = data[b]; data[b] = previous;
            }
          }
        }
      }
      for (const attribute of Object.keys(copy.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) copy.deleteAttribute(attribute);
      if (!copy.attributes.uv) copy.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(copy.attributes.position.count * 2), 2));
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material)!.push(copy); originals.push(object);
    });
    for (const object of originals) object.removeFromParent();
    for (const [mat, parts] of batches) {
      const merged = mergeGeometries(parts, false);
      for (const part of parts) part.dispose();
      if (merged) { geometries.add(merged); mesh(parent, merged, mat); }
    }
  }

  /** Book axes: x is thickness, y is height, +z is the stitched, labelled spine. */
  function boundBook(thickness: number, height: number, depth: number, color: number, title: number) {
    const result = new THREE.Group();
    result.name = `thread-bound-book-${lettering.titles[title % lettering.titles.length]}`;
    const binding = bindings[color % bindings.length];
    box(result, paperEdge, thickness - .008, height - .012, depth - .012, 0, 0, -.002);
    for (const side of [-1, 1]) {
      bevel(result, binding, .0035, height, depth, side * (thickness / 2 - .0018), 0, 0, .0006);
      const coverLabel = bookTag(result, title, .045, height * .68, side * (thickness / 2 + .0003), .015, -.018);
      coverLabel.rotation.y = side * Math.PI / 2;
    }
    bevel(result, binding, thickness, height, .012, 0, 0, depth / 2 - .004, .0015);
    bookTag(result, title, Math.min(thickness * .70, .043), height * .77, 0, .005, depth / 2 + .0025);
    // Four stitched stations and their connecting thread are geometry, not a painted motif.
    for (const yy of [-.35, -.12, .12, .35]) {
      rod(result, cord, new THREE.Vector3(-thickness / 2 - .001, yy * height, depth / 2 - .011),
        new THREE.Vector3(thickness / 2 + .001, yy * height, depth / 2 + .004), .0016, 5);
      for (const side of [-1, 1]) rod(result, cord,
        new THREE.Vector3(side * (thickness / 2 + .001), yy * height, depth / 2 - .028),
        new THREE.Vector3(side * (thickness / 2 + .001), yy * height, depth / 2 + .004), .0015, 5);
    }
    rod(result, cord, new THREE.Vector3(-thickness / 2 - .002, -.35 * height, depth / 2 - .023),
      new THREE.Vector3(-thickness / 2 - .002, .35 * height, depth / 2 - .023), .0013, 5);
    return result;
  }
  function lyingBook(parent: THREE.Group, x: number, bottom: number, z: number, index: number, angle = 0) {
    const thickness = .031 + index % 3 * .008;
    const book = boundBook(thickness, .31 + index % 2 * .025, .226, index, index);
    book.rotation.set(0, angle, -Math.PI / 2);
    book.position.set(x, bottom + thickness / 2, z);
    parent.add(book); return thickness;
  }

  // A smaller hanging scroll stays above the writing desk, on the actual rock wall.
  const hangingScroll = group('north-wall-inscribed-scroll', -.5, -9.82);
  hangingScroll.position.y = 2.65;
  bevel(hangingScroll, cloth, 1.15, 1.62, .016, 0, 0, -.018, .002);
  const scrollSheet = geometry('hanging-scroll-paper', () => {
    const result = new THREE.PlaneGeometry(.99, 1.45, 8, 20);
    const p = result.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, .009 + Math.cos(p.getY(i) * 3) * .008 + Math.sin(p.getY(i) * 7) * .003);
    result.computeVertexNormals(); return result;
  });
  mesh(hangingScroll, scrollSheet, written('scroll'));
  for (const yy of [-.82, .82]) {
    cylinder(hangingScroll, wood, .026, .026, 1.24, 0, yy, 0, 20).rotation.z = Math.PI / 2;
    for (const xx of [-.65, .65]) cylinder(hangingScroll, woodDark, .036, .036, .07, xx, yy, 0, 16).rotation.z = Math.PI / 2;
  }
  for (const side of [-1, 1]) rod(hangingScroll, cord, new THREE.Vector3(side * .4, .83, 0), new THREE.Vector3(0, 1.04, -.035), .003);
  cylinder(hangingScroll, brassDark, .008, .008, .13, 0, 1.04, -.06, 10).rotation.x = Math.PI / 2;
  batchStatic(hangingScroll);

  const wallLamp = group('north-wall-paper-sconce', 2.7, -9.82);
  wallLamp.position.y = 2.46;
  bevel(wallLamp, woodDark, .16, .42, .065, 0, .02, 0);
  bevel(wallLamp, wood, .038, .045, .25, 0, .24, .10);
  const wallPaper = surface('paper', { roughness: 1, normalScale: .25 });
  wallPaper.emissive.set('#ffbc6e'); wallPaper.emissiveIntensity = .9;
  cylinder(wallLamp, wallPaper, .115, .115, .31, 0, .02, .23, 24);
  for (const yy of [-.145, .185]) {
    cylinder(wallLamp, woodDark, .128, .128, .024, 0, yy, .23, 24);
    torus(wallLamp, brassDark, .116, .003, 0, yy + .015, .23, 32).rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    cylinder(wallLamp, wood, .0032, .0032, .32, Math.sin(a) * .117, .02, .23 + Math.cos(a) * .117, 5);
  }
  cylinder(wallLamp, cord, .0035, .0035, .07, 0, .22, .23, 6);
  const studyLight = new THREE.PointLight('#ffc58b', 8.5, 7.5, 2);
  studyLight.position.set(0, .02, .30); wallLamp.add(studyLight); batchStatic(wallLamp);

  // ---------------------------- The library ----------------------------
  const shelf = group('library-carved-wood-shelf', -4, -6);
  for (let i = 0; i < 7; i++) bevel(shelf, woodDark, .374, 1.98, .033, (i - 3) * .378, 1.16, -.245, .002);
  for (const xx of [-1.34, 1.34]) {
    bevel(shelf, wood, .085, 2.15, .48, xx, 1.10, 0);
    bevel(shelf, woodDark, .17, .11, .54, xx, .055, 0);
    bevel(shelf, woodEdge, .018, 1.92, .012, xx - Math.sign(xx) * .026, 1.15, .247, .002);
    for (const yy of [.19, .69, 1.19, 1.69, 2.14]) {
      bevel(shelf, woodDark, .040, .042, .003, xx, yy, .244, .001);
      cylinder(shelf, brassDark, .004, .004, .004, xx, yy, .248, 8).rotation.x = Math.PI / 2;
    }
  }
  const levels = [.18, .68, 1.18, 1.68];
  for (const yy of [...levels, 2.16]) {
    bevel(shelf, wood, 2.72, .048, .52, 0, yy, 0);
    bevel(shelf, woodEdge, 2.59, .009, .016, 0, yy + .006, .269, .0015);
    for (const xx of [-1.17, 1.17]) {
      const bracket = bevel(shelf, woodDark, .048, .12, .16, xx, yy - .08, -.02);
      bracket.rotation.x = -.38;
    }
  }
  bevel(shelf, woodDark, 2.84, .055, .59, 0, 2.208, 0);
  bevel(shelf, woodEdge, 2.78, .014, .56, 0, 2.241, 0, .002);
  const shelfTitle = written('shelf', 'books');
  bevel(shelf, woodDark, .24, .31, .03, .94, 1.98, .29);
  label(shelf, shelfTitle, .14, .25, .94, 1.98, .306);
  let pulledBook: THREE.Group | null = null;
  let pulledBookBaseZ = 0;
  for (let row = 0; row < 4; row++) {
    const bottom = levels[row] + .024;
    let xx = -1.22;
    const count = row === 2 ? 18 : row === 3 ? 15 : 21;
    for (let i = 0; i < count; i++) {
      const thickness = .046 + ((i * 5 + row * 3) % 5) * .008;
      const height = .29 + ((i * 7 + row) % 5) * .02;
      const depth = .215 + i % 3 * .013;
      const book = boundBook(thickness, height, depth, i + row * 2, i + row * 4);
      book.position.set(xx + thickness / 2, bottom + height / 2, .085 + Math.sin(i * 7.1 + row) * .009);
      if (row === 2 && i === 14) {
        pulledBook = book; book.name = 'book-that-slides-out'; pulledBookBaseZ = book.position.z;
      }
      shelf.add(book); xx += thickness + .012;
    }
    let stackY = bottom;
    if (row !== 3) for (let i = 0; i < 3; i++) stackY += lyingBook(shelf, .70, stackY, .036, row * 3 + i, .025 * (i - 1)) + .002;
    else {
      const display = boundBook(.035, .35, .236, 2, 0);
      display.rotation.y = -Math.PI / 2 + .10;
      display.position.set(.36, bottom + .175, .06);
      shelf.add(display);
    }
  }
  batchStatic(shelf, pulledBook ? [pulledBook] : []);
  if (pulledBook) batchStatic(pulledBook);
  colliders.push({ x: -4, z: -6, halfX: 1.43, halfZ: .32 });
  let bookOpen = false;
  interactions.push({ id: 'books', kind: 'books', label: '取一卷书', labelEn: 'Browse the library',
    position: new THREE.Vector3(-4, 1.76, -5.76), approach: new THREE.Vector3(-4, .3, -4.55),
    radius: 2.15, meshes: [shelf], activate: () => { bookOpen = true; } });

  /** Framed top, breadboard ends, inset panels, mortise pegs, and shaped apron brackets. */
  function writingTable(parent: THREE.Group, width: number, depth: number, top = .78) {
    bevel(parent, woodDark, width, .058, depth, 0, top - .029, 0, .009);
    for (const zz of [-1, 1]) bevel(parent, woodEdge, width - .04, .014, .072, 0, top - .007, zz * (depth / 2 - .05), .002);
    for (const xx of [-1, 1]) bevel(parent, wood, .10, .014, depth - .15, xx * (width / 2 - .066), top - .007, 0, .002);
    const panelWidth = width - .24;
    for (let i = 0; i < 4; i++) bevel(parent, i % 2 ? wood : woodEdge,
      panelWidth / 4 - .003, .013, depth - .174, (i - 1.5) * panelWidth / 4, top - .0065, 0, .0012);
    const legX = width / 2 - .16, legZ = depth / 2 - .14;
    for (const xx of [-legX, legX]) {
      for (const zz of [-legZ, legZ]) {
        bevel(parent, wood, .075, top - .068, .083, xx, (top - .068) / 2, zz, .005);
        bevel(parent, woodDark, .085, .038, .094, xx, .026, zz, .004);
        for (const yy of [top - .13, top - .19]) cylinder(parent, brassDark, .005, .005, .004,
          xx, yy, zz + Math.sign(zz) * .043, 8).rotation.x = Math.PI / 2;
        const bracketGeometry = geometry('table-ogee-bracket', () => {
          const s = new THREE.Shape();
          s.moveTo(0, 0); s.lineTo(.23, 0); s.lineTo(.23, -.035);
          s.bezierCurveTo(.09, -.025, .105, -.12, .035, -.18); s.lineTo(0, -.18); s.closePath();
          const result = new THREE.ExtrudeGeometry(s, { depth: .026, bevelEnabled: true, bevelSize: .002,
            bevelThickness: .002, bevelSegments: 2, curveSegments: 8, steps: 1 });
          result.translate(0, 0, -.013); return result;
        });
        const bracket = mesh(parent, bracketGeometry, wood, xx, top - .10, zz);
        bracket.scale.x = -Math.sign(xx);
      }
      bevel(parent, woodDark, .048, .047, legZ * 2 + .09, xx, .19, 0, .004);
    }
    for (const zz of [-legZ, legZ]) {
      bevel(parent, woodDark, legX * 2 + .03, .12, .045, 0, top - .13, zz);
      bevel(parent, woodEdge, legX * 2 - .11, .006, .006, 0, top - .15, zz + Math.sign(zz) * .026, .001);
    }
    bevel(parent, wood, legX * 2, .043, .048, 0, .19, 0, .004);
    // A shallow central drawer; its pull and end-grain joint pins remain readable at arm's length.
    bevel(parent, wood, .44, .095, .024, 0, top - .123, legZ + .026, .004);
    for (const xx of [-.11, .11]) {
      cylinder(parent, brassDark, .012, .012, .008, xx, top - .12, legZ + .043, 14).rotation.x = Math.PI / 2;
      const pull = torus(parent, brass, .019, .0025, xx, top - .137, legZ + .051, 24);
      pull.scale.y = .78;
    }
  }

  // ---------------------- Writing desk and open book ----------------------
  const desk = group('writing-desk', 0, -7);
  writingTable(desk, 2.95, 1.25);
  const notebook = new THREE.Group();
  notebook.name = 'open-handwritten-notebook';
  notebook.position.set(-.38, .786, .08); notebook.rotation.y = -.10; desk.add(notebook);
  const manuscript = written('notes', 'latest');
  const verse = written('poem');
  for (const side of [-1, 1]) {
    const half = new THREE.Group(); half.position.x = side * .132; half.rotation.z = side * -.025; notebook.add(half);
    bevel(half, bindings[2], .269, .006, .370, 0, 0, 0, .001);
    box(half, paperEdge, .257, .021, .356, 0, .014, 0);
    for (let i = 0; i < 5; i++) box(half, paper, .255 + Math.sin(i) * .001, .0007, .355, 0, .006 + i * .0035, .0004 * i);
    const page = label(half, side > 0 ? manuscript : verse, .255, .352, 0, .0251, 0);
    page.rotation.x = -Math.PI / 2;
  }
  cylinder(notebook, cord, .0024, .0024, .359, 0, .018, 0, 8).rotation.x = Math.PI / 2;
  for (const zz of [-.13, -.045, .045, .13]) rod(notebook, cord,
    new THREE.Vector3(-.012, .024, zz), new THREE.Vector3(.012, .024, zz), .0013, 5);
  const turningLeaf = new THREE.Group(); turningLeaf.name = 'turning-manuscript-page'; turningLeaf.position.y = .031; notebook.add(turningLeaf);
  const leafGeometry = geometry('curved-turning-page', () => {
    const result = new THREE.PlaneGeometry(.255, .352, 16, 4);
    result.rotateX(-Math.PI / 2); result.translate(.1275, 0, 0);
    const p = result.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) / .255 * Math.PI) * .004);
    result.computeVertexNormals(); return result;
  });
  mesh(turningLeaf, leafGeometry, manuscript);
  let leafElapsed = 2, leafHasTurned = false;
  const bookmark = box(notebook, red, .012, .0017, .12, .081, .007, .213);
  bookmark.rotation.x = .23;
  for (let i = 0; i < 4; i++) cylinder(notebook, red, .0008, .0008, .026, .077 + i * .0026, -.005, .270, 4).rotation.x = .38;

  const tableY = .78;
  // Hollow ceramic forms have real rims, feet, and interiors at first-person distance.
  lathe(desk, ceramic, 'brush-pot-profile', [[.045,0],[.054,.008],[.057,.136],[.055,.145],[.050,.145],[.050,.012],[0,.012]], .48, tableY, -.35);
  for (let i = 0; i < 3; i++) {
    const brush = new THREE.Group(); brush.position.set(.47 + i * .014, tableY + .18, -.35 + i * .008);
    brush.rotation.z = -.18 + i * .14; brush.rotation.x = .10 + i * .07; desk.add(brush);
    cylinder(brush, woodEdge, .0037, .0044, .24, 0, 0, 0, 10);
    cylinder(brush, brassDark, .0045, .0045, .015, 0, -.12, 0, 10);
    cylinder(brush, ink, .0043, .0008, .045, 0, -.149, 0, 10);
    for (const yy of [-.07, .035]) cylinder(brush, woodDark, .0047, .0047, .002, 0, yy, 0, 10);
  }
  bevel(desk, inkstone, .205, .026, .142, .38, tableY + .013, -.05, .013);
  const inkPool = cylinder(desk, ink, .046, .046, .001, .397, tableY + .0272, -.052, 32);
  inkPool.scale.z = .83; inkPool.castShadow = false;
  const wellRim = torus(desk, inkstone, .050, .004, .397, tableY + .027, -.052, 40);
  wellRim.rotation.x = Math.PI / 2; wellRim.scale.y = .83;
  bevel(desk, ink, .025, .018, .092, .30, tableY + .033, -.047, .003);
  // A resting brush spans a small carved rest instead of floating over the table.
  bevel(desk, ceramic, .075, .018, .025, .46, tableY + .009, .23, .006);
  const restingBrush = new THREE.Group(); restingBrush.position.set(.44, tableY + .027, .17);
  restingBrush.rotation.set(Math.PI / 2, 0, -.16); desk.add(restingBrush);
  cylinder(restingBrush, woodEdge, .0038, .0048, .25, 0, 0, 0, 12);
  cylinder(restingBrush, brassDark, .0046, .0046, .018, 0, -.125, 0, 10);
  cylinder(restingBrush, ink, .0045, .0006, .047, 0, -.157, 0, 12);
  lathe(desk, ceramic, 'tea-saucer-profile', [[0,0],[.045,0],[.087,.008],[.090,.015],[.085,.019],[.046,.009],[0,.007]], -1.03, tableY + .002, .28);
  lathe(desk, ceramic, 'tea-cup-profile', [[.028,0],[.030,.008],[.047,.021],[.062,.065],[.062,.069],[.058,.070],[.054,.062],[.040,.022],[.025,.014],[0,.014]], -1.03, tableY + .012, .28);
  const tea = material({ color: '#593b20', roughness: .13, metalness: .12 });
  cylinder(desk, tea, .052, .052, .0015, -1.03, tableY + .069, .28, 40);
  torus(desk, ceramic, .061, .0016, -1.03, tableY + .081, .28, 40).rotation.x = Math.PI / 2;
  // Rolled manuscripts show concentric page edges on the cut ends and a real tied loop.
  for (let i = 0; i < 2; i++) {
    const roll = new THREE.Group(); roll.position.set(-1.0, tableY + .029, -.08 - i * .083); roll.rotation.y = -.15 + i * .07; desk.add(roll);
    cylinder(roll, paper, .028, .028, .31, 0, 0, 0, 24).rotation.z = Math.PI / 2;
    for (const xx of [-.156, .156]) {
      for (const r of [.013, .020, .026]) { const end = torus(roll, paperEdge, r, .0009, xx, 0, 0, 28); end.rotation.y = Math.PI / 2; }
      cylinder(roll, woodDark, .010, .010, .025, xx + Math.sign(xx) * .012, 0, 0, 12).rotation.z = Math.PI / 2;
    }
    torus(roll, cord, .029, .0018, 0, 0, 0, 30).rotation.y = Math.PI / 2;
    for (const side of [-1, 1]) {
      const loop = torus(roll, cord, .009, .0013, side * .008, .029, 0, 20);
      loop.rotation.x = Math.PI / 2; loop.scale.y = .55;
    }
  }
  batchStatic(desk, [notebook]); batchStatic(notebook, [turningLeaf]);
  colliders.push({ x: 0, z: -7, halfX: 1.49, halfZ: .64 });
  interactions.push({ id: 'latest', kind: 'latest', label: '翻开手记', labelEn: 'Read the latest notes',
    position: new THREE.Vector3(-.38, 1.115, -6.92), approach: new THREE.Vector3(-.35, .3, -5.55), radius: 2.1,
    meshes: [notebook], activate: () => { leafElapsed = 0; leafHasTurned = true; } });

  // The letter has its own raycast group; aiming at the desk cannot select it.
  const letter = group('personal-letter', 1.03, -6.79); letter.position.y = 1.087; letter.rotation.y = .12;
  for (let i = 0; i < 3; i++) {
    const slip = bevel(letter, paper, .348, .0012, .242, .003 * i, -.002 + .0013 * i, -.003 * i, .0002);
    slip.rotation.y = -.022 * i;
  }
  bevel(letter, paper, .32, .006, .228, 0, .005, 0, .001);
  const letterPaper = written('letter', 'about');
  const letterTop = label(letter, letterPaper, .308, .215, 0, .0084, 0); letterTop.rotation.x = -Math.PI / 2;
  const letterFlap = new THREE.Group(); letterFlap.position.set(0, .010, -.108); letter.add(letterFlap);
  const flapGeometry = geometry('letter-folded-triangle', () => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute([-.156,0,0, .156,0,0, 0,0,.145],3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2)); result.computeVertexNormals(); return result;
  });
  const flapPaper = surface('paper', { roughness: 1, side: THREE.DoubleSide, normalScale: .25 });
  mesh(letterFlap, flapGeometry, flapPaper);
  const sealGeometry = geometry('irregular-wax-seal', () => {
    const result = new THREE.CylinderGeometry(.019, .0205, .0045, 36);
    const p = result.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const s = 1 + Math.sin(a * 7) * .04 + Math.cos(a * 11) * .025; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
    result.computeVertexNormals(); return result;
  });
  mesh(letterFlap, sealGeometry, wax, 0, .003, .124);
  torus(letterFlap, red, .0146, .0013, 0, .0058, .124, 36).rotation.x = Math.PI / 2;
  const sealGlyph = label(letterFlap, written('seal'), .019, .022, 0, .0059, .124); sealGlyph.rotation.x = -Math.PI / 2;
  batchStatic(letter, [letterFlap]); batchStatic(letterFlap);
  let letterOpen = false;
  interactions.push({ id: 'about', kind: 'about', label: '读一封小笺', labelEn: 'Read a personal letter',
    position: new THREE.Vector3(1.03, 1.106, -6.79), approach: new THREE.Vector3(1.48, .3, -5.65), radius: 1.95,
    meshes: [letter], activate: () => { letterOpen = true; } });

  // ----------------------- The instrument workbench -----------------------
  const workbench = group('project-workbench', 3.65, -8.2); writingTable(workbench, 2.3, 1.1);
  const instrumentBase = new THREE.Group(); instrumentBase.name = 'armillary-pedestal'; instrumentBase.position.set(-.15, 0, -.03); workbench.add(instrumentBase);
  bevel(instrumentBase, woodDark, .55, .042, .48, 0, .805, 0);
  bevel(instrumentBase, woodEdge, .51, .012, .44, 0, .832, 0, .002);
  lathe(instrumentBase, brassDark, 'armillary-turned-pedestal', [[0,0],[.17,0],[.175,.012],[.15,.025],[.10,.045],[.038,.075],[.028,.19],[.046,.208],[.048,.224],[.033,.23]], 0, .84, 0, 40);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    cylinder(instrumentBase, brass, .012, .012, .004, Math.sin(a) * .145, .856, Math.cos(a) * .145, 16);
  }
  const armillary = new THREE.Group(); armillary.name = 'moving-armillary-sphere';
  armillary.position.set(-.15, 1.385, -.03); armillary.rotation.z = .409; workbench.add(armillary);
  function band(parent: THREE.Group, radius: number, width: number, depth: number, mat: THREE.Material) {
    const geo = geometry(`engraved-ring:${radius}:${width}:${depth}`, () => {
      const shape = new THREE.Shape(); shape.absarc(0,0,radius,0,Math.PI*2,false);
      const hole = new THREE.Path(); hole.absarc(0,0,radius-width,0,Math.PI*2,true); shape.holes.push(hole);
      const result = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, curveSegments: 64,
        bevelEnabled: true, bevelSize: .0012, bevelThickness: .0012, bevelSegments: 1 });
      result.translate(0,0,-depth/2); return result;
    });
    return mesh(parent, geo, mat);
  }
  const outerRing = new THREE.Group(); armillary.add(outerRing); band(outerRing, .345, .023, .007, brass);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, long = i % 6 === 0;
    const tick = box(outerRing, brassDark, long ? .002 : .001, long ? .015 : .008, .0012,
      Math.sin(a) * .333, Math.cos(a) * .333, .0048); tick.rotation.z = -a;
  }
  const middle = new THREE.Group(); armillary.add(middle); middle.rotation.y = Math.PI / 2; band(middle, .297, .018, .005, brass);
  const inner = new THREE.Group(); armillary.add(inner); inner.rotation.x = Math.PI / 2; band(inner, .253, .018, .005, brassDark);
  const ecliptic = band(armillary, .275, .014, .005, brass); ecliptic.rotation.x = .6;
  const globe = mesh(armillary, geometry('armillary-globe', () => new THREE.SphereGeometry(.078, 24, 18)), ceramic);
  globe.castShadow = false;
  for (const elevation of [-.5, 0, .5]) {
    const ring = torus(armillary, brassDark, Math.cos(elevation) * .079, .0014, 0, Math.sin(elevation) * .079, 0, 48);
    ring.rotation.x = Math.PI / 2;
  }
  for (const angle of [0, Math.PI / 2]) torus(armillary, brassDark, .079, .0014, 0, 0, 0, 48).rotation.y = angle;
  cylinder(armillary, brass, .004, .004, .78, 0, 0, 0, 12);
  for (const yy of [-.39, .39]) {
    cylinder(armillary, brassDark, .012, .012, .020, 0, yy, 0, 16);
    mesh(armillary, geometry('axis-finial', () => new THREE.SphereGeometry(.013, 12, 8)), brass, 0, yy + Math.sign(yy) * .018, 0);
  }
  const horizon = band(instrumentBase, .368, .022, .008, brassDark); horizon.rotation.x = Math.PI / 2; horizon.position.y = 1.385;
  for (const side of [-1, 1]) {
    tube(instrumentBase, brassDark, `instrument-fork:${side}`, [new THREE.Vector3(0,1.04,0), new THREE.Vector3(side*.16,1.11,0), new THREE.Vector3(side*.32,1.25,0), new THREE.Vector3(side*.34,1.385,0)], .006, 18);
  }
  const projectCard = new THREE.Group(); projectCard.name = 'project-identification-card'; projectCard.position.set(.64,.80,.27); projectCard.rotation.x = -.32; workbench.add(projectCard);
  bevel(projectCard, woodDark, .20, .24, .018, 0,.10,0,.003);
  label(projectCard, written('project', 'projects'), .12,.205,0,.10,.010);
  const schematic = label(workbench, written('schematic'), .32,.43,.67,.782,-.14); schematic.rotation.x = -Math.PI / 2;
  let bookHeight = .78;
  for (let i = 0; i < 3; i++) bookHeight += lyingBook(workbench,-.86,bookHeight,-.03,8+i,(i-1)*.05)+.002;
  batchStatic(workbench,[armillary,instrumentBase,projectCard]); batchStatic(instrumentBase); batchStatic(projectCard);
  batchStatic(armillary,[outerRing,middle,inner]); batchStatic(outerRing); batchStatic(middle); batchStatic(inner);
  colliders.push({ x: 3.65, z: -8.2, halfX: 1.16, halfZ: .565 });
  let instrumentImpulse = 0;
  interactions.push({ id:'projects',kind:'projects',label:'拨动浑天仪',labelEn:'Explore the workbench',
    position:new THREE.Vector3(3.5,1.685,-8.23),approach:new THREE.Vector3(3.5,.3,-6.45),radius:2.45,
    meshes:[armillary,instrumentBase,projectCard],activate:()=>{instrumentImpulse=2.7;} });

  // ------------------------- Bamboo paper lantern -------------------------
  const lamp = group('courtyard-paper-lantern', -3, 3);
  bevel(lamp,woodDark,.48,.09,.44,-.53,.045,0,.014);
  cylinder(lamp,wood,.035,.048,2.34,-.53,1.22,0,16);
  bevel(lamp,woodDark,.79,.052,.055,-.16,2.34,0);
  rod(lamp,woodEdge,new THREE.Vector3(-.53,2.05,0),new THREE.Vector3(-.15,2.315,0),.021,10);
  for(const yy of [2.21,2.27,2.33]) torus(lamp,cord,.038,.0025,-.53,yy,0,24).rotation.x=Math.PI/2;
  const lantern = new THREE.Group(); lantern.name='hanging-lantern';lantern.position.set(.15,2.34,0);lamp.add(lantern);
  cylinder(lantern,cord,.0035,.0035,.23,0,-.115,0,8);
  const hook=torus(lantern,brassDark,.019,.003,0,-.225,0,28);hook.scale.y=1.4;
  const lanternPaper=surface('paper',{normalScale:.55,roughness:1});lanternPaper.emissive.set('#ffbb76');lanternPaper.emissiveIntensity=.7;
  const lanternProfile: number[][]=[];
  for(let i=0;i<=20;i++){const t=i/20;lanternProfile.push([.102+Math.sin(t*Math.PI)*.087,-.25+t*.5]);}
  lathe(lantern,lanternPaper,'lantern-pleated-paper',lanternProfile,0,-.535,0,48);
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    const points=lanternProfile.map(([r,y])=>new THREE.Vector3(Math.sin(a)*(r+.0018),y-.535,Math.cos(a)*(r+.0018)));
    tube(lantern,woodEdge,`lantern-bamboo-rib:${i}`,points,.0021,24);
  }
  for(const t of [.12,.32,.5,.68,.88]){
    const r=.102+Math.sin(t*Math.PI)*.087;
    torus(lantern,woodDark,r+.0025,.0018,0,-.785+t*.5,0,48).rotation.x=Math.PI/2;
  }
  for(const yy of [-.277,-.793]){
    cylinder(lantern,woodDark,.112,.112,.018,0,yy,0,32);
    torus(lantern,brassDark,.107,.0025,0,yy+.010,0,40).rotation.x=Math.PI/2;
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;cylinder(lantern,cord,.0017,.0017,.025,Math.sin(a)*.109,yy,Math.cos(a)*.109,5);}
  }
  const glyph=label(lantern,written('lamp','lantern'),.078,.127,0,-.53,.1915);glyph.rotation.x=-.015;
  cylinder(lantern,red,.006,.006,.075,0,-.84,0,12);
  for(let i=0;i<9;i++)cylinder(lantern,red,.0012,.0006,.105,(i-4)*.0023,-.922,Math.sin(i)*.002,5);
  cylinder(lantern,cord,.0018,.0018,.34,.125,-.93,.01,6);
  lathe(lantern,brassDark,'lantern-pull-bead',[[.002,0],[.008,.006],[.009,.018],[.005,.028],[.002,.03]],.125,-1.115,.01,16);
  const lampLight=new THREE.PointLight('#ffbe80',5.8,6.5,2);lampLight.position.set(0,-.535,0);lantern.add(lampLight);
  batchStatic(lamp,[lantern]);batchStatic(lantern);
  colliders.push({x:-3.53,z:3,halfX:.25,halfZ:.23},{x:-2.85,z:3,halfX:.20,halfZ:.20});
  let lampOn=true,lampAmount=1;
  interactions.push({id:'lantern',kind:'lantern',label:'拨一盏灯',labelEn:'Switch the lantern',
    position:new THREE.Vector3(-2.85,2.105,3),approach:new THREE.Vector3(-1.65,.3,2.8),radius:1.95,
    meshes:[lantern],activate:()=>{lampOn=!lampOn;} });

  // --------------------------- Overlook bench ---------------------------
  const bench=group('overlook-carved-bench',10,5);
  for(const xx of [-1.07,1.07]){
    for(const zz of [-.235,.235]){
      bevel(bench,wood,.082,.44,.085,xx,.22,zz);
      bevel(bench,woodDark,.11,.038,.11,xx,.026,zz);
    }
    bevel(bench,wood,.052,.043,.55,xx,.17,0);
    bevel(bench,wood,.072,.68,.078,xx,.77,.245);
    bevel(bench,wood,.063,.29,.064,xx,.625,-.235);
    bevel(bench,woodEdge,.11,.042,.61,xx,.79,0);
    rod(bench,wood,new THREE.Vector3(xx,.60,.235),new THREE.Vector3(xx,.765,-.13),.018,8);
  }
  for(let i=0;i<3;i++)bevel(bench,wood,2.46,.065,.185,0,.4475,(i-1)*.20,.009);
  for(const zz of [-.235,.235])bevel(bench,woodDark,2.2,.072,.038,0,.374,zz);
  bevel(bench,woodDark,2.45,.085,.080,0,1.08,.245);
  bevel(bench,wood,2.21,.052,.050,0,.66,.245);
  for(let i=0;i<9;i++){
    bevel(bench,wood,.034,.365,.037,(i-4)*.237,.868,.245,.004);
    for(const yy of [.68,1.04])cylinder(bench,brassDark,.0035,.0035,.003,(i-4)*.237,yy,.224,8).rotation.x=Math.PI/2;
  }
  bevel(bench,wood,2.14,.043,.045,0,.17,0);
  bevel(bench,woodDark,.49,.205,.021,0,.875,.213,.004);
  const benchPlaque=label(bench,written('bench','bench'),.12,.18,0,.875,.201);benchPlaque.rotation.y=Math.PI;
  const clothGeometry=geometry('draped-bench-cloth',()=>{
    const result=new THREE.PlaneGeometry(.52,.67,12,20),p=result.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),v=p.getY(i),over=Math.max(0,-v-.14);
      p.setXYZ(i,x,.008-over*1.65+Math.sin(x*31)*over*.12,v);
    }
    result.computeVertexNormals();return result;
  });
  const benchCloth=mesh(bench,clothGeometry,cloth,.68,.48,-.085);benchCloth.rotation.y=.04;
  for(const xx of [.425,.935])tube(bench,cord,`bench-hem:${xx}`,[new THREE.Vector3(xx,.490,.23),new THREE.Vector3(xx,.490,-.10),new THREE.Vector3(xx,.483,-.23),new THREE.Vector3(xx,.18,-.42)],.0015,16);
  batchStatic(bench);
  colliders.push({x:10,z:5,halfX:1.24,halfZ:.36});
  interactions.push({id:'bench',kind:'bench',label:'坐看山色',labelEn:'Pause by the mountains',
    position:new THREE.Vector3(10,1.175,5.201),approach:new THREE.Vector3(10,.3,3.65),radius:2.05,meshes:[bench],
    // Actual seat contact point, NOT a standing capsule foot. Add only the seated eye offset.
    sitPosition:new THREE.Vector3(10,.78,4.88),sitYaw:0});

  let disposed = false, instrumentAngle = 0;
  return {
    root, colliders, interactions,
    update(time, delta, selectedId) {
      if (disposed) return;
      const dt = Math.min(Math.max(delta, 0), .08);
      if (selectedId !== 'books') bookOpen = false;
      if (selectedId !== 'about') letterOpen = false;
      if (pulledBook) {
        const distance = bookOpen ? .10 : selectedId === 'books' ? .035 : 0;
        pulledBook.position.z = THREE.MathUtils.damp(pulledBook.position.z, pulledBookBaseZ + distance, 7, dt);
      }
      if (leafHasTurned) {
        leafElapsed = Math.min(1.25, leafElapsed + dt);
        turningLeaf.rotation.z = THREE.MathUtils.smoothstep(leafElapsed / 1.25, 0, 1) * Math.PI;
      }
      letterFlap.rotation.x = THREE.MathUtils.damp(letterFlap.rotation.x,
        letterOpen ? -1.2 : selectedId === 'about' ? -.10 : 0, 6, dt);
      instrumentImpulse = Math.max(0, instrumentImpulse - dt);
      instrumentAngle += dt * (.04 + (selectedId === 'projects' ? .12 : 0) + instrumentImpulse * .5);
      middle.rotation.y = Math.PI / 2 + instrumentAngle;
      inner.rotation.z = instrumentAngle * .62;
      outerRing.rotation.y = Math.sin(time * .12) * .035;
      lantern.rotation.z = Math.sin(time * .8) * .018;
      lantern.rotation.x = Math.sin(time * .61 + .9) * .009;
      lampAmount = THREE.MathUtils.damp(lampAmount, lampOn ? 1 : 0, 9, dt);
      const flicker = 1 + Math.sin(time * 4.2) * .010 + Math.sin(time * 9.1) * .006;
      lampLight.intensity = lampAmount * 5.8 * flicker;
      lanternPaper.emissiveIntensity = .025 + lampAmount * .70 * flicker;
      for (const entry of focusMaterials) {
        entry.material.emissiveIntensity = THREE.MathUtils.damp(entry.material.emissiveIntensity,
          entry.id === selectedId ? .07 : 0, 7, dt);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
      lettering.dispose();
      if (ownsLibrary) library.dispose();
      geometries.clear(); materials.clear(); geometryCache.clear();
    },
  };
}
