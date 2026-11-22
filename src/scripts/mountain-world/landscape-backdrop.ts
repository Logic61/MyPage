import * as THREE from 'three';

const artworkBase = `${(import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/, '')}/world`;
export const LANDSCAPE_PANORAMA_URL = `${artworkBase}/immortal-mountains-panorama.webp`;
export const SKY_CANOPY_URL = `${artworkBase}/cloud-court-sky.webp`;
export const LANDSCAPE_FOG_COLOR = '#c7dfe6';

export interface LandscapeBackdropOptions {
  /** Metres from the island centre, bounded for the default 230m camera far plane. */
  radius?: number;
  /** Rotation about world Y. The default places the high ridge behind the north hall. */
  yaw?: number;
  horizonY?: number;
  fogColor?: THREE.ColorRepresentation;
  cloudOpacity?: number;
}

export interface LandscapeBackdrop {
  readonly root: THREE.Group;
  /** All geometry and a visible fallback exist immediately; the two local paintings load independently. */
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

function configureArtwork(texture: THREE.Texture, name: string) {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
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
  return configureArtwork(new THREE.CanvasTexture(source), 'immortal-mountains-visible-fallback');
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

function periodicNoise(x: number, y: number, period: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const x0 = ix % period, x1 = (ix + 1) % period, y0 = iy % period, y1 = (iy + 1) % period;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(x0, y0), hash(x1, y0), sx),
    THREE.MathUtils.lerp(hash(x0, y1), hash(x1, y1), sx), sy);
}

/** A repeating density field. Its two wind speeds reveal and conceal banks between the cliffs. */
function cloudTexture() {
  const size = 384, { source, ctx } = canvas(size, size), pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    const broad = periodicNoise(u * 4 + .6, v * 4 + 2.1, 4);
    const folds = periodicNoise(u * 9 + broad * 1.6, v * 9 + broad * .9 + 3, 9);
    const curls = periodicNoise(u * 24 + folds * 1.7, v * 24 + broad + 5, 24);
    const density = .5 * broad + .34 * folds + .16 * curls;
    const light = THREE.MathUtils.smoothstep(density, .25, .75), i = (y * size + x) * 4;
    pixels.data[i] = 179 + 75 * light; pixels.data[i + 1] = 202 + 51 * light; pixels.data[i + 2] = 216 + 35 * light;
    pixels.data[i + 3] = Math.round(255 * THREE.MathUtils.smoothstep(density, .26, .72));
  }
  ctx.putImageData(pixels, 0, 0);
  const result = new THREE.CanvasTexture(source);
  result.name = 'windborne-cloud-sea'; result.colorSpace = THREE.SRGBColorSpace;
  result.wrapS = result.wrapT = THREE.RepeatWrapping; result.anisotropy = 4;
  return result;
}

/** Project a square zenith painting radially. All longitudes meet at the same centre texel. */
function skyCanopyGeometry(radius: number) {
  const geometry = new THREE.SphereGeometry(radius, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  const colors = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const elevation = THREE.MathUtils.clamp(positions.getY(i) / radius, 0, 1);
    const angle = Math.acos(elevation), length = Math.hypot(x, z);
    const scale = length > .0001 ? .49 * angle / (Math.PI / 2) / length : 0;
    uv.setXY(i, .5 + x * scale, .5 - z * scale);
    colors.set([1, 1, 1, THREE.MathUtils.smoothstep(elevation, .12, .64)], i * 4);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return geometry;
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
  const horizonY = options.horizonY ?? 11.5;
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
  const canopyMaterial = keepMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    side: THREE.BackSide, depthWrite: false, fog: false, visible: false }));
  const canopy = mesh('painted-blue-sky-and-white-clouds', keepGeometry(skyCanopyGeometry(radius + 54)), canopyMaterial, -990);
  canopy.frustumCulled = false;

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
  panorama.rotation.y = options.yaw ?? -.77 * Math.PI;
  panorama.userData.landscapeProjection = {
    imageAspect: IMAGE_ASPECT, imageHorizontalDegrees: 180, mirroredHalves: 2,
    radius, height, horizonY, imageHorizonFromTop: IMAGE_HORIZON_FROM_TOP,
  };

  const cloudGeometry = keepGeometry(new THREE.PlaneGeometry((radius + 35) * 2, (radius + 35) * 2, 40, 40));
  cloudGeometry.rotateX(-Math.PI / 2);
  const cloudPositions = cloudGeometry.attributes.position, cloudUV = cloudGeometry.attributes.uv;
  const cloudTint = new Float32Array(cloudPositions.count * 4);
  for (let i = 0; i < cloudPositions.count; i++) {
    const x = cloudPositions.getX(i), z = cloudPositions.getZ(i);
    cloudPositions.setY(i, Math.sin(x * .037) * Math.cos(z * .029) * .85);
    // Dissolve into the painted valley before grazing angles flatten the moving ridges into lines.
    const edge = Math.hypot(cloudUV.getX(i) - .5, cloudUV.getY(i) - .5) * 2;
    cloudTint.set([1, 1, 1, 1 - THREE.MathUtils.smoothstep(edge, .28, .67)], i * 4);
  }
  cloudGeometry.setAttribute('color', new THREE.BufferAttribute(cloudTint, 4));
  const upperClouds = keepTexture(cloudTexture()), lowerClouds = keepTexture(upperClouds.clone());
  upperClouds.repeat.set(3.75, 3.05); lowerClouds.repeat.set(2.6, 2.15);
  for (const [index, map] of [upperClouds, lowerClouds].entries()) {
    const material = keepMaterial(new THREE.MeshBasicMaterial({ map, transparent: true, vertexColors: true,
      opacity: Math.min(1, cloudOpacity * (index ? .88 : 1.10)), depthWrite: false, fog: true }));
    const layer = mesh(`cloud-sea-depth-layer-${index + 1}`, cloudGeometry, material, -880 - index);
    layer.position.y = index ? -17 : -11; layer.rotation.y = index * .42;
  }

  const loader = new THREE.TextureLoader();
  async function loadPainting(url: string, name: string, material: THREE.MeshBasicMaterial) {
    try {
      const texture = await loader.loadAsync(url);
      if (disposed) { texture.dispose(); return; }
      material.map = keepTexture(configureArtwork(texture, name));
      material.visible = true; material.needsUpdate = true;
      material.userData.artworkSource = 'generated-local-artwork';
    } catch { /* The gradient sky and Canvas mountain landscape are available from the first frame. */ }
  }
  const ready = Promise.all([
    loadPainting(LANDSCAPE_PANORAMA_URL, 'generated-immortal-mountain-panorama-srgb', panoramaMaterial),
    loadPainting(SKY_CANOPY_URL, 'cloud-court-zenith-srgb', canopyMaterial),
  ]).then(() => {});

  return {
    root, ready,
    update(time) {
      if (disposed) return;
      // The far bank moves more slowly. Both textures wrap continuously while their perimeter stays feathered.
      upperClouds.offset.set(-time * .016, time * .0048);
      lowerClouds.offset.set(.27 - time * .006, .13 + time * .0031);
      canopyMaterial.map?.offset.set(-.028 * Math.sin(time * .032), .013 * Math.sin(time * .025));
    },
    dispose() {
      if (disposed) return;
      disposed = true; root.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose()); geometries.clear(); materials.clear(); textures.clear();
    },
  };
}
