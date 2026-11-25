import * as THREE from 'three';
import { architecturalBlock } from './environment-geometry';
import { stoneBalustrade } from './stone-balustrade';
import { createStoneBeacon } from './court-beacon';
import { EAST_BRIDGE, SUN_DAIS, TEA_PAVILION } from './hall-terrace';
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
  const bronze = own(library.material('limestone', { color: '#80998e', worldScale: 1.7, roughness: .57, metalness: .46, normalScale: .26 }));
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
  const parapet = stoneBalustrade(root,lime,slate,keep,true);

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
    floors.flags(group,{...bed,x0:-edge+margin,x1:edge-margin},east ? .48 : .54,east ? 1.28 : 1.46,[],'field',.308);
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

  const castBeacon = createStoneBeacon(keep);
  function lantern(x:number,z:number,scale=1) {
    const mount = new THREE.Group();mount.position.set(x,.30,z);mount.scale.setScalar(scale);root.add(mount);
    castBeacon(mount,{stone:lime,shadeStone:slate,bronze,gilt,silk:paper});
    colliders.push({x,z,halfX:.32*scale,halfZ:.32*scale});
  }

  function floorRing(parent:THREE.Group,material:THREE.Material,r:number,width:number,y:number) {
    const band = place(parent,keep(new THREE.RingGeometry(r-width/2,r+width/2,96)),material,0,y,0);
    band.rotation.x=-Math.PI/2;
  }

  // Flush stone marquetry. Two contrasting triangles make each point of the compass legible.
  function star(parent:THREE.Group,y:number,radius:number) {
    for(const side of [-1,1]) {
      const vertices:number[]=[];
      for(let i=0;i<8;i++) {
        const a=i*Math.PI/4,length=radius*(i%2?.58:1);
        const inner=a+side*Math.PI/8, mid=.228*radius;
        const tip=[Math.sin(a)*length,y,Math.cos(a)*length], valley=[Math.sin(inner)*mid,y,Math.cos(inner)*mid];
        const points=side>0?[0,y,0,...tip,...valley]:[0,y,0,...valley,...tip];
        vertices.push(...points);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      g.computeVertexNormals();place(parent,keep(g),side>0?slate:honeyStone,0,0,0);
    }
  }
  function cloudInlay(parent:THREE.Group,r:number,y:number) {
    const curve = new THREE.CatmullRomCurve3([
      [-.38,-.04],[-.29,.002],[-.195,.082],[-.118,.115],[-.035,.083],[-.042,.008],[-.103,-.004],
      [-.103,.033],[-.066,.035],
    ].map(([x,z])=>new THREE.Vector3(x,0,z)));
    const scroll=keep(new THREE.TubeGeometry(curve,20,.015,4,false));
    const reflected=keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve.points.map(p=>new THREE.Vector3(-p.x,p.y,p.z))),20,.015,4,false));
    for(let i=0;i<8;i++){
      const a=(i+.5)*tau/8, tile=new THREE.Group();tile.rotation.y=a;
      tile.position.set(r*Math.sin(a),y,r*Math.cos(a));parent.add(tile);
      place(tile,scroll,slate,.033,0,0);place(tile,reflected,slate,-.033,0,0);
    }
  }

  cliff(0,34,4.2,.39);
  cliff(SUN_DAIS.x,SUN_DAIS.z,4.3,1.2);
  span(0,23.875,16.25,3.3,false,2);
  const bridgeHalf = EAST_BRIDGE.width / 2;
  span((EAST_BRIDGE.start + EAST_BRIDGE.end) / 2,EAST_BRIDGE.z,EAST_BRIDGE.end - EAST_BRIDGE.start,EAST_BRIDGE.width,true,1);
  floors.flags(root,{x0:EAST_BRIDGE.landing,x1:EAST_BRIDGE.start,z0:EAST_BRIDGE.z-bridgeHalf,z1:EAST_BRIDGE.z+bridgeHalf},.55,.56,[],'threshold',.307);
  for (const side of [-1,1]) lantern(side*2.2,31.85);
  // Set them along the stone walk before the turning point into the tea house's broad front bay.
  for (const side of [-1,1]) lantern(10.34,EAST_BRIDGE.z+side*(bridgeHalf+.42),.89);
  const roseWindow=new THREE.Group();roseWindow.position.set(0,0,34);root.add(roseWindow);
  floorRing(roseWindow,slate,2.83,.146,.312);
  floorRing(roseWindow,honeyStone,2.43,.087,.313);
  floorRing(roseWindow,slate,2.36,.027,.314);
  star(roseWindow,.314,1.67);cloudInlay(roseWindow,1.90,.316);
  for (const side of [-1,1]) {
    // The gate terminates the bridge and anchors both wings of the welcoming terrace.
    line(side*2.20,13.06,side*6.10,13.06,2,.85);
    line(side*6.10,13.06,side*6.10,11.17,1,.85,true);
    // The pavilion exit stays open in the middle of each gallery edge.
    line(side*7.8,-7.9,side*12.84,-7.9,3,.91);
    const opening = side > 0 ? bridgeHalf+.16 : 1.34;
    line(side*12.84,-7.9,side*12.84,EAST_BRIDGE.z-opening,6,.91,true);
    if (side<0) line(-12.84,EAST_BRIDGE.z+opening,-12.84,8.04,1,.91);
  }
  const teaRim=TEA_PAVILION.apron;
  edge([[12.84,EAST_BRIDGE.z+bridgeHalf+.16],[teaRim.x1-.13,8.03],[teaRim.x1-.13,9.35],
    [teaRim.x1-.13,teaRim.z1-.15],[11.04,teaRim.z1-.15]],.81);
  edge([[-1.80,17.04],[-3.24,16.04],[-4.63,15.09]],.71);
  edge([[1.77,17.22],[3.41,16.87],[4.51,15.43]],.71);
  // Leave the landing's rear steps and the view through the bronze disc open.
  for (const offset of [0,Math.PI]) arc(0,34,3.94,offset-.93,offset+.93,4,.76);
  arc(26,5,4.03,.22*Math.PI,.82*Math.PI,4,.80);
  arc(26,5,4.03,1.18*Math.PI,1.78*Math.PI,4,.80);

  // The disc is deliberately perforated: its only central image is the mountain beyond it.
  const altar = new THREE.Group(); altar.position.set(SUN_DAIS.x,0,SUN_DAIS.z); root.add(altar);
  const courses=SUN_DAIS.steps;
  courses.forEach(({radius,top},i)=>{
    tier(altar,i?lime:palette.stone,0,0,top-.006,radius,i?.075:.10);
    floors.round(altar,0,0,radius-.006,top,courses[i+1]?.radius??0);
  });
  const centreTop=courses[2].top;
  floorRing(altar,slate,.91,.032,centreTop+.009);
  star(altar,centreTop+.010,.69);
  // Each dark ray is clipped to the tread on which it is laid.
  courses.forEach(({radius,top},i)=>{
    const inside=courses[i+1]?.radius??.96;
    const vertices:number[]=[];
    for(let ray=0;ray<12;ray++){
      const a=ray*tau/12;
      const pt=(r:number,d:number)=>[Math.sin(a+d)*r,top+.009,Math.cos(a+d)*r];
      vertices.push(...pt(inside,-.020),...pt(radius-.012,-.020),...pt(radius-.012,.020),
        ...pt(inside,-.020),...pt(radius-.012,.020),...pt(inside,.020));
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.computeVertexNormals();place(altar,keep(g),slate,0,0,0);
  });
  floorRing(altar,slate,3.48,.095,.310);

  const frame=new THREE.Group();frame.position.set(1.31,0,0);frame.rotation.y=-Math.PI/2;altar.add(frame);
  const ringRadius=2.54,centerY=3.03;
  function castBand(profile:number[][],material:THREE.Material) {
    const ring=keep(new THREE.LatheGeometry(profile.map(([r,d])=>new THREE.Vector2(ringRadius+r,d)),112));
    const mesh=place(frame,ring,material,0,centerY,0);mesh.rotation.x=Math.PI/2;
  }
  castBand([[-.154,-.086],[-.170,-.06],[-.170,.06],[-.152,.086],[-.099,.100],[.104,.100],[.153,.082],[.171,.053],[.171,-.053],[.153,-.082],[.105,-.100],[-.099,-.100],[-.154,-.086]].reverse(),bronze);
  for(const radius of [ringRadius-.135,ringRadius+.136]) for(const side of [-1,1]) {
    place(frame,keep(new THREE.TorusGeometry(radius,.021,7,112)),gilt,0,centerY,side*.088);
  }
  const octagon=keep(new THREE.CylinderGeometry(1,1,1,8).rotateX(Math.PI/2));
  const bead=keep(new THREE.SphereGeometry(1,16,10));
  function rosette(x:number,y:number,z:number,size:number,side:number) {
    place(frame,octagon,gilt,x,y,z,size,size,.045);
    place(frame,octagon,bronze,x,y,z+side*.026,size*.85,size*.85,.030);
    for(let j=0;j<8;j++) {
      const a=j*tau/8, petal=place(frame,bead,gilt,x+size*.43*Math.sin(a),y+size*.43*Math.cos(a),z+side*.051,size*.101,size*.218,.023);
      petal.rotation.z=-a;
    }
    place(frame,bead,gilt,x,y,z+side*.071,size*.19,size*.19,.036);
  }
  const solidTab=block;
  for(const angle of [-Math.PI/2,0,Math.PI/2]) for(const side of [-1,1]) {
    const x=ringRadius*Math.sin(angle), y=centerY+ringRadius*Math.cos(angle);
    place(frame,solidTab,gilt,x,y,side*.101,.37,.37,.07).rotation.z=Math.PI/4;
    place(frame,solidTab,bronze,x,y,side*.145,.298,.298,.027).rotation.z=Math.PI/4;
    rosette(x,y,side*.165,.144,side);
  }
  // Solid cloud cheeks receive the sun disc. The two faces carry matching chased scrolls.
  colliders.push({x:SUN_DAIS.x+1.31,z:SUN_DAIS.z,halfX:.13,halfZ:1.04});
  const cheekOutline=[
    [-.71,.03],[-.74,.21],[-.52,.31],[-.68,.50],[-.68,.68],[-.53,.82],[-.34,.83],[-.22,.70],
    [-.01,.68],[.065,.84],[.026,1.00],[-.13,1.09],[-.20,1.23],[-.15,1.41],[.04,1.51],
    [.26,1.49],[.42,1.33],[.43,1.17],[.52,1.08],[.71,1.11],[.82,1.02],[.82,.87],[.70,.74],
    [.53,.72],[.40,.62],[.47,.47],[.68,.41],[.74,.27],[.66,.13],[.48,.09],[.43,.03],
  ];
  const upperScroll = [[-.12,1.21],[-.059,1.34],[.108,1.363],[.254,1.24],[.220,1.05],[.044,.93],[-.044,.77],[-.045,.57],[.100,.46],[.267,.47],[.382,.56]];
  const lowerScroll = [[-.50,.61],[-.435,.674],[-.322,.61],[-.333,.492],[-.421,.413],[-.426,.307],[-.298,.246],[-.074,.319],[.138,.309],[.277,.19]];
  for(const sign of [-1,1]){
    const foot=sign*1.72;
    ashlar(frame,slate,foot,.549,0,1.45,.144,1.10);
    ashlar(frame,lime,foot,.711,0,1.28,.183,.96);
    ashlar(frame,honeyStone,foot,.813,0,1.36,.055,1.02);
    const shape=new THREE.Shape();
    const boundary = new THREE.SplineCurve(cheekOutline.map(([x,y])=>new THREE.Vector2(foot+sign*x,y+.825)));
    boundary.getPoints(76).forEach((p,i)=>i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y));shape.closePath();
    const cheek=keep(new THREE.ExtrudeGeometry(shape,{depth:.39,bevelEnabled:true,bevelSize:.034,bevelThickness:.024,bevelSegments:2,steps:1}));
    place(frame,cheek,bronze,0,0,-.195);
    for(const depth of [-1,1]){
      const rim=new THREE.CatmullRomCurve3(cheekOutline.map(([x,y])=>new THREE.Vector3(foot+sign*x,y+.825,depth*.212)),true);
      place(frame,keep(new THREE.TubeGeometry(rim,74,.022,5,true)),gilt,0,0,0);
      for(const line of [upperScroll,lowerScroll]){
        const curve=new THREE.CatmullRomCurve3(line.map(([x,y])=>new THREE.Vector3(foot+sign*x,.825+y,depth*.229)));
        place(frame,keep(new THREE.TubeGeometry(curve,24,.030,7,false)),gilt,0,0,0);
      }
      rosette(foot,.99,depth*.228,.252,depth);
    }
    colliders.push({x:SUN_DAIS.x+1.31,z:SUN_DAIS.z+foot,halfX:.55,halfZ:.75});
  }
}
