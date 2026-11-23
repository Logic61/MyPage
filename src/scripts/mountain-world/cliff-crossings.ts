import * as THREE from 'three';
import { architecturalBlock } from './environment-geometry';
import type { SurfaceLibrary } from './materials';
import type { Collider } from './types';

type StonePalette = { stone: THREE.Material; darkStone: THREE.Material; moss: THREE.Material };
type GeometryOwner = <T extends THREE.BufferGeometry>(geometry: T) => T;
type MaterialOwner = <T extends THREE.Material>(material: T) => T;

/** The approach and viewing terrace share dressed limestone, rebated kerbs and bronze fittings. */
export function buildCliffCrossings(
  root: THREE.Group, library: SurfaceLibrary, palette: StonePalette, colliders: Collider[],
  keep: GeometryOwner, own: MaterialOwner,
) {
  const lime = own(library.material('limestone', { color: '#e7e5d7', worldScale: .66, normalScale: .62 }));
  const slate = own(library.material('limestone', { color: '#b9c7be', worldScale: .87, normalScale: .70 }));
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
  for (const [file, channel] of [['court-stone.webp','map'],['flagstone-normal.webp','normalMap']] as const) {
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
  const postCap = keep(new THREE.LatheGeometry([[.115,0],[.135,.035],[.123,.07],[.085,.10],[.104,.145],[.083,.19],[.032,.23],[0,.25]]
    .map(([x,y]) => new THREE.Vector2(x,y)),12));
  const postFillet = keep(new THREE.TorusGeometry(.035,.007,5,16));

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
    // Broken vertical rock ribs meet the worked upper cornice below its pavement.
    for (let i=0;i<14;i++) {
      const a=tau*i/14 + phase, depth=2.1+1.7*(1+Math.sin(i*13+phase));
      const rib=place(root,block,i%4===0?palette.moss:palette.stone,x+(radius-.41)*Math.cos(a),-depth/2-.36,z+(radius-.41)*Math.sin(a),.44,depth,.48);
      rib.rotation.set(.085*Math.sin(a),-a,.08*Math.cos(a));
    }
  }

  function span(x: number, z: number, length: number, width: number, east: boolean, bays: number) {
    const group = new THREE.Group(); group.position.set(x,0,z); group.rotation.y=east?Math.PI/2:0; root.add(group);
    const bay=length/bays, walkingWidth=width-.18, postX=width/2-.11;
    const tileCount=Math.ceil(length/.82), dl=length/tileCount;
    place(group,block,palette.stone,0,-.035,0,width,.42,length);
    for (let i=0;i<tileCount;i++) {
      const zi=-length/2 + dl*(i+.5), cut = (i%2 ? .64 : .36)*walkingWidth;
      ashlar(group,i%7===2?honeyStone:i%4===1?slate:lime,(cut-walkingWidth)/2,.23,zi,cut-.012,.146,dl-.012);
      ashlar(group,i%7===3?honeyStone:i%4===0?slate:lime,cut/2,.23,zi,walkingWidth-cut-.012,.146,dl-.012);
    }
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
      for(let j=0;j<bays;j++) for(const side of [-1,1]) place(group,wedge,lime,side*(depth/2+.022),0,-length/2+(j+.5)*bay);
    }
    const railHeight=east?.82:.97, panelCount=bays*3, spacing=(length-.36)/panelCount;
    for (const side of [-1,1]) {
      const px=side*postX;
      ashlar(group,slate,px,.36,0,.23,.21,length);
      for(let j=0;j<=panelCount;j++) {
        const pz=-length/2+.18+j*spacing;
        ashlar(group,lime,px,.64,pz,.18,railHeight-.28,.18);
        ashlar(group,slate,px,.472,pz,.23,.076,.23);
        ashlar(group,lime,px,.64+(railHeight-.28)/2-.032,pz,.214,.068,.214);
        const carving = place(group,postFillet,slate,px-side*.091,.69,pz,.85,1.5,1);
        carving.rotation.y = Math.PI/2;
        place(group,postCap,lime,px,.64+(railHeight-.28)/2,pz);
        if (j===panelCount) continue;
        const mid=pz+spacing/2;
        ashlar(group,lime,px,railHeight,mid,.14,.10,spacing);
        ashlar(group,slate,px,.53,mid,.103,.11,spacing);
        // Pierced quatrefoil-style baluster, with light passing through its central opening.
        for (const direction of [-1,1]) {
          const strut = place(group,block,lime,px,(railHeight+.53)/2,mid+direction*.17,.092,railHeight-.46,.075);
          strut.rotation.x=direction*.28;
        }
      }
      colliders.push(east ? {x,z:z-px,halfX:length/2-.10,halfZ:.10} : {x:x+px,z,halfX:.10,halfZ:length/2-.10});
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

  // The disc is deliberately perforated: its only central image is the mountain beyond it.
  const altar = new THREE.Group(); altar.position.set(26,0,5); root.add(altar);
  tier(altar,palette.stone,0,0,.366,3.06,.094);
  tier(altar,lime,0,0,.427,2.77,.065);
  tier(altar,lime,0,0,.477,2.43,.056);
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
