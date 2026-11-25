import * as THREE from 'three';
import { seeded } from './environment-geometry';

type Surface = { vertices: number[]; colors: number[]; faces: number[] };
export const BAMBOO_GROVE = { x:-16.08, z:-.82 } as const;
const up = new THREE.Vector3(0, 1, 0);
const east = new THREE.Vector3(1, 0, 0);

function vertex(surface: Surface, point: THREE.Vector3, color: THREE.Color, light = 1) {
  surface.vertices.push(point.x, point.y, point.z);
  surface.colors.push(color.r * light, color.g * light, color.b * light);
}

function geometry(surface: Surface) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(surface.vertices, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(surface.colors, 3));
  result.setIndex(surface.faces);
  result.computeVertexNormals();
  return result;
}

type Ring = { center: THREE.Vector3; radius: number; color: THREE.Color };
function tube(surface: Surface, rings: Ring[], sides: number) {
  const first = surface.vertices.length / 3;
  const axis = rings.at(-1)!.center.clone().sub(rings[0].center).normalize();
  const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) > .85 ? east : up).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  for (const [row, ring] of rings.entries()) {
    for (let j = 0; j < sides; j++) {
      const a = 2 * Math.PI * j / sides;
      const p = ring.center.clone().addScaledVector(u, Math.cos(a) * ring.radius).addScaledVector(v, Math.sin(a) * ring.radius);
      vertex(surface, p, ring.color, .96 + .04 * Math.sin(3 * a));
      if (row === 0) continue;
      const i = first + (row - 1) * sides + j, next = first + (row - 1) * sides + (j + 1) % sides;
      surface.faces.push(i, next, i + sides, next, next + sides, i + sides);
    }
  }
}

export function buildBamboo(rng: () => number) {
  const stems: Surface = { vertices: [], colors: [], faces: [] };
  const leaves: Surface = { vertices: [], colors: [], faces: [] };
  const detail = seeded(87106);
  const greens = ['#426b45','#51804f','#669258','#769953','#8ea75e'].map(c => new THREE.Color(c));
  const twig = new THREE.Color('#849158'), rim = new THREE.Color('#b4bb81'), seam = new THREE.Color('#687647');

  function blade(base: THREE.Vector3, angle: number, length: number, slope: number) {
    const first = leaves.vertices.length / 3, color = greens[Math.floor(detail() * greens.length)];
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-forward.z, (detail() - .5) * 1.65, forward.x).normalize();
    const width = length * (.068 + detail() * .035), curl = detail() * .10;
    const center = (t: number) => base.clone().addScaledVector(forward, length * t)
      .addScaledVector(up, length * (slope * t - .47 * t * t)).addScaledVector(side, curl * t * t);
    vertex(leaves, base, color);
    for (const [t, spread] of [[.23,.78],[.49,1],[.76,.59]]) {
      const mid = center(t);
      vertex(leaves, mid.clone().addScaledVector(side, -width * spread), color, .88);
      vertex(leaves, mid.clone().addScaledVector(up, width * .27 * spread), color, 1.15);
      vertex(leaves, mid.clone().addScaledVector(side, width * spread), color);
    }
    vertex(leaves, center(1), color);
    const triangles = [0,2,1,0,3,2,1,2,4,2,5,4,2,3,5,3,6,5,4,5,7,5,8,7,5,6,8,6,9,8,7,8,10,8,9,10];
    for (const i of triangles) leaves.faces.push(first + i);
  }

  function spray(node: THREE.Vector3, angle: number, length: number) {
    const ray = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    // Shorter low, path-facing shoots keep the foliage behind the rail at eye height.
    length *= 1-.42*(1-THREE.MathUtils.smoothstep(node.y,2.55,3.35))*Math.max(0,ray.x);
    const onBranch = (t: number) => node.clone().addScaledVector(ray, length * t)
      .addScaledVector(up, length * (.95 * t - .61 * t * t));
    tube(stems, [0,.45,1].map(t => ({ center: onBranch(t), radius: .014 * (1 - .8*t), color: twig })), 6);
    for (const [k,t] of [.35,.63,.9].entries()) {
      const start = onBranch(t), turn = angle + (k % 2 ? -1 : 1) * (.35 + detail() * .65);
      const dx = Math.cos(turn), dz = Math.sin(turn), reach = length * (.27 + detail() * .20);
      const onTwig = (f: number) => start.clone().add(new THREE.Vector3(dx * reach * f, reach * (.39*f - .33*f*f), dz * reach * f));
      tube(stems, [0,.55,1].map(f => ({ center: onTwig(f), radius: .0055 * (1 - .75*f), color: twig })), 5);
      for (let j = 0; j < 5; j++) {
        const direction = turn + (j % 2 ? -1 : 1) * (.36 + detail() * .64);
        blade(onTwig(.18 + .19*j), direction, .18 + detail()*.16, detail()*.8 - .18);
      }
    }
  }

  for (let i = 0; i < 15; i++) {
    const x=BAMBOO_GROVE.x+(rng()-.5)*1.12, z=BAMBOO_GROVE.z+(rng()-.5)*2.46;
    const height = 2.7 + rng() * 2, radius = .027 + rng() * .022;
    const intervals = Array.from({length: 12}, (_,j) => (.65 + .55 * Math.sin(Math.PI*j/11)) * (.86 + .28*rng()));
    const total = intervals.reduce((sum,n) => sum+n, 0);
    const lean=new THREE.Vector3((x-BAMBOO_GROVE.x)*.68-.18+(detail()-.5)*.24,0,
      (z-BAMBOO_GROVE.z)*.39+(detail()-.5)*.24);
    const axis = (t: number) => new THREE.Vector3(x,.28 + t*height,z).addScaledVector(lean,t*t);
    const skin = new THREE.Color().lerpColors(new THREE.Color('#69804d'),new THREE.Color('#9da45d'),detail());
    const rings: Ring[] = [{center: axis(0), radius, color: skin}];
    let level = 0, angle = detail() * Math.PI * 2;
    for (const [j, length] of intervals.entries()) {
      level += length/total;
      const r = radius*(1-.85*level);
      for (const [dy, scale, color] of [[-.025,1,skin],[-.012,1.12,seam],[-.003,1.25,rim],[.009,1.12,rim],[.019,1,skin]] as const) {
        rings.push({center: axis(level + dy/height), radius:r*scale, color});
      }
      angle += 2.86 + detail()*.33;
      if (j >= 4 && (j+i)%2 === 0) {
        const span = (.48 + .58*Math.sin(Math.PI*level)) * (.78 + detail()*.36);
        spray(axis(level), angle, span);
        if (j === 8 || j === 9) spray(axis(level), angle + .74, span*.63);
      }
    }
    tube(stems, rings, 9);
    spray(axis(1),angle + 1.4,.35);
  }
  return { stems: geometry(stems), leaves: geometry(leaves) };
}

// Both surfaces use the same world-space bend, so leaves follow their supporting twigs.
export function bambooWind(material: THREE.Material, time: { value: number }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.bambooTime = time;
    shader.vertexShader = 'uniform float bambooTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float reach = smoothstep(.3, 4.9, position.y);
      float gust = sin(bambooTime * 1.21 + position.z * .82) + .32 * sin(bambooTime * 2.05 - position.x * .71);
      transformed.xz += vec2(.075,-.04) * gust * reach;`);
  };
}

