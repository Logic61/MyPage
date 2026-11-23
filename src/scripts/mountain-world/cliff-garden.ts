import * as THREE from 'three';
import { gridSurface, seeded } from './environment-geometry';

/** The inhabited rim stays true to the walking polygon. Fissures deepen below the cap. */
export function cragFace(outline: number[][]) {
  const color = new THREE.Color(), cool = new THREE.Color('#789798'), warm = new THREE.Color('#e6c9a3'), moss = new THREE.Color('#859165');
  return gridSurface(outline.length * 14, 25, (u,v) => {
    const section = (u % 1) * outline.length, index = Math.floor(section), f = section - index;
    const [x0,z0] = outline[index], [x1,z1] = outline[(index+1)%outline.length];
    const x = x0+(x1-x0)*f, z = z0+(z1-z0)*f, depth = 1-v, a = Math.atan2(z,x);
    const split = Math.pow(.5+.5*Math.cos(31*a+.25*Math.sin(3*v+11*a)), 4);
    const shoulder = (1-Math.exp(-depth*19))*(.4+1.4*split);
    const scale = 1 - (shoulder + 1.6*depth + .45*Math.sin(depth*20+6*a)*depth) / Math.hypot(x,z);
    return new THREE.Vector3(x*scale,.28 - 34*depth,z*scale);
  }, true, (_u,v,p) => {
    const mineral = .48+.25*Math.sin(p.x*1.8+p.z*.9+p.y*.09)+.16*Math.sin(p.y*1.3+p.z*.45);
    color.copy(cool).lerp(warm, THREE.MathUtils.clamp(mineral,0,1));
    return color.lerp(moss,THREE.MathUtils.smoothstep(v,.85,1)*(.48+.25*Math.sin(p.x*1.7)));
  });
}

export function cliffGarden() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rng = seeded(91732), leaf = new THREE.Color(), shade = new THREE.Color('#465c46'), light = new THREE.Color('#a7a263');
  function point(x: number,y: number,z: number,brightness: number) {
    positions.push(x,y,z); colors.push(leaf.r*brightness,leaf.g*brightness,leaf.b*brightness);
  }
  // Shallow pockets of sedges soften the exposed granite between the bridge and the two galleries.
  for (const [cx,cz,rx,rz] of [[-3.25,15.6,1.05,.55],[4.4,14.9,.8,.48],[-9.6,11.8,1.1,.41],
      [12.8,8.85,.75,.75],[-14.4,-4.4,.45,1.5],[-2.9,34.6,.67,1.1],[2.7,33.4,.53,.83],[25.4,8.45,1.25,.32]]) {
    for (let i=0;i<45;i++) {
      const a=rng()*Math.PI*2,r=Math.sqrt(rng()),x=cx+Math.cos(a)*rx*r,z=cz+Math.sin(a)*rz*r;
      const hue=rng();
      for (let j=0;j<7;j++) {
        const angle=rng()*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
        const h=.10+rng()*.23,len=.08+rng()*.20,w=.013+rng()*.011;
        const n=positions.length/3; leaf.copy(shade).lerp(light,hue*.72+rng()*.26);
        point(x,.285,z,.67);
        point(x+dx*len*.3-dz*w,.285+h*.72,z+dz*len*.3+dx*w,.92);
        point(x+dx*len*.3+dz*w,.285+h*.68,z+dz*len*.3-dx*w,1.08);
        point(x+dx*len,.285+h,z+dz*len,1.12);
        indices.push(n,n+1,n+2,n+1,n+3,n+2);
      }
    }
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

/** A lip in the rock feeds several transparent filaments. Gravity widens the spray at the foot. */
export function mountainRunoff() {
  const geometry=gridSurface(12,26,(u,v)=>{
    const drop=1-v, spread=(u-.5)*(.68+drop*.45);
    return new THREE.Vector3(-4.4+spread-.37*(1-Math.exp(-drop*11)), .13-drop*17,
      15.73+1.34*(1-Math.exp(-drop*12))+.10*Math.sin(5*u+4*drop));
  });
  const time={value:0};
  const material=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide, uniforms:{time},
    vertexShader:`varying vec2 streamUV;
      void main(){ streamUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform float time; varying vec2 streamUV;
      void main(){
        float u=streamUV.x, v=streamUV.y;
        float strands=.5+.5*sin(u*57.+1.4*sin(v*15.+time*2.)+.8*sin(u*29.-v*8.));
        float streak=.5+.5*sin(v*56.+time*5.3+u*9.);
        float banks=smoothstep(0.,.18,u)*(1.-smoothstep(.76,1.,u));
        float opacity=banks*smoothstep(.02,.32,v)*(.24+.45*strands+.12*streak);
        gl_FragColor=vec4(mix(vec3(.42,.64,.62),vec3(.94,.96,.86),strands*.74+streak*.21),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  return {geometry,material,time};
}
