import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Collider, Furnishings, Interaction } from './types';

/** The things a visitor can actually walk up to, touch, and read. */
export function createFurnishings(scene: THREE.Scene, isEn: boolean): Furnishings {
  const root = new THREE.Group();
  root.name = 'mountain-furnishings';
  scene.add(root);
  const colliders: Collider[] = [];
  const interactions: Interaction[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geometryCache = new Map<string, THREE.BufferGeometry>();

  function geometry(key: string, create: () => THREE.BufferGeometry) {
    let result = geometryCache.get(key);
    if (!result) {
      result = create();
      geometries.add(result);
      geometryCache.set(key, result);
    }
    return result;
  }

  function material(parameters: THREE.MeshStandardMaterialParameters) {
    const result = new THREE.MeshStandardMaterial(parameters);
    materials.add(result);
    return result;
  }

  // Small, deterministic textures give the wood a grain without downloading assets.
  function grainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#a18a68';
    context.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 83; i++) {
      const x = (i * 47.39) % 128;
      context.strokeStyle = i % 4 === 0 ? 'rgba(54,31,15,.24)' : 'rgba(239,213,163,.12)';
      context.lineWidth = i % 7 === 0 ? 1.4 : 0.5;
      context.beginPath();
      for (let y = 0; y <= 512; y += 8) {
        const xx = x + Math.sin(y * 0.025 + i * 2.13) * 1.6 + Math.sin(y * 0.008 + i) * 2;
        if (y === 0) context.moveTo(xx, y);
        else context.lineTo(xx, y);
      }
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    textures.add(texture);
    return texture;
  }

  function inkTexture(title: string, lines = false, vertical = false) {
    const canvas = document.createElement('canvas');
    canvas.width = vertical ? 128 : 512;
    canvas.height = vertical ? 512 : 320;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e6d5ac';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 620; i++) {
      context.fillStyle = i % 2 ? 'rgba(90,64,32,.045)' : 'rgba(255,245,218,.14)';
      context.fillRect((i * 97.13) % canvas.width, (i * 51.47) % canvas.height, 1, 2);
    }
    context.fillStyle = '#3f372b';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `500 ${vertical ? 56 : 40}px "Noto Serif SC", "Songti SC", serif`;
    if (vertical) {
      [...title].forEach((letter, index) => context.fillText(letter, 64, 75 + index * 74));
    } else {
      context.fillText(title, 256, lines ? 62 : 160, 430);
    }
    if (lines) {
      context.lineWidth = 2;
      context.strokeStyle = 'rgba(72,58,38,.42)';
      for (let row = 0; row < 8; row++) {
        const end = row % 3 === 0 ? 358 : row % 3 === 1 ? 424 : 388;
        for (let x = 65; x < end; x += 17) {
          const y = 114 + row * 21;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + 8, y + Math.sin(x + row) * 2);
          context.stroke();
        }
      }
      context.fillStyle = '#9e4d3a';
      context.fillRect(407, 248, 34, 35);
      context.strokeStyle = '#ecdab3';
      context.lineWidth = 2;
      context.strokeRect(413, 254, 22, 23);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.add(texture);
    return texture;
  }

  const grain = grainTexture();
  const wood = material({ color: '#74513a', map: grain, roughness: 0.79 });
  const woodDark = material({ color: '#42352b', map: grain, roughness: 0.82 });
  const woodEdge = material({ color: '#a17a4e', map: grain, roughness: 0.72 });
  const paper = material({ color: '#d9c7a2', roughness: 0.96 });
  const paperEdge = material({ color: '#bbaa87', roughness: 1 });
  const brass = material({ color: '#b8995d', metalness: 0.55, roughness: 0.39 });
  const brassDark = material({ color: '#776747', metalness: 0.45, roughness: 0.52 });
  const ink = material({ color: '#212c2a', roughness: 0.74 });
  const cord = material({ color: '#bdb18e', roughness: 0.96 });
  const red = material({ color: '#994d3c', roughness: 0.75 });
  const cloth = material({ color: '#697d78', roughness: 1, side: THREE.DoubleSide });
  const bookColors = ['#3f625e', '#85523e', '#476079', '#77735b', '#394b47', '#9b7551'];
  const bindings = bookColors.map(color => material({ color, map: grain, roughness: 0.9 }));
  const focusMaterials: { id: string; material: THREE.MeshStandardMaterial }[] = [];

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
    top: number, bottom: number, height: number, x = 0, y = 0, z = 0, segments = 12) {
    return mesh(parent, geometry(`cylinder:${top}:${bottom}:${height}:${segments}`,
      () => new THREE.CylinderGeometry(top, bottom, height, segments)), mat, x, y, z);
  }

  function torus(parent: THREE.Object3D, mat: THREE.Material,
    radius: number, tube: number, x = 0, y = 0, z = 0) {
    return mesh(parent, geometry(`torus:${radius}:${tube}`,
      () => new THREE.TorusGeometry(radius, tube, 6, 40)), mat, x, y, z);
  }

  function bevel(parent: THREE.Object3D, mat: THREE.Material,
    width: number, height: number, depth: number, x = 0, y = 0, z = 0, radius = 0.025) {
    const r = Math.min(radius, width * 0.18, height * 0.18, depth * 0.18);
    const key = `bevel:${width}:${height}:${depth}:${r}`;
    const geo = geometry(key, () => {
      const shape = new THREE.Shape();
      const w = width / 2 - r;
      const h = height / 2 - r;
      shape.moveTo(-w, -h);
      shape.lineTo(w, -h);
      shape.lineTo(w, h);
      shape.lineTo(-w, h);
      shape.closePath();
      const result = new THREE.ExtrudeGeometry(shape, {
        depth: depth - r * 2, bevelEnabled: true,
        bevelThickness: r, bevelSize: r, bevelSegments: 1, curveSegments: 1, steps: 1,
      });
      result.translate(0, 0, -depth / 2 + r);
      return result;
    });
    return mesh(parent, geo, mat, x, y, z);
  }

  function group(name: string, x: number, z: number) {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(x, 0.3, z);
    root.add(object);
    return object;
  }

  // Bake only static parts together; movable books, leaves, and lamp parts stay independent.
  function batchStatic(parent: THREE.Group, animated: THREE.Object3D[] = []) {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const sourceMeshes: THREE.Mesh[] = [];
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      let current: THREE.Object3D | null = object;
      while (current && current !== parent) {
        if (animated.includes(current)) return;
        current = current.parent;
      }
      let copy = object.geometry.clone();
      copy.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (copy.index) {
        const expanded = copy.toNonIndexed();
        copy.dispose();
        copy = expanded;
      }
      // Helpers supply positions, normals, and UVs. Keep a consistent attribute set.
      for (const attribute of Object.keys(copy.attributes)) {
        if (!['position', 'normal', 'uv'].includes(attribute)) copy.deleteAttribute(attribute);
      }
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material)!.push(copy);
      sourceMeshes.push(object);
    });
    for (const object of sourceMeshes) object.removeFromParent();
    for (const [mat, parts] of batches) {
      const merged = mergeGeometries(parts, false);
      for (const part of parts) part.dispose();
      if (!merged) continue;
      geometries.add(merged);
      mesh(parent, merged, mat);
    }
  }

  function titleMaterial(id: string, text: string, vertical = false, lines = false) {
    const mat = material({ map: inkTexture(text, lines, vertical), roughness: 0.96, side: THREE.DoubleSide });
    mat.emissive.set('#e0ad67');
    mat.emissiveIntensity = 0;
    focusMaterials.push({ id, material: mat });
    return mat;
  }

  function label(parent: THREE.Object3D, mat: THREE.Material,
    width: number, height: number, x: number, y: number, z: number) {
    const object = mesh(parent, geometry('plane', () => new THREE.PlaneGeometry(1, 1)), mat, x, y, z, false);
    object.scale.set(width, height, 1);
    return object;
  }

  function boundBook(width: number, height: number, depth: number, color: number, tag?: THREE.Material) {
    const result = new THREE.Group();
    const binding = bindings[color % bindings.length];
    box(result, paper, width - 0.024, height - 0.04, depth - 0.035, 0, 0, -0.012);
    box(result, binding, 0.014, height, depth, -width / 2, 0, 0);
    box(result, binding, 0.014, height, depth, width / 2, 0, 0);
    bevel(result, binding, width + 0.016, height, 0.047, 0, 0, depth / 2 - 0.017, 0.009);
    for (const yy of [-height * 0.31, height * 0.31]) {
      const stitch = cylinder(result, cord, 0.004, 0.004, width + 0.02, 0, yy, depth / 2 + 0.008, 5);
      stitch.rotation.z = Math.PI / 2;
    }
    if (tag) label(result, tag, width * 0.68, height * 0.58, 0, 0.018, depth / 2 + 0.01);
    return result;
  }

  // A familiar inscription gives the quiet north wall a human scale.
  const scrollCanvas = document.createElement('canvas');
  scrollCanvas.width = 576;
  scrollCanvas.height = 768;
  const scrollContext = scrollCanvas.getContext('2d')!;
  scrollContext.fillStyle = '#e4d4b1';
  scrollContext.fillRect(0, 0, 576, 768);
  for (let i = 0; i < 1800; i++) {
    scrollContext.fillStyle = i % 3 ? 'rgba(108,76,37,.05)' : 'rgba(255,247,223,.20)';
    scrollContext.fillRect((i * 73.17) % 576, (i * 113.53) % 768, i % 4 + 0.5, 0.8);
  }
  scrollContext.strokeStyle = 'rgba(124,93,53,.23)';
  scrollContext.lineWidth = 1.5;
  scrollContext.strokeRect(32, 35, 512, 698);
  scrollContext.fillStyle = '#3d392f';
  scrollContext.textAlign = 'center';
  scrollContext.textBaseline = 'middle';
  if (isEn) {
    scrollContext.font = 'italic 38px "EB Garamond", Georgia, serif';
    ['What power has', 'the light of night?', '', 'It dies.', 'How is it', 'born again?'].forEach((line, i) => {
      scrollContext.fillText(line, 288, 178 + i * 67, 456);
    });
  } else {
    scrollContext.font = '500 68px "Noto Serif SC", "Songti SC", serif';
    ['夜光何德？', '死则又育？'].forEach((column, index) => {
      [...column].forEach((character, row) => scrollContext.fillText(character, index ? 205 : 367, 174 + row * 94));
    });
  }
  scrollContext.fillStyle = '#99523e';
  scrollContext.fillRect(122, 640, 45, 48);
  scrollContext.strokeStyle = '#e3caa1';
  scrollContext.lineWidth = 2;
  scrollContext.strokeRect(128, 646, 33, 36);
  scrollContext.font = '500 24px "Noto Serif SC", serif';
  scrollContext.fillStyle = '#e3caa1';
  scrollContext.fillText(isEn ? 'S' : '羽', 145, 666);
  const scrollTexture = new THREE.CanvasTexture(scrollCanvas);
  scrollTexture.colorSpace = THREE.SRGBColorSpace;
  scrollTexture.anisotropy = 4;
  textures.add(scrollTexture);
  const scrollInk = material({ map: scrollTexture, roughness: 1, side: THREE.DoubleSide });
  const hangingScroll = group('north-wall-inscribed-scroll', -0.5, -9.55);
  hangingScroll.position.y = 3.25;
  bevel(hangingScroll, cloth, 1.64, 2.08, 0.025, 0, 0, -0.029, 0.003);
  const scrollSheet = geometry('hanging-scroll-paper', () => {
    const result = new THREE.PlaneGeometry(1.42, 1.9, 10, 24);
    const positions = result.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      positions.setZ(i, 0.016 + Math.cos(y * 2.6) * 0.014 + Math.sin(y * 5.7) * 0.004);
    }
    result.computeVertexNormals();
    return result;
  });
  mesh(hangingScroll, scrollSheet, scrollInk);
  for (const yy of [-1.045, 1.045]) {
    const roller = cylinder(hangingScroll, wood, 0.045, 0.045, 1.78, 0, yy, 0, 14);
    roller.rotation.z = Math.PI / 2;
    for (const xx of [-0.92, 0.92]) {
      const end = cylinder(hangingScroll, woodDark, 0.057, 0.057, 0.09, xx, yy, 0, 12);
      end.rotation.z = Math.PI / 2;
    }
  }
  for (const side of [-1, 1]) {
    const a = new THREE.Vector3(side * 0.55, 1.055, -0.01);
    const b = new THREE.Vector3(0, 1.32, -0.09);
    const strand = cylinder(hangingScroll, cord, 0.006, 0.006, a.distanceTo(b));
    strand.position.copy(a).add(b).multiplyScalar(0.5);
    strand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  }
  const scrollPeg = cylinder(hangingScroll, brassDark, 0.012, 0.012, 0.26, 0, 1.32, -0.20, 8);
  scrollPeg.rotation.x = Math.PI / 2;
  batchStatic(hangingScroll);

  // A warm paper sconce, in front of the stone rather than coplanar with it.
  const wallLamp = group('north-wall-paper-sconce', 2.7, -9.74);
  wallLamp.position.y = 2.85;
  bevel(wallLamp, woodDark, 0.24, 0.63, 0.22, 0, 0.08, -0.02);
  bevel(wallLamp, wood, 0.09, 0.075, 0.40, 0, 0.31, 0.18);
  const wallShade = material({ color: '#ebc88d', emissive: '#ffb86b', emissiveIntensity: 0.85, roughness: 1 });
  const shade = cylinder(wallLamp, wallShade, 0.16, 0.16, 0.43, 0, -0.01, 0.35, 8);
  shade.rotation.y = Math.PI / 8;
  for (const yy of [-0.24, 0.22]) {
    const cap = cylinder(wallLamp, woodDark, 0.185, 0.185, 0.035, 0, yy, 0.35, 8);
    cap.rotation.y = Math.PI / 8;
  }
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * Math.PI / 4;
    cylinder(wallLamp, wood, 0.008, 0.008, 0.45, Math.sin(angle) * 0.165, -0.01,
      0.35 + Math.cos(angle) * 0.165, 5);
  }
  cylinder(wallLamp, brassDark, 0.007, 0.007, 0.11, 0, 0.275, 0.35, 6);
  const studyLight = new THREE.PointLight('#ffc184', 10, 8, 2);
  studyLight.position.set(0, -0.01, 0.38);
  studyLight.castShadow = false;
  wallLamp.add(studyLight);
  batchStatic(wallLamp);

  // -------------------------- The library --------------------------
  const shelf = group('library-carved-wood-shelf', -4, -6);
  const shelfTitle = titleMaterial('books', isEn ? 'BOOKS' : '藏书', !isEn);
  const bookTags = ['算法', '系统', '札记', '见闻', '杂录'].map((text, index) =>
    material({ map: inkTexture(isEn ? ['ALG', 'SYS', 'NOTES', 'WORLD', 'MISC'][index] : text,
      false, !isEn), roughness: 1 }));
  box(shelf, woodDark, 2.7, 2.43, 0.07, 0, 1.45, -0.29);
  for (const xx of [-1.36, 1.36]) {
    bevel(shelf, wood, 0.14, 2.82, 0.55, xx, 1.41, 0);
    bevel(shelf, woodDark, 0.23, 0.13, 0.61, xx, 0.08, 0);
    box(shelf, woodEdge, 0.025, 2.48, 0.02, xx - Math.sign(xx) * 0.032, 1.48, 0.285);
  }
  for (const yy of [0.3, 1.05, 1.8, 2.55]) {
    bevel(shelf, wood, 2.78, 0.09, 0.64, 0, yy, 0);
    box(shelf, woodEdge, 2.64, 0.018, 0.025, 0, yy + 0.026, 0.322);
    for (const xx of [-1.15, 1.15]) {
      const bracket = box(shelf, woodDark, 0.07, 0.19, 0.23, xx, yy - 0.11, 0.07);
      bracket.rotation.x = -0.38;
    }
  }
  bevel(shelf, woodDark, 2.99, 0.16, 0.72, 0, 2.79, 0);
  bevel(shelf, woodEdge, 2.86, 0.05, 0.68, 0, 2.89, 0);
  bevel(shelf, woodDark, 0.44, 0.47, 0.06, 0, 2.57, 0.363);
  label(shelf, shelfTitle, isEn ? 0.38 : 0.17, isEn ? 0.24 : 0.38, 0, 2.59, 0.399);
  let pulledBook: THREE.Group | null = null;
  let pulledBookBaseZ = 0;
  for (let row = 0; row < 3; row++) {
    let xx = -1.18;
    for (let index = 0; index < 12; index++) {
      const width = 0.13 + ((index * 7 + row * 3) % 4) * 0.022;
      const height = 0.46 + ((index * 5 + row * 2) % 5) * 0.035;
      if (xx + width > 1.18) break;
      const book = boundBook(width, height, 0.39, index + row * 2,
        index % 3 === 1 ? bookTags[(index + row) % bookTags.length] : undefined);
      book.position.set(xx + width / 2, 0.35 + row * 0.75 + height / 2, 0.015);
      if (row === 1 && index === 5) {
        pulledBook = book;
        book.name = 'book-that-slides-out';
        pulledBookBaseZ = book.position.z;
      }
      shelf.add(book);
      xx += width + 0.027;
    }
  }
  batchStatic(shelf, pulledBook ? [pulledBook] : []);
  colliders.push({ x: -4, z: -6, halfX: 1.51, halfZ: 0.43 });
  let bookOpen = false;
  interactions.push({
    id: 'books', kind: 'books', label: '取一卷书', labelEn: 'Browse the library',
    position: new THREE.Vector3(-4, 2.05, -5.6),
    approach: new THREE.Vector3(-4, 0.3, -4.55), radius: 2.45,
    meshes: [shelf], activate: () => { bookOpen = true; },
  });

  function writingTable(parent: THREE.Group, width: number, depth: number, height: number) {
    bevel(parent, wood, width, 0.13, depth, 0, height, 0, 0.035);
    box(parent, woodEdge, width - 0.1, 0.018, depth - 0.08, 0, height + 0.073, 0);
    for (const xx of [-width * 0.42, width * 0.42]) {
      for (const zz of [-depth * 0.35, depth * 0.35]) {
        bevel(parent, woodDark, 0.11, height - 0.09, 0.13, xx, (height - 0.09) / 2, zz);
        bevel(parent, wood, 0.17, 0.1, 0.19, xx, 0.07, zz);
      }
      box(parent, wood, 0.08, 0.08, depth * 0.78, xx, 0.32, 0);
    }
    for (const zz of [-depth * 0.36, depth * 0.36]) {
      bevel(parent, woodDark, width * 0.84, 0.17, 0.075, 0, height - 0.17, zz);
      box(parent, woodEdge, width * 0.78, 0.018, 0.012, 0, height - 0.16, zz + 0.044);
    }
    box(parent, wood, width * 0.84, 0.07, 0.08, 0, 0.32, 0);
  }

  // ----------------------- Open book and writing desk -----------------------
  const desk = group('writing-desk', 0, -7);
  writingTable(desk, 2.95, 1.25, 1.05);
  const notebook = new THREE.Group();
  notebook.name = 'open-handwritten-notebook';
  notebook.position.set(-0.38, 1.145, 0.02);
  notebook.rotation.y = -0.1;
  desk.add(notebook);
  const manuscript = titleMaterial('latest', isEn ? 'Mountain notes' : '山中手记', false, true);
  const verse = material({ map: inkTexture(isEn ? 'A quiet afternoon' : '晴窗一日', true), roughness: 1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    half.position.x = side * 0.24;
    half.rotation.z = side * -0.035;
    notebook.add(half);
    bevel(half, bindings[0], 0.49, 0.018, 0.65, 0, 0, 0, 0.003);
    box(half, paper, 0.455, 0.042, 0.615, 0, 0.03, 0);
    for (const yy of [0.021, 0.032, 0.043]) {
      box(half, paperEdge, 0.453, 0.0016, 0.614, 0, yy, 0);
    }
    const page = label(half, side === 1 ? manuscript : verse, 0.448, 0.606, 0, 0.053, 0);
    page.rotation.x = -Math.PI / 2;
  }
  const spine = cylinder(notebook, cord, 0.006, 0.006, 0.63, 0, 0.04, 0, 6);
  spine.rotation.x = Math.PI / 2;
  const turningLeaf = new THREE.Group();
  turningLeaf.position.set(0, 0.061, 0);
  notebook.add(turningLeaf);
  const leafGeometry = geometry('curved-turning-page', () => {
    const result = new THREE.PlaneGeometry(0.45, 0.605, 12, 2);
    result.rotateX(-Math.PI / 2);
    result.translate(0.225, 0, 0);
    const positions = result.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      positions.setY(i, Math.sin(x / 0.45 * Math.PI) * 0.019);
    }
    result.computeVertexNormals();
    return result;
  });
  mesh(turningLeaf, leafGeometry, manuscript);
  let leafElapsed = 2;
  let leafHasTurned = false;

  // An inkstone, two brushes, and a ceramic brush pot make the desk inhabited.
  bevel(desk, ink, 0.27, 0.045, 0.18, 0.45, 1.155, -0.25, 0.025);
  const inkWell = cylinder(desk, material({ color: '#111c1b', roughness: 0.17, metalness: 0.1 }),
    0.065, 0.065, 0.004, 0.45, 1.18, -0.25, 18);
  inkWell.castShadow = false;
  for (let i = 0; i < 2; i++) {
    const brush = new THREE.Group();
    brush.position.set(0.5 + i * 0.12, 1.17, 0.12);
    brush.rotation.set(Math.PI / 2, 0, 0.25 + i * 0.09);
    cylinder(brush, woodEdge, 0.01, 0.014, 0.48);
    cylinder(brush, ink, 0.013, 0.002, 0.10, 0, -0.29, 0, 8);
    desk.add(brush);
  }
  const ceramics = material({ color: '#76938a', roughness: 0.36, metalness: 0.04 });
  cylinder(desk, ceramics, 0.09, 0.07, 0.17, -1.1, 1.22, -0.31, 18);
  const cupRim = torus(desk, ceramics, 0.079, 0.012, -1.1, 1.31, -0.31);
  cupRim.rotation.x = Math.PI / 2;
  cylinder(desk, ink, 0.069, 0.069, 0.006, -1.1, 1.31, -0.31, 18);
  const bookmark = box(notebook, red, 0.028, 0.004, 0.18, 0.14, 0.013, 0.385);
  bookmark.rotation.x = 0.32;
  // Two rolled manuscripts rest on the existing desk, outside the reading targets.
  for (let i = 0; i < 2; i++) {
    const rolled = new THREE.Group();
    rolled.position.set(-1.04, 1.17, 0.06 + i * 0.14);
    rolled.rotation.y = -0.12 + i * 0.09;
    const roll = cylinder(rolled, paper, 0.048, 0.048, 0.48, 0, 0, 0, 16);
    roll.rotation.z = Math.PI / 2;
    for (const xx of [-0.255, 0.255]) {
      const axis = cylinder(rolled, woodDark, 0.018, 0.018, 0.05, xx, 0, 0, 10);
      axis.rotation.z = Math.PI / 2;
    }
    const tie = torus(rolled, cord, 0.049, 0.003);
    tie.rotation.y = Math.PI / 2;
    desk.add(rolled);
  }
  batchStatic(desk, [notebook]);
  batchStatic(notebook, [turningLeaf]);
  colliders.push({ x: 0, z: -7, halfX: 1.52, halfZ: 0.69 });
  interactions.push({
    id: 'latest', kind: 'latest', label: '翻开手记', labelEn: 'Read the latest notes',
    position: new THREE.Vector3(-0.38, 1.62, -6.92),
    approach: new THREE.Vector3(-0.35, 0.3, -5.55), radius: 2.3,
    meshes: [notebook], activate: () => { leafElapsed = 0; leafHasTurned = true; },
  });

  // The letter is physically separate from the book, not another floating button.
  const letter = group('personal-letter', 1.03, -6.79);
  letter.position.y = 1.453;
  letter.rotation.y = 0.12;
  const letterPaper = titleMaterial('about', isEn ? 'A letter' : '小笺');
  bevel(letter, paper, 0.47, 0.015, 0.34, 0, 0, 0, 0.003);
  const letterTop = label(letter, letterPaper, 0.44, 0.31, 0, 0.009, 0);
  letterTop.rotation.x = -Math.PI / 2;
  const letterFlap = new THREE.Group();
  letterFlap.position.set(0, 0.015, -0.16);
  letter.add(letterFlap);
  const flapGeometry = geometry('letter-triangle', () => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute([-0.23, 0, 0, 0.23, 0, 0, 0, 0, 0.21], 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    result.computeVertexNormals();
    return result;
  });
  const flapPaper = material({ color: '#e5d3ad', roughness: 0.96, side: THREE.DoubleSide });
  mesh(letterFlap, flapGeometry, flapPaper);
  cylinder(letterFlap, red, 0.041, 0.038, 0.009, 0, 0.005, 0.175, 14);
  let letterOpen = false;
  interactions.push({
    id: 'about', kind: 'about', label: '读一封小笺', labelEn: 'Read a personal letter',
    position: new THREE.Vector3(1.03, 1.64, -6.79),
    approach: new THREE.Vector3(1.48, 0.3, -5.65), radius: 2,
    meshes: [letter], activate: () => { letterOpen = true; },
  });

  // -------------------------- The project workbench --------------------------
  const workbench = group('project-workbench', 3.65, -8.2);
  writingTable(workbench, 2.3, 1.1, 1.02);
  bevel(workbench, woodDark, 0.68, 0.09, 0.61, -0.15, 1.14, -0.03);
  cylinder(workbench, brassDark, 0.20, 0.25, 0.075, -0.15, 1.22, -0.03, 20);
  cylinder(workbench, brassDark, 0.035, 0.055, 0.29, -0.15, 1.37, -0.03, 12);
  const armillary = new THREE.Group();
  armillary.name = 'moving-armillary-sphere';
  armillary.position.set(-0.15, 1.82, -0.03);
  armillary.rotation.z = 0.32;
  workbench.add(armillary);
  const sphere = mesh(armillary, geometry('armillary-core', () => new THREE.IcosahedronGeometry(0.13, 1)), ceramics);
  sphere.castShadow = false;
  const outer = torus(armillary, brass, 0.48, 0.019);
  const middle = torus(armillary, brass, 0.39, 0.014);
  middle.rotation.y = Math.PI / 2;
  const inner = torus(armillary, brassDark, 0.30, 0.018);
  inner.rotation.x = Math.PI / 2;
  cylinder(armillary, brass, 0.01, 0.01, 1.12, 0, 0, 0, 8);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const mark = box(armillary, paperEdge, 0.014, 0.039, 0.014,
      Math.sin(angle) * 0.48, Math.cos(angle) * 0.48, 0.003);
    mark.rotation.z = -angle;
  }
  const projectTitle = titleMaterial('projects', isEn ? 'Work in progress' : '观物 · 求知');
  const projectCard = label(workbench, projectTitle, 0.68, 0.20, 0.57, 1.2, 0.36);
  projectCard.rotation.x = -0.57;
  const schematic = label(workbench,
    material({ map: inkTexture(isEn ? 'Sketches' : '格物札', true), roughness: 1 }),
    0.47, 0.57, 0.69, 1.1, -0.14);
  schematic.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const book = boundBook(0.08, 0.44 - i * 0.025, 0.3, i + 1);
    book.rotation.set(0, i * 0.05, Math.PI / 2);
    book.position.set(-0.87, 1.15 + i * 0.095, -0.05);
    workbench.add(book);
  }
  batchStatic(workbench, [armillary]);
  colliders.push({ x: 3.65, z: -8.2, halfX: 1.21, halfZ: 0.60 });
  let instrumentImpulse = 0;
  interactions.push({
    id: 'projects', kind: 'projects', label: '拨动浑天仪', labelEn: 'Explore the workbench',
    position: new THREE.Vector3(3.5, 2.25, -8.2),
    approach: new THREE.Vector3(3.5, 0.3, -6.45), radius: 2.5,
    meshes: [workbench], activate: () => { instrumentImpulse = 2.7; },
  });

  // -------------------------- A real, switchable lantern --------------------------
  const lamp = group('courtyard-paper-lantern', -3, 3);
  bevel(lamp, woodDark, 0.54, 0.12, 0.50, -0.53, 0.06, 0);
  cylinder(lamp, wood, 0.047, 0.067, 2.53, -0.53, 1.35, 0, 8);
  bevel(lamp, woodDark, 0.83, 0.08, 0.085, -0.16, 2.55, 0);
  const brace = box(lamp, woodEdge, 0.06, 0.48, 0.065, -0.38, 2.36, 0);
  brace.rotation.z = -0.63;
  const lantern = new THREE.Group();
  lantern.name = 'hanging-lantern';
  lantern.position.set(0.15, 2.55, 0);
  lamp.add(lantern);
  cylinder(lantern, cord, 0.008, 0.008, 0.20, 0, -0.10, 0, 5);
  const lanternPaper = material({ color: '#e7bc77', emissive: '#ffb34e', emissiveIntensity: 0.75, roughness: 1 });
  const lanternShade = cylinder(lantern, lanternPaper, 0.255, 0.255, 0.63, 0, -0.56, 0, 8);
  lanternShade.rotation.y = Math.PI / 8;
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * Math.PI / 4;
    cylinder(lantern, woodDark, 0.012, 0.012, 0.65,
      Math.sin(angle) * 0.259, -0.56, Math.cos(angle) * 0.259, 5);
  }
  for (const yy of [-0.235, -0.885]) {
    const cap = cylinder(lantern, wood, 0.28, 0.28, 0.045, 0, yy, 0, 8);
    cap.rotation.y = Math.PI / 8;
    const rim = torus(lantern, brassDark, 0.249, 0.009, 0, yy + 0.023, 0);
    rim.rotation.x = Math.PI / 2;
  }
  cylinder(lantern, red, 0.015, 0.015, 0.16, 0, -0.97, 0, 7);
  for (let i = 0; i < 5; i++) cylinder(lantern, red, 0.003, 0.002, 0.16,
    (i - 2) * 0.009, -1.12, 0, 4);
  const lampGlyph = titleMaterial('lantern', isEn ? 'LIGHT' : '归', false);
  label(lantern, lampGlyph, 0.17, 0.23, 0, -0.55, 0.241);
  const lampLight = new THREE.PointLight('#ffb76b', 4.7, 6, 2);
  lampLight.position.set(0, -0.54, 0);
  lampLight.castShadow = false;
  lantern.add(lampLight);
  batchStatic(lamp, [lantern]);
  batchStatic(lantern);
  colliders.push({ x: -3.22, z: 3, halfX: 0.62, halfZ: 0.35 });
  let lampOn = true;
  let lampAmount = 1;
  interactions.push({
    id: 'lantern', kind: 'lantern', label: '拨一盏灯', labelEn: 'Switch the lantern',
    position: new THREE.Vector3(-2.85, 2.5, 3),
    approach: new THREE.Vector3(-1.65, 0.3, 2.8), radius: 2.2,
    meshes: [lamp], activate: () => { lampOn = !lampOn; },
  });

  // -------------------------- Bench at the view --------------------------
  const bench = group('overlook-carved-bench', 10, 5);
  for (const xx of [-1.13, 1.13]) {
    for (const zz of [-0.26, 0.27]) {
      bevel(bench, woodDark, 0.13, 0.57, 0.14, xx, 0.285, zz);
      bevel(bench, wood, 0.21, 0.09, 0.21, xx, 0.06, zz);
    }
    box(bench, wood, 0.1, 0.08, 0.64, xx, 0.2, 0);
    bevel(bench, wood, 0.12, 0.8, 0.12, xx, 0.93, 0.27);
    bevel(bench, wood, 0.11, 0.45, 0.10, xx, 0.78, -0.22);
    bevel(bench, woodEdge, 0.17, 0.08, 0.70, xx, 1.015, 0.02);
  }
  for (let i = 0; i < 3; i++) bevel(bench, wood, 2.65, 0.075, 0.20,
    0, 0.57, (i - 1) * 0.223, 0.018);
  bevel(bench, woodDark, 2.66, 0.13, 0.12, 0, 1.23, 0.28);
  bevel(bench, wood, 2.48, 0.09, 0.09, 0, 0.77, 0.28);
  for (let i = 0; i < 9; i++) bevel(bench, wood, 0.052, 0.41, 0.055,
    (i - 4) * 0.245, 0.995, 0.28, 0.01);
  box(bench, woodDark, 2.27, 0.08, 0.08, 0, 0.2, 0);
  const benchTitle = titleMaterial('bench', isEn ? 'Take a breath' : '坐听松风');
  bevel(bench, woodDark, 0.68, 0.25, 0.045, 0, 1.035, 0.22);
  const benchPlaque = label(bench, benchTitle, 0.61, 0.20, 0, 1.035, 0.192);
  benchPlaque.rotation.y = Math.PI;
  const benchCloth = mesh(bench, geometry('bench-cloth', () => {
    const result = new THREE.PlaneGeometry(0.63, 0.78, 5, 12);
    const positions = result.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const v = positions.getY(i);
      const front = Math.max(0, -v - 0.15);
      positions.setXYZ(i, x, -front * 1.9 + Math.sin(x * 24) * front * 0.08, v);
    }
    result.computeVertexNormals();
    return result;
  }), cloth, 0.66, 0.617, -0.11);
  benchCloth.rotation.y = 0.05;
  batchStatic(bench);
  colliders.push({ x: 10, z: 5, halfX: 1.39, halfZ: 0.43 });
  interactions.push({
    id: 'bench', kind: 'bench', label: '坐看山色', labelEn: 'Pause by the mountains',
    position: new THREE.Vector3(10, 1.5, 5),
    approach: new THREE.Vector3(10, 0.3, 3.65), radius: 2.25,
    meshes: [bench],
    // The visitor's seated torso bottom is root.y + 0.26; the seat top is 0.9075.
    sitPosition: new THREE.Vector3(10, 0.65, 4.88),
    sitYaw: Math.PI,
  });

  let disposed = false;
  let instrumentAngle = 0;
  return {
    root, colliders, interactions,
    update(time, delta, selectedId) {
      if (disposed) return;
      const dt = Math.min(Math.max(delta, 0), 0.08);
      if (selectedId !== 'books') bookOpen = false;
      if (selectedId !== 'about') letterOpen = false;
      if (pulledBook) {
        const distance = bookOpen ? 0.2 : selectedId === 'books' ? 0.085 : 0;
        pulledBook.position.z = THREE.MathUtils.damp(pulledBook.position.z, pulledBookBaseZ + distance, 7, dt);
      }
      if (leafHasTurned) {
        leafElapsed = Math.min(1.25, leafElapsed + dt);
        const progress = THREE.MathUtils.smoothstep(leafElapsed / 1.25, 0, 1);
        turningLeaf.rotation.z = progress * Math.PI;
      }
      letterFlap.rotation.x = THREE.MathUtils.damp(letterFlap.rotation.x,
        letterOpen ? -1.2 : selectedId === 'about' ? -0.15 : 0, 6, dt);
      instrumentImpulse = Math.max(0, instrumentImpulse - dt);
      instrumentAngle += dt * (0.08 + (selectedId === 'projects' ? 0.16 : 0) + instrumentImpulse * 0.6);
      middle.rotation.y = Math.PI / 2 + instrumentAngle;
      inner.rotation.z = instrumentAngle * 0.62;
      outer.rotation.y = Math.sin(time * 0.12) * 0.06;
      lantern.rotation.z = Math.sin(time * 0.8) * 0.024;
      lantern.rotation.x = Math.sin(time * 0.61 + 0.9) * 0.012;
      lampAmount = THREE.MathUtils.damp(lampAmount, lampOn ? 1 : 0, 9, dt);
      const flicker = 1 + Math.sin(time * 4.2) * 0.014 + Math.sin(time * 9.1) * 0.009;
      lampLight.intensity = lampAmount * 4.7 * flicker;
      lanternPaper.emissiveIntensity = 0.035 + lampAmount * 0.75 * flicker;
      for (const entry of focusMaterials) {
        const target = entry.id === selectedId ? 0.14 : 0;
        entry.material.emissiveIntensity = THREE.MathUtils.damp(entry.material.emissiveIntensity, target, 7, dt);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
      for (const texture of textures) texture.dispose();
      geometries.clear();
      materials.clear();
      textures.clear();
      geometryCache.clear();
    },
  };
}
