import * as THREE from 'three';
import { createLotusPlanting } from './lotus-pond';
import { COURTYARD_POOL, POOL_BED_Y, POOL_COPING_Y, POOL_WATER_Y, setPoolReflections } from './water-court';
import { createFloorFinishes } from './courtyard-paving';
import { buildTimberHalls } from './timber-halls';
import { buildCloudGallery } from './cloud-gallery';
import { buildReedShades } from './reed-shades';
import { HALL_STEPS, NORTH_HALL_RISE } from './hall-terrace';
import { architecturalBlock, gridSurface } from './environment-geometry';
import type { SurfaceLibrary } from './materials';
import type { Collider, Overhead, WalkArea } from './types';

export const FORECOURT_PLANTER = { x0: -6.09, x1: -5.02, z0: 2.05, z1: 5.35 } as const;

type Rect = { x0: number; x1: number; z0: number; z1: number };
const mirrorRect = (rect: Rect): Rect => ({ ...rect, x0: -rect.x1, x1: -rect.x0 });
type Opening = { from: number; to: number; bottom: number; top: number; lattice?: boolean; clearInset?: number; seat?: Collider };

/** Three inhabited wings surround an open court, rather than furnishing one undivided room. */
export function createStudyArchitecture(root: THREE.Group, library: SurfaceLibrary, en: boolean) {
  const group = new THREE.Group(); group.name = 'Cloud court — north study and two open wings'; root.add(group);
  const hallInterior = new THREE.Group();
  hallInterior.name = 'North study on its stone terrace';
  hallInterior.position.y = NORTH_HALL_RISE;
  group.add(hallInterior);
  let assembly = group;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), colliders: Collider[] = [];
  const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const own = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const floors = createFloorFinishes(library,keep,own);
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
  const joints = own(new THREE.MeshStandardMaterial({ color: '#8b8070', roughness: .94 }));
  const carpet = own(library.material('cloth', { repeat: [6, 5], normalScale: .26, roughness: 1 }));
  const binding = own(new THREE.MeshStandardMaterial({ color: '#a4aa98', roughness: 1 }));
  const soil = own(library.material('ground', { worldScale: 1.5, color: '#a9b4a0', normalScale: .32 }));
  const waterMaterial = own(new THREE.MeshPhysicalMaterial({
    color: '#83ada6', vertexColors:true, roughness: .16, metalness: .09, transparent: true, opacity: .60,
    clearcoat: .63, clearcoatRoughness: .18, depthWrite: false, side: THREE.DoubleSide,
  }));
  const poolWaves = setPoolReflections(waterMaterial);
  const blocks = new Map<string, THREE.BufferGeometry>(), unitCube = keep(new THREE.BoxGeometry(1, 1, 1));
  const vUp = new THREE.Vector3(0, 1, 0);

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, name: string, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material); object.name = name; object.position.set(x, y, z);
    object.castShadow = true; object.receiveShadow = true; assembly.add(object); return object;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, name: string, bevel = .008) {
    const key = `${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${bevel}`;
    let geometry = blocks.get(key);
    if (!geometry) { geometry = keep(architecturalBlock(w, h, d, bevel)); blocks.set(key, geometry); }
    return add(geometry, material, name, x, y, z);
  }
  function obstacle(x: number, z: number, halfX: number, halfZ: number) {
    const collider: Collider = { x, z, halfX, halfZ };
    colliders.push(collider);
    return collider;
  }
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
  function wallPanel(axis: 'x' | 'z', fixed: number, lo: number, hi: number, bottom: number, top: number, thickness: number, finish = plaster) {
    if (hi - lo < .01 || top - bottom < .01) return;
    const x = axis === 'x' ? (lo + hi) / 2 : fixed, z = axis === 'x' ? fixed : (lo + hi) / 2;
    const w = axis === 'x' ? hi - lo : thickness, d = axis === 'z' ? hi - lo : thickness;
    box(w, top - bottom, d, x, (top + bottom) / 2, z, finish, 'Solid lime-plaster wall with depth', .012);
    if (bottom < .4) box(w + .012, .14, d + .012, x, .37, z, limestone, 'Continuous pale stone wall plinth', .006);
    if (bottom < 2.28 && top > .35) return obstacle(x, z, w / 2 + .012, d / 2 + .012);
  }
  /** Window and door voids are actual missing wall volumes, including their reveals. */
  function wall(axis: 'x' | 'z', fixed: number, lo: number, hi: number, top: number, openings: Opening[] = [], finish = plaster) {
    const thickness = .28;
    const ordered = [...openings].sort((a, b) => a.from - b.from); let start = lo;
    for (const opening of ordered) {
      wallPanel(axis, fixed, start, opening.from, .3, top, thickness, finish);
      const sill = wallPanel(axis, fixed, opening.from, opening.to, .3, opening.bottom, thickness, finish);
      wallPanel(axis, fixed, opening.from, opening.to, opening.top, top, thickness, finish);
      const isDoor = opening.bottom <= .31, length = opening.to - opening.from;
      if (sill && !isDoor) {
        const latticeInset = opening.lattice ? .15 + Math.min(.37, length * .16) : .07;
        const inset = Math.max(latticeInset, opening.clearInset ?? 0);
        sill.window = { axis, from: opening.from + inset, to: opening.to - inset,
          sillTop: opening.bottom + .021 + assembly.position.y, seat: opening.seat };
      }
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
    wallPanel(axis, fixed, start, hi, .3, top, thickness, finish);
    horizontal(lo - .035, hi + .035, top + .025, fixed, axis, roofRoll, 'Thin dark wall coping', .06, thickness + .09);
  }
  function subtract(rect: Rect, hole?: Rect): Rect[] {
    if (!hole || rect.x1 <= hole.x0 || rect.x0 >= hole.x1 || rect.z1 <= hole.z0 || rect.z0 >= hole.z1) return [rect];
    const a = Math.max(rect.x0, hole.x0), b = Math.min(rect.x1, hole.x1), c = Math.max(rect.z0, hole.z0), d = Math.min(rect.z1, hole.z1);
    return [{ ...rect, x1: a }, { ...rect, x0: b }, { x0: a, x1: b, z0: rect.z0, z1: c }, { x0: a, x1: b, z0: d, z1: rect.z1 }]
      .filter(r => r.x1 - r.x0 > .02 && r.z1 - r.z0 > .02);
  }
  function cutOpenings(rect: Rect, holes: Rect[]) {
    return holes.reduce<Rect[]>((pieces, hole) => pieces.flatMap(piece => subtract(piece, hole)), [rect]);
  }
  function floorBase(rect: Rect, holes: Rect[] = [], parent: THREE.Object3D = group) {
    for (const r of cutOpenings(rect, holes)) {
      const bed=box(r.x1-r.x0,.06,r.z1-r.z0,(r.x0+r.x1)/2,.256,(r.z0+r.z1)/2,joints,'Recessed floor joint bed',.002);
      bed.castShadow=false;
      if (parent!==group) parent.add(bed);
    }
  }
  function paving(rect: Rect, course: number, length: number, holes: Rect[] = []) {
    floorBase(rect,holes);
    floors.flags(group,rect,course,length,holes);
  }
  function timberFloor(rect: Rect, parent: THREE.Object3D = group) {
    floorBase(rect,[],parent);
    floors.boards(parent,rect);
  }

  // The court sits at y=.3. The north hall floor and furnishings share the elevated terrace.
  timberFloor({ x0: -6.1, x1: 6.1, z0: -10, z1: -5.8 },hallInterior);
  timberFloor({ x0: -6.1, x1: -3.2, z0: -5.8, z1: .6 });
  timberFloor({ x0: 3.2, x1: 6.1, z0: -5.8, z1: .6 });
  const rim = {x0:COURTYARD_POOL.x0-.16,x1:COURTYARD_POOL.x1+.16,z0:COURTYARD_POOL.z0-.16,z1:COURTYARD_POOL.z1+.16};
  paving({x0:-6.35,x1:6.35,z0:.6,z1:8.4},.45,1.22,[rim,FORECOURT_PLANTER,mirrorRect(FORECOURT_PLANTER)]);
  for (const sign of [-1,1]) {
    const side = (r: Rect) => sign < 0 ? r : mirrorRect(r);
    floors.flags(group,side({x0:-1.98,x1:-1.82,z0:8.4,z1:15.75}),1.18,.16,[],'border');
    // Side courts continue the gate landing to its stone parapet. The pines root outside the apron.
    paving(side({x0:-5.99,x1:-1.98,z0:8.40,z1:12.87}),.46,1.35);
    floors.flags(group,side({x0:-6.27,x1:-5.99,z0:8.40,z1:13.17}),1.12,.28,[],'border');
    floors.flags(group,side({x0:-5.99,x1:-1.98,z0:12.87,z1:13.17}),.30,1.22,[],'threshold');
    timberFloor(side({x0:-7.36,x1:-6.1,z0:-6,z1:7.85}));
  }
  paving({x0:-3.2,x1:3.2,z0:-5.8,z1:.6},.50,1.40);
  paving({x0:-1.82,x1:1.82,z0:8.4,z1:15.75},.50,1.38);
  for (const x of [-3.2, 3.2]) box(.095, .018, 6.4, x, .294, -2.6, joinery, 'Flush inner-gallery edge board', .002).castShadow = false;
  box(12.2, .018, .095, 0, .294, -5.8, joinery, 'North study open threshold', .002).castShadow = false;

  const waterW = COURTYARD_POOL.x1 - COURTYARD_POOL.x0, waterD = COURTYARD_POOL.z1 - COURTYARD_POOL.z0;
  const waterCentre = (COURTYARD_POOL.z0 + COURTYARD_POOL.z1) / 2;
  const shallow=new THREE.Color('#c2c9a9'), deep=new THREE.Color('#547d77');
  const waterGeometry = keep(gridSurface(88,82,(u,v) => new THREE.Vector3((u-.5)*waterW,POOL_WATER_Y,(v-.5)*waterD),true,
    (u,v)=>shallow.clone().lerp(deep,THREE.MathUtils.smoothstep(Math.min(u,v,1-u,1-v),0,.38))));
  const bedStone = own(library.material('darkStone',{color:'#b2bda8',worldScale:.45,roughness:.88,normalScale:.44}));
  const pebble = keep(new THREE.IcosahedronGeometry(1,1));
  const lotus = createLotusPlanting(group,geometries,materials);
  box(waterW,.06,waterD,0,POOL_BED_Y-.03,waterCentre,bedStone,'Recessed pool bed',.005).castShadow=false;
  // Fine curved caustics stay continuous at eye level without tessellating the bed.
  const pixels=256, cells=15;
  const seeds=new Map<number,[number,number]>();
  for(let z=-2;z<=cells+2;z++) for(let x=-2;x<=cells+2;x++){
    const jitter=(salt:number)=>Math.abs(Math.sin(x*63.17+z*115.43+salt)*2319.17)%1;
    seeds.set((z+2)*32+x+2,[x+.16+.68*jitter(1.6),z+.16+.68*jitter(8.3)]);
  }
  const bedPixels=new Uint8Array(pixels*pixels*4);
  for(let row=0;row<pixels;row++) for(let col=0;col<pixels;col++){
    const u=col/pixels,v=row/pixels,x=u*cells+.31*Math.sin(v*43+u*2),z=v*cells+.24*Math.sin(u*39-v*4);
    const cx=Math.floor(x),cz=Math.floor(z);
    let first=5,second=5;
    for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){
      const point=seeds.get((cz+j+2)*32+cx+i+2)!;
      const dist=(x-point[0])**2+(z-point[1])**2;
      if(dist<first){second=first;first=dist;}else second=Math.min(second,dist);
    }
    const beam=Math.exp(-29*(second-first)),dapple=7*Math.sin(1.7*x)*Math.cos(2.1*z);
    const at=(row*pixels+col)*4;
    bedPixels[at]=98+dapple+94*beam;bedPixels[at+1]=113+dapple+81*beam;
    bedPixels[at+2]=91+dapple+49*beam;bedPixels[at+3]=255;
  }
  const bedMap=new THREE.DataTexture(bedPixels,pixels,pixels,THREE.RGBAFormat);
  bedMap.colorSpace=THREE.SRGBColorSpace;bedMap.magFilter=THREE.LinearFilter;bedMap.minFilter=THREE.LinearMipmapLinearFilter;
  bedMap.generateMipmaps=true;bedMap.needsUpdate=true;
  const caustics=own(new THREE.MeshStandardMaterial({map:bedMap,roughness:.94}));
  caustics.addEventListener('dispose',()=>bedMap.dispose());
  const lightBed=keep(gridSurface(1,1,(u,v)=>new THREE.Vector3((u-.5)*waterW,POOL_BED_Y+.004,(v-.5)*waterD),true));
  const bed=add(lightBed,caustics,'Light refracted across the shallow pool',0,0,waterCentre);bed.castShadow=false;
  for (let k=0;k<24;k++) {
    const px=1.90*Math.sin(k*2.43), pz=waterCentre+2.06*Math.sin(k*1.47+.3);
    const stone=add(pebble,bedStone,'Submerged river stone',px,POOL_BED_Y+.004,pz);
    stone.scale.set(.034+.013*(k%3),.014+.004*(k%2),.027+.012*(k%4)); stone.rotation.y=k*2.4;
  }
  for (const side of [-1,1]) {
    // The pale cap projects over the recessed wall. The patinated corner cramps cross the stone joints.
    const halfW=waterW/2,halfD=waterD/2;
    box(.18,.19,waterD+.38,side*(halfW+.09),.300,waterCentre,sidePaving,'Lower wall of the pool',.008);
    box(waterW,.19,.18,0,.300,waterCentre+side*(halfD+.09),sidePaving,'Lower wall of the pool',.008);
    for(let i=0;i<4;i++) {
      box(.23,.092,(waterD+.42)/4-.008,side*(halfW+.092),POOL_COPING_Y-.046,COURTYARD_POOL.z0-.21+(i+.5)*(waterD+.42)/4,limestone,'Stone pool coping',.011);
      box(waterW/4-.007,.092,.23,COURTYARD_POOL.x0+(i+.5)*waterW/4,POOL_COPING_Y-.046,waterCentre+side*(halfD+.092),limestone,'Stone pool coping',.011);
    }
  }
  const poolBronze=own(new THREE.MeshStandardMaterial({color:'#6a8171',metalness:.54,roughness:.61}));
  const poolGold=own(new THREE.MeshStandardMaterial({color:'#cba46a',metalness:.61,roughness:.48}));
  for(const side of [-1,1]) for(const end of [-1,1]){
    const x=side*(waterW/2-.29), z=waterCentre+end*(waterD/2+.092);
    box(.085,.012,.238,x,.475,z,poolBronze,'Bronze cramp across the stone cap',.004);
    for(const edge of [-1,1])box(.009,.014,.238,x+edge*.038,.475,z,poolGold,'Burnished edge of the bronze cramp',.002);
    for(const face of [-1,1]){
      box(.084,.091,.012,x,.425,z+face*.116,poolBronze,'Bent end of the coping cramp',.003);
      box(.030,.025,.014,x,.395,z+face*.118,poolGold,'Square brass rivet',.003);
    }
  }
  const water=add(waterGeometry,waterMaterial,'Open reflecting pool',0,0,waterCentre);
  water.castShadow=false; water.userData.dynamic=true; water.userData.ignoreInteractionRay=true;
  // Two stronger colonies leave open water on the diagonal between the gate and the hall.
  lotus.plant(-1.40,2.83,-1,-.37,.97);
  lotus.plant(-.78,2.52,1,.95,.66);
  lotus.plant(1.30,4.91,1,-.45,1.08);
  lotus.plant(.47,5.12,-1,.86,.75);
  lotus.plant(1.47,2.53,1,.44,.64);
  lotus.finish();
  for (const planter of [FORECOURT_PLANTER,mirrorRect(FORECOURT_PLANTER)]) {
    const x=(planter.x0+planter.x1)/2,z=(planter.z0+planter.z1)/2,w=planter.x1-planter.x0,d=planter.z1-planter.z0;
    box(w,.065,d,x,.305,z,soil,'Pine bed',.01);
    for (const side of [-1,1]) {
      box(.12,.15,d,x+side*(w/2-.06),.36,z,limestone,'Stone planting curb');
      box(w-.24,.15,.12,x,.36,z+side*(d/2-.06),limestone,'Stone planting curb');
    }
    obstacle(x,z,w/2+.01,d/2+.01);
  }

  // Individual dressed stones wrap the platform. Their recessed beds give each tread a shadow line.
  for (let step = 1; step <= HALL_STEPS.count; step++) {
    const { front, rear, halfWidth, tread, riser, count } = HALL_STEPS;
    const margin = (count - step) * tread;
    const w = halfWidth + margin;
    const south = front + margin, north = rear - margin;
    const top = .3 + step * riser - .012;
    box(w * 2 - .032, riser - .004, south - north - .032, 0, top - riser / 2 - .014, (north + south) / 2,
      sidePaving, 'Rebated plinth under the hall stair', .012);
    for (const z of [north + tread / 2, south - tread / 2]) {
      const pieces = Math.ceil(2 * w / 1.51);
      const width = 2 * w / pieces;
      for (let k = 0; k < pieces; k++) box(width - .007, .085, tread + .014,
        -w + width * (k + .5), top - .0425, z, limestone, 'Dressed front and rear stair nosing', .011);
    }
    const depth = south - north - 2 * tread;
    const pieces = Math.ceil(depth / 1.28), length = depth / pieces;
    for (const side of [-1, 1]) for (let k = 0; k < pieces; k++) {
      box(tread + .012, .085, length - .007, side * (w - tread / 2), top - .0425,
        north + tread + length * (k + .5), limestone, 'Return of the stone stair tread', .011);
    }
  }

  assembly = hallInterior;
  wall('x', -10, -6.1, 6.1, 4.18);
  for (const side of [-1,1]) {
    box(.85,.34,2.55,side*5.48,.47,-8.02,plaster,'Study window seat',.018);
    box(.91,.085,2.63,side*5.47,.6825,-8.02,paleWood,'Timber window-seat cap',.012);
    box(.66,.055,1.96,side*5.43,.7525,-8.02,carpet,'Window-seat cushion',.021);
    const seat = obstacle(side*5.47,-8.02,.475,1.335);
    wall('z', side*6.1, -10, -5.8, 3.79, [{ from: -9.18, to: -6.35, bottom: 1.02, top: 3.29, lattice: true, seat }]);
  }
  assembly = group;
  const archivePlaster = own(library.material('plaster', { color: '#f4e5ce', worldScale: .78, roughness: .94, normalScale: .21 }));
  const archiveElm = own(library.material('paleWood', { color: '#bc886a', worldScale: .92, roughness: .76, normalScale: .28 }));
  const wingDoor = { from: -5.62, to: -4.14, bottom: .3, top: 2.89 };
  function archiveWall(axis: 'x' | 'z', fixed: number, lo: number, hi: number, top: number, door?: Opening) {
    const inward = axis === 'z' ? 1 : -1, face = fixed + inward * .14;
    wall(axis, fixed, lo, hi, top, door ? [door] : [], archivePlaster);
    for (const [start, end] of door ? [[lo, door.from], [door.to, hi]] : [[lo, hi]]) {
      const panels = Math.ceil((end - start) / .60), width = (end - start) / panels;
      for (let i = 0; i < panels; i++) {
        horizontal(start + i * width + .004, start + (i + 1) * width - .004, .57, face + inward * .015, axis, archiveElm, 'Elm dado panel', .50, .027);
        horizontal(start + i * width, start + i * width + .034, .57, face + inward * .031, axis, archiveElm, 'Dado muntin', .49, .025);
      }
      horizontal(start, end, .835, face + inward * .028, axis, archiveElm, 'Beaded rail over the wall panelling', .073, .076);
      horizontal(start, end, .365, face + inward * .031, axis, archiveElm, 'Skirting at the foot of the archive wall', .093, .079);
    }
    horizontal(lo, hi, top - .09, face + inward * .035, axis, archiveElm, 'Timber wall plate under the archive eaves', .18, .082);
  }
  archiveWall('z',-6.1,-5.8,.6,3.47,wingDoor);
  archiveWall('x',.6,-6.1,-3.2,3.16);
  wall('z',6.1,-5.8,.6,3.47,[
    wingDoor, {from:-3.12,to:.20,bottom:1.07,top:2.96,lattice:true},
  ]);
  for (const sign of [-1, 1]) {
    // The additional timber cheeks at this opening leave .62 m clear on each side of its centre.
    if (sign > 0) wall('x', .6, 3.2, 6.1, 3.16, [{ from: 3.63, to: 5.67, bottom: 1.02, top: 2.82, lattice: true, clearInset: .40 }]);
    for (const z of [-4.22, .52]) post(sign * 3.2, z, 3.08, .17);
    box(.20, .17, 6.5, sign * 3.2, 3.07, -2.6, joinery, 'Continuous open-gallery bearing beam');
    for (const z of [-5.73, -4.22, .52]) beam(new THREE.Vector3(sign * 3.2, 3.07, z), new THREE.Vector3(sign * 6.02, 3.39, z), .13, .15, 'Visible gallery cross beam');
  }
  assembly = hallInterior;
  for (const z of [-9.75, -7.9]) {
    box(12.20,.20,.22,0,4.12,z,joinery,'Crossbeam beneath north hall');
  }
  box(4.76, .010, 3.30, 0, .310, -7.59, carpet, 'Bound north-study carpet', .002).castShadow = false;
  for (const x of [-2.30, 2.30]) box(.024, .002, 3.14, x, .3165, -7.59, binding, 'Fine carpet binding', .0003).castShadow = false;
  for (const z of [-9.16, -6.02]) box(4.60, .002, .024, 0, .3165, z, binding, 'Fine carpet binding', .0003).castShadow = false;
  assembly = group;

  for (const sign of [-1,1]) {
    for (const z of [-5.65,-1.8,2,7.55]) {
      if (sign>0) post(sign*8.28,z,2.82,.16);
      beam(new THREE.Vector3(sign*6.25,3.07,z),new THREE.Vector3(sign*8.28,2.85,z),.10,.12,'Covered walk cross beam');
    }
    for (const z of [2,7.55]) post(sign*6.25,z,3.04,.16);
    box(.15,.13,13.42,sign*6.25,3.04,.95,joinery,'Inner gallery plate');
    box(.17,.16,13.42,sign*8.28,2.85,.95,joinery,'Outer gallery plate');
  }
  const halls = buildTimberHalls(group, { timber: joinery, stone: limestone, sideStone: sidePaving, plaster, archivePlaster, soffit }, obstacle, en);
  const galleryStone = buildCloudGallery(group,library,geometries,materials,colliders);
  buildReedShades(group,library,geometries,materials);
  // Capture the undersides before scenery is batched. Jumping never raycasts the roof tiles.
  const headPieces = new Set(['Recessed opening head', 'Painted lintel frame', 'Carved plaque backing', '留云阁', 'Recessed central lintel',
    'Continuous open-gallery bearing beam', 'Visible gallery cross beam', 'Covered walk cross beam',
    'Inner gallery plate', 'Outer gallery plate', 'Weighted roll at the foot of a bamboo blind']);
  const overheads: Overhead[] = [];
  const bounds = new THREE.Box3();
  group.traverse(object => {
    if (!headPieces.has(object.name)) return;
    object.updateWorldMatrix(true, false);
    bounds.setFromObject(object);
    const {min, max} = bounds;
    if (min.y > 3.5) return;
    overheads.push({x:(min.x+max.x)/2, z:(min.z+max.z)/2, halfX:(max.x-min.x)/2,
      halfZ:(max.z-min.z)/2, bottom:min.y});
  });
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
    { x: 0, z: 14.25, halfX: 1.8, halfZ: 1.5 },
    { x: 0, z: 23.875, halfX: 1.65, halfZ: 8.125 },
    { x: 0, z: 34, halfX: 4.2, halfZ: 4.2, shape: 'ellipse' },
    { x: 18.75, z: 5, halfX: 5.25, halfZ: .95 },
    { x: 26, z: 5, halfX: 4.3, halfZ: 4.3, shape: 'ellipse' },
    { x: -7.25, z: .925, halfX: 1.15, halfZ: 6.925 },
    { x: -10.15, z: .10, halfX: 2.81, halfZ: 8.1 },
    { x: 7.25, z: .925, halfX: 1.15, halfZ: 6.925 },
    { x: 10.15, z: .10, halfX: 2.81, halfZ: 8.1 },
  ];
  return {
    geometries, materials, colliders, overheads, walkAreas, floors, galleryStone, ready: Promise.all([halls.ready,lotus.ready,floors.ready]).then(()=>{}),
    dispose() { halls.dispose(); lotus.dispose(); floors.dispose(); },
    disturbWater(x: number, z: number, strength: number) {
      if (poolWaves.disturb(x, z, strength)) lotus.disturb(x, z, Math.min(1, strength));
    },
    update(time: number, delta: number, reducedMotion: boolean, eye: THREE.Vector3) {
      halls.updateGateLight(time, eye, reducedMotion);
      poolWaves.update(time, delta, reducedMotion);
      lotus.update(delta, reducedMotion);
    },
  };
}
