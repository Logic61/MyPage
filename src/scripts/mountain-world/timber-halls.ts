import * as THREE from 'three';
import { hexagonalRing, rectangularRing, tiledRoof } from './tiled-roof';

interface Materials {
  timber: THREE.Material;
  stone: THREE.MeshStandardMaterial;
  sideStone: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  soffit: THREE.Material;
}
type Obstacle = (x: number, z: number, halfX: number, halfZ: number) => void;
const assetRoot = ((import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/, '')) + '/world/';

/** Roofs, posts and architectural decoration above the study's continuous walking plane. */
export function buildTimberHalls(parent: THREE.Group, m: Materials, obstacle: Obstacle, en: boolean) {
  const group = new THREE.Group();
  group.name = 'Cloud Court timber halls'; parent.add(group);
  const textures: THREE.Texture[] = [];
  let disposed = false;
  const lacquer = new THREE.MeshStandardMaterial({ name: 'Cinnabar stained cedar', color: '#b6634b', roughness: .69 });
  const mineral = new THREE.MeshStandardMaterial({ name: 'Deep teal beam ground', color: '#354a4c', roughness: .80 });
  const gold = new THREE.MeshStandardMaterial({ name: 'Aged bronze leaf', color: '#d7ad62', metalness: .36, roughness: .46 });
  const glazed = new THREE.MeshStandardMaterial({ name: 'Ink-blue fired pantiles', color: '#98ade0', vertexColors: true, roughness: .72, metalness: .07 });
  const ridge = new THREE.MeshStandardMaterial({ name: 'Blue-black glazed ridge clay', color: '#303e4c', roughness: .56 });
  const windowPaper = new THREE.MeshStandardMaterial({ name: 'Amber mulberry paper', color: '#d1ae70', emissive: '#6a431d', emissiveIntensity: .29, roughness: .98 });
  const silk = new THREE.MeshStandardMaterial({ name: 'Amber lantern silk', color: '#edbb76', emissive: '#bb5b25', emissiveIntensity: .37, roughness: .86 });
  const roofMaterials = { tile: glazed, ridge, soffit: m.soffit, timber: m.timber };
  const cube = new THREE.BoxGeometry(1, 1, 1), disk = new THREE.CylinderGeometry(1, 1, 1, 24);
  const cylinder = new THREE.CylinderGeometry(.93, 1, 1, 20);
  const up = new THREE.Vector3(0, 1, 0);
  function part(g: THREE.BufferGeometry, material: THREE.Material, name: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const obj = new THREE.Mesh(g, material); obj.name = name;
    obj.position.set(x, y, z); obj.scale.set(sx, sy, sz); obj.castShadow = obj.receiveShadow = true; group.add(obj); return obj;
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
  function post(x: number, z: number, top: number, radius: number) {
    const foot = radius * 1.5;
    box(m.stone, 'Square plinth', x, .385, z, foot * 2, .17, foot * 2);
    turned('Turned stone column shoe', m.stone, x, .465, z, [[foot, 0], [foot, .055], [foot * .83, .08], [foot * .80, .14], [radius * 1.10, .19]]);
    part(cylinder, lacquer, 'Lacquered timber pillar', x, (top + .65) / 2, z, radius, top - .65, radius);
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
    try {
      const tex = await new THREE.TextureLoader().loadAsync(assetRoot+name);
      if (disposed) { tex.dispose(); return; }
      tex.colorSpace = channel === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
      textures.push(tex);
      for (const mat of targets) { mat[channel] = tex; mat.needsUpdate = true; }
    } catch { /* The authored base colour and relief remain usable. */ }
  }
  lacquer.normalScale.setScalar(.22);
  const surfaceImages = Promise.all([
    surfaceMap('court-stone.webp', [m.stone, m.sideStone]),
    surfaceMap('flagstone-normal.webp', [m.stone, m.sideStone], 'normalMap'),
    surfaceMap('lacquer-grain.webp', [lacquer]),
    surfaceMap('timber-normal.webp', [lacquer], 'normalMap'),
    surfaceMap('timber-rough.webp', [lacquer], 'roughnessMap'),
    surfaceMap('limewash-color.webp', [m.plaster]),
    surfaceMap('limewash-normal.webp', [m.plaster], 'normalMap'),
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
    ctx.font = en ? '68px Georgia, serif' : '132px KaiTi, STKaiti, "Noto Serif SC", serif';
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
  const hallZ = -7.96;
  group.add(tiledRoof({ name:'North hall lower eaves', eave:rectangularRing(0,hallZ,7.58,3.66),
    ridge:rectangularRing(0,hallZ,5.10,1.44), height:4.81, rise:1.40, lift:.61, tileWidth:.23 },roofMaterials));
  const outerPosts = [-6.03,-3.20,3.20,6.03];
  for (const sign of [-1,1]) {
    const front = hallZ + sign*2.16, upper = hallZ + sign*1.40;
    box(mineral,'North hall shadow plate',0,4.38,front,12.24,.43,.26);
    paintedBeam(0,4.55,front,12.42,.36,.30);
    // Above the lower eaves, five cedar bays form a compact clerestory lantern.
    box(lacquer,'Clerestory foot rail',0,6.26,upper,10.24,.22,.18);
    box(windowPaper,'Recessed clerestory paper',0,6.92,upper,10.06,1.20,.12);
    box(lacquer,'Clerestory upper plate',0,7.52,upper,10.24,.16,.24);
    for (let bay=-2;bay<=2;bay++) {
      const x = bay*2.01, face = upper+sign*.10;
      for(const dx of [-.74,-.50,-.25,0,.25,.50,.74])
        box(m.timber,'Clerestory lattice stile',x+dx,6.88,face,.034,1.03,.047);
      for(const h of [6.51,6.62,7.14,7.25])
        box(m.timber,'Clerestory lattice rail',x,h,face,1.91,.034,.052);
    }
    for(let j=0;j<6;j++){
      const x = (j-2.5)*2.01;
      box(lacquer,'Upper timber column',x,6.94,upper+sign*.12,.16,1.42,.21);
      brackets(x,7.41,upper+sign*.16,.82,sign<0 ? Math.PI : 0);
    }
    box(m.plaster,'Gable infill below lower eaves',sign*6.055,4.32,hallZ,.16,.83,4.34);
    box(m.timber,'Clerestory timber end',sign*5.02,6.90,hallZ,.16,1.45,2.86);
  }
  group.add(tiledRoof({ name:'North hall upper roof', eave:rectangularRing(0,hallZ,6.12,2.42),
    ridge:rectangularRing(0,hallZ,4.24,.025), height:7.78, rise:2.42, lift:.76, tileWidth:.215 },roofMaterials));
  ridgeCrest(0,hallZ,10.28,4.27,1.34);
  sunFinial(10.34,hallZ);
  for (const x of outerPosts) {
    post(x,-5.8,4.12,.177); brackets(x,4.09,-5.8,1.22);
    brackets(x,4.09,-9.84,1.08,Math.PI);
  }
  // A recessed cedar lining behind the artwork keeps the lit paper and round
  // screen legible as separate objects inside the deep, south-facing portico.
  box(m.timber,'Cedar lining of the north hall',0,2.23,-9.833,12.02,3.72,.035);
  for (let i=-6;i<=6;i++) box(lacquer,'Lining stile',i*.955,2.25,-9.802,.044,3.64,.032);
  for (const y of [.61,3.78,4.00]) box(lacquer,'Lining rail',0,y,-9.801,12,.06,.035);

  // The stone dado and reed-lattice shutters flank the central door. Keep the
  // outer aisle in each bay open to the writing desk and the two hanging scrolls.
  const doorZ=-5.55, gateHalf=1.71, shutterWidth=1.29;
  for(const side of [-1,1]) {
    const sx=side*(gateHalf+shutterWidth/2);
    box(m.sideStone,'Foot of the raised shutter bay',sx,.42,doorZ,shutterWidth+.10,.24,.25);
    box(m.stone,'Carved stone dado',sx,.65,doorZ,shutterWidth,.24,.21);
    box(m.sideStone,'Dado drip edge',sx,.79,doorZ,shutterWidth+.06,.08,.24);
    box(lacquer,'Shutter waist panel',sx,1.18,doorZ,shutterWidth,.70,.12);
    box(m.timber,'Recessed timber door field',sx,1.18,doorZ+.067,shutterWidth-.19,.44,.038);
    box(windowPaper,'Amber paper in the shutter',sx,2.28,doorZ,shutterWidth,1.55,.075);
    for (const edge of [-1,1]) {
      box(lacquer,'Rebated shutter jamb',sx+edge*(shutterWidth/2-.04),2.21,doorZ+.03,.08,2.83,.16);
      box(m.timber,'Carved shutter inner border',sx+edge*(shutterWidth/2-.11),2.27,doorZ+.075,.032,1.52,.04);
    }
    for (const y of [1.55,2.99,3.12]) box(lacquer,'Shutter rail',sx,y,doorZ+.045,shutterWidth,.09,.14);
    for(const dx of [-.35,-.17,0,.17,.35])
      box(m.timber,'Reed lattice vertical',sx+dx,2.27,doorZ+.078,.034,1.35,.041);
    for(const y of [1.70,1.85,2.66,2.82])
      box(m.timber,'Reed lattice horizontal',sx,y,doorZ+.078,shutterWidth-.15,.032,.042);
    box(gold,'Flush bronze door pull',sx-side*.43,1.54,doorZ+.12,.035,.18,.029);
    obstacle(sx,doorZ,(shutterWidth+.10)/2,.125);

    const parapetX=side*5.42;
    box(m.sideStone,'Porch terrace footing',parapetX,.45,-5.69,1.26,.30,.51);
    box(m.stone,'Terrace sill stone',parapetX,.64,-5.69,1.24,.09,.44);
    for(const dx of [-.51,0,.51])
      box(m.stone,'Mullion in the terrace rail',parapetX+dx,.84,-5.69,.10,.36,.13);
    box(m.stone,'Low carved terrace rail',parapetX,1.07,-5.69,1.25,.12,.19);
    obstacle(parapetX,-5.69,.63,.255);
  }
  box(mineral,'Recessed central lintel',0,3.62,doorZ,6.05,.81,.22);
  for(const x of [-2.83,-2.48,-2.13,-1.78,1.78,2.13,2.48,2.83])
    box(lacquer,'Deep lintel battens',x,3.62,doorZ+.12,.047,.68,.058);
  paintedBeam(0,3.19,doorZ,6.13,.20,.30);
  // Deep raised transoms leave the central opening and its first-person sightline clear.
  for (const side of [-1,1]) {
    const x=4.615*side;
    box(mineral,'Hall side-bay transom',x,3.78,-5.79,2.60,.77,.11);
    for(const dx of [-1.13,-.76,-.38,0,.38,.76,1.13])
      box(m.timber,'Hall transom stile',x+dx,3.78,-5.70,.055,.70,.075);
    for(const y of [3.48,3.94,4.06])
      box(gold,'Weathered transom fillet',x,y,-5.66,2.62,.022,.038);
  }
  plaque('雲 庭 書 齋','Cloud Court Study',0,3.62,doorZ+.16,2.18,.53);
  for (const x of [-2.66,2.66]) lantern(x,4.05,-5.46,.83);
  for (const sign of [-1,1]) {
    const x = sign * 4.75;
    group.add(tiledRoof({ name:sign<0?'Library roof':'Instrument hall roof', eave:rectangularRing(x,-2.46,1.99,3.81),
      ridge:rectangularRing(x,-2.46,.022,2.24),height:3.40,rise:.98,lift:.35 },roofMaterials));
    paintedBeam(x,3.05,.68,2.85,.22,.22);
    for (const z of [-4.22,.52]) brackets(sign*3.2,2.93,z,.66,Math.PI/2);
  }
  // The approach opens to the lake through a three-bay timber gate; low stone rails
  // continue its base without filling the views beneath the two outer bay roofs.
  for (const sign of [-1,1]) {
    for(const [a,b] of [[1.86,3.40],[3.40,4.88],[4.88,6.35]]) {
      const middle=sign*(a+b)*.5;
      box(m.stone,'Low garden rail shoe',middle,.42,8.40,b-a,.22,.33);
      box(m.stone,'Bevelled garden rail cap',middle,.91,8.40,b-a,.105,.20);
      box(m.stone,'Garden rail baluster',middle,.65,8.40,.14,.44,.17);
      box(m.stone,'Garden rail pier',sign*b,.68,8.40,.25,.76,.28);
      turned('Faceted rail finial',m.stone,sign*b,1.055,8.40,[[.17,0],[.17,.055],[.13,.11],[.09,.17],[0,.22]],8);
    }
    obstacle(sign*4.105,8.40,2.245,.17);
    group.add(tiledRoof({name:'Covered hillside gallery',eave:rectangularRing(sign*7.28,.95,1.37,7.03),
      ridge:rectangularRing(sign*7.28,.95,.025,5.93),height:3.10,rise:.59,lift:.21},roofMaterials));
  }
  for (const x of [-1.86,1.86]) {
    for (const z of [8.04,8.76]) { post(x,z,2.53,.145); brackets(x,2.51,z,.80,z<8.4 ? Math.PI : 0); }
  }
  paintedBeam(0,2.78,8.78,4.25,.30,.25);
  paintedBeam(0,2.78,8.02,4.25,.30,.25);
  group.add(tiledRoof({ name:'Southern mountain gate', eave:rectangularRing(0,8.40,2.58,1.02),
    ridge:rectangularRing(0,8.40,1.72,.018),height:2.96,rise:.64,lift:.38,tileWidth:.17 },roofMaterials));
  ridgeCrest(0,8.4,3.66,1.74,.61);
  plaque('雲 庭','Cloud Court',0,2.72,8.96,1.22,.34);
  for (const side of [-1,1]) {
    const x = side * 2.67;
    post(side*3.40,8.40,2.15,.118);
    brackets(side*3.40,2.13,8.40,.55);
    paintedBeam(x,2.30,8.40,1.64,.20,.20);
    group.add(tiledRoof({name:'Gate side canopy',eave:rectangularRing(x,8.4,1.09,.64),
      ridge:rectangularRing(x,8.4,.57,.012),height:2.43,rise:.35,lift:.22,tileWidth:.18},roofMaterials));
    lantern(side*1.86,2.79,9.02,.56);
  }

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
      height:3.08,rise:1.66,lift:.38,tileWidth:.18 },roofMaterials));
    turned('Bronze gourd finial',gold,px,4.73,pz,[[.13,0],[.14,.055],[.085,.10],[.128,.20],[.065,.27],[.043,.29],[.079,.36],[.048,.43],[.009,.51],[0,.55]]);
  }
  // A stone Go table occupies the western pavilion, opposite the eastern lookout seat.
  const tx=-10.18,tz=4.92;
  turned('Carved chess-table pedestal',m.stone,tx,.30,tz,[[.33,0],[.33,.10],[.22,.15],[.17,.37],[.27,.44],[.34,.47]],8);
  box(m.stone,'Square stone Go table',tx,.81,tz,1.14,.10,1.14);
  box(m.soffit,'Go board',tx,.891,tz,.75,.062,.75);
  const spacing=.049;
  for (let i=-6;i<=6;i++) {
    box(m.timber,'Go lines',tx+i*spacing,.923,tz,.003,.002,12*spacing);
    box(m.timber,'Go lines',tx,.923,tz+i*spacing,12*spacing,.002,.003);
  }
  const piece=new THREE.SphereGeometry(1,12,6);
  for (const [i,j,white] of [[2,-3,1],[-3,4,1],[0,-2,1],[1,2,1],[-1,-2,0],[1,-3,0],[3,3,0],[-3,-3,0],[0,2,0]])
    part(piece,white?m.plaster:m.timber,'Go stone',tx+i*spacing,.934,tz+j*spacing,.022,.011,.022);
  obstacle(tx,tz,.57,.57);
  for (const z of [tz-.98,tz+.98]) {
    turned('Stone drum stool',m.stone,tx,.30,z,[[.23,0],[.23,.06],[.18,.12],[.21,.26],[.25,.35],[.23,.39],[0,.40]]);
    obstacle(tx,z,.25,.25);
  }
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
  return { group, ready: Promise.all([ready,surfaceImages]).then(() => {}), dispose() { disposed = true; textures.forEach(texture => texture.dispose()); } };
}
