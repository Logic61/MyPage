import * as THREE from 'three';
import { GALLERY, TEA_PAVILION } from './hall-terrace';
import type { SurfaceLibrary } from './materials';

/** Split-reed blinds tied across actual openings. Each local Z axis runs along the supporting beam. */
export function buildReedShades(parent: THREE.Group, library: SurfaceLibrary, geometries: Set<THREE.BufferGeometry>, materials: Set<THREE.Material>) {
  const own=<T extends THREE.Material>(m:T)=>{materials.add(m);return m;};
  const keep=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
  const cane=own(library.material('paleWood',{color:'#efc486',roughness:.82,worldScale:1.4,normalScale:.17}));
  const cord=own(new THREE.MeshStandardMaterial({color:'#624028',roughness:.95}));
  const hook=own(library.material('brass',{color:'#85a595',roughness:.72,metalness:.55,worldScale:3}));
  const slat=keep(new THREE.CylinderGeometry(1,1,1,10)), roller=keep(new THREE.CylinderGeometry(1,1,1,24));
  const hoop=keep(new THREE.TorusGeometry(1,.105,5,20));
  const spiral=Array.from({length:42},(_,i)=>{
    const t=i/41,a=t*4*Math.PI,r=.007+.057*t;return new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),0);
  });
  const endGrain=keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral),41,.0027,4,false));
  function shade(name:string,x:number,top:number,z:number,yaw:number,width:number,drop:number) {
    const blind=new THREE.Group();blind.name=name;blind.position.set(x,top,z);blind.rotation.y=yaw;parent.add(blind);
    const pitch=.019,rows=Math.floor(drop/pitch),bottom=-rows*pitch;
    function piece(g:THREE.BufferGeometry,m:THREE.Material,name:string,x:number,y:number,z:number) {
      const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;blind.add(mesh);return mesh;
    }
    function bar(g:THREE.BufferGeometry,m:THREE.Material,name:string,x:number,y:number,z:number,r:number,length:number) {
      const mesh=piece(g,m,name,x,y,z);mesh.rotation.x=Math.PI/2;mesh.scale.set(r,length,r);
    }
    for(let row=0;row<rows;row++)
      bar(slat,cane,'Split reed in a suspended bamboo blind',.007*Math.cos(row*1.15),-row*pitch,0,.0078,width);
    bar(roller,cane,'Weighted roll at the foot of a bamboo blind',0,bottom,0,.072,width+.043);
    for(let flute=0;flute<16;flute++) {
      const a=flute*Math.PI/8;
      bar(slat,cane,'Bamboo lath on the rolled edge',.070*Math.cos(a),bottom+.070*Math.sin(a),0,.006,width+.028);
    }
    for(let warp=0;warp<7;warp++) {
      const along=width*(warp/6-.5)*.96;
      for(const face of [-1,1]) {
        const line=piece(slat,cord,'Woven binding on both faces of the blind',face*.009,bottom/2,along);
        line.scale.set(.0031,-bottom,.0031);
      }
      bar(slat,cord,'Cord encircling the lower roll',0,bottom,along,.075,warp===0||warp===6?.016:.007);
    }
    for(const side of [-1,1]){
      const ring=piece(hoop,hook,'Patinated loop at the blind header',0,.016,side*width*.37);
      ring.rotation.y=Math.PI/2;ring.scale.set(.034,.052,.034);
      piece(endGrain,cord,'Spiral end grain of the bamboo roll',0,bottom,side*(width/2+.023));
    }
  }
  const drops = [.46,.56,.34];
  for (let i=0;i<drops.length;i++) {
    const start = GALLERY.bents[i], end = GALLERY.bents[i+1];
    shade('West gallery reed blind',-GALLERY.outerPost+.02,2.97,(start+end)/2,0,end-start-.72,drops[i]);
  }
  // Between the workshop's three inner posts. Both roller edges clear a two-metre visitor on the gallery floor.
  shade('North workshop reed blind',3.20,2.983,-3.02,0,1.97,.48);
  shade('South workshop reed blind',3.20,2.983,-.74,0,2.05,.53);
  // A single long blind shelters the back of the settle and leaves the east-facing view open.
  const tea=TEA_PAVILION;
  shade('Outlook pavilion reed blind',tea.x-tea.postHalfX,tea.beamY-.12,tea.z,0,2*tea.postHalfZ-.30,.42);
}
