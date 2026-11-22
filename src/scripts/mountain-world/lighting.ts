import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/** Shared with the offline geometry review; no renderer is needed to create the lights. */
export function createStudyLighting(scene: THREE.Scene, coarse = false) {
  RectAreaLightUniformsLib.init();
  const lights: THREE.Light[] = [];
  const sky = new THREE.HemisphereLight(0xb6cbd0, 0x605747, 0.58);
  scene.add(sky); lights.push(sky);

  const sun = new THREE.DirectionalLight(0xffe4bf, 2.8);
  sun.name = 'Late afternoon through the mountain pines';
  sun.position.set(-11, 17, 12);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 18, bottom: -18, near: 1, far: 65 });
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target); lights.push(sun);

  const doorway = new THREE.RectAreaLight(0xb6d1d8, 2.1, 3.7, 3.1);
  doorway.name = 'Sky bounced through the cave entrance';
  doorway.position.set(0, 2.25, -0.7); doorway.lookAt(0, 1.4, -8);
  scene.add(doorway); lights.push(doorway);

  const deskBounce = new THREE.RectAreaLight(0xffd59f, 3.1, 3.8, 2.0);
  deskBounce.name = 'Warm reflected light above the writing desk';
  deskBounce.position.set(-0.5, 3.7, -6.9); deskBounce.lookAt(0, 0.8, -4.4);
  scene.add(deskBounce); lights.push(deskBounce);

  const shelfBounce = new THREE.RectAreaLight(0xe6d1ac, 1.5, 2.6, 1.4);
  shelfBounce.position.set(-2.0, 2.5, -3.7); shelfBounce.lookAt(-5, 1.4, -6.6);
  scene.add(shelfBounce); lights.push(shelfBounce);

  const sideSky = new THREE.RectAreaLight(0xc5d7d9, 1.7, 2.4, 2.8);
  sideSky.position.set(5.9, 2, -4.5); sideSky.lookAt(0, 1.3, -5.3);
  scene.add(sideSky); lights.push(sideSky);

  return {
    sun,
    dispose() { lights.forEach(light => { light.removeFromParent(); light.dispose(); }); sun.target.removeFromParent(); },
  };
}

/** A small, deterministic HDR sky supplies broad reflections without an external download. */
export function createSkyTexture(): THREE.DataTexture {
  const width = 256, height = 128;
  const data = new Float32Array(width * height * 4);
  const zenith = new THREE.Color(0x91b5c1), horizon = new THREE.Color(0xd3c8ac), ground = new THREE.Color(0x626a62);
  const sunDirection = new THREE.Vector3(-11, 17, 12).normalize();
  const direction = new THREE.Vector3(), color = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const theta = (y + 0.5) / height * Math.PI, phi = (x + 0.5) / width * Math.PI * 2;
    // Inverse of Three's equirectUv: v=0 is the nadir for an unflipped DataTexture.
    direction.set(-Math.sin(theta) * Math.cos(phi), -Math.cos(theta), -Math.sin(theta) * Math.sin(phi));
    if (direction.y > 0) color.copy(horizon).lerp(zenith, Math.pow(direction.y, 0.48));
    else color.copy(horizon).lerp(ground, Math.min(1, -direction.y * 3));
    color.multiplyScalar(direction.y > 0 ? 0.85 : 0.3);
    const glow = Math.pow(Math.max(0, direction.dot(sunDirection)), 180) * 2.4;
    const i = (y * width + x) * 4;
    data[i] = color.r + glow; data[i + 1] = color.g + glow * 0.82; data[i + 2] = color.b + glow * 0.6; data[i + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
