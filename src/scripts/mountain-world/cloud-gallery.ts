import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { architecturalBlock } from './environment-geometry';
import { GALLERY } from './hall-terrace';
import { fernCrown } from './woodland-foliage';
import type { SurfaceLibrary } from './materials';
import type { Collider } from './types';

/** Eroded limestone with two irregular tunnels. The field is sampled once when the gallery is built. */
function scholarStone(material: THREE.Material, pineBed=false) {
  const size = 36, field = new MarchingCubes(size,material,false,false,pineBed?10000:7500);
  field.isolation = 0;
  for (let iz=0;iz<size;iz++) for (let iy=0;iy<size;iy++) for (let ix=0;ix<size;ix++) {
    const x=2*ix/size-1,y=2*iy/size-1,z=2*iz/size-1;
    const seam=.105*Math.sin(15*z+8*y+3*x)+.046*Math.sin(18*y-13*x)+.035*Math.sin(27*(x+z));
    const side=z-.18*y-.097*Math.sin(y*5);
    const flank=.58+.065*Math.sin(8*y+2.6*x)+.036*Math.cos(14*y);
    const body=1-(x/.41)**2-(y/.82)**2-(side/flank)**2+1.35*seam;
    const upper=((y-.29+.11*x)/.248)**2+((z-.089-.17*x)/.302)**2-1+seam;
    const lower=((y+.25+.12*x)/.179)**2+((z+.088-.18*x)/.176)**2-1+.85*seam;
    if (pineBed) {
      const spine=z+.22*y+.054*Math.sin(6*y);
      const flank=.66-.15*y+.052*Math.cos(8*y);
      const fractures=.046*Math.sin(23*z+15*x)*Math.cos(16*y)+.033*Math.cos(21*x-13*z+23*y);
      const mass=1-(x/(.54-.09*y))**2-(y/.81)**2-(spine/flank)**2+1.47*seam+fractures;
      const window=((y-.22-.57*x)/.176)**2+((z+.054-.21*x)/.198)**2-1+.84*seam;
      const notch=((y+.50+.075*x)/.108)**2+((z-.42-.14*x)/.16)**2-1+.55*seam;
      field.setCell(ix,iy,iz,Math.min(mass,window,notch));
    } else field.setCell(ix,iy,iz,Math.min(body,upper,lower));
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

export function buildCloudGallery(parent: THREE.Group, library: SurfaceLibrary, geometries:Set<THREE.BufferGeometry>,
  materials:Set<THREE.Material>, colliders:Collider[]) {
  const group=new THREE.Group();group.name='Cloudside gallery joinery and scholar stone';parent.add(group);
  const own=<T extends THREE.Material>(m:T)=>{materials.add(m);return m;};
  const keep=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
  const stone=own(library.material('limestone',{color:'#d5d0b9',worldScale:1.4,normalScale:.34,roughness:.89}));
  const crag=own(library.material('limestone',{color:'#ede5d1',worldScale:1.5,normalScale:.48,roughness:.91}));crag.vertexColors=true;
  const loam=own(library.material('ground',{color:'#ac957a',worldScale:2.6,roughness:.96}));
  const foliage=own(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.76}));
  function place(g:THREE.BufferGeometry,m:THREE.Material,name:string,x:number,y:number,z:number) {
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  // Circular cedar columns rise out of turned stone shoes. The shaped bracket shoulders face the bays.
  const cedar=own(library.material('paleWood',{color:'#ae6b50',worldScale:1.4,roughness:.70,normalScale:.22}));
  const ochre=own(library.material('paleWood',{color:'#bf9860',worldScale:1.8,roughness:.69,normalScale:.22}));
  const plinth=keep(architecturalBlock(.354,.105,.354,.015));
  const shoe=keep(new THREE.LatheGeometry([[.162,0],[.163,.044],[.126,.118],[.147,.146],[.159,.159],[.151,.177],[.118,.193]]
    .map(([r,h])=>new THREE.Vector2(r,h)),16));
  const shaft=keep(new THREE.CylinderGeometry(.104,.12,2.465,24));
  const ankle=keep(new THREE.CylinderGeometry(.120,.120,.030,20));
  const shoulder=new THREE.Shape();
  shoulder.moveTo(0,0); shoulder.lineTo(.37,0); shoulder.quadraticCurveTo(.325,-.09,.225,-.09);
  shoulder.bezierCurveTo(.22,-.16,.155,-.155,.116,-.142);shoulder.quadraticCurveTo(.10,-.202,0,-.218);shoulder.closePath();
  const bracket=keep(new THREE.ExtrudeGeometry(shoulder,{depth:.077,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,curveSegments:4}));
  for (const postX of [-GALLERY.outerPost,GALLERY.outerPost]) for (const along of GALLERY.bents) {
    place(plinth,stone,'Stone shoe of a round gallery column',postX,.3525,along);
    place(shoe,stone,'Carved collar on the gallery pier',postX,.405,along);
    place(shaft,cedar,'Tapered cedar gallery column',postX,1.8305,along);
    place(ankle,ochre,'Cedar basal moulding',postX,.611,along);
    for(const side of [-1,1]){
      const top=place(bracket,cedar,'Scroll-cut timber shoulder',postX-side*.0385,3.01,along);
      top.rotation.y=side*Math.PI/2;
      const rim=place(bracket,ochre,'Recessed apron below the gallery plate',postX-side*.049,2.97,along);
      rim.rotation.y=side*Math.PI/2;rim.scale.set(.71,.80,1.12);
    }
    colliders.push({x:postX,z:along,halfX:.177,halfZ:.177});
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
  const ornamentalStone=keep(scholarStone(crag));
  const rock=place(ornamentalStone,crag,'Double-perforated Taihu scholar stone',x,1.18,z-.008);
  rock.rotation.y=.94;
  const fern=keep(fernCrown());
  for(const [i,[dx,dz,scale]] of [[-.09,-.63,1.03],[.08,.66,.91],[-.15,.40,1.08],[.11,-.44,.72]].entries()){
    const crown=place(fern,foliage,'Pinnate fern at the foot of the scholar stone',x+dx,.517,z+dz);
    crown.rotation.y=i*1.22;crown.scale.setScalar(scale);
  }
  colliders.push({x,z,halfX:w/2,halfZ:d/2});
  return { crag, ornamentalStone: keep(scholarStone(crag,true)), fern, foliage };
}
