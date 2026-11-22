import * as THREE from 'three';
import { architecturalBlock, gridSurface } from './environment-geometry';
import type { SurfaceLibrary } from './materials';
import type { Collider, WalkArea } from './types';

/** These openings also cut the island's soil; water must not float on an uncut ground plane. */
export const COURTYARD_POOL = { x0: -2.6, x1: -.9, z0: -3.7, z1: -.7 } as const;
export const FORECOURT_PLANTER = { x0: -5.88, x1: -4.12, z0: 2.05, z1: 5.35 } as const;

type Rect = { x0: number; x1: number; z0: number; z1: number };
type Opening = { from: number; to: number; bottom: number; top: number; lattice?: boolean };

/** Three inhabited wings surround an open court, rather than furnishing one undivided room. */
export function createStudyArchitecture(root: THREE.Group, library: SurfaceLibrary) {
  const group = new THREE.Group(); group.name = 'Cloud court — north study and two open wings'; root.add(group);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), colliders: Collider[] = [];
  const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const own = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const plaster = own(library.material('plaster', { worldScale: .7, normalScale: .16, roughness: .92 }));
  plaster.name = 'Warm white lime plaster';
  const limestone = own(library.material('limestone', { worldScale: .58, normalScale: .22, roughness: .84 }));
  limestone.name = 'Pale courtyard limestone';
  const sidePaving = own(library.material('limestone', { color: '#d1d9d2', worldScale: .58, normalScale: .18, roughness: .90 }));
  sidePaving.name = 'Quiet green-grey forecourt side courses';
  const paleWood = own(library.material('paleWood', { repeat: [1, 2.4], normalScale: .24, roughness: .71 }));
  paleWood.name = 'Light timber floors and window reveals';
  const soffit = own(library.material('paleWood', { repeat: [5, 3], normalScale: .16, roughness: .76, side: THREE.DoubleSide }));
  soffit.name = 'Light boarded roof underside';
  const joinery = own(library.material('wood', { color: '#e2e6df', repeat: [1, 1.4], normalScale: .23, roughness: .72 }));
  joinery.name = 'Quiet walnut structural joinery';
  const roof = own(library.material('roofTile', { worldScale: 1.25, normalScale: .22, roughness: .84, side: THREE.DoubleSide }));
  roof.name = 'Blue-grey curved tile roofs';
  const roofRoll = own(library.material('roofTile', { color: '#d9e0dd', worldScale: 1.35, normalScale: .17, roughness: .83 }));
  roofRoll.name = 'Soft tile ridges and thin eave caps';
  const joints = own(new THREE.MeshStandardMaterial({ color: '#75817b', roughness: .94 }));
  const carpet = own(library.material('cloth', { repeat: [6, 5], normalScale: .26, roughness: 1 }));
  const binding = own(new THREE.MeshStandardMaterial({ color: '#a4aa98', roughness: 1 }));
  const soil = own(library.material('ground', { worldScale: 1.5, color: '#a9b4a0', normalScale: .32 }));
  const waterMaterial = own(new THREE.MeshPhysicalMaterial({
    color: '#729c90', roughness: .22, metalness: .08, transparent: true, opacity: .82,
    clearcoat: .7, clearcoatRoughness: .20, depthWrite: false, side: THREE.DoubleSide,
  }));
  const blocks = new Map<string, THREE.BufferGeometry>(), unitCube = keep(new THREE.BoxGeometry(1, 1, 1));
  const vUp = new THREE.Vector3(0, 1, 0);

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material); object.name = name; object.position.set(x, y, z);
    object.castShadow = true; object.receiveShadow = true; group.add(object); return object;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, name: string, bevel = .008) {
    const key = `${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${bevel}`;
    let geometry = blocks.get(key);
    if (!geometry) { geometry = keep(architecturalBlock(w, h, d, bevel)); blocks.set(key, geometry); }
    return add(geometry, material, name, x, y, z);
  }
  function obstacle(x: number, z: number, halfX: number, halfZ: number) { colliders.push({ x, z, halfX, halfZ }); }
  function beam(a: THREE.Vector3, b: THREE.Vector3, width: number, depth: number, name: string, material: THREE.Material = joinery) {
    const delta = b.clone().sub(a), result = add(unitCube, material, name);
    result.position.copy(a).add(b).multiplyScalar(.5); result.scale.set(width, delta.length(), depth);
    result.quaternion.setFromUnitVectors(vUp, delta.normalize()); return result;
  }
  function curve(points: THREE.Vector3[], radius: number, material: THREE.Material, name: string, segments = 20, sides = 6) {
    return add(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, sides, false)), material, name);
  }
  function post(x: number, z: number, top: number, width = .19, depth = width) {
    box(width, top - .3, depth, x, (top + .3) / 2, z, joinery, 'Timber column with a real bearing');
    box(width + .09, .12, depth + .09, x, .36, z, limestone, 'Low stone column foot', .012);
    obstacle(x, z, (width + .09) / 2 + .012, (depth + .09) / 2 + .012);
  }
  function horizontal(a: number, b: number, y: number, fixed: number, axis: 'x' | 'z', material: THREE.Material, name: string, h = .08, depth = .31) {
    return axis === 'x' ? box(b - a, h, depth, (a + b) / 2, y, fixed, material, name)
      : box(depth, h, b - a, fixed, y, (a + b) / 2, material, name);
  }
  function wallPanel(axis: 'x' | 'z', fixed: number, lo: number, hi: number, bottom: number, top: number, thickness: number) {
    if (hi - lo < .01 || top - bottom < .01) return;
    const x = axis === 'x' ? (lo + hi) / 2 : fixed, z = axis === 'x' ? fixed : (lo + hi) / 2;
    const w = axis === 'x' ? hi - lo : thickness, d = axis === 'z' ? hi - lo : thickness;
    box(w, top - bottom, d, x, (top + bottom) / 2, z, plaster, 'Solid lime-plaster wall with depth', .012);
    if (bottom < 2.28 && top > .35) obstacle(x, z, w / 2 + .012, d / 2 + .012);
    if (bottom < .4) box(w + .012, .14, d + .012, x, .37, z, limestone, 'Continuous pale stone wall plinth', .006);
  }
  /** Window and door voids are actual missing wall volumes, including their reveals. */
  function wall(axis: 'x' | 'z', fixed: number, lo: number, hi: number, top: number, openings: Opening[] = [], thickness = .28) {
    const ordered = [...openings].sort((a, b) => a.from - b.from); let start = lo;
    for (const opening of ordered) {
      wallPanel(axis, fixed, start, opening.from, .3, top, thickness);
      wallPanel(axis, fixed, opening.from, opening.to, .3, opening.bottom, thickness);
      wallPanel(axis, fixed, opening.from, opening.to, opening.top, top, thickness);
      const isDoor = opening.bottom <= .31, length = opening.to - opening.from;
      for (const p of [opening.from + .035, opening.to - .035]) {
        const x = axis === 'x' ? p : fixed, z = axis === 'x' ? fixed : p;
        box(axis === 'x' ? .07 : thickness + .045, opening.top - opening.bottom, axis === 'z' ? .07 : thickness + .045,
          x, (opening.top + opening.bottom) / 2, z, paleWood, 'Deep timber window or door jamb', .006);
        if (isDoor) obstacle(x, z, (axis === 'x' ? .07 : thickness + .045) / 2 + .01, (axis === 'z' ? .07 : thickness + .045) / 2 + .01);
      }
      horizontal(opening.from, opening.to, opening.top - .035, fixed, axis, paleWood, 'Recessed opening head', .07, thickness + .045);
      horizontal(opening.from - .05, opening.to + .05, opening.bottom + (isDoor ? .004 : -.015), fixed, axis,
        isDoor ? limestone : paleWood, isDoor ? 'Flush door threshold' : 'Deep window sill', isDoor ? .008 : .07, thickness + .12).castShadow = !isDoor;
      if (opening.lattice) {
        const panel = Math.min(.76, length * .32), edge = opening.from + panel / 2 + .08;
        for (let j = 0; j < 5; j++) {
          const p = edge + (j - 2) * (panel - .08) / 4;
          const x = axis === 'x' ? p : fixed, z = axis === 'x' ? fixed : p;
          box(axis === 'x' ? .027 : .055, opening.top - opening.bottom - .14, axis === 'z' ? .027 : .055,
            x, (opening.top + opening.bottom) / 2, z, joinery, 'Sparse window lattice', .003);
        }
      }
      start = opening.to;
    }
    wallPanel(axis, fixed, start, hi, .3, top, thickness);
    horizontal(lo - .035, hi + .035, top + .025, fixed, axis, roofRoll, 'Thin dark wall coping', .06, thickness + .09);
  }
  function subtract(rect: Rect, hole?: Rect): Rect[] {
    if (!hole || rect.x1 <= hole.x0 || rect.x0 >= hole.x1 || rect.z1 <= hole.z0 || rect.z0 >= hole.z1) return [rect];
    const a = Math.max(rect.x0, hole.x0), b = Math.min(rect.x1, hole.x1), c = Math.max(rect.z0, hole.z0), d = Math.min(rect.z1, hole.z1);
    return [{ ...rect, x1: a }, { ...rect, x0: b }, { x0: a, x1: b, z0: rect.z0, z1: c }, { x0: a, x1: b, z0: d, z1: rect.z1 }]
      .filter(r => r.x1 - r.x0 > .02 && r.z1 - r.z0 > .02);
  }
  function floorBase(rect: Rect, hole?: Rect) {
    for (const r of subtract(rect, hole)) box(r.x1 - r.x0, .06, r.z1 - r.z0, (r.x0 + r.x1) / 2, .256, (r.z0 + r.z1) / 2,
      joints, 'Recessed floor joint bed', .002).castShadow = false;
  }
  function paving(rect: Rect, width: number, depth: number, hole?: Rect, material: THREE.Material = limestone) {
    floorBase(rect, hole); let row = 0;
    for (let z = rect.z0; z < rect.z1 - .001; z += depth, row++) {
      for (let x = rect.x0 - (row % 2) * width / 2; x < rect.x1; x += width) {
        const tile = { x0: Math.max(x, rect.x0), x1: Math.min(x + width, rect.x1), z0: z, z1: Math.min(z + depth, rect.z1) };
        for (const r of subtract(tile, hole)) {
          if (r.x1 - r.x0 < .035 || r.z1 - r.z0 < .035) continue;
          box(r.x1 - r.x0 - .012, .028, r.z1 - r.z0 - .012, (r.x0 + r.x1) / 2, .288, (r.z0 + r.z1) / 2,
            material, 'Large staggered courtyard flagstone', .004).castShadow = false;
        }
      }
    }
  }
  function timberFloor(rect: Rect, alongZ = true) {
    floorBase(rect);
    const width = .235, length = 2.1, span = alongZ ? rect.x1 - rect.x0 : rect.z1 - rect.z0;
    const count = Math.ceil(span / width), fitted = span / count;
    for (let row = 0; row < count; row++) {
      const start = alongZ ? rect.z0 : rect.x0, end = alongZ ? rect.z1 : rect.x1;
      for (let a = start - (row % 3) * length / 3; a < end; a += length) {
        const b = Math.min(end, a + length), aa = Math.max(start, a);
        if (b - aa < .03) continue;
        const across = (alongZ ? rect.x0 : rect.z0) + (row + .5) * fitted;
        box(alongZ ? fitted - .007 : b - aa - .009, .024, alongZ ? b - aa - .009 : fitted - .007,
          alongZ ? across : (aa + b) / 2, .291, alongZ ? (aa + b) / 2 : across, paleWood, 'Individual pale timber floorboard', .003).castShadow = false;
      }
    }
  }

  // Floors express the plan before a single object is placed in it. Accessible surfaces stay at y=.3.
  timberFloor({ x0: -6.1, x1: 6.1, z0: -10, z1: -5.8 });
  timberFloor({ x0: -6.1, x1: -3.2, z0: -5.8, z1: .6 });
  timberFloor({ x0: 3.2, x1: 6.1, z0: -5.8, z1: .6 });
  const poolRim = { x0: COURTYARD_POOL.x0 - .12, x1: COURTYARD_POOL.x1 + .12, z0: COURTYARD_POOL.z0 - .12, z1: COURTYARD_POOL.z1 + .12 };
  paving({ x0: -3.2, x1: 3.2, z0: -5.8, z1: .6 }, 1.6, .8, poolRim);
  // A pale arrival walk continues from the southern gate. Slightly deeper side
  // courses run the other way; their narrow inset borders never add a step.
  paving({ x0: -6.35, x1: -.68, z0: .6, z1: 8.4 }, .9, 1.8, FORECOURT_PLANTER, sidePaving);
  paving({ x0: -.55, x1: 3.15, z0: .6, z1: 8.4 }, 1.85, .975);
  paving({ x0: 3.28, x1: 6.35, z0: .6, z1: 8.4 }, .9, 1.8, undefined, sidePaving);
  for (const x of [-.615, 3.215]) for (let i = 0; i < 6; i++)
    box(.118, .028, 1.288, x, .288, 1.25 + i * 1.3, joints, 'Flush arrival-walk border course', .003).castShadow = false;
  paving({ x0: -.55, x1: 3.15, z0: 8.4, z1: 13.65 }, 1.85, .875);
  timberFloor({ x0: 6.1, x1: 7.36, z0: -6, z1: 7.85 });
  for (const x of [-3.2, 3.2]) box(.095, .018, 6.4, x, .294, -2.6, joinery, 'Flush inner-gallery edge board', .002).castShadow = false;
  box(12.2, .018, .095, 0, .294, -5.8, joinery, 'North study open threshold', .002).castShadow = false;

  const waterX = (COURTYARD_POOL.x0 + COURTYARD_POOL.x1) / 2, waterZ = (COURTYARD_POOL.z0 + COURTYARD_POOL.z1) / 2;
  const waterW = COURTYARD_POOL.x1 - COURTYARD_POOL.x0, waterD = COURTYARD_POOL.z1 - COURTYARD_POOL.z0;
  box(waterW, .06, waterD, waterX, .13, waterZ, joints, 'Recessed pool bed', .005).castShadow = false;
  for (const x of [poolRim.x0 + .06, poolRim.x1 - .06]) box(.12, .19, poolRim.z1 - poolRim.z0, x, .245, waterZ, limestone, 'Quiet pool curb', .009);
  for (const z of [poolRim.z0 + .06, poolRim.z1 - .06]) box(waterW, .19, .12, waterX, .245, z, limestone, 'Quiet pool curb', .009);
  obstacle(waterX, waterZ, (poolRim.x1 - poolRim.x0) / 2 + .008, (poolRim.z1 - poolRim.z0) / 2 + .008);
  const waterGeometry = keep(gridSurface(14, 24, (u, v) => new THREE.Vector3(COURTYARD_POOL.x0 + u * waterW, .257, COURTYARD_POOL.z0 + v * waterD), true));
  const water = add(waterGeometry, waterMaterial, 'Shallow open-sky reflecting pool'); water.castShadow = false;
  water.userData.dynamic = true; water.userData.ignoreInteractionRay = true; waterGeometry.computeBoundingSphere();

  const planterX = (FORECOURT_PLANTER.x0 + FORECOURT_PLANTER.x1) / 2, planterZ = (FORECOURT_PLANTER.z0 + FORECOURT_PLANTER.z1) / 2;
  const planterW = FORECOURT_PLANTER.x1 - FORECOURT_PLANTER.x0, planterD = FORECOURT_PLANTER.z1 - FORECOURT_PLANTER.z0;
  box(planterW, .065, planterD, planterX, .305, planterZ, soil, 'Earth below the forecourt pine', .01);
  for (const x of [FORECOURT_PLANTER.x0 + .06, FORECOURT_PLANTER.x1 - .06]) box(.12, .15, planterD, x, .36, planterZ, limestone, 'Low planted-court edging');
  for (const z of [FORECOURT_PLANTER.z0 + .06, FORECOURT_PLANTER.z1 - .06]) box(planterW - .24, .15, .12, planterX, .36, z, limestone, 'Low planted-court edging');
  obstacle(planterX, planterZ, planterW / 2 + .01, planterD / 2 + .01);

  // The rear gable receives the circular painting without a beam through its face.
  const roofHalf = 6.75, ridgeY = 5.25;
  const mainProfile = (x: number) => { const t = Math.min(1, Math.abs(x) / roofHalf); return 3.75 + (ridgeY - 3.75) * Math.pow(1 - t, 1.3) + .22 * Math.pow(t, 8); };
  const gable = new THREE.Shape(); gable.moveTo(-6.1, .3); gable.lineTo(6.1, .3);
  for (let i = 0; i <= 64; i++) { const x = 6.1 - i / 64 * 12.2; gable.lineTo(x, mainProfile(x) - .135); } gable.closePath();
  const backWall = keep(new THREE.ExtrudeGeometry(gable, { depth: .30, bevelEnabled: false, steps: 1 })); backWall.translate(0, 0, -.15);
  add(backWall, plaster, 'Continuous white rear gable behind the landscape screen', 0, 0, -10);
  obstacle(0, -10, 6.112, .162);
  box(12.2, .14, .32, 0, .37, -10, limestone, 'Study rear stone plinth', .006);
  for (const x of [-6.1, 6.1]) wall('z', x, -10, -5.8, 3.79, [{ from: -9.18, to: -6.35, bottom: 1.02, top: 3.29, lattice: true }]);
  wall('z', -6.1, -5.8, .6, 3.47, [
    { from: -4.85, to: -1.62, bottom: 2.73, top: 3.19 },
    { from: -1.12, to: .22, bottom: .98, top: 2.95, lattice: true },
  ]);
  wall('z', 6.1, -5.8, .6, 3.47, [
    { from: -5.62, to: -3.62, bottom: .3, top: 2.89 },
    { from: -3.12, to: .20, bottom: 1.07, top: 2.96, lattice: true },
  ]);
  for (const sign of [-1, 1]) {
    wall('x', .6, sign < 0 ? -6.1 : 3.2, sign < 0 ? -3.2 : 6.1, 3.16,
      [{ from: sign < 0 ? -5.67 : 3.63, to: sign < 0 ? -3.63 : 5.67, bottom: 1.02, top: 2.82, lattice: true }]);
    for (const z of [-1.05, .52]) post(sign * 3.2, z, 3.08, .17);
    box(.20, .17, 6.5, sign * 3.2, 3.07, -2.6, joinery, 'Continuous open-gallery bearing beam');
    for (const z of [-5.73, -1.05, .52]) beam(new THREE.Vector3(sign * 3.2, 3.07, z), new THREE.Vector3(sign * 6.02, 3.39, z), .13, .15, 'Visible gallery cross beam');
  }
  for (const x of [-6.1, 6.1]) post(x, -5.8, 3.67, .22);
  for (const x of [-3.2, 3.2]) post(x, -5.8, 4.075, .19, .22);
  for (const z of [-9.72, -7.88, -5.8]) {
    box(6.54, .17, .21, 0, 4.16, z, joinery, 'High central roof tie above the painting');
    beam(new THREE.Vector3(0, 4.245, z), new THREE.Vector3(0, 5.10, z), .12, .14, 'Short upper king post');
    for (const sign of [-1, 1]) beam(new THREE.Vector3(sign * 3.2, 4.14, z), new THREE.Vector3(sign * 5.98, 3.62, z), .12, .14, 'Study side roof bearing');
  }
  for (const x of [-6.04, 6.04]) box(.16, .18, 4.44, x, 3.62, -7.9, joinery, 'Longitudinal eave plate');
  box(.15, .17, 5.4, 0, 5.08, -7.9, joinery, 'Continuous upper ridge beam');
  box(.85, .34, 2.55, -5.48, .47, -8.02, plaster, 'Integrated study window seat', .018);
  box(.91, .085, 2.63, -5.47, .6825, -8.02, paleWood, 'Window-seat timber cap', .012);
  box(.66, .055, 1.96, -5.43, .7525, -8.02, carpet, 'Quiet window-seat cushion', .021);
  obstacle(-5.47, -8.02, .475, 1.335);
  box(4.76, .010, 3.30, 0, .310, -7.59, carpet, 'Bound north-study carpet', .002).castShadow = false;
  for (const x of [-2.30, 2.30]) box(.024, .002, 3.14, x, .3165, -7.59, binding, 'Fine carpet binding', .0003).castShadow = false;
  for (const z of [-9.16, -6.02]) box(4.60, .002, .024, 0, .3165, z, binding, 'Fine carpet binding', .0003).castShadow = false;

  /** A continuous curved roof includes a top, soffit and closed edge thickness. */
  function roofPanel(name: string, rect: Rect, height: (x: number, z: number) => number, rollAxis: 'x' | 'z', thickness = .115) {
    const xSpan = rect.x1 - rect.x0, zSpan = rect.z1 - rect.z0;
    const nx = Math.max(8, Math.ceil(xSpan * 5)), nz = Math.max(8, Math.ceil(zSpan * 3));
    const sample = (u: number, v: number, below = 0) => {
      const x = rect.x0 + u * xSpan, z = rect.z0 + v * zSpan; return new THREE.Vector3(x, height(x, z) - below, z);
    };
    add(keep(gridSurface(nx, nz, (u, v) => sample(u, v), true)), roof, `${name} — continuous tiled top`);
    add(keep(gridSurface(nx, nz, (u, v) => sample(u, v, thickness))), soffit, `${name} — visible boarded underside`);
    for (const v of [0, 1]) {
      add(keep(gridSurface(nx, 1, (u, t) => sample(u, v, t * thickness), v === 1)), roofRoll, `${name} — thin closed gable edge`);
      const points = Array.from({ length: 25 }, (_, i) => sample(i / 24, v, thickness + .018));
      curve(points, .034, joinery, `${name} — restrained curved fascia`, 32);
    }
    for (const u of [0, 1]) add(keep(gridSurface(nz, 1, (v, t) => sample(u, v, t * thickness), u === 0)), roofRoll, `${name} — closed eave edge`);
    const acrossStart = rollAxis === 'x' ? rect.z0 : rect.x0, acrossEnd = rollAxis === 'x' ? rect.z1 : rect.x1;
    const count = Math.max(3, Math.ceil((acrossEnd - acrossStart) / .34));
    for (let i = 0; i <= count; i++) {
      const across = THREE.MathUtils.lerp(acrossStart + .035, acrossEnd - .035, i / count);
      const points: THREE.Vector3[] = [], under: THREE.Vector3[] = [];
      for (let j = 0; j <= 18; j++) {
        const x = rollAxis === 'x' ? THREE.MathUtils.lerp(rect.x0, rect.x1, j / 18) : across;
        const z = rollAxis === 'z' ? THREE.MathUtils.lerp(rect.z0, rect.z1, j / 18) : across;
        points.push(new THREE.Vector3(x, height(x, z) + .006, z)); under.push(new THREE.Vector3(x, height(x, z) - thickness - .052, z));
      }
      curve(points, .024, roofRoll, `${name} — quiet tile rolls`, 28, 5);
      if (i % 2 === 0) curve(under, .038, joinery, `${name} — slender visible rafters`, 26, 6);
    }
  }
  roofPanel('North study double-pitched roof', { x0: -roofHalf, x1: roofHalf, z0: -10.65, z1: -5.12 }, (x, z) => {
    const t = Math.abs(x) / roofHalf, end = Math.abs((z + 7.885) / 2.765);
    return mainProfile(x) + .065 * Math.pow(t, 5) * Math.pow(end, 8);
  }, 'x');
  curve([new THREE.Vector3(0, 5.28, -10.77), new THREE.Vector3(0, 5.34, -9.1), new THREE.Vector3(0, 5.34, -6.55), new THREE.Vector3(0, 5.28, -5.0)],
    .075, roofRoll, 'Simple capped study ridge', 28, 8);
  for (const sign of [-1, 1]) {
    const r = { x0: sign < 0 ? -6.58 : 2.91, x1: sign < 0 ? -2.91 : 6.58, z0: -5.94, z1: 1.02 };
    const wingProfile = (x: number, z: number) => {
      const t = (Math.abs(x) - 2.91) / 3.67, end = Math.abs((z + 2.46) / 3.48);
      return 3.23 + .35 * t + .105 * Math.pow(1 - t, 8) + .045 * Math.pow(end, 10);
    };
    roofPanel(sign < 0 ? 'West library wing roof' : 'East instrument wing roof', r, wingProfile, 'x', .105);
    const x0 = sign < 0 ? -6.1 : 3.2, x1 = sign < 0 ? -3.2 : 6.1, infill = new THREE.Shape();
    infill.moveTo(x0, 3.16); infill.lineTo(x1, 3.16);
    for (let i = 0; i <= 18; i++) { const x = THREE.MathUtils.lerp(x1, x0, i / 18); infill.lineTo(x, wingProfile(x, .6) - .105); }
    infill.closePath();
    const geometry = keep(new THREE.ExtrudeGeometry(infill, { depth: .28, steps: 1, bevelEnabled: false })); geometry.translate(0, 0, -.14);
    add(geometry, plaster, 'Shallow white gallery gable meeting its roof', 0, 0, .6);
  }

  wall('z', -6.35, .6, 8.4, 1.62, [{ from: 2.05, to: 5.35, bottom: .92, top: 1.48 }], .26);
  wall('z', 6.35, .6, 3.68, 1.30, [], .26);
  wall('z', 6.35, 6.02, 8.4, 1.30, [], .26);
  wall('x', 8.4, -6.35, -.46, 2.12, [{ from: -5.42, to: -3.37, bottom: 1.01, top: 1.92, lattice: true }], .32);
  wall('x', 8.4, 3.06, 6.35, 2.12, [{ from: 3.73, to: 5.68, bottom: 1.01, top: 1.92, lattice: true }], .32);
  for (const x of [-.46, 3.06]) {
    wallPanel('x', 8.4, x - .17, x + .17, .3, 2.88, .42);
    post(x + (x < 1 ? .19 : -.19), 8.4, 2.88, .13, .36);
  }
  box(3.64, .19, .40, 1.3, 2.90, 8.4, joinery, 'South gate lintel');
  box(3.20, .075, .18, 1.3, 3.18, 8.4, paleWood, 'South gate open transom head');
  for (let i = 0; i < 11; i++) box(.027, .20, .07, 1.3 + (i - 5) * .29, 3.04, 8.4, joinery, 'Fine gate transom slat', .003);
  roofPanel('Small southern garden gate', { x0: -1.03, x1: 3.63, z0: 7.55, z1: 9.25 }, (x, z) => {
    const t = Math.min(1, Math.abs(z - 8.4) / .85); return 3.16 + .46 * Math.pow(1 - t, 1.4) + .11 * Math.pow(t, 8) + .025 * Math.pow(Math.abs(x - 1.3) / 2.33, 8);
  }, 'z', .095);
  curve([new THREE.Vector3(-1.12, 3.65, 8.4), new THREE.Vector3(1.3, 3.67, 8.4), new THREE.Vector3(3.72, 3.65, 8.4)], .052, roofRoll, 'Thin garden gate ridge cap', 18, 8);

  for (const z of [-5.65, -1.8, 2.0, 7.55]) post(8.28, z, 2.82, .16);
  for (const z of [2.0, 7.55]) post(6.25, z, 3.04, .16);
  box(.15, .13, 13.42, 6.25, 3.04, .95, joinery, 'Inner covered-walk bearing on wall and columns');
  box(.17, .16, 13.42, 8.28, 2.85, .95, joinery, 'Outer covered-walk bearing');
  for (const z of [-5.65, -1.8, 2.0, 7.55]) beam(new THREE.Vector3(6.25, 3.07, z), new THREE.Vector3(8.28, 2.85, z), .10, .12, 'Covered-walk roof cross beam');
  roofPanel('East covered walk', { x0: 6.08, x1: 8.66, z0: -6.02, z1: 7.94 }, (x, z) => {
    const t = (x - 6.08) / 2.58; return 3.21 - .28 * t + .08 * Math.pow(t, 8) + .02 * Math.pow(Math.abs((z - .96) / 6.98), 10);
  }, 'x', .095);
  for (const z of [.95, 2.68]) post(12.55, z, 2.72, .13);
  for (const y of [.74, 2.66]) box(.13, .07, 1.73, 12.55, y, 1.815, joinery, 'Open terrace screen rail');
  for (let i = 0; i < 9; i++) box(.055, 1.85, .029, 12.55, 1.70, 1.08 + i * .184, paleWood, 'Sparse terrace screen', .003);
  obstacle(12.55, 1.815, .10, .98);

  const walkAreas: WalkArea[] = [
    { x: 0, z: -7.9, halfX: 6.1, halfZ: 2.1 },
    { x: -4.65, z: -2.6, halfX: 1.45, halfZ: 3.2 },
    { x: 4.65, z: -2.6, halfX: 1.45, halfZ: 3.2 },
    { x: 0, z: -2.6, halfX: 3.2, halfZ: 3.2 },
    { x: 0, z: 4.5, halfX: 6.35, halfZ: 3.9 },
    { x: 1.3, z: 8.4, halfX: 1.8, halfZ: .55 },
    { x: 1.3, z: 11.25, halfX: 3.45, halfZ: 2.95 },
    { x: 7.25, z: .925, halfX: 1.15, halfZ: 6.925 },
    { x: 10.15, z: .10, halfX: 2.81, halfZ: 8.1 },
  ];
  return {
    geometries, materials, colliders, walkAreas,
    update(time: number) {
      const position = waterGeometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        position.setY(i, .257 + Math.sin(x * 4.2 + z * 2.7 + time * .7) * .0018 + Math.cos(z * 6.1 - time * .5) * .0009);
      }
      position.needsUpdate = true;
    },
  };
}
