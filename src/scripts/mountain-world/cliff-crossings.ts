import * as THREE from 'three';
import { architecturalBlock } from './environment-geometry';
import { stoneBalustrade } from './stone-balustrade';
import type { SurfaceLibrary } from './materials';
import type { createFloorFinishes } from './courtyard-paving';
import type { Collider } from './types';

type StonePalette = { stone: THREE.Material; darkStone: THREE.Material };
type GeometryOwner = <T extends THREE.BufferGeometry>(geometry: T) => T;
type MaterialOwner = <T extends THREE.Material>(material: T) => T;

/** The approach and viewing terrace share dressed limestone, rebated kerbs and bronze fittings. */
export function buildCliffCrossings(
  root: THREE.Group, library: SurfaceLibrary, palette: StonePalette, colliders: Collider[],
  keep: GeometryOwner, own: MaterialOwner, floors: ReturnType<typeof createFloorFinishes>,
) {
  const lime = own(library.material('limestone', { color: '#e1e3e2', worldScale: .66, normalScale: .39 }));
  const slate = own(library.material('limestone', { color: '#bcbfc0', worldScale: .87, normalScale: .46 }));
  const honeyStone = own(library.material('limestone', { color: '#d9c8ad', worldScale: .59, normalScale: .53 }));
  const bronze = own(library.material('brass', { color: '#809a89', worldScale: 1.7, roughness: .75, metalness: .42, normalScale: .32 }));
  const gilt = own(library.material('brass', { color: '#e5bb76', worldScale: 1.1, roughness: .57, metalness: .38, normalScale: .21 }));
  const paper = own(library.material('paper', { color: '#f8dda2', worldScale: 2.3 }));
  paper.emissive.set('#d28a34'); paper.emissiveIntensity = .33;
  const stoneFaces = [lime,slate,honeyStone];
  const stoneImages: THREE.Texture[] = [];
  let disposed = false;
  lime.addEventListener('dispose', () => { disposed = true; stoneImages.forEach(texture => texture.dispose()); });
  const assetRoot = (import.meta.env?.BASE_URL || '/').replace(/\/$/,'')+'/world/';
  for (const [file, channel] of [['honed-limestone.webp','map'],['flagstone-normal.webp','normalMap']] as const) {
    void new THREE.TextureLoader().loadAsync(assetRoot+file).then(texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = channel === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
      stoneImages.push(texture);
      for (const material of stoneFaces) { material[channel] = texture; material.needsUpdate = true; }
    }).catch(() => { /* The generated limestone also renders without the scanned maps. */ });
  }
  const block = keep(new THREE.BoxGeometry(1,1,1));
  const disk = keep(new THREE.CylinderGeometry(1,1,1,64));
  const tau = Math.PI * 2;

  function place(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const object = new THREE.Mesh(geo,mat);
    object.position.set(x,y,z); object.scale.set(sx,sy,sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object);
    return object;
  }
  function tier(parent: THREE.Object3D, mat: THREE.Material, x: number, z: number, top: number, radius: number, depth: number) {
    place(parent,disk,mat,x,top-depth/2,z,radius,depth,radius);
  }
  const dressedStones = new Map<string, THREE.BufferGeometry>();
  function ashlar(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) {
    const key = [width,height,depth].map(v=>v.toFixed(4)).join(',');
    let geometry = dressedStones.get(key);
    if (!geometry) { geometry = keep(architecturalBlock(width,height,depth,.014)); dressedStones.set(key,geometry); }
    return place(parent,geometry,mat,x,y,z);
  }
  const parapet = stoneBalustrade(root,lime,slate,keep);

  // Use short solid pieces on a diagonal so the middle of an arc is never an invisible obstacle.
  function edge(points: [number,number][], height: number, omitFirst=false) {
    parapet(points,height,.301,omitFirst);
    for (let i=1; i<points.length; i++) {
      const [x0,z0]=points[i-1], [x1,z1]=points[i], dx=x1-x0, dz=z1-z0;
      const steps=Math.abs(dx)<.001 || Math.abs(dz)<.001 ? 1 : Math.ceil(Math.hypot(dx,dz)/.33);
      for (let k=0;k<steps;k++) {
        const t=(k+.5)/steps;
        colliders.push({x:x0+dx*t,z:z0+dz*t, halfX:Math.abs(dx)/(2*steps)+.118, halfZ:Math.abs(dz)/(2*steps)+.118});
      }
    }
  }

  function line(x0: number,z0: number,x1: number,z1: number,bays: number,height: number,omitFirst=false) {
    edge(Array.from({length:bays+1},(_,i)=>[x0+(x1-x0)*i/bays,z0+(z1-z0)*i/bays]),height,omitFirst);
  }

  function arc(x: number,z: number,r: number,start: number,end: number,bays: number,height: number) {
    edge(Array.from({length:bays+1},(_,i)=>{
      const angle=start+(end-start)*i/bays;
      return [x+Math.cos(angle)*r,z+Math.sin(angle)*r];
    }),height);
  }

  function cliff(x: number, z: number, radius: number, phase: number) {
    const xy: number[] = [], indices: number[] = [];
    const sides = 64;
    const strata = [[0,.99],[-.45,1.01],[-1.2,.99],[-2.4,1.04],[-2.65,.96],[-6.2,.89],[-10.5,.69],[-16,.56],[-26,.41]];
    for (const [j,[y,r]] of strata.entries()) {
      for (let i=0; i<sides; i++) {
        const a = tau*i/sides, relief = .12*Math.sin(9*a+phase) + .055*Math.cos(19*a-phase) + .04*Math.cos(5*a+phase+y*.13);
        const reach = radius * r * (1 + relief*Math.min(1,-y/1.4));
        xy.push(x+Math.cos(a)*reach + .038*y, y + Math.min(.3,-y*.07)*Math.sin(3*a+phase), z+Math.sin(a)*reach);
        if (j) {
          const p=(j-1)*sides+i, q=(j-1)*sides+(i+1)%sides;
          indices.push(p,q,p+sides,q,q+sides,p+sides);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(xy,3)); geo.setIndex(indices);
    const face = keep(geo.toNonIndexed()); geo.dispose(); face.computeVertexNormals();
    place(root,face,palette.darkStone,0,0,0);
    tier(root,palette.stone,x,z,.14,radius,.40);
    tier(root,lime,x,z,.293,radius-.10,.18);
    floors.round(root,x,z,radius-.11,.299, x===0 ? 0 : 3.04);
  }

  function span(x: number, z: number, length: number, width: number, east: boolean, bays: number) {
    const group = new THREE.Group(); group.position.set(x,0,z); group.rotation.y=east?Math.PI/2:0; root.add(group);
    const bay=length/bays, walkingWidth=width-.18, postX=width/2-.11;
    place(group,block,palette.stone,0,-.035,0,width,.42,length);
    const edge=walkingWidth/2, margin=east ? .10 : .17, bed={z0:-length/2,z1:length/2};
    place(group,block,slate,0,.238,0,walkingWidth,.122,length);
    floors.flags(group,{...bed,x0:-edge+margin,x1:edge-margin},east ? .40 : .54,east ? .98 : 1.46,[],'field',.308);
    for(const x0 of [-edge,edge-margin])
      floors.flags(group,{...bed,x0,x1:x0+margin},1.18,margin,[],'border',.308);
    // Build each full-width spandrel around a real elliptical void.
    const rise = east ? 1.74 : 2.15, bottom=-rise-.66, opening=bay*.42;
    const section=new THREE.Shape();
    section.moveTo(-bay/2,-.18); section.lineTo(bay/2,-.18); section.lineTo(bay/2,bottom);
    section.lineTo(opening,bottom);
    section.absellipse(0,bottom,opening,rise,0,Math.PI,false);
    section.lineTo(-bay/2,bottom); section.closePath();
    const depth=width-.25;
    const vault=keep(new THREE.ExtrudeGeometry(section,{depth,steps:1,curveSegments:24,bevelEnabled:false}));
    vault.translate(0,0,-depth/2).rotateY(-Math.PI/2);
    for(let j=0;j<bays;j++) {
      const mid=-length/2+(j+.5)*bay;
      place(group,vault,palette.stone,0,0,mid);
    }
    // The shared springing carries both arches down into the gorge.
    for (let i=1;i<bays;i++) {
      const pz=-length/2+bay*i;
      const pierWidth=bay-2*opening;
      ashlar(group,slate,0,bottom+.095,pz,depth+.22,.30,pierWidth+.40);
      ashlar(group,lime,0,bottom-.11,pz,depth+.34,.11,pierWidth+.49);
      ashlar(group,palette.stone,0,bottom-1.08,pz,depth+.12,1.90,pierWidth+.26);
      ashlar(group,slate,0,bottom-2.08,pz,depth+.29,.17,pierWidth+.41);
      ashlar(group,palette.darkStone,0,bottom-8.15,pz,depth+.34,12.06,pierWidth+.57);
    }
    // Individual voussoirs project from the faces so their radial joints read across the gorge.
    for(let k=0;k<15;k++) {
      const a0=Math.PI*k/15+.006, a1=Math.PI*(k+1)/15-.006;
      const outline=new THREE.Shape();
      outline.moveTo(opening*Math.cos(a0),bottom+rise*Math.sin(a0));
      outline.lineTo(opening*Math.cos(a1),bottom+rise*Math.sin(a1));
      outline.lineTo((opening+.19)*Math.cos(a1),bottom+(rise+.22)*Math.sin(a1));
      outline.lineTo((opening+.19)*Math.cos(a0),bottom+(rise+.22)*Math.sin(a0)); outline.closePath();
      const wedge=keep(new THREE.ExtrudeGeometry(outline,{depth:.07,bevelEnabled:false}));
      wedge.translate(0,0,-.035).rotateY(-Math.PI/2);
      const isKey=k===7, stoneColor=isKey ? honeyStone : k%4===1 ? slate : lime;
      for(let j=0;j<bays;j++) for(const side of [-1,1]) {
        place(group,wedge,stoneColor,side*(depth/2+(isKey?.035:.022)),0,-length/2+(j+.5)*bay,isKey?1.45:1,1,1);
      }
    }
    for (const side of [-1,1]) {
      ashlar(group,slate,side*(depth/2-.04),-.145,0,.28,.17,length-.03);
      ashlar(group,lime,side*(depth/2-.04),-.024,0,.35,.086,length);
      const px=side*postX, half=length/2-.15;
      if (east) line(x-half,z-px,x+half,z-px,5,.79);
      else line(x+px,z-half,x+px,z+half,8,.95);
    }
  }

  const beaconCap = keep(new THREE.LatheGeometry([[.25,0],[.285,.025],[.27,.052],[.367,.072],[.38,.10],[.30,.12],[.21,.17],[.13,.26],[.085,.28],[.062,.34],[0,.345]]
    .map(([x,y])=>new THREE.Vector2(x,y)),8));
  const crown = keep(new THREE.LatheGeometry([[.065,0],[.091,.021],[.083,.047],[.044,.071],[.050,.098],[.072,.13],[.058,.169],[.027,.20],[0,.23]]
    .map(([x,y])=>new THREE.Vector2(x,y)),12));
  const latticeEye = keep(new THREE.TorusGeometry(.092,.011,5,8));
  const fascia = keep(new THREE.TorusGeometry(.347,.012,5,8));
  const finialSeam = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,.275,.085),new THREE.Vector3(0,.19,.184),
    new THREE.Vector3(0,.129,.28),new THREE.Vector3(0,.14,.353),
  ]),10,.012,5,false));
  function lantern(x:number,z:number) {
    ashlar(root,slate,x,.37,z,.56,.16,.56);
    ashlar(root,lime,x,.50,z,.44,.10,.44);
    ashlar(root,honeyStone,x,.565,z,.36,.044,.36);
    ashlar(root,slate,x,.80,z,.25,.44,.25);
    ashlar(root,lime,x,.978,z,.32,.08,.32);
    place(root,block,bronze,x,1.063,z,.48,.102,.48);
    place(root,block,gilt,x,1.041,z,.482,.014,.482);
    place(root,block,paper,x,1.325,z,.327,.43,.327);
    for(const dx of [-.178,.178]) for(const dz of [-.178,.178]) {
      place(root,block,bronze,x+dx,1.325,z+dz,.047,.46,.047);
    }
    for(const h of [1.15,1.49]) place(root,block,bronze,x,h,z,.42,.034,.42);
    for (let i=0; i<4; i++) {
      const face = new THREE.Group(); face.position.set(x,1.325,z); face.rotation.y=i*Math.PI/2; root.add(face);
      place(face,latticeEye,bronze,0,.003,.174);
      for (const sign of [-1,1]) {
        place(face,block,bronze,0,sign*.135,.176,.014,.085,.018);
        place(face,block,bronze,sign*.132,.004,.176,.076,.015,.019);
        place(face,block,gilt,sign*.124,sign*.125,.174,.065,.010,.012);
        place(face,block,gilt,sign*.096,sign*.148,.174,.009,.054,.012);
      }
      // At eye level a raised lozenge and cap bands break up the carved stone pedestal.
      const incised = place(face,latticeEye,honeyStone,0,-.535,.127,.50,.87,.66);
      incised.rotation.z = Math.PI/8;
    }
    place(root,beaconCap,bronze,x,1.53,z);
    const band=place(root,fascia,gilt,x,1.617,z);
    band.rotation.x=Math.PI/2;
    for (let k=0;k<8;k++) place(root,finialSeam,bronze,x,1.53,z).rotation.y=k*Math.PI/4;
    place(root,crown,gilt,x,1.844,z);
    colliders.push({x,z,halfX:.29,halfZ:.29});
  }

  cliff(0,34,4.2,.39);
  cliff(26,5,4.3,1.2);
  span(0,23.875,16.25,3.3,false,2);
  span(18.75,5,10.5,1.9,true,1);
  for (const side of [-1,1]) lantern(side*2.2,31.85);
  for (const side of [-1,1]) {
    // The gate terminates the bridge and anchors both wings of the welcoming terrace.
    line(side*2.20,13.06,side*6.10,13.06,2,.85);
    line(side*6.10,13.06,side*6.10,11.17,1,.85,true);
    // The pavilion exit stays open in the middle of each gallery edge.
    line(side*7.8,-7.9,side*12.84,-7.9,3,.91);
    line(side*12.84,-7.9,side*12.84,3.67,6,.91,true);
    line(side*12.84,6.34,side*12.84,8.04,1,.91);
  }
  edge([[-1.80,17.04],[-3.24,16.04],[-4.63,15.09]],.71);
  edge([[1.77,17.22],[3.41,16.87],[4.51,15.43]],.71);
  // Leave the landing's rear steps and the view through the bronze disc open.
  for (const offset of [0,Math.PI]) arc(0,34,3.94,offset-.93,offset+.93,4,.76);
  arc(26,5,4.03,.22*Math.PI,.82*Math.PI,4,.80);
  arc(26,5,4.03,1.18*Math.PI,1.78*Math.PI,4,.80);

  // The disc is deliberately perforated: its only central image is the mountain beyond it.
  const altar = new THREE.Group(); altar.position.set(26,0,5); root.add(altar);
  tier(altar,palette.stone,0,0,.366,3.06,.094);
  tier(altar,lime,0,0,.427,2.77,.065);
  tier(altar,lime,0,0,.477,2.43,.056);
  floors.round(altar,0,0,3.045,.370,2.75);
  floors.round(altar,0,0,2.755,.431,2.41);
  floors.round(altar,0,0,2.415,.481);
  function rim(parent:THREE.Object3D, material:THREE.Material,r:number,thickness:number,y:number,z:number) {
    return place(parent,keep(new THREE.TorusGeometry(r,thickness,10,96)),material,0,y,z);
  }
  for(const r of [2.10,2.19]) rim(altar,bronze,r,.013,.48,0).rotation.x=Math.PI/2;
  for (let i=0;i<24;i++) {
    const a=i*tau/24, r=2.145;
    const notch=place(altar,block,bronze,r*Math.sin(a),.488,r*Math.cos(a),i%3?.017:.031,.009,i%3?.075:.13);
    notch.rotation.y=a;
  }
  const frame=new THREE.Group(); frame.position.set(1.31,0,0); frame.rotation.y=-.98; altar.add(frame);
  const ringRadius=2.54, centerY=3.03;
  rim(frame,bronze,ringRadius,.153,centerY,0);
  for(const d of [-1,1]) {
    rim(frame,gilt,ringRadius-.081,.039,centerY,d*.123);
    rim(frame,gilt,ringRadius+.077,.039,centerY,d*.123);
  }
  for(const side of [-1,1]) {
    const fx=side*1.62;
    place(frame,block,palette.stone,fx,.55,0,1.15,.24,.92);
    place(frame,block,lime,fx,.72,0,.97,.12,.80);
    place(frame,block,bronze,fx,.84,0,.83,.15,.65);
    const scroll = [[.70,.90],[1.00,1.05],[1.25,1.29],[1.55,1.40],[1.96,1.37],[2.21,1.14],[2.18,.95],[2.02,.94],[2.02,1.04],[2.09,1.07]];
    for(const d of [-1,1]) {
      const points=scroll.map(([x,y])=>new THREE.Vector3(x*side,y,d*.14));
      const sweep = new THREE.CatmullRomCurve3(points);
      place(frame,keep(new THREE.TubeGeometry(sweep,36,.085,8,false)),bronze,0,0,0);
      place(frame,keep(new THREE.TubeGeometry(sweep,36,.02,6,false)),gilt,0,.032,d*.067);
    }
    colliders.push({x:27.31+fx*Math.cos(.98),z:5+fx*Math.sin(.98),halfX:.49,halfZ:.55});
  }
}
