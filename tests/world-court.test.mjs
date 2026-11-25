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
function loadModule(file, imports, canvasMethods = {}) {
  const source = fs.readFileSync(new URL('../src/scripts/mountain-world/'+file+'.ts',import.meta.url),'utf8')
    .replaceAll('import.meta.env?.BASE_URL', "'/MyPage/'");
  const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {}, ink = new Proxy(canvasMethods, { get:(methods,key)=>methods[key] ?? (()=>ink) });
  vm.runInNewContext(code,{
    exports,require:id=>{ assert.ok(id in imports,id); return imports[id]; },
    document:{ createElement:()=>({getContext:()=>ink}) },
    Image:class { set src(_url) { this.onerror?.(); } },
  });
  return exports;
}
const three = {...THREE,TextureLoader:class { async loadAsync(){return new THREE.Texture();} }};

test('walking across the island barely changes the painted peaks; the cloud sea remains below the cliffs', async () => {
  const { createLandscapeBackdrop } = loadModule('landscape-backdrop',{
    three,'../../assets/mountain-panorama-preview.webp?inline':{default:'preview'},
    './entry-art':{decodePainting:async()=>null},
  },{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})});
  const scene=new THREE.Scene(), backdrop=createLandscapeBackdrop(scene);
  try {
    await backdrop.ready;
    const ridge=backdrop.root.getObjectByName('continuous-180-degree-panoramas');
    const canopy=backdrop.root.getObjectByName('painted-blue-sky-and-white-clouds');
    const cloud=backdrop.root.getObjectByName('cloud-sea-depth-layer-1');
    const cloudPoint=cloud.getWorldPosition(new THREE.Vector3()), wind=cloud.material.map.offset.clone();
    const {radiusTop:r,height}=ridge.geometry.parameters;
    // Use two details on the same painted peak in the northwest half of the panorama.
    const theta=(2-.245)*Math.PI, crest=new THREE.Vector3(r*Math.sin(theta),height*.27,r*Math.cos(theta));
    const slope=crest.clone(); slope.y=-height*.10;
    const camera=new THREE.PerspectiveCamera(67,1280/720,.055,230);
    function frame(x,y,z,yaw=0) {
      camera.position.set(x,y,z); camera.rotation.set(.12,yaw,0,'YXZ'); camera.updateMatrixWorld();
      backdrop.setViewpoint(camera.position); scene.updateMatrixWorld(true);
      const project=point=>ridge.localToWorld(point.clone()).project(camera);
      const a=project(crest), b=project(slope);
      const sky=canopy.localToWorld(new THREE.Vector3(0,80,-100)).project(camera);
      return {height:Math.abs(a.y-b.y)*360, x:a.x*640, skyX:sky.x*640};
    }
    const gate=frame(0,1.98,12), bridge=frame(0,1.98,34), porch=frame(0,2.62,-7.78);
    assert.ok(gate.height>100, 'Measure a prominent peak at the original viewing scale');
    assert.ok(porch.height>bridge.height && porch.height/bridge.height<1.003, 'The full approach produces under 0.3% magnification');
    const west=frame(-3.6,1.98,7.86), east=frame(3.6,1.98,7.86);
    assert.ok(Math.abs(east.x-west.x)<.5 && Math.abs(east.skyX-west.skyX)<.5, 'Crossing the pool moves the distant mountain and sky by less than half a pixel');
    const jump=frame(3.6,3.08,7.86), turn=frame(3.6,1.98,7.86,.45);
    assert.ok(Math.abs(jump.height-east.height)<.1 && Math.abs(turn.x-east.x)>160);
    assert.deepEqual(cloud.getWorldPosition(new THREE.Vector3()).toArray(),cloudPoint.toArray());
    backdrop.update(2);
    assert.ok(cloud.material.map.offset.distanceTo(wind)>0);
  } finally { backdrop.dispose(); }
});

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
const cliffs = loadModule('cliff-garden',{three,'./environment-geometry':shapes,'./woodland-foliage':foliage});
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

test('the planted banks and sedge blades stand outside the tea terrace paving', () => {
  const {x0,x1,z0,z1}=terrace.TEA_PAVILION.apron;
  for(const geometry of [cliffs.plantingSoil(),cliffs.cliffGarden()]) {
    try {
      const points=geometry.getAttribute('position');
      for(let i=0;i<points.count;i++) {
        const x=points.getX(i), z=points.getZ(i);
        assert.ok(points.getY(i)<.304 || x<x0 || x>x1 || z<z0 || z>z1,'A soil or leaf vertex breaks through the pavilion floor');
      }
    } finally { geometry.dispose(); }
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
    const wing=terrace.WING, outerWall=wing.outer, windowCentre=(wing.inner+wing.outer)/2;
    const { front, tread, count } = terrace.HALL_STEPS;
    assert.ok(cabinet.min.z - front >= 3.1, 'The west cabinet stands on its own level floor south of the porch shoulder');
    assert.equal(terrace.hallRiseAt(cabinet.min.x,cabinet.min.z),0);
    assert.ok(cabinet.min.x > -outerWall + .14 && cabinet.max.z < wing.south - .14, 'Cabinet clears the inner plaster faces');
    const nav = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders]);
    const floorPieces=[];
    const finishes=new Set(['Matched elm boards with long-grain margins','Staggered, honed limestone courses','Long ashlar of the pond walks',
      'Flush door threshold','Flush threshold of the north hall','Recessed floor joint bed','Bound north-study carpet','Solid ashlar body of the hall terrace',
      'Bevelled leading stones of the porch landing','Dressed axial stair nosing','Dressed lateral stair nosing']);
    scene.traverse(part=>{if(part.isMesh&&finishes.has(part.name))floorPieces.push(part);});
    const floorRay=new THREE.Raycaster();
    function floorAt(x,z) {
      floorRay.set(new THREE.Vector3(x,1.20,z),new THREE.Vector3(0,-1,0));
      const hit=floorRay.intersectObjects(floorPieces,false)[0];
      assert.ok(hit,'A modelled walking surface at '+[x,z]); return hit.point.y;
    }
    function standingRoom(x,z,r,height) {
      for(let n=0;n<8;n++) {
        const a=n*Math.PI/4, xx=x+r*Math.cos(a), zz=z+r*Math.sin(a);
        assert.ok(nav.canWalk(xx,zz),'Turn with body clearance at '+[xx,zz]);
        assert.ok(Math.abs(floorAt(xx,zz)-height)<.026,'A level landing at '+[xx,zz]);
        assert.ok(Math.abs(.30+terrace.hallRiseAt(xx,zz)-height)<.001,'Eye stays level on the landing');
      }
    }
    const thresholdZ=-5.55-terrace.NORTH_HALL_SETBACK, porchY=.3+terrace.NORTH_HALL_RISE;
    assert.ok(thresholdZ < front-1.50, 'Over 1.50 m of porch between the top riser and the main doorway');
    const deskBounds=new THREE.Box3().setFromObject(scene.getObjectByName('writing-desk'),true);
    assert.ok(thresholdZ-deskBounds.max.z>1.45,'The desk leaves a full landing inside the door');
    for (const x of [-4.14,0,4.14]) {
      assert.ok(nav.clearLine({x,z:thresholdZ+.72},{x,z:thresholdZ-.69}),'Cross the central or flanking opening');
      standingRoom(x,thresholdZ+.75,x===0?.53:.38,porchY);
      standingRoom(x,thresholdZ-(x===0?.72:1.04),x===0?.44:.38,porchY);
    }
    for (const side of [-1,1]) {
      for (const x of [outerWall-.85,outerWall+.85]) standingRoom(side*x,-4.51,.69,.30);
      assert.ok(nav.clearLine({x:side*(outerWall+.87),z:-4.90},{x:0,z:-4.90}),'The side doors reach the foot of the axial stair without a riser');
      assert.equal(nav.clearLine({x:side*4,z:front+.7},{x:side*4,z:front-.7}),false,'The shoulder has a physical retaining face');
      assert.ok(nav.clearLine({x:side*3.25,z:-1.62},{x:side*6.45,z:-1.62}),'The former wing floor is open paving all the way across');
      const formerRoof = new THREE.Raycaster(new THREE.Vector3(side*4.65,1.98,-1.62),new THREE.Vector3(0,1,0),0,8);
      assert.equal(formerRoof.intersectObject(scene.getObjectByName(side<0?'Library roof':'Instrument hall roof'),true).length,0,
        'The original room footprint now opens to the sky');
    }
    for (const x of [outerWall-.73,outerWall-.65,outerWall-.58])
      assert.ok(nav.clearLine({x,z:-4.35},{x,z:0}),'A continuous walking aisle separates the instrument table and the window');
    for (let level=1;level<=count;level++) {
      const offset=(count-level-.5)*tread, y=.30+level*terrace.HALL_STEPS.riser;
      for(const [x,z] of [[.13,front+offset],[terrace.HALL_STEPS.halfWidth+offset,front-2.18]])
        assert.ok(Math.abs(floorAt(x,z)-y)<.012 && Math.abs(.30+terrace.hallRiseAt(x,z)-y)<.001,'Measured stone and foot agree on each tread centre');
    }
    const lowFeet=scene.getObjectsByProperty('name','Low stone column foot');
    assert.equal(lowFeet.length,10,'Three inner posts carry each wing and two posts carry each inner gallery plate');
    for(const foot of lowFeet) {
      const box=new THREE.Box3().setFromObject(foot,true);
      assert.ok(Math.abs(box.min.y-.304)<.002,'The gallery and wing plinths start on the lower, boarded floor');
    }
    const feet=[...lowFeet,
      ...scene.getObjectsByProperty('name','Square plinth').filter(o=>o.parent.name==='North hall on its stone terrace'),
      ...scene.getObjectsByProperty('name','Stone pad beneath the inner door column')];
    assert.equal(feet.length,16);
    for (const foot of feet) {
      const box=new THREE.Box3().setFromObject(foot,true);
      for(const x of [box.min.x+.018,box.max.x-.018])for(const z of [box.min.z+.018,box.max.z-.018])
        assert.ok(Math.abs(floorAt(x,z)-box.min.y)<.022,'The four corners of every column plinth bear on the same landing');
    }
    const chess=terrace.CHESS_PAVILION, tea=terrace.TEA_PAVILION;
    const teaRoof=scene.getObjectByName('Low-ridged tea pavilion');
    for (const z of [3.78,4.35,5,5.65,6.22]) {
      assert.ok(nav.clearLine({x:6.65,z}, {x:12.50,z}), 'The stone approach opens across the bridge width');
      for(const x of [7.1,9.4,11.8]) assert.equal(new THREE.Raycaster(new THREE.Vector3(x,1.98,z),new THREE.Vector3(0,1,0),0,8)
        .intersectObject(teaRoof,true).length,0,'The passage to the bridge is open to the sky');
    }
    const spectator = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders],.44);
    for(const x of [-8.01,-7.61,-7.21]) assert.ok(spectator.clearLine({x,z:2.24},{x,z:7.65}),'A spectator can pass beside the chess game');
    const fromGallery={x:-outerWall-1.5,z:1.10};
    const chessWalk=[fromGallery,{x:-10.20,z:2.45},{x:-9.50,z:3.57},{x:chess.x+.77,z:chess.z-1.36}];
    assert.ok(chessWalk.every((p,i)=>spectator.canWalk(p.x,p.z) && (!i || spectator.clearLine(chessWalk[i-1],p))),
      'An 88 cm wide route leads from the timber gallery, around the corner, into the open chess bay');
    assert.equal(scene.getObjectsByProperty('name','Rush-seated chess armchair').length,2);
    const chessBoard=scene.getObjectByName('Nineteen-line end-grain playing field'), boardTarget=chessBoard.getWorldPosition(new THREE.Vector3());
    const galleryEye=new THREE.Vector3(fromGallery.x,1.98,fromGallery.z), alongBoard=boardTarget.clone().sub(galleryEye);
    const westColumns=scene.getObjectByName('Chess pavilion on a stepped stone terrace').getObjectsByProperty('name','Lacquered timber pillar');
    assert.equal(westColumns.length,6);
    assert.equal(new THREE.Raycaster(galleryEye,alongBoard.clone().normalize(),.03,alongBoard.length()-.03).intersectObject(scene,true).length,0,
      'The visitor can see the board across the open bay from the relocated west gallery');
    assert.equal(terrace.chessRiseAt(chess.x,chess.z),chess.rise);
    assert.equal(terrace.chessRiseAt(chess.x+3.2,chess.z),0);
    const bench = furnishings.interactions.find(item=>item.id==='bench');
    assert.ok(bench.position.z>tea.apron.z0 && bench.position.z<tea.apron.z1);
    assert.ok(nav.canWalk(bench.approach.x,bench.approach.z));
    assert.ok(nav.clearLine({x:bench.approach.x,z:5},bench.approach),'A turn from the bridge leads straight to the cushions');
    const restored=nav.nearest({x:9.82,z:6.98},1.35);
    assert.ok(restored && nav.canWalk(restored.x,restored.z),'The former east seat restores to walkable ground');
    const seated = bench.sitPosition.clone(); seated.y += .8;
    const sun = terrace.SUN_DAIS;
    assert.ok(Math.abs(bench.sitYaw - Math.atan2(seated.x-sun.x,seated.z-sun.z))<.001);
    const grove = new THREE.Group(), pineTextures = [];
    const {buildPines}=loadModule('pine-grove',{three,'./environment-geometry':shapes,'./water-court':waterCourt});
    const bark = new THREE.MeshStandardMaterial(); site.materials.add(bark);
    const trees=buildPines(grove,bark,[],{value:0},g=>{site.geometries.add(g); return g},t=>pineTextures.push(t));
    site.materials.add(trees.material);
    try {
      await trees.ready;
      grove.updateMatrixWorld(true);
      for(const dz of [-2.54,0,2.54]) {
        const sight=new THREE.Vector3(sun.x+1.31,3.03,sun.z+dz).sub(seated);
        const ray=new THREE.Raycaster(seated,sight.clone().normalize(),.035,sight.length()-.35);
        assert.equal(ray.intersectObjects([scene,grove],true).length,0,
          'Both edges and the centre of the bronze disc remain visible between the tea columns and pines');
      }
    } finally {
      trees.dispose();pineTextures.forEach(t=>t.dispose());
      grove.traverse(node=>{if(node.isInstancedMesh)node.dispose()});
    }
    const crossingNav = createNavigation(site.walkAreas,[...site.colliders,...furnishings.colliders],.32,[],site.overheads);
    for (const [x,z,yaw,normal,plane] of [
      [windowCentre,wing.south+.67,0,'z',wing.south], [outerWall+.67,-.62,Math.PI/2,'x',outerWall],
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
    assert.ok(crossingNav.findVault({x:outerWall+.67,z:-2.28},Math.PI/2),'The workbench leaves a landing aisle along the east window');
    assert.equal(crossingNav.findVault({x:-outerWall+.65,z:-1.65},Math.PI/2),null,'The archive wall is solid');
    assert.equal(crossingNav.findVault({x:windowCentre,z:wing.south+.67},Math.PI),null,'Looking away cannot trigger a vault');
    for (const doorX of [-outerWall,outerWall]) {
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
    for (const [x,z,dx,dz] of [[-outerWall+.85,-3.31,-1,0],[-outerWall+.85,-1.1,-1,0],[-outerWall+.32,-.36,0,1]]) {
      for (const y of [.63,1.85,2.62]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,0,dz),0,1.16);
        assert.ok(ray.intersectObjects(plasters,false).length, 'Solid masonry remains beside the door and behind the cabinet');
      }
      assert.equal(nav.clearLine({x,z},{x:x+dx*1.3,z:z+dz*1.3}),false);
    }
    const bookBay=(terrace.LIBRARY_ENTRY.jamb+terrace.LIBRARY_ENTRY.east)/2;
    for(const dx of [-.36,0,.36]) {
      const x=bookBay+dx;
      assert.ok(nav.clearLine({x,z:1.53},{x,z:-.70}), 'A visitor can enter the book bay across the full approach');
    }
    assert.ok(nav.clearLine({x:-4.30,z:1.12},{x:bookBay,z:1.12}),'The pond walk turns west across level paving directly to the archive');
    // Test actual visibility from the visitor's side of the bank, before they know which way to turn.
    for(const eye of [new THREE.Vector3(-3.48,1.98,3.17), new THREE.Vector3(-3.38,1.98,6.54), new THREE.Vector3(-3.38,1.98,8.15)]) {
      assert.ok(nav.canWalk(eye.x,eye.z));
      const shelf=books.meshes[0];
      const spines=[[-.63,1.72],[-.42,.97],[.24,1.21]];
      const visible=spines.filter(([x,y])=>{
        const point=shelf.localToWorld(new THREE.Vector3(x,y,.194)), offset=point.sub(eye);
        const ray=new THREE.Raycaster(eye,offset.clone().normalize(),.03,offset.length()+.18);
        const first=ray.intersectObject(scene,true)[0], bookcase=ray.intersectObject(shelf,true)[0];
        return first && bookcase && first.object===bookcase.object;
      });
      assert.ok(visible.length>=2,'Multiple rows of the real shelf are visible across the retreating wall');
    }
    const walkStones=scene.getObjectsByProperty('name','Long ashlar of the pond walks');
    for(const [x,z] of [[0,10.1],[0,8.53],[-4.30,5.11],[4.30,4.85],[-6.65,1.12],[bookBay,1.12],
      [bookBay,.91],[5.58,4.83],[.12,1.58]]) {
      assert.ok(nav.canWalk(x,z),'The flush stone route clears the lanterns and planters');
      // Sample a shoe-width patch. Its centre can lie exactly over a 7 mm mortar joint.
      const stoneUnderfoot=[[-.06,-.07],[.06,-.07],[.06,.07],[-.06,.07],[0,0]].filter(([dx,dz])=>{
        const ray=new THREE.Raycaster(new THREE.Vector3(x+dx,1.98,z+dz),new THREE.Vector3(0,-1,0),0,2);
        return ray.intersectObjects(walkStones).some(hit=>Math.abs(hit.point.y-.304)<.003);
      });
      assert.ok(stoneUnderfoot.length>=3,`The visible walk at (${x}, ${z}) must meet the common paving level`);
    }
    const thresholds = scene.getObjectsByProperty('name','Flush door threshold');
    for (const side of [-1,1]) {
      const doorX=side*outerWall, insideX=doorX-side*.85, outsideX=doorX+side*1.25;
      const threshold = thresholds.find(mesh=>Math.abs(mesh.position.x-doorX)<.001);
      assert.ok(threshold && Math.abs(threshold.position.z+4.51)<.001, 'Paired thresholds align across the courtyard');
      const jambs = scene.getObjectsByProperty('name','Deep timber window or door jamb')
        .filter(mesh => Math.abs(mesh.position.x-doorX)<.001 && Math.abs(mesh.position.z+4.51)<1.12)
        .map(mesh => new THREE.Box3().setFromObject(mesh,true)).sort((a,b)=>a.min.z-b.min.z);
      assert.equal(jambs.length,2);
      assert.ok(jambs[1].min.z - jambs[0].max.z >= 2.07, 'Two metres clear between the finished jambs');
      const north=jambs[0].max.z, south=jambs[1].min.z, body=.32;
      for (const [edge,inward] of [[north,1],[south,-1]]) {
        const fits=edge+inward*(body+.025), clips=edge+inward*(body-.025);
        assert.ok(nav.clearLine({x:insideX,z:fits},{x:outsideX,z:fits}),'Body clears the modelled jamb with 2.5 cm to spare');
        assert.equal(nav.clearLine({x:insideX,z:clips},{x:outsideX,z:clips}),false,'The same body clips the actual jamb 5 cm farther out');
      }
      for (const z of [north+body+.028,(north+south)/2,south-body-.028]) {
        const inside={x:insideX,z}, outside={x:outsideX,z};
        assert.ok(nav.clearLine(inside,outside) && nav.clearLine(outside,inside), 'The side gallery door fits the player from either side');
        const sill=floorAt(doorX,z);
        assert.ok(Math.abs(sill-.308)<.002,'The physical threshold is 8 mm above the nominal floor');
        for (const x of [doorX-.27,doorX+.27]) assert.ok(Math.abs(floorAt(x,z)-sill)<.025,'Both ends of the stone threshold meet the wooden floor');
        for (const [dy,dz] of [[.045,0],[.92,-.30],[.92,.30],[STANDING_HEAD-.025,0]]) {
          const ray=new THREE.Raycaster(new THREE.Vector3(inside.x,.3+dy,z+dz),new THREE.Vector3(side,0,0),0,2.1);
          assert.equal(ray.intersectObject(scene,true).length,0,'The threshold, shoulders and crown have a clear line across the whole doorway');
        }
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
    assert.equal(nav.canWalk(-terrace.GALLERY.wall-.54,-1.87),false);
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
      assert.ok(nav.clearLine({x:side*3.70,z:11.90},{x:side*3.70,z:7.70},dryWalk),'Both halves of the entrance apron are open');
    }
    for (const z of [4.6,4.95,5.3])
      assert.ok(nav.clearLine({x:-3.5,z},{x:-7.80,z},dryWalk),'The pond opens onto the spectator walk beside the chess pavilion');
    for (const z of [4.1,5,5.9])
      assert.ok(nav.clearLine({x:3.5,z},{x:12.48,z},dryWalk),'The east pond walk crosses directly to the open bridge');
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
    const outward = (count - i - .5) * tread;
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
    const [chessRoof]=bounds('Six-sided chess pavilion'),[teaRoof]=bounds('Low-ridged tea pavilion');
    assert.ok(chessRoof.max.y>teaRoof.max.y+.28 && teaRoof.min.z>=terrace.EAST_BRIDGE.z+terrace.EAST_BRIDGE.width/2+.28);
    const pairs=[bounds('Covered hillside gallery'),[...bounds('Library roof'),...bounds('Instrument hall roof')]];
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
        if(['Six-sided chess pavilion','Low-ridged tea pavilion'].includes(row.parent.name)) continue;
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
    const nav=createNavigation(site.walkAreas,site.colliders,.32,terrace.COURT_OUTLINE,site.overheads);
    // Walk past the last outer plinth and turn with the stone rail onto the pavilion landing.
    const galleryTurn=[[14.10,-6.95],[14.10,1.23],[14.03,1.70],[13.67,1.98],[13.30,2.18],
      [12.90,2.43],[12.44,2.73],[11.97,3.12],[11.71,3.39]];
    for (const side of [-1,1]) {
      const route=galleryTurn.map(([x,z])=>({x:side*x,z}));
      for(let i=1;i<route.length;i++) {
        assert.ok(nav.clearLine(route[i-1],route[i]) && nav.clearLine(route[i],route[i-1]),
          `A walking visitor can follow the gallery rail at (${route[i].x}, ${route[i].z})`);
      }
    }
    // A clear line to the sign alone misses the outer columns and most of the lower front.
    const northHall=root.getObjectByName('North hall on its stone terrace');
    const hallMeshes=new Set();
    northHall.traverse(part=>{if(part.isMesh) hallMeshes.add(part);});
    const frontPieces=['Square plinth','Lacquered timber pillar','Hall side-bay transom','Amber paper in the shutter']
      .flatMap(name=>northHall.getObjectsByProperty('name',name));
    assert.equal(frontPieces.length,12);
    const centreOf=piece=>new THREE.Box3().setFromObject(piece,true).getCenter(new THREE.Vector3());
    const samples=frontPieces.map(piece=>({name:piece.name,point:centreOf(piece)}));
    const porchCaps=root.getObjectsByProperty('name','Bevelled leading stones of the porch landing')
      .sort((a,b)=>a.position.x-b.position.x);
    for (const piece of [porchCaps[0],porchCaps.at(-1)]) {
      hallMeshes.add(piece);
      samples.push({name:'outer edge of the porch landing',point:centreOf(piece)});
    }
    const hipShoes=northHall.getObjectByName('North hall lower eaves').getObjectsByProperty('name','Lifted bronze hip shoe')
      .sort((a,b)=>centreOf(b).z-centreOf(a).z);
    assert.equal(hipShoes.length,4);
    for (const shoe of hipShoes.slice(0,2)) {
      const vertices=shoe.geometry.getAttribute('position');
      const point=new THREE.Vector3().fromBufferAttribute(vertices,Math.floor(vertices.count/2));
      samples.push({name:'front upturned eave',point:shoe.localToWorld(point)});
    }
    for(const [x,z] of [[-.3941,11.76],[0,12.52],[-3.55,6.72],[3.55,6.72]]) {
      assert.ok(nav.canWalk(x,z),'The viewing point is reachable on foot');
      const eye=new THREE.Vector3(x,1.98,z);
      for(const {name,point} of samples) {
        const delta=point.clone().sub(eye);
        const ray=new THREE.Raycaster(eye,delta.clone().normalize(),.03,delta.length()+.15);
        const first=ray.intersectObject(root,true)[0];
        assert.ok(first && hallMeshes.has(first.object),
          `Looking at the ${name} from (${x}, ${z}) first met ${first?.object.name}`);
      }
    }
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
    assert.ok(nav.clearLine({x:7.8,z:5},{x:25.2,z:5}), 'The centre of the open east walk leads onto the sunwheel route');
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
      const lamp=waterCourt.POOL_LAMP;
      const pavilionEntry=side<0?{x:terrace.CHESS_PAVILION.x+.77,z:terrace.CHESS_PAVILION.z-1.36}
        :{x:terrace.TEA_PAVILION.x+.44,z:terrace.TEA_PAVILION.apron.z0+.6};
      for(const end of [pavilionEntry,{x:side*(terrace.WING.inner+1.45),z:-3.2},{x:side*lamp.approachX,z:lamp.approachZ}]) {
        assert.ok(nav.canWalk(end.x,end.z));
        const path=nav.findPath(origin,end);
        assert.ok(path.length && Math.hypot(path.at(-1).x-end.x,path.at(-1).z-end.z)<.01);
      }
    }
    const westRoute=[{x:-3.6,z:2.93},{x:-7.7,z:2.93},{x:terrace.CHESS_PAVILION.x+.77,z:terrace.CHESS_PAVILION.z-1.36}];
    const eastRoute=[{x:3.6,z:5},{x:11.43,z:5},{x:11.43,z:8.23}];
    for (const route of [westRoute,eastRoute]) for(let i=1;i<route.length;i++)
      assert.ok(nav.clearLine(route[i-1],route[i]),'Continuous turns from the pool into the chess bay or the tea terrace');
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
