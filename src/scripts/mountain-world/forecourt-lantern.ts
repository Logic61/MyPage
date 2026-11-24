import * as THREE from 'three';
import { gridSurface, seeded } from './environment-geometry';

const tau = Math.PI * 2;
const halfFace = Math.PI / 6;
const windowWidth = .245, windowHeight = .369, windowMiddle = 1.028, sillHeight = .851;
const windowDepth = .246*Math.cos(halfFace)-.006;

/** Rag paper with thicker strands around a softly backlit centre. Both lanterns share one small map. */
function mulberryPaper() {
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 240;
  const ctx = canvas.getContext('2d')!, rng = seeded(98241);
  const light = ctx.createRadialGradient(79,145,6,79,136,128);
  light.addColorStop(0,'#fff7e3'); light.addColorStop(.37,'#f6e6c9');
  light.addColorStop(.73,'#d8bb92'); light.addColorStop(1,'#b99d7b');
  ctx.fillStyle = light; ctx.fillRect(0,0,160,240);
  for (let i = 0; i < 880; i++) {
    const x = rng()*164-2, y = rng()*246-3, length = 1.6 + 11*rng()**2, angle = rng()*tau;
    const dx = Math.cos(angle)*length, dy = Math.sin(angle)*length;
    ctx.strokeStyle = i%3 ? 'rgba(100,87,61,.15)' : 'rgba(255,252,230,.46)';
    ctx.lineWidth = .35 + .50*rng(); ctx.beginPath(); ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+.45*dx-.28*dy,y+.45*dy+.28*dx,x+dx,y+dy); ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.name = 'Translucent mulberry fibres'; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return map;
}

function litPaper(map: THREE.Texture) {
  const paper = new THREE.MeshStandardMaterial({name:'Lit mulberry lantern paper',map,roughness:.98,
    emissive:'#fff1d6',emissiveMap:map,emissiveIntensity:.43,transparent:true,opacity:.992,depthWrite:true,side:THREE.DoubleSide});
  paper.onBeforeCompile = shader => {
    const varying = 'varying vec3 vPaperEye; varying vec3 vPaperPoint;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n'+varying)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 paperNormal = normalize(mat3(modelMatrix) * normal);
        vec3 across = normalize(cross(vec3(0.,1.,0.),paperNormal));
        vPaperPoint = vec3((uv.x-.5)*${windowWidth}, (uv.y-.5)*${windowHeight}+${windowMiddle-sillHeight}, ${windowDepth});
        vec3 origin = (modelMatrix * vec4(transformed,1.)).xyz - across*vPaperPoint.x
          - vec3(0.,vPaperPoint.y,0.) - paperNormal*vPaperPoint.z;
        vec3 view = cameraPosition-origin;
        vPaperEye = vec3(dot(view,across),view.y,dot(view,paperNormal));
      `);
    // Rag paper scatters almost all daylight. A small area transmits the adjacent flame and oil dish.
    // Project the viewing ray in each window's own frame so the single wick keeps its parallax at corners.
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n'+varying)
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec3 ray = normalize(vPaperPoint-vPaperEye);
        float distanceAlong = max(0.,-dot(vPaperPoint.xz,ray.xz)/max(dot(ray.xz,ray.xz),.001));
        vec3 atWick = vPaperPoint+ray*distanceAlong;
        float r2 = dot(atWick.xz,atWick.xz);
        float height = atWick.y-.055;
        float extent = r2/.0063+height*height/.0043;
        float transmitted = exp(-1.10*extent*extent);
        diffuseColor.a *= 1.-.90*transmitted;
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float halo = exp(-r2/.008-height*height/.010);
        totalEmissiveRadiance += vec3(.30,.18,.066)*halo;
      `);
  };
  return paper;
}

/** The hotter heart is visible through the gold envelope from any side of the lantern. */
function oilFlame() {
  const geometry = gridSurface(16,9,(u,v)=>{
    const angle=tau*u, radius=.040*Math.sin(Math.PI*v)**.61*(1-v)**2;
    return new THREE.Vector3(radius*Math.sin(angle)+.010*v*v,.084*v,radius*Math.cos(angle));
  });
  const material = new THREE.MeshBasicMaterial({name:'Golden flame with a hot wick'});
  material.onBeforeCompile = shader=>{
    const varying = 'varying vec3 vWickNormal; varying vec3 vWickView; varying float vWickHeight;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n'+varying)
      .replace('#include <project_vertex>', `
        #include <project_vertex>
        vWickNormal = normalMatrix*normal; vWickView = -mvPosition.xyz; vWickHeight = uv.y;
      `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n'+varying)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float facing = max(0.,dot(normalize(vWickNormal),normalize(vWickView)));
        float core = smoothstep(.79,.95,facing)*(1.-smoothstep(.27,.68,vWickHeight));
        diffuseColor.rgb = mix(vec3(1.75,.29,.025),vec3(3.05,2.42,1.56),core);
      `);
  };
  return {geometry,material};
}

function turned(points: number[][], sides = 24, start = 0) {
  return new THREE.LatheGeometry(points.map(([r,y]) => new THREE.Vector2(r,y)),sides,start);
}

/** A closed, overlapping stone leaf. Its section tapers to a point around a raised central vein. */
function lotusPetal(height: number, width: number, root: number, tip: number, bend: number) {
  return gridSurface(8,6,(u,v) => {
    const a = tau*u, span = Math.sin(Math.PI*v)**.73, front = Math.cos(a);
    const radius = THREE.MathUtils.lerp(root,tip,v) + bend*Math.sin(Math.PI*v);
    const relief = span*width*(.20*front + .11*Math.max(0,front)**8);
    return new THREE.Vector3(width*span*Math.sin(a),height*v,radius+relief);
  });
}

/** A pierced ruyi diamond spanning the transom, cut through to the paper behind it. */
function transom() {
  const shape = new THREE.Shape();
  shape.moveTo(0,.047); shape.lineTo(.020,.027); shape.quadraticCurveTo(.041,.030,.051,.015);
  shape.lineTo(.064,.005); shape.lineTo(.121,.005); shape.lineTo(.121,-.005); shape.lineTo(.064,-.005);
  shape.lineTo(.051,-.015); shape.quadraticCurveTo(.041,-.030,.020,-.027); shape.lineTo(0,-.047);
  shape.lineTo(-.020,-.027); shape.quadraticCurveTo(-.041,-.030,-.051,-.015);
  shape.lineTo(-.064,-.005); shape.lineTo(-.121,-.005); shape.lineTo(-.121,.005); shape.lineTo(-.064,.005);
  shape.lineTo(-.051,.015); shape.quadraticCurveTo(-.041,.030,-.020,.027); shape.closePath();
  for (const sx of [-1,1]) for (const sy of [-1,1]) {
    const p = new THREE.Path();
    p.moveTo(sx*.003,sy*.034); p.quadraticCurveTo(sx*.014,sy*.017,sx*.030,sy*.019);
    p.quadraticCurveTo(sx*.043,sy*.021,sx*.052,sy*.005); p.lineTo(sx*.017,sy*.004);
    p.quadraticCurveTo(sx*.014,sy*.013,sx*.004,sy*.013); p.closePath(); shape.holes.push(p);
  }
  return new THREE.ExtrudeGeometry(shape,{depth:.007,bevelEnabled:false,curveSegments:3});
}

function roofPoint(u: number, v: number, soffit = false) {
  const across = 2*u-1, radius = .071+(.415-.071)*v;
  const corner = Math.abs(across)**5 * v**2;
  const height = soffit ? 1.228+.017*(1-v)+.064*corner :
    1.270+.211*(1-v)**1.67+.081*corner+.011*(1-v)*Math.abs(across)**6;
  return new THREE.Vector3(.5*across*radius,height,Math.cos(halfFace)*radius);
}

export function buildForecourtLanterns(parent: THREE.Group, stone: THREE.Material, gilt: THREE.Material,
  obstacle: (x: number,z: number,hx: number,hz: number)=>void) {
  const lamp = new THREE.Group(); lamp.name = 'Lotus lantern on the gate landing';
  const bronze = new THREE.MeshStandardMaterial({name:'Dark cast bell bronze',color:'#84714e',roughness:.49,metalness:.56});
  const map = mulberryPaper();
  const paper = litPaper(map), flame = oilFlame();
  const cube = new THREE.BoxGeometry(1,1,1);
  function put(where: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string, x=0,y=0,z=0) {
    const m = new THREE.Mesh(geometry,material); m.name = name; m.position.set(x,y,z);
    m.castShadow = m.receiveShadow = material !== paper && material !== flame.material;
    where.add(m); return m;
  }
  // The flat-cut octagon preserves the old 54 cm footprint; each change of slope is a real moulding.
  const octagon = turned([[0,0],[.272,0],[.288,.018],[.288,.134],[.280,.150],[.252,.155],[.247,.171],
    [.201,.173],[.199,.193],[.208,.199],[.206,.216],[.192,.228],[.170,.238]],8,Math.PI/8);
  const foot = octagon.toNonIndexed(); octagon.dispose(); foot.computeVertexNormals();
  put(lamp,foot,stone,'Stepped octagonal lantern plinth');
  put(lamp,turned([[.171,.235],[.161,.254],[.147,.273],[.129,.311],[.116,.372],[.111,.456],
    [.115,.525],[.126,.577],[.147,.616],[.174,.625],[.178,.635],[.169,.650],[.153,.654]],24),
    stone,'Waisted stone lantern shaft');
  put(lamp,turned([[.147,.642],[.161,.659],[.189,.689],[.209,.735],[.227,.796],
    [.233,.815],[.220,.828],[0,.828]],24),stone,'Carved lotus cup under the light');
  function petals(name: string, geometry: THREE.BufferGeometry, count: number, bottom: number, angle: number) {
    for (let i=0;i<count;i++) put(lamp,geometry,stone,name,0,bottom,0).rotation.y=angle+i*tau/count;
  }
  petals('Inner lotus petals',lotusPetal(.158,.056,.153,.234,.018),12,.677,Math.PI/12);
  petals('Overlapping outer lotus petals',lotusPetal(.153,.064,.142,.248,.030),12,.660,0);
  put(lamp,turned([[0,.823],[.247,.823],[.253,.835],[.248,.845],[.24,.851],[0,.851]],6,halfFace),
    bronze,'Hexagonal bronze window sill');
  put(lamp,turned([[0,1.206],[.243,1.206],[.246,1.214],[.261,1.224],[.261,1.243],[.247,1.249],[0,1.249]],6,halfFace),
    bronze,'Window crown beneath the roof');

  const apothem = .246*Math.cos(halfFace);
  const jamb = turned([[.024,0],[.024,.010],[.018,.016],[.018,.026],[.015,.032],[.014,.316],
    [.017,.324],[.020,.328],[.018,.335],[.022,.343],[.023,.367]],8);
  const bead = new THREE.CylinderGeometry(.019,.019,.004,8,1,true);
  const lattice = transom(), pane = new THREE.PlaneGeometry(windowWidth,windowHeight);
  const cap = gridSurface(8,6,(u,v)=>roofPoint(u,v),true);
  const underside = gridSurface(8,2,(u,v)=>roofPoint(u,v,true));
  const drip = gridSurface(8,1,(u,v)=>roofPoint(u,1,true).lerp(roofPoint(u,1),v));
  const ridgePoints = Array.from({length:10},(_,i)=>roofPoint(1,i/9).add(new THREE.Vector3(0,.003,0)));
  const arris = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridgePoints),8,.008,5,false);
  for (let i=0;i<6;i++) {
    const bay = new THREE.Group(); bay.rotation.y=i*tau/6; lamp.add(bay);
    put(bay,pane,paper,'Fibred lantern window',0,windowMiddle,windowDepth);
    put(bay,jamb,bronze,'Turned corner post',.123,.845,apothem);
    for (const h of [.869,1.175]) put(bay,bead,gilt,'Worn bronze ferrule',.123,h,apothem);
    put(bay,lattice,bronze,'Pierced ruyi transom',0,1.157,apothem+.002);
    put(bay,cube,bronze,'Lower transom bar',0,1.108,apothem+.003).scale.set(.242,.006,.009);
    put(bay,cap,stone,'Swept stone roof facet'); put(bay,underside,stone,'Stone roof soffit');
    put(bay,drip,stone,'Solid drip at the eave'); put(bay,arris,stone,'Chiselled hip ridge');
  }
  put(lamp,turned([[0,1.469],[.083,1.469],[.090,1.481],[.084,1.495],[.062,1.501],
    [.062,1.508],[.051,1.513]],24),stone,'Lotus bud collar');
  put(lamp,turned([[.040,1.502],[.059,1.527],[.065,1.555],[.054,1.585],[.037,1.612],
    [.013,1.636],[0,1.652]],24),stone,'Unopened mountain lotus');
  petals('Sepals of the finial bud',lotusPetal(.094,.038,.029,.062,.017),7,1.507,halfFace);
  put(lamp,turned([[.037,0],[.041,.009],[.034,.014],[.046,.026],[.065,.031],[.062,.039],
    [.051,.025],[.024,.021],[0,.021]],24),bronze,'Oil dish visible behind the paper',0,.851,0);
  put(lamp,flame.geometry,flame.material,'Flame at the wick',0,sillHeight+.026,0);
  // Clones share the sculpted parts and the single fibre map. The scene's static batcher collects both.
  for (const sign of [-1,1]) {
    const copy = sign<0 ? lamp : lamp.clone();
    copy.position.set(sign*4.94,.30,12.42); parent.add(copy); obstacle(copy.position.x,copy.position.z,.27,.27);
  }
  return map;
}
