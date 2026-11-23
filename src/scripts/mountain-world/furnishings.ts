import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceLibrary, type SurfaceLibrary, type SurfaceKind, type SurfaceOptions } from './materials';
import { createFurnishingInk } from './furnishing-ink';
import { createBenchCushionGeometry, createBrushRestGeometry, createInkstoneGeometry, createScreenArtwork } from './furnishing-design';
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
  const artwork = createScreenArtwork();
  let disposed = false;
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
  const wood = surface('wood', { worldScale: .9, roughness: .72, normalScale: .42 });
  const woodDark = surface('wood', { color: '#d3d9d5', worldScale: .9, roughness: .82, normalScale: .42 });
  const woodEdge = surface('wood', { color: '#f2f0e9', worldScale: .9, roughness: .65, normalScale: .36 });
  const paper = surface('paper', { roughness: 1, normalScale: .35 });
  const paperEdge = surface('paper', { roughness: 1, normalScale: .25 });
  paperEdge.map = lettering.pageEdges;
  const brass = surface('brass', { roughness: .44, metalness: .92, normalScale: .18, worldScale: 3 });
  const brassDark = surface('brass', { color: '#d2d8ca', roughness: .72, metalness: .82, normalScale: .18, worldScale: 3 });
  const ceramic = surface('ceramic', { roughness: .36, normalScale: .18, worldScale: 5 });
  const inkstone = surface('darkStone', { color: '#b8bfbd', roughness: .85, normalScale: .25, worldScale: 4 });
  const ink = material({ color: '#182724', roughness: .23, metalness: .08 });
  const cord = material({ color: '#c5b38a', roughness: .97 });
  const red = material({ color: '#934b38', roughness: .64 });
  const cloth = surface('cloth', { roughness: .96, normalScale: .48, side: THREE.DoubleSide, worldScale: 2 });
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
    // Some volumes have bare cloth spines: the shelf reads as books, not repeated ivory bars.
    if (title % 3 !== 1) bookTag(result, title, Math.min(thickness * .62, .039), height * .68, 0, .012, depth / 2 + .0025);
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

  // A single circular landscape is the room's principal composition, with real depth and a silk face.
  const screen = group('circular-landscape-screen', 0, -9.36);
  screen.position.y = 2.5;
  const screenFrame = geometry('screen-deep-bevelled-wood-ring', () => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, 1.60, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, 1.46, 0, Math.PI * 2, true); shape.holes.push(hole);
    const result = new THREE.ExtrudeGeometry(shape, { depth: .12, steps: 1, curveSegments: 80,
      bevelEnabled: true, bevelThickness: .012, bevelSize: .008, bevelSegments: 3 });
    result.translate(0, 0, -.06); return result;
  });
  mesh(screen, screenFrame, woodDark);
  cylinder(screen, wood, 1.535, 1.535, .045, 0, 0, -.045, 96).rotation.x = Math.PI / 2;
  torus(screen, woodEdge, 1.565, .012, 0, 0, .061, 96);
  torus(screen, brass, 1.469, .0065, 0, 0, .074, 96);
  const silk = surface('paper', { color: '#ffffff', roughness: .98, normalScale: .12 });
  silk.name = 'non-emissive-landscape-silk'; silk.map = artwork.texture;
  silk.userData.artworkSource = 'canvas-fallback';
  mesh(screen, geometry('screen-silk-circle', () => new THREE.CircleGeometry(1.46, 96)), silk, 0, 0, .066, false);
  for (const xx of [-.9, .9]) for (const yy of [-.9, .9]) {
    cylinder(screen, woodDark, .045, .045, .45, xx, yy, -.285, 12).rotation.x = Math.PI / 2;
  }
  batchStatic(screen);
  colliders.push({ x: 0, z: -9.5, halfX: 1.64, halfZ: .26 });
  const screenReady = artwork.ready.then(texture => {
    if (disposed) return;
    silk.map = texture; silk.needsUpdate = true;
    silk.userData.artworkSource = artwork.loaded ? 'generated-local-artwork' : 'canvas-fallback';
  });

  const brocade = surface('cloth', {color:'#739486', repeat:[3,8], normalScale:.34, roughness:.84});
  const hostPaper = surface('paper', {roughness:.93, normalScale:.17, side:THREE.DoubleSide});
  hostPaper.map = lettering.portraitTexture;
  hostPaper.emissive.set('#b99056'); hostPaper.emissiveIntensity=0;
  focusMaterials.push({id:'about',material:hostPaper});
  const scrollSheet = geometry('silk-mounted-paper', () => {
    const sheet = new THREE.PlaneGeometry(1.19,1.87,10,32), p = sheet.attributes.position;
    for (let i=0;i<p.count;i++) {
      const y=p.getY(i);
      p.setZ(i, .012 + .010*Math.cos(y*4.5) + .004*Math.sin(y*13+p.getX(i)*1.7));
    }
    sheet.computeVertexNormals(); return sheet;
  });
  function mountScroll(name: string, x: number, field: THREE.Material) {
    const mount=group(name,x,-9.77); mount.position.y=2.13;
    bevel(mount,brocade,1.43,2.34,.022,0,0,-.017,.005);
    for (const side of [-1,1]) {
      box(mount,cord,.014,1.91,.009,side*.608,0,.003);
      box(mount,cord,1.23,.014,.009,0,side*.948,.003);
      const y=side*1.18, r=side<0?.052:.031;
      cylinder(mount,woodDark,r,r,1.49,0,y,0,24).rotation.z=Math.PI/2;
      for (const end of [-1,1]) {
        cylinder(mount,brassDark,r*1.08,r*1.08,.024,end*.752,y,0,20).rotation.z=Math.PI/2;
        cylinder(mount,wood,r*1.23,r*1.23,.075,end*.796,y,0,24).rotation.z=Math.PI/2;
      }
    }
    mesh(mount,scrollSheet,field);
    for (const side of [-1,1]) rod(mount,cord,new THREE.Vector3(side*.55,1.19,0),new THREE.Vector3(0,1.43,-.046),.006);
    cylinder(mount,brassDark,.025,.025,.11,0,1.43,-.045,12).rotation.x=Math.PI/2;
    batchStatic(mount); return mount;
  }
  mountScroll('North wall poetic inscription',-3.68,written('scroll'));
  const hostMount=mountScroll('North wall host biography scroll',3.68,hostPaper);
  interactions.push({ id:'about', kind:'about', label:'展读简历', labelEn:'Read the CV',
    position:new THREE.Vector3(3.68,2.22,-9.73), approach:new THREE.Vector3(3.68,.3,-7.46), radius:2.75, meshes:[hostMount] });
  const assetsReady=Promise.all([screenReady,lettering.portraitReady]).then(()=>{});

  const wallPaper = surface('paper', { roughness: 1, normalScale: .25 });
  wallPaper.emissive.set('#ffcea0'); wallPaper.emissiveIntensity = .42;
  for (const x of [-2.29, 2.29]) {
    const wallLamp = group('north-wall-paper-sconce', x, -9.82);
    wallLamp.position.y = 2.46;
    bevel(wallLamp, woodDark, .16, .42, .065, 0, .02, 0);
    bevel(wallLamp, wood, .038, .045, .25, 0, .24, .10);
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
    const studyLight = new THREE.PointLight('#ffe0b8', .68, 3.7, 2);
    studyLight.position.set(0, .02, .30); wallLamp.add(studyLight); batchStatic(wallLamp);
  }

  // ---------------------------- The library ----------------------------
  const shelf = group('library-carved-wood-shelf', -5.55, -3.2); shelf.rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) bevel(shelf, woodDark, .874, 1.98, .033, (i - 1) * .88, 1.16, -.245, .002);
  for (const xx of [-1.34, 1.34]) {
    bevel(shelf, wood, .085, 2.15, .48, xx, 1.10, 0);
    bevel(shelf, woodDark, .17, .11, .54, xx, .055, 0);
    bevel(shelf, woodEdge, .018, 1.92, .012, xx - Math.sign(xx) * .026, 1.15, .247, .002);
    for (const yy of [.19, .72, 1.28, 1.79, 2.14]) {
      bevel(shelf, woodDark, .040, .042, .003, xx, yy, .244, .001);
      cylinder(shelf, brassDark, .004, .004, .004, xx, yy, .248, 8).rotation.x = Math.PI / 2;
    }
  }
  const levels = [.18, .72, 1.28, 1.79];
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
  // The dividers follow three unequal bays; empty space is part of the composition.
  bevel(shelf, wood, .044, .48, .46, -.32, .45, -.01);
  bevel(shelf, wood, .044, .51, .46, -.48, 1.0, -.01);
  bevel(shelf, wood, .044, .83, .46, .36, 1.72, -.01);
  for (const xx of [.04, .82]) {
    bevel(shelf, wood, .74, .435, .035, xx, .45, .222, .005);
    bevel(shelf, woodDark, .62, .32, .008, xx, .45, .244, .003);
    cylinder(shelf, brassDark, .014, .014, .012, xx - .25, .45, .252, 16).rotation.x = Math.PI / 2;
    const pull = torus(shelf, brass, .021, .003, xx - .25, .432, .262, 24); pull.scale.y = .8;
  }
  const shelfTitle = written('shelf', 'books');
  bevel(shelf, woodDark, .19, .27, .027, .98, 1.98, .284);
  label(shelf, shelfTitle, .105, .218, .98, 1.98, .299);
  let pulledBook: THREE.Group | null = null;
  let pulledBookBaseZ = 0;
  function bookCluster(row: number, start: number, count: number, firstTitle: number, moving = -1) {
    const bottom = levels[row] + .024;
    let xx = start;
    for (let i = 0; i < count; i++) {
      const thickness = .046 + ((i * 3 + row) % 4) * .008;
      const height = (row === 3 ? .255 : .29) + ((i * 2 + row) % 4) * .018;
      const depth = .215 + i % 3 * .012;
      const book = boundBook(thickness, height, depth, i + row * 2, firstTitle + i);
      book.position.set(xx + thickness / 2, bottom + height / 2, .065 + Math.sin(i * 1.7 + row) * .009);
      if (i === moving) {
        pulledBook = book; book.name = 'book-that-slides-out'; pulledBookBaseZ = book.position.z;
      }
      shelf.add(book); xx += thickness + .011;
    }
  }
  function bookStack(row: number, x: number, count: number, firstTitle: number) {
    let bottom = levels[row] + .024;
    for (let i = 0; i < count; i++) bottom += lyingBook(shelf, x, bottom, .035, firstTitle + i, (i - 1) * .025) + .002;
    return bottom;
  }
  bookCluster(0, -1.23, 7, 0);
  bookCluster(1, -1.21, 7, 5);
  bookStack(1, .82, 3, 10);
  lathe(shelf, ceramic, 'shelf-shallow-bowl', [[.035,0],[.04,.008],[.092,.055],[.096,.066],[.091,.07],[.078,.052],[.035,.015],[0,.012]],
    -.04, levels[1] + .024, .035);
  bookStack(2, -.95, 4, 2);
  bookCluster(2, -.31, 7, 8, 3);
  lathe(shelf, ceramic, 'celadon-meiping-vase', [[.05,0],[.06,.012],[.073,.065],[.095,.165],[.081,.238],[.036,.285],[.035,.328],
    [.040,.332],[.040,.340],[.030,.340],[.028,.292],[.071,.235],[.084,.17],[.060,.055],[.043,.016],[0,.016]],
    .84, levels[2] + .024, .01, 40);
  const display = boundBook(.034, .28, .234, 1, 0);
  display.rotation.y = -Math.PI / 2 + .10;
  display.position.set(-.99, levels[3] + .164, .065); shelf.add(display);
  bookCluster(3, -.33, 5, 3);
  bookStack(3, .65, 2, 11);
  batchStatic(shelf, pulledBook ? [pulledBook] : []);
  if (pulledBook) batchStatic(pulledBook);
  colliders.push({ x: -5.55, z: -3.2, halfX: .32, halfZ: 1.43 });
  let bookOpen = false;
  interactions.push({ id: 'books', kind: 'books', label: '取一卷书', labelEn: 'Browse the library',
    position: new THREE.Vector3(-5.31, 1.76, -3.2), approach: new THREE.Vector3(-3.7, .3, -3.2),
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
  // One generous woven field gathers the writing tools; the tea and letter have their own space.
  bevel(desk, cloth, 1.74, .003, .89, -.06, .7815, -.015, .0005);
  const stitch = material({ color: '#a4aca0', roughness: .96 });
  for (const xx of [-.91, .79]) rod(desk, stitch,
    new THREE.Vector3(xx, .7833, -.435), new THREE.Vector3(xx, .7833, .405), .00065, 4);
  for (const zz of [-.435, .405]) rod(desk, stitch,
    new THREE.Vector3(-.91, .7833, zz), new THREE.Vector3(.79, .7833, zz), .00065, 4);
  const notebook = new THREE.Group();
  notebook.name = 'open-handwritten-notebook';
  notebook.position.set(-.38, .786, .08); notebook.rotation.y = -.10; desk.add(notebook);
  const manuscript = written('notes');
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
  const bookmark = box(notebook, red, .012, .0017, .12, .081, .007, .213);
  bookmark.rotation.x = .23;
  for (let i = 0; i < 4; i++) cylinder(notebook, red, .0008, .0008, .026, .077 + i * .0026, -.005, .270, 4).rotation.x = .38;

  const tableY = .78;
  const deskLamp = new THREE.Group();
  deskLamp.name = 'curved-stem-silk-desk-lamp'; deskLamp.position.set(-1.17, tableY, -.42); desk.add(deskLamp);
  lathe(deskLamp, woodDark, 'desk-lamp-low-base', [[0,0],[.125,0],[.139,.012],[.135,.025],[.11,.033],[0,.033]], 0, 0, 0, 40);
  torus(deskLamp, brassDark, .123, .0026, 0, .025, 0, 48).rotation.x = Math.PI / 2;
  tube(deskLamp, brassDark, 'desk-lamp-curved-stem', [new THREE.Vector3(-.065,.025,0), new THREE.Vector3(-.11,.23,0),
    new THREE.Vector3(-.095,.55,0), new THREE.Vector3(.07,.62,0), new THREE.Vector3(.10,.575,0)], .009, 32);
  const deskShade = surface('paper', { roughness: .94, normalScale: .22, side: THREE.DoubleSide });
  deskShade.emissive.set('#ffe1bd'); deskShade.emissiveIntensity = .24;
  lathe(deskLamp, deskShade, 'desk-lamp-silk-shade', [[.112,0],[.131,.015],[.145,.06],[.143,.19],[.123,.29],[.103,.31]], .10,.258,0,40);
  for (const yy of [.257, .57]) {
    const r = yy < .3 ? .114 : .106;
    cylinder(deskLamp, woodDark, r, r, .014, .10, yy, 0, 40);
    torus(deskLamp, brassDark, r, .0025, .10, yy + .008, 0, 48).rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    tube(deskLamp, woodEdge, `desk-lamp-silk-seam:${i}`, [new THREE.Vector3(.10 + Math.sin(a) * .112,.265,Math.cos(a) * .112),
      new THREE.Vector3(.10 + Math.sin(a) * .146,.34,Math.cos(a) * .146),
      new THREE.Vector3(.10 + Math.sin(a) * .143,.45,Math.cos(a) * .143),
      new THREE.Vector3(.10 + Math.sin(a) * .104,.565,Math.cos(a) * .104)], .0016, 16);
  }
  const deskLight = new THREE.PointLight('#ffe0bb', .75, 2.5, 2);
  deskLight.position.set(.10,.40,.01); deskLamp.add(deskLight);
  const porcelain = material({ map:lettering.brushGlaze,roughness:.28,metalness:.015 });
  const porcelainLip = material({color:'#e6e4cc',roughness:.24});
  const cobalt = material({color:'#426378',roughness:.32});
  const bamboo = material({color:'#aa7842',roughness:.49});
  const hairs = material({color:'#877454',roughness:.85});
  lathe(desk,porcelain,'bamboo-painted-brush-pot',[[.06,0],[.061,.009],[.077,.022],[.081,.048],
    [.077,.114],[.074,.161],[.077,.169],[.071,.173],[.066,.164],[.065,.041],[.047,.024],[0,.024]], .50,tableY,-.33,56);
  for(const [y,r] of [[.010,.061],[.165,.076]]) torus(desk,cobalt,r,.0025,.50,tableY+y,-.33,48).rotation.x=Math.PI/2;
  function writingBrush(parent: THREE.Group) {
    lathe(parent,bamboo,'bamboo-brush-shaft',[[0,0],[.004,0],[.006,.007],[.0058,.055],
      [.005,.166],[.0064,.213],[.0061,.249],[.005,.254],[0,.254]],0,0,0,16);
    for(const y of [.022,.180,.237]) cylinder(parent,woodDark,.0062,.0062,.003,0,y,0,16);
    cylinder(parent,brassDark,.0071,.0068,.014,0,.255,0,18);
    lathe(parent,hairs,'tapered-brush-hairs',[[.006,.260],[.0085,.268],[.010,.277],[.0094,.288],[.0058,.303],[.0025,.315]],0,0,0,20);
    lathe(parent,ink,'inked-brush-tip',[[.0026,.314],[.0014,.321],[.00025,.331]],0,0,0,16);
  }
  for (let j=0;j<4;j++) {
    const brush=new THREE.Group(), a=j*2.40, tilt=.11+.045*j;
    brush.position.set(.50+.014*Math.cos(a),tableY+.020,-.33+.014*Math.sin(a));
    brush.rotation.set(tilt*Math.sin(a),0,-tilt*Math.cos(a));
    brush.scale.setScalar(.88+.085*j);desk.add(brush);writingBrush(brush);
  }
  const slate = mesh(desk,geometry('carved-inkstone',createInkstoneGeometry),inkstone,.37,tableY+.004,-.078);
  slate.rotation.y=-.12;
  const inkPool = cylinder(desk,ink,.052,.051,.0016,.430,tableY+.020,-.071,48);
  inkPool.scale.z=.82; inkPool.rotation.y=-.12; inkPool.castShadow=false;
  const ingot=bevel(desk,ink,.032,.019,.087,.302,tableY+.049,-.084,.007);
  ingot.rotation.y=.15;
  for(let i=0;i<3;i++) bevel(desk,brassDark,.015,.0007,.002,.302+i*.001,tableY+.059,-.074-i*.010,.0003);
  const rest=mesh(desk,geometry('three-peak-brush-rest',createBrushRestGeometry),ceramic,.50,tableY+.004,.23);
  rest.rotation.y=-.15;
  const restingBrush=new THREE.Group();restingBrush.position.set(.512,tableY+.036,.386);
  restingBrush.rotation.set(-Math.PI/2+.045,.20,0,'YXZ');desk.add(restingBrush);writingBrush(restingBrush);

  const sealStone=surface('stone',{color:'#bf846a',roughness:.40,normalScale:.19,worldScale:7});
  bevel(desk,woodDark,.105,.008,.095,.72,tableY+.008,-.04,.004);
  bevel(desk,sealStone,.062,.063,.060,.72,tableY+.043,-.04,.006);
  const sealLoop=torus(desk,sealStone,.020,.007,.72,tableY+.083,-.04,24);sealLoop.scale.y=.78;
  tube(desk,red,'seal-silk-cord',[new THREE.Vector3(.719,tableY+.088,-.032),new THREE.Vector3(.754,tableY+.040,-.023),
    new THREE.Vector3(.775,tableY+.008,.003),new THREE.Vector3(.805,tableY+.005,-.006)],.0024);
  const teaX=-.88, teaZ=.29;
  const teaMat=bevel(desk,cloth,.29,.003,.25,teaX,tableY+.002,teaZ,.0005);teaMat.rotation.y=-.08;
  lathe(desk,porcelainLip,'tea-saucer-profile',[[0,0],[.045,0],[.094,.008],[.098,.016],[.093,.020],[.046,.009],[0,.007]],teaX,tableY+.005,teaZ,48);
  lathe(desk,porcelain,'painted-tea-bowl',[[.030,0],[.032,.009],[.046,.021],[.060,.047],[.068,.069],
    [.070,.074],[.066,.076],[.062,.067],[.046,.032],[.027,.016],[0,.016]],teaX,tableY+.015,teaZ,48);
  for (const [r,y] of [[.095,.022],[.069,.087]]) torus(desk,cobalt,r,.0015,teaX,tableY+y,teaZ,48).rotation.x=Math.PI/2;
  const tea=material({color:'#754423',roughness:.12,metalness:.025});
  cylinder(desk,tea,.060,.060,.0012,teaX,tableY+.078,teaZ,48).castShadow=false;
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

  // ----------------------- The instrument workbench -----------------------
  const workbench = group('project-workbench', 5, -2.8); workbench.rotation.y = -Math.PI / 2; writingTable(workbench, 2.3, 1.1);
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
  colliders.push({ x: 5, z: -2.8, halfX: .565, halfZ: 1.16 });
  let instrumentImpulse = 0;
  interactions.push({ id:'projects',kind:'projects',label:'翻阅项目',labelEn:'Explore projects',
    position:new THREE.Vector3(5.03,1.685,-2.95),approach:new THREE.Vector3(3.15,.3,-2.8),radius:2.45,
    meshes:[armillary,instrumentBase,projectCard],activate:()=>{instrumentImpulse=2.7;} });

  // ------------------------- Six-sided silk lantern -------------------------
  function courtLamp(side: number, id: string) {
    const lamp = group('courtyard-paper-lantern', side * 3.53, 4.55);
    if (side > 0) lamp.rotation.y = Math.PI;
    bevel(lamp, woodDark, .48, .09, .44, -.53, .045, 0, .014);
    bevel(lamp, wood, .37, .028, .34, -.53, .102, 0, .009);
    cylinder(lamp, wood, .030, .047, 1.96, -.53, 1.10, 0, 20);
    tube(lamp, wood, 'lantern-curved-crook', [new THREE.Vector3(-.53,2.05,0), new THREE.Vector3(-.51,2.30,0),
      new THREE.Vector3(-.35,2.43,0), new THREE.Vector3(-.06,2.43,0), new THREE.Vector3(.15,2.34,0)], .030, 36);
    for (const yy of [1.97, 2.015]) torus(lamp, brassDark, .032, .0025, -.53, yy, 0, 28).rotation.x = Math.PI / 2;
    const lantern = new THREE.Group(); lantern.name = 'hanging-lantern'; lantern.position.set(.15,2.34,0); lamp.add(lantern);
    cylinder(lantern, cord, .0035, .0035, .23, 0,-.115,0,8);
    const hook = torus(lantern,brassDark,.019,.003,0,-.225,0,28); hook.scale.y = 1.4;
    const lanternPaper = surface('paper', { normalScale: .28, roughness: .98, side: THREE.DoubleSide });
    lanternPaper.emissive.set('#ffd3a0'); lanternPaper.emissiveIntensity = .7;
    const lanternPanels = geometry('lantern-six-silk-panels', () => {
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3, b = a + Math.PI / 3;
        const base = positions.length / 3;
        positions.push(Math.sin(a) * .158,-.75,Math.cos(a) * .158, Math.sin(b) * .158,-.75,Math.cos(b) * .158,
          Math.sin(a) * .178,-.32,Math.cos(a) * .178, Math.sin(b) * .178,-.32,Math.cos(b) * .178);
        uvs.push(0,0,1,0,0,1,1,1); indices.push(base,base+1,base+2,base+2,base+1,base+3);
      }
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
      result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2)); result.setIndex(indices); result.computeVertexNormals(); return result;
    });
    mesh(lantern, lanternPanels, lanternPaper);
    cylinder(lantern, woodDark, .073, .244, .094, 0,-.267,0,6).rotation.y = Math.PI / 6;
    cylinder(lantern, woodDark, .187, .185, .024, 0,-.325,0,6).rotation.y = Math.PI / 6;
    cylinder(lantern, woodDark, .171, .181, .032, 0,-.765,0,6).rotation.y = Math.PI / 6;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3, b = a + Math.PI / 3;
      rod(lantern, woodEdge, new THREE.Vector3(Math.sin(a)*.162,-.75,Math.cos(a)*.162),
        new THREE.Vector3(Math.sin(a)*.182,-.32,Math.cos(a)*.182), .008, 8);
      for (const [r,y] of [[.186,-.338],[.175,-.748]]) rod(lantern, brassDark,
        new THREE.Vector3(Math.sin(a)*r,y,Math.cos(a)*r), new THREE.Vector3(Math.sin(b)*r,y,Math.cos(b)*r), .0023, 6);
    }
    const glyph = label(lantern, written('lamp',id), .042,.066,0,-.52,.1477); glyph.rotation.x = .040;
    const knot = torus(lantern, red, .010, .0023, 0,-.798,0,24); knot.scale.x = .65;
    cylinder(lantern, cord, .0018,.0018,.29,.125,-.91,.01,6);
    lathe(lantern, brassDark, 'lantern-pull-bead', [[.002,0],[.008,.006],[.009,.018],[.005,.028],[.002,.03]],.125,-1.075,.01,16);
    const lampLight = new THREE.PointLight('#ffd2a0',5.8,6.5,2); lampLight.position.set(0,-.535,0); lantern.add(lampLight);
    batchStatic(lamp,[lantern]); batchStatic(lantern);
    // The standard stands on the stone coping. Its shade hangs freely over the water.
    colliders.push({x:side*4.06,z:4.55,halfX:.22,halfZ:.18});
    let lampOn=true,lampAmount=1;
    interactions.push({id,kind:'lantern',label:'拨一盏灯',labelEn:'Switch the lantern',
      position:new THREE.Vector3(side*3.38,2.105,4.55),approach:new THREE.Vector3(side*1.99,.3,4.55),radius:1.95,
      meshes:[lantern],activate:()=>{lampOn=!lampOn;} });
    return (time: number, dt: number) => {
      lantern.rotation.z = Math.sin(time * .8) * .018;
      lantern.rotation.x = Math.sin(time * .61 + side * .9) * .009;
      lampAmount = THREE.MathUtils.damp(lampAmount, lampOn ? 1 : 0, 9, dt);
      const flicker = 1 + Math.sin(time * 4.2) * .010 + Math.sin(time * 9.1) * .006;
      lampLight.intensity = lampAmount * 5.8 * flicker;
      lanternPaper.emissiveIntensity = .025 + lampAmount * .70 * flicker;
    };
  }
  const courtyardLights = [courtLamp(-1, 'lantern'), courtLamp(1, 'east-lantern')];

  // --------------------------- Overlook bench ---------------------------
  const bench = group('overlook-carved-bench',10,5);
  for (const xx of [-1.07,1.07]) {
    for (const zz of [-.235,.235]) {
      bevel(bench,wood,.082,.44,.085,xx,.22,zz);
      bevel(bench,woodDark,.11,.038,.11,xx,.026,zz);
    }
    bevel(bench,wood,.052,.043,.55,xx,.17,0);
    bevel(bench,wood,.064,.61,.069,xx,.745,.265);
    bevel(bench,wood,.055,.29,.061,xx,.625,-.235);
    tube(bench,woodEdge,`bench-swept-arm:${xx}`,[new THREE.Vector3(xx,.78,-.27),new THREE.Vector3(xx,.795,-.15),
      new THREE.Vector3(xx,.83,.04),new THREE.Vector3(xx,.91,.27)],.026,24);
    rod(bench,wood,new THREE.Vector3(xx,.60,.235),new THREE.Vector3(xx,.765,-.13),.016,8);
  }
  for (let i=0;i<3;i++) bevel(bench,wood,2.46,.065,.185,0,.4475,(i-1)*.20,.009);
  for (const zz of [-.235,.235]) bevel(bench,woodDark,2.2,.072,.038,0,.374,zz);
  tube(bench,woodDark,'bench-curved-crest',[new THREE.Vector3(-1.20,1.03,.24),new THREE.Vector3(-.65,1.13,.31),
    new THREE.Vector3(0,1.17,.34),new THREE.Vector3(.65,1.13,.31),new THREE.Vector3(1.20,1.03,.24)],.035,48);
  tube(bench,wood,'bench-lower-bow',[new THREE.Vector3(-1.07,.67,.25),new THREE.Vector3(0,.72,.30),
    new THREE.Vector3(1.07,.67,.25)],.021,32);
  for (let i=0;i<5;i++) {
    const x=(i-2)*.43, f=1-(x/1.2)**2;
    tube(bench,wood,`bench-shaped-splat:${i}`,[new THREE.Vector3(x,.69,.28),new THREE.Vector3(x,.84,.31),
      new THREE.Vector3(x,1.02+f*.12,.24+f*.09)],.014,20);
  }
  bevel(bench,wood,2.14,.043,.045,0,.17,0);
  bevel(bench,woodDark,.31,.205,.021,0,.875,.294,.004);
  const benchPlaque=label(bench,written('bench','bench'),.12,.18,0,.875,.282);benchPlaque.rotation.y=Math.PI;
  const cushion = geometry('bench-tailored-cushion',()=>createBenchCushionGeometry(2.03,.435,.036));
  mesh(bench,cushion,cloth,0,.500,-.01);
  // A single fine welt follows the cushion; no loose cloth intrudes into the walkable terrace.
  for (const zz of [-.2275,.2075]) rod(bench,stitch,new THREE.Vector3(-1.012,.500,zz),new THREE.Vector3(1.012,.500,zz),.0016,5);
  for (const xx of [-1.014,1.014]) rod(bench,stitch,new THREE.Vector3(xx,.500,-.225),new THREE.Vector3(xx,.500,.205),.0016,5);
  batchStatic(bench);
  colliders.push({x:10,z:5,halfX:1.24,halfZ:.40});
  // The guide faces the broad cushion. Its surface is also the seated camera's height reference.
  const seatContact = new THREE.Vector3(10, .824, 4.88);
  interactions.push({
    id: 'bench', kind: 'bench', label: '坐看山色', labelEn: 'Pause by the mountains',
    position: seatContact, approach: new THREE.Vector3(10, .3, 3.65), radius: 2.05, meshes: [bench],
    sitPosition: seatContact, sitYaw: 0,
  });

  let instrumentAngle = 0;
  return {
    root, colliders, interactions, assetsReady,
    update(time, delta, selectedId) {
      if (disposed) return;
      const dt = Math.min(Math.max(delta, 0), .08);
      if (selectedId !== 'books') bookOpen = false;
      if (pulledBook) {
        const distance = bookOpen ? .10 : selectedId === 'books' ? .035 : 0;
        pulledBook.position.z = THREE.MathUtils.damp(pulledBook.position.z, pulledBookBaseZ + distance, 7, dt);
      }
      instrumentImpulse = Math.max(0, instrumentImpulse - dt);
      instrumentAngle += dt * (.04 + (selectedId === 'projects' ? .12 : 0) + instrumentImpulse * .5);
      middle.rotation.y = Math.PI / 2 + instrumentAngle;
      inner.rotation.z = instrumentAngle * .62;
      outerRing.rotation.y = Math.sin(time * .12) * .035;
      for (const updateLamp of courtyardLights) updateLamp(time, dt);
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
      artwork.dispose();
      if (ownsLibrary) library.dispose();
      geometries.clear(); materials.clear(); geometryCache.clear();
    },
  };
}
