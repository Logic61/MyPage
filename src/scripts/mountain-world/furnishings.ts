import * as THREE from 'three';
import { NORTH_HALL_RISE, NORTH_HALL_SETBACK, SUN_DAIS, TEA_PAVILION } from './hall-terrace';
import { POOL_LAMP } from './water-court';
import { createStoneBeacon } from './court-beacon';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceLibrary, type SurfaceLibrary, type SurfaceKind, type SurfaceOptions } from './materials';
import { createFurnishingInk } from './furnishing-ink';
import { createBenchCushionGeometry, createBentTableLeg, createBrocadeMount, createBrushRestGeometry, createCloudApron, createInkstoneGeometry,
  createPiercedSplat, createScreenArtwork, createScrollCheek } from './furnishing-design';
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
  const rosewood = surface('paleWood', {color:'#b27957', worldScale:.85, normalScale:.22, roughness:.46});
  const walnut = surface('paleWood', {color:'#936246', worldScale:.9, normalScale:.24, roughness:.56});
  const agedGold = material({color:'#cfa35c',metalness:.62,roughness:.42});
  const verdigris = material({color:'#526f63',roughness:.55,metalness:.49});
  const straw = material({map:lettering.reedMat,roughness:.94});
  const deskMat = material({map:lettering.reedMat,color:'#cfb78c',roughness:.92});
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
  function cloudApron(parent: THREE.Group, w: number, h: number, x: number, y: number, z: number, yaw = 0) {
    const panel = new THREE.Group();
    panel.position.set(x,y,z); panel.rotation.y=yaw; parent.add(panel);
    const outline=geometry('carved-cloud-apron:'+w+':'+h,()=>createCloudApron(w,h,.037));
    mesh(panel,outline,walnut);
    mesh(panel,outline,agedGold,0,.001,.022).scale.set(.989,.93,.10);
    mesh(panel,outline,rosewood,0,.002,.026).scale.set(.976,.86,.10);
    return panel;
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
  function boundBook(thickness: number, height: number, depth: number, color: number, title: number,
    binding = bindings[color % bindings.length], spineTag = title % 3 !== 1) {
    const result = new THREE.Group();
    result.name = `thread-bound-book-${lettering.titles[title % lettering.titles.length]}`;
    box(result, paperEdge, thickness - .008, height - .012, depth - .012, 0, 0, -.002);
    for (const side of [-1, 1]) {
      bevel(result, binding, .0035, height, depth, side * (thickness / 2 - .0018), 0, 0, .0006);
      const coverLabel = bookTag(result, title, .045, height * .68, side * (thickness / 2 + .0003), .015, -.018);
      coverLabel.rotation.y = side * Math.PI / 2;
    }
    bevel(result, binding, thickness, height, .012, 0, 0, depth / 2 - .004, .0015);
    // Some volumes have bare cloth spines: the shelf reads as books, not repeated ivory bars.
    if (spineTag) bookTag(result, title, Math.min(thickness * .62, .039), height * .68, 0, .012, depth / 2 + .0025);
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
  const screen = group('circular-landscape-screen', 0, -9.36 - NORTH_HALL_SETBACK);
  screen.position.y = 2.5 + NORTH_HALL_RISE;
  // Moon-shaped landscape set into a square lattice screen with a real lower sill and feet.
  for(const sign of [-1,1]) {
    bevel(screen,walnut,.105,3.37,.105,sign*1.68,0,-.135);
    bevel(screen,rosewood,3.45,.105,.13,0,sign*1.67,-.128);
    bevel(screen,walnut,.135,.53,.15,sign*1.48,-1.91,-.132);
    bevel(screen,rosewood,.28,.095,.30,sign*1.48,-2.15,-.12);
    for(let k=-7;k<=7;k++) {
      const u=k*.20;
      const reach=Math.sqrt(Math.max(0,1.54**2-u**2))-.025;
      const span=1.63-reach;
      bevel(screen,rosewood,.027,span,.037,u,sign*(reach+span/2),-.135,.003);
      bevel(screen,walnut,span,.027,.037,sign*(reach+span/2),u,-.139,.003);
    }
  }
  // The frame is turned as one profile. The recess between its two lips catches
  // a different shadow as the visitor walks past the painting.
  const screenFrame = lathe(screen, woodDark, 'turned-landscape-frame', [
    [1.481,-.069], [1.586,-.069], [1.600,-.054], [1.600,.018],
    [1.595,.044], [1.586,.064], [1.576,.069], [1.565,.064],
    [1.558,.050], [1.552,.031], [1.540,.026], [1.528,.030],
    [1.514,.043], [1.503,.059], [1.492,.063], [1.481,.054], [1.481,-.069],
  ], 0, 0, 0, 128);
  screenFrame.rotation.x = Math.PI / 2;
  cylinder(screen, wood, 1.503, 1.503, .045, 0, 0, -.045, 96).rotation.x = Math.PI / 2;
  const mount = material({ color: '#b4a68a', roughness: .92 });
  const thread = material({ color: '#8d7e61', roughness: .81 });
  mesh(screen, geometry('silk-mount', () => new THREE.RingGeometry(1.386, 1.496, 128)), mount, 0, 0, .048);
  mesh(screen, geometry('woven-mount-diamonds', createBrocadeMount), thread, 0, 0, .049);
  torus(screen, brassDark, 1.394, .004, 0, 0, .054, 128);
  const silk = surface('paper', { color: '#ffffff', roughness: .98, normalScale: .12 });
  silk.name = 'non-emissive-landscape-silk'; silk.map = artwork.texture;
  silk.userData.artworkSource = 'canvas-fallback';
  mesh(screen, geometry('screen-silk-circle', () => new THREE.CircleGeometry(1.389, 128)), silk, 0, 0, .050, false);

  for (const xx of [-.9, .9]) for (const yy of [-.9, .9]) {
    cylinder(screen, woodDark, .045, .045, .45, xx, yy, -.285, 12).rotation.x = Math.PI / 2;
  }
  batchStatic(screen);
  colliders.push({ x: 0, z: screen.position.z - .14, halfX: 1.64, halfZ: .26 });
  const screenReady = artwork.ready.then(texture => {
    if (disposed) return;
    silk.map = texture; silk.needsUpdate = true;
    silk.userData.artworkSource = artwork.loaded ? 'generated-local-artwork' : 'canvas-fallback';
  });

  const brocade = surface('paper', {color:'#d9be94', repeat:[3,8], normalScale:.24, roughness:.84});
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
    const mount=group(name,x,-9.60 - NORTH_HALL_SETBACK); mount.position.y=2.13 + NORTH_HALL_RISE;
    for(const y of [-.84,.84]) bevel(mount,walnut,.94,.075,.162,0,y,-.106);
    bevel(mount,brocade,1.43,2.34,.022,0,0,-.017,.005);
    for (const side of [-1,1]) {
      box(mount,walnut,.006,1.91,.009,side*.605,0,.003);
      box(mount,agedGold,.009,1.94,.010,side*.624,0,.004);
      box(mount,walnut,1.22,.006,.009,0,side*.948,.003);
      box(mount,agedGold,1.26,.009,.010,0,side*.966,.004);
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
    position:hostMount.localToWorld(new THREE.Vector3(0,.09,.02)), approach:new THREE.Vector3(3.68,.3 + NORTH_HALL_RISE,hostMount.position.z+2.14), radius:2.75, meshes:[hostMount] });
  const woodTextures: THREE.Texture[]=[];
  const timberReady=Promise.all((['map','normalMap'] as const).map(async channel=>{
    const file=channel==='map'?'lacquer-grain.webp':'timber-normal.webp';
    try {
      const map=await new THREE.TextureLoader().loadAsync((import.meta.env?.BASE_URL??'/MyPage/').replace(/\/$/,'')+'/world/'+file);
      if(disposed) {map.dispose();return;}
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
      map.colorSpace=channel==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      woodTextures.push(map);
      for(const mat of [walnut,rosewood]) {mat[channel]=map;mat.needsUpdate=true;}
    } catch { /* The shared procedural timber is ready synchronously. */ }
  }));
  const assetsReady=Promise.all([screenReady,lettering.portraitReady,timberReady]).then(()=>{});

  const wallPaper = surface('paper', { roughness: 1, normalScale: .25 });
  wallPaper.emissive.set('#ffcea0'); wallPaper.emissiveIntensity = .42;
  for (const x of [-2.29, 2.29]) {
    const wallLamp = group('north-wall-paper-sconce', x, -9.82 - NORTH_HALL_SETBACK);
    wallLamp.position.y = 2.46 + NORTH_HALL_RISE;
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
  // The cabinet sits entirely inside the timber-floored bay. Model, collision and reading point move together.
  const shelf = group('library-carved-wood-shelf', -5.53, -1.82);
  shelf.rotation.y = Math.PI / 2;
  const elm = surface('paleWood', { color: '#c4835b', worldScale: .85, roughness: .66, normalScale: .33 });
  const polishedEdge = surface('paleWood', { color: '#d69a69', worldScale: .86, roughness: .59, normalScale: .22 });
  const blueCloth = surface('cloth', { color: '#a1b5ed', roughness: .93, normalScale: .4 });
  const russetCloth = surface('cloth', { color: '#f99c70', roughness: .92, normalScale: .4 });
  blueCloth.color.setRGB(.98,1.09,1.82); russetCloth.color.setRGB(2.48,.65,.39);
  const drawerPanel = surface('paleWood', { color:'#c58b65',repeat:[1.2,2.2],roughness:.68,normalScale:.22 });
  const vaseGlaze = material({ color: '#94b6a5', roughness: .25, metalness: .02 });
  // A shallow ogee under the three drawers is cut in silhouette, visible against the floor.
  const apron = geometry('elm-archive-cloud-apron', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.31,.337); shape.lineTo(1.31,.337); shape.lineTo(1.31,.073);
    shape.bezierCurveTo(1.22,.074,1.30,.207,1.17,.210);
    shape.bezierCurveTo(1.04,.211,1.02,.260,.91,.253);
    shape.lineTo(.29,.253); shape.bezierCurveTo(.17,.254,.14,.198,0,.193);
    shape.bezierCurveTo(-.14,.198,-.17,.254,-.29,.253); shape.lineTo(-.91,.253);
    shape.bezierCurveTo(-1.02,.260,-1.04,.211,-1.17,.210);
    shape.bezierCurveTo(-1.30,.207,-1.22,.074,-1.31,.073); shape.closePath();
    return new THREE.ExtrudeGeometry(shape,{depth:.032,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:1,curveSegments:8});
  });
  mesh(shelf,apron,elm,0,0,.210);
  for (const x of [-1.30,1.30]) {
    for (const z of [-.194,.220]) bevel(shelf, elm, .094, .34, .09, x, .17, z, .006);
    bevel(shelf, elm, .068, 1.88, .46, x, 1.265, -.004, .005);
    bevel(shelf, polishedEdge, .029, 1.84, .014, x, 1.27, .231, .0025);
  }
  for (let i=0;i<9;i++) {
    const pitch = 2.55/9;
    bevel(shelf, walnut, pitch-.004, 1.77, .026, -1.275+(i+.5)*pitch, 1.30, -.218, .002);
  }
  function shelfBoard(left: number, right: number, top: number, depth = .468) {
    bevel(shelf, elm, right-left,.042,depth,(left+right)/2,top-.021,0,.004);
    bevel(shelf, polishedEdge, right-left,.011,.012,(left+right)/2,top-.031,depth/2+.001,.002);
  }
  function partition(x: number, low: number, high: number) {
    bevel(shelf, elm,.04,high-low,.444,x,(low+high)/2,.002,.004);
  }
  shelfBoard(-1.37,1.37,.355,.525);
  shelfBoard(-1.33,1.33,.650,.50);
  partition(-.754,.650,1.536); partition(-.004,.952,1.536);
  partition(-.284,1.536,2.164); partition(.647,.650,2.164);
  shelfBoard(-1.27,-.754,.979); shelfBoard(-.754,-.004,1.232);
  shelfBoard(-.004,.647,.952); shelfBoard(-1.27,.647,1.536);
  shelfBoard(.647,1.27,.965); shelfBoard(.647,1.27,1.373);
  // The crown projects in a series of thin mouldings rather than one heavy cap.
  for (const [width,depth,y,height,mat] of [
    [2.72,.50,2.148,.046,walnut],[2.77,.535,2.183,.032,elm],
    [2.82,.559,2.207,.020,polishedEdge],[2.86,.580,2.237,.042,elm],
  ] as const) bevel(shelf,mat,width,height,depth,0,y,0,.004);
  function archiveDrawer(x: number, y: number, w: number, h: number) {
    bevel(shelf,walnut,w,h,.047,x,y,.199,.005);
    const panel=bevel(shelf,drawerPanel,h-.055,w-.055,.017,x,y,.228,.005);
    panel.rotation.z=Math.PI/2;
    for (const sign of [-1,1]) {
      bevel(shelf,elm,w-.020,.018,.022,x,y+sign*(h-.035)/2,.232,.003);
      bevel(shelf,elm,.018,h-.056,.022,x+sign*(w-.035)/2,y,.232,.003);
    }
    // Peened escutcheon and hanging ring stand clear of the drawer face.
    cylinder(shelf,brassDark,.034,.034,.010,x,y+.024,.248,20).rotation.x=Math.PI/2;
    cylinder(shelf,brass,.013,.017,.023,x,y+.023,.260,14).rotation.x=Math.PI/2;
    torus(shelf,brass,.044,.006,x,y-.014,.273,28).scale.y=1.06;
  }
  for (const x of [-.86,0,.86]) archiveDrawer(x,.496,.844,.252);
  archiveDrawer(.965,.808,.576,.268);
  let pulledBook: THREE.Group | null = null;
  let pulledBookBaseZ = 0;
  function stitchedSet(x: number, bottom: number, count: number, height: number, thickness: number,
    firstTitle: number, fabric: THREE.MeshStandardMaterial, moving = -1) {
    for (let i=0;i<count;i++) {
      const h=height + Math.sin((i+1)*1.9)*.005;
      const book=boundBook(thickness,h,.236,0,firstTitle+i,fabric,false);
      // Foil rules bind a whole set visually. One narrow title slip identifies the set, the other spines stay quiet.
      for (const side of [-1,1]) {
        box(book,cord,thickness*.88,.0045,.002,0,side*(h/2-.044),.1225);
        box(book,cord,thickness*.86,.002,.002,0,side*(h/2-.052),.1225);
      }
      if (i===0) bookTag(book,firstTitle,Math.min(.025,thickness*.27),h*.40,-thickness*.19,.015,.124);
      book.position.set(x+(i+.5)*(thickness+.005),bottom+h/2,.067+.005*Math.sin(i*1.7));
      if (i===moving) { pulledBook=book; book.name='book-that-slides-out'; pulledBookBaseZ=book.position.z; }
      shelf.add(book);
    }
  }
  stitchedSet(-1.20,1.536,4,.486,.087,0,blueCloth);
  stitchedSet(-.819,1.536,4,.380,.089,4,blueCloth);
  stitchedSet(-.078,1.536,6,.446,.104,5,russetCloth);
  stitchedSet(-.691,.650,5,.472,.107,8,blueCloth,2);
  stitchedSet(.124,.952,4,.398,.106,11,blueCloth);
  function folios(x: number, y: number, quantity: number, title: number) {
    for(let i=0;i<quantity;i++) {
      const volume=boundBook(.038,.405-i*.008,.245,0,title+i,i%3===2?russetCloth:blueCloth,false);
      volume.rotation.set(0,Math.PI+(i%3-1)*.026,-Math.PI/2);
      volume.position.set(x,y+.019,.055); shelf.add(volume); y+=.04;
    }
  }
  folios(-1.01,.979,3,2); folios(-.379,1.232,4,5);
  folios(.267,.650,4,7); folios(.956,.965,3,1);
  // Six rolled leaves sit end-on; a bound rim, paper core and silk tie remain distinct at eye level.
  for (let row=0;row<3;row++) for (let i=0;i<3-row;i++) {
    const x=-1.17+i*.112+row*.056,y=.702+row*.087;
    const roll=cylinder(shelf,paper,.052,.051,.265,x,y,.044,20); roll.rotation.x=Math.PI/2;
    cylinder(shelf,walnut,.016,.016,.008,x,y,.181,12).rotation.x=Math.PI/2;
    torus(shelf,cord,.035,.0022,x,y,.178,20);
    cylinder(shelf,cord,.053,.053,.015,x,y,.092,20).rotation.x=Math.PI/2;
  }
  lathe(shelf,vaseGlaze,'archive-crackle-glazed-pear-vase',[[.046,0],[.064,.008],[.059,.022],[.079,.034],[.108,.078],
    [.132,.158],[.135,.209],[.121,.259],[.084,.314],[.049,.363],[.034,.417],[.033,.478],[.039,.498],[.043,.507],
    [.042,.515],[.032,.515],[.028,.501],[.024,.476],[.026,.409],[.038,.360],[.073,.308],[.112,.25],[.119,.20],
    [.114,.153],[.094,.090],[.065,.046],[.045,.032],[0,.032]],.962,1.373,.027,40);
  batchStatic(shelf,pulledBook ? [pulledBook] : []);
  if (pulledBook) batchStatic(pulledBook);
  colliders.push({ x:shelf.position.x, z:shelf.position.z, halfX:.30, halfZ:1.43 });
  let bookOpen = false;
  interactions.push({ id:'books', kind:'books', label:'取一卷书', labelEn:'Browse the library',
    position:shelf.localToWorld(new THREE.Vector3(-.42,.99,.194)), approach:new THREE.Vector3(shelf.position.x+1.85,.3,shelf.position.z+.18),
    radius:2.15, meshes:[shelf], activate:()=>{bookOpen=true;} });

  function paintingTable(parent: THREE.Group) {
    const w=2.95, d=1.25;
    bevel(parent,walnut,w,.074,d,0,.741,0,.011);
    bevel(parent,rosewood,w-.035,.03,d-.032,0,.765,0,.008);
    for(const side of [-1,1]) {
      const cheek=mesh(parent,geometry('upturned-painting-table-end',()=>createScrollCheek(d-.014)),rosewood,side*(w/2-.11),.774,0);
      cheek.scale.x=side;
      for(const z of [-d/2+.012,d/2-.012]) {
        tube(parent,agedGold,'scroll-edge:'+side+':'+z,
          [new THREE.Vector3(side*(w/2-.135),.808,z),new THREE.Vector3(side*(w/2-.058),.878,z),
            new THREE.Vector3(side*(w/2+.004),.960,z),new THREE.Vector3(side*(w/2+.048),.954,z),
            new THREE.Vector3(side*(w/2+.056),.930,z)],.006,16);
      }
      for(const z of [-.458,.458]) {
        const x=side*1.27;
        const leg=mesh(parent,geometry('bent-redwood-leg',()=>createBentTableLeg(.704)),rosewood,x,0,z);
        leg.scale.x=side;
        bevel(parent,agedGold,.153,.035,.149,x,.021,z,.006);
        bevel(parent,walnut,.145,.025,.142,x,.052,z,.005);
      }
      cloudApron(parent,2.48,.18,0,.704,side*.47,side>0?0:Math.PI);
      cloudApron(parent,.86,.14,side*1.27,.705,0,side*Math.PI/2);
    }
  }

  function drawer(parent: THREE.Group, x: number, y: number, z: number, w: number) {
    bevel(parent,walnut,w,.131,.038,x,y,z,.003);
    bevel(parent,rosewood,w-.023,.11,.014,x,y,z+.025,.003);
    const rose=cylinder(parent,agedGold,.019,.019,.008,x,y+.004,z+.038,16);
    rose.rotation.x=Math.PI/2;
    const pull=torus(parent,agedGold,.029,.004,x,y-.020,z+.045,24);
    pull.scale.y=.87;
  }
  function instrumentTable(parent: THREE.Group) {
    bevel(parent,walnut,2.34,.066,1.1,0,.747,0,.009);
    bevel(parent,rosewood,2.30,.019,1.066,0,.772,0,.004);
    for(const x of [-1.065,-.63,.63,1.065]) for(const z of [-.45,.45]){
      bevel(parent,rosewood,.065,.713,.072,x,.356,z,.005);
      bevel(parent,agedGold,.077,.075,.080,x,.038,z,.004);
    }
    for(const x of [-.85,.85]) {
      bevel(parent,walnut,.474,.34,.87,x,.538,0);
      for(const yy of [.457,.613]) for(const col of [-.113,.113]) drawer(parent,x+col,yy,.438,.210);
      bevel(parent,rosewood,.48,.041,.914,x,.359,0);
    }
    const archShape=new THREE.Shape();
    archShape.moveTo(-.63,.713);archShape.lineTo(.63,.713);archShape.lineTo(.63,.222);
    archShape.bezierCurveTo(.52,.39,.22,.573,0,.573);archShape.bezierCurveTo(-.22,.573,-.52,.39,-.63,.222);archShape.closePath();
    const arch=geometry('joinery-arch-workbench',()=>new THREE.ExtrudeGeometry(archShape,{depth:.037,bevelEnabled:true,
      bevelSize:.004,bevelThickness:.004,bevelSegments:1,curveSegments:16}));
    mesh(parent,arch,rosewood,0,0,.425);
    tube(parent,agedGold,'workbench-arch-banded-edge',[
      new THREE.Vector3(-.625,.257,.468),new THREE.Vector3(-.41,.475,.468),new THREE.Vector3(0,.598,.468),
      new THREE.Vector3(.41,.475,.468),new THREE.Vector3(.625,.257,.468)],.0055,30);
    bevel(parent,walnut,2.31,.071,.51,0,1.095,-.251);
    bevel(parent,rosewood,2.25,.021,.485,0,1.139,-.251,.005);
    for(const x of [-1.075,-.12,1.075]) {
      bevel(parent,rosewood,.059,.277,.446,x,.922,-.254);
      bevel(parent,agedGold,.068,.030,.45,x,1.038,-.254,.002);
    }
  }

  // ---------------------- Writing desk and open book ----------------------
  const desk = group('writing-desk', 0, -7.70 - NORTH_HALL_SETBACK);
  desk.position.y += NORTH_HALL_RISE;
  paintingTable(desk);
  bevel(desk,walnut,2.56,.003,1.00,0,.7815,0,.001);
  bevel(desk,deskMat,2.51,.003,.97,0,.784,0,.001);
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

  const tableY = .786;
  const chair = new THREE.Group();
  chair.name='Redwood horseshoe chair'; chair.position.set(0,0,-1.01); desk.add(chair);
  bevel(chair,walnut,.56,.045,.49,0,.455,0);
  bevel(chair,straw,.493,.023,.419,0,.489,0,.006);
  for(const x of [-.224,.224]) {
    for(const z of [-.193,.193]) bevel(chair,rosewood,.043,.452,.045,x,.225,z,.004);
    tube(chair,rosewood,'chair-rounded-arm:'+x,
      [new THREE.Vector3(x,.74,.18),new THREE.Vector3(x,.745,-.06),new THREE.Vector3(x,.98,-.21)],.019,14);
    bevel(chair,rosewood,.034,.236,.034,x,.606,.157);
  }
  tube(chair,rosewood,'chair-crest',[new THREE.Vector3(-.224,.98,-.21),new THREE.Vector3(0,1.045,-.24),new THREE.Vector3(.224,.98,-.21)],.025,18);
  mesh(chair,geometry('chair-pierced-splat',()=>createPiercedSplat(.145,.50,.030)),rosewood,0,.515,-.221);
  for (let i=0,h=tableY;i<3;i++) h+=lyingBook(desk,.974,h,.058,7+i,(i-1)*.055)+.002;
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
  colliders.push({ x: 0, z: desk.position.z, halfX: 1.54, halfZ: .64 });
  colliders.push({ x: 0, z: desk.position.z-1.01, halfX: .28, halfZ: .26 });

  // ----------------------- The instrument workbench -----------------------
  const workbench = group('project-workbench', 4.09, -1.65); workbench.rotation.y = -Math.PI / 2;
  instrumentTable(workbench);
  const instrumentBase = new THREE.Group(); instrumentBase.name = 'armillary-pedestal';
  instrumentBase.position.set(-.43,.37,-.245); workbench.add(instrumentBase);
  lathe(instrumentBase,walnut,'octagonal-instrument-plinth',[[.31,0],[.32,.021],[.278,.035],[.272,.081],[.29,.096],[.28,.107]],0,.786,0,8);
  for (const y of [.814,.871]) cylinder(instrumentBase,agedGold,.286,.286,.007,0,y,0,8);
  lathe(instrumentBase,verdigris,'armillary-turned-pedestal',[[.18,0],[.19,.023],[.14,.045],[.089,.053],[.066,.11],[.054,.146],[.076,.169],[.07,.188]],0,.885,0,32);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    cylinder(instrumentBase, brass, .012, .012, .004, Math.sin(a) * .145, .856, Math.cos(a) * .145, 16);
  }
  const armillary = new THREE.Group(); armillary.name = 'moving-armillary-sphere';
  armillary.position.set(-.43,1.755,-.245); armillary.rotation.set(-.72,0,.48,'ZXY');
  armillary.scale.setScalar(1.19); workbench.add(armillary);
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
  const outerRing = new THREE.Group(); armillary.add(outerRing); band(outerRing,.345,.040,.024,agedGold);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, long = i % 6 === 0;
    const tick = box(outerRing, verdigris, long ? .0026 : .0016, long ? .022 : .012, .0018,
      Math.sin(a) * .326, Math.cos(a) * .326, .0145); tick.rotation.z = -a;
  }
  const middle = new THREE.Group(); armillary.add(middle); middle.rotation.y = Math.PI / 2; band(middle, .297, .018, .005, brass);
  const inner = new THREE.Group(); armillary.add(inner); inner.rotation.x = Math.PI / 2; band(inner, .253, .018, .005, brassDark);
  const ecliptic = band(armillary, .275, .014, .005, brass); ecliptic.rotation.x = .6;
  const globe = mesh(armillary, geometry('armillary-globe', () => new THREE.SphereGeometry(.078, 24, 18)), agedGold);
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
  const horizon = band(instrumentBase,.407,.023,.012,verdigris); horizon.rotation.x=Math.PI/2-.24; horizon.position.y=1.385;
  for (const side of [-1, 1]) {
    const cheek=mesh(instrumentBase,geometry('armillary-foliated-standard',()=>createPiercedSplat(.18,.365,.041)),verdigris,side*.22,.971,0);
    cheek.rotation.z=-side*.34;
    tube(instrumentBase,verdigris,`instrument-fork:${side}`,[new THREE.Vector3(side*.13,.97,0),
      new THREE.Vector3(side*.17,1.07,0),new THREE.Vector3(side*.34,1.22,0),new THREE.Vector3(side*.397,1.372,0)],.014,18);
    torus(instrumentBase,agedGold,.026,.006,side*.371,1.334,.015,28);
  }
  const projectCard = new THREE.Group(); projectCard.name='Framed star chart on a sloping easel';
  projectCard.position.set(.635,1.15,-.118); projectCard.rotation.x=-.35; workbench.add(projectCard);
  bevel(projectCard,walnut,.843,.620,.052,0,.309,0,.009);
  bevel(projectCard,agedGold,.806,.584,.008,0,.309,.031,.002);
  label(projectCard,written('schematic','projects'),.775,.555,0,.309,.038);
  for (const x of [-.392,.392]) for(const y of [.039,.58]) {
    const rivet=cylinder(projectCard,agedGold,.011,.011,.008,x,y,.041,10);rivet.rotation.x=Math.PI/2;
  }
  const port = new THREE.Group();port.name='Measuring dividers';port.position.set(-.18,.789,.26);port.rotation.y=.20;workbench.add(port);
  for(const side of [-1,1]) {
    rod(port,agedGold,new THREE.Vector3(0,.018,-.12),new THREE.Vector3(side*.109,.011,.135),.007,10);
    rod(port,verdigris,new THREE.Vector3(side*.109,.011,.135),new THREE.Vector3(side*.123,.008,.174),.004,8);
  }
  cylinder(port,agedGold,.016,.016,.015,0,.018,-.12,16);
  bevel(workbench,rosewood,.44,.019,.049,.54,.793,.20,.003);
  for(let i=0;i<17;i++) box(workbench,agedGold,.002,.001,i%4? .013:.027,.352+i*.0235,.803,.206);
  const drafts=label(workbench,written('schematic'),.347,.253,-.70,.783,.255);drafts.rotation.x=-Math.PI/2;
  // Shallow pigeonholes sit behind the raised instrument shelf and stay within the wing's wall line.
  for(let i=0;i<7;i++) bevel(workbench,walnut,.315,.008+1.88,.032,(i-3)*.319,1.39,-.880,.003);
  for(const x of [-1.115,-.29,.45,1.115]) bevel(workbench,walnut,.044,2.10,.215,x,1.32,-.78);
  for(const yy of [.49,1.20,1.77,2.36]) bevel(workbench,rosewood,2.29,.044,.229,0,yy,-.78);
  for(const x of [-.72,.82]) {
    for(let j=0;j<5;j++){
      const thickness=.044+(j%2)*.023,h=.267+.07*Math.cos(j*2.2);
      bevel(workbench,j%3===2?paperEdge:bindings[j%bindings.length],thickness,h,.128,x+j*.075-.17,1.80+h/2,-.745,.002);
      box(workbench,cord,thickness*.66,.046,.002,x+j*.075-.17,1.80+h*.70,-.679);
    }
  }
  for(let i=0;i<5;i++){
    const px=-.11+(i%3)*.089,py=1.832+Math.floor(i/3)*.071;
    const roll=cylinder(workbench,paperEdge,.040,.040,.184,px,py,-.755,14);roll.rotation.x=Math.PI/2;
    torus(workbench,walnut,.022,.002,px,py,-.661,18);
  }
  lathe(workbench,verdigris,'workshop-brush-jar',[[.05,0],[.07,.012],[.096,.096],[.072,.17],[.078,.18],[.071,.183],[.058,.169],[.055,.04]],.89,.781,.345,32);
  for(let i=0;i<3;i++) {
    const b = new THREE.Group(); b.position.set(.88+(i-1)*.015,.855,.343);b.rotation.z=(i-1)*.15;b.scale.setScalar(.72);workbench.add(b);writingBrush(b);
  }
  batchStatic(workbench,[armillary,instrumentBase,projectCard]); batchStatic(instrumentBase); batchStatic(projectCard);
  batchStatic(armillary,[outerRing,middle,inner]); batchStatic(outerRing); batchStatic(middle); batchStatic(inner);
  colliders.push({ x: workbench.position.x+.17, z: workbench.position.z, halfX: .72, halfZ: 1.17 });
  let instrumentImpulse = 0;
  interactions.push({ id:'projects',kind:'projects',label:'翻阅项目',labelEn:'Explore projects',
    position:workbench.localToWorld(armillary.position.clone()),approach:new THREE.Vector3(workbench.position.x-1.85,.3,workbench.position.z),radius:2.45,
    meshes:[armillary,instrumentBase,projectCard],activate:()=>{instrumentImpulse=2.7;} });

  // Two nearer corner lamps can be switched from the side walks. The far pair reflects in the pool.
  const castBeacon = createStoneBeacon(geometry => { geometries.add(geometry); return geometry; });
  const lampStone = surface('limestone',{color:'#d4c7b3',worldScale:.75,roughness:.86});
  const lampRebate = surface('limestone',{color:'#aaa399',worldScale:.75,roughness:.88});
  const patina = surface('limestone',{color:'#789687',worldScale:3.7,normalScale:.18,roughness:.57,metalness:.40});
  function courtLamp(side: number, z: number, id?: string) {
    const lamp = group('Courtyard stone lantern',side*POOL_LAMP.postX,z);
    lamp.scale.setScalar(.78);
    const silk = material({color:'#edca7d',emissive:'#ffc577',emissiveIntensity:.76,roughness:.91});
    const lantern = castBeacon(lamp,{stone:lampStone,shadeStone:lampRebate,bronze:patina,gilt:agedGold,silk});
    colliders.push({x:lamp.position.x,z,halfX:.248,halfZ:.248});
    batchStatic(lamp,[lantern]); batchStatic(lantern);
    if (!id) return;
    const glow = new THREE.PointLight('#ffd294',2.1,3.5,2);
    glow.position.set(0,.923,0); lantern.add(glow);
    let lit=true, amount=1;
    interactions.push({id,kind:'lantern',label:'拨一盏灯',labelEn:'Switch the lantern',
      position:new THREE.Vector3(lamp.position.x,.3+.78*.923,z),
      approach:new THREE.Vector3(side*POOL_LAMP.approachX,.3,POOL_LAMP.approachZ),radius:2.05,
      meshes:[lantern],activate:()=>{lit=!lit;}});
    return (time:number,dt:number)=>{
      amount=THREE.MathUtils.damp(amount,lit?1:0,9,dt);
      const flame = 1+.014*Math.sin(time*4.2+side)+.008*Math.sin(time*9.1);
      silk.emissiveIntensity=.025+.76*amount*flame;
      glow.intensity=2.1*amount*flame;
    };
  }
  const courtyardLights = [courtLamp(-1,POOL_LAMP.z,'lantern')!,courtLamp(1,POOL_LAMP.z,'east-lantern')!];
  for(const side of [-1,1]) courtLamp(side,POOL_LAMP.northZ);

  // --------------------------- Overlook bench ---------------------------
  const outlook=TEA_PAVILION;
  const bench = group('overlook-carved-bench',outlook.benchX,outlook.benchZ);
  bench.rotation.y=outlook.benchYaw;
  for(const x of [-1.075,1.075]) {
    for(const z of [-.238,.238]){
      bevel(bench,rosewood,.084,.45,.082,x,.226,z);
      bevel(bench,walnut,.102,.047,.11,x,.026,z);
    }
    bevel(bench,walnut,.043,.047,.48,x,.153,0);
    bevel(bench,rosewood,.061,.43,.062,x,.701,-.238);
    bevel(bench,rosewood,.065,.56,.072,x,.749,.242);
    tube(bench,rosewood,'horseshoe-arm:'+x,[new THREE.Vector3(x,.90,-.247),
      new THREE.Vector3(x,.941,-.178),new THREE.Vector3(x*1.025,.916,-.018),new THREE.Vector3(x,.946,.204),new THREE.Vector3(x,.988,.265)],.031,22);
  }
  bevel(bench,walnut,2.41,.077,.594,0,.441,0);
  bevel(bench,agedGold,2.374,.009,.570,0,.476,0,.002);
  bevel(bench,rosewood,2.175,.089,.078,0,.507,.257);
  for (const sign of [-1,1]) {
    cloudApron(bench,2.095,.126,0,.410,sign*.244,sign>0?0:Math.PI);
    bevel(bench,rosewood,2.135,.039,.038,0,.148,sign*.231);
  }
  tube(bench,rosewood,'continuous-bowed-back',[new THREE.Vector3(-1.083,.989,.264),new THREE.Vector3(-.72,.999,.274),
    new THREE.Vector3(-.42,1.026,.296),new THREE.Vector3(-.20,1.105,.314),new THREE.Vector3(0,1.135,.324),
    new THREE.Vector3(.20,1.105,.314),new THREE.Vector3(.42,1.026,.296),new THREE.Vector3(.72,.999,.274),new THREE.Vector3(1.083,.989,.264)],.034,36);
  const welt=material({color:'#897b4d',roughness:.91});
  const cushion=geometry('individual-woven-seat',()=>createBenchCushionGeometry(.701,.448,.039));
  for(let i=-1;i<=1;i++) {
    const x=i*.712, height=i===0?.589:.461;
    const splat=mesh(bench,geometry('ruyi-seat-back:'+height,()=>createPiercedSplat(i===0?.259:.210,height,.04)),
      rosewood,x,.521,i===0?.284:.253);
    splat.rotation.x=.052;
    const inset=mesh(bench,splat.geometry,agedGold,x,.527,i===0?.259:.228);
    inset.rotation.x=.052; inset.scale.set(.85,.965,.10);
    const face=mesh(bench,splat.geometry,rosewood,x,.532,i===0?.254:.223);
    face.rotation.x=.052;face.scale.set(.77,.942,.10);
    mesh(bench,cushion,straw,x,.500,-.012);
    for(const z of [-.231,.207]) rod(bench,welt,new THREE.Vector3(x-.34,.497,z),new THREE.Vector3(x+.34,.497,z),.002,5);
  }
  batchStatic(bench);
  // Divide the slightly angled settle into three sections so its open front corners remain accessible.
  const benchCos=Math.abs(Math.cos(outlook.benchYaw)),benchSin=Math.abs(Math.sin(outlook.benchYaw));
  for(const offset of [-.80,0,.80]) {
    const centre=bench.localToWorld(new THREE.Vector3(offset,0,.014));
    colliders.push({x:centre.x,z:centre.z,halfX:.406*benchCos+.346*benchSin,halfZ:.406*benchSin+.346*benchCos});
  }

  const teaPlace=bench.localToWorld(new THREE.Vector3(1.23,0,-.53));
  const teaStand=group('Side table with covered cup and Yixing pot',teaPlace.x,teaPlace.z);
  bevel(teaStand,rosewood,.47,.044,.445,0,.514,0,.007);
  for(const x of [-.19,.19])for(const z of [-.173,.173]) bevel(teaStand,walnut,.039,.49,.041,x,.245,z,.003);
  cloudApron(teaStand,.363,.059,0,.487,-.174,Math.PI);
  bevel(teaStand,walnut,.401,.023,.306,0,.549,0,.006);
  for(const z of [-.141,.141]) bevel(teaStand,rosewood,.401,.026,.016,0,.573,z,.003);
  const celadon=material({color:'#9ebba6',metalness:.025,roughness:.22});
  lathe(teaStand,celadon,'covered-tea-bowl',[[.034,0],[.034,.006],[.054,.021],[.063,.046],[.064,.052],[.060,.054]],-.094,.559,-.024,32);
  lathe(teaStand,celadon,'tea-bowl-cover',[[.058,0],[.054,.006],[.027,.019],[.011,.021],[.013,.030],[0,.034]],-.094,.611,-.024,32);
  const clay=material({color:'#79482f',roughness:.61});
  lathe(teaStand,clay,'unglazed-clay-pot',[[.033,0],[.041,.005],[.069,.028],[.071,.053],[.058,.077],[.045,.082],[.040,.079]],
    .079,.559,.013,36);
  lathe(teaStand,clay,'clay-pot-cover',[[.047,0],[.046,.006],[.029,.015],[.007,.018],[.013,.024],[.011,.032],[0,.036]],
    .079,.64,.013,32);
  tube(teaStand,clay,'arched-teapot-handle',[new THREE.Vector3(.122,.627,.013),new THREE.Vector3(.159,.640,.013),
    new THREE.Vector3(.170,.608,.013),new THREE.Vector3(.143,.588,.013)],.007,14);
  const spout=lathe(teaStand,clay,'teapot-bent-spout',[[.014,0],[.017,.009],[.013,.03],[.010,.048],[.011,.06],[.008,.061],[.006,.044]],.028,.600,.013,18);
  spout.rotation.z=.84;
  batchStatic(teaStand);colliders.push({x:teaStand.position.x,z:teaStand.position.z,halfX:.235,halfZ:.223});
  // The guide faces the broad cushion. Its surface is also the seated camera's height reference.
  const seatContact = bench.localToWorld(new THREE.Vector3(0,.524,-.12));
  interactions.push({
    id: 'bench', kind: 'bench', label: '坐看山色', labelEn: 'Pause by the mountains',
    position: seatContact, approach: bench.localToWorld(new THREE.Vector3(-.30,0,-1.40)), radius: 2.05, meshes: [bench],
    sitPosition: seatContact, sitYaw: Math.atan2(seatContact.x-SUN_DAIS.x,seatContact.z-SUN_DAIS.z),
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
      for (const tex of woodTextures) tex.dispose();
      lettering.dispose();
      artwork.dispose();
      if (ownsLibrary) library.dispose();
      geometries.clear(); materials.clear(); geometryCache.clear();
    },
  };
}
