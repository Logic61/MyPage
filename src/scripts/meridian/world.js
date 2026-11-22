import * as T from 'three';
import {batch,drawing,group,materials,part,rod,series,TAU} from './workshop.js';
import {buildHall,sconce} from './hall.js';
import {archLine} from './layout.js';
import {buildRefractor,opticPosition,opticDirection} from './instruments.js';
import {furnish} from './archive.js';
import {alpineBackdrop,pineWind} from './atmosphere.js';
import {pixelRatio,renderPreset} from './quality.js';

// A continuous granite shoulder under the terrace anchors the scattered
// ledges. The scenery behind it remains visible between the rail spindles.
function bedrock(root,m){
  const count=72,positions=[],uv=[],indices=[];
  const rings=[[-.69,.97,0],[-2.2,1.02,.08],[-5.5,1.04,.65],[-9.7,1.12,1.04],[-16.5,1.25,1.22],[-31,1.42,1.36],[-58,1.78,1.58]];
  for(let l=0;l<rings.length;l++){
    const [height,spread,spurSpread]=rings[l];
    for(let i=0;i<=count;i++){
      const a=i*TAU/count,c=Math.cos(a),s=Math.sin(a);
      const shoulder=1/Math.pow(Math.pow(Math.abs(c)/6.55,5)+Math.pow(Math.abs(s)/7.12,5),.2);
      // Two continuous spurs descend from the terrace beneath the east
      // and northwest trees. Both widen into the lower cliff.
      const spurs=8.2*Math.max(0,Math.cos(a+.69))**10+11*Math.max(0,Math.cos(a+2.24))**8;
      const stratum=Math.sin(7*a+.31*l)*.21+Math.sin(13*a-.26*l)*.12+Math.sin(3*a+.34)*.27;
      const r=shoulder*spread+stratum*Math.min(l,2.2)+spurs*spurSpread;
      positions.push(c*r,height+Math.min(l,1)*(.46*Math.sin(4*a+.4*l)+.23*Math.cos(9*a)),s*r-.7);
      uv.push(i/count*18,height/3.5+.38*Math.sin(a*3));
      if(i<count&&l<rings.length-1){
        const j=l*(count+1)+i,k=j+count+1;indices.push(j,j+1,k,j+1,k+1,k);
      }
    }
  }
  const shape=new T.BufferGeometry();
  shape.setAttribute('position',new T.Float32BufferAttribute(positions,3));shape.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  shape.setIndex(indices);shape.computeVertexNormals();part(root,shape,m.slab,0,0,0,0x879491);
}

function foreground(root,m,time) {
  const rng=series(261);
  const terrain=group(root);
  bedrock(terrain,m);
  // Ledges are outside the railing and below the walking surface.
  for(let i=0;i<37;i++){
    const a=i*TAU/37, r=8.8+rng()*2.8;
    const g=new T.IcosahedronGeometry(1,1);
    const p=g.attributes.position;
    for(let j=0;j<p.count;j++){
      const x=p.getX(j),y=p.getY(j),z=p.getZ(j);
      const f=.86+.18*Math.sin(8*x+7*z)*Math.cos(y*4);
      p.setXYZ(j,x*f,y*f,z*f);
    }
    g.computeVertexNormals();
    const rock=part(terrain,g,m.slab,Math.cos(a)*r,-5.6-rng()*1.9,Math.sin(a)*r,0x667066);
    rock.scale.set(2+rng()*1.7,3+rng()*2.2,2+rng()*2.7);
    rock.rotation.y=a;
  }
  const spray=drawing(256,192,(c)=>{
    const r=series(952);
    function twig(x,y,dx,dy,size){
      c.lineCap='round';c.strokeStyle='#414333';c.lineWidth=1.7;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+dx,y+dy);c.stroke();
      for(let i=0;i<36;i++){
        const t=i/36,a=x+dx*t,b=y+dy*t;
        for(const side of [-1,1]){
          const n=(.4+r()*.6)*size*(1-t*.65);
          c.strokeStyle=['#435942','#64745a','#52684e','#747e58','#344d3e'][Math.floor(r()*5)];
          c.lineWidth=1+r();c.beginPath();c.moveTo(a,b);c.lineTo(a+side*n+dx*.12,b-n*.72+dy*.13);c.stroke();
        }
      }
    }
    for(let j=0;j<17;j++){
      const t=j/18;
      for(const side of [-1,1])twig(128,178-t*145,side*(1-t*.75)*(67+r()*25),-25-r()*26,15+r()*9);
    }
    twig(128,183,0,-164,24);
  });
  const map=new T.CanvasTexture(spray);map.colorSpace=T.SRGBColorSpace;
  const needles=new T.MeshStandardMaterial({map,alphaTest:.33,side:T.DoubleSide,roughness:1,color:0xb0b6a3});
  pineWind(needles,time);
  terrain.updateWorldMatrix(true,true);
  const down=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  const up=new T.Vector3(0,1,0),normalMatrix=new T.Matrix3();
  function surfaceAt(x,z){
    down.ray.origin.set(x,10,z);
    return down.intersectObjects(terrain.children,false)[0];
  }
  function pine(x,z,size,lean){
    // Bury the whole trunk foot, including its downhill edge. Only the
    // actual cliff and ledge triangles participate in this build-time cast.
    const center=surfaceAt(x,z);if(!center)return;
    let ground=center.point.y;
    for(let i=0;i<8;i++){
      const a=i*TAU/8,r=.23*size;
      const hit=surfaceAt(x+r*Math.cos(a),z+r*Math.sin(a));
      if(!hit)return;
      ground=Math.min(ground,hit.point.y);
    }
    const tree=group(root,x,ground-.16*size,z);tree.scale.setScalar(size);tree.rotation.y=rng()*TAU;
    const trunk=[[0,0,0],[.13,1.8,0],[.04,3.1,.13],[lean,4.2,.12],[lean+.13,5.03,0]];
    for(let j=1;j<trunk.length;j++)rod(tree,m.darkwood,trunk[j-1],trunk[j],.14/(j*.68),.11/j,9);
    // Short root flares follow the slope and disappear into the stone.
    // A few flat pieces of talus break up the transition into the cliff.
    for(let j=0;j<4;j++){
      const a=tree.rotation.y+j*TAU/4+.24*Math.sin(j*2.1),radius=size*(.58+.055*j);
      const kneeX=x+.42*radius*Math.cos(a),kneeZ=z+.42*radius*Math.sin(a);
      const toeX=x+radius*Math.cos(a+.18),toeZ=z+radius*Math.sin(a+.18);
      const knee=surfaceAt(kneeX,kneeZ),toe=surfaceAt(toeX,toeZ);
      if(!knee||!toe)continue;
      const bend=[kneeX,knee.point.y+.055*size,kneeZ];
      rod(root,m.darkwood,[x,center.point.y+.24*size,z],bend,.13*size,.073*size,7);
      rod(root,m.darkwood,bend,[toeX,toe.point.y-.065*size,toeZ],.073*size,.021*size,6);
      const chipX=x+size*(.86+.16*j)*Math.cos(a+.53),chipZ=z+size*(.86+.16*j)*Math.sin(a+.53);
      const groundHit=surfaceAt(chipX,chipZ);if(!groundHit)continue;
      const rock=part(root,new T.DodecahedronGeometry(1),m.slab,chipX,groundHit.point.y-.055*size,chipZ,j%2?0x929287:0x7c8372);
      const normal=groundHit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(groundHit.object.matrixWorld));
      rock.quaternion.setFromUnitVectors(up,normal);rock.rotateY(a);
      rock.scale.set(size*(.33+.06*j),size*(.14+.026*j),size*.38);
    }
    for(let j=0;j<32;j++){
      const t=j/33,a=j*2.4,span=(1-t*.8)*(.94+rng()*.5),h=1.43+t*3.59;
      const bx=lean*t*t, dx=Math.cos(a),dz=Math.sin(a);
      rod(tree,m.darkwood,[bx,h,0],[bx+dx*span,h+.22,dz*span],.037*(1-t*.7),.008,7);
      for(let k=0;k<4;k++){
        const v=.40+k*.18, cluster=part(tree,new T.PlaneGeometry(span*.94,span*.85),needles,bx+dx*span*v,h+.16+k*.075,dz*span*v);
        cluster.rotation.set((rng()-.5)*1.4,a+k*.84,(rng()-.5)*1.4);
      }
    }
  }
  pine(-9.65,-7.1,1.65,.43);pine(10.8,-9.5,1.72,-.35);pine(-10.8,-14.6,1.45,-.25);
}

function contactShadows(scene){
  const stamp=drawing(128,128,(c)=>{
    const g=c.createRadialGradient(64,64,1,64,64,64);
    g.addColorStop(0,'rgba(22,17,10,.65)');g.addColorStop(.38,'rgba(22,17,10,.37)');g.addColorStop(1,'rgba(22,17,10,0)');
    c.fillStyle=g;c.fillRect(0,0,128,128);
  });
  const material=new T.MeshBasicMaterial({map:new T.CanvasTexture(stamp),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  for(const [x,z,w,d,y] of [[1.1,0,2.86,2.56,.018],[-3.68,-.48,2.6,1.43,.019],[4.8,2.6,1.88,3.15,.017],[-5.61,.7,1.6,8.1,.017],...[-6.24,-2.08,2.08,6.24].map(x=>[x,archLine,1.45,1.42,.02])]){
    const shadow=new T.Mesh(new T.PlaneGeometry(w,d),material);
    shadow.rotation.x=-Math.PI/2;shadow.position.set(x,y,z);scene.add(shadow);
  }
}

export async function makeWorld(canvas,base,en,bookTitles=[],initialLevel='medium') {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(63,1,.055,180);
  camera.rotation.order='YXZ';
  const time={value:0},loader=new T.TextureLoader();
  const [{m,sky},ridge,valley,weather]=await Promise.all([
    materials(base,renderer),loader.loadAsync(base+'ridge.webp'),loader.loadAsync(base+'valley-floor.webp'),loader.loadAsync(base+'cloud-field.webp')
  ]);
  const backdrop=alpineBackdrop(ridge,valley,weather,time);
  scene.add(backdrop);
  let detail;
  function loadSummit(){
    if(!detail)detail=new T.TextureLoader().loadAsync(base+'summit.webp').then(texture=>{
      texture.colorSpace=T.SRGBColorSpace;
      backdrop.material.uniforms.summit.value=texture;
      backdrop.material.uniforms.resolved.value=1;
    }).catch(error=>{detail=null;throw error;});
    return detail;
  }
  scene.environment=sky;scene.environmentIntensity=.8;
  scene.add(new T.HemisphereLight(0xdbe8f9,0x93806a,1.13));
  const sun=new T.DirectionalLight(0xffdeb1,2.78);
  sun.position.set(-6.3,7,-12);sun.target.position.set(1,.35,1.6);
  sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:9,bottom:-7,near:.5,far:34});
  sun.shadow.normalBias=.018;sun.shadow.bias=-.0003;scene.add(sun,sun.target);
  const root=new T.Group();
  buildHall(root,m);buildRefractor(root,m);furnish(root,m,en,bookTitles);foreground(root,m,time);
  for(const x of [-2.08,2.08])sconce(root,m,x,1.83,archLine+.36);
  sconce(root,m,-6.05,2.15,3.96,Math.PI/2);
  sconce(root,m,3.57,2.37,5.77,Math.PI);
  function warm(x,y,z,power,reach){
    const light=new T.PointLight(0xffbc76,power,reach,2);light.position.set(x,y,z);scene.add(light);
  }
  warm(-2.08,2.11,-1.97,4.6,5.5);warm(2.08,2.11,-1.97,4.8,5.5);
  warm(4.48,1.49,1.76,16,5.2);warm(-5.59,2.19,3.96,14,6.1);warm(3.57,2.65,5.12,10,5.3);
  scene.add(batch(root));root.clear();contactShadows(scene);
  const rng=series(23),motes=new Float32Array(76*3),seeds=new Float32Array(76);
  for(let i=0;i<seeds.length;i++){
    const arch=(i%3-1)*4.16,depth=rng()*4.5;
    motes[i*3]=arch+(rng()-.5)*2.4+depth*.16;
    motes[i*3+1]=.38+rng()*2.9;motes[i*3+2]=archLine+.16+depth;
    seeds[i]=rng()*TAU;
  }
  const motesGeometry=new T.BufferGeometry();
  motesGeometry.setAttribute('position',new T.BufferAttribute(motes,3));motesGeometry.setAttribute('phase',new T.BufferAttribute(seeds,1));
  const dustMaterial=new T.PointsMaterial({color:0xf6ddad,size:.014,transparent:true,opacity:.43,depthWrite:false});
  dustMaterial.onBeforeCompile=shader=>{
    shader.uniforms.moteTime=time;
    shader.vertexShader='attribute float phase;uniform float moteTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float drift=moteTime*(.17+.05*sin(phase));
      transformed+=vec3(.14*sin(drift+phase),.15*sin(.72*drift+2.7*phase),.08*cos(.87*drift+phase));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`
      #include <alphamap_fragment>
      diffuseColor.a*=1.-smoothstep(.08,.5,length(gl_PointCoord-.5));
    `);
  };
  const dust=new T.Points(motesGeometry,dustMaterial);
  scene.add(dust);
  renderer.shadowMap.needsUpdate=true;
  let width=0,height=0,density=0,preset;
  function resize(lens=false){
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    const ratio=pixelRatio(preset,w,h,window.devicePixelRatio,lens);
    if(w===width&&h===height&&ratio===density)return;
    width=w;height=h;density=ratio;
    renderer.setDrawingBufferSize(w,h,ratio);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  function setQuality(level,lens=false){
    const next=renderPreset(level);
    if(preset!==next){
      preset=next;
      sun.shadow.mapSize.setScalar(next.shadow);
      if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
      renderer.shadowMap.needsUpdate=true;
      motesGeometry.setDrawRange(0,next.particles);
      backdrop.material.uniforms.layeredClouds.value=next.layeredClouds?1:0;
    }
    resize(lens);
  }
  setQuality(initialLevel);
  function render(seconds){
    time.value=seconds;
    renderer.render(scene,camera);
  }
  return {camera,resize,render,loadSummit,setQuality,opticPosition,opticDirection};
}
