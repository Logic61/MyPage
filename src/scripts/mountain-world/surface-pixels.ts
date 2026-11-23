export type SurfaceKind = 'stone' | 'darkStone' | 'ground' | 'wood' | 'paleWood' | 'plaster' | 'limestone' | 'roofTile' | 'bark' | 'paper' | 'cloth' | 'brass' | 'ceramic' | 'moss';

export interface SurfacePixels {
  albedo: Uint8Array<ArrayBuffer>;
  normal: Uint8Array<ArrayBuffer>;
  orm: Uint8Array<ArrayBuffer>;
  size: number;
  generationMs: number;
}
export type PreparedSurfaces = Map<SurfaceKind, SurfacePixels>;

interface NoiseLayer { width: number; height: number; data: Float32Array; }
const TAU = Math.PI * 2;
const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const wrapDistance = (value: number) => value - Math.floor(value + 0.5);

export const definitions: Record<SurfaceKind, { seed: number; size: number; depth: number; metalness: number }> = {
  stone:     { seed: 173, size: 1024, depth: 0.021, metalness: 0 },
  darkStone: { seed: 173, size: 512, depth: 0.024, metalness: 0 },
  ground:    { seed: 397, size: 512, depth: 0.018, metalness: 0 },
  wood:      { seed: 821, size: 512, depth: 0.010, metalness: 0 },
  paleWood:  { seed: 821, size: 512, depth: 0.006, metalness: 0 },
  plaster:   { seed: 487, size: 256, depth: 0.0012, metalness: 0 },
  limestone: { seed: 149, size: 512, depth: 0.0035, metalness: 0 },
  roofTile:  { seed: 257, size: 512, depth: 0.003, metalness: 0 },
  bark:      { seed: 283, size: 512, depth: 0.032, metalness: 0 },
  paper:     { seed: 631, size: 512, depth: 0.0015, metalness: 0 },
  cloth:     { seed: 347, size: 512, depth: 0.003, metalness: 0 },
  brass:     { seed: 941, size: 512, depth: 0.0018, metalness: 1 },
  ceramic:   { seed: 569, size: 512, depth: 0.0016, metalness: 0 },
  moss:      { seed: 719, size: 512, depth: 0.012, metalness: 0 },
};

function makeNoise(width: number, height: number, seed: number): NoiseLayer {
  const data = new Float32Array(width * height);
  let state = seed >>> 0;
  for (let i = 0; i < data.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = state / 4294967296;
  }
  return { width, height, data };
}

/** Periodic, smooth value noise. Layer dimensions are powers of two. */
function noise(layer: NoiseLayer, u: number, v: number): number {
  const x = u * layer.width, y = v * layer.height;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ix & (layer.width - 1), x1 = (ix + 1) & (layer.width - 1);
  const y0 = (iy & (layer.height - 1)) * layer.width;
  const y1 = ((iy + 1) & (layer.height - 1)) * layer.width;
  return mix(mix(layer.data[y0 + x0], layer.data[y0 + x1], sx),
    mix(layer.data[y1 + x0], layer.data[y1 + x1], sx), sy);
}

/** Distance to a periodic Voronoi boundary: continuous cracks, not random dots. */
function fracture(xJitter: NoiseLayer, yJitter: NoiseLayer, u: number, v: number): number {
  const x = u * xJitter.width, y = v * xJitter.height;
  const cellX = Math.floor(x), cellY = Math.floor(y);
  let first = Infinity, second = Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = cellX + dx, yy = cellY + dy;
    const index = (yy & (xJitter.height - 1)) * xJitter.width + (xx & (xJitter.width - 1));
    const px = xx + 0.18 + xJitter.data[index] * 0.64 - x;
    const py = yy + 0.18 + yJitter.data[index] * 0.64 - y;
    const distance = px * px + py * py;
    if (distance < first) { second = first; first = distance; }
    else if (distance < second) second = distance;
  }
  return Math.sqrt(second) - Math.sqrt(first);
}

/** CPU-only synthesis; all features tile and are deterministic. No renderer or DOM. */
export function generateSurfacePixels(kind: SurfaceKind): SurfacePixels {
  const started = performance.now();
  const definition = definitions[kind], size = definition.size;
  const pixels = size * size;
  const albedo = new Uint8Array(pixels * 4);
  const orm = new Uint8Array(pixels * 4);
  const normal = new Uint8Array(pixels * 4);
  const heights = new Float32Array(pixels);
  const seed = definition.seed;
  const coarse = makeNoise(4, 4, seed);
  const macro = makeNoise(8, 8, seed + 13);
  const middle = makeNoise(32, 32, seed + 31);
  const fine = makeNoise(128, 128, seed + 59);
  const grain = makeNoise(256, 256, seed + 83);
  const lengthwise = makeNoise(128, 8, seed + 107);
  const crosswise = makeNoise(8, 128, seed + 139);
  const waterFlow = makeNoise(16, 4, seed + 223);
  const fracturesX = makeNoise(4, 4, seed + 173);
  const fracturesY = makeNoise(4, 4, seed + 191);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, index = y * size + x, rgba = index * 4;
    const broad = noise(coarse, u, v), patch = noise(macro, u, v);
    const detail = noise(middle, u, v), micro = noise(fine, u, v);
    let r = 0.5, g = 0.5, b = 0.5, height = 0.5, roughness = 0.9, ao = 1, metal = 0;

    switch (kind) {
      case 'plaster': {
        // Millimetre relief and slow tonal variation leave a quiet wall at room scale.
        const trowel = noise(waterFlow, u, v);
        const pores = smooth(.78, .94, noise(grain, u, v));
        const shade = .98 + (broad - .5) * .024 + (trowel - .5) * .015 + (micro - .5) * .009;
        r = .915 * shade; g = .913 * shade; b = .875 * shade;
        height = .5 + (detail - .5) * .035 + (micro - .5) * .024 - pores * .012;
        roughness = .92 + (micro - .5) * .04; ao = 1 - pores * .018;
        break;
      }
      case 'limestone': {
        const vein = Math.sin(TAU * (v * 3 + broad * .13 + patch * .07));
        const shade = .98 + (broad - .5) * .045 + (patch - .5) * .024 + vein * .008 + (micro - .5) * .012;
        r = .735 * shade; g = .76 * shade; b = .735 * shade;
        height = .5 + (detail - .5) * .04 + (micro - .5) * .025 + vein * .006;
        roughness = .77 + (micro - .5) * .06;
        break;
      }
      case 'roofTile': {
        const shade = .98 + (broad - .5) * .10 + (patch - .5) * .05 + (micro - .5) * .025;
        r = .255 * shade; g = .315 * shade; b = .325 * shade;
        height = .5 + (detail - .5) * .045 + (micro - .5) * .03;
        roughness = .68 + (patch - .5) * .08;
        break;
      }
      case 'stone':
      case 'darkStone': {
        const warpedU = u + (patch - 0.5) * 0.12 + (detail - 0.5) * 0.025;
        const warpedV = v + (broad - 0.5) * 0.12 + (detail - 0.5) * 0.018;
        const edge = fracture(fracturesX, fracturesY, warpedU, warpedV);
        // Faults emerge only where a coarse seam meets an eroded patch. A complete
        // Voronoi outline would read as masonry, so boundaries deliberately break up.
        const continuity = smooth(0.43, 0.76, patch * 0.65 + detail * 0.35);
        const split = (1 - smooth(0.004, 0.019, edge)) * continuity;
        const wornEdge = (1 - smooth(0.015, 0.075, edge)) * continuity;
        const bedPhase = v * 9 + broad * 0.55 + patch * 0.28 + detail * 0.035;
        const beds = 0.5 + 0.5 * Math.sin(TAU * bedPhase);
        const sediment = smooth(0.16, 0.83, beds);
        const lamina = (1 - smooth(0.04, 0.17, Math.abs(Math.sin(TAU * (bedPhase + 0.1)))))
          * smooth(0.26, 0.65, detail);
        const mineral = smooth(0.71, 0.88, micro) * (0.25 + detail * 0.75);
        const damp = smooth(0.59, 0.86, noise(waterFlow, u, v) * 0.62 + broad * 0.38);
        const shade = 0.88 + broad * 0.14 + patch * 0.08 + sediment * 0.035
          + (detail - 0.5) * 0.055 + (micro - 0.5) * 0.035 - lamina * 0.025;
        const dark = kind === 'darkStone';
        r = (dark ? 0.29 : 0.50) * shade;
        g = (dark ? 0.35 : 0.55) * shade;
        b = (dark ? 0.355 : 0.545) * shade;
        r += mineral * 0.030; g += mineral * 0.029; b += mineral * 0.025;
        r *= 1 - split * 0.22 - damp * 0.14;
        g *= 1 - split * 0.20 - damp * 0.10;
        b *= 1 - split * 0.18 - damp * 0.13;
        height = 0.49 + (broad - 0.5) * 0.15 + (patch - 0.5) * 0.08 + sediment * 0.04
          + (detail - 0.5) * 0.075 + (micro - 0.5) * 0.017 - split * 0.045 - lamina * 0.008;
        ao = 1 - split * 0.24 - wornEdge * 0.035 - lamina * 0.025;
        roughness = clamp(0.87 + (micro - 0.5) * 0.14 - damp * 0.22 + split * 0.04, 0.53, 0.98);
        break;
      }
      case 'ground': {
        const edge = fracture(fracturesX, fracturesY, u + (patch - 0.5) * 0.08, v + (broad - 0.5) * 0.08);
        const crack = (1 - smooth(0.006, 0.019, edge))
          * smooth(0.48, 0.78, broad) * smooth(0.3, 0.7, patch);
        const grit = noise(grain, u, v);
        const damp = smooth(0.53, 0.78, broad * 0.6 + patch * 0.4);
        const wear = smooth(0.25, 0.75, detail);
        const shade = 0.83 + broad * 0.22 + patch * 0.09 + wear * 0.055 + (grit - 0.5) * 0.045;
        r = 0.49 * shade * (1 - damp * 0.18 - crack * 0.20);
        g = 0.51 * shade * (1 - damp * 0.14 - crack * 0.19);
        b = 0.465 * shade * (1 - damp * 0.17 - crack * 0.18);
        height = 0.5 + (detail - 0.5) * 0.11 + (micro - 0.5) * 0.022
          + (grit - 0.5) * 0.008 - crack * 0.045;
        ao = 1 - crack * 0.21 - (1 - wear) * 0.04;
        roughness = 0.91 - damp * 0.30 - wear * 0.055;
        break;
      }
      case 'wood':
      case 'paleWood': {
        const fiber = noise(lengthwise, u + (patch - 0.5) * 0.022, v);
        const fibrils = smooth(0.65, 0.91, noise(lengthwise, u * 2 + (detail - 0.5) * 0.008, v));
        // A single small knot and quiet growth rings keep a large desktop calm.
        const du = wrapDistance(u - 0.28), dv = wrapDistance(v - 0.62);
        const distance = Math.sqrt((du / 0.035) ** 2 + (dv / 0.095) ** 2);
        const influence = 1 - smooth(0.55, 1.8, distance);
        const knot = (1 - smooth(0.05, 0.42, distance)) * 0.85;
        const knotRing = Math.sin(distance * 16 + patch * 0.8) * influence * 0.5;
        const ring = 0.5 + 0.5 * Math.sin(TAU * (u * 48 + broad * 0.42 + patch * 0.16) + knotRing * 0.7);
        const latewood = smooth(0.72, 0.96, ring);
        const split = smooth(0.75, 0.91, fiber) * smooth(0.53, 0.75, patch);
        const silvered = smooth(0.57, 0.86, broad * 0.7 + detail * 0.3) * 0.35;
        const shade = 0.94 + patch * 0.075 + (fiber - 0.5) * 0.045
          - latewood * 0.065 - knot * 0.13 - split * 0.11 - fibrils * 0.022;
        const pale = kind === 'paleWood';
        r = mix((pale ? .69 : .38) * shade, (pale ? .65 : .36) * shade, silvered);
        g = mix((pale ? .615 : .33) * shade, (pale ? .62 : .355) * shade, silvered);
        b = mix((pale ? .49 : .285) * shade, (pale ? .54 : .325) * shade, silvered);
        height = 0.5 + latewood * 0.018 + (fiber - 0.5) * 0.035 + fibrils * 0.012
          + (detail - 0.5) * 0.012 - split * 0.065 - knot * 0.025;
        ao = 1 - split * 0.17 - knot * 0.045;
        roughness = clamp(0.63 + fiber * 0.10 + silvered * 0.12 - latewood * 0.035, 0.55, 0.88);
        break;
      }
      case 'bark': {
        const ridge = 0.5 + 0.5 * Math.sin(TAU * (u * 15 + broad * 0.65 + detail * 0.16));
        const split = 1 - smooth(0.02, 0.20, ridge);
        const crossSplit = (1 - smooth(0.01, 0.055, Math.abs(Math.sin(TAU * (v * 5 + patch * 0.33)))))
          * smooth(0.4, 0.7, broad);
        const lichen = smooth(0.60, 0.82, patch * 0.65 + micro * 0.35);
        const shade = 0.86 + broad * 0.22 + (micro - 0.5) * 0.10 - split * 0.33 - crossSplit * 0.2;
        r = mix(0.365 * shade, 0.40, lichen * 0.25);
        g = mix(0.32 * shade, 0.44, lichen * 0.25);
        b = mix(0.26 * shade, 0.32, lichen * 0.25);
        height = 0.46 + ridge * 0.10 + (detail - 0.5) * 0.07 + (micro - 0.5) * 0.014
          - split * 0.10 - crossSplit * 0.055;
        ao = 1 - split * 0.37 - crossSplit * 0.14;
        roughness = 0.86 + micro * 0.12;
        break;
      }
      case 'paper': {
        const fibers = noise(lengthwise, u, v) * 0.56 + noise(crosswise, u, v) * 0.44;
        const thread = smooth(0.64, 0.82, fibers);
        const shade = 0.96 + (broad - 0.5) * 0.055 + (fibers - 0.5) * 0.065 + thread * 0.025;
        r = 0.91 * shade; g = 0.89 * shade; b = 0.82 * shade;
        height = 0.5 + (fibers - 0.5) * 0.08 + thread * 0.024 + (micro - 0.5) * 0.017;
        ao = 0.985 + fibers * 0.015;
        roughness = 0.93 + micro * 0.06;
        break;
      }
      case 'cloth': {
        const warp = 0.5 + 0.5 * Math.cos(TAU * u * 96);
        const weft = 0.5 + 0.5 * Math.cos(TAU * v * 96);
        const over = (Math.floor(u * 96) + Math.floor(v * 96)) & 1;
        const thread = over ? warp * 0.72 + weft * 0.28 : weft * 0.72 + warp * 0.28;
        const pore = (1 - warp) * (1 - weft);
        const shade = 0.91 + broad * 0.13 + (thread - 0.5) * 0.13 + (micro - 0.5) * 0.02;
        r = 0.315 * shade; g = 0.41 * shade; b = 0.385 * shade;
        height = 0.45 + thread * 0.12 - pore * 0.035;
        ao = 1 - pore * 0.17;
        roughness = 0.92 + pore * 0.075;
        break;
      }
      case 'brass': {
        const brush = noise(crosswise, u, v);
        const tarnish = smooth(0.55, 0.77, broad * 0.6 + detail * 0.4);
        const patina = smooth(0.72, 0.87, patch * 0.75 + micro * 0.25) * tarnish;
        const shade = 0.93 + (brush - 0.5) * 0.09 + (micro - 0.5) * 0.025;
        r = mix(0.74 * shade, 0.36, tarnish * 0.47);
        g = mix(0.585 * shade, 0.35, tarnish * 0.47);
        b = mix(0.32 * shade, 0.23, tarnish * 0.47);
        r = mix(r, 0.29, patina * 0.6); g = mix(g, 0.43, patina * 0.6); b = mix(b, 0.36, patina * 0.6);
        height = 0.5 + (brush - 0.5) * 0.026 + (micro - 0.5) * 0.012 - patina * 0.022;
        ao = 1 - patina * 0.08;
        roughness = 0.27 + brush * 0.13 + tarnish * 0.37;
        metal = 0.97 - tarnish * 0.27 - patina * 0.53;
        break;
      }
      case 'ceramic': {
        const edge = fracture(fracturesX, fracturesY, u * 2, v * 2);
        const crazing = (1 - smooth(0.008, 0.023, edge)) * 0.22;
        const glaze = 0.93 + broad * 0.10 + (detail - 0.5) * 0.045;
        const speckle = smooth(0.76, 0.90, micro) * 0.07;
        r = 0.59 * glaze - crazing * 0.10 - speckle;
        g = 0.72 * glaze - crazing * 0.07 - speckle * 0.7;
        b = 0.665 * glaze - crazing * 0.08 - speckle * 0.8;
        height = 0.5 + (micro - 0.5) * 0.022 + (detail - 0.5) * 0.028 - crazing * 0.012;
        ao = 1 - crazing * 0.06;
        roughness = 0.16 + micro * 0.12 + crazing * 0.22;
        break;
      }
      case 'moss': {
        const tuft = smooth(0.23, 0.77, detail);
        const tips = smooth(0.52, 0.83, micro);
        const dry = smooth(0.55, 0.80, broad);
        const shade = 0.77 + tuft * 0.25 + tips * 0.13;
        r = mix(0.275, 0.40, dry * 0.45) * shade;
        g = mix(0.405, 0.39, dry * 0.45) * shade;
        b = mix(0.255, 0.25, dry * 0.45) * shade;
        height = 0.40 + tuft * 0.18 + tips * 0.025 + (noise(grain, u, v) - 0.5) * 0.006;
        ao = 0.78 + tuft * 0.19;
        roughness = 0.94 + tips * 0.055;
        break;
      }
    }
    albedo[rgba] = Math.round(clamp(r) * 255);
    albedo[rgba + 1] = Math.round(clamp(g) * 255);
    albedo[rgba + 2] = Math.round(clamp(b) * 255);
    albedo[rgba + 3] = 255;
    orm[rgba] = Math.round(clamp(ao) * 255);
    orm[rgba + 1] = Math.round(clamp(roughness) * 255);
    orm[rgba + 2] = Math.round(clamp(metal) * 255);
    orm[rgba + 3] = 255;
    heights[index] = height;
  }

  // A central difference with wrapped neighbours keeps normal-map seams continuous.
  // The derivative is in UV units, so switching 512/1024 does not double relief.
  const mask = size - 1, depth = definition.depth * size * 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x, rgba = index * 4;
    const nx = (heights[y * size + ((x - 1) & mask)] - heights[y * size + ((x + 1) & mask)]) * depth;
    const ny = (heights[((y - 1) & mask) * size + x] - heights[((y + 1) & mask) * size + x]) * depth;
    const inverse = 1 / Math.sqrt(nx * nx + ny * ny + 1);
    normal[rgba] = Math.round((nx * inverse * 0.5 + 0.5) * 255);
    normal[rgba + 1] = Math.round((ny * inverse * 0.5 + 0.5) * 255);
    normal[rgba + 2] = Math.round((inverse * 0.5 + 0.5) * 255);
    normal[rgba + 3] = 255;
  }
  return {
    albedo, normal, orm,
    size, generationMs: performance.now() - started,
  };
}
