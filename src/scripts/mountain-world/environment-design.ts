import * as THREE from 'three';
import { buildTimberHalls } from './timber-halls';
import { architecturalBlock, gridSurface } from './environment-geometry';
import type { SurfaceLibrary } from './materials';
import type { Collider, WalkArea } from './types';

/** These openings also cut the island's soil; water must not float on an uncut ground plane. */
export const COURTYARD_POOL = { x0: -2.6, x1: -.9, z0: -3.7, z1: -.7 } as const;
export const FORECOURT_PLANTER = { x0: -5.88, x1: -4.12, z0: 2.05, z1: 5.35 } as const;

type Rect = { x0: number; x1: number; z0: number; z1: number };
const mirrorRect = (rect: Rect): Rect => ({ ...rect, x0: -rect.x1, x1: -rect.x0 });
export const COURTYARD_POOLS = [COURTYARD_POOL, mirrorRect(COURTYARD_POOL)];
type Opening = { from: number; to: number; bottom: number; top: number; lattice?: boolean };

/** Three inhabited wings surround an open court, rather than furnishing one undivided room. */
export function createStudyArchitecture(root: THREE.Group, library: SurfaceLibrary, en: boolean) {
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
        const draw = (p0: number, y0: number, p1: number, y1: number, width: number) => {
          const at = (p: number, y: number) => axis === 'x' ? new THREE.Vector3(p,y,fixed) : new THREE.Vector3(fixed,y,p);
          beam(at(p0,y0),at(p1,y1),width,.045,'Stepped timber window lattice');
        };
        for (const sign of [-1,1]) {
          const end = sign<0 ? opening.from+.13 : opening.to-.13;
          const inward = -sign*Math.min(.37,length*.16);
          const y0=opening.bottom+.10,y1=opening.top-.10;
          draw(end,y0,end,y1,.036);
          draw(end+inward,y0,end+inward,y0+.28,.029); draw(end,y0+.28,end+inward,y0+.28,.029);
          draw(end+inward,y1,end+inward,y1-.28,.029); draw(end,y1-.28,end+inward,y1-.28,.029);
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
  for (const sign of [-1,1]) {
    const side = (r: Rect) => sign < 0 ? r : mirrorRect(r);
    const p = side(COURTYARD_POOL), rim = { x0:p.x0-.12,x1:p.x1+.12,z0:p.z0-.12,z1:p.z1+.12 };
    paving(side({x0:-3.2,x1:0,z0:-5.8,z1:.6}),1.6,.8,rim);
    paving(side({x0:-6.35,x1:-1.98,z0:.6,z1:8.4}),.94,1.56,side(FORECOURT_PLANTER),sidePaving);
    for (let i=0;i<6;i++) box(.115,.028,1.288,sign*1.916,.288,1.25+i*1.3,joints,'Inset stone path border',.003).castShadow=false;
    timberFloor(side({x0:-7.36,x1:-6.1,z0:-6,z1:7.85}));
  }
  paving({x0:-1.85,x1:1.85,z0:.6,z1:8.4},1.85,.975);
  paving({x0:-1.85,x1:1.85,z0:8.4,z1:19.97},1.85,.89);
  for (const x of [-3.2, 3.2]) box(.095, .018, 6.4, x, .294, -2.6, joinery, 'Flush inner-gallery edge board', .002).castShadow = false;
  box(12.2, .018, .095, 0, .294, -5.8, joinery, 'North study open threshold', .002).castShadow = false;

  const waterW = COURTYARD_POOL.x1 - COURTYARD_POOL.x0, waterD = COURTYARD_POOL.z1 - COURTYARD_POOL.z0;
  const waterGeometry = keep(gridSurface(14,24,(u,v) => new THREE.Vector3((u-.5)*waterW,.257,(v-.5)*waterD),true));
  const leafColor = own(new THREE.MeshStandardMaterial({name:'Celadon lotus leaves',color:'#72855a',roughness:.66,side:THREE.DoubleSide,vertexColors:true}));
  const petalColor = own(new THREE.MeshStandardMaterial({name:'Lotus petal silk',color:'#fff2dd',roughness:.71,vertexColors:true,side:THREE.DoubleSide}));
  const lotusLeaf = keep(gridSurface(3,32,(u,v) => {
    const a=.12+v*(Math.PI*2-.24),r=u*(1+.045*Math.cos(a*7)); return new THREE.Vector3(r*Math.cos(a),.04*u+.065*u*u*Math.sin(a*4),r*Math.sin(a));
  },false,(u,v)=>new THREE.Color().setScalar(.74+.18*u+.075*Math.cos(v*Math.PI*26))));
  const petal = keep(gridSurface(5,8,(u,v) => new THREE.Vector3((u-.5)*Math.sin(Math.PI*v)*.135,.16*v*v+.024*Math.sin(u*Math.PI),.18*v),
    false,(_u,v)=>new THREE.Color('#dfaba2').lerp(new THREE.Color('#fff3d9'),1-Math.pow(v,2))));
  const heart=own(new THREE.MeshStandardMaterial({color:'#b5934a',roughness:.84}));
  for (const [i,p] of COURTYARD_POOLS.entries()) {
    const x=(p.x0+p.x1)/2,z=(p.z0+p.z1)/2;
    box(waterW,.06,waterD,x,.13,z,joints,'Recessed pool bed',.005).castShadow=false;
    for (const side of [-1,1]) {
      box(.12,.19,waterD+.24,x+side*(waterW/2+.06),.245,z,limestone,'Stone pool coping',.009);
      box(waterW,.19,.12,x,.245,z+side*(waterD/2+.06),limestone,'Stone pool coping',.009);
    }
    obstacle(x,z,waterW/2+.12,waterD/2+.12);
    const water=add(waterGeometry,waterMaterial,'Open reflecting pool',x,0,z);
    water.castShadow=false; water.userData.dynamic=true; water.userData.ignoreInteractionRay=true;
    for (let j=0;j<9;j++) {
      const px=x+Math.sin(j*2.5+i*.8)*.51, pz=z+Math.cos(j*1.76+i)*1.06, r=.10+(j%4)*.036;
      const leaf=add(lotusLeaf,leafColor,'Notched lotus pad',px,.274+(j%3)*.005,pz);
      leaf.scale.set(r,.4,r); leaf.rotation.y=j*2.39;
      if (j!==1 && j!==6) continue;
      for (let k=0;k<13;k++) {
        const bloom=add(petal,petalColor,'Cupped lotus petal',px,.30,pz);
        bloom.rotation.set(k<8?-.12:-.50,k*2.39,0,'YXZ'); bloom.scale.setScalar(k<8?.72:.48);
      }
      add(keep(new THREE.SphereGeometry(.027,10,6)),heart,'Lotus seed head',px,.355,pz);
    }
  }
  for (const planter of [FORECOURT_PLANTER,mirrorRect(FORECOURT_PLANTER)]) {
    const x=(planter.x0+planter.x1)/2,z=(planter.z0+planter.z1)/2,w=planter.x1-planter.x0,d=planter.z1-planter.z0;
    box(w,.065,d,x,.305,z,soil,'Pine bed',.01);
    for (const side of [-1,1]) {
      box(.12,.15,d,x+side*(w/2-.06),.36,z,limestone,'Stone planting curb');
      box(w-.24,.15,.12,x,.36,z+side*(d/2-.06),limestone,'Stone planting curb');
    }
    obstacle(x,z,w/2+.01,d/2+.01);
  }

  wall('x', -10, -6.1, 6.1, 4.18);
  for (const x of [-6.1, 6.1]) wall('z', x, -10, -5.8, 3.79, [{ from: -9.18, to: -6.35, bottom: 1.02, top: 3.29, lattice: true }]);
  for (const sign of [-1,1]) wall('z',sign*6.1,-5.8,.6,3.47,[
    {from:-5.62,to:-4.14,bottom:.3,top:2.89}, {from:-3.12,to:.20,bottom:1.07,top:2.96,lattice:true},
  ]);
  for (const sign of [-1, 1]) {
    wall('x', .6, sign < 0 ? -6.1 : 3.2, sign < 0 ? -3.2 : 6.1, 3.16,
      [{ from: sign < 0 ? -5.67 : 3.63, to: sign < 0 ? -3.63 : 5.67, bottom: 1.02, top: 2.82, lattice: true }]);
    for (const z of [-1.05, .52]) post(sign * 3.2, z, 3.08, .17);
    box(.20, .17, 6.5, sign * 3.2, 3.07, -2.6, joinery, 'Continuous open-gallery bearing beam');
    for (const z of [-5.73, -1.05, .52]) beam(new THREE.Vector3(sign * 3.2, 3.07, z), new THREE.Vector3(sign * 6.02, 3.39, z), .13, .15, 'Visible gallery cross beam');
  }
  for (const z of [-9.75, -7.9]) {
    box(12.20,.20,.22,0,4.12,z,joinery,'Crossbeam beneath north hall');
  }
  for (const side of [-1,1]) {
    box(.85,.34,2.55,side*5.48,.47,-8.02,plaster,'Study window seat',.018);
    box(.91,.085,2.63,side*5.47,.6825,-8.02,paleWood,'Timber window-seat cap',.012);
    box(.66,.055,1.96,side*5.43,.7525,-8.02,carpet,'Window-seat cushion',.021);
    obstacle(side*5.47,-8.02,.475,1.335);
  }
  box(4.76, .010, 3.30, 0, .310, -7.59, carpet, 'Bound north-study carpet', .002).castShadow = false;
  for (const x of [-2.30, 2.30]) box(.024, .002, 3.14, x, .3165, -7.59, binding, 'Fine carpet binding', .0003).castShadow = false;
  for (const z of [-9.16, -6.02]) box(4.60, .002, .024, 0, .3165, z, binding, 'Fine carpet binding', .0003).castShadow = false;

  for (const sign of [-1,1]) {
    wall('z',sign*6.35,.6,4.75,1.30,[],.26);
    wall('z',sign*6.35,7.62,8.4,1.30,[],.26);
    for (const z of [-5.65,-1.8,2,7.55]) {
      post(sign*8.28,z,2.82,.16);
      beam(new THREE.Vector3(sign*6.25,3.07,z),new THREE.Vector3(sign*8.28,2.85,z),.10,.12,'Covered walk cross beam');
    }
    for (const z of [2,7.55]) post(sign*6.25,z,3.04,.16);
    box(.15,.13,13.42,sign*6.25,3.04,.95,joinery,'Inner gallery plate');
    box(.17,.16,13.42,sign*8.28,2.85,.95,joinery,'Outer gallery plate');
  }
  const halls = buildTimberHalls(group, { timber: joinery, stone: limestone, sideStone: sidePaving, plaster, soffit }, obstacle, en);
  halls.group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry); materials.add(object.material);
    }
  });

  const walkAreas: WalkArea[] = [
    { x: 0, z: -7.9, halfX: 6.1, halfZ: 2.1 },
    { x: -4.65, z: -2.6, halfX: 1.45, halfZ: 3.2 },
    { x: 4.65, z: -2.6, halfX: 1.45, halfZ: 3.2 },
    { x: 0, z: -2.6, halfX: 3.2, halfZ: 3.2 },
    { x: 0, z: 4.5, halfX: 6.35, halfZ: 3.9 },
    { x: 0, z: 8.4, halfX: 1.8, halfZ: .55 },
    { x: 0, z: 11.00, halfX: 3.65, halfZ: 2.72 },
    { x: 0, z: 16.45, halfX: 2.13, halfZ: 3.53 },
    { x: -7.25, z: .925, halfX: 1.15, halfZ: 6.925 },
    { x: -10.15, z: .10, halfX: 2.81, halfZ: 8.1 },
    { x: 7.25, z: .925, halfX: 1.15, halfZ: 6.925 },
    { x: 10.15, z: .10, halfX: 2.81, halfZ: 8.1 },
  ];
  return {
    geometries, materials, colliders, walkAreas, ready: halls.ready, dispose: halls.dispose,
    update(time: number) {
      const { position, normal } = waterGeometry.attributes;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), z = position.getZ(i);
        const a=x*6.4+z*4.8+time*.85,b=z*8.1-time*.55;
        position.setY(i,.257+.0045*Math.sin(a)+.002*Math.cos(b));
        normal.setXYZ(i,-.029*Math.cos(a),1,-.022*Math.cos(a)+.016*Math.sin(b));
      }
      position.needsUpdate = normal.needsUpdate = true;
    },
  };
}
