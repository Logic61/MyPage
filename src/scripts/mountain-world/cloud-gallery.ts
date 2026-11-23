import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { architecturalBlock } from './environment-geometry';
import type { SurfaceLibrary } from './materials';
import type { Collider } from './types';

/** Eroded limestone with two irregular tunnels. The field is sampled once when the gallery is built. */
function scholarStone(material: THREE.Material) {
  const size = 36, field = new MarchingCubes(size,material,false,false,7500);
  field.isolation = 0;
  for (let iz=0;iz<size;iz++) for (let iy=0;iy<size;iy++) for (let ix=0;ix<size;ix++) {
    const x=2*ix/size-1,y=2*iy/size-1,z=2*iz/size-1;
    const seam=.105*Math.sin(15*z+8*y+3*x)+.046*Math.sin(18*y-13*x)+.035*Math.sin(27*(x+z));
    const side=z-.18*y-.097*Math.sin(y*5);
    const flank=.58+.065*Math.sin(8*y+2.6*x)+.036*Math.cos(14*y);
    const body=1-(x/.41)**2-(y/.82)**2-(side/flank)**2+1.35*seam;
    const upper=((y-.29+.11*x)/.248)**2+((z-.089-.17*x)/.302)**2-1+seam;
    const lower=((y+.25+.12*x)/.179)**2+((z+.088-.18*x)/.176)**2-1+.85*seam;
    field.setCell(ix,iy,iz,Math.min(body,upper,lower));
  }
  field.update();
  const result=new THREE.BufferGeometry(), verts=field.geometry.drawRange.count;
  for (const key of ['position','normal']) {
    const data=field.geometry.getAttribute(key).array.slice(0,verts*3);
    result.setAttribute(key,new THREE.Float32BufferAttribute(data,3));
  }
  field.geometry.dispose();
  const points=result.getAttribute('position'), normals=result.getAttribute('normal'), colors=[];
  const warm=new THREE.Color('#fff4d5'), grey=new THREE.Color('#adaba3'), moss=new THREE.Color('#8d9958'), tint=new THREE.Color();
  for (let i=0;i<points.count;i++) {
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
    const grain=.5+.27*Math.sin(z*21+y*14)+.17*Math.sin(33*x-15*y+17*z);
    const upward=Math.max(0,normals.getY(i)),lichen=THREE.MathUtils.smoothstep(grain*upward,.33,.64);
    tint.copy(grey).lerp(warm,grain).lerp(moss,lichen*.79);
    colors.push(tint.r,tint.g,tint.b);
  }
  result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  result.scale(.53,.82,.62); result.computeBoundingSphere();
  return result;
}

/** A single mesh per crown, with tapered paired pinnae on arching fronds. */
function fernCrown() {
  const p:number[]=[],colors:number[]=[], shade=new THREE.Color('#46603b'), sun=new THREE.Color('#97a751'), tint=new THREE.Color();
  function leaf(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,light:number) {
    tint.copy(shade).lerp(sun,light);
    for(const v of [a,b,c,a,c,d]) {p.push(v.x,v.y,v.z);colors.push(tint.r,tint.g,tint.b);}
  }
  for(let f=0;f<9;f++) {
    const angle=f*2.39996,along=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const across=new THREE.Vector3(-along.z,0,along.x),length=.24+.08*Math.sin(f*1.9),height=.20+.05*Math.cos(f*1.13);
    const stem=(t:number)=>along.clone().multiplyScalar(length*t).setY(height*(1.95*t-1.33*t*t));
    for(let k=1;k<12;k++) {
      const t=k/12,a=stem(t),b=stem(t-1/12);
      leaf(a.clone().addScaledVector(across,.0018),b.clone().addScaledVector(across,.0018),
        b.clone().addScaledVector(across,-.0018),a.clone().addScaledVector(across,-.0018),.45);
      for(const side of [-1,1]) {
        const span=length*(.025+.18*Math.sin(t*Math.PI)**.7);
        const tip=a.clone().addScaledVector(across,side*span).addScaledVector(along,span*.72);tip.y+=.012;
        const centre=a.clone().lerp(tip,.43); centre.y+=.007;
        leaf(a,centre.clone().addScaledVector(along,.010*(1-.45*t)),tip,centre.clone().addScaledVector(along,-.008),.22+.57*t);
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

export function buildCloudGallery(parent: THREE.Group, library: SurfaceLibrary, geometries:Set<THREE.BufferGeometry>,
  materials:Set<THREE.Material>, colliders:Collider[]) {
  const group=new THREE.Group();group.name='West cliff gallery';parent.add(group);
  const own=<T extends THREE.Material>(m:T)=>{materials.add(m);return m;};
  const keep=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
  const stone=own(library.material('limestone',{color:'#d5d0b9',worldScale:1.4,normalScale:.34,roughness:.89}));
  const crag=own(library.material('limestone',{color:'#ede5d1',worldScale:1.5,normalScale:.48,roughness:.91}));crag.vertexColors=true;
  const loam=own(library.material('ground',{color:'#a2b086',worldScale:2.0,roughness:.96}));
  const foliage=own(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95}));
  function place(g:THREE.BufferGeometry,m:THREE.Material,name:string,x:number,y:number,z:number) {
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  // Circular cedar columns rise out of turned stone shoes. The shaped bracket shoulders face the bays.
  const cedar=own(library.material('paleWood',{color:'#ae6b50',worldScale:1.4,roughness:.70,normalScale:.22}));
  const ochre=own(library.material('paleWood',{color:'#bf9860',worldScale:1.8,roughness:.69,normalScale:.22}));
  const plinth=keep(architecturalBlock(.354,.105,.354,.015));
  const shoe=keep(new THREE.LatheGeometry([[.162,0],[.163,.044],[.126,.118],[.147,.146],[.159,.159],[.151,.177],[.118,.193]]
    .map(([r,h])=>new THREE.Vector2(r,h)),16));
  const shaft=keep(new THREE.CylinderGeometry(.098,.112,2.255,20));
  const ankle=keep(new THREE.CylinderGeometry(.120,.120,.030,20));
  const shoulder=new THREE.Shape();
  shoulder.moveTo(0,0); shoulder.lineTo(.37,0); shoulder.quadraticCurveTo(.325,-.09,.225,-.09);
  shoulder.bezierCurveTo(.22,-.16,.155,-.155,.116,-.142);shoulder.quadraticCurveTo(.10,-.202,0,-.218);shoulder.closePath();
  const bracket=keep(new THREE.ExtrudeGeometry(shoulder,{depth:.077,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,curveSegments:4}));
  for(const along of [-5.65,-1.8,2,7.55]){
    place(plinth,stone,'Stone shoe of a round gallery column',-8.28,.3525,along);
    place(shoe,stone,'Carved collar on the west gallery pier',-8.28,.405,along);
    place(shaft,cedar,'Tapered cedar gallery column',-8.28,1.7255,along);
    place(ankle,ochre,'Cedar basal moulding',-8.28,.611,along);
    for(const side of [-1,1]){
      const top=place(bracket,cedar,'Scroll-cut timber shoulder',-8.28-side*.0385,2.80,along);
      top.rotation.y=side*Math.PI/2;
      const rim=place(bracket,ochre,'Recessed apron below the gallery plate',-8.28-side*.049,2.76,along);
      rim.rotation.y=side*Math.PI/2;rim.scale.set(.71,.80,1.12);
    }
    colliders.push({x:-8.28,z:along,halfX:.177,halfZ:.177});
  }

  const x=-6.64,z=-1.87,w=.71,h=.25,d=1.86, rim=.072;
  function ashlar(width:number,height:number,depth:number,px:number,py:number,pz:number) {
    place(keep(architecturalBlock(width,height,depth,.012)),stone,'Dressed curb of the fern trough',px,py,pz);
  }
  for(const sign of [-1,1]) {
    ashlar(rim,h,d,x+sign*(w-rim)/2,.30+h/2,z);
    ashlar(w-rim*2,h,rim,x,.30+h/2,z+sign*(d-rim)/2);
  }
  place(keep(new THREE.BoxGeometry(w-rim*2,.026,d-rim*2)),loam,'Recessed soil in the west fern trough',x,.50,z);
  const rock=place(keep(scholarStone(crag)),crag,'Double-perforated Taihu scholar stone',x,1.18,z-.008);
  rock.rotation.y=.94;
  const fern=keep(fernCrown());
  for(const [i,[dx,dz,scale]] of [[-.09,-.63,1.03],[.08,.66,.91],[-.15,.40,1.08],[.11,-.44,.72]].entries()){
    const crown=place(fern,foliage,'Pinnate fern at the foot of the scholar stone',x+dx,.517,z+dz);
    crown.rotation.y=i*1.22;crown.scale.setScalar(scale);
  }
  colliders.push({x,z,halfX:w/2,halfZ:d/2});
  return crag;
}
