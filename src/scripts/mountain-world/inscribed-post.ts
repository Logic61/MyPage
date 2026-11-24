import * as THREE from 'three';
import carvings from '../../assets/gate-posts.json';

export type GateLine = keyof typeof carvings;

/** Wrap the sculpted wood around the whole post, with its UV seam facing the courtyard. */
export function inscribedPost(line: GateLine, radius: number, height: number) {
  const { vertices, indices } = carvings[line];
  const positions: number[] = [], colours: number[] = [], uv: number[] = [];
  const lightUV: number[] = [];
  const column = line === '青山流云皆入境' ? 0 : 1;
  const ends: number[][] = [[], []];
  // The carving was drawn on unwrapped timber. Use one scale for its width and height.
  const brushHeight = 2 * Math.PI * radius * 2110 / 1194;
  const lower = .10, upper = .85;
  const margins = height - (upper - lower) * brushHeight;
  const footMargin = margins * .42;
  for (let i = 0; i < vertices.length; i += 3) {
    const u = vertices[i] / 1194, v = 1 - vertices[i + 1] / 2110;
    const depth = vertices[i + 2] / 255;
    const angle = (u - .5) * 2 * Math.PI;
    let aboveFoot = footMargin + (v - lower) * brushHeight;
    if (v < lower) aboveFoot = v / lower * footMargin;
    if (v > upper) aboveFoot = height - (1 - v) / (1 - upper) * (margins - footMargin);
    const woodV = aboveFoot / height;
    const r = radius * (1 - .07 * woodV) - .007 * depth;
    positions.push(r * Math.sin(angle), aboveFoot - height / 2, r * Math.cos(angle));
    uv.push(u, woodV);
    lightUV.push((column + THREE.MathUtils.clamp((vertices[i] + .5 - 453) / 288, 0, 1)) / 2,
      1 - (vertices[i + 1] + .5) / 2111);
    colours.push(1 - .72 * depth, 1 - .62 * depth, 1 - .5 * depth);
    if (v === 0 || v === 1) ends[v].push(i / 3);
  }
  const faces = [...indices];
  const sideCount = positions.length / 3;
  // Duplicate the rims so each end has a flat normal and the shafts shade continuously.
  for (const [end, ring] of ends.entries()) {
    const centre = positions.length / 3;
    positions.push(0, (end - .5) * height, 0); uv.push(.5, .5); colours.push(1, 1, 1);
    lightUV.push(0, 0);
    for (const index of ring) {
      const x = positions[index * 3], z = positions[index * 3 + 2];
      positions.push(x, positions[index * 3 + 1], z);
      uv.push(.5 + x / (2 * radius), .5 + z / (2 * radius)); colours.push(1, 1, 1);
      lightUV.push(0, 0);
    }
    for (let i = 1; i < ring.length; i++) {
      if (end) faces.push(centre, centre + i, centre + i + 1);
      else faces.push(centre, centre + i + 1, centre + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(lightUV, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(faces); geometry.computeVertexNormals();
  // On uncut timber use the analytical taper normal; retain the chisel facets inside the strokes.
  const normals = geometry.attributes.normal, slope = .07 * radius / height;
  const length = Math.hypot(1, slope);
  for (let i = 0; i < sideCount; i++) {
    if (vertices[i * 3 + 2] !== 0) continue;
    const angle = (uv[i * 2] - .5) * 2 * Math.PI;
    normals.setXYZ(i, Math.sin(angle) / length, slope / length, Math.cos(angle) / length);
  }
  return geometry;
}
