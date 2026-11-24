import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import * as shapes from '../src/scripts/mountain-world/environment-geometry.ts';
import { createNavigation } from '../src/scripts/mountain-world/navigation.ts';
import { AerialMotion, STANDING_HEAD } from '../src/scripts/mountain-world/aerial-motion.ts';
import { createInteractionPicker } from '../src/scripts/mountain-world/first-person.ts';
import * as terrace from '../src/scripts/mountain-world/hall-terrace.ts';

// Exercise the production geometry without a GPU. Only lettering and optional images need a DOM.
function loadModule(file, imports) {
  const source = fs.readFileSync(new URL('../src/scripts/mountain-world/'+file+'.ts',import.meta.url),'utf8')
    .replaceAll('import.meta.env?.BASE_URL', "'/MyPage/'");
  const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {}, ink = new Proxy({}, { get:()=>()=>ink });
  vm.runInNewContext(code,{
    exports,require:id=>{ assert.ok(id in imports,id); return imports[id]; },
    document:{ createElement:()=>({getContext:()=>ink}) },
    Image:class { set src(_url) { this.onerror?.(); } },
  });
  return exports;
}
const three = {...THREE,TextureLoader:class { async loadAsync(){return new THREE.Texture();} }};
const roof = loadModule('tiled-roof',{three,'./environment-geometry':shapes});
const stoneRail = loadModule('stone-balustrade',{three});
const goSetting = loadModule('go-pavilion',{three,'./environment-geometry':shapes});
const gateData = JSON.parse(fs.readFileSync(new URL('../src/assets/gate-posts.json',import.meta.url),'utf8'));
const gatePost = loadModule('inscribed-post',{three,'../../assets/gate-posts.json':{default:gateData}});
const halls = loadModule('timber-halls',{three,'./environment-geometry':shapes,'./tiled-roof':roof,'./stone-balustrade':stoneRail,'./hall-terrace':terrace,'./go-pavilion':goSetting,'./inscribed-post':gatePost});
const waterCourt = loadModule('water-court',{});
const lotus = loadModule('lotus-pond',{three,'./environment-geometry':shapes,'./water-court':waterCourt});
const paving = loadModule('courtyard-paving',{three,'./environment-geometry':shapes});
const gallery=loadModule('cloud-gallery',{three,'./environment-geometry':shapes,'three/addons/objects/MarchingCubes.js':{MarchingCubes}});
const { createStudyArchitecture } = loadModule('environment-design',{three,'./reed-shades':loadModule('reed-shades',{three}),'./environment-geometry':shapes,'./timber-halls':halls,'./lotus-pond':lotus,'./stone-balustrade':stoneRail,'./hall-terrace':terrace,'./courtyard-paving':paving,'./water-court':waterCourt,'./cloud-gallery':gallery});
const origin = {x:0,z:34};

test('the furnished wings and terraces preserve clear sightlines, solid walls and walkable approaches', async () => {
  const ink = loadModule('furnishing-ink',{three});
  const design = loadModule('furnishing-design',{three});
  const { createFurnishings } = loadModule('furnishings',{three,'./furnishing-ink':ink,'./furnishing-design':design,'./court-beacon':loadModule('court-beacon',{three}),
    './water-court':waterCourt,'./hall-terrace':terrace,'./materials':{},'three/addons/utils/BufferGeometryUtils.js':{mergeGeometries}});
  const scene = new THREE.Scene(), library = { material:()=>new THREE.MeshStandardMaterial() };
  const site = createStudyArchitecture(scene,library,false), furnishings = createFurnishings(scene,false,library);
  try {
    const cedar = scene.getObjectByName('Lacquered timber pillar').material;
    const maps = [cedar.map, cedar.normalMap, cedar.roughnessMap], version = cedar.version;
    assert.deepEqual(maps.map(tex => [...tex.image.data]), [[255,255,255,255],[128,128,255,255],[255,255,255,255]]);
    assert.deepEqual(maps.map(tex => tex.colorSpace), [THREE.SRGBColorSpace, THREE.NoColorSpace, THREE.NoColorSpace]);
    await Promise.all([site.ready,furnishings.assetsReady]);
    const first = scene.getObjectByName('青山流云皆入境'), second = scene.getObjectByName('旧忆新知尽成篇');
    assert.ok(first.position.x > 0 && second.position.x < 0);
    for (const pillar of [first, second]) {
      assert.equal(pillar.material.map, cedar.map);
      assert.equal(pillar.material.transparent, false);
      const surface = pillar.geometry.attributes.position;
      pillar.updateWorldMatrix(true, false);
      let deepest = 0, sample;
      for (let i = 0; i < surface.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(surface, i);
        if (Math.abs(v.y) >= 1.05) continue;
        const depth = .19 * (1 - .07 * (v.y / 2.11 + .5)) - Math.hypot(v.x, v.z);
        assert.ok(depth >= -1e-6, 'The shaft has no raised lettering');
        if (depth > deepest) { deepest = depth; sample = v; }
      }
      assert.ok(deepest > .0065 && deepest < .0071, 'The strokes are recessed into the round shaft');
      const inward = new THREE.Vector3(-sample.x, 0, -sample.z).normalize();
      // Offset from a shared vertex into the neighbouring face before raycasting the whole hall.
      const origin = sample.clone().add(pillar.position).addScaledVector(inward, -.1);
      origin.y += .0001;
      const [hit] = new THREE.Raycaster(origin,inward,0,.11).intersectObject(pillar.parent,true);
      assert.ok(hit?.object === pillar, 'The approach ray hits the carved pillar itself');
      assert.ok(Math.abs(hit.distance - .1) < .001, 'The first visible surface is the groove floor');
    }
    const eye = new THREE.Vector3(0, 1.98, 34);
    site.update(0, 0, false, eye);
    const farLight = first.material.emissiveIntensity;
    eye.z = 15;
    site.update(1.75, 0, false, eye);
    const peak = first.material.emissiveIntensity;
    site.update(5.25, 0, false, eye);
    assert.ok(farLight < first.material.emissiveIntensity && first.material.emissiveIntensity < peak);
    site.update(1.75, 0, true, eye);
    const stillLight = first.material.emissiveIntensity;
    site.update(5.25, 0, true, eye);
    assert.equal(first.material.emissiveIntensity, stillLight);
    assert.equal(cedar.version, version, 'Photographs must keep the precompiled colour, normal and roughness variant');
    assert.notEqual(cedar.map, maps[0]); assert.notEqual(cedar.normalMap, maps[1]); assert.notEqual(cedar.roughnessMap, maps[2]);
    scene.updateMatrixWorld(true);
    const books = furnishings.interactions.find(item=>item.id==='books');
    const cabinet = new THREE.Box3().setFromObject(books.meshes[0],true);
    const { front, tread, count } = terrace.HALL_STEPS;
    const firstTread = front + (count - 1) * tread;
    assert.ok(cabinet.min.z - firstTread >= .65, 'At least 65 cm of clearance between the cabinet and the first stone tread');
    assert.equal(terrace.hallRiseAt(cabinet.min.x,cabinet.min.z),0);
    assert.ok(cabinet.min.x > -6.1 + .14 && cabinet.max.z < .6 - .14, 'Cabinet clears the inner plaster faces');
    const nav = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders]);
    const crossingNav = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders],.32,
      [[-8,-11],[8,-11],[8,2],[-8,2]],site.overheads);
    for (const [x,z,yaw,normal,plane] of [
      [4.65,1.27,0,'z',.6], [6.77,-1.05,Math.PI/2,'x',6.1],
      [4.54,-8.02,-Math.PI/2,'x',6.1], [-4.54,-8.02,Math.PI/2,'x',-6.1],
    ]) {
      const p = { x,z };
      for (const facing of [yaw, yaw + Math.PI]) {
        assert.equal(crossingNav.canWalk(p.x,p.z),true);
        const pass = crossingNav.findVault(p,facing);
        assert.ok(pass,`Window at ${x},${z} works in direction ${facing}`);
        assert.equal(crossingNav.clearLine(p,pass.landing),false,'Walking alone cannot cross a window');
        const motion = new AerialMotion();
        motion.vault(p,.3+terrace.walkRiseAt(p.x,p.z),pass,.3+terrace.walkRiseAt(pass.landing.x,pass.landing.z));
        while (motion.kind === 'vault') {
          motion.advanceVault(p,1/120);
          if (Math.abs(p[normal]-plane) < .21) {
            assert.ok(motion.feet >= pass.sillTop,'Feet clear the sill during the crossing');
            assert.ok(motion.feet+STANDING_HEAD-motion.eyeLowering < crossingNav.ceilingAt(p.x,p.z),'Head clears the lintel');
          }
        }
        assert.deepEqual(p, pass.landing);
      }
    }
    assert.equal(crossingNav.findVault({x:6.77,z:-2.8},Math.PI/2),null,'The instrument table blocks the east-window landing');
    assert.equal(crossingNav.findVault({x:-5.45,z:-1.65},Math.PI/2),null,'The archive wall is solid');
    assert.equal(crossingNav.findVault({x:4.65,z:1.27},Math.PI),null,'Looking away cannot trigger a vault');
    for (const doorX of [-6.1,6.1]) {
      const doorZ = -4.65, floor = .3+terrace.walkRiseAt(doorX,doorZ);
      const ceiling = crossingNav.ceilingAt(doorX,doorZ);
      assert.ok(ceiling < 2.89 && ceiling > floor+STANDING_HEAD);
      const airborne = new AerialMotion();
      airborne.jump(floor);
      for (let i=0;i<40;i++) {
        airborne.advanceJump(1/120,floor,ceiling);
        assert.ok(airborne.feet+STANDING_HEAD <= ceiling+.00001);
      }
      const near = {x:doorX-Math.sign(doorX)*.8,z:doorZ};
      const blocked = crossingNav.move(near, Math.sign(doorX)*1.6,0,true,ceiling+.03);
      assert.ok((blocked.x-doorX)*Math.sign(doorX) < 0,'A jump alongside the doorway cannot enter the lintel sideways');
    }
    assert.equal(nav.canWalk(books.meshes[0].position.x, books.meshes[0].position.z),false);
    const plasters = scene.getObjectsByProperty('name','Solid lime-plaster wall with depth');
    for (const [x,z,dx,dz] of [[-5.25,-3.72,-1,0],[-5.25,-1.1,-1,0],[-4.8,-.36,0,1]]) {
      for (const y of [.63,1.85,2.62]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,0,dz),0,1.16);
        assert.ok(ray.intersectObjects(plasters,false).length, 'Solid masonry remains beside the door and behind the cabinet');
      }
      assert.equal(nav.clearLine({x,z},{x:x+dx*1.3,z:z+dz*1.3}),false);
    }
    const thresholds = scene.getObjectsByProperty('name','Flush door threshold');
    for (const side of [-1,1]) {
      const threshold = thresholds.find(mesh=>Math.abs(mesh.position.x-side*6.1)<.001);
      assert.ok(threshold && Math.abs(threshold.position.z+4.88)<.001, 'Paired thresholds align across the courtyard');
      for (const z of [-5.08,-4.88,-4.63]) {
        const inside={x:side*5.25,z}, outside={x:side*7.35,z};
        assert.ok(nav.clearLine(inside,outside) && nav.clearLine(outside,inside), 'The side gallery door fits the player from either side');
        const eye=1.98+terrace.walkRiseAt(side*6.1,z);
        const ray=new THREE.Raycaster(new THREE.Vector3(inside.x,eye,z),new THREE.Vector3(side,0,0),0,2.1);
        assert.equal(ray.intersectObject(scene,true).length,0,'No panelling or furnishing bridges the doorway at eye height');
      }
    }
    const route = nav.findPath(origin,books.approach);
    assert.ok(route.length && Math.hypot(route.at(-1).x-books.approach.x,route.at(-1).z-books.approach.z)<.02);
    const camera = new THREE.PerspectiveCamera(67,1,.055,230);
    camera.position.set(books.approach.x,1.98,books.approach.z); camera.lookAt(books.position); camera.updateMatrixWorld();
    assert.equal(createInteractionPicker([scene],furnishings.interactions).pick(camera)?.id,'books');
    assert.ok(nav.clearLine({x:-7.55,z:.25},{x:-7.55,z:-3.8}),'The rock trough leaves the walking lane open');
    assert.equal(nav.canWalk(-6.64,-1.87),false);
    const rock=scene.getObjectByName('Double-perforated Taihu scholar stone');
    const ray=new THREE.Raycaster(), axis=new THREE.Vector3(1,0,0).transformDirection(rock.matrixWorld);
    function throughRock(y,z) {
      ray.set(rock.localToWorld(new THREE.Vector3(-1,y,z)),axis);
      return ray.intersectObject(rock,false);
    }
    assert.equal(throughRock(.29*.82,.089*.62).length,0,'The upper limestone tunnel is open all the way through');
    assert.equal(throughRock(-.25*.82,-.088*.62).length,0,'The lower tunnel is also open');
    assert.ok(throughRock(.02,0).length,'Solid rock connects the two holes');
    const ridges=scene.getObjectsByProperty('name','Closed ridge purlin');
    for (const z of [-3.7,.95,5.9]) {
      ray.set(new THREE.Vector3(-7.28,1.98,z),new THREE.Vector3(0,1,0));
      assert.ok(ray.intersectObjects(ridges,false).length,'The roof closes above the gallery walking lane');
    }
    const picker=createInteractionPicker([scene],furnishings.interactions);
    for(const item of furnishings.interactions.filter(i=>['about','projects','bench','lantern','east-lantern'].includes(i.id))) {
      const stop=nav.findPath(origin,item.approach).at(-1);
      assert.ok(stop && Math.hypot(stop.x-item.approach.x,stop.z-item.approach.z)<.02,item.id+' approach');
      camera.position.set(item.approach.x,1.98+terrace.walkRiseAt(item.approach.x,item.approach.z),item.approach.z);
      camera.lookAt(item.position); camera.updateMatrixWorld();
      assert.equal(picker.pick(camera)?.id,item.id);
    }
    assert.ok(nav.clearLine({x:-3.6,z:1.15},{x:3.6,z:1.15}),'Both rear lantern plinths leave the north crosswalk clear');
    const coping=new THREE.Box3();
    for(const stone of scene.getObjectsByProperty('name','Stone pool coping')) coping.expandByObject(stone,true);
    const lanterns=scene.getObjectsByProperty('name','Courtyard stone lantern');
    assert.equal(lanterns.length,4);
    for(const lantern of lanterns){
      const plinth=new THREE.Box3();
      for(const mesh of lantern.children.filter(child=>child.isMesh)) plinth.expandByObject(mesh,true);
      assert.ok(!plinth.isEmpty() && (plinth.min.x>coping.max.x+.003||plinth.max.x<coping.min.x-.003),'The actual stone plinth and coping have a visible joint');
    }
    for(const side of [-1,1]){
      for(const x of [3.35,3.8,4.25]) assert.ok(nav.clearLine({x:side*x,z:1.15},{x:side*x,z:7.05}),'A full visitor fits across the breadth of each poolside walk');
      for(const z of [6.62,6.65,6.68]) assert.ok(nav.clearLine({x:0,z},{x:side*8.7,z}),'Both exits beyond the front corner lanterns stay open');
      assert.ok(nav.clearLine({x:side*3.6,z:7.05},{x:0,z:7.05}));
    }
    const panelling=[...scene.getObjectsByProperty('name','Lining stile'),...scene.getObjectsByProperty('name','Lining rail')];
    assert.ok(panelling.length);
    for(const [name,stileOffset] of [['North wall poetic inscription',-.12],['North wall host biography scroll',.14]]) {
      const scroll=scene.getObjectByName(name);
      for(const x of [-.45,stileOffset,.45]) for(const y of [-.62,0,.80]) {
        ray.set(scroll.localToWorld(new THREE.Vector3(x,y,.65)),new THREE.Vector3(0,0,-1));
        assert.equal(ray.intersectObjects([...panelling,...scroll.children],false)[0]?.object.parent,scroll,'Painted silk must sit in front of the wall joinery');
      }
    }
  } finally {
    furnishings.dispose(); site.dispose();
    site.geometries.forEach(g=>g.dispose()); site.materials.forEach(m=>m.dispose());
    scene.traverse(node=>{if(node.isInstancedMesh)node.dispose()});
  }
});

test('hall stair eye height follows each tread from the court and the side aisles', () => {
  const { count, front, halfWidth, tread, riser } = terrace.HALL_STEPS;
  for (let i = 0; i <= count; i++) {
    const outward = (count - i) * tread;
    assert.ok(Math.abs(terrace.hallRiseAt(0, front + outward) - i * riser) < 1e-8);
    assert.ok(Math.abs(terrace.hallRiseAt(halfWidth + outward, -7) - i * riser) < 1e-8);
  }
  assert.equal(terrace.hallRiseAt(3.68, -7.46), terrace.NORTH_HALL_RISE);
  assert.equal(terrace.hallRiseAt(0, 34), 0);
  const {x,z,steps}=terrace.SUN_DAIS;
  assert.equal(terrace.walkRiseAt(x-3.4,z),0,'Level east bridge landing');
  assert.ok(Math.abs(terrace.walkRiseAt(x,z)-(steps[2].top-.3))<1e-8,'Visitor stands on the top inlaid stones');
  for(let i=0;i<36;i++) {
    const a=terrace.walkRiseAt(x-3.3+i*.03,z),b=terrace.walkRiseAt(x-3.27+i*.03,z);
    assert.ok(b>=a-1e-9 && b-a<.011,'No camera snap on any of the circular treads');
  }
});

test('entrance, hall and mirror-paired roofs share the built courtyard axis',async () => {
  const root=new THREE.Group(), site=createStudyArchitecture(root,{material:()=>new THREE.MeshStandardMaterial()},false);
  await site.ready;
  try {
    root.updateMatrixWorld(true);
    function bounds(name) {
      return root.getObjectsByProperty('name',name).map(group=>{
        const box=new THREE.Box3();
        for(const tile of group.getObjectsByProperty('name','Glazed pan and cover tiles'))
          box.expandByObject(tile,true);
        return box;
      });
    }
    for (const name of ['Southern mountain gate','North hall lower eaves','North hall upper roof']) {
      const [box]=bounds(name);
      assert.ok(Math.abs(box.min.x+box.max.x)<1e-4,name);
    }
    const [portal] = bounds('Southern mountain gate');
    assert.ok(portal.min.z > 12 && portal.max.z < 14.5,'The portal stands at the stone bridgehead');
    const pairs=[...['Covered hillside gallery','Six-sided cloud pavilion'].map(name=>bounds(name)),
      [...bounds('Library roof'),...bounds('Instrument hall roof')]];
    for (const pair of pairs) {
      assert.equal(pair.length,2);
      const [west,east]=pair.sort((a,b)=>a.min.x-b.min.x);
      assert.ok(Math.abs(west.max.x+east.min.x)<1e-4 && Math.abs(west.min.x+east.max.x)<1e-4);
      for (const axis of ['z','y']) for(const bound of ['min','max']) assert.ok(Math.abs(west[bound][axis]-east[bound][axis])<1e-4);
    }
    // The bounds alone cannot catch an extra rafter or an off-centre row of tile ends.
    const position = new THREE.Vector3(), instance = new THREE.Matrix4();
    const key = (x,y,z) => [x,y,z].map(n => Math.round(n * 1000)).join(',');
    for (const name of ['Round clay tile ends', 'Splayed eave rafters']) {
      const points = new Set();
      for (const row of root.getObjectsByProperty('name', name)) {
        for (let i=0; i<row.count; i++) {
          row.getMatrixAt(i,instance);
          position.setFromMatrixPosition(instance.premultiply(row.matrixWorld));
          points.add(key(position.x,position.y,position.z));
        }
      }
      assert.ok(points.size > 300);
      for (const value of points) {
        const [x,y,z] = value.split(',');
        assert.ok(points.has([-Number(x),y,z].join(',')), name+' at '+value);
      }
    }
    const nav=createNavigation(site.walkAreas,site.colliders);
    for(let z=origin.z;z>=6.7;z-=.125) assert.ok(nav.canWalk(0,z),'Open bridge and gate at '+z);
    assert.equal(root.getObjectsByProperty('name','Open reflecting pool').length,1);
    const middle = {x:0,z:3.75}, northBank = {x:0,z:.7}, southBank = {x:0,z:7.15};
    for (const bank of [northBank,southBank,{x:-3.6,z:3.75},{x:3.6,z:3.75}]) {
      assert.ok(nav.clearLine(bank,middle) && nav.clearLine(middle,bank), 'Every bank joins the shallow pond bed');
    }
    const onPaving = (x,z) => waterCourt.poolFloorAt(x,z) === null;
    const bypass = nav.findPath(southBank,northBank,onPaving);
    assert.ok(bypass.length >= 2 && bypass.every((p,i)=>nav.clearLine(i ? bypass[i-1] : southBank,p,onPaving)),
      'Map guidance still takes the stone paths between dry destinations');
    assert.deepEqual(nav.findPath(middle,northBank,onPaving),[northBank], 'Guidance can lead a wading visitor out');
    assert.equal(nav.hasFloor(1.7,24), false, 'Open chasm beside the south bridge');
    assert.equal(nav.hasFloor(3.8,37.8), false, 'Landing edge follows the circular stone platform');
    assert.equal(nav.hasFloor(18,6), false, 'Air beside the east bridge');
    assert.equal(nav.hasFloor(30,9), false, 'The terrace has no invisible square corners');
    assert.ok(nav.clearLine({x:14,z:5},{x:25.2,z:5}), 'East bridge joins the sunwheel terrace');
    for(const side of [-1,1]) {
      assert.ok(nav.clearLine({x:0,z:7.05},{x:side*3.6,z:7.05}),'South paving divides into two walks');
      assert.ok(nav.clearLine({x:side*3.6,z:7.05},{x:side*3.6,z:1.15}),'Both long poolside paths stay open');
      assert.ok(nav.clearLine({x:side*3.6,z:1.15},{x:0,z:1.15}),'North crosswalk reunites the two routes');
      for (const offset of [.7,1.35,2.05]) {
        let p={x:side*offset,z:.42};
        for (let i=0;i<100;i++) p=nav.move(p,0,-.055);
        assert.ok(p.z < -5,'Walking beside the centreline stays clear');
      }
      assert.ok(nav.clearLine({x:-3.7,z:-2.55},{x:3.7,z:-2.55}),'Unbroken crossing between the wings');
      assert.ok(nav.clearLine({x:side*3.2,z:6.65},{x:side*8.7,z:6.65}),'A clear side gate beyond the planter');
      const lamp=waterCourt.POOL_LAMP;
      for(const end of [{x:side*10.18,z:3.10},{x:side*4.65,z:-3.2},{x:side*lamp.approachX,z:lamp.approachZ}]) {
        assert.ok(nav.canWalk(end.x,end.z));
        const path=nav.findPath(origin,end);
        assert.ok(path.length && Math.hypot(path.at(-1).x-end.x,path.at(-1).z-end.z)<.01);
      }
    }
  } finally {
    site.dispose(); site.geometries.forEach(g=>g.dispose()); site.materials.forEach(m=>m.dispose());
    root.traverse(node=>{if(node.isInstancedMesh)node.dispose()});
  }
});

test('a local ripple bends connected lotus shoots, leaves distant flowers still and settles exactly', async () => {
  const parent = new THREE.Group(), geometries = new Set(), materials = new Set();
  const bed = lotus.createLotusPlanting(parent,geometries,materials);
  try {
    bed.plant(0,3,1,0,1);
    bed.plant(2,5,-1,.3,.9);
    bed.finish();
    const blade = [...materials].find(material => material.name === 'Waxy lotus blade');
    const neutral = blade.map, shaderVersion = blade.version;
    assert.equal(neutral.image.width, 1);
    let released = false; neutral.addEventListener('dispose', () => { released = true; });
    await bed.ready;
    assert.equal(released, true);
    assert.notEqual(blade.map, neutral);
    assert.equal(blade.version, shaderVersion, 'Replacing the neutral leaf image keeps the compiled shader');
    const planting = parent.children[0], batches = planting.children;
    assert.ok(planting.userData.pondPlant && planting.userData.dynamic);
    assert.ok(batches.length <= 12 && batches.every(b => b.isInstancedMesh));
    const matrix = (batch,i) => { const m = new THREE.Matrix4(); batch.getMatrixAt(i,m); return m; };
    const difference = (a,b) => Math.max(...a.elements.map((n,i) => Math.abs(n-b.elements[i])));
    const stalks = batches.find(b => b.geometry.type === 'CylinderGeometry');
    const petals = batches.find(b => b.material.name === 'Porcelain pink lotus petals' && b.geometry.type === 'BufferGeometry');
    const leaves = batches.find(b => b.material.name === 'Waxy lotus blade');
    const base = new THREE.Vector3(0,-.5,0), restStalk = matrix(stalks,8);
    const inner = matrix(petals,0), outer = matrix(petals,15), distant = matrix(petals,24);
    const relative = inner.clone().invert().multiply(outer), restLeaf = matrix(leaves,0);
    bed.disturb(.25,2.52,1);
    bed.update(.15);
    assert.ok(difference(matrix(petals,0),inner) > .025);
    assert.ok(difference(matrix(leaves,0),restLeaf) < 1e-6, 'wave has yet to travel to the first leaf');
    assert.ok(base.clone().applyMatrix4(matrix(stalks,8)).distanceTo(base.clone().applyMatrix4(restStalk)) < 1e-6);
    assert.ok(difference(matrix(petals,0).invert().multiply(matrix(petals,15)),relative) < 1e-5);
    bed.update(.42);
    assert.ok(difference(matrix(leaves,0),restLeaf) > .008);
    assert.ok(difference(matrix(petals,24),distant) < 1e-6, 'distant colony remains still');
    for (let i=0;i<100;i++) bed.update(.04);
    assert.ok(difference(matrix(petals,0),inner) < 1e-6 && difference(matrix(leaves,0),restLeaf) < 1e-6);
    bed.disturb(.25,2.52,1); bed.update(.12); bed.update(0,true);
    assert.ok(difference(matrix(petals,0),inner) < 1e-6);
    bed.update(.5); assert.ok(difference(matrix(leaves,0),restLeaf) < 1e-6);
  } finally {
    bed.dispose(); geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
  }
});
