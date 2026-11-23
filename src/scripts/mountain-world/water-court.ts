import type { MeshPhysicalMaterial } from 'three';

/** World metres, shared by the soil opening, furnishings, navigation obstacles and printed plan. */
export const COURTYARD_POOL = { x0: -2.26, x1: 2.26, z0: 1.79, z1: 6.02 } as const;
export const POOL_LAMP = { postX: 2.72, z: 6.03, northZ: 1.80, approachX: 3.45, approachZ: 6.32 } as const;

/** Reflected silhouettes of the three fixed elevations; the ray follows the viewer and the actual wave normal. */
export function setPoolReflections(water:MeshPhysicalMaterial) {
  water.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPoolPoint;\n'+shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvPoolPoint=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 vPoolPoint;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 waterNormal=inverseTransformDirection(normal,viewMatrix);
      vec3 ray=reflect(normalize(vPoolPoint-cameraPosition),waterNormal);
      vec3 echo=vec3(.35,.45,.46);
      float reach=(-5.8-vPoolPoint.z)/min(ray.z,-.01);
      vec2 wall=vPoolPoint.xy+ray.xy*reach;
      if(ray.z<-.01 && abs(wall.x)<6.35 && wall.y>.90 && wall.y<7.8){
        float column=abs(fract(wall.x/3.12+.5)-.5);
        echo=wall.y>5.4?vec3(.071,.09,.10):mix(vec3(.075,.066,.047),vec3(.38,.27,.18),smoothstep(.04,.08,column));
        if(wall.y>4.5 && wall.y<5.1) echo=vec3(.12,.105,.069);
        if(abs(wall.x)<1.45 && length((wall-vec2(0.,3.14))*vec2(.92,1.))<1.21) echo=vec3(.54,.56,.48);
      }
      if(abs(ray.x)>.01) {
        float t=(sign(ray.x)*3.2-vPoolPoint.x)/ray.x;
        vec2 side=vPoolPoint.zy+ray.zy*t;
        if(t>0. && t<reach && side.x<.6 && side.x>-5.8 && side.y<4.2 && side.y>.30){
          echo=side.y>3.25?vec3(.085,.105,.096):mix(vec3(.105,.079,.047),vec3(.38,.32,.24),smoothstep(.08,.19,abs(fract(side.x/2.3+.5)-.5)));
        }
      }
      float grazing=pow(1.-clamp(dot(normalize(cameraPosition-vPoolPoint),waterNormal),0.,1.),1.7);
      outgoingLight=mix(outgoingLight,echo,.18+.44*grazing);
      #include <opaque_fragment>
    `);
  };
}
