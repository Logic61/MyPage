import * as THREE from 'three';
import { branchGeometry, gridSurface, seeded } from './environment-geometry';
import type { Collider } from './types';

type Clock = { value: number };

/** All sway starts at the twig attachment. The gust phase uses world metres, so
 * neighbouring trees share the passing wind without rocking about the world's origin. */
export function branchWind(material: THREE.Material, clock: Clock, along: 'x' | 'y', amplitude: number) {
  material.onBeforeCompile = shader => {
    shader.uniforms.groveTime = clock;
    shader.vertexShader = 'uniform float groveTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>', '#ifdef USE_INSTANCING',
      'vec3 anchor = instanceMatrix[3].xyz;',
      'float gust = sin(groveTime * 1.14 - dot(anchor.xz, vec2(.33,.19)));',
      'float flutter = sin(groveTime * 2.43 + dot(anchor.xyz, vec3(.53,1.61,.37)) + uv.x * 2.);',
      'float reach = smoothstep(.03,1.,uv.'+along+');',
      'float bend = '+amplitude.toFixed(3)+' * reach * (.73 * gust + .27 * flutter);',
      'transformed += inverse(mat3(instanceMatrix)) * vec3(bend, .37*bend, -.46*bend);',
      '#endif',
    ].join('\n'));
  };
  material.customProgramCacheKey = () => 'cloud-court-wind-'+along+'-'+amplitude;
}
function needleBough() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
  const ctx = canvas.getContext('2d')!, rng = seeded(415), greens = ['#294d43','#345b4c','#46694e','#52775a','#6c8963','#829567'];
  ctx.lineCap = 'round';
  function stroke(x: number,y: number,ex: number,ey: number,color: string,width: number) {
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(ex,ey); ctx.stroke();
  }
  function sprig(x: number,y: number,angle: number,length: number) {
    const dx=Math.cos(angle),dy=Math.sin(angle);
    stroke(x,y,x+dx*length,y+dy*length,'#645d42',2.4);
    for (let i=0;i<26;i++) {
      const t=.06+rng()*.91, bx=x+dx*length*t, by=y+dy*length*t;
      for (const side of [-1,1]) {
        const a=angle + side*(.38+rng()*1.13), span=(9+rng()*19)*(1.10-t*.36);
        const color=greens[Math.min(5,Math.floor(rng()*4+t*1.8))];
        stroke(bx,by,bx+Math.cos(a)*span,by+Math.sin(a)*span,color,1.8+rng()*1.4);
      }
    }
  }
  ctx.strokeStyle='#665d44'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(6,174); ctx.bezierCurveTo(110,172,335,142,467,164); ctx.stroke();
  for (let j=0;j<27;j++) {
    const t=(j+1)/29, x=20+443*t, y=168-15*Math.sin(t*3.2);
    const side=j%2 ? 1:-1, a=side*(.46+rng()*.38), len=(48+Math.sin(t*Math.PI)*84)*(.78+rng()*.27);
    stroke(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,'#5c5942',2.9);
    for (let k=0;k<5;k++) {
      const u=.18+k*.18, turn=k%2 ? -.45:.51;
      sprig(x+Math.cos(a)*len*u,y+Math.sin(a)*len*u,a+turn,19+rng()*22);
    }
  }
  sprig(426,155,.08,47);
  const tex=new THREE.CanvasTexture(canvas); tex.name='Ink-green pine needle bough'; tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4; return tex;
}

export function buildPines(root: THREE.Group, bark: THREE.MeshStandardMaterial, colliders: Collider[], clock: Clock,
  keep: (g: THREE.BufferGeometry) => THREE.BufferGeometry, ownTexture: (t: THREE.Texture) => void) {
  const map = needleBough(); ownTexture(map);
  const material = new THREE.MeshStandardMaterial({ name:'Layered mountain pine needles',map,roughness:.91,
    side:THREE.DoubleSide,alphaTest:.21,alphaToCoverage:true,emissive:'#415346',emissiveIntensity:.16,emissiveMap:map });
  let disposed = false;
  const assetRoot = (import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/,'')+'/world/';
  async function photograph(file: string, target: THREE.MeshStandardMaterial, channel: 'map' | 'normalMap' | 'roughnessMap') {
    try {
      const tex = await new THREE.TextureLoader().loadAsync(assetRoot + file);
      if (disposed) { tex.dispose(); return; }
      tex.colorSpace = channel === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = 4;
      if (target === bark) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
      else { target.emissiveMap = tex; }
      ownTexture(tex); target[channel] = tex; target.needsUpdate = true;
    } catch { /* The generated surface and needle silhouette are immediately available. */ }
  }
  bark.name = 'Mountain pine bark plates'; bark.normalScale.setScalar(.70);
  const ready = Promise.all([
    photograph('pine-bough.webp', material, 'map'),
    photograph('pine-bark-color.webp', bark, 'map'),
    photograph('pine-bark-normal.webp', bark, 'normalMap'),
    photograph('pine-bark-rough.webp', bark, 'roughnessMap'),
  ]);
  branchWind(material,clock,'x',.108);
  const fan = keep(gridSurface(7,3,(u,v) => new THREE.Vector3(u,(v-.105)*.49+.06*Math.sin(Math.PI*u),.12*(v-.105)+.09*u*Math.sin(u*Math.PI))));
  const transforms: THREE.Matrix4[] = [], colors: THREE.Color[] = [];
  const brush = new THREE.Object3D();
  // The study shows a few exposed lower boughs and overlapping tables of needles at the summit.
  const tiers = [
    { joints: [.43, .55], reach: .27, twigs: 2, sprays: 3, inner: .60 },
    { joints: [.65, .69, .72], reach: .32, twigs: 3, sprays: 4, inner: .44 },
    { joints: [.77, .80, .825, .85], reach: .39, twigs: 4, sprays: 6, inner: .20 },
    { joints: [.87, .895, .92, .945, .985], reach: .34, twigs: 5, sprays: 7, inner: .06 },
  ];
  const shade = new THREE.Color('#a3b198'), light = new THREE.Color('#e4dcb5');
  function limb(path: THREE.Vector3[], start: number, end: number, sides=9, radiusAt?: (fraction: number) => number) {
    const geometry=keep(branchGeometry(path,start,end,path.length>3?24:8,sides,radiusAt));
    const mesh=new THREE.Mesh(geometry,bark); mesh.castShadow=mesh.receiveShadow=true; root.add(mesh);
  }
  function pine(x: number,z: number,h: number,lean: number,seed: number, spread=1) {
    const rng=seeded(seed), base=new THREE.Vector3(x,.3,z), twist=(rng()-.5)*.80;
    // Lift the crown above the eaves while retaining the bough spread and rooting space in each bed.
    const height = h * 1.32;
    // The central leader rises on one axis. Variation belongs to the lateral branches.
    const trunkPoints = [0,.25,.5,.75,1].map(t =>
      new THREE.Vector3(x + t * lean * .075, base.y + t * height, z));
    const trunk = new THREE.CatmullRomCurve3(trunkPoints);
    // Root flare narrows rapidly at ground level, then the bole tapers steadily to the leader.
    const baseRadius = height * .053;
    const trunkRadius = (t: number) => .008 * t + baseRadius * Math.pow(1 - t, .77) * (.78 + .22 * Math.exp(-12 * t));
    limb(trunkPoints,baseRadius,.008,18,trunkRadius);
    colliders.push({x,z,halfX:baseRadius*.92,halfZ:baseRadius*.88});
    for (let j=0;j<5;j++) {
      const a=j*2.39+twist, tip=base.clone().add(new THREE.Vector3(.73*Math.cos(a),-.04,.58*Math.sin(a)));
      limb([base.clone().add(new THREE.Vector3(0,h*.058,0)),base.clone().lerp(tip,.54),tip],baseRadius*.41,.011);
    }
    let heading = seed * .73;
    for (const tier of tiers) {
      for (const joint of tier.joints) {
        const t = joint + (rng() - .5) * .025;
        const foot = trunk.getPointAt(t);
        heading += 2.4 + (rng() - .5) * .58;
        const direction = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
        const sideways = new THREE.Vector3(-direction.z, 0, direction.x);
        const windward = Math.cos(heading - twist);
        const crownTaper = 1 - .52 * THREE.MathUtils.smoothstep(t, .88, 1);
        const reach = h * tier.reach * spread * crownTaper * (.91 + .23 * rng() + .14 * windward);
        const bend = (rng() - .5) * reach * .32;
        const elbow = foot.clone().addScaledVector(direction, reach * .49).addScaledVector(sideways, bend);
        elbow.y -= reach * .09;
        const end = foot.clone().addScaledVector(direction, reach).addScaledVector(sideways, bend * .56);
        end.y += height * Math.min(.058, (1 - t) * .58);
        const joints = [foot, foot.clone().lerp(elbow, .43), elbow, end];
        const bough = new THREE.CatmullRomCurve3(joints);
        const radius = trunkRadius(t) * (.34 + .09 * rng());
        limb(joints, radius, radius * .06, 9);

        for (let j = 0; j < tier.twigs; j++) {
          const along = THREE.MathUtils.lerp(tier.inner, .92, j / (tier.twigs - 1));
          const origin = bough.getPointAt(along);
          const side = j % 2 ? 1 : -1;
          const angle = heading + side * (.48 + rng() * .63);
          const length = reach * (.29 + rng() * .25);
          const tip = origin.clone().add(new THREE.Vector3(Math.cos(angle) * length, .08 + .10 * rng(), Math.sin(angle) * length));
          const arch = origin.clone().lerp(tip, .53);
          arch.y -= length * .07;
          const twigRadius = radius * (.98 - along * .83) * .40;
          limb([origin, arch, tip], twigRadius, twigRadius * .11, 6);

          for (let k = 0; k < tier.sprays; k++) {
            const u = .10 + .86 * k / (tier.sprays - 1);
            brush.position.lerpVectors(origin, tip, u);
            brush.position.y -= Math.sin(Math.PI * u) * length * .07;
            const turn = (k % 2 ? 1 : -1) * (.48 + rng() * .52);
            brush.rotation.set(side * turn + (rng() - .5) * .45, -angle + turn, .04 + rng() * .25, 'YXZ');
            const size = h * (.15 + .055 * rng()) * (.85 + .22 * t) * (1.12 - u * .21)
              * (1 + .16 * THREE.MathUtils.smoothstep(t, .73, .93));
            brush.scale.set(size, size * (.83 + .23 * rng()), size);
            brush.updateMatrix();
            transforms.push(brush.matrix.clone());
            const sunward = .5 + .5 * Math.cos(angle + 1);
            colors.push(shade.clone().lerp(light, .15 + .35 * sunward + .24 * t + .15 * rng()));
          }
        }
      }
    }
  }
  pine(-5.55,4.0,4.35,1.18,119,.91);
  pine(5.55,4.0,4.25,-1.06,91,.88);
  pine(-13.7,3.4,6.05,1.38,13); pine(-11.75,9,5.1,-1.03,42);
  pine(-10.8,-10.4,6.0,-.92,77); pine(10.7,-10.4,5.4,1.16,31);
  pine(13.65,8.4,5.10,.85,108,.90);
  pine(8.1,10.6,4.75,.91,86,.84); pine(-8.35,10.7,5.05,-.94,52,.94);
  pine(-2.85,35.5,4.8,-.94,67,.94);
  const crowns = new THREE.InstancedMesh(fan,material,transforms.length); crowns.name='Wind-shaped pine boughs';
  transforms.forEach((matrix,i)=>{crowns.setMatrixAt(i,matrix); crowns.setColorAt(i,colors[i]);});
  crowns.castShadow=crowns.receiveShadow=true;
  crowns.userData.ignoreInteractionRay=true; crowns.userData.ignoreAmbientOcclusion=true; root.add(crowns);
  return { material, ready, dispose() { disposed=true; } };
}
