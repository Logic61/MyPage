import * as THREE from 'three';
import { gridSurface } from './environment-geometry';

function leafBlade(phase: number) {
  const spokes = 64, rings = 8;
  const vertices = [0,-.018,0], uv = [.5,.5], indices: number[] = [];
  const colors=[.85,.91,.72];
  const ring = (r: number, j: number) => 1 + (r-1)*spokes + j%spokes;
  for (let r = 1; r <= rings; r++) for (let j = 0; j < spokes; j++) {
    const t = r/rings, a = j/spokes * Math.PI*2;
    const outline = 1 + .055*Math.cos(3*a + phase) + .032*Math.sin(7*a - phase);
    const x = t*outline*Math.cos(a), z = t*outline*Math.sin(a)*.94;
    const lip = .14*Math.sin(4*a + phase) + .065*Math.sin(7*a - phase);
    const vein=.5+.5*Math.cos(16*a);
    const y = -.018+.22*t**1.35 + lip*t**2.6 + .038*vein**4*t*(1-t);
    vertices.push(x,y,z); uv.push(.5+x*.445,.5-z*.445);
    const rim=Math.max(0,(t-.84)/.16),light=vein**6*.085;
    colors.push(.73+light+rim*.19,.85+light+rim*.05,.72+light-rim*.10);
    if (r === 1) indices.push(0,ring(r,j+1),ring(r,j));
    else indices.push(ring(r-1,j),ring(r-1,j+1),ring(r,j),ring(r-1,j+1),ring(r,j+1),ring(r,j));
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  result.setIndex(indices); result.computeVertexNormals(); return result;
}

export function createLotusPlanting(parent: THREE.Group, geometries: Set<THREE.BufferGeometry>, materials: Set<THREE.Material>) {
  function keep(g: THREE.BufferGeometry) { geometries.add(g); return g; }
  function surface(p: THREE.MeshStandardMaterialParameters) { const m = new THREE.MeshStandardMaterial(p); materials.add(m); return m; }
  const blade = surface({name:'Waxy lotus blade',color:'#71946a',vertexColors:true,roughness:.58,side:THREE.DoubleSide});
  const green = surface({color:'#66835c',roughness:.71});
  const rose = surface({name:'Porcelain pink lotus petals',vertexColors:true,roughness:.64,side:THREE.DoubleSide});
  const saffron = surface({color:'#e7ad49',roughness:.73}), seeds = surface({color:'#a7883d',roughness:.82});
  const leaves = [.25,1.8,3.6].map(a=>keep(leafBlade(a)));
  const cream = new THREE.Color('#fff0cb'), pink = new THREE.Color('#df5f90');
  const petal = keep(gridSurface(10,12,(u,v)=>{
    const w=2*u-1, shoulder=Math.sin(Math.PI*v)**.73, cup=w*w*shoulder;
    return new THREE.Vector3(w*.064*shoulder*(.78+.38*v),.024*Math.sin(Math.PI*v)+.142*v*v+.038*cup,
      .170*v-.044*v**3+.003*cup);
  },true,(u,v)=>{
    const edge=Math.abs(2*u-1),rib=.10*(.5+.5*Math.cos((u-.5)*29+1.7*v))**5;
    return cream.clone().lerp(pink,Math.min(.99,.055+.73*v**1.75+.24*edge**3*v+rib*v));
  }));
  const rolled=keep(gridSurface(20,11,(u,v)=>{
    const a=(.29+1.48*v)*Math.PI*u, r=.015+.032*v;
    return new THREE.Vector3(Math.sin(a)*r,.205*v+.014*Math.sin(a)*v,Math.cos(a)*r+.046*v*v);
  },false));
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
  const receptacle = keep(new THREE.LatheGeometry([[.009,0],[.018,.012],[.034,.041],[.044,.048],[.045,.054],[.038,.057],[0,.056]]
    .map(([r,y])=>new THREE.Vector2(r,y)),24));
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
    for (const [count,size,tilt] of [[10,1.10,.38],[8,.91,.024],[6,.72,-.32]]) {
      for (let j=0;j<count;j++) {
        const a = j*2*Math.PI/count + phase + tilt*2;
        const foot=.028*size;
        const p = place(petal,rose,x+foot*Math.sin(a),y-.005*size,z+foot*Math.cos(a));
        p.rotation.set(tilt+.035*Math.sin(j*4),a,.035*Math.cos(j*3),'YXZ');
        p.scale.set(size,size,size);
      }
    }
    place(receptacle,saffron,x,y+.003,z).scale.setScalar(.84);
    for (let k=0;k<21;k++) {
      const a=k*2.39996, r=.031+.008*(k%3)/2;
      place(dot,saffron,x+r*Math.cos(a),y+.038+.004*(k%4),z+r*Math.sin(a)).scale.set(.0031,.009,.0031);
      if (k<10) {
        const d=.020*Math.sqrt(k/10);
        place(dot,seeds,x+d*Math.cos(a),y+.046,z+d*Math.sin(a)).scale.set(.0025,.0018,.0025);
      }
    }
  }
  function seedHead(x:number,y:number,z:number,heading:number) {
    stem(x,y+.008,z,.047);
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.set(.41,heading,.12,'YXZ');
    group.scale.setScalar(1.57);colony.add(group);
    const pod=new THREE.Mesh(receptacle,saffron);group.add(pod);
    for(let i=0;i<12;i++){
      const angle=i*2.39996,rad=.030*Math.sqrt(i/11);
      const socket=new THREE.Mesh(dot,seeds);
      socket.scale.set(.0058,.0019,.0058);socket.position.set(rad*Math.cos(angle),.057,rad*Math.sin(angle));
      group.add(socket);
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
      const patches = [[-.33,-.64,.225,.278],[.09,-.53,.245,.52],[.35,-.29,.17,.302],
        [-.29,-.08,.285,.412],[.17,.09,.245,.282],[-.34,.40,.208,.277],[.08,.57,.274,.36],[.38,.73,.18,.275]];
      patches.forEach(([dx,dz,r,h],j)=>{
        const px=side*dx,pz=dz;
        stem(px,h,pz,side*.027);
        const m=place(leaves[j%leaves.length],blade,px,h,pz);
        const standing=h>.4;
        m.scale.set(r,r*(standing?1.7:.55),r); m.rotation.set(standing?.17:.026,j*2.39*side,(standing?.24:.045)*Math.cos(j),'YXZ');
      });
      if (scale>.8) {
        blossom(side*.25,.64,-.48,side*.6,false);
        seedHead(side*.22,.62,.27,heading);
      } else blossom(side*.25,.54,-.48,side*.6,false);
      blossom(-side*.34,.68,.47,side*.8,true);
      stem(side*.38,.39,-.08,.017);
      place(rolled,green,side*.38,.39,-.08).rotation.z=side*.22;
    },
  };
}
