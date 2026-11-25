import * as THREE from 'three';
import { gridSurface, seeded } from './environment-geometry';
import { bankSedges, type PlantingBank } from './woodland-foliage';

/** The inhabited rim stays true to the walking polygon. Fissures deepen below the cap. */
export function cragFace(outline: number[][]) {
  const color = new THREE.Color(), cool = new THREE.Color('#789798'), warm = new THREE.Color('#e6c9a3'), moss = new THREE.Color('#859165');
  return gridSurface(outline.length * 14, 25, (u,v) => {
    const section = (u % 1) * outline.length, index = Math.floor(section), f = section - index;
    const [x0,z0] = outline[index], [x1,z1] = outline[(index+1)%outline.length];
    const x = x0+(x1-x0)*f, z = z0+(z1-z0)*f, depth = 1-v, a = Math.atan2(z,x);
    const split = Math.pow(.5+.5*Math.cos(31*a+.25*Math.sin(3*v+11*a)), 4);
    const shoulder = (1-Math.exp(-depth*19))*(.4+1.4*split);
    const scale = 1 - (shoulder + 1.6*depth + .45*Math.sin(depth*20+6*a)*depth) / Math.hypot(x,z);
    return new THREE.Vector3(x*scale,.28 - 34*depth,z*scale);
  }, true, (_u,v,p) => {
    const mineral = .48+.25*Math.sin(p.x*1.8+p.z*.9+p.y*.09)+.16*Math.sin(p.y*1.3+p.z*.45);
    color.copy(cool).lerp(warm, THREE.MathUtils.clamp(mineral,0,1));
    return color.lerp(moss,THREE.MathUtils.smoothstep(v,.85,1)*(.48+.25*Math.sin(p.x*1.7)));
  });
}

type Spur = { x: number; y: number; z: number; angle: number; width: number; depth: number; height: number; phase: number };

// Planted ground outside each covered walk and where the southern pine meets the landing.
const gardenBanks: PlantingBank[] = [
  { soil:[-2.82,35.47,.94,1.10,.15], sedges:[[.27,.10,.82],[-.42,-.16,.53]] },
  { soil:[-13.85,-3.4,.77,2.37,.18] },
  { soil:[-13.80,.38,.82,2.14,.23], sedges:[[.12,.31,.87],[-.20,-.13,.72]] },
  { soil:[-13.56,4.05,.59,1.46,.17] },
  { soil:[13.59,-3.89,.62,2.18,.19], sedges:[[-.16,.28,.84]] },
  { soil:[13.51,-.17,.56,1.02,.14] },
  { soil:[13.70,1.67,.65,.89,.18], sedges:[[.13,-.17,.74]] },
  { soil:[-7.91,10.65,1.43,.94,.23], sedges:[[-.27,.28,.86],[.20,.31,.57]] },
  { soil:[8.04,10.70,.60,.84,.18], sedges:[[.14,-.33,.80]] },
  { soil:[-4.52,14.08,.97,.90,.15] },
  { soil:[3.66,14.67,1.0,.66,.14], sedges:[[-.19,.05,.62]] },
];

export function plantingSoil() {
  const p: number[] = [], faces: number[] = [], sides = 32;
  for (const [bed,{soil:[x,z,rx,rz,h]}] of gardenBanks.entries()) {
    const first = p.length / 3;
    for (let ring=0; ring<=5; ring++) {
      const r = ring / 5;
      for (let i=0; i<sides; i++) {
        const a=i*Math.PI*2/sides, edge=1+.09*Math.sin(3*a+bed)+.044*Math.cos(7*a+bed);
        p.push(x+rx*r*Math.cos(a)*edge, .281+h*(1-r*r), z+rz*r*Math.sin(a)*edge);
        if (ring === 0) continue;
        const prev=first+(ring-1)*sides, j=(i+1)%sides;
        faces.push(prev+i,prev+j,prev+sides+i,prev+j,prev+sides+j,prev+sides+i);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.setIndex(faces); g.computeVertexNormals(); return g;
}

/** Granite breaks into jointed columns and little plant-bearing shelves below the paving. */
export function cliffSpurs(outline: number[][]) {
  const spurs: Spur[] = [], rng = seeded(72136);
  function outcrop(x: number, z: number, angle: number, width: number) {
    const nx = Math.cos(angle), nz = Math.sin(angle);
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * width * .66;
      spurs.push({
        x: x - nz * offset - nx * .26, z: z + nx * offset - nz * .26,
        y: -.12 - (i === 1 ? 0 : .33 + rng() * 1.8), angle,
        width: width * (.65 + rng() * .5), depth: .74 + rng() * .79,
        height: 4.6 + rng() * 6.8, phase: rng() * 6.28,
      });
    }
  }
  for (const [i, [x, z]] of outline.entries()) {
    const [xx, zz] = outline[(i + 1) % outline.length], dx = xx - x, dz = zz - z;
    const t = .21 + rng() * .55;
    outcrop(x + dx * t, z + dz * t, Math.atan2(-dx, dz), .74 + rng() * .72);
  }
  for (const [x, z, radius] of [[0, 34, 4.2], [26, 5, 4.3]]) {
    for (const angle of [.42, 1.65, 2.42, 3.98, 5.46]) {
      outcrop(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, angle, .71 + rng() * .31);
    }
  }
  const vertices: number[] = [], colors: number[] = [], faces: number[] = [];
  const dark = new THREE.Color('#8e9791'), pale = new THREE.Color('#ddd2b7'), moss = new THREE.Color('#859263');
  const color = new THREE.Color(), sides = 13;
  for (const s of spurs) {
    const base = vertices.length / 3;
    const layers = [[1.15,.025], [.84,.37], [.62,.69], [.39,.85], [.28,.88], [.26,.99], [.07,1], [.016,.90], [0,.49], [.002,0]];
    for (const [row, [down, thickness]] of layers.entries()) {
      for (let i = 0; i < sides; i++) {
        const a = Math.PI * 2 * i / sides, nx = Math.cos(s.angle), nz = Math.sin(s.angle);
        const grain = Math.sin(a * 3 + s.phase) * .11 + Math.cos(a * 5 + s.phase + down * .54) * .08;
        const lateral = (Math.cos(a) * (1 + grain) * thickness - down * .23) * s.width;
        const radial = (Math.sin(a) * (1 + grain) * thickness - down * 1.36) * s.depth;
        vertices.push(s.x + lateral * -nz + radial * nx, s.y - down * s.height + thickness * Math.sin(a + s.phase) * .091,
          s.z + lateral * nx + radial * nz);
        color.copy(dark).lerp(pale, .48 + .22 * Math.sin(2 * a + s.phase) + .14 * Math.cos(down * 15 + a));
        color.lerp(moss, row >= layers.length - 2 ? .48 : .11 * thickness);
        colors.push(color.r, color.g, color.b);
        if (row === 0) continue;
        const prev = base + (row - 1) * sides, j = (i + 1) % sides;
        faces.push(prev + i, prev + j, prev + sides + i, prev + j, prev + sides + j, prev + sides + i);
      }
    }
  }
  const rock = new THREE.BufferGeometry();
  rock.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  rock.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  rock.setIndex(faces); rock.computeVertexNormals();
  return { rock, spurs };
}

export function cliffGarden() {
  return bankSedges(gardenBanks);
}
