import * as THREE from 'three';

/** Local artwork only: Vite supplies BASE_URL, while CPU scene export keeps the same site path. */
export const MOUNTAIN_SCREEN_ART_URL = `${(import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/, '')}/world/mountain-silk-landscape.webp`;

export interface ScreenArtwork {
  readonly texture: THREE.Texture;
  readonly ready: Promise<THREE.Texture>;
  readonly loaded: boolean;
  dispose(): void;
}

/** An immediately visible, quiet ink landscape while the local silk painting loads. */
function landscapeFallback() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e8e5da';
  ctx.fillRect(0, 0, 768, 768);
  const layers = [
    { color: '#bbc8c4', alpha: .38, base: 530, height: 210, phase: .8 },
    { color: '#93aaa7', alpha: .39, base: 608, height: 240, phase: 2.1 },
    { color: '#6d8c8a', alpha: .46, base: 742, height: 340, phase: 3.7 },
  ];
  for (const layer of layers) {
    ctx.beginPath();
    ctx.moveTo(-20, 800);
    for (let x = -20; x <= 790; x += 6) {
      const a = x / 768;
      const peak = Math.pow(Math.max(0, Math.sin(a * 4.6 + layer.phase)), 3);
      const ridge = Math.sin(a * 22 + layer.phase) * 17 + Math.cos(a * 43) * 4;
      ctx.lineTo(x, layer.base - peak * layer.height + ridge);
    }
    ctx.lineTo(790, 800); ctx.closePath();
    ctx.globalAlpha = layer.alpha; ctx.fillStyle = layer.color; ctx.fill();
    ctx.globalAlpha = layer.alpha * .55; ctx.lineWidth = 1.2; ctx.strokeStyle = '#4a6a68'; ctx.stroke();
    const mist = ctx.createLinearGradient(0, layer.base - 90, 0, layer.base + 30);
    mist.addColorStop(0, 'rgba(232,229,218,0)');
    mist.addColorStop(1, 'rgba(232,229,218,.8)');
    ctx.globalAlpha = 1; ctx.fillStyle = mist; ctx.fillRect(0, layer.base - 90, 768, 140);
  }
  // A small pine grows into the space between two lower ridges.
  ctx.strokeStyle = '#526b63'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(214, 650); ctx.bezierCurveTo(210, 608, 238, 598, 235, 552); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const y = 560 + i * 12, x = 234 - i * 3;
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y + 10);
    ctx.lineTo(x + (i % 2 ? -1 : 1) * (25 + i * 3), y - 5); ctx.stroke();
    ctx.fillStyle = 'rgba(72,101,90,.55)';
    ctx.beginPath(); ctx.ellipse(x + (i % 2 ? -22 : 22), y - 5, 27, 7, -.12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = .10;
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = i % 2 ? '#8f9d90' : '#fffef6';
    ctx.fillRect((i * 73.71) % 768, (i * 131.31) % 768, 1 + i % 3, .5);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'mountain-screen-canvas-fallback';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 8;
  return texture;
}

/**
 * No GPU work or remote service is required to construct the room. The artwork is a
 * non-emissive sRGB albedo map; normal/roughness remain the silk material's PBR maps.
 * Canvas and image textures both use flipY=true and the circle's ordinary [0,1] UVs.
 */
export function createScreenArtwork(url = MOUNTAIN_SCREEN_ART_URL): ScreenArtwork {
  const fallback = landscapeFallback();
  let loadedTexture: THREE.Texture | undefined;
  let disposed = false;
  let loaded = false;
  const ready = Promise.resolve().then(() => new THREE.TextureLoader().loadAsync(url)).then(texture => {
    if (disposed) { texture.dispose(); return fallback; }
    texture.name = 'mountain-screen-generated-silk-landscape';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    loadedTexture = texture;
    loaded = true;
    return texture;
  }).catch(() => fallback);
  return {
    texture: fallback,
    ready,
    get loaded() { return loaded; },
    dispose() {
      if (disposed) return;
      disposed = true;
      fallback.dispose();
      loadedTexture?.dispose();
    },
  };
}

/** Soft, slightly crowned upholstery: the perimeter stays at the sewn seam. */
export function createBenchCushionGeometry(width: number, depth: number, height: number) {
  const geometry = new THREE.BoxGeometry(width, height, depth, 16, 2, 8);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const crown = Math.max(0, 1 - (x / (width / 2)) ** 4) * Math.max(0, 1 - (z / (depth / 2)) ** 4);
    p.setY(i, y + Math.sign(y) * crown * height * .18);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function relief(shape: THREE.Shape, depth: number, edge: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, curveSegments: 10,
    bevelEnabled: true, bevelSize: edge, bevelThickness: edge, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Cut from a single board. The lower edge alternates cloud heads and small lifted shoulders. */
export function createCloudApron(width: number, height: number, depth: number) {
  const h = height, w = width / 2, s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, -h * .88);
  s.bezierCurveTo(w*.94,-h*.99, w*.91,-h*.94, w*.88,-h*.67);
  s.bezierCurveTo(w*.84,-h*.35, w*.75,-h*.52, w*.69,-h*.49);
  s.bezierCurveTo(w*.59,-h*.40, w*.59,-h*.87, w*.49,-h*.80);
  s.bezierCurveTo(w*.34,-h*.67, w*.26,-h*.39, w*.15,-h*.69);
  s.quadraticCurveTo(w*.07,-h, 0,-h);
  s.quadraticCurveTo(-w*.07,-h, -w*.15,-h*.69);
  s.bezierCurveTo(-w*.26,-h*.39, -w*.34,-h*.67, -w*.49,-h*.80);
  s.bezierCurveTo(-w*.59,-h*.87, -w*.59,-h*.40, -w*.69,-h*.49);
  s.bezierCurveTo(-w*.75,-h*.52, -w*.84,-h*.35, -w*.88,-h*.67);
  s.bezierCurveTo(-w*.91,-h*.94, -w*.94,-h*.99, -w,-h*.88); s.closePath();
  return relief(s, depth, .003);
}

/** Through-carved ruyi back splat, with a second opening below the cloud-shaped head. */
export function createPiercedSplat(width: number, height: number, depth: number) {
  const s = new THREE.Shape();
  s.moveTo(-.35,0); s.lineTo(.35,0);
  s.bezierCurveTo(.19,.24,.18,.38,.35,.47); s.bezierCurveTo(.65,.62,.55,.79,.34,.82);
  s.quadraticCurveTo(.21,.86,.21,1); s.lineTo(-.21,1); s.quadraticCurveTo(-.21,.86,-.34,.82);
  s.bezierCurveTo(-.55,.79,-.65,.62,-.35,.47); s.bezierCurveTo(-.18,.38,-.19,.24,-.35,0); s.closePath();
  const cloud = new THREE.Path();
  cloud.moveTo(0,.46); cloud.bezierCurveTo(-.09,.56,-.36,.55,-.34,.68);
  cloud.bezierCurveTo(-.32,.77,-.15,.76,-.09,.70); cloud.quadraticCurveTo(0,.86,.09,.70);
  cloud.bezierCurveTo(.15,.76,.32,.77,.34,.68); cloud.bezierCurveTo(.36,.55,.09,.56,0,.46); cloud.closePath();
  const stem = new THREE.Path();
  stem.moveTo(0,.09); stem.quadraticCurveTo(-.13,.21,0,.43); stem.quadraticCurveTo(.13,.21,0,.09); stem.closePath();
  s.holes.push(cloud,stem);
  const g = relief(s, depth / width, .008);
  g.scale(width,height,width); return g;
}

/** A bent end cheek of a Chinese scroll-ended painting table, extruded along its depth. */
export function createScrollCheek(depth: number) {
  const s = new THREE.Shape();
  s.moveTo(-.015,0); s.bezierCurveTo(.06,.009,.105,.093,.119,.145);
  s.bezierCurveTo(.136,.19,.171,.185,.17,.158);
  s.bezierCurveTo(.167,.193,.121,.229,.09,.181);
  s.bezierCurveTo(.06,.136,.027,.072,-.048,.052); s.lineTo(-.048,.012); s.closePath();
  return relief(s,depth,.004);
}

export function createBentTableLeg(height: number) {
  const s = new THREE.Shape();
  s.moveTo(-.083,0); s.lineTo(.079,0); s.quadraticCurveTo(.093,.047,.055,.092);
  s.bezierCurveTo(-.025,.19,-.005,height*.54,.053,height*.65);
  s.bezierCurveTo(.104,height*.77,.118,height*.87,.088,height);
  s.lineTo(-.093,height); s.bezierCurveTo(-.02,height*.79,-.055,height*.76,-.089,height*.66);
  s.bezierCurveTo(-.135,height*.48,-.094,.15,-.073,.10); s.quadraticCurveTo(-.049,.065,-.083,0);
  return relief(s,.135,.009);
}

/** Carved slate. A continuous top slopes from the grinding bed into an off-centre ink well. */
export function createInkstoneGeometry() {
  const profile = [
    [.002,.002,.001,0], [.145,.090,.001,0], [.152,.095,.007,0],
    [.154,.097,.024,0], [.150,.094,.033,0], [.139,.084,.036,0],
    [.102,.070,.032,.022], [.064,.055,.030,.056], [.056,.047,.023,.059],
    [.051,.041,.012,.060], [.002,.002,.010,.060],
  ];
  const vertices: number[]=[], uv: number[]=[], indices: number[]=[];
  const count=64;
  for (const [i,[rx,rz,y,shift]] of profile.entries()) for(let j=0;j<count;j++) {
    const a=j*2*Math.PI/count, c=Math.cos(a), t=Math.sin(a);
    const exponent=i<7?.70:.92;
    const x=shift+rx*Math.sign(c)*Math.abs(c)**exponent;
    const z=rz*Math.sign(t)*Math.abs(t)**exponent*(1+.07*c);
    vertices.push(x,y,z); uv.push(.5+x*3,.5-z*4.5);
    if(i===0)continue;
    const p=(i-1)*count+j,n=(i-1)*count+(j+1)%count;
    indices.push(p,p+count,n,n,p+count,n+count);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createBrushRestGeometry() {
  const ridge=new THREE.Shape();
  ridge.moveTo(-.073,0);ridge.quadraticCurveTo(-.079,.016,-.059,.038);
  ridge.quadraticCurveTo(-.046,.071,-.035,.030);ridge.quadraticCurveTo(-.026,.015,-.014,.041);
  ridge.quadraticCurveTo(.003,.095,.018,.045);ridge.quadraticCurveTo(.027,.018,.039,.036);
  ridge.quadraticCurveTo(.052,.068,.062,.033);ridge.quadraticCurveTo(.082,.014,.073,0);ridge.closePath();
  const g=new THREE.ExtrudeGeometry(ridge,{depth:.032,bevelEnabled:true,bevelThickness:.004,bevelSize:.003,bevelSegments:3,curveSegments:10});
  g.translate(0,.004,-.016);return g;
}

/** Woven lozenges and smaller shuttle marks around the silk mounting. */
export function createBrocadeMount(): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const radius = 1.444;
  const repeats = 44;

  function lozenge(angle: number, halfWidth: number, halfHeight: number, inset: number) {
    const first = positions.length / 3;
    for (const scale of [1, 1 - inset / halfHeight]) {
      for (const [along, across] of [[0, halfHeight], [halfWidth, 0], [0, -halfHeight], [-halfWidth, 0]]) {
        const theta = angle + along * scale / radius;
        const distance = radius + across * scale;
        const x = distance * Math.cos(theta), y = distance * Math.sin(theta);
        positions.push(x, y, 0);
        uvs.push(0.5 + x / 3.2, 0.5 + y / 3.2);
      }
    }
    for (let edge = 0; edge < 4; edge++) {
      const a = first + edge, b = first + (edge + 1) % 4;
      indices.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }

  for (let i = 0; i < repeats; i++) {
    const step = 2 * Math.PI / repeats;
    lozenge(i * step, .073, .030, .0055);
    lozenge((i + .5) * step, .018, .009, .004);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
