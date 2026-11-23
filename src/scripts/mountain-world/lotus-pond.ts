import * as THREE from 'three';
import { gridSurface } from './environment-geometry';

function leafBlade(phase: number) {
  const spokes = 64, rings = 8;
  const vertices = [0,0,0], uv = [.5,.5], indices: number[] = [];
  const ring = (r: number, j: number) => 1 + (r-1)*spokes + j%spokes;
  for (let r = 1; r <= rings; r++) for (let j = 0; j < spokes; j++) {
    const t = r/rings, a = j/spokes * Math.PI*2;
    const outline = 1 + .055*Math.cos(3*a + phase) + .032*Math.sin(7*a - phase);
    const x = t*outline*Math.cos(a), z = t*outline*Math.sin(a)*.94;
    const lip = .14*Math.sin(4*a + phase) + .065*Math.sin(7*a - phase);
    const y = .18*t**1.35 + lip*t**2.6 + .023*Math.cos(16*a)*t*(1-t);
    vertices.push(x,y,z); uv.push(.5+x*.445,.5-z*.445);
    if (r === 1) indices.push(0,ring(r,j+1),ring(r,j));
    else indices.push(ring(r-1,j),ring(r-1,j+1),ring(r,j),ring(r-1,j+1),ring(r,j+1),ring(r,j));
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  result.setIndex(indices); result.computeVertexNormals(); return result;
}

export function createLotusPlanting(parent: THREE.Group, geometries: Set<THREE.BufferGeometry>, materials: Set<THREE.Material>) {
  function keep(g: THREE.BufferGeometry) { geometries.add(g); return g; }
  function surface(p: THREE.MeshStandardMaterialParameters) { const m = new THREE.MeshStandardMaterial(p); materials.add(m); return m; }
  const blade = surface({name:'Waxy lotus blade',color:'#71946a',roughness:.56,side:THREE.DoubleSide});
  const green = surface({color:'#66835c',roughness:.71});
  const rose = surface({name:'Porcelain pink lotus petals',vertexColors:true,roughness:.64,side:THREE.DoubleSide});
  const saffron = surface({color:'#e7ad49',roughness:.73}), seeds = surface({color:'#a7883d',roughness:.82});
  const leaves = [.25,1.8,3.6].map(a=>keep(leafBlade(a)));
  const cream = new THREE.Color('#fff3db'), pink = new THREE.Color('#d88496');
  const petal = keep(gridSurface(10,12,(u,v)=>{
    const w = 2*u-1, open = Math.pow(Math.sin(Math.PI*v),.82);
    return new THREE.Vector3(w * (.041+.017*v)*open, .085*v*v+.025*w*w*open+.019*Math.sin(Math.PI*v), .147*v);
  },false,(u,v)=>cream.clone().lerp(pink,.07+.64*v*v+.10*Math.abs(2*u-1)**2+.042*(1+Math.cos(u*24))*v)));
  const budForm = keep(new THREE.LatheGeometry([[0,0],[.022,.009],[.036,.036],[.039,.061],[.034,.086],[.022,.111],[.009,.134],[0,.145]]
    .map(([r,y])=>new THREE.Vector2(r,y)),36));
  const budColor = new Float32Array(budForm.attributes.position.count*3);
  const budBase = new THREE.Color('#a8ad74'), budTip = new THREE.Color('#d88e9f');
  for (let j=0;j<budForm.attributes.position.count;j++) {
    const v = budForm.attributes.uv.getY(j), a = budForm.attributes.uv.getX(j)*Math.PI*2;
    const ribs = Math.pow(.5+.5*Math.cos(6*a+v*.8),8)*Math.sin(Math.PI*v);
    cream.clone().lerp(budBase,Math.max(0,1-v*2)).lerp(budTip,.26+.68*v+.16*ribs).toArray(budColor,j*3);
  }
  budForm.setAttribute('color',new THREE.BufferAttribute(budColor,3));
  const stalk = keep(new THREE.CylinderGeometry(.006,.008,1,8));
  const receptacle = keep(new THREE.CylinderGeometry(.026,.012,.024,26));
  const dot = keep(new THREE.SphereGeometry(1,8,6)), up = new THREE.Vector3(0,1,0);
  let colony: THREE.Group;
  function place(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    const mesh = new THREE.Mesh(geometry,material); mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true; colony.add(mesh); return mesh;
  }
  function stem(x: number, y: number, z: number, lean: number) {
    const delta = new THREE.Vector3(lean,y-.20,.018);
    const mesh = place(stalk,green,x-lean/2,(.20+y)/2,z-.009);
    mesh.quaternion.setFromUnitVectors(up,delta.clone().normalize()); mesh.scale.y = delta.length();
  }
  function blossom(x: number, y: number, z: number, phase: number, bud: boolean) {
    stem(x,y+.006,z,.036);
    if (bud) { place(budForm,rose,x,y,z).rotation.z=.09*phase; return; }
    for (const [count,size,tilt] of [[11,1.03,.06],[8,.85,-.18],[6,.61,-.43]]) {
      for (let j=0;j<count;j++) {
        const a = j*2*Math.PI/count + phase + tilt*2;
        const foot=.028*size;
        const p = place(petal,rose,x+foot*Math.sin(a),y-.005*size,z+foot*Math.cos(a));
        p.rotation.set(tilt+.035*Math.sin(j*4),a,.035*Math.cos(j*3),'YXZ');
        p.scale.set(size,size,size);
      }
    }
    place(receptacle,saffron,x,y+.034,z);
    for (let k=0;k<21;k++) {
      const a=k*2.39996, r=.031+.008*(k%3)/2;
      place(dot,saffron,x+r*Math.cos(a),y+.038+.004*(k%4),z+r*Math.sin(a)).scale.set(.0031,.009,.0031);
      if (k<10) {
        const d=.020*Math.sqrt(k/10);
        place(dot,seeds,x+d*Math.cos(a),y+.046,z+d*Math.sin(a)).scale.set(.0025,.0018,.0025);
      }
    }
  }
  let disposed = false, texture: THREE.Texture | undefined;
  const url = (import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/,'')+'/world/lotus-leaf.webp';
  const ready = new THREE.TextureLoader().loadAsync(url).then(map=>{
    if (disposed) { map.dispose(); return; }
    texture=map; map.colorSpace=THREE.SRGBColorSpace; map.anisotropy=4;
    blade.color.set('#f1f5e7'); blade.map=map; blade.needsUpdate=true;
  }).catch(()=>{ /* The folded green blade is visible as soon as the pond is built. */ });
  return {
    ready, dispose() { disposed=true; texture?.dispose(); },
    plant(x: number, z: number, side: number, heading: number, scale: number) {
      colony=new THREE.Group(); colony.name='Lotus colony';
      colony.position.set(x,.24*(1-scale),z); colony.rotation.y=heading; colony.scale.setScalar(scale);
      parent.add(colony);
      const patches = [[-.33,-.64,.19,.285],[.09,-.53,.22,.38],[.35,-.29,.16,.30],
        [-.29,-.08,.27,.43],[.17,.09,.23,.28],[-.34,.40,.16,.29],[.08,.57,.26,.39],[.38,.73,.15,.30]];
      patches.forEach(([dx,dz,r,h],j)=>{
        const px=side*dx,pz=dz;
        stem(px,h,pz,side*.027);
        const m=place(leaves[j%leaves.length],blade,px,h,pz);
        m.scale.setScalar(r); m.rotation.set(.05*Math.sin(j),j*2.39*side,.10*Math.cos(j),'YXZ');
      });
      blossom(side*.25,.49,-.48,side*.6,false);
      if (scale>.8) blossom(-side*.12,.55,.54,side*1.4,false);
      blossom(-side*.35,.54,-.32,side*.8,true);
    },
  };
}
