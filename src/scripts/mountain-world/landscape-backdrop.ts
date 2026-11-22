import * as THREE from 'three';

export const LANDSCAPE_PANORAMA_URL = `${(import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/, '')}/world/immortal-mountains-panorama.webp`;
export const LANDSCAPE_FOG_COLOR = '#c7dfe6';

export interface LandscapeBackdropOptions {
  /** Metres from the island centre, bounded for the default 230m camera far plane. */
  radius?: number;
  /** Rotation about world Y. The default points the artwork's middle towards +Z. */
  yaw?: number;
  horizonY?: number;
  fogColor?: THREE.ColorRepresentation;
  cloudOpacity?: number;
}

export interface LandscapeBackdrop {
  readonly root: THREE.Group;
  /** All geometry and a visible fallback exist immediately; this only replaces the image map. */
  readonly ready: Promise<void>;
  update(time: number, delta?: number): void;
  dispose(): void;
}

const IMAGE_ASPECT = 3;
// Calibrated against this panorama's distant ridgeline, not the amount of sky in its prompt.
const IMAGE_HORIZON_FROM_TOP = .46;

function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return { source: result, ctx: result.getContext('2d')! };
}

function configurePanorama(texture: THREE.Texture, name: string) {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  // The geometry folds U at 180 degrees, so offline renderers need no special wrapping mode.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function fallbackPanorama() {
  const { source, ctx } = canvas(1024, 342);
  const sky = ctx.createLinearGradient(0, 0, 0, 342);
  sky.addColorStop(0, '#acd1e8'); sky.addColorStop(.30, '#d0e1e5'); sky.addColorStop(1, '#e1eaeb');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 342);
  for (const [base, height, phase, color] of [
    [170, 55, .8, '#9db8bd'], [225, 110, 2.2, '#769e9e'], [305, 165, 4.1, '#668f88'],
  ] as const) {
    ctx.beginPath(); ctx.moveTo(-10, 350);
    for (let x = -10; x <= 1034; x += 3) {
      const t = x / 1024;
      const peak = Math.pow(Math.max(0, Math.sin(t * 10 + phase)), 4);
      const detail = Math.sin(t * 43 + phase) * 7 + Math.sin(t * 91) * 2;
      ctx.lineTo(x, base - peak * height + detail);
    }
    ctx.lineTo(1034, 350); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    const mist = ctx.createLinearGradient(0, base - 35, 0, base + 30);
    mist.addColorStop(0, 'rgba(218,233,235,0)'); mist.addColorStop(1, 'rgba(218,233,235,.93)');
    ctx.fillStyle = mist; ctx.fillRect(0, base - 35, 1024, 90);
  }
  return configurePanorama(new THREE.CanvasTexture(source), 'immortal-mountains-visible-fallback');
}

/** Linear alpha makes sky, cloud and mirror-fold transitions visible to both WebGL and offline QA. */
function panoramaMask() {
  const { source, ctx } = canvas(512, 256), pixels = ctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const u = x / 511, v = y / 255;
    const vertical = THREE.MathUtils.smoothstep(v, 0, .10) * (1 - THREE.MathUtils.smoothstep(v, .83, 1));
    const foldDistance = Math.min(u, 1 - u);
    const foldMist = .72 + .28 * THREE.MathUtils.smoothstep(foldDistance, 0, .021);
    const value = Math.round(vertical * foldMist * 255), i = (y * 512 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const result = new THREE.CanvasTexture(source);
  result.name = 'panorama-soft-sky-cloud-and-mirror-fold-alpha';
  result.colorSpace = THREE.NoColorSpace; result.flipY = true;
  return result;
}

function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), sx),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}

/** Broad banks and smaller eddies, generated once; no per-frame texture work or noise particles. */
function cloudTexture() {
  const size = 512, { source, ctx } = canvas(size, size), pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1), radial = Math.hypot(u - .5, v - .5) * 2;
    const broad = noise(u * 5.8 + 7, v * 4.8 + 13);
    const eddies = noise(u * 17 + broad * 2, v * 15 + 4) * .68 + noise(u * 43, v * 39 + 19) * .32;
    const banks = .60 * broad + .40 * eddies;
    const edge = 1 - THREE.MathUtils.smoothstep(radial, .72, .99);
    const alpha = THREE.MathUtils.smoothstep(banks, .23, .78) * edge;
    const shade = Math.round(224 + banks * 31), i = (y * size + x) * 4;
    pixels.data[i] = shade - 5; pixels.data[i + 1] = shade - 1; pixels.data[i + 2] = shade;
    pixels.data[i + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(pixels, 0, 0);
  const result = new THREE.CanvasTexture(source);
  result.name = 'layered-cloud-sea-colour-and-alpha'; result.colorSpace = THREE.SRGBColorSpace;
  result.flipY = true; result.anisotropy = 4;
  return result;
}

/**
 * Distant scenery only: no walk surfaces, collisions, lights or interaction targets.
 * The 3:1 image is a cylindrical matte with cloud-layer parallax below the island
 * and a closed sky sphere behind it. The landscape never follows camera rotation.
 */
export function createLandscapeBackdrop(scene: THREE.Scene, options: LandscapeBackdropOptions = {}): LandscapeBackdrop {
  const root = new THREE.Group(); root.name = 'generated-immortal-mountain-backdrop';
  root.userData.ignoreInteractionRay = true;
  root.userData.ignoreAmbientOcclusion = true;
  scene.add(root);
  const radius = THREE.MathUtils.clamp(options.radius ?? 108, 60, 130);
  const height = Math.PI * radius / IMAGE_ASPECT;
  const horizonY = options.horizonY ?? 1.5;
  const fogColor = new THREE.Color(options.fogColor ?? LANDSCAPE_FOG_COLOR);
  const cloudOpacity = THREE.MathUtils.clamp(options.cloudOpacity ?? .56, 0, 1);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  let disposed = false;
  const keepGeometry = <T extends THREE.BufferGeometry>(value: T) => { geometries.add(value); return value; };
  const keepMaterial = <T extends THREE.Material>(value: T) => { materials.add(value); return value; };
  const keepTexture = <T extends THREE.Texture>(value: T) => { textures.add(value); return value; };
  function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, order: number) {
    const result = new THREE.Mesh(geometry, material);
    result.name = name; result.renderOrder = order;
    result.castShadow = false; result.receiveShadow = false;
    result.userData.ignoreInteractionRay = true; root.add(result); return result;
  }

  // A closed sky avoids a rectangular top edge or an empty nadir when looking around.
  const skyGeometry = keepGeometry(new THREE.SphereGeometry(radius + 55, 64, 32));
  const skyPosition = skyGeometry.attributes.position, skyColors = new Float32Array(skyPosition.count * 3);
  const zenith = new THREE.Color('#a8cde8'), cloudFloor = new THREE.Color('#dbe7eb'), color = new THREE.Color();
  for (let i = 0; i < skyPosition.count; i++) {
    const elevation = skyPosition.getY(i) / (radius + 55);
    if (elevation >= 0) color.copy(fogColor).lerp(zenith, THREE.MathUtils.smoothstep(elevation, 0, .46));
    else color.copy(fogColor).lerp(cloudFloor, THREE.MathUtils.smoothstep(-elevation, 0, .45));
    skyColors[i * 3] = color.r; skyColors[i * 3 + 1] = color.g; skyColors[i * 3 + 2] = color.b;
  }
  skyGeometry.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = mesh('soft-blue-sky-and-cloud-nadir', skyGeometry,
    keepMaterial(new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, side: THREE.BackSide,
      depthWrite: false, fog: false })), -1000);
  sky.frustumCulled = false;

  const fallback = keepTexture(fallbackPanorama()), mask = keepTexture(panoramaMask());
  const panoramaMaterial = keepMaterial(new THREE.MeshBasicMaterial({ color: '#ffffff', map: fallback, alphaMap: mask,
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
  panoramaMaterial.name = 'generated-mountain-panorama';
  panoramaMaterial.userData.artworkSource = 'canvas-fallback';
  const panoramaGeometry = keepGeometry(new THREE.CylinderGeometry(radius, radius, height, 192, 12, true));
  const panoramaUV = panoramaGeometry.attributes.uv;
  for (let i = 0; i < panoramaUV.count; i++) {
    const u = panoramaUV.getX(i);
    panoramaUV.setX(i, u <= .5 ? u * 2 : 2 - u * 2);
  }
  const panorama = mesh('continuous-180-degree-panoramas', panoramaGeometry, panoramaMaterial, -900);
  panorama.position.y = horizonY + height * (IMAGE_HORIZON_FROM_TOP - .5);
  panorama.rotation.y = options.yaw ?? -Math.PI / 2;
  panorama.userData.landscapeProjection = {
    imageAspect: IMAGE_ASPECT, imageHorizontalDegrees: 180, mirroredHalves: 2,
    radius, height, horizonY, imageHorizonFromTop: IMAGE_HORIZON_FROM_TOP,
  };

  const clouds = keepTexture(cloudTexture());
  const cloudGeometry = keepGeometry(new THREE.PlaneGeometry((radius + 35) * 2, (radius + 35) * 2, 40, 40));
  cloudGeometry.rotateX(-Math.PI / 2);
  const cloudPositions = cloudGeometry.attributes.position;
  for (let i = 0; i < cloudPositions.count; i++) {
    const x = cloudPositions.getX(i), z = cloudPositions.getZ(i);
    cloudPositions.setY(i, Math.sin(x * .037) * Math.cos(z * .029) * .45);
  }
  cloudGeometry.computeVertexNormals();
  const cloudLayers = [-11, -17].map((y, index) => {
    const layer = mesh(`cloud-sea-depth-layer-${index + 1}`, cloudGeometry,
      keepMaterial(new THREE.MeshBasicMaterial({ color: '#e3eef0', map: clouds, transparent: true,
        opacity: cloudOpacity * (index ? .94 : 1), side: THREE.DoubleSide, depthWrite: false, fog: true })), -880 - index);
    layer.position.y = y; layer.rotation.y = index * .83;
    layer.scale.setScalar(index ? 1.10 : 1); return layer;
  });

  const ready = Promise.resolve().then(() => new THREE.TextureLoader().loadAsync(LANDSCAPE_PANORAMA_URL)).then(texture => {
    if (disposed) { texture.dispose(); return; }
    keepTexture(configurePanorama(texture, 'generated-immortal-mountain-panorama-srgb'));
    panoramaMaterial.map = texture; panoramaMaterial.needsUpdate = true;
    panoramaMaterial.userData.artworkSource = 'generated-local-artwork';
  }).catch(() => { /* Keep the complete visible fallback when the optional local artwork fails to load. */ });

  return {
    root, ready,
    update(time) {
      if (disposed) return;
      for (let i = 0; i < cloudLayers.length; i++) {
        cloudLayers[i].position.x = Math.sin(time * .009 + i * 2.1) * 1.2;
        cloudLayers[i].position.z = Math.cos(time * .007 + i * 1.7) * .9;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose()); geometries.clear(); materials.clear(); textures.clear();
    },
  };
}
