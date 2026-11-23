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
