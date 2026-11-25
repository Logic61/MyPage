import * as THREE from 'three';
import { seeded } from './environment-geometry';

/** Gather the folded surfaces of a plant into a single indexed, vertex-coloured mesh. */
export class PlantSurface {
  private points: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  patch(across: number, along: number, sample: (u: number, t: number) => [THREE.Vector3, THREE.Color]) {
    const first = this.points.length / 3;
    for (let j=0;j<=along;j++) for (let i=0;i<=across;i++) {
      const [point, color] = sample(i / across, j / along);
      this.points.push(point.x, point.y, point.z);
      this.colors.push(color.r, color.g, color.b);
      if (i && j) {
        const d=first+j*(across+1)+i, a=d-across-2;
        this.indices.push(a,a+1,d-1, a+1,d,d-1);
      }
    }
  }

  finish() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.points,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    g.setIndex(this.indices); g.computeVertexNormals(); return g;
  }
}

const darkBlade = new THREE.Color('#34452c'), litBlade = new THREE.Color('#91a35e');
const olive = new THREE.Color('#6c7941'), ivoryVein = new THREE.Color('#bac281');
const sheath = new THREE.Color('#94865e');

// A strap leaf rolls as it arches. Its keel and pale midrib remain visible close to the camera.
function strap(batch: PlantSurface, root: THREE.Vector3, angle: number, reach: number, height: number,
  width: number, droop: number, twist: number, tint: number) {
  batch.patch(4,10,(u,t) => {
    const across = 2*u-1;
    const w = width*(.21+.79*Math.sin(Math.PI*t)**.70)*(1-.992*t**7);
    const az = angle + twist * t*t, dx=Math.cos(az), dz=Math.sin(az);
    const radial = reach*(.14*t+.86*t*t), bank = twist*(.3+1.8*t);
    const point = new THREE.Vector3(root.x+dx*radial-dz*w*across, root.y+height*t*(2.05-1.04*t)
      -droop*t**3+w*(bank*across+.37*(1-Math.abs(across))), root.z+dz*radial+dx*w*across);
    const color = darkBlade.clone().lerp(litBlade,.16+.26*t+tint+(across>0?.045:0));
    if (across===0) color.lerp(ivoryVein,.22);
    return [point,color];
  });
}

/** Cymbidium foliage grows in overlapping fans with alternating sheaths at the base. */
export function orchidFans() {
  const batch=new PlantSurface(), rng=seeded(35482);
  for(const [dx,dz,heading,size] of [[0,0,-.55,1],[.043,-.048,-.10,.75]]) {
    for(let i=0;i<6;i++) {
      const outer=1-i/6, angle=heading+(i%2 ? Math.PI : 0)+(rng()-.5)*.49;
      const root=new THREE.Vector3(dx + Math.cos(angle)*outer*.029, -.009, dz+Math.sin(angle)*outer*.029);
      batch.patch(6,5,(u,t)=>{
        const a=angle+(u-.5)*(2.2-1.3*t),radius=size*(.015*(1-.85*t)+.007*t*t);
        const y=-.011+size*(.087+.026*outer)*t*(1-.38*Math.abs(2*u-1));
        return [new THREE.Vector3(root.x+radius*Math.cos(a),y,root.z+radius*Math.sin(a)),
          sheath.clone().lerp(olive,.36+.56*t)];
      });
      strap(batch,root,angle,size*(.12+outer*.31),size*(.53-.13*outer),.0125*size,
        size*(.045+.225*outer), (rng()-.5)*.61, .02+rng()*.18);
    }
  }
  return batch.finish();
}

/** Each frond has a bare petiole, an arching rachis and two offset ranks of lanceolate pinnae. */
export function fernCrown() {
  const batch=new PlantSurface(), rng=seeded(1763);
  for(let f=0;f<7;f++) {
    const angle=f*2.39996+rng()*.24, dx=Math.cos(angle), dz=Math.sin(angle);
    const length=.23+rng()*.11, tall=.17+rng()*.14;
    const stem=(t:number)=>new THREE.Vector3(dx*length*t**1.36,tall*(1.93*t-1.24*t*t),dz*length*t**1.36);
    batch.patch(2,12,(u,t)=>{
      const p=stem(t),radius=.0028*(1-.79*t), offset=(u*2-1)*radius;
      p.x-=dz*offset; p.z+=dx*offset; p.y+=radius*(1-Math.abs(u*2-1));
      return [p,olive];
    });
    for(let row=0;row<8;row++) for(const side of [-1,1]) {
      const t=.17+(row+(side>0?.29:0))*.099, base=stem(t);
      const span=length*(.025+.20*Math.sin(Math.PI*t)**.77)*(1-.27*t);
      const az=angle+side*(1.15-.48*t), ax=Math.cos(az), azimZ=Math.sin(az);
      const halfWidth=.0125*(1-.53*t);
      batch.patch(2,5,(u,v)=>{
        const s=u*2-1, w=halfWidth*(.025+.975*Math.sin(Math.PI*v)**.76);
        const travel=span*v;
        const p=new THREE.Vector3(base.x+ax*travel-azimZ*w*s,base.y+span*(.45*v-.29*v*v)
          +.32*w*(1-Math.abs(s)),base.z+azimZ*travel+ax*w*s);
        const color=darkBlade.clone().lerp(litBlade,.21+.25*t+.17*v+(side+1)*.035);
        if(s===0) color.lerp(olive,.31);
        return [p,color];
      });
    }
  }
  return batch.finish();
}

export type PlantingBank = {
  soil: [x:number, z:number, radiusX:number, radiusZ:number, height:number];
  sedges?: [u:number, v:number, scale:number][];
};

/** Each tussock stays with its own patch of soil when a bank is moved or removed. */
export function bankSedges(banks: readonly PlantingBank[]) {
  const batch=new PlantSurface(), rng=seeded(952);
  for (const {soil:[cx,cz,rx,rz,h], sedges=[]} of banks) {
    for (const [u,v,size] of sedges) {
      const root=new THREE.Vector3(cx+u*rx,.274+h*(1-u*u-v*v),cz+v*rz);
      for(let i=0;i<10;i++) {
        const reach=(.085+rng()*.17)*size;
        strap(batch,root,i*2.39996+rng()*.6,reach,size*(.12+rng()*.17),.0055*size,
          reach*(.30+rng()*.28),(rng()-.5)*.64,.02+rng()*.22);
      }
    }
  }
  return batch.finish();
}
