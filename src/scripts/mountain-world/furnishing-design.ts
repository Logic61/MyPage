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
