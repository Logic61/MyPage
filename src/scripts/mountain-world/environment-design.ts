import * as THREE from 'three';
import { createLotusPlanting } from './lotus-pond';
import { COURTYARD_POOL, FORECOURT_PLANTER, POOL_BED_Y, POOL_COPING_Y, POOL_WATER_Y, setPoolReflections } from './water-court';
import { createFloorFinishes } from './courtyard-paving';
import { buildTimberHalls } from './timber-halls';
import { buildCloudGallery } from './cloud-gallery';
import { buildPineUnderstory } from './pine-understory';
import { buildReedShades } from './reed-shades';
import { EAST_BRIDGE, GALLERY, HALL_STEPS, LIBRARY_ENTRY, NORTH_HALL_FRONT, NORTH_HALL_RISE, NORTH_HALL_SETBACK, TEA_PAVILION, VERANDA_RIM, WING } from './hall-terrace';
import { architecturalBlock, gridSurface } from './environment-geometry';
import type { SurfaceLibrary } from './materials';
import type { Collider, Overhead, WalkArea } from './types';

type Rect = { x0: number; x1: number; z0: number; z1: number };
const mirrorRect = (rect: Rect): Rect => ({ ...rect, x0: -rect.x1, x1: -rect.x0 });
type Opening = { from: number; to: number; bottom: number; top: number; lattice?: boolean; clearInset?: number; seat?: Collider };

/** Three inhabited wings surround an open court, rather than furnishing one undivided room. */
export function createStudyArchitecture(root: THREE.Group, library: SurfaceLibrary, en: boolean) {
  const group = new THREE.Group(); group.name = 'Cloud court — north study and two open wings'; root.add(group);
  const hallInterior = new THREE.Group();
  hallInterior.name = 'North study on its stone terrace';
  hallInterior.position.set(0, NORTH_HALL_RISE, -NORTH_HALL_SETBACK);
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
  const soil = own(library.material('ground', { worldScale: 2, roughness: .98, normalScale: .34 }));
  const waterMaterial = own(new THREE.MeshPhysicalMaterial({
    color: '#83ada6', vertexColors:true, roughness: .16, metalness: .09, transparent: true, opacity: .60,
    clearcoat: .63, clearcoatRoughness: .18, depthWrite: false, side: THREE.DoubleSide,
  }));
  const poolWaves = setPoolReflections(waterMaterial, NORTH_HALL_FRONT);
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
    const collider: Collider = { x, z: z + assembly.position.z, halfX, halfZ };
    colliders.push(collider);
    return collider;
  }
  function beam(a: THREE.Vector3, b: THREE.Vector3, width: number, depth: number, name: string, material: THREE.Material = joinery) {
    const delta = b.clone().sub(a), result = add(unitCube, material, name);
    result.position.copy(a).add(b).multiplyScalar(.5); result.scale.set(width, delta.length(), depth);
    result.quaternion.setFromUnitVectors(vUp, delta.normalize()); return result;
  }
  function post(x: number, z: number, top: number, width = .19, footing = .304) {
    box(width, top - footing, width, x, (top + footing) / 2, z, joinery, 'Timber column with a real bearing');
    box(width + .09, .12, width + .09, x, footing + .06, z, limestone, 'Low stone column foot', .012);
    obstacle(x, z, (width + .09) / 2 + .012, (width + .09) / 2 + .012);
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
        const alongOffset = axis === 'z' ? assembly.position.z : assembly.position.x;
        sill.window = { axis, from: alongOffset + opening.from + inset, to: alongOffset + opening.to - inset,
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
  function paving(rect: Rect, course: number, length: number, holes: Rect[] = [], finish: 'field' | 'threshold' | 'border' = 'field') {
    floorBase(rect,holes);
    floors.flags(group,rect,course,length,holes,finish);
  }
  function timberFloor(rect: Rect, parent: THREE.Object3D = group) {
    floorBase(rect,[],parent);
    floors.boards(parent,rect);
  }

  // The court sits at y=.3. The north hall floor and furnishings share the elevated terrace.
  timberFloor({ x0: -6.1, x1: 6.1, z0: -10, z1: -5.8 },hallInterior);
  const westWing = {x0:-WING.outer, x1:-WING.inner, z0:WING.north, z1:WING.south};
  timberFloor(westWing);
  timberFloor(mirrorRect(westWing));
  const rim = {x0:COURTYARD_POOL.x0-.16,x1:COURTYARD_POOL.x1+.16,z0:COURTYARD_POOL.z0-.16,z1:COURTYARD_POOL.z1+.16};
  const waterCentre = (COURTYARD_POOL.z0 + COURTYARD_POOL.z1) / 2;
  // Paths stay beside the water. At the head of the pond, a crosswalk turns out to either wing.
  const inner=COURTYARD_POOL.x1+1.07, outer=inner+1.97;
  const northWalk={x0:LIBRARY_ENTRY.jamb+.13,x1:-LIBRARY_ENTRY.jamb-.13,z0:WING.south,z1:GALLERY.south};
  const turn={x0:-outer,x1:outer,z0:COURTYARD_POOL.z1+.91,z1:9.19};
  const sideWalk={x0:-outer,x1:-inner,z0:northWalk.z1,z1:turn.z0};
  const walks: {rect:Rect; alongZ:boolean}[] = [
    {rect:{x0:-1.52,x1:1.52,z0:turn.z1,z1:12.87},alongZ:true},
    {rect:turn,alongZ:false}, {rect:sideWalk,alongZ:true}, {rect:mirrorRect(sideWalk),alongZ:true},
    {rect:northWalk,alongZ:false},
    {rect:{x0:outer,x1:6.35,z0:EAST_BRIDGE.z-.77,z1:EAST_BRIDGE.z+.77},alongZ:false},
  ];
  const reservations=walks.map(({rect})=>rect);
  paving({x0:-WING.outer,x1:WING.outer,z0:WING.south,z1:GALLERY.south},.52,1.49,reservations);
  paving({x0:-6.35,x1:6.35,z0:GALLERY.south,z1:8.4},.54,1.40,[rim,...reservations]);
  paving({x0:-5.99,x1:5.99,z0:8.4,z1:12.87},.64,1.76,[FORECOURT_PLANTER,mirrorRect(FORECOURT_PLANTER),...reservations]);
  for(const {rect,alongZ} of walks) {
    floorBase(rect);
    floors.flags(group,rect,.49,1.58,[],'walk',.304,alongZ);
  }
  paving({x0:-5.99,x1:5.99,z0:12.87,z1:13.17},.30,1.6,[],'threshold');
  for (const sign of [-1,1]) {
    const side = (r: Rect) => sign < 0 ? r : mirrorRect(r);
    paving(side({x0:-1.98,x1:-1.82,z0:13.17,z1:15.75}),1.18,.16,[],'border');
    paving(side({x0:-6.27,x1:-5.99,z0:8.4,z1:13.17}),1.12,.28,[],'border');
    // Shallow stone landings meet the ends of the elm decks beyond the south bank.
    paving(side({x0:-9.48,x1:-6.35,z0:8.29,z1:8.4}),.11,1.56,[],'threshold');
    paving(side({x0:-9.48,x1:-6.27,z0:8.4,z1:9.38}),.49,1.60);
    paving(side({x0:-9.48,x1:-6.27,z0:9.38,z1:9.58}),.20,1.60,[],'border');
    timberFloor(side({x0:-GALLERY.outerFloor,x1:-GALLERY.wall,z0:GALLERY.north,z1:GALLERY.south}));
    // Across the open pavilion approach the boards run in the direction of travel.
    const landing = side({x0:-VERANDA_RIM.inner,x1:-6.35,z0:GALLERY.south,z1:VERANDA_RIM.south});
    floorBase(landing);
    if (sign<0) floors.boards(group,landing,true);
    else {
      const z0=EAST_BRIDGE.z-EAST_BRIDGE.width/2, z1=EAST_BRIDGE.z+EAST_BRIDGE.width/2;
      floors.boards(group,{...landing,z1:z0},true);
      floors.flags(group,{...landing,z0,z1},.52,1.49,[],'threshold');
      floors.boards(group,{...landing,z0:z1},true);
    }
  }
  // A continuous cross-landing separates the side doors from the stairs.
  paving({x0:-VERANDA_RIM.inner,x1:VERANDA_RIM.inner,z0:NORTH_HALL_FRONT,z1:GALLERY.north},.50,1.40);
  paving({x0:-WING.outer,x1:WING.outer,z0:GALLERY.north,z1:WING.north},.50,1.40);
  const flower = {x0:-1.08,x1:1.08,z0:-3.55,z1:-1.39};
  paving({x0:-WING.inner,x1:WING.inner,z0:WING.north,z1:WING.south},.55,1.66,[flower]);
  floors.flowerPanel(group,0,(flower.z0+flower.z1)/2,flower.x1-flower.x0);
  paving({x0:-1.82,x1:1.82,z0:13.17,z1:15.75},.50,1.38);
  for (const x of [-WING.inner,WING.inner]) box(.095,.018,WING.south-WING.north,x,.294,(WING.north+WING.south)/2,
    joinery,'Flush inner-gallery edge board',.002).castShadow=false;

  const waterW = COURTYARD_POOL.x1 - COURTYARD_POOL.x0, waterD = COURTYARD_POOL.z1 - COURTYARD_POOL.z0;
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
  lotus.plant(-1.40,COURTYARD_POOL.z0+1.04,-1,-.37,.97);
  lotus.plant(-.78,COURTYARD_POOL.z0+.73,1,.95,.66);
  lotus.plant(1.30,COURTYARD_POOL.z0+3.12,1,-.45,1.08);
  lotus.plant(.47,COURTYARD_POOL.z0+3.33,-1,.86,.75);
  lotus.plant(1.47,COURTYARD_POOL.z0+.74,1,.44,.64);
  lotus.finish();
  for (const planter of [FORECOURT_PLANTER,mirrorRect(FORECOURT_PLANTER)]) {
    const x=(planter.x0+planter.x1)/2,z=(planter.z0+planter.z1)/2,w=planter.x1-planter.x0,d=planter.z1-planter.z0;
    box(w,.065,d,x,.305,z,soil,'Pine bed',.01);
    for (const side of [-1,1]) {
      const course=d/3;
      for (let bay=0;bay<3;bay++) {
        box(.14,.15,course-.007,x+side*(w/2-.07),.367,z-d/2+(bay+.5)*course,limestone,'Dressed pine-bed curb',.012);
      }
      box(w-.29,.15,.14,x,.367,z+side*(d/2-.07),limestone,'Dressed pine-bed curb',.012);
    }
    obstacle(x,z,w/2+.01,d/2+.01);
  }

  // A single flight meets a full-width ashlar porch. The side flights serve the window seats.
  const {halfWidth, stairHalf, cheek, rear, front, tread, riser, count} = HALL_STEPS;
  const top = .3 + NORTH_HALL_RISE, depth = front - rear, midZ = (rear + front) / 2;
  const toe = front + (count-1) * tread, sideToe = halfWidth + (count-1) * tread;
  box(2*halfWidth,NORTH_HALL_RISE-.014,depth,0,.3+(NORTH_HALL_RISE-.014)/2,midZ,
    sidePaving,'Solid ashlar body of the hall terrace');
  floors.flags(group,{x0:-halfWidth,x1:halfWidth,z0:NORTH_HALL_FRONT,z1:front-.25},.51,1.54,[],'threshold',top+.004);
  floors.flags(group,{x0:-halfWidth,x1:halfWidth,z0:rear,z1:-10-NORTH_HALL_SETBACK},.19,1.32,[],'border',top+.004);
  // Carry the paving under the side windows and the full bases of the outermost hall posts.
  for (const side of [-1,1]) {
    const a=side*6.1, b=side*halfWidth;
    floors.flags(group,{x0:Math.min(a,b),x1:Math.max(a,b),z0:-10-NORTH_HALL_SETBACK,z1:NORTH_HALL_FRONT},1.30,.38,[],'border',top+.004);
  }
  for (let step=1;step<count;step++) {
    const run=(count-step)*tread, y=.3+step*riser;
    const edge=front+run;
    box(2*stairHalf,y-.3-.012,tread,0,(y+.3-.012)/2,edge-tread/2,sidePaving,'Bed of the central stair tread');
    const joints=step%2 ? [-stairHalf,-.73,.73,stairHalf] : [-stairHalf,-1.45,0,1.45,stairHalf];
    for (let j=1;j<joints.length;j++) {
      const a=joints[j-1], b=joints[j];
      box(b-a-.005,.074,tread+.012,(a+b)/2,y-.037,edge-tread/2,limestone,'Dressed axial stair nosing',.008);
    }
    for (const side of [-1,1]) {
      const x=side*(halfWidth+run-tread/2);
      box(tread,y-.3-.012,depth,x,(y+.3-.012)/2,midZ,sidePaving,'Bed of the lateral stair tread');
      const bays=Math.ceil(depth/1.25), length=depth/bays;
      for (let i=0;i<bays;i++) box(tread+.012,.074,length-.005,x,y-.037,rear+length*(i+.5),
        limestone,'Dressed lateral stair nosing',.008);
    }
  }
  const landingStones=Math.ceil(halfWidth*2/1.28), capWidth=halfWidth*2/landingStones;
  for (let i=0;i<landingStones;i++) box(capWidth-.005,.095,.256,-halfWidth+capWidth*(i+.5),top-.0435,
    front-.124,limestone,'Bevelled leading stones of the porch landing',.008);
  // The sloping cheek is one solid stone, with its toe resting on the same flags as the wings.
  const cheekSide=new THREE.Shape();
  cheekSide.moveTo(-.11,.0); cheekSide.lineTo(toe-front+.15,0);
  cheekSide.lineTo(toe-front+.15,.16); cheekSide.lineTo(.02,NORTH_HALL_RISE+.075);
  cheekSide.lineTo(-.11,NORTH_HALL_RISE+.075); cheekSide.closePath();
  const cheekGeo=keep(new THREE.ExtrudeGeometry(cheekSide,{depth:cheek-.012,bevelEnabled:true,
    bevelThickness:.006,bevelSize:.006,bevelSegments:1}));
  cheekGeo.translate(0,0,-(cheek-.012)/2); cheekGeo.rotateY(-Math.PI/2);
  for (const side of [-1,1]) {
    const x=side*(stairHalf+cheek/2);
    add(cheekGeo,limestone,'Solid sloping cheek of the axial stair',x,.3,front);
    obstacle(x,(front+toe+.04)/2,cheek/2,(toe+.26-front)/2);
    const outer=halfWidth, inner=stairHalf+cheek;
    // Two bonded courses and a projecting coping show the true height of the retaining wall.
    for (let row=0;row<2;row++) {
      const unit=1.34, offset=row*.50*unit;
      for (let a=inner-offset;a<outer;a+=unit) {
        const lo=Math.max(inner,a), hi=Math.min(outer,a+unit);
        if (hi-lo<.018) continue;
        box(hi-lo-.006,.248,.064,side*(lo+hi)/2,.435+row*.251,front+.019,
          sidePaving,'Bonded ashlar face of the porch',.004);
      }
    }
    obstacle(side*(inner+sideToe)/2,front+.018,(sideToe-inner)/2,.031);
  }
  obstacle(0,rear,sideToe,.038);

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
  const wingDoor = GALLERY.door;
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
  archiveWall('z',-WING.outer,WING.north,WING.south,3.47,wingDoor);
  const entry=LIBRARY_ENTRY;
  archiveWall('x',entry.front,entry.west,entry.jamb,3.16);
  archiveWall('z',entry.jamb,entry.returnEnd,entry.front,3.16);
  // The old plaster screen returns beside the cabinet, exposing its book spines along the pond walk.
  const clearStart=entry.jamb+.11, clearEnd=entry.east-.13, entryFace=entry.front-.04;
  horizontal(clearStart,clearEnd,.304,entryFace,'x',limestone,'Flush stone sill of the library porch',.012,.28).castShadow=false;
  horizontal(clearStart,clearEnd,2.67,entryFace,'x',archiveElm,'Recessed opening head',.085,.15);
  for (let i=0;i<6;i++) {
    const x=clearStart+(i+.5)*(clearEnd-clearStart)/6;
    box(.032,.24,.056,x,2.828,entryFace,joinery,'Upright in the library transom',.003);
  }
  horizontal(clearStart,clearEnd,2.942,entryFace,'x',archiveElm,'Library transom top rail',.045,.12);
  wall('z',WING.outer,WING.north,WING.south,3.47,[
    wingDoor, {from:-3.12,to:.46,bottom:1.07,top:2.96,lattice:true},
  ]);
  for (const sign of [-1, 1]) {
    // The additional timber cheeks at this opening leave .62 m clear on each side of its centre.
    if (sign > 0) wall('x', WING.south, WING.inner, WING.outer, 3.16, [
      { from: WING.inner+.43, to: WING.outer-.43, bottom: 1.02, top: 2.82, lattice: true, clearInset: .40 },
    ]);
    for (const z of [-5.73, -4.22, .52]) {
      post(sign*WING.inner,z,3.08,.17);
      beam(new THREE.Vector3(sign*WING.inner,3.07,z),new THREE.Vector3(sign*(WING.outer-.08),3.39,z),.13,.15,'Visible gallery cross beam');
    }
    box(.20,.17,WING.south-WING.north+.10,sign*WING.inner,3.07,(WING.north+WING.south)/2,joinery,'Continuous open-gallery bearing beam');
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
    for (const z of GALLERY.bents) {
      beam(new THREE.Vector3(sign*GALLERY.innerPost,3.21,z),new THREE.Vector3(sign*GALLERY.outerPost,3.07,z),.12,.16,'Covered walk cross beam');
    }
    post(sign*GALLERY.innerPost,GALLERY.bents[0],3.19,.16);
    post(sign*GALLERY.innerPost,GALLERY.bents[3],3.19,.16);
    const span = GALLERY.south-GALLERY.north-.46, midZ = (GALLERY.north+GALLERY.south)/2;
    box(.17,.16,span,sign*GALLERY.innerPost,3.19,midZ,joinery,'Inner gallery plate');
    box(.19,.19,span,sign*GALLERY.outerPost,3.06,midZ,joinery,'Outer gallery plate');
  }
  const halls = buildTimberHalls(group, { timber: joinery, stone: limestone, sideStone: sidePaving, plaster, archivePlaster, soffit }, obstacle, en);
  const gallery = buildCloudGallery(group,library,geometries,materials,colliders);
  const understory = buildPineUnderstory(group,library,geometries,materials,gallery,soil);
  buildReedShades(group,library,geometries,materials);
  // Capture the undersides before scenery is batched. Jumping never raycasts the roof tiles.
  const headPieces = new Set(['Recessed opening head', 'Painted lintel frame', 'Carved plaque backing', '留云阁', 'Recessed central lintel',
    'Continuous open-gallery bearing beam', 'Visible gallery cross beam', 'Covered walk cross beam',
    'Inner gallery plate', 'Outer gallery plate', 'Weighted roll at the foot of a bamboo blind',
    'Elm tie beam across the pavilion bay','Rebated moulding below an open bay','Timber knee below the tea cornice']);
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
    { x: 0, z: midZ, halfX: sideToe, halfZ: depth/2 },
    { x: 0, z: -7.9 - NORTH_HALL_SETBACK, halfX: 6.1, halfZ: 2.1 },
    { x:0, z:(NORTH_HALL_FRONT+VERANDA_RIM.north)/2, halfX:VERANDA_RIM.inner, halfZ:(VERANDA_RIM.north-NORTH_HALL_FRONT)/2 },
    { x:0, z:(VERANDA_RIM.north+GALLERY.south)/2, halfX:VERANDA_RIM.outer, halfZ:(GALLERY.south-VERANDA_RIM.north)/2 },
    { x: 0, z: 4.5, halfX: 6.35, halfZ: 3.9 },
    { x: 0, z: (8.20+9.58)/2, halfX: 9.48, halfZ: (9.58-8.20)/2 },
    { x: 0, z: (8.4+13.17)/2, halfX: 6.27, halfZ: (13.17-8.4)/2 },
    { x: 0, z: (13.17+15.75)/2, halfX: 1.98, halfZ: (15.75-13.17)/2 },
    { x: 0, z: 23.875, halfX: 1.65, halfZ: 8.125 },
    { x: 0, z: 34, halfX: 4.2, halfZ: 4.2, shape: 'ellipse' },
    { x: (EAST_BRIDGE.landing + EAST_BRIDGE.end) / 2, z: EAST_BRIDGE.z, halfX: (EAST_BRIDGE.end - EAST_BRIDGE.landing) / 2, halfZ: EAST_BRIDGE.width / 2 },
    { x: 26, z: 5, halfX: 4.3, halfZ: 4.3, shape: 'ellipse' },
    { x:(TEA_PAVILION.apron.x0+TEA_PAVILION.apron.x1)/2,z:(TEA_PAVILION.apron.z0+TEA_PAVILION.apron.z1)/2,
      halfX:(TEA_PAVILION.apron.x1-TEA_PAVILION.apron.x0)/2,halfZ:(TEA_PAVILION.apron.z1-TEA_PAVILION.apron.z0)/2 },
  ];
  for (const side of [-1,1]) {
    walkAreas.push({x:side*(6.35+VERANDA_RIM.pavilionEdge)/2,z:(GALLERY.south+VERANDA_RIM.south)/2,
      halfX:(VERANDA_RIM.pavilionEdge-6.35)/2,halfZ:(VERANDA_RIM.south-GALLERY.south)/2});
  }
  return {
    geometries, materials, colliders, overheads, walkAreas, floors, galleryStone: gallery.crag, pineStone: understory.stone,
    ready: Promise.all([halls.ready,lotus.ready,floors.ready,understory.ready]).then(()=>{}),
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
