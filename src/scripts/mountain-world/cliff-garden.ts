import * as THREE from 'three';
import { gridSurface, seeded } from './environment-geometry';
import { FORECOURT_PLANTER } from './water-court';

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
const gardenBanks = [
  [-2.82,35.47,.94,1.10,.15], [-13.85,-3.4,.77,2.37,.18], [-13.80,.38,.82,2.14,.23],
  [-13.56,4.05,.59,1.46,.17], [13.59,-3.89,.62,2.18,.19], [13.49,.46,.56,1.87,.14],
  [12.6,8.72,.82,.96,.17], [-7.91,10.65,1.43,.94,.23], [8.24,10.71,1.34,.81,.18],
  [-4.52,14.08,.97,.90,.15], [3.66,14.67,1.0,.66,.14],
];

export function plantingSoil() {
  const p: number[] = [], faces: number[] = [], sides = 32;
  for (const [bed,[x,z,rx,rz,h]] of gardenBanks.entries()) {
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

export function cliffGarden(spurs: Spur[]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rng = seeded(91732), leaf = new THREE.Color(), shade = new THREE.Color('#465c46'), light = new THREE.Color('#a7a263');
  function point(x: number,y: number,z: number,brightness: number) {
    positions.push(x,y,z); colors.push(leaf.r*brightness,leaf.g*brightness,leaf.b*brightness);
  }
  // Shallow pockets of sedges soften the exposed granite between the bridge and the two galleries.
  for (const [cx,cz,rx,rz] of [[-3.25,15.6,1.05,.55],[4.4,14.9,.8,.48],[-9.6,11.8,1.1,.41],
      [12.8,8.85,.75,.75],[-14.4,-4.4,.45,1.5],[-2.9,34.6,.67,1.1],[2.7,33.4,.53,.83],[25.4,8.45,1.25,.32]]) {
    for (let i=0;i<45;i++) {
      const a=rng()*Math.PI*2,r=Math.sqrt(rng()),x=cx+Math.cos(a)*rx*r,z=cz+Math.sin(a)*rz*r;
      const hue=rng();
      for (let j=0;j<7;j++) {
        const angle=rng()*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
        const h=.10+rng()*.23,len=.08+rng()*.20,w=.013+rng()*.011;
        const n=positions.length/3; leaf.copy(shade).lerp(light,hue*.72+rng()*.26);
        point(x,.285,z,.67);
        point(x+dx*len*.3-dz*w,.285+h*.72,z+dz*len*.3+dx*w,.92);
        point(x+dx*len*.3+dz*w,.285+h*.68,z+dz*len*.3-dx*w,1.08);
        point(x+dx*len,.285+h,z+dz*len,1.12);
        indices.push(n,n+1,n+2,n+1,n+3,n+2);
      }
    }
  }
  // Wild asters grow in drifts beside the bridge lanterns and in sheltered cracks on the crags.
  const underPines = (FORECOURT_PLANTER.x0 + FORECOURT_PLANTER.x1) / 2;
  const beds = [[-2.75,.30,32.7,.67],[2.8,.30,32.9,.55],
    [underPines-.06,.338,FORECOURT_PLANTER.z0+.62,.41],[-underPines+.13,.338,FORECOURT_PLANTER.z0+.59,.39],
    [underPines+.12,.338,FORECOURT_PLANTER.z1-.56,.40],[-underPines-.05,.338,FORECOURT_PLANTER.z1-.61,.42],
    [-10.1,.285,10.9,.81],[10.8,.285,10.4,.76],
    ...spurs.filter((_,i) => i % 3 !== 2).map(s => [s.x,s.y + .07,s.z,s.width * .43])];
  const flower = new THREE.Color('#e8cb82'), sun = new THREE.Color('#f2e4c4'), bud = new THREE.Color('#c69138');
  for (const [cx,cy,cz,radius] of beds) {
    for (let stem = 0; stem < 22; stem++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const h = .15 + .37 * rng(), dx = Math.cos(a) * h * .29, dz = Math.sin(a) * h * .29;
      const n = positions.length / 3;
      leaf.copy(shade).lerp(light, rng() * .7);
      point(x - .008,cy,z,.67); point(x + .008,cy,z,.75); point(x + dx,cy + h,z + dz,1);
      indices.push(n,n+1,n+2);
      for (let j = 0; j < 5; j++) {
        const u = .15 + j * .15, angle = a + j * 2.4, reach = .047 + rng() * .048;
        const lx = Math.cos(angle), lz = Math.sin(angle), ox = x + dx * u, oz = z + dz * u, y = cy + h * u;
        const k = positions.length / 3;
        point(ox,y,oz,.70); point(ox+lx*reach*.52-lz*.014,y+.022,oz+lz*reach*.52+lx*.014,.92);
        point(ox+lx*reach*.52+lz*.014,y+.028,oz+lz*reach*.52-lx*.014,1.04);
        point(ox+lx*reach,y+.017,oz+lz*reach,.94);
        indices.push(k,k+1,k+2,k+1,k+3,k+2);
      }
      if (rng() < .31) continue;
      const petals = 7, k = positions.length / 3, reach = .021 + rng() * .024;
      leaf.copy(bud); point(x+dx,cy+h+.006,z+dz,1);
      leaf.copy(flower).lerp(sun, rng());
      for (let j=0; j<petals; j++) {
        const angle=a+j*Math.PI*2/petals, lx=Math.cos(angle), lz=Math.sin(angle);
        point(x+dx+lx*reach-lz*.006,cy+h+.011*lx,z+dz+lz*reach+lx*.006,.93);
        point(x+dx+lx*reach+lz*.006,cy+h+.011*lx+.002,z+dz+lz*reach-lx*.006,1.10);
        indices.push(k,k+1+j*2,k+2+j*2);
      }
    }
  }
  // Arching leaf blades grow out of the undulating banks, with space between clumps.
  for (const [cx,cz,rx,rz,h] of gardenBanks) {
    for (let clump=0; clump<46; clump++) {
      const a=rng()*Math.PI*2, r=Math.sqrt(rng())*.92;
      const x=cx+Math.cos(a)*rx*r, z=cz+Math.sin(a)*rz*r, y=.281+h*(1-r*r)-.012;
      for (let j=0; j<9; j++) {
        const angle=rng()*Math.PI*2, dx=Math.cos(angle), dz=Math.sin(angle);
        const rise=.07+.25*rng(), span=.07+.18*rng(), w=.012+.01*rng();
        leaf.copy(shade).lerp(light,.10+.78*rng()); const k=positions.length/3;
        point(x,y,z,.55);
        point(x+dx*span*.18-dz*w,y+rise*.74,z+dz*span*.18+dx*w,.76);
        point(x+dx*span*.18+dz*w,y+rise*.73,z+dz*span*.18-dx*w,.82);
        point(x+dx*span*.68-dz*w*.66,y+rise,z+dz*span*.68+dx*w*.66,1.03);
        point(x+dx*span*.68+dz*w*.66,y+rise*.96,z+dz*span*.68-dx*w*.66,.97);
        point(x+dx*span,y+rise*.76,z+dz*span,1.07);
        indices.push(k,k+1,k+2,k+1,k+3,k+2,k+2,k+3,k+4,k+3,k+5,k+4);
      }
    }
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

/** A lip in the rock feeds several transparent filaments. Gravity widens the spray at the foot. */
export function mountainRunoff() {
  const geometry=gridSurface(12,26,(u,v)=>{
    const drop=1-v, spread=(u-.5)*(.68+drop*.45);
    return new THREE.Vector3(-4.4+spread-.37*(1-Math.exp(-drop*11)), .13-drop*17,
      15.73+1.34*(1-Math.exp(-drop*12))+.10*Math.sin(5*u+4*drop));
  });
  const time={value:0};
  const material=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide, uniforms:{time},
    vertexShader:`varying vec2 streamUV;
      void main(){ streamUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float time; varying vec2 streamUV;
      void main(){
        float u=streamUV.x, v=streamUV.y;
        float strands=.5+.5*sin(u*57.+1.4*sin(v*15.+time*2.)+.8*sin(u*29.-v*8.));
        float streak=.5+.5*sin(v*56.+time*5.3+u*9.);
        float banks=smoothstep(0.,.18,u)*(1.-smoothstep(.76,1.,u));
        float opacity=banks*smoothstep(.02,.32,v)*(.24+.45*strands+.12*streak);
        gl_FragColor=vec4(mix(vec3(.42,.64,.62),vec3(.94,.96,.86),strands*.74+streak*.21),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  return {geometry,material,time};
}
