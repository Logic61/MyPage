import * as THREE from 'three';
import { neutralSurfaceMap } from './environment-geometry';
import { stoneBalustrade } from './stone-balustrade';
import { hexagonalRing, rectangularRing, tiledRoof } from './tiled-roof';
import { NORTH_HALL_RISE } from './hall-terrace';
import { buildGoSetting } from './go-pavilion';
import { inscribedPost, type GateLine } from './inscribed-post';

interface Materials {
  timber: THREE.Material;
  stone: THREE.MeshStandardMaterial;
  sideStone: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  archivePlaster: THREE.MeshStandardMaterial;
  soffit: THREE.Material;
}
type Obstacle = (x: number, z: number, halfX: number, halfZ: number) => void;
const assetRoot = ((import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/, '')) + '/world/';

/** Roofs, posts and architectural decoration above the study's continuous walking plane. */
export function buildTimberHalls(parent: THREE.Group, m: Materials, obstacle: Obstacle, en: boolean) {
  const group = new THREE.Group();
  group.name = 'Cloud Court timber halls'; parent.add(group);
  const hallRail = stoneBalustrade(group, m.stone, m.sideStone, geometry => geometry);
  let assembly = group;
  const textures: THREE.Texture[] = [];
  let disposed = false;
  const lacquer = new THREE.MeshStandardMaterial({ name: 'Cinnabar stained cedar', color: '#d88c64', roughness: .69 });
  const cedar = new THREE.MeshStandardMaterial({ name: 'Oiled amber cedar', color: '#d2a475', roughness: .76 });
  const jujube = new THREE.MeshStandardMaterial({ name: 'Turned and oiled jujube wood', color: '#cc966b', roughness: .41 });
  const cut = lacquer.clone();
  cut.name = 'Chisel-cut cedar posts'; cut.vertexColors = true;
  cut.color.set('#9e6046');
  cut.emissive.set('#b2d9ca'); cut.emissiveIntensity = .09;
  cut.onBeforeCompile = shader => {
    // White vertices are untouched cedar. Light is confined to the bottom of each groove.
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(0.02, 0.46, 1.0 - vColor.r);');
  };
  const mineral = new THREE.MeshStandardMaterial({ name: 'Deep teal beam ground', color: '#414d45', roughness: .80 });
  const gold = new THREE.MeshStandardMaterial({ name: 'Aged bronze leaf', color: '#d7ad62', metalness: .36, roughness: .46 });
  const glazed = new THREE.MeshStandardMaterial({ name: 'Ash-blue fired pantiles', color: '#b2b7c6', vertexColors: true, roughness: .75, metalness: .045 });
  const ridge = new THREE.MeshStandardMaterial({ name: 'Blue-black glazed ridge clay', color: '#303e4c', roughness: .56 });
  const windowPaper = new THREE.MeshStandardMaterial({ name: 'Tea-coloured mulberry paper', color: '#d5ab79', emissive: '#75431c', emissiveIntensity: .18, roughness: .98 });
  const silk = new THREE.MeshStandardMaterial({ name: 'Amber lantern silk', color: '#edbb76', emissive: '#bb5b25', emissiveIntensity: .37, roughness: .86 });
  const roofMaterials = { tile: glazed, ridge, soffit: cedar, timber: lacquer, bronze: gold };
  const cube = new THREE.BoxGeometry(1, 1, 1), disk = new THREE.CylinderGeometry(1, 1, 1, 24);
  const cylinder = new THREE.CylinderGeometry(.93, 1, 1, 20);
  const up = new THREE.Vector3(0, 1, 0);
  function part(g: THREE.BufferGeometry, material: THREE.Material, name: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const obj = new THREE.Mesh(g, material); obj.name = name;
    obj.position.set(x, y, z); obj.scale.set(sx, sy, sz); obj.castShadow = obj.receiveShadow = true; assembly.add(obj); return obj;
  }
  function box(mat: THREE.Material, name: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    return part(cube, mat, name, x, y, z, w, h, d);
  }
  function rail(a: THREE.Vector3, b: THREE.Vector3, width: number, depth: number, mat: THREE.Material) {
    const dir = b.clone().sub(a), center = a.clone().lerp(b, .5);
    const result = part(cube, mat, 'Timber connecting rail', center.x, center.y, center.z, width, dir.length(), depth);
    result.quaternion.setFromUnitVectors(up, dir.normalize()); return result;
  }
  function turned(name: string, mat: THREE.Material, x: number, y: number, z: number, profile: number[][], sides = 24) {
    return part(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), sides), mat, name, x, y, z);
  }
  function post(x: number, z: number, top: number, radius: number, line?: GateLine) {
    const foot = radius * 1.5;
    box(m.stone, 'Square plinth', x, .385, z, foot * 2, .17, foot * 2);
    turned('Turned stone column shoe', m.stone, x, .465, z, [[foot, 0], [foot, .055], [foot * .83, .08], [foot * .80, .14], [radius * 1.10, .19]]);
    const height = top - .65, centre = (top + .65) / 2;
    if (line) part(inscribedPost(line, radius, height), cut, line, x, centre, z);
    else part(cylinder, lacquer, 'Lacquered timber pillar', x, centre, z, radius, height, radius);
    part(disk, gold, 'Bronze foot band', x, .676, z, radius * 1.02, .029, radius * 1.02);
    obstacle(x, z, foot, foot);
  }
  // The stepped arm has a flat saddle and two flared shoulders to carry the next course.
  const armOutline = new THREE.Shape();
  armOutline.moveTo(-.14,-.07); armOutline.lineTo(.14,-.07);
  armOutline.quadraticCurveTo(.28,-.07,.33,.06); armOutline.lineTo(.44,.06);
  armOutline.lineTo(.44,.15); armOutline.lineTo(.28,.15);
  armOutline.quadraticCurveTo(.19,.065,.10,.065); armOutline.lineTo(-.10,.065);
  armOutline.quadraticCurveTo(-.19,.065,-.28,.15); armOutline.lineTo(-.44,.15);
  armOutline.lineTo(-.44,.06); armOutline.lineTo(-.33,.06);
  armOutline.quadraticCurveTo(-.28,-.07,-.14,-.07); armOutline.closePath();
  const bracketArm = new THREE.ExtrudeGeometry(armOutline, { depth:.15, bevelEnabled:false, curveSegments:5 });
  bracketArm.translate(0,0,-.075);
  function brackets(x: number, y: number, z: number, scale: number, yaw = 0) {
    const block = (dx: number, dy: number, dz: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const co = Math.cos(yaw), si = Math.sin(yaw);
      box(mat, 'Stepped dougong bracket', x + (dx * co + dz * si) * scale, y + dy * scale,
        z + (-dx * si + dz * co) * scale, w * scale, h * scale, d * scale).rotation.y = yaw;
    };
    block(0, 0, 0, .38, .18, .37, mineral);
    part(bracketArm, lacquer, 'Flared carved bracket arm',x,y+.13*scale,z,scale,scale,scale).rotation.y=yaw;
    const lip = part(bracketArm,gold,'Hammered brass bracket facing',x+Math.sin(yaw)*.084*scale,y+.13*scale,z+Math.cos(yaw)*.084*scale,scale,.73*scale,.10*scale);
    lip.rotation.y=yaw;
    for (const side of [-1, 1]) {
      block(side * .29, .235, 0, .18, .14, .28, mineral);
      block(side * .29, .34, .09, .25, .09, .54, mineral);
      block(side * .29, .405, .30, .21, .065, .13, gold);
    }
    block(0, .445, .09, 1.05, .12, .24, lacquer);
  }

  const drawCanvas = (width: number, height: number) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; textures.push(texture);
    return { ctx: canvas.getContext('2d')!, texture };
  };
  const band = drawCanvas(1024, 224);
  band.ctx.fillStyle = '#345952'; band.ctx.fillRect(0, 0, 1024, 224);
  band.ctx.fillStyle = '#c49f61';
  for (const y of [7, 18, 202, 213]) band.ctx.fillRect(0, y, 1024, 3);
  band.texture.wrapS = THREE.RepeatWrapping;
  const image = new Image();
  const ready = new Promise<void>(resolve => {
    image.onload = () => {
      if (!disposed) {
        band.ctx.drawImage(image, 0, 0, 1024, 224); band.texture.needsUpdate = true;
      }
      resolve();
    };
    image.onerror = () => resolve(); image.src = assetRoot+'cloud-crane-frieze.webp';
  });
  async function surfaceMap(name: string, targets: THREE.MeshStandardMaterial[], channel: 'map' | 'normalMap' | 'roughnessMap' = 'map') {
    const empty = targets.filter(material => !material[channel]);
    if (empty.length) {
      const neutral = neutralSurfaceMap(channel);
      textures.push(neutral);
      for (const material of empty) material[channel] = neutral;
    }
    try {
      const tex = await new THREE.TextureLoader().loadAsync(assetRoot+name);
      if (disposed) { tex.dispose(); return; }
      tex.colorSpace = channel === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
      textures.push(tex);
      for (const material of targets) material[channel] = tex;
    } catch { /* The authored base colour and relief remain usable. */ }
  }
  lacquer.normalScale.setScalar(.22);
  cut.normalScale.copy(lacquer.normalScale);
  cedar.normalScale.setScalar(.24);
  const surfaceImages = Promise.all([
    surfaceMap('honed-limestone.webp', [m.stone, m.sideStone]),
    surfaceMap('flagstone-normal.webp', [m.stone, m.sideStone], 'normalMap'),
    surfaceMap('lacquer-grain.webp', [lacquer,cedar,jujube,cut]),
    surfaceMap('timber-normal.webp', [lacquer,cedar,cut], 'normalMap'),
    surfaceMap('timber-rough.webp', [lacquer,cedar,cut], 'roughnessMap'),
    surfaceMap('limewash-color.webp', [m.plaster,m.archivePlaster]),
    surfaceMap('limewash-normal.webp', [m.plaster,m.archivePlaster], 'normalMap'),
    surfaceMap('fired-tile-grain.webp', [glazed]),
    surfaceMap('fired-tile-rough.webp', [glazed], 'roughnessMap'),
  ]);
  const mural = new THREE.MeshStandardMaterial({ name: 'Mineral-pigment crane painting', map: band.texture, roughness: .9 });
  function paintedBeam(x: number, y: number, z: number, width: number, height: number, depth: number) {
    box(lacquer, 'Painted lintel frame', x, y, z, width, height, depth);
    const field = new THREE.PlaneGeometry(width - .10, height - .075);
    // Each painted panel occupies a bay. Preserve the proportions of its two cranes.
    const repeats = Math.max(1,Math.round((width-.10)/((height-.075)*4.1)));
    const uv = field.attributes.uv;
    for (let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*repeats);
    for (const sign of [-1, 1]) {
      const face = part(field, mural, 'Cloud and crane frieze', x, y, z + sign * (depth / 2 + .004));
      if (sign < 0) face.rotation.y = Math.PI;
      box(gold, 'Fine ochre fillet', x, y - height / 2 + .023, z + sign * depth / 2, width, .018, .026);
    }
  }
  function plaque(zh: string, english: string, x: number, y: number, z: number, w: number, h: number) {
    box(m.timber, 'Carved plaque backing', x, y, z, w + .09, h + .09, .115);
    const plate = drawCanvas(768, 224), ctx = plate.ctx;
    ctx.fillStyle = '#223b35'; ctx.fillRect(0, 0, 768, 224);
    ctx.strokeStyle = '#bca26c'; ctx.lineWidth = 3; ctx.strokeRect(10, 9, 748, 206);
    ctx.lineWidth = 1.7; ctx.strokeRect(18, 17, 732, 190);
    for (const cx of [30, 738]) for (const cy of [29, 195]) { ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#efcf8b';
    ctx.font = en ? '68px Georgia, serif' : '132px KaiTi, STKaiti, "Courtyard Lettering", "Noto Serif SC", serif';
    ctx.fillText(en ? english : zh, 384, en ? 119 : 117, 666);
    const face = new THREE.MeshStandardMaterial({ map: plate.texture, roughness: .7 });
    part(new THREE.PlaneGeometry(w, h), face, 'Hall name tablet', x, y, z + .061);
  }
  function lantern(x: number, top: number, z: number, s: number) {
    const profiles = [[.13, -.63], [.23, -.60], [.275, -.48], [.268, -.27], [.205, -.17], [.126, -.15]];
    const lanternGeometry = new THREE.LatheGeometry(profiles.map(([r, h]) => new THREE.Vector2(r * s, h * s)), 12);
    part(lanternGeometry, silk, 'Pleated hanging silk lantern', x, top, z);
    for (const [r, y, h] of [[.178, -.62, .046], [.17, -.15, .047], [.052, -.71, .13], [.019, -.071, .14]]) {
      part(disk, m.timber, 'Lantern cap and cord', x, top + y * s, z, r * s, h * s, r * s);
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, pts = profiles.map(([r, h]) => new THREE.Vector3((r + .003) * Math.sin(a) * s, h * s, (r + .003) * Math.cos(a) * s));
      part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 9, .006 * s, 4, false), gold, 'Woven silk rib', x, top, z);
    }
    turned('Silk tassel', lacquer, x, top - 1.03 * s, z, [[.031*s, 0], [.044*s, .018*s], [.023*s, .21*s], [.012*s, .26*s]], 12);
  }
  function ridgeCrest(x: number, z: number, y: number, half: number, s: number) {
    const path = new THREE.CatmullRomCurve3([-1, -.83, 0, .83, 1].map(t => new THREE.Vector3(t * half, .13 * s * Math.abs(t) ** 5, 0)));
    part(new THREE.TubeGeometry(path, 24, .092 * s, 12, false), ridge, 'Continuous ridge cap', x, y, z);
    const tail = new THREE.Shape();
    tail.moveTo(-.30, -.055); tail.quadraticCurveTo(.01, .005, .21, .53); tail.quadraticCurveTo(.32, .53, .28, .35);
    tail.quadraticCurveTo(.23, .10, .49, .16); tail.quadraticCurveTo(.41, -.01, .16, -.065); tail.closePath();
    const g = new THREE.ExtrudeGeometry(tail, { depth:.105, bevelEnabled:true, bevelSize:.013, bevelThickness:.012, bevelSegments:1, curveSegments:12 });
    g.translate(0, 0, -.053);
    for (const side of [-1, 1]) {
      const obj = part(g, ridge, 'Fish-tail ridge ornament', x + side * half, y + .09*s, z, s, s, s);
      if (side < 0) obj.rotation.y = Math.PI;
    }
  }
  function sunFinial(y: number, z: number) {
    const base = y + .26;
    turned('Lotus seat for the sun',gold,0,y,z,[[.29,0],[.31,.04],[.26,.10],[.15,.15],[.12,.24],[.08,.28]],16);
    const cy = base + .39;
    const rim = new THREE.TorusGeometry(.42,.032,8,44);
    part(rim,gold,'Bronze solar rim',0,cy,z);
    part(new THREE.SphereGeometry(1,32,14),gold,'Beaten bronze sun',0,cy,z,.31,.31,.085);
    const ray = new THREE.ConeGeometry(.034,.21,5);
    for (let i=0;i<9;i++) {
      const a = (i-4)*Math.PI/8, length = i%2 ? .65 : 1;
      part(ray,gold,'Tapered solar ray',Math.sin(a)*(.42+.099*length),cy+Math.cos(a)*(.42+.099*length),z,1,length,.78).rotation.z=-a;
    }
    const cloud = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.10,.20,0),new THREE.Vector3(.35,.12,0),new THREE.Vector3(.57,.24,0),
      new THREE.Vector3(.50,.33,0),new THREE.Vector3(.45,.23,0),new THREE.Vector3(.70,.12,0),
      new THREE.Vector3(.92,.18,0),new THREE.Vector3(1.16,.13,0),
    ]);
    const scroll = new THREE.TubeGeometry(cloud,29,.030,6,false);
    for(const sign of [-1,1]) part(scroll,gold,'Cast cloud scroll',0,y,z).rotation.y=sign<0 ? Math.PI : 0;
  }
  // The principal hall occupies the broad north terrace. Both eaves read against the sky from the bridge.
  const northHall = new THREE.Group();
  northHall.name = 'North hall on its stone terrace';
  northHall.position.y = NORTH_HALL_RISE;
  group.add(northHall);
  assembly = northHall;
  const hallZ = -7.96;
  northHall.add(tiledRoof({ name:'North hall lower eaves', eave:rectangularRing(0,hallZ,8.02,4.02),
    ridge:rectangularRing(0,hallZ,5.12,1.48), height:5.70, rise:1.55, lift:.76, tileWidth:.235, gildedVerge:true },roofMaterials));
  const outerPosts = [-6.03,-3.20,3.20,6.03];
  for (const sign of [-1,1]) {
    const front = hallZ + sign*2.16, upper = hallZ + sign*1.40;
    box(cedar,'North hall soffit plate',0,5.19,front,12.30,.27,.41);
    paintedBeam(0,5.42,front,12.54,.36,.38);
    box(m.timber,'Framing behind the portico eaves',0,6.05,front,12.14,.98,.24);
    // A shadowed collar links the two roof surfaces. Tiny glimpses of warm panel
    // and bracket ends replace a tall, glowing storey between the tiled slopes.
    box(cedar,'Clerestory foot rail',0,7.23,upper,10.24,.13,.20);
    box(m.timber,'Recessed clerestory panels',0,7.63,upper,10.06,.78,.14);
    box(lacquer,'Clerestory upper plate',0,8.02,upper,10.24,.14,.26);
    box(m.timber,'Attic behind the upper eaves',0,8.44,upper,10.11,.78,.19);
    for (let bay=-2;bay<=2;bay++) {
      const x = bay*2.01, face = upper+sign*.10;
      box(cedar,'Clerestory raised panel',x,7.58,face,1.77,.39,.055);
      for(const dx of [-.65,-.32,0,.32,.65])
        box(lacquer,'Clerestory lattice stile',x+dx,7.58,face+sign*.04,.036,.41,.043);
      for(const h of [7.38,7.78])
        box(gold,'Clerestory ochre rail',x,h,face+sign*.04,1.81,.030,.046);
    }
    for(let j=0;j<6;j++){
      const x = (j-2.5)*2.01;
      box(lacquer,'Upper timber column',x,7.64,upper+sign*.12,.18,.89,.23);
      brackets(x,7.71,upper+sign*.16,.94,sign<0 ? Math.PI : 0);
    }
    box(cedar,'Gable infill below lower eaves',sign*6.055,5.00,hallZ,.18,2.61,4.34);
    box(m.timber,'Clerestory timber end',sign*5.02,8.00,hallZ,.16,1.66,2.86);
  }
  northHall.add(tiledRoof({ name:'North hall upper roof', eave:rectangularRing(0,hallZ,6.55,2.92),
    ridge:rectangularRing(0,hallZ,4.16,.025), height:8.15, rise:2.16, lift:.79, tileWidth:.235, gildedVerge:true },roofMaterials));
  ridgeCrest(0,hallZ,10.39,4.19,1.34);
  sunFinial(10.45,hallZ);
  for (const x of outerPosts) {
    post(x,-5.8,4.94,.21); brackets(x,4.90,-5.8,1.40);
    brackets(x,4.91,-9.84,1.26,Math.PI);
  }
  // A recessed cedar lining behind the artwork keeps the lit paper and round
  // screen legible as separate objects inside the deep, south-facing portico.
  box(cedar,'Cedar lining of the north hall',0,2.98,-9.833,12.04,5.34,.06);
  for (let i=-6;i<=6;i++) box(lacquer,'Lining stile',i*.955,2.95,-9.781,.054,5.13,.032);
  for (const y of [.61,3.78,4.00,4.96]) box(lacquer,'Lining rail',0,y,-9.78,12,.065,.040);

  // The stone dado and reed-lattice shutters flank the central door. Keep the
  // outer aisle in each bay open to the writing desk and the two hanging scrolls.
  const doorZ=-5.55, gateHalf=1.71, shutterWidth=1.29;
  for(const side of [-1,1]) {
    const sx=side*(gateHalf+shutterWidth/2);
    box(m.sideStone,'Foot of the raised shutter bay',sx,.42,doorZ,shutterWidth+.10,.24,.25);
    box(m.stone,'Carved stone dado',sx,.65,doorZ,shutterWidth,.24,.21);
    box(m.sideStone,'Dado drip edge',sx,.79,doorZ,shutterWidth+.06,.08,.24);
    box(cedar,'Shutter waist panel',sx,1.29,doorZ,shutterWidth,.94,.13);
    box(lacquer,'Recessed timber door field',sx,1.29,doorZ+.076,shutterWidth-.19,.67,.04);
    box(cedar,'Raised lozenge in shutter panel',sx,1.29,doorZ+.104,.265,.265,.05).rotation.z=Math.PI/4;
    box(windowPaper,'Amber paper in the shutter',sx,2.64,doorZ,shutterWidth,1.87,.075);
    for (const edge of [-1,1]) {
      box(lacquer,'Rebated shutter jamb',sx+edge*(shutterWidth/2-.04),2.23,doorZ+.03,.085,2.95,.16);
      box(cedar,'Carved shutter inner border',sx+edge*(shutterWidth/2-.11),2.64,doorZ+.075,.048,1.82,.055);
    }
    for (const y of [1.75,3.54,3.68]) box(lacquer,'Shutter rail',sx,y,doorZ+.045,shutterWidth,.095,.14);
    for(const dx of [-.35,-.17,0,.17,.35])
      box(m.timber,'Reed lattice vertical',sx+dx,2.64,doorZ+.078,.039,1.76,.044);
    for(const y of [1.89,2.06,2.56,3.20,3.37])
      box(m.timber,'Reed lattice horizontal',sx,y,doorZ+.078,shutterWidth-.15,.034,.047);
    box(gold,'Flush bronze door pull',sx-side*.43,1.64,doorZ+.12,.035,.21,.029);
    obstacle(sx,doorZ,(shutterWidth+.10)/2,.125);

    const parapetX=side*5.42;
    box(m.sideStone,'Porch terrace footing',parapetX,.345,-5.69,1.30,.10,.46);
    hallRail([[parapetX-.48,-5.69],[parapetX+.48,-5.69]],.82,.395+NORTH_HALL_RISE);
    obstacle(parapetX,-5.69,.63,.255);
  }
  box(m.timber,'Recessed central lintel',0,4.22,doorZ,6.15,1.02,.24);
  for(const x of [-2.83,-2.48,-2.13,-1.78,1.78,2.13,2.48,2.83])
    box(cedar,'Deep lintel battens',x,4.22,doorZ+.14,.052,.84,.065);
  paintedBeam(0,3.77,doorZ,6.20,.22,.32);
  box(cedar,'Central collar above the name tablet',0,4.91,doorZ,6.22,.35,.31);
  for(const side of [-1,1]) {
    const x=side*(gateHalf+.08);
    part(cylinder,lacquer,'Twin inner door columns',x,2.76,doorZ+.04,.105,4.20,.105);
    brackets(x,4.84,doorZ+.03,.81);
    box(cedar,'Door column collar',x,1.81,doorZ+.04,.22,.10,.22);
    for(const y of [.44,1.80,4.68])
      part(disk,gold,'Fine column ring',x,y,doorZ+.04,.112,.024,.112);
  }
  // Deep raised transoms leave the central opening and its first-person sightline clear.
  for (const side of [-1,1]) {
    const x=4.615*side;
    box(cedar,'Hall side-bay transom',x,4.46,-5.79,2.60,1.12,.14);
    for(const dx of [-1.13,-.76,-.38,0,.38,.76,1.13])
      box(m.timber,'Hall transom stile',x+dx,4.46,-5.68,.064,.98,.075);
    for(const y of [3.99,4.17,4.77,4.91])
      box(m.timber,'Raised transom fillet',x,y,-5.65,2.62,.04,.049);
    paintedBeam(x,3.86,-5.76,2.66,.20,.28);
  }
  plaque('雲 庭 書 齋','Cloud Court Study',0,4.29,doorZ+.18,2.61,.64);
  for (const x of [-3.16,3.16]) lantern(x,4.75,-5.06,.98);
  assembly = group;
  for (const sign of [-1,1]) {
    const x = sign * 4.75;
    group.add(tiledRoof({ name:sign<0?'Library roof':'Instrument hall roof', eave:rectangularRing(x,-2.46,2.12,3.87),
      ridge:rectangularRing(x,-2.46,.022,2.12),height:3.33,rise:.94,lift:.48 },roofMaterials));
    const windowX=sign*4.65, front=.763;
    box(cedar,'Timber apron of the courtyard wing',windowX,.76,front,2.89,.51,.089);
    for(const dx of [-1.25,-.62,0,.62,1.25])
      box(lacquer,'Wing apron stile',windowX+dx,.76,front+.052,.050,.53,.048);
    for(const y of sign < 0 ? [.50,1.01] : [.50,1.01,2.86])
      box(cedar,'Window reveal rail',windowX,y,front,2.91,.083,.16);
    if (sign > 0) {
      for(const dx of [-1.31,-1.13,1.13,1.31])
        box(cedar,'Boarded window cheek',windowX+dx,1.92,front,.155,1.81,.096);
      for(const dx of [-.83,-.65,.65,.83])
        box(m.timber,'Open side-bay lattice',windowX+dx,1.92,front-.038,.037,1.73,.047);
      for(const side of [-1,1]) for(const y of [1.26,2.58])
        box(m.timber,'Short rail in the wing lattice',windowX+side*.82,y,front-.03,.40,.037,.049);
    }
    paintedBeam(windowX,3.03,.71,2.91,.24,.25);
    for (const z of [-4.22,.52]) brackets(sign*3.2,2.93,z,.66,Math.PI/2);
  }
  // A free-standing timber portal leaves the pools, side houses and distant eaves visible.
  for (const sign of [-1,1]) {
    hallRail([[sign*1.86,8.4],[sign*3.40,8.4],[sign*4.88,8.4],[sign*6.35,8.4]],.83);
    obstacle(sign*4.105,8.40,2.245,.17);
    // The two returns flank the gallery access. The clear 2.87 m passage belongs to the route out to the pavilion.
    hallRail([[sign*6.35,.72],[sign*6.35,2.65],[sign*6.35,4.61]],.86);
    hallRail([[sign*6.35,8.4],[sign*6.35,7.76]],.83,.296,true);
    obstacle(sign*6.35,2.68,.13,2.07);
    obstacle(sign*6.35,8.01,.13,.39);
    // The inner eave terminates inside the wing wall; the outer drip edge stays above the gallery.
    group.add(tiledRoof({name:'Covered hillside gallery',eave:rectangularRing(sign*7.41,.95,1.24,7.03),
      ridge:rectangularRing(sign*7.28,.95,.025,5.93),height:3.10,rise:.59,lift:.21},roofMaterials));
  }
  // Cross the threshold as soon as the bridge opens out onto the main island.
  const gateZ=13.22;
  // Viewed from the bridge, the first line is on the right and both read downwards.
  for (const x of [-2.00,2.00]) {
    for (const side of [-1,1]) {
      const z=gateZ+side*.43;
      const line = x > 0 ? '青山流云皆入境' : '旧忆新知尽成篇';
      post(x,z,2.76,.19,side > 0 ? line : undefined);
      brackets(x,2.71,z,.89,side<0 ? Math.PI : 0);
    }
  }
  for(const side of [-1,1]) paintedBeam(0,3.00,gateZ+side*.45,4.58,.28,.27);
  group.add(tiledRoof({ name:'Southern mountain gate', eave:rectangularRing(0,gateZ,2.99,1.21),
    ridge:rectangularRing(0,gateZ,1.92,.018),height:3.20,rise:.89,lift:.50,tileWidth:.18,gildedVerge:true },roofMaterials));
  ridgeCrest(0,gateZ,4.15,1.94,.72);
  plaque('雲 庭','Cloud Court',0,2.91,gateZ+.63,1.27,.36);
  for (const side of [-1,1]) lantern(side*2,2.99,gateZ+.67,.58);

  for (const px of [-10.18,10.18]) {
    const pz = 4.92;
    const columns = hexagonalRing(px,pz,1.91);
    columns.forEach((p,i) => {
      post(p.x,p.y,2.75,.099);
      const q = columns[(i+1)%columns.length];
      rail(new THREE.Vector3(p.x,2.91,p.y), new THREE.Vector3(q.x,2.91,q.y), .16,.19,mineral);
      brackets(p.x,2.71,p.y,.67,i*Math.PI/3);
    });
    group.add(tiledRoof({ name:'Six-sided cloud pavilion',eave:hexagonalRing(px,pz,2.52),ridge:hexagonalRing(px,pz,.095),
      height:3.08,rise:1.38,lift:.47,tileWidth:.19 },roofMaterials));
    turned('Bronze gourd finial',gold,px,4.46,pz,[[.13,0],[.14,.055],[.085,.10],[.128,.20],[.065,.27],[.043,.29],[.079,.36],[.048,.43],[.009,.51],[0,.55]]);
  }
  textures.push(buildGoSetting(group, m.stone, m.sideStone, cedar, jujube, gold, obstacle));
  for (const side of [-1,1]) lantern(10.18 + side * 1.17, 2.97, 5.98, .68);
  // The gravel forecourt receives the stone span at the mountain gate.
  box(m.stone,'Gate approach paving',0,.17,13.625,3.3,.24,4.25);
  for (const sign of [-1,1]) {
    const lx=sign*2.72,lz=10.75;
    box(m.stone,'Stone lantern foot',lx,.39,lz,.54,.18,.54);
    turned('Carved stone lantern pedestal',m.stone,lx,.47,lz,[[.24,0],[.24,.09],[.16,.15],[.105,.22],[.13,.46],[.19,.52],[.24,.56],[.21,.63]],8);
    part(disk,silk,'Amber light in stone lantern',lx,1.29,lz,.166,.39,.166);
    for (const dx of [-.162,.162]) for (const dz of [-.162,.162])
      box(m.stone,'Stone lantern jamb',lx+dx,1.28,lz+dz,.058,.41,.058);
    turned('Stone lantern cap',m.stone,lx,1.47,lz,[[.33,0],[.35,.055],[.24,.11],[.12,.22],[.064,.24],[.073,.31],[.012,.37]],8);
    obstacle(lx,lz,.27,.27);
  }
  return {
    group, ready: Promise.all([ready, surfaceImages]).then(() => {}),
    updateGateLight(time: number, eye: THREE.Vector3, reducedMotion: boolean) {
      const distance = Math.hypot(eye.x, eye.z - gateZ);
      const near = 1 - THREE.MathUtils.smoothstep(distance, 2, 11);
      const breath = reducedMotion ? 0 : .034 * Math.sin(time * Math.PI / 3.5);
      cut.emissiveIntensity = .09 + near * (.26 + breath);
    },
    dispose() { disposed = true; textures.forEach(texture => texture.dispose()); },
  };
}
