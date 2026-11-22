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

export function buildPines(root: THREE.Group, bark: THREE.Material, colliders: Collider[], clock: Clock,
  keep: (g: THREE.BufferGeometry) => THREE.BufferGeometry, ownTexture: (t: THREE.Texture) => void) {
  const map = needleBough(); ownTexture(map);
  const material = new THREE.MeshStandardMaterial({ name:'Layered mountain pine needles',map,roughness:.91,
    side:THREE.DoubleSide,alphaTest:.22,alphaToCoverage:true,emissive:'#526955',emissiveIntensity:.34,emissiveMap:map });
  let disposed = false;
  const url = (import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/,'')+'/world/pine-bough.webp';
  const ready = new THREE.TextureLoader().loadAsync(url).then(texture => {
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=4; ownTexture(texture);
    material.map=material.emissiveMap=texture; material.needsUpdate=true;
  }).catch(()=>{ /* Keep the hand-drawn needle silhouette until the asset is available. */ });
  branchWind(material,clock,'x',.115);
  const fan = keep(gridSurface(8,4,(u,v) => new THREE.Vector3(u,(v-.105)*.49+.06*Math.sin(Math.PI*u),.12*(v-.105)+.09*u*Math.sin(u*Math.PI))));
  const transforms: THREE.Matrix4[] = [], colors: THREE.Color[] = [];
  const brush = new THREE.Object3D();
  function limb(path: THREE.Vector3[], start: number, end: number, sides=9) {
    const geometry=keep(branchGeometry(path,start,end,path.length>3?18:8,sides));
    const mesh=new THREE.Mesh(geometry,bark); mesh.castShadow=mesh.receiveShadow=true; root.add(mesh);
  }
  function pine(x: number,z: number,h: number,lean: number,seed: number, spread=1) {
    const rng=seeded(seed), base=new THREE.Vector3(x,.3,z), twist=(rng()-.5)*.80;
    const trunkPoints = [[0,0,0],[-.12,.21,.06],[.37,.48,-.09],[.52,.65,.18],[.81,.84,-.04],[1,1,.065]]
      .map(([u,v,w])=>base.clone().add(new THREE.Vector3(u*lean,v*h,w*h*.21)));
    const trunk = new THREE.CatmullRomCurve3(trunkPoints);
    limb(trunkPoints,h*.042,.028,14);
    colliders.push({x:x+.10*lean,z,halfX:h*.05+Math.abs(lean)*.13,halfZ:h*.054});
    for (let j=0;j<5;j++) {
      const a=j*2.39+twist, tip=base.clone().add(new THREE.Vector3(.73*Math.cos(a),-.04,.58*Math.sin(a)));
      limb([base.clone().add(new THREE.Vector3(0,h*.058,0)),base.clone().lerp(tip,.54),tip],h*.020,.015);
    }
    for (let i=0;i<10;i++) {
      const t=.34+i*.069, foot=trunk.getPointAt(t), a=seed*.73+i*2.40+(rng()-.5)*.26;
      const reach=h*(.40-i*.034)*spread*(.85+.28*rng()), dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
      const elbow=foot.clone().addScaledVector(dir,reach*.53); elbow.y-=h*(.045-.003*i);
      const end=foot.clone().addScaledVector(dir,reach); end.y+=h*.043;
      const bough=new THREE.CatmullRomCurve3([foot,elbow,end]);
      limb([foot,elbow,end],h*(.019-i*.0013),.012);
      for (let j=0;j<4;j++) {
        const t0=.40+j*.17, origin=bough.getPointAt(t0), side=j%2?1:-1, angle=a+side*(.49+.42*rng());
        const length=(.36+.36*rng())*reach+.13, tip=origin.clone().add(new THREE.Vector3(Math.cos(angle)*length,.12+rng()*.1,Math.sin(angle)*length));
        limb([origin,origin.clone().lerp(tip,.55),tip],.030,.009,6);
        for (let k=0;k<3;k++) {
          const start=origin.clone().lerp(tip,.33+k*.29);
          brush.position.copy(start); brush.rotation.set((k-1)*.76+(rng()-.5)*.34,-angle+(rng()-.5)*.86,(rng()-.38)*.3,'YXZ');
          const s=(.62+length*.76)*(.90+.24*rng()); brush.scale.set(s,s,s*(1+.24*rng()));
          brush.updateMatrix(); transforms.push(brush.matrix.clone());
          colors.push(new THREE.Color().setScalar(.77+rng()*.31));
        }
      }
    }
  }
  pine(-5.08,3.86,5.45,1.18,119,1.03);
  pine(5.08,3.86,5.25,-1.06,91,1.04);
  pine(-13.7,3.4,6.05,1.38,13); pine(-11.75,9,5.1,-1.03,42);
  pine(-10.8,-10.4,6.0,-.92,77); pine(10.7,-10.4,5.4,1.16,31);
  pine(13.65,8.4,5.10,.85,108,.90);
  pine(5.75,11.25,5.6,.91,86,.87); pine(-5.8,11.4,5.35,-.94,52,1.06);
  const crowns = new THREE.InstancedMesh(fan,material,transforms.length); crowns.name='Wind-shaped pine boughs';
  transforms.forEach((matrix,i)=>{crowns.setMatrixAt(i,matrix); crowns.setColorAt(i,colors[i]);});
  crowns.castShadow=crowns.receiveShadow=true;
  crowns.userData.ignoreInteractionRay=true; crowns.userData.ignoreAmbientOcclusion=true; root.add(crowns);
  return { material, ready, dispose() { disposed=true; } };
}
