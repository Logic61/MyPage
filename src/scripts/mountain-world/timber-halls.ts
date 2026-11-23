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
  const lacquer = new THREE.MeshStandardMaterial({ name: 'Oxide red lacquer', color: '#8d4636', roughness: .72 });
  const mineral = new THREE.MeshStandardMaterial({ name: 'Mineral green bracket paint', color: '#495e56', roughness: .86 });
  const gold = new THREE.MeshStandardMaterial({ name: 'Worn ochre gilding', color: '#cda669', metalness: .34, roughness: .51 });
  const glazed = new THREE.MeshStandardMaterial({ name: 'Celadon barrel tiles', vertexColors: true, roughness: .88, metalness: .025 });
  const ridge = new THREE.MeshStandardMaterial({ name: 'Dark glazed ridge clay', color: '#354d4a', roughness: .73 });
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
  // Bearing blocks and interlocking arms reach from the column head to the eaves.
  function brackets(x: number, y: number, z: number, scale: number, yaw = 0) {
    const block = (dx: number, dy: number, dz: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const co = Math.cos(yaw), si = Math.sin(yaw);
      box(mat, 'Stepped dougong bracket', x + (dx * co + dz * si) * scale, y + dy * scale,
        z + (-dx * si + dz * co) * scale, w * scale, h * scale, d * scale).rotation.y = yaw;
    };
    block(0, 0, 0, .38, .18, .37, mineral);
    block(0, .13, 0, .77, .11, .20, lacquer);
    for (const side of [-1, 1]) {
      block(side * .29, .235, 0, .18, .14, .28, mineral);
      block(side * .29, .34, .09, .25, .09, .54, mineral);
      block(side * .29, .405, .30, .19, .046, .11, gold);
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
  // The lower roof surrounds a timber clerestory. The upper roof and ridge run across the hall.
  const hallZ = -7.96;
  group.add(tiledRoof({ name:'North hall lower eaves', eave:rectangularRing(0,hallZ,6.94,3.04),
    ridge:rectangularRing(0,hallZ,4.63,1.32), height:4.10, rise:.85, lift:.46 },roofMaterials));
  for (const side of [-1, 1]) {
    const z=hallZ+side*1.27;
    box(m.plaster,'Upper hall end wall',side*4.54,5.98,hallZ,.17,2.15,2.6);
    box(lacquer,'Upper hall lower rail',0,5.16,z,9.15,.39,.19);
    box(m.timber,'Upper hall window sill',0,5.42,z,9.18,.09,.24);
    box(m.soffit,'Warm window backing',0,5.96,z,9.1,1.10,.08);
    paintedBeam(0,6.69,z,9.26,.35,.20);
    for (let j=-3;j<=3;j++) {
      const centre=j*1.28;
      box(lacquer,'Upper storey column',centre-.64,6.02,z+side*.09,.093,1.47,.12);
      const face=z+side*.14;
      for (const offset of [-.38,0,.38]) {
        box(mineral,'Window mullion',centre+offset,5.98,face,.035,1.05,.032);
      }
      for (const y of [5.58,6.22,6.39]) box(m.timber,'Window transom',centre,y,face,1.22,.032,.04);
    }
    box(lacquer,'Closing upper storey column',4.48,6.02,z+side*.09,.093,1.47,.12);
  }
  group.add(tiledRoof({ name:'North hall upper roof', eave:rectangularRing(0,hallZ,5.30,1.98),
    ridge:rectangularRing(0,hallZ,3.63,.025), height:6.83, rise:1.99, lift:.55 },roofMaterials));
  ridgeCrest(0,hallZ,8.90,3.68,1.12);
  paintedBeam(0,3.86,-5.78,12.4,.42,.31);
  for (const x of [-6.03,-3.2,3.2,6.03]) { post(x,-5.8,3.50,.145); brackets(x,3.47,-5.8,1.0); }
  plaque('雲 庭 書 齋','Cloud Court Study',0,3.80,-5.53,1.90,.50);
  for (const x of [-2.66,2.66]) lantern(x,3.70,-5.46,.70);
  for (const sign of [-1,1]) {
    const x = sign * 4.75;
    group.add(tiledRoof({ name:sign<0?'Library roof':'Instrument hall roof', eave:rectangularRing(x,-2.46,1.99,3.81),
      ridge:rectangularRing(x,-2.46,.022,2.24),height:3.40,rise:.98,lift:.35 },roofMaterials));
    paintedBeam(x,3.05,.68,2.85,.22,.22);
    for (const z of [-4.22,.52]) brackets(sign*3.2,2.93,z,.66,Math.PI/2);
  }
  function gardenWall(left: number, right: number, centre: number) {
    const top = 2.18, h = 1.43, radius = .58;
    const wall = new THREE.Shape();
    wall.moveTo(left,.3); wall.lineTo(right,.3); wall.lineTo(right,top); wall.lineTo(left,top); wall.closePath();
    const hole = new THREE.Path(), count = 64;
    const circle = Array.from({ length:count }, (_,i) => {
      const a = Math.PI/8 - i*2*Math.PI/count;
      return new THREE.Vector2(centre + radius*Math.cos(a), h+radius*Math.sin(a));
    });
    circle.forEach((p,i) => i ? hole.lineTo(p.x,p.y) : hole.moveTo(p.x,p.y));
    hole.closePath(); wall.holes.push(hole);
    const skin = new THREE.ExtrudeGeometry(wall,{depth:.29,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.012,bevelThickness:.008});
    part(skin,m.plaster,'Lime wall with pierced garden window',0,0,8.255);
    for (const z of [8.25,8.55]) {
      const rim = new THREE.Shape(), voidPath = new THREE.Path();
      circle.forEach((p,i) => {
        const x=centre+(p.x-centre)*1.15,y=h+(p.y-h)*1.15;
        if (i) { rim.lineTo(x,y); voidPath.lineTo(p.x,p.y); } else { rim.moveTo(x,y); voidPath.moveTo(p.x,p.y); }
      });
      rim.closePath(); voidPath.closePath(); rim.holes.push(voidPath);
      part(new THREE.ExtrudeGeometry(rim,{depth:.025,bevelEnabled:false}),m.stone,'Dressed stone window reveal',0,0,z);
    }
    const mid=(left+right)/2, half=(right-left)/2;
    box(m.stone,'Stone wall footing',mid,.43,8.4,right-left,.25,.33);
    obstacle(mid,8.4,half,.16);
    group.add(tiledRoof({name:'Glazed garden-wall coping',eave:rectangularRing(mid,8.4,half+.045,.27),
      ridge:rectangularRing(mid,8.4,half-.025,.01),height:top+.044,rise:.11,lift:.048,tileWidth:.17},roofMaterials));
  }
  gardenWall(-6.35,-1.74,-4.20); gardenWall(1.74,6.35,4.20);
  for (const sign of [-1,1]) {
    group.add(tiledRoof({name:'Covered hillside gallery',eave:rectangularRing(sign*7.28,.95,1.37,7.03),
      ridge:rectangularRing(sign*7.28,.95,.025,5.93),height:3.10,rise:.59,lift:.21},roofMaterials));
  }
  // A shallow hipped gate opens a sightline through the water court to the round silk screen.
  for (const x of [-1.74,1.74]) {
    for (const z of [8.02,8.78]) { post(x,z,2.82,.155); brackets(x,2.79,z,.88); }
  }
  paintedBeam(0,3.06,8.80,4.19,.37,.27);
  paintedBeam(0,3.06,8.00,4.19,.37,.27);
  group.add(tiledRoof({ name:'Southern mountain gate', eave:rectangularRing(0,8.40,2.76,1.36),
    ridge:rectangularRing(0,8.40,1.68,.018),height:3.30,rise:.91,lift:.43,tileWidth:.176 },roofMaterials));
  ridgeCrest(0,8.4,4.27,1.71,.78);
  plaque('雲 庭','Cloud Court',0,3.05,9.00,1.17,.41);
  for (const x of [-1.80,1.80]) lantern(x,3.19,9.30,.68);

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
  // Flush approach bridge, with open stone balustrades receding towards the gateway.
  box(m.stone,'Stone bridge bed',0,.06,15.75,4.25,.44,8.50);
  for (const sign of [-1,1]) {
    const x=sign*2.05;
    for (let z=12.2; z<20; z+=1.82) {
      box(m.stone,'Balustrade pier',x,.73,z,.205,.86,.21);
      turned('Lotus pier cap',m.stone,x,1.15,z,[[.16,0],[.145,.055],[.087,.089],[.115,.15],[.085,.21],[.019,.25],[0,.27]],12);
      if (z>17.8) continue;
      box(m.stone,'Bridge handrail',x,1.025,z+.91,.14,.10,1.84);
      box(m.stone,'Stone lower rail',x,.51,z+.91,.105,.095,1.84);
      for (const dz of [.40,.91,1.42]) box(m.stone,'Bridge baluster',x,.76,z+dz,.073,.49,.077);
    }
    obstacle(x,15.82,.12,3.72);
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
