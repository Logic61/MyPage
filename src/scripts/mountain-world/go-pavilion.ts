import * as THREE from 'three';
import { architecturalBlock, seeded } from './environment-geometry';

const boardWidth = .84;
const margin = .061;
const lineSpacing = boardWidth * (1 - margin * 2) / 18;

/** The lines and their nine star points share the same scale as the stones placed on them. */
function makeBoardFace() {
  const canvas = document.createElement('canvas');
  const size = 1024;
  canvas.width = canvas.height = size;
  const ink = canvas.getContext('2d')!;
  const grain = seeded(4938);
  ink.fillStyle = '#be8e52';
  ink.fillRect(0, 0, size, size);
  for (let i = 0; i < 580; i++) {
    const y = grain() * size;
    const wave = (grain() - .5) * 25;
    ink.beginPath();
    ink.moveTo(0, y);
    ink.bezierCurveTo(270, y + wave, 610, y - wave, size, y + wave * .32);
    ink.strokeStyle = i % 3 ? 'rgba(105,59,25,.16)' : 'rgba(255,221,155,.25)';
    ink.lineWidth = .6 + grain() * 2;
    ink.stroke();
  }
  const grid = (n: number) => size * (margin + (1 - margin * 2) * n / 18);
  ink.strokeStyle = '#513c2a';
  ink.lineWidth = 2.1;
  ink.beginPath();
  for (let i = 0; i < 19; i++) {
    ink.moveTo(grid(i), grid(0)); ink.lineTo(grid(i), grid(18));
    ink.moveTo(grid(0), grid(i)); ink.lineTo(grid(18), grid(i));
  }
  ink.stroke();
  ink.fillStyle = '#433224';
  for (const row of [3, 9, 15]) for (const col of [3, 9, 15]) {
    ink.beginPath(); ink.arc(grid(col), grid(row), 5.2, 0, Math.PI * 2); ink.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

export function buildGoSetting(parent: THREE.Group, stone: THREE.Material, shadowStone: THREE.Material,
  timber: THREE.Material, bowlWood: THREE.Material, gold: THREE.Material, obstacle: (x: number, z: number, hx: number, hz: number) => void) {
  const x = -10.18, z = 4.92;
  const setting = new THREE.Group();
  setting.name = 'West pavilion stone Go table and drum stools';
  setting.position.set(x, .3, z);
  parent.add(setting);
  const bronze = new THREE.MeshStandardMaterial({ name: 'Verdigris waist of the Go pedestal', color: '#476c61', roughness: .52, metalness: .50 });
  const black = new THREE.MeshPhysicalMaterial({ name: 'Slate Go counters', color: '#222526', roughness: .32, clearcoat: .38 });
  const white = new THREE.MeshPhysicalMaterial({ name: 'Shell Go counters', color: '#f1e5cd', roughness: .35, clearcoat: .30 });
  function set(g: THREE.BufferGeometry, m: THREE.Material, name: string, px: number, py: number, pz: number) {
    const part = new THREE.Mesh(g, m);
    part.name = name; part.position.set(px, py, pz); part.castShadow = part.receiveShadow = true;
    setting.add(part);
    return part;
  }
  function profile(points: number[][], sides = 32) {
    return new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), sides);
  }
  function slab(w: number, h: number, d: number, bevel: number, m: THREE.Material, y: number, name: string) {
    return set(architecturalBlock(w, h, d, bevel), m, name, 0, y, 0);
  }
  set(profile([[.43, 0], [.43, .056], [.41, .072], [.363, .074], [.356, .112], [.315, .131], [.30, .172],
    [.22, .219], [.22, .266], [.26, .287], [.31, .336], [.366, .397], [.39, .413]], 8),
    stone, 'Octagonal lotus pedestal in dressed stone', 0, 0, 0);
  set(profile([[.251, 0], [.248, .012], [.229, .022], [.229, .077], [.254, .086]], 32), bronze, 'Patinated bronze waist', 0, .192, 0);
  for (const y of [.207, .264]) set(profile([[.235, 0], [.239, .004], [.235, .009]]), gold, 'Raised rim of the bronze waist', 0, y, 0);
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0,0); petalShape.bezierCurveTo(-.035,.031,-.063,.055,0,.115);
  petalShape.bezierCurveTo(.06,.06,.043,.039,0,0);
  const petal = new THREE.ExtrudeGeometry(petalShape,{depth:.012,bevelEnabled:true,bevelSegments:2,bevelSize:.006,bevelThickness:.007,curveSegments:8});
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 2 * i / 16;
    const leaf = set(petal, stone, 'Lotus petal carved in the table capital', Math.sin(a)*.284, .274, Math.cos(a)*.284);
    leaf.rotation.set(.57, a, 0, 'YXZ');
  }
  slab(1.26,.067,1.13,.020,shadowStone,.448,'Shadow course beneath the playing slab');
  slab(1.41,.115,1.28,.034,stone,.529,'Bevelled limestone playing slab');
  const scroll = new THREE.CurvePath<THREE.Vector3>();
  const v = (a: number,b: number) => new THREE.Vector3(a,b,0);
  scroll.add(new THREE.CubicBezierCurve3(v(-.10,.004),v(-.139,-.024),v(-.181,.006),v(-.142,.024)));
  scroll.add(new THREE.CubicBezierCurve3(v(-.142,.024),v(-.106,.037),v(-.078,-.025),v(-.038,-.011)));
  scroll.add(new THREE.CubicBezierCurve3(v(-.038,-.011),v(-.015,.005),v(.028,.032),v(.055,.012)));
  scroll.add(new THREE.CubicBezierCurve3(v(.055,.012),v(.083,-.011),v(.112,-.020),v(.135,.002)));
  scroll.add(new THREE.CubicBezierCurve3(v(.135,.002),v(.151,.030),v(.105,.030),v(.118,.008)));
  const ornament = new THREE.TubeGeometry(scroll,40,.0045,5,false);
  for (let side=0;side<4;side++) {
    const a = side*Math.PI/2, distance = side%2 ? .706 : .641;
    for (const sign of [-1,1]) {
      const s = sign*.293;
      set(ornament,gold,'Cloud inlay in the stone table apron',Math.sin(a)*distance+Math.cos(a)*s,
        .53, Math.cos(a)*distance-Math.sin(a)*s).rotation.y = a;
    }
  }
  slab(.906,.052,.906,.013,timber,.612,'Rebated hardwood Go board');
  const face = makeBoardFace();
  const plane = new THREE.PlaneGeometry(boardWidth,boardWidth).rotateX(-Math.PI / 2);
  set(plane,new THREE.MeshStandardMaterial({map:face,roughness:.66}), 'Nineteen-line end-grain playing field',0,.639,0);
  const marker = profile([[0,0],[.009,0],[.017,.003],[.019,.008],[.017,.013],[.010,.016],[0,.017]],20);
  const moves = [[-7,-6],[-5,6],[6,5],[4,-6],[-6,-4],[-4,-5],[4,6],[1,6],[-6,3],[-5,3],[-5,2],[-4,2],[-5,4],[5,-3],[6,-3],[5,-2],[3,4],[1,5],[-2,-1]];
  moves.forEach(([col,row],i) => set(marker,i % 2 ? white : black,'Placed Go stone',col*lineSpacing,.6396,row*lineSpacing));
  const bowl = profile([[0,.0],[.065,0],[.072,.009],[.074,.018],[.105,.039],[.120,.07],
    [.121,.102],[.114,.118],[.104,.12],[.100,.114],[.105,.092],[.101,.067],[.08,.041],[.034,.027],[0,.027]]);
  const lid = profile([[0,0],[.101,0],[.113,.008],[.115,.016],[.108,.023],[.083,.031],[.035,.037],[.024,.043],[.027,.05],[.021,.056],[0,.057]]);
  const mouthRing = profile([[.115,0],[.118,.0015],[.116,.0035]]);
  for (const sign of [-1,1]) {
    const bx = sign*.566, bz = sign*.338;
    set(bowl,bowlWood,'Hollow turned Go bowl',bx,.588,bz);
    set(mouthRing,timber,'Maple thread in the bowl rim',bx,.705,bz);
    if(sign===1) { set(lid,bowlWood,'Fitted persimmon-wood lid',bx,.703,bz); continue; }
    for (let i=0; i<27; i++) {
      const r=.081*Math.sqrt(i/26), a=i*2.4;
      set(marker,black,'Reserve stones in open bowl',bx+r*Math.cos(a),.669+.015*(1-r/.081),bz+r*Math.sin(a)).rotation.y=a;
    }
    set(lid,bowlWood,'Lid set beside the open bowl',bx,.588,bz+.248);
  }
  obstacle(x,z,.705,.64);
  const drum = profile([[0,0],[.205,0],[.218,.017],[.218,.045],[.196,.064],[.185,.11],
    [.208,.19],[.226,.258],[.223,.306],[.209,.337],[.218,.345],[.218,.38],[.203,.391],[0,.391]]);
  const drumRing = profile([[.215,0],[.22,.004],[.216,.011]]);
  for (const [dx,dz] of [[0,1.04],[0,-1.04],[1.1,0],[-1.1,0]]) {
    set(drum,stone,'Turned limestone drum seat',dx,0,dz);
    for (const h of [.029,.351]) set(drumRing,shadowStone,'Drum seat beaded ring',dx,h,dz);
    obstacle(x+dx,z+dz,.222,.222);
  }
  return face;
}
