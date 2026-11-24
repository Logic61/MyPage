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
const { buildCliffCrossings } = loadModule('cliff-crossings',{three,'./environment-geometry':shapes,'./stone-balustrade':stoneRail,
  './court-beacon':loadModule('court-beacon',{three}),'./hall-terrace':terrace});
const goSetting = loadModule('go-pavilion',{three,'./environment-geometry':shapes,'./hall-terrace':terrace});
const gateData = JSON.parse(fs.readFileSync(new URL('../src/assets/gate-posts.json',import.meta.url),'utf8'));
const gatePost = loadModule('inscribed-post',{three,'../../assets/gate-posts.json':{default:gateData}});
const tabletProfile = JSON.parse(fs.readFileSync(new URL('../src/assets/cloudrest-nameboard-profile.json',import.meta.url),'utf8'));
const lanterns = loadModule('forecourt-lantern',{three,'./environment-geometry':shapes});
const halls = loadModule('timber-halls',{three,'./environment-geometry':shapes,'./tiled-roof':roof,'./stone-balustrade':stoneRail,'./hall-terrace':terrace,'./go-pavilion':goSetting,'./inscribed-post':gatePost,'./forecourt-lantern':lanterns,'../../assets/cloudrest-nameboard-profile.json':{default:tabletProfile}});
const waterCourt = loadModule('water-court',{});
const lotus = loadModule('lotus-pond',{three,'./environment-geometry':shapes,'./water-court':waterCourt});
const paving = loadModule('courtyard-paving',{three,'./environment-geometry':shapes});
const foliage = loadModule('woodland-foliage',{three,'./environment-geometry':shapes});
const understory = loadModule('pine-understory',{three,'./woodland-foliage':foliage,'./environment-geometry':shapes,'./water-court':waterCourt});
const gallery=loadModule('cloud-gallery',{three,'./environment-geometry':shapes,'./hall-terrace':terrace,'./woodland-foliage':foliage,'three/addons/objects/MarchingCubes.js':{MarchingCubes}});
const { createStudyArchitecture } = loadModule('environment-design',{three,'./reed-shades':loadModule('reed-shades',{three,'./hall-terrace':terrace}),'./environment-geometry':shapes,'./timber-halls':halls,'./lotus-pond':lotus,'./stone-balustrade':stoneRail,'./hall-terrace':terrace,'./courtyard-paving':paving,'./water-court':waterCourt,'./cloud-gallery':gallery,'./pine-understory':understory});
const origin = {x:0,z:34};

test('the paired landing lamps share their carvings and expose paper through all six pierced bronze faces', () => {
  const group=new THREE.Group(), stone=new THREE.MeshStandardMaterial(), bronze=new THREE.MeshStandardMaterial();
  const collisions=[], paper=lanterns.buildForecourtLanterns(group,stone,bronze,(...box)=>collisions.push(box));
  group.updateMatrixWorld(true);
  const [left,right]=group.children;
  const geometries=new Set(), materials=new Set();
  group.traverse(part=>{if (part.isMesh) { geometries.add(part.geometry); materials.add(part.material); }});
  try {
    assert.deepEqual(collisions,[[-4.94,12.42,.27,.27],[4.94,12.42,.27,.27]]);
    const footName='Stepped octagonal lantern plinth', foot=left.getObjectByName(footName);
    assert.equal(foot.geometry,right.getObjectByName(footName).geometry);
    const bounds=new THREE.Box3().setFromObject(foot,true);
    assert.equal(bounds.min.y,.30);
    assert.ok(bounds.max.x-bounds.min.x<=.54 && bounds.max.z-bounds.min.z<=.54);
    const grilles=left.getObjectsByProperty('name','Pierced ruyi transom');
    const windows=left.getObjectsByProperty('name','Fibred lantern window');
    assert.equal(grilles.length,6);
    assert.equal(windows.length,6);
    assert.ok(windows[0].material.depthWrite && !windows[0].receiveShadow,
      'Occlusion uses the paper surface and its lit fibres diffuse directional shadows');
    const ray=new THREE.Raycaster();
    for (const [i,grille] of grilles.entries()) {
      const direction=new THREE.Vector3(0,0,-1).transformDirection(grille.matrixWorld);
      for (const [x,y] of [[-.025,-.012],[.025,-.012],[-.025,.012],[.025,.012],[0,0]]) {
        ray.set(grille.localToWorld(new THREE.Vector3(x,y,.06)),direction);
        assert.equal(ray.intersectObject(grille).length>0,x===0,'The central knot is solid and its four lobes are open');
        assert.ok(ray.intersectObject(windows[i]).length>0,'The paper sits behind every bronze opening');
      }
      assert.equal(windows[i].material.emissiveMap,paper);
    }
  } finally {
    paper.dispose(); geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
  }
});

test('the cliff spring touches its bed upstream and divides into free-falling veils beyond the lip', () => {
  const {buildCliffSpring}=loadModule('cliff-spring',{three,'./environment-geometry':shapes,'three/addons/utils/BufferGeometryUtils.js':{mergeGeometries}});
  const scene=new THREE.Group(), stone=new THREE.MeshStandardMaterial(), resources=[stone];
  const keep=value=>{resources.push(value);return value;};
  try {
    const aerationMap={value:keep(new THREE.Texture())};
    const clock=buildCliffSpring(scene,stone,keep,keep,aerationMap);
    const bed=scene.getObjectByName('Wet shelves and hollow at the spring head');
    const film=scene.getObjectByName('Spring rill and divided waterfall'), drops=scene.getObjectByName('Droplets shed by the waterfall');
    assert.equal(film.material.uniforms.time,drops.material.uniforms.time);
    assert.equal(film.material.uniforms.time,clock);
    assert.equal(film.material.uniforms.aerationMap,aerationMap);
    assert.ok(!film.material.depthWrite && !drops.material.depthWrite);
    const {position,uv}=film.geometry.attributes;
    const sample=(s,t,epsilon) => Array.from({length:uv.count},(_,i)=>i)
      .filter(i=>Math.abs(uv.getX(i)-s)<epsilon && Math.abs(uv.getY(i)-t)<.014)
      .map(i=>new THREE.Vector3().fromBufferAttribute(position,i));
    const [feed]=sample(.47,-.5,.012);
    const down=new THREE.Raycaster(feed,new THREE.Vector3(0,-1,0),0,.085);
    assert.ok(down.intersectObject(bed).length,'A solid wet channel lies immediately beneath the feeding rill');
    for (const seam of [.14,.80]) {
      const brink=sample(seam,0,.001), falling=sample(seam,.74,.001);
      assert.equal(brink.length,2);
      assert.equal(falling.length,2);
      assert.ok(brink[0].distanceTo(brink[1])<.001,'Water emerges as one continuous surface');
      assert.ok(falling[0].distanceTo(falling[1])>.10,'A physical gap exposes the rock below');
      assert.ok(falling[0].y<brink[0].y-2.7);
    }
  } finally { resources.forEach(resource=>resource.dispose()); }
});

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
    const plinths = scene.getObjectsByProperty('name','Gate plinth tread');
    assert.equal(plinths.length, 4);
    assert.ok(first.position.x - second.position.x - plinths[0].scale.x > 3.40);
    const tablet = new THREE.Box3().setFromObject(scene.getObjectByName('留云阁'),true);
    assert.ok(tablet.max.x - tablet.min.x > 2.6 && tablet.max.z - tablet.min.z > .09);
    assert.ok(tablet.min.y - .29 > 3.17, 'The tablet clears the bridge paving by over 3.17 metres');
    assert.ok(scene.getObjectByName('摘星留云').geometry.parameters.width > 3);
    for (const pillar of [first, second]) {
      assert.equal(pillar.material.map, cedar.map);
      assert.equal(pillar.material.transparent, false);
      assert.equal(pillar.material.emissiveMap.channel, 1);
      const strokeUV = pillar.geometry.attributes.uv1;
      assert.equal(strokeUV.count, pillar.geometry.attributes.position.count);
      const start = pillar === first ? 0 : .5;
      for (let i = 0; i < gateData[pillar.name].vertices.length / 3; i++)
        assert.ok(strokeUV.getX(i) >= start && strokeUV.getX(i) <= start + .5);
      const surface = pillar.geometry.attributes.position;
      pillar.updateWorldMatrix(true, false);
      pillar.geometry.computeBoundingBox();
      const bounds = pillar.geometry.boundingBox, height = bounds.max.y - bounds.min.y;
      let radius = 0;
      for (let i = 0; i < surface.count; i++) {
        if (surface.getY(i) === bounds.min.y)
          radius = Math.max(radius, Math.hypot(surface.getX(i), surface.getZ(i)));
      }
      assert.ok(Math.abs(2 * radius - .58) < .001);
      let deepest = 0, sample, strokeBottom = Infinity, strokeTop = -Infinity;
      for (let i = 0; i < surface.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(surface, i);
        if (Math.abs(v.y) >= height / 2 - .001) continue;
        const depth = radius * (1 - .07 * (v.y / height + .5)) - Math.hypot(v.x, v.z);
        assert.ok(depth >= -1e-6, 'The shaft has no raised lettering');
        if (depth > .0008) {
          strokeBottom = Math.min(strokeBottom, v.y);
          strokeTop = Math.max(strokeTop, v.y);
        }
        if (depth > deepest) { deepest = depth; sample = v; }
      }
      assert.ok(deepest > .0065 && deepest < .0071, 'The strokes are recessed into the round shaft');
      const coverage = (strokeTop - strokeBottom) / height;
      assert.ok(coverage > .76 && coverage < .84, 'The seven-character carving fills about four fifths of the shaft');
      const inward = new THREE.Vector3(-sample.x, 0, -sample.z).transformDirection(pillar.matrixWorld);
      // Offset from a shared vertex into the neighbouring face before raycasting the whole hall.
      const origin = pillar.localToWorld(sample.clone()).addScaledVector(inward, -.1);
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
    assert.ok(cabinet.min.z - firstTread >= 2.4, 'At least 2.4 m of level space between the cabinet and the first stone tread');
    assert.equal(terrace.hallRiseAt(cabinet.min.x,cabinet.min.z),0);
    assert.ok(cabinet.min.x > -6.1 + .14 && cabinet.max.z < .6 - .14, 'Cabinet clears the inner plaster faces');
    const nav = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders]);
    const pavilion = terrace.PINE_PAVILIONS;
    for (const z of [4.76,5,5.24]) {
      assert.ok(nav.clearLine({x:7.65,z}, {x:12.50,z}), 'The east pavilion leaves the route to the sunwheel clear');
    }
    const spectator = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders],.44);
    const loop = [[-1.64,-1.22],[-1.10,-1.22],[0,-1.75],[1.10,-1.22],[1.64,-1.22],
      [1.64,1.22],[1.10,1.22],[0,1.75],[-1.10,1.22],[-1.64,1.22]]
      .map(([dx,dz])=>({x:-pavilion.x+dx,z:pavilion.z+dz}));
    for (let i=0;i<loop.length;i++) assert.ok(spectator.clearLine(loop[i],loop[(i+1)%loop.length]),
      'An 88 cm clear circuit passes the four stools inside the pavilion');
    const bench = furnishings.interactions.find(item=>item.id==='bench');
    const sun = new THREE.Vector3(terrace.SUN_DAIS.x,2.6,terrace.SUN_DAIS.z);
    const seated = bench.sitPosition.clone(); seated.y += .8;
    const view = sun.sub(seated);
    assert.ok(Math.abs(bench.sitYaw - Math.atan2(-view.x,-view.z))<.001);
    assert.equal(new THREE.Raycaster(seated,view.normalize(),.03,16).intersectObject(scene,true).length,0,
      'The seated visitor looks past the cedar columns to the sunwheel');
    const crossingNav = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders],.32,
      [[-8,-11],[8,-11],[8,2],[-8,2]],site.overheads);
    for (const [x,z,yaw,normal,plane] of [
      [4.65,1.27,0,'z',.6], [6.77,-.62,Math.PI/2,'x',6.1],
      [4.54,-8.02-terrace.NORTH_HALL_SETBACK,-Math.PI/2,'x',6.1], [-4.54,-8.02-terrace.NORTH_HALL_SETBACK,Math.PI/2,'x',-6.1],
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
    for (const [x,z,dx,dz] of [[-5.25,-3.31,-1,0],[-5.25,-1.1,-1,0],[-4.8,-.36,0,1]]) {
      for (const y of [.63,1.85,2.62]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,0,dz),0,1.16);
        assert.ok(ray.intersectObjects(plasters,false).length, 'Solid masonry remains beside the door and behind the cabinet');
      }
      assert.equal(nav.clearLine({x,z},{x:x+dx*1.3,z:z+dz*1.3}),false);
    }
    const thresholds = scene.getObjectsByProperty('name','Flush door threshold');
    for (const side of [-1,1]) {
      const threshold = thresholds.find(mesh=>Math.abs(mesh.position.x-side*6.1)<.001);
      assert.ok(threshold && Math.abs(threshold.position.z+4.51)<.001, 'Paired thresholds align across the courtyard');
      const jambs = scene.getObjectsByProperty('name','Deep timber window or door jamb')
        .filter(mesh => Math.abs(mesh.position.x-side*6.1)<.001 && Math.abs(mesh.position.z+4.51)<1.12)
        .map(mesh => new THREE.Box3().setFromObject(mesh,true)).sort((a,b)=>a.min.z-b.min.z);
      assert.equal(jambs.length,2);
      assert.ok(jambs[1].min.z - jambs[0].max.z >= 2.07, 'Two metres clear between the finished jambs');
      for (const z of [-5.19,-4.51,-3.82]) {
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
    const trough = new THREE.Box3();
    for (const curb of scene.getObjectsByProperty('name','Dressed curb of the fern trough'))
      trough.expandByObject(curb,true);
    const westPost = scene.getObjectsByProperty('name','Stone shoe of a round gallery column')
      .find(mesh=>mesh.position.x < 0 && mesh.position.z >= trough.min.z && mesh.position.z <= trough.max.z);
    const innerFace = new THREE.Box3().setFromObject(westPost,true).max.x;
    assert.ok(trough.min.x-innerFace >= 2.20, 'Two people fit between the scholar stone and the column foot');
    for (const x of [innerFace+.33,(innerFace+trough.min.x)/2,trough.min.x-.33])
      assert.ok(nav.clearLine({x,z:.25},{x,z:-3.8}),'The full gallery lane is clear');
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
    const galleryX = -(terrace.GALLERY.innerPost+terrace.GALLERY.outerPost)/2;
    for (const z of [-6.1,-3,0]) {
      ray.set(new THREE.Vector3(galleryX,1.98,z),new THREE.Vector3(0,1,0));
      assert.ok(ray.intersectObjects(ridges,false).length,'The roof closes above the gallery walking lane');
    }
    for (const z of [2.05,2.6,3.03]) {
      ray.set(new THREE.Vector3(galleryX,1.98,z),new THREE.Vector3(0,1,0));
      assert.equal(ray.intersectObjects(scene.getObjectsByProperty('name','Covered hillside gallery'),true).length,0,
        'The pavilion approach is open to the sky');
    }
    const picker=createInteractionPicker([scene],furnishings.interactions);
    for(const item of furnishings.interactions.filter(i=>['about','projects','bench','lantern','east-lantern'].includes(i.id))) {
      const stop=nav.findPath(origin,item.approach).at(-1);
      assert.ok(stop && Math.hypot(stop.x-item.approach.x,stop.z-item.approach.z)<.02,item.id+' approach');
      camera.position.set(item.approach.x,1.98+terrace.walkRiseAt(item.approach.x,item.approach.z),item.approach.z);
      camera.lookAt(item.position); camera.updateMatrixWorld();
      assert.equal(picker.pick(camera)?.id,item.id);
    }
    const dryWalk = (x,z) => nav.canWalk(x,z) && waterCourt.poolFloorAt(x,z) === null;
    for (const z of [1.10,1.60,2.05])
      assert.ok(nav.clearLine({x:-4.5,z},{x:4.5,z},dryWalk),'A visitor can cross the north bank on either side of a passing companion');
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
      for (const x of [3.35,4.65,5.92])
        assert.ok(nav.clearLine({x:side*x,z:1.80},{x:side*x,z:8.1},dryWalk),'The dry walks span the full length of the pond');
      for (const z of [7.48,8.22,8.96])
        assert.ok(nav.clearLine({x:0,z},{x:side*8.25,z},dryWalk),'The south bank joins the two pavilion landings');
      for (const z of [4.6,4.95,5.3])
        assert.ok(nav.clearLine({x:side*3.5,z},{x:side*8.25,z},dryWalk),'The pond opens sideways onto each pavilion');
      assert.ok(nav.clearLine({x:side*3.70,z:11.90},{x:side*3.70,z:7.70},dryWalk),'Both halves of the entrance apron are open');
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
    const bridgeEye = new THREE.Vector3(0, 1.98, 18);
    const hallSign = root.getObjectByName('摘星留云').getWorldPosition(new THREE.Vector3());
    const gateView = new THREE.Raycaster(bridgeEye, hallSign.sub(bridgeEye).normalize(), 0, 6);
    assert.equal(gateView.intersectObject(root, true).length, 0, 'Looking through the gate reveals the hall inscription');
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
    const bridges = new THREE.Group();
    root.add(bridges);
    const keep = geometry => { site.geometries.add(geometry); return geometry; };
    const own = material => { site.materials.add(material); return material; };
    const bridgeStone = own(new THREE.MeshStandardMaterial());
    buildCliffCrossings(bridges,{material:()=>new THREE.MeshStandardMaterial()},{stone:bridgeStone,darkStone:bridgeStone},
      site.colliders,keep,own,site.floors);
    bridges.updateMatrixWorld(true);
    const nav=createNavigation(site.walkAreas,site.colliders);
    for(let z=origin.z;z>=6.7;z-=.125) assert.ok(nav.canWalk(0,z),'Open bridge and gate at '+z);
    assert.equal(root.getObjectsByProperty('name','Open reflecting pool').length,1);
    const middle = {x:0,z:(waterCourt.COURTYARD_POOL.z0+waterCourt.COURTYARD_POOL.z1)/2};
    const northBank = {x:0,z:waterCourt.COURTYARD_POOL.z0-.85}, southBank = {x:0,z:waterCourt.COURTYARD_POOL.z1+.85};
    for (const bank of [northBank,southBank,{x:-3.6,z:middle.z},{x:3.6,z:middle.z}]) {
      assert.ok(nav.clearLine(bank,middle) && nav.clearLine(middle,bank), 'Every bank joins the shallow pond bed');
    }
    const onPaving = (x,z) => waterCourt.poolFloorAt(x,z) === null;
    const bypass = nav.findPath(southBank,northBank,onPaving);
    assert.ok(bypass.length >= 2 && bypass.every((p,i)=>nav.clearLine(i ? bypass[i-1] : southBank,p,onPaving)),
      'Map guidance still takes the stone paths between dry destinations');
    assert.deepEqual(nav.findPath(middle,northBank,onPaving),[northBank], 'Guidance can lead a wading visitor out');
    assert.equal(nav.hasFloor(1.7,24), false, 'Open chasm beside the south bridge');
    assert.equal(nav.hasFloor(3.8,37.8), false, 'Landing edge follows the circular stone platform');
    assert.equal(nav.hasFloor(18,6.6), false, 'Air beside the east bridge');
    assert.equal(nav.hasFloor(30,9), false, 'The terrace has no invisible square corners');
    // From the pavilion the walk passes between its real columns. Beyond the last column
    // it fans out across the dressed landing, before the bridge proper begins at x=13.5.
    assert.ok(nav.clearLine({x:7.8,z:5},{x:25.2,z:5}), 'The east pavilion opens directly onto the sunwheel route');
    for (const z of [4.1,5,5.9])
      assert.ok(nav.clearLine({x:13.1,z},{x:25.2,z}), 'The widened bridge includes its dressed landing');
    const midspan = new THREE.Vector3(18.75,.36,5);
    const rails = [-1,1].map(side => new THREE.Raycaster(midspan,new THREE.Vector3(0,0,side),0,2)
      .intersectObject(bridges,true)[0]);
    assert.ok(rails.every(hit => hit && hit.distance > 1.25), 'The dressed bridge rails leave over 2.5 m clear');
    for(const side of [-1,1]) {
      assert.ok(nav.clearLine(southBank,{x:side*3.6,z:southBank.z}),'South paving divides into two walks');
      assert.ok(nav.clearLine({x:side*3.6,z:southBank.z},{x:side*3.6,z:northBank.z}),'Both long poolside paths stay open');
      assert.ok(nav.clearLine({x:side*3.6,z:northBank.z},northBank),'North crosswalk reunites the two routes');
      for (const offset of [.7,1.35,2.05]) {
        let p={x:side*offset,z:.42};
        for (let i=0;i<100;i++) p=nav.move(p,0,-.055);
        assert.ok(p.z < -5,'Walking beside the centreline stays clear');
      }
      assert.ok(nav.clearLine({x:-3.7,z:-2.55},{x:3.7,z:-2.55}),'Unbroken crossing between the wings');
      assert.ok(nav.clearLine({x:side*3.6,z:middle.z},{x:side*8.25,z:middle.z}),'The poolside walk opens directly towards the pavilion');
      const lamp=waterCourt.POOL_LAMP;
      for(const end of [{x:side*terrace.PINE_PAVILIONS.x,z:terrace.PINE_PAVILIONS.z-1.78},{x:side*4.65,z:-3.2},{x:side*lamp.approachX,z:lamp.approachZ}]) {
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
