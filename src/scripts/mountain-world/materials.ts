import * as THREE from 'three';

import { definitions, generateSurfacePixels, type PreparedSurfaces, type SurfaceKind } from './surface-pixels';
export type { SurfaceKind } from './surface-pixels';

export interface SurfaceOptions {
  /** Multiplies the baked albedo, like MeshStandardMaterial.color. */
  color?: THREE.ColorRepresentation;
  /** Repeats per UV square; with worldScale, multiplies each projected UV pair. */
  repeat?: [number, number];
  /** Standard material multipliers for the generated roughness/metalness maps. */
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  side?: THREE.Side;
  /** Texture repeats per world unit. Enables UV-independent triplanar sampling. */
  worldScale?: number;
}

export interface SurfaceLibrary {
  material(kind: SurfaceKind, options?: SurfaceOptions): THREE.MeshStandardMaterial;
  dispose(): void;
}

interface TextureSet {
  albedo: THREE.DataTexture;
  normal: THREE.DataTexture;
  orm: THREE.DataTexture;
  size: number;
  generationMs: number;
}
interface SharedSet { textures: TextureSet; users: number; }

// Shared across the environment and furniture libraries, with explicit ownership.
const sharedSets = new Map<SurfaceKind, SharedSet>();
function dataTexture(data: Uint8Array, size: number, color: boolean, name: string): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = name;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.channel = 0;
  texture.needsUpdate = true;
  return texture;
}

const triplanarDeclarations = /* glsl */ `
varying vec3 vSurfaceWorldPosition;
varying vec3 vSurfaceWorldNormal;
uniform float uSurfaceWorldScale;
uniform vec2 uSurfaceRepeat;
uniform float uSurfaceRotateY;
vec4 surfaceSample(sampler2D tex, vec2 uvX, vec2 uvY, vec2 uvZ, vec3 weights) {
  return texture2D(tex, uvX) * weights.x + texture2D(tex, uvY) * weights.y + texture2D(tex, uvZ) * weights.z;
}
`;

function applyTriplanar(material: THREE.MeshStandardMaterial, worldScale: number, repeat: THREE.Vector2, rotateY: boolean) {
  // Avoid generating a tangent frame from absent/degenerate mesh UVs. The normal
  // chunk below replaces object-space decoding with a world-space surface gradient.
  material.normalMapType = THREE.ObjectSpaceNormalMap;
  material.onBeforeCompile = shader => {
    shader.uniforms.uSurfaceWorldScale = { value: worldScale };
    shader.uniforms.uSurfaceRepeat = { value: repeat };
    shader.uniforms.uSurfaceRotateY = { value: rotateY ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSurfaceWorldPosition;\nvarying vec3 vSurfaceWorldNormal;`)
      .replace('#include <worldpos_vertex>', /* glsl */ `
        #include <worldpos_vertex>
        vec4 surfaceWorldPosition = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          surfaceWorldPosition = batchingMatrix * surfaceWorldPosition;
        #endif
        #ifdef USE_INSTANCING
          surfaceWorldPosition = instanceMatrix * surfaceWorldPosition;
        #endif
        vSurfaceWorldPosition = (modelMatrix * surfaceWorldPosition).xyz;
        vSurfaceWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${triplanarDeclarations}`)
      .replace('#include <map_fragment>', /* glsl */ `
        #ifdef FLAT_SHADED
          vec3 surfaceN = normalize(cross(dFdx(vSurfaceWorldPosition), dFdy(vSurfaceWorldPosition)));
        #else
          vec3 surfaceN = normalize(vSurfaceWorldNormal);
          #ifdef DOUBLE_SIDED
            surfaceN *= gl_FrontFacing ? 1.0 : -1.0;
          #endif
        #endif
        vec3 surfaceWeights = pow(max(abs(surfaceN), vec3(0.0001)), vec3(4.0));
        surfaceWeights /= surfaceWeights.x + surfaceWeights.y + surfaceWeights.z;
        vec3 surfaceSigns = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), surfaceN));
        vec3 surfaceP = vSurfaceWorldPosition * uSurfaceWorldScale;
        vec2 surfaceUvX = vec2(-surfaceSigns.x * surfaceP.z, surfaceP.y) * uSurfaceRepeat;
        vec2 surfaceUvY = mix(vec2(surfaceP.x, -surfaceSigns.y * surfaceP.z),
          vec2(surfaceSigns.y * surfaceP.z, surfaceP.x), uSurfaceRotateY) * uSurfaceRepeat;
        vec2 surfaceUvZ = vec2(surfaceSigns.z * surfaceP.x, surfaceP.y) * uSurfaceRepeat;
        diffuseColor *= surfaceSample(map, surfaceUvX, surfaceUvY, surfaceUvZ, surfaceWeights);
        vec3 surfaceORM = surfaceSample(roughnessMap, surfaceUvX, surfaceUvY, surfaceUvZ, surfaceWeights).rgb;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * surfaceORM.g, 0.045, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(metalness * surfaceORM.b, 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', /* glsl */ `
        vec3 surfaceNX = texture2D(normalMap, surfaceUvX).xyz * 2.0 - 1.0;
        vec3 surfaceNY = texture2D(normalMap, surfaceUvY).xyz * 2.0 - 1.0;
        vec3 surfaceNZ = texture2D(normalMap, surfaceUvZ).xyz * 2.0 - 1.0;
        surfaceNX.xy *= normalScale;
        surfaceNY.xy *= normalScale;
        surfaceNZ.xy *= normalScale;
        vec3 surfaceSlope =
          vec3(0.0, surfaceNX.y, -surfaceSigns.x * surfaceNX.x) / max(surfaceNX.z, 0.18) * surfaceWeights.x +
          mix(vec3(surfaceNY.x, 0.0, -surfaceSigns.y * surfaceNY.y),
            vec3(surfaceNY.y, 0.0, surfaceSigns.y * surfaceNY.x), uSurfaceRotateY) / max(surfaceNY.z, 0.18) * surfaceWeights.y +
          vec3(surfaceSigns.z * surfaceNZ.x, surfaceNZ.y, 0.0) / max(surfaceNZ.z, 0.18) * surfaceWeights.z;
        // Project the blended slope onto the actual surface. A neutral normal map
        // reproduces the mesh normal exactly, including sloping cave walls.
        surfaceSlope -= surfaceN * dot(surfaceSlope, surfaceN);
        normal = normalize(mat3(viewMatrix) * normalize(surfaceN + surfaceSlope));
      `)
      .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment
        .replace('texture2D( aoMap, vAoMapUv ).r', 'surfaceORM.r'));
  };
  material.customProgramCacheKey = () => 'mountain-triplanar-surface-gradient-v2';
}

/**
 * Lazy texture generation; each call owns a separate material. Default UVs cover
 * one tile. For large stone meshes, worldScale: .5 covers two world units per tile.
 * Wood/bark fibers run along texture V. World-mapped wood runs along X on horizontal
 * boards and Y on vertical joinery. Paper and cloth use smaller surface relief.
 * The AO channel represents local cracks/weave, not whole-scene ambient occlusion.
 */
export function createSurfaceLibrary(prepared?: PreparedSurfaces): SurfaceLibrary {
  const ownMaterials = new Set<THREE.MeshStandardMaterial>();
  const ownTextures = new Set<THREE.Texture>();
  const usedKinds = new Set<SurfaceKind>();
  let disposed = false;

  function acquire(kind: SurfaceKind) {
    let shared = sharedSets.get(kind);
    if (!shared) {
      const { albedo, normal, orm, size, generationMs } = prepared?.get(kind) ?? generateSurfacePixels(kind);
      shared = { users: 0, textures: {
        albedo: dataTexture(albedo, size, true, `mountain-${kind}-albedo`),
        normal: dataTexture(normal, size, false, `mountain-${kind}-normal`),
        orm: dataTexture(orm, size, false, `mountain-${kind}-orm`),
        size, generationMs,
      } };
      sharedSets.set(kind, shared);
    }
    if (!usedKinds.has(kind)) { usedKinds.add(kind); shared.users++; }
    return shared.textures;
  }

  return {
    material(kind, options = {}) {
      if (disposed) throw new Error('The surface library has already been disposed.');
      const set = acquire(kind);
      const repeat = new THREE.Vector2(
        Number.isFinite(options.repeat?.[0]) ? Math.max(0.001, options.repeat![0]) : 1,
        Number.isFinite(options.repeat?.[1]) ? Math.max(0.001, options.repeat![1]) : 1,
      );
      const useWorld = Number.isFinite(options.worldScale) && options.worldScale! > 0;
      const view = (texture: THREE.DataTexture) => {
        // Texture transforms are mutable. A requested UV repeat therefore gets its
        // own texture view (sharing source pixels), never mutating another material.
        if (!options.repeat || useWorld) return texture;
        const clone = texture.clone();
        clone.repeat.copy(repeat);
        clone.needsUpdate = true;
        ownTextures.add(clone);
        return clone;
      };
      const albedo = view(set.albedo), normal = view(set.normal), orm = view(set.orm);
      const mat = new THREE.MeshStandardMaterial({
        name: `mountain-surface-${kind}`,
        color: options.color ?? 0xffffff,
        map: albedo, normalMap: normal, roughnessMap: orm, metalnessMap: orm, aoMap: orm,
        roughness: options.roughness ?? 1,
        metalness: options.metalness ?? definitions[kind].metalness,
        side: options.side ?? THREE.FrontSide,
        dithering: true,
      });
      const normalAmount = Number.isFinite(options.normalScale) ? options.normalScale! : 1;
      mat.normalScale.setScalar(normalAmount);
      mat.aoMapIntensity = 0.8;
      mat.userData.surface = {
        kind, textureSize: set.size, generationMs: set.generationMs,
        mapping: useWorld ? 'world-triplanar' : 'uv',
        worldUnitsPerTile: useWorld ? 1 / options.worldScale! : undefined,
        repeat: repeat.toArray(),
        rotateHorizontalProjection: useWorld && (kind === 'wood' || kind === 'paleWood'),
      };
      if (useWorld) applyTriplanar(mat, options.worldScale!, repeat, kind === 'wood' || kind === 'paleWood');
      ownMaterials.add(mat);
      return mat;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mat of ownMaterials) mat.dispose();
      for (const texture of ownTextures) texture.dispose();
      for (const kind of usedKinds) {
        const shared = sharedSets.get(kind);
        if (!shared || --shared.users > 0) continue;
        shared.textures.albedo.dispose();
        shared.textures.normal.dispose();
        shared.textures.orm.dispose();
        sharedSets.delete(kind);
      }
      ownMaterials.clear();
      ownTextures.clear();
      usedKinds.clear();
    },
  };
}
