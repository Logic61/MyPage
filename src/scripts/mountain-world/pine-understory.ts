import * as THREE from 'three';
import { branchGeometry, gridSurface, rockNoise } from './environment-geometry';
import { orchidFans, PlantSurface } from './woodland-foliage';
import { FORECOURT_PLANTER } from './water-court';
import type { SurfaceLibrary } from './materials';

const ivory = new THREE.Color('#faf0cf'), green = new THREE.Color('#a6ac70');
const wine = new THREE.Color('#8e3f34'), honey = new THREE.Color('#e4bc61');
const vector = (x: number, y: number, z: number) => new THREE.Vector3(x,y,z);

/** Five curved tepals surround the forward-folding lip and its two nectar guides. */
function cymbidiumFlower() {
  const flower = new PlantSurface();
  for (const [degrees, length, width, cup] of [
    [2,.083,.014,.023],[121,.082,.012,.018],[-124,.079,.013,.017],
    [59,.057,.021,.038],[-65,.055,.022,.036],
  ]) {
    const angle = degrees * Math.PI / 180, dx = Math.sin(angle), dy = Math.cos(angle);
    flower.patch(8,12,(u,t) => {
      const side = 2*u-1;
      const w = width * (.12+.88*Math.sin(Math.PI*t**1.12)**.70) * (1-.966*t**9);
      const distance = length * t;
      const depth = -.003 + cup * Math.sin(Math.PI*t) - .006*t*t + w*.43*side*side;
      const p = vector(dx*distance+dy*w*side,dy*distance-dx*w*side,depth);
      const color = green.clone().lerp(ivory,.44+.39*t+.08*Math.abs(side));
      if (Math.abs(side)<.30) color.lerp(green,(1-t)*.28);
      return [p,color];
    });
  }
  flower.patch(14,14,(u,t) => {
    const side = u*2-1, w = .005 + .021*t + .010*Math.sin(Math.PI*t);
    const scallop = t**7*(.5+.5*Math.cos(side*4*Math.PI));
    const p = vector(side*w,-.006-.044*t+.018*t*t+.010*t*side*side-.004*scallop,
      .006+.051*t+.010*Math.sin(Math.PI*t)+.008*t*t*(1-side*side));
    const color = honey.clone().lerp(ivory,.58*t+.24*Math.abs(side));
    // Short, paired wine marks widen toward the ruffled margin.
    const fleck = Math.sin(43*t+5*Math.abs(side))*Math.cos(11*side-2.4*t);
    const mark = THREE.MathUtils.smoothstep(fleck,.30,.70) * Math.sin(Math.PI*t)**.52;
    color.lerp(wine, mark * .86);
    return [p,color];
  });
  for (const side of [-1,1]) flower.patch(4,7,(u,t) => {
    const ridge=.0028*Math.sin(Math.PI*u);
    return [vector(side*(.003+.004*t)+(u-.5)*.005,-.003-.017*t+ridge,.012+.029*t), honey];
  });
  flower.patch(12,7,(u,t) => {
    const a=u*Math.PI*2,r=Math.sin(Math.PI*t);
    return [vector(.0068*r*Math.cos(a),.004+.006*r*Math.sin(a),.003+.025*t),
      honey.clone().lerp(ivory,.33+.44*t)];
  });
  return flower.finish();
}

function flowerBud() {
  const bud = new PlantSurface();
  bud.patch(18,10,(u,t) => {
    const a = 2*Math.PI*u, swelling = Math.sin(Math.PI*t)**.73;
    const seam = (.5+.5*Math.cos(a*3-.69*t))**4;
    const r = swelling*(.016-.0032*seam) + .0003;
    const color = green.clone().lerp(ivory,(.10+.58*t)*(1-.69*seam));
    return [vector(r*Math.cos(a)+.010*t*t,.046*t,r*Math.sin(a)+.009*t),color];
  });
  return bud.finish();
}

function groundMoss() {
  return gridSurface(38,9,(u,v)=>{
    const a=2*Math.PI*u,dx=Math.cos(a),dz=Math.sin(a);
    const edge=1+.17*Math.cos(3*a+.52)+.08*Math.sin(5*a)-.08*Math.cos(7*a);
    const x=dx*edge*v,z=dz*edge*v;
    const y=.055*(1-v*v)+.021*rockNoise(x*2,.34,z*1.7)*(1-v)-.012*v**6;
    return vector(x,y,z);
  },false,(_u,v,p)=>new THREE.Color().setScalar(1-THREE.MathUtils.smoothstep(v+.07*rockNoise(p.x*3,0,p.z*2.4),.43,.98)));
}

type GalleryPlanting = {
  ornamentalStone: THREE.BufferGeometry;
  fern: THREE.BufferGeometry;
  foliage: THREE.Material;
};

export function buildPineUnderstory(parent:THREE.Group, library:SurfaceLibrary, geometries:Set<THREE.BufferGeometry>,
  materials:Set<THREE.Material>, gallery:GalleryPlanting, soil:THREE.MeshStandardMaterial) {
  const keep=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
  const own=<T extends THREE.Material>(m:T)=>{materials.add(m);return m;};
  const moss=own(library.material('moss',{worldScale:3.1,roughness:.95,normalScale:.5}));moss.vertexColors=true;
  const duffDetail={value:soil.map}, mossDetail={value:moss.map};
  const blendTurf=moss.onBeforeCompile.bind(moss);
  moss.onBeforeCompile=(shader,renderer)=>{
    blendTurf(shader,renderer);
    shader.uniforms.pineDuff=duffDetail;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform sampler2D pineDuff;')
      .replace('#include <color_fragment>',`
        vec3 bare = texture2D(pineDuff, vSurfaceWorldPosition.xz*vec2(2.,-2.)).rgb;
        float tips = dot(diffuseColor.rgb,vec3(.24,.62,.14));
        float blend = smoothstep(.07,.81,vColor.r+.65*(tips-.16));
        diffuseColor.rgb=mix(bare,diffuseColor.rgb,blend);
      `);
  };
  moss.customProgramCacheKey=()=>'pine-bed-moss-on-duff';
  const limestone=own(library.material('stone',{color:'#f5edde',worldScale:1.63,roughness:.89,normalScale:.72}));
  limestone.vertexColors=true;
  const weatherRock=limestone.onBeforeCompile.bind(limestone);
  limestone.onBeforeCompile=(shader,renderer)=>{
    weatherRock(shader,renderer);
    shader.uniforms.pineMoss=mossDetail;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D pineMoss;')
      .replace('#include <color_fragment>',`
        #include <color_fragment>
        vec3 p=vSurfaceWorldPosition;
        vec3 tuft=texture2D(pineMoss,(p.xz+p.y*vec2(.63,.39))*2.9).rgb;
        float fibre=dot(tuft,vec3(.26,.63,.11));
        float shelter=.22*sin(p.z*13.+p.y*5.3)+.14*cos(p.x*11.-p.y*9.8);
        float growth=clamp(surfaceN.y,0.,1.)*.65+shelter+(.68-p.y)*.45+1.15*(fibre-.14);
        float grain=dot(diffuseColor.rgb,vec3(.25,.62,.13));
        vec3 mineral=(grain*1.12+.019)*vec3(1.035,1.01,.942);
        diffuseColor.rgb=mix(mineral,tuft,smoothstep(.43,.68,growth)*.87);
      `);
  };
  limestone.customProgramCacheKey=()=>'pitted-pine-limestone';
  const assetRoot=(import.meta.env?.BASE_URL ?? '/MyPage/').replace(/\/$/,'');
  const loader=new THREE.TextureLoader(), textures:THREE.Texture[]=[];
  let released=false;
  soil.addEventListener('dispose',()=>{released=true;for(const map of textures) map.dispose();textures.length=0;});
  async function loadFinish(file:string, material:THREE.MeshStandardMaterial, detail:{value:THREE.Texture|null}) {
    try {
      const map=await loader.loadAsync(assetRoot+'/world/'+file);
      if(released) {map.dispose();return;}
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
      textures.push(map);material.map=detail.value=map;
    } catch { /* Generated soil and moss already cover both beds. */ }
  }
  const ready=Promise.all([loadFinish('pine-bed-soil.webp',soil,duffDetail),loadFinish('pine-bed-moss.webp',moss,mossDetail)]);
  const petal=own(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.68}));
  const stem=own(new THREE.MeshStandardMaterial({color:'#7d8455',roughness:.79}));
  const fan=keep(orchidFans()), bloom=keep(cymbidiumFlower()), bud=keep(flowerBud());
  const cushion=keep(groundMoss());
  const scapePoints=[vector(0,-.012,0),vector(.018,.19,0),vector(.054,.40,-.007),vector(.038,.55,-.003),vector(.067,.665,.009)];
  const scape=keep(branchGeometry(scapePoints,.006,.0027,19,7));
  const nodes=[
    [vector(.054,.40,-.007),vector(.085,.425,.013),vector(.099,.458,.044)],
    [vector(.038,.55,-.003),vector(.005,.562,.017),vector(-.026,.575,.035)],
    [vector(.054,.62,.001),vector(.078,.623,.004),vector(.090,.638,.010)],
  ];
  const pedicels=nodes.map(p=>keep(branchGeometry(p,.0038,.002,7,6)));
  function place(holder:THREE.Object3D, g:THREE.BufferGeometry, m:THREE.Material, name:string, x=0, y=0, z=0) {
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;holder.add(mesh);return mesh;
  }
  for(const side of [-1,1]) {
    const west=side<0, bed=new THREE.Group();
    bed.name=west?'West pine garden':'East pine garden';
    const absX=-(FORECOURT_PLANTER.x0+FORECOURT_PLANTER.x1)/2;
    bed.position.set(side*absX,.3375,(FORECOURT_PLANTER.z0+FORECOURT_PLANTER.z1)/2);
    parent.add(bed);

    const rock=new THREE.Group();bed.add(rock);
    rock.position.set(-side*.11,west?.313:.255,west?.59:-.67);
    rock.rotation.set(west?.04:.18,west?-.33:2.78,west?-.08:.45);
    rock.scale.set(west?.93:.84,west?.62:.53,west?.98:.83);
    place(rock,gallery.ornamentalStone,limestone,'Water-worn limestone in the pine bed');
    const drift=west?1:-1;
    for(const [dx,dz,rx,rz,h,angle] of [[-.17,.63,.29,.34,1.4,.31],[.17,.39,.21,.25,.72,.68],
      [-.28,.28,.18,.26,.67,1.3],[-.18,-.70,.23,.30,.78,-.21],[.12,-.30,.14,.17,.48,1.7]]) {
      const pad=place(bed,cushion,moss,'Broken cushion of ground moss',-side*dx,0,drift*dz);
      pad.scale.set(rx,h,rz);pad.rotation.y=angle*side;
    }
    for(const [dx,dz,size,angle] of (west?[[.43,.93,.98,.78],[-.19,-.82,.78,2.65]]
      :[[.42,-.95,.88,2.14],[-.24,.42,.76,-.38]])) {
      const frond=place(bed,gallery.fern,gallery.foliage,'Fern beside the pine roots',-side*dx,-.003,dz);
      frond.scale.setScalar(size);frond.rotation.y=angle;
    }
    const orchid=new THREE.Group();orchid.name='Spring orchid with two fans of leaves';
    orchid.position.set(-side*.32,0,west?-.64:.73);
    orchid.rotation.y=west?.94:-2.08;orchid.scale.setScalar(west?1:.91);bed.add(orchid);
    place(orchid,fan,gallery.foliage,'Folded leaves emerging in two orchid fans');
    place(orchid,scape,stem,'Arching orchid scape');
    for(const [i,p] of nodes.entries()) {
      place(orchid,pedicels[i],stem,'Pedicel joining the scape');
      const open=i===0||(west&&i===1), tip=p[2];
      const head=place(orchid,open?bloom:bud,petal,open?'Open ivory cymbidium':'Unopened cymbidium bud',tip.x,tip.y,tip.z);
      head.rotation.set(open?-.22:-.42,i===0?.30:-.46,i===0?-.16:.14);
    }
    const terminal=scapePoints[scapePoints.length-1];
    const closed=place(orchid,bud,petal,'Terminal orchid bud',terminal.x,terminal.y,terminal.z);
    closed.scale.setScalar(.79);closed.rotation.z=-.25;
  }
  return {stone:limestone,ready};
}
