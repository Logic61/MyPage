import * as THREE from 'three';
import { seeded } from './environment-geometry';
import type { SurfaceLibrary } from './materials';

type Point = [number, number];
type Rect = { x0: number; x1: number; z0: number; z1: number };
type Finish = 'field' | 'border' | 'threshold' | 'wood' | 'woodEdge';
type Owner = <T extends THREE.BufferGeometry>(value: T) => T;

const shades: Record<Finish, [string,string]> = {
  field: ['#e5ddd0','#fff6e7'],
  border: ['#c8bfb2','#dfd2c0'],
  threshold: ['#d4cdbe','#ebdfc8'],
  wood: ['#d8bd9e','#f7dfbd'],
  woodEdge: ['#bc9776','#d0b393'],
};

function subtract(rect: Rect, opening: Rect) {
  if (rect.x1 <= opening.x0 || rect.x0 >= opening.x1 || rect.z1 <= opening.z0 || rect.z0 >= opening.z1) return [rect];
  const x0 = Math.max(rect.x0,opening.x0), x1 = Math.min(rect.x1,opening.x1);
  const z0 = Math.max(rect.z0,opening.z0), z1 = Math.min(rect.z1,opening.z1);
  return [{...rect,x1:x0},{...rect,x0:x1},{x0,x1,z0:rect.z0,z1:z0},{x0,x1,z0:z1,z1:rect.z1}]
    .filter(r => r.x1-r.x0 > .025 && r.z1-r.z0 > .025);
}

/** One geometry per floor. Joints are open; a narrow chamfer on each piece catches the sun at grazing angles. */
class CourseMesh {
  private positions: number[] = [];
  private colors: number[] = [];
  private uv: number[] = [];
  private indices: number[] = [];
  private random: () => number;
  constructor(seed: number) { this.random = seeded(seed); }

  polygon(outline: Point[], y: number, finish: Finish, alongX = false) {
    const isWood = finish === 'wood' || finish === 'woodEdge';
    const center = outline.reduce(([x,z],[a,b]) => [x+a/outline.length,z+b/outline.length] as Point, [0,0] as Point);
    const color = new THREE.Color(shades[finish][0]).lerp(new THREE.Color(shades[finish][1]),this.random());
    const angle = isWood ? (alongX ? Math.PI/2 : 0) : this.random()*.30 + (this.random()>.5 ? Math.PI/2 : 0);
    const c = Math.cos(angle), s = Math.sin(angle), u0 = this.random(), v0 = this.random();
    const add = (x: number,z: number,height: number,light: number) => {
      const i = this.positions.length/3;
      this.positions.push(x,height,z);
      this.colors.push(color.r*light,color.g*light,color.b*light);
      this.uv.push(u0+(x*c-z*s)*(isWood ? 2.5 : .93),v0+(x*s+z*c)*(isWood ? .48 : .93));
      return i;
    };
    const mid = add(...center,y,1);
    const top: number[] = [], lip: number[] = [];
    for (let i=0;i<outline.length;i++) {
      const [x,z] = outline[i];
      const prev = outline[(i+outline.length-1)%outline.length], next = outline[(i+1)%outline.length];
      const left = Math.hypot(prev[0]-x,prev[1]-z), right = Math.hypot(next[0]-x,next[1]-z);
      const inset = Math.min(isWood ? .0018 : .0045, left*.15,right*.15);
      const ix = x+inset*((prev[0]-x)/left+(next[0]-x)/right);
      const iz = z+inset*((prev[1]-z)/left+(next[1]-z)/right);
      top.push(add(ix,iz,y,1));
      lip.push(add(x,z,y-inset*1.2,isWood ? .83 : .88));
    }
    for (let i=0;i<outline.length;i++) {
      const j=(i+1)%outline.length;
      this.indices.push(mid,top[i],top[j],top[i],lip[i],lip[j],top[i],lip[j],top[j]);
    }
  }

  rectangle(r: Rect, y: number, finish: Finish, alongX = false) {
    const isWood = finish === 'wood' || finish === 'woodEdge';
    const gap = isWood ? .0025 : .0035;
    const a=r.x0+gap,b=r.x1-gap,c=r.z0+gap,d=r.z1-gap;
    if (b-a < .022 || d-c < .022) return;
    // A few millimetres of irregularity at a sawn corner are enough at walking distance.
    const corner = Math.min((b-a)*.11,(d-c)*.11,isWood ? .0022 : .006+this.random()*.014);
    this.polygon([[a+corner,c],[a,c+corner],[a,d-corner],[a+corner,d],[b-corner,d],[b,d-corner],[b,c+corner],[b-corner,c]],y,finish,alongX);
  }

  finish(parent: THREE.Object3D, name: string, material: THREE.Material, keep: Owner) {
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geometry.setIndex(this.indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = name; mesh.receiveShadow = true; parent.add(mesh);
  }
}

export function createFloorFinishes(library: SurfaceLibrary, keep: Owner, own: <T extends THREE.Material>(value: T)=>T) {
  const stone = own(library.material('limestone',{normalScale:.22,roughness:.99}));
  const wood = own(library.material('paleWood',{normalScale:.16,roughness:1}));
  stone.name = 'Honed warm mountain limestone'; wood.name = 'Oiled, quarter-sawn veranda timber';
  stone.vertexColors = wood.vertexColors = true;
  let released = false;
  const textures: THREE.Texture[] = [];
  const base = (import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/,'')+'/world/';
  async function load(material: THREE.MeshStandardMaterial, file: string) {
    try {
      const texture = await new THREE.TextureLoader().loadAsync(base+file);
      if (released) { texture.dispose(); return; }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=8;
      textures.push(texture); material.map=texture; material.needsUpdate=true;
    } catch { /* The same geometry already has its generated mineral or timber surface. */ }
  }
  const ready = Promise.all([load(stone,'honed-limestone.webp'),load(wood,'oiled-elm.webp')]);

  function flags(parent: THREE.Object3D, rect: Rect, rowSize: number, length: number, holes: Rect[] = [], finish: Finish = 'field', y = .304) {
    const rows = Math.max(1,Math.round((rect.z1-rect.z0)/rowSize)), step = (rect.z1-rect.z0)/rows;
    const batch = new CourseMesh(Math.round(700+rect.x0*61+rect.z0*123));
    for (let row=0;row<rows;row++) {
      const z0=rect.z0+row*step;
      const offset = rect.x1-rect.x0 <= length+.001 ? 0 : [0,.50,.16,.66][row%4]*length;
      for (let x=rect.x0-offset; x<rect.x1-.01; x+=length) {
        const tile={x0:Math.max(x,rect.x0),x1:Math.min(x+length,rect.x1),z0,z1:z0+step};
        for (const r of holes.reduce<Rect[]>((pieces,hole)=>pieces.flatMap(piece=>subtract(piece,hole)),[tile]))
          batch.rectangle(r,y,finish);
      }
    }
    batch.finish(parent,'Staggered, honed limestone courses',stone,keep);
  }

  function boards(parent: THREE.Object3D,rect: Rect,alongX=false,y=.304) {
    const across0=alongX?rect.z0:rect.x0, across1=alongX?rect.z1:rect.x1;
    const start=alongX?rect.x0:rect.z0, end=alongX?rect.x1:rect.z1;
    const batch=new CourseMesh(Math.round(300+start*35+across0*49));
    const border=.125, count=Math.max(1,Math.round((across1-across0-2*border)/.175)), width=(across1-across0-2*border)/count;
    function board(a:number,b:number,u:number,v:number,finish: Finish) {
      batch.rectangle(alongX?{x0:u,x1:v,z0:a,z1:b}:{x0:a,x1:b,z0:u,z1:v},y,finish,alongX);
    }
    for (let i=0;i<count;i++) {
      const a=across0+border+i*width;
      for(let u=start-[0,.38,.73,.16,.59][i%5]*2.72;u<end-.01;u+=2.72)
        board(a,a+width,Math.max(start,u),Math.min(u+2.72,end),'wood');
    }
    for(const a of [across0,across1-border]) for(let u=start;u<end-.01;u+=2.24)
      board(a,a+border,u,Math.min(u+2.24,end),'woodEdge');
    batch.finish(parent,'Matched elm boards with long-grain margins',wood,keep);
  }

  function round(parent: THREE.Object3D,x:number,z:number,outer:number,top:number,inner=0) {
    const batch=new CourseMesh(Math.round(260+x*83+z*17+outer*54));
    const center=.50, start=inner || center;
    const rings=Math.max(1,Math.round((outer-start)/.58));
    const tau=Math.PI*2;
    const at=(r:number,angle:number):Point=>[x+r*Math.cos(angle),z+r*Math.sin(angle)];
    if (!inner) batch.polygon(Array.from({length:32},(_,i)=>at(center-.004,-i*tau/32)),top,'threshold');
    for(let ring=0;ring<rings;ring++) {
      const r0=start+ring*(outer-start)/rings+.004, r1=start+(ring+1)*(outer-start)/rings-.004;
      const count=Math.max(8,Math.round(tau*(r0+r1)/2/1.13)), pitch=tau/count;
      for(let i=0;i<count;i++) {
        const angle=(i+(ring%2)*.47)*pitch, gap=.005/r0;
        const path:Point[]=[];
        for(let j=0;j<=4;j++) path.push(at(r0,angle+gap+(pitch-2*gap)*j/4));
        for(let j=4;j>=0;j--) path.push(at(r1,angle+gap+(pitch-2*gap)*j/4));
        batch.polygon(path,top,ring===rings-1?'border':'field');
      }
    }
    batch.finish(parent,'Radially cut terrace flags',stone,keep);
  }

  return {flags,boards,round,ready,dispose(){released=true;for(const texture of textures)texture.dispose();}};
}
