import type { MeshPhysicalMaterial } from 'three';

/** World metres shared by the basin, lanterns, wading surface and printed plan. */
export const COURTYARD_POOL = { x0: -2.26, x1: 2.26, z0: 1.79, z1: 6.02 } as const;
export const POOL_LAMP = { postX: 2.72, z: 6.03, northZ: 1.80, approachX: 3.45, approachZ: 6.32 } as const;
export const POOL_WATER_Y = .257;
export const POOL_RIPPLE_SPEED = 1.16;
export const POOL_RIPPLE_START = .10;
export const POOL_BED_Y = .16;
export const POOL_COPING_Y = .47;

/** Positive inside the water, zero at the stone lip, negative on the paving. */
function insetFromWaterEdge(x: number, z: number) {
  return Math.min(x - COURTYARD_POOL.x0, COURTYARD_POOL.x1 - x, z - COURTYARD_POOL.z0, COURTYARD_POOL.z1 - z);
}

function easeStep(from: number, to: number, t: number) {
  const u = Math.min(1, Math.max(0, t));
  return from + (to - from) * u * u * (3 - 2 * u);
}

/** The feet step over the dressed cap before settling on the submerged stone floor. */
export function poolFloorAt(x: number, z: number): number | null {
  const inset = insetFromWaterEdge(x, z);
  if (inset <= -.44) return null;
  if (inset < -.17) return easeStep(.30, POOL_COPING_Y, (inset + .44) / .27);
  return easeStep(POOL_COPING_Y, POOL_BED_Y, (inset + .01) / .47);
}

export function poolDepthAt(x: number, z: number, feetY: number) {
  return insetFromWaterEdge(x, z) > 0 ? Math.max(0, POOL_WATER_Y - Math.max(POOL_BED_Y, feetY)) : 0;
}

/** Reflected silhouettes of the three fixed elevations; the ray follows the viewer and the actual wave normal. */
export function setPoolReflections(water:MeshPhysicalMaterial) {
  const capacity = 6, lifetime = 1.85;
  const pulses = new Float32Array(capacity * 4); // World x, world z, age in seconds, strength.
  const contacts = { value: 0 }, time = { value: 0 };
  water.onBeforeCompile=shader=>{
    shader.uniforms.poolTime = time;
    shader.uniforms.poolContactCount = contacts;
    shader.uniforms.poolContacts = { value: pulses };
    // A narrow train of crests travels outwards. Use its analytic slope for both the reflected
    // architecture and the specular highlight, so the disturbance stays attached to the water.
    shader.vertexShader=`
      uniform float poolTime;
      uniform int poolContactCount;
      uniform vec4 poolContacts[${capacity}];
      varying vec3 vPoolPoint;
      varying float vCrest;
      vec3 contactWaves(vec2 point) {
        vec3 wave = vec3(0.);
        for (int i = 0; i < ${capacity}; ++i) {
          if (i >= poolContactCount) break;
          vec4 touch = poolContacts[i];
          vec2 offset = point - touch.xy;
          float r = length(offset);
          float front = ${POOL_RIPPLE_START} + ${POOL_RIPPLE_SPEED} * touch.z;
          float width = .25 + .062 * touch.z;
          float edge = r - front;
          if (abs(edge) > 2.4 * width) continue;
          float gain = smoothstep(0., .075, touch.z) * (1. - smoothstep(.30, ${lifetime}, touch.z));
          float envelope = .029 * touch.w * gain * exp(-edge * edge / (width * width)) / (1. + .36 * front);
          float phase = edge * 22.;
          float height = envelope * cos(phase);
          float slope = -22. * envelope * sin(phase) - 2. * edge * height / (width * width);
          wave += vec3(height, slope * offset / max(.001, r));
        }
        return wave;
      }
    `+shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      vec3 contact = contactWaves((modelMatrix * vec4(position, 1.)).xz);
      float a = dot(position.xz, vec2(6.4, 4.8)) + poolTime * .85;
      float b = position.z * 8.1 - poolTime * .55;
      vec2 slope = vec2(.0288 * cos(a), .0216 * cos(a) - .0162 * sin(b)) + contact.yz;
      objectNormal = normalize(vec3(-slope.x, 1., -slope.y));
      vCrest = contact.x * 36.;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed.y += .0045 * sin(a) + .002 * cos(b) + contact.x;
    `).replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvPoolPoint=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 vPoolPoint;\nvarying float vCrest;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
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
      float litArc = smoothstep(-.18, .28, dot(waterNormal.xz, vec2(-.64,.77)));
      float glint = smoothstep(.04, .67, vCrest) * (.38 + .62 * litArc);
      outgoingLight *= 1. - .20 * smoothstep(.04, .55, -vCrest);
      outgoingLight = mix(outgoingLight, vec3(.63,.77,.70), .38 * glint);
      diffuseColor.a += (1. - diffuseColor.a) * .32 * glint;
      #include <opaque_fragment>
    `);
  };
  return {
    disturb(x: number, z: number, strength: number) {
      if (!Number.isFinite(x + z + strength) || strength <= 0 ||
          x < COURTYARD_POOL.x0 || x > COURTYARD_POOL.x1 || z < COURTYARD_POOL.z0 || z > COURTYARD_POOL.z1) return false;
      if (contacts.value === capacity) {
        pulses.copyWithin(0, 4);
        contacts.value--;
      }
      const slot = contacts.value++ * 4;
      pulses[slot] = x; pulses[slot + 1] = z;
      pulses[slot + 2] = 0; pulses[slot + 3] = Math.min(1, strength);
      return true;
    },
    update(elapsed: number, delta: number, reducedMotion: boolean) {
      time.value = elapsed;
      if (reducedMotion) { contacts.value = 0; return; }
      let expired = 0;
      for (let i = 0; i < contacts.value; i++) {
        const ageIndex = i * 4 + 2;
        pulses[ageIndex] += delta;
        if (pulses[ageIndex] >= lifetime) expired++;
      }
      if (expired) {
        pulses.copyWithin(0, expired * 4, contacts.value * 4);
        contacts.value -= expired;
      }
    },
  };
}
