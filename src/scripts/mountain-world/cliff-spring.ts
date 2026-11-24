import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gridSurface, seeded } from './environment-geometry';

// Local X follows the southwest rim. The stream flows out across it toward the bridge.
const rim = new THREE.Vector2(4, 2.8).normalize();
const origin = new THREE.Vector3(-4.43, 0, 15.57);
function atBank(across: number, y: number, outward: number) {
  return new THREE.Vector3(origin.x + rim.x * across - rim.y * outward, y,
    origin.z + rim.y * across + rim.x * outward);
}

// Each fraction of the lip releases its own veil. They still share an unbroken surface upstream.
const channels = [
  { from: 0, to: .14, splay: -.19, speed: .74 },
  { from: .14, to: .80, splay: -.055, speed: 1.04 },
  { from: .80, to: 1, splay: .29, speed: .81 },
] as const;
type Channel = typeof channels[number];
const smooth = THREE.MathUtils.smoothstep;

/** Negative travel is the approach to the brink. Positive travel is time in free fall. */
function waterPosition(s: number, travel: number, channel: Channel) {
  const upstream = Math.max(0, -travel), fall = Math.max(0, travel);
  const width = .96 - .62 * upstream + .13 * fall;
  const bend = .71 * upstream * upstream - .12 * fall;
  const lip = .19 + .075 * Math.sin(6.2*s + .4) + .052 * Math.cos(11*s + .8);
  const ripple = .022 * Math.sin(s * 18 + .6*Math.sin(4*travel+s)) + .016 * Math.cos(s*29 - 2.8*travel);
  const split = smooth(fall,.045,.33);
  const centre = (channel.from + channel.to) / 2;
  const narrow = channel === channels[1] ? .14 : .43;
  const across = bend + (s-.5)*width - (s-centre)*width*narrow*split + channel.splay*split*(.62+.42*fall);
  const outward = lip - .69*upstream + fall*(.99 + (channel.speed-.99)*split)
    + .17*(1-Math.exp(-3*fall)) + ripple*(.25+.7*split);
  const y = .326 + .065*upstream - .48*fall - 4.90*fall*fall
    + .008*Math.sin(9*s-2*travel) + .016*(s-.5);
  return atBank(across,y,outward);
}

function joined(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return result;
}

function waterMesh() {
  const flight = 1.82, rillRows = 12, fallRows = 59, rows = rillRows + fallRows;
  const parts = channels.map(channel => {
    const columns = Math.ceil((channel.to-channel.from)*60);
    const geometry = gridSurface(columns,rows,(u,v) => {
      const row = v*rows;
      const t = row <= rillRows ? row/rillRows-1 : (row-rillRows)/fallRows*flight;
      return waterPosition(THREE.MathUtils.lerp(channel.from,channel.to,u),t,channel);
    },true);
    const uv = geometry.getAttribute('uv');
    const local = new Float32Array(uv.count);
    for (let i=0;i<uv.count;i++) {
      const u=uv.getX(i), row=uv.getY(i)*rows;
      local[i]=u;
      uv.setXY(i,THREE.MathUtils.lerp(channel.from,channel.to,u),
        row <= rillRows ? row/rillRows-1 : (row-rillRows)/fallRows*flight);
    }
    geometry.setAttribute('channelU',new THREE.BufferAttribute(local,1));
    return geometry;
  });
  return joined(parts);
}

function springStone() {
  const wet = new THREE.Color('#738284'), dry = new THREE.Color('#c1b997'), lichen = new THREE.Color('#899468');
  const granite = new THREE.Color();
  // The channel bed continues around the rounded brink, where the underside falls away from the water.
  const parts = [gridSurface(30,26,(u,v) => {
    const t = -1.10+v*1.51, s = -.16+1.32*u;
    const p = waterPosition(s,t,channels[1]);
    const undercut = .023 + .32*smooth(t,-.025,.41);
    p.x += rim.y*undercut; p.z -= rim.x*undercut;
    p.y -= .036+.07*smooth(t,-.1,.29) + .009*Math.sin(s*23+v*8);
    return p;
  },true,(u,v) => granite.copy(wet).lerp(dry,.08+.12*Math.sin(u*13+v)**2))];
  // Bedding planes break at different heights on each bank. Raised dry edges catch lichen.
  const stones = [
    [-.78,-.10,.50,.65,.50,.92,.45], [-.58,.17,.398,.36,.32,.59,3.17],
    [.78,.035,.455,.43,.45,.86,2.27], [.88,-.27,.51,.40,.40,.66,4.07],
    [.67,-.42,.56,.37,.27,.26,5.34],
  ];
  const strata = [[0,0],[.48,.004],[.81,.019],[.94,.060],[1,.13],[.96,.25],[.90,.27],[.92,.32],
    [.94,.34],[.90,.58],[.79,.62],[.84,.66],[.68,.91],[.40,1.02],[0,1.06]];
  for (const [x,z,top,rx,rz,height,phase] of stones) {
    parts.push(gridSurface(23,strata.length-1,(u,v) => {
      const a=u*Math.PI*2, [radius,depth]=strata[Math.round(v*(strata.length-1))];
      const edge=1 + .102*Math.sin(3*a+phase) + .065*Math.cos(5*a-phase) + .037*Math.sin(9*a+phase);
      const across = x + rx*edge*radius*Math.cos(a) - .15*depth;
      const normal = z + rz*edge*radius*Math.sin(a) + (across-x)*.15 - (.54+.25*height)*depth;
      const tilt = .075*Math.cos(a+phase)*radius + .033*Math.sin(3*a+phase)*radius;
      return atBank(across,top + tilt - height*depth,normal);
    },false,(u,v,p) => {
      const damp = smooth(Math.abs(x+.11*Math.sin(6*u+phase))-.20*v,.25,.97);
      const color=granite.copy(wet).lerp(dry,.09+.69*damp+.08*Math.sin(u*18+phase));
      const patches=smooth(Math.sin(p.x*6+p.z*.7)*.60+Math.cos(p.z*8+p.y*2)*.40,.14,.76);
      return color.lerp(lichen,patches*(1-smooth(v,.09,.46))*.78);
    }));
  }
  return joined(parts);
}

/** Darken the native cliff itself under the lip, preserving its stone texture and fractures. */
export function stainSpringCliff(material: THREE.MeshStandardMaterial) {
  const baseShader=material.onBeforeCompile, key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    baseShader.call(material,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 fromSpring=vSurfaceWorldPosition.xz-vec2(${origin.x},${origin.z});
      float alongRim=dot(fromSpring,vec2(${rim.x},${rim.y}));
      float acrossRim=dot(fromSpring,vec2(${-rim.y},${rim.x}));
      float cliffY=vSurfaceWorldPosition.y;
      float runoff=0.;
      if(abs(alongRim)<2. && abs(acrossRim)<3.7 && cliffY> -8.5){
        float seam=alongRim+.19*sin(cliffY*1.6+sin(4.*alongRim))+.09*cos(4.7*cliffY+alongRim);
        float wet=1.-smoothstep(.16,.86,abs(seam));
        float rivulet=1.-smoothstep(.025,.18,abs(seam-.70-.10*sin(cliffY*2.3)));
        runoff=max(wet,.74*rivulet)*smoothstep(-8.5,-2.2,cliffY)*(1.-smoothstep(.34,.68,cliffY));
        diffuseColor.rgb*=mix(vec3(1.),vec3(.44,.55,.55),runoff);
      }`).replace('#include <lights_physical_fragment>',`
      roughnessFactor=mix(roughnessFactor,.33,runoff*.82);
      #include <lights_physical_fragment>`);
  };
  material.customProgramCacheKey=()=>key+'-spring-seepage';
}

const waterVertex = /* glsl */ `
  attribute float channelU;
  uniform float time;
  varying vec2 course;
  varying float lane;
  varying vec3 worldPoint;
  varying vec3 surfaceNormal;
  void main(){
    course=uv; lane=channelU;
    vec3 p=position;
    float freeFall=smoothstep(.04,.62,uv.y);
    float wave=sin(16.*uv.y-5.*time+8.*uv.x+.8*sin(14.*uv.x+time*1.4));
    p+=normal*freeFall*(.009+.014*uv.y)*wave;
    float frayed=1.-smoothstep(.02,.36,min(lane,1.-lane));
    p+=vec3(.819,0.,.573)*freeFall*(.010+.054*frayed)*
      (sin(19.*uv.y-9.*time+14.*uv.x)+.43*sin(38.*uv.y-12.*time-10.*uv.x));
    worldPoint=(modelMatrix*vec4(p,1.)).xyz;
    surfaceNormal=mat3(modelMatrix)*normal;
    gl_Position=projectionMatrix*viewMatrix*vec4(worldPoint,1.);
  }`;

const waterFragment = /* glsl */ `
  uniform float time;
  uniform sampler2D aerationMap;
  varying vec2 course;
  varying float lane;
  varying vec3 worldPoint;
  varying vec3 surfaceNormal;
  float hash(vec2 p){
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  void main(){
    float s=course.x, t=course.y, flight=smoothstep(-.05,.38,t);
    // The pattern travels in time-of-flight coordinates, stretching into faster water below.
    float age=t-time;
    float drift=noise(vec2(5.3*s+1.4*t,age*2.6));
    // Two layers of fine air filaments slip past each other. Clearer patches still carry water.
    float stretch=.91+.17*s;
    vec2 trail=vec2(.16+s*.72+.038*(drift-.5), -age*stretch-.19*s);
    float braid=texture2D(aerationMap,trail).r;
    float spindrift=texture2D(aerationMap,vec2(.73-.81*s+.032*drift,-age*.73+.34+.24*s)).r;
    float grain=max(braid,.71*spindrift);
    float folds=noise(vec2(s*8.1+1.8*drift,age*6.2+drift));
    vec3 N=normalize(surfaceNormal+(.38*folds-.19)*vec3(.8,0.,.57)+
      (.27*grain-.065)*vec3(-.57,1.,.8));
    vec3 eye=normalize(cameraPosition-worldPoint);
    float fresnel=.045+.54*pow(1.-abs(dot(N,eye)),3.);
    float highlight=pow(abs(dot(N,normalize(eye+vec3(-.49,.64,.59)))),22.);
    float lip=1.-smoothstep(.0,.25,abs(t));
    float edge=min(s,1.-s);
    float silver=smoothstep(.075,.41,grain);
    float froth=smoothstep(.22,.57,grain + .040*lip);
    float thin=flight*(1.-smoothstep(.07,.21,grain))*smoothstep(.38,.76,folds);
    float split=smoothstep(.03,.31,t);
    float bank=mix(edge,min(lane,1.-lane),split);
    float fringe=(.009+.14*flight)*noise(vec2(s*8.2,age*8.7+1.8*drift));
    float feather=smoothstep(fringe-.009,fringe+max(.021,fwidth(bank)),bank);
    float fade=1.-smoothstep(.95,1.80,t);
    float opacity=(.29+.26*silver+.14*fresnel+.37*froth+.055*lip)*(1.-.43*thin)*feather*fade;
    if(opacity<.012) discard;
    vec3 water=mix(vec3(.18,.28,.26),vec3(.42,.55,.54),.27+.29*folds+.22*flight);
    vec3 color=mix(water,vec3(.73,.83,.83),clamp(fresnel+.68*silver+.15*highlight,0.,1.));
    color=mix(color,vec3(.95,.98,.96),froth);
    gl_FragColor=vec4(color,clamp(opacity,0.,.94));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Small detached beads have world-space sizes and fall faster as they descend. */
function sprayGeometry() {
  const random=seeded(14248), positions:number[]=[], uv:number[]=[], velocities:number[]=[], seeds:number[]=[], faces:number[]=[];
  for (let i=0;i<88;i++) {
    const channel=channels[i%3], s=THREE.MathUtils.lerp(channel.from,channel.to,random());
    const release=.05+random()**1.65*.91, position=waterPosition(s,release,channel);
    const velocity=waterPosition(s,release+.015,channel).sub(position).divideScalar(.015);
    velocity.x+=(random()-.5)*1.34; velocity.z+=(random()-.38)*1.24;
    const duration=.29+random()*.48, phase=random()*duration;
    const radius=.0027+random()**1.8*.0047;
    for (const [u,v] of [[0,0],[1,0],[1,1],[0,1]]) {
      positions.push(...position.toArray()); velocities.push(...velocity.toArray()); uv.push(u,v);
      seeds.push(phase,duration,radius);
    }
    const p=i*4; faces.push(p,p+1,p+2,p,p+2,p+3);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('launch',new THREE.Float32BufferAttribute(velocities,3));
  g.setAttribute('drop',new THREE.Float32BufferAttribute(seeds,3));
  g.setIndex(faces);
  g.boundingSphere=new THREE.Sphere(atBank(0,-7.6,1.55),9.5);
  return g;
}

export function buildCliffSpring(root: THREE.Group, stone: THREE.Material,
  keep: <T extends THREE.BufferGeometry>(g:T)=>T, own: <T extends THREE.Material>(m:T)=>T, aerationMap: THREE.IUniform<THREE.Texture>) {
  const rock=new THREE.Mesh(keep(springStone()),stone);
  rock.name='Wet shelves and hollow at the spring head'; rock.castShadow=rock.receiveShadow=true; root.add(rock);
  const time={value:0};
  const flow=own(new THREE.ShaderMaterial({uniforms:{time,aerationMap},vertexShader:waterVertex,fragmentShader:waterFragment,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true}));
  const spray=own(new THREE.ShaderMaterial({uniforms:{time},transparent:true,depthWrite:false,
    vertexShader: `attribute vec3 launch,drop; uniform float time; varying vec2 disc; varying float opacity;
      void main(){
        float age=mod(time+drop.x,drop.y), life=age/drop.y;
        vec3 p=position+launch*age; p.y-=4.9*age*age;
        disc=2.*uv-1.; opacity=smoothstep(0.,.12,life)*(1.-smoothstep(.58,1.,life));
        vec4 view=modelViewMatrix*vec4(p,1.);
        view.xy+=disc*drop.z*vec2(1.,1.9+min(3.,.22*abs(launch.y-9.8*age)));
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader: `varying vec2 disc; varying float opacity;
      void main(){
        float a=(1.-smoothstep(.23,1.,dot(disc,disc)))*opacity*.49;
        if(a<.025) discard;
        gl_FragColor=vec4(.82,.90,.87,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  const water=new THREE.Mesh(keep(waterMesh()),flow), beads=new THREE.Mesh(keep(sprayGeometry()),spray);
  water.name='Spring rill and divided waterfall'; beads.name='Droplets shed by the waterfall';
  for (const effect of [water,beads]) {
    effect.userData.dynamic=effect.userData.ignoreInteractionRay=effect.userData.ignoreAmbientOcclusion=true;
    root.add(effect);
  }
  return time;
}
