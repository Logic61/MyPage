import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

export function rockNoise(x: number, y: number, z: number) {
  return Math.sin(x * 1.73 + Math.cos(z * .91) + y * 1.21) * .54
    + Math.sin(x * 4.17 - y * 2.31 + z * 3.19) * .27
    + Math.cos(x * 8.37 + y * 7.11 - z * 6.23) * .13;
}

/** A continuously sampled surface for solid roof skins, water and the island edge. */
export function gridSurface(
  columns: number, rows: number,
  position: (u: number, v: number) => THREE.Vector3,
  reverse = false,
  shade?: (u: number, v: number, p: THREE.Vector3) => THREE.Color,
) {
  const points: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, v = row / rows, p = position(u, v);
    points.push(p.x, p.y, p.z); uv.push(u, v);
    if (shade) { const c = shade(u, v, p); colors.push(c.r, c.g, c.b); }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1;
    if (reverse) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (shade) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  result.setIndex(indices); result.computeVertexNormals(); return result;
}

export function roundedBlock() {
  const result = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  const p = result.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const original = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const inner = original.clone().clampScalar(-.46, .46);
    const offset = original.clone().sub(inner).normalize().multiplyScalar(.04);
    inner.add(offset); p.setXYZ(i, inner.x, inner.y, inner.z);
  }
  result.computeVertexNormals(); return result;
}

/** Architectural edges keep the same small bevel in metres, even on a long lintel or paving slab. */
export function architecturalBlock(width: number, height: number, depth: number, bevel = .012) {
  return new RoundedBoxGeometry(width, height, depth, 1, Math.min(bevel, height * .24, width * .24, depth * .24));
}

/** An open-bottom arch with a solid, bevelled reveal; local Z is the full wall depth. */
export function archedFrame(outerHalf: number, thickness: number, spring: number, rise: number, depth: number) {
  const innerHalf = outerHalf - thickness, shape = new THREE.Shape();
  shape.moveTo(-outerHalf, 0); shape.lineTo(-outerHalf, spring);
  shape.absellipse(0, spring, outerHalf, rise, Math.PI, 0, true);
  shape.lineTo(outerHalf, 0); shape.lineTo(innerHalf, 0); shape.lineTo(innerHalf, spring);
  shape.absellipse(0, spring, innerHalf, rise - thickness, 0, Math.PI, false);
  shape.lineTo(-innerHalf, 0); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 28, bevelEnabled: true,
    bevelSize: .006, bevelThickness: .006, bevelSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2); return geometry;
}

export function naturalRock(seed: number, detail = 3) {
  const result = new THREE.IcosahedronGeometry(1, detail);
  const p = result.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = rockNoise(x * 2.3 + seed, y * 1.6, z * 2.3);
    const strata = Math.sin(y * 12 + x * 2.4 + seed) * .025;
    const s = 1 + n * .13 + strata;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  result.computeVertexNormals(); return result;
}

export function pavingSlab(seed: number) {
  const r = seeded(seed), count = 7;
  const shape = new THREE.Shape();
  for (let i = 0; i < count; i++) {
    const theta = i / count * Math.PI * 2, radius = .44 + r() * .035;
    const x = Math.sin(theta) * radius, y = Math.cos(theta) * radius;
    if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const result = new THREE.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelThickness: .008, bevelSize: .014, bevelSegments: 2, steps: 1 });
  result.rotateX(-Math.PI / 2); result.translate(0, -.018, 0);
  return result;
}

/** A tapered, bent branch with cylindrical UVs and enough silhouette detail for eye-level viewing. */
export function branchGeometry(points: THREE.Vector3[], startRadius: number, endRadius: number, segments = 14, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segments, false);
  const pos: number[] = [], uv: number[] = [], indices: number[] = [];
  const length = curve.getLength();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPointAt(t);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, Math.pow(t, .74));
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const rough = 1 + Math.sin(j * 2.4 + i * .71) * .035;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      const p = center.clone().addScaledVector(normal, radius * rough);
      pos.push(p.x, p.y, p.z); uv.push(j / radial, t * length / 1.7);
    }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); result.setIndex(indices); result.computeVertexNormals(); return result;
}

/** Individually shaped needles and fine twigs replace solid polygonal tree crowns. */
export function pineSpray(seed: number) {
  const r = seeded(seed), pos: number[] = [], colors: number[] = [], uv: number[] = [];
  const green = new THREE.Color('#54745a'), tip = new THREE.Color('#7a9263'), stem = new THREE.Color('#7a7652');
  function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
    for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); colors.push(color.r, color.g, color.b); uv.push(v.x, v.z); }
  }
  for (let twig = 0; twig < 7; twig++) {
    const angle = twig * 2.39, length = .48 + r() * .3;
    const end = new THREE.Vector3(Math.cos(angle) * length, .05 + r() * .18, Math.sin(angle) * length * .7);
    const direction = end.clone().normalize(), across = new THREE.Vector3(-direction.z, .12, direction.x).normalize();
    const root = new THREE.Vector3(0, -.03, 0);
    triangle(root.clone().addScaledVector(across, .009), root.clone().addScaledVector(across, -.009), end, stem);
    for (let i = 2; i <= 12; i++) for (const side of [-1, 1]) {
      const t = i / 13, base = root.clone().lerp(end, t), len = (.09 + r() * .11) * (1.05 - t * .3);
      const forward = direction.clone().multiplyScalar(.45).addScaledVector(across, side).normalize();
      forward.y += .12 + r() * .4;
      const point = base.clone().addScaledVector(forward, len);
      const width = .008 + r() * .008;
      const color = green.clone().lerp(tip, r() * .55);
      triangle(base.clone().addScaledVector(direction, -width), point, base.clone().addScaledVector(direction, width), color);
    }
  }
  const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); result.computeVertexNormals(); return result;
}

/** An open bundle of needles around fine twigs; no enclosing sphere, skin or continuous rim. */
export function pineCrown(seed: number) {
  const random = seeded(seed), positions: number[] = [], colors: number[] = [], uv: number[] = [];
  const dark = new THREE.Color('#426648'), light = new THREE.Color('#819a66'), stem = new THREE.Color('#70734d');
  const worldUp = new THREE.Vector3(0, 1, 0);
  function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
    for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); colors.push(color.r, color.g, color.b); uv.push(p.x, p.z); }
  }
  for (let twig = 0; twig < 9; twig++) {
    const angle = twig * 2.399 + (random() - .5) * .75, length = .30 + random() * .22;
    const start = new THREE.Vector3((random() - .5) * .17, -.065 + random() * .09, (random() - .5) * .14);
    const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * length, .035 + random() * .17, Math.sin(angle) * length * .76));
    const axis = end.clone().sub(start).normalize(), across = new THREE.Vector3(-axis.z, 0, axis.x).normalize();
    const around = new THREE.Vector3().crossVectors(axis, across).normalize();
    triangle(start.clone().addScaledVector(across, .007), start.clone().addScaledVector(across, -.007), end, stem);
    for (let tuft = 1; tuft <= 8; tuft++) {
      const t = (tuft + random() * .4) / 9.5, base = start.clone().lerp(end, t);
      for (let needle = 0; needle < 7; needle++) {
        const a = needle / 7 * Math.PI * 2 + twig * .53 + random() * .5;
        const direction = axis.clone().multiplyScalar(.30).addScaledVector(across, Math.cos(a) * .7)
          .addScaledVector(around, Math.sin(a) * .53).addScaledVector(worldUp, .24).normalize();
        const tip = base.clone().addScaledVector(direction, (.105 + random() * .11) * (1.06 - t * .24));
        const ribbon = new THREE.Vector3().crossVectors(direction, axis).normalize();
        const halfWidth = .009 + random() * .008;
        const color = dark.clone().lerp(light, .24 + random() * .65);
        triangle(base.clone().addScaledVector(ribbon, -halfWidth), tip, base.clone().addScaledVector(ribbon, halfWidth), color);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals(); return geometry;
}

export function mistTexture() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    const a = Math.max(0, 1 - radius * radius), index = (y * size + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = 255; data[index + 3] = Math.round(a * a * a * 180);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; return texture;
}
