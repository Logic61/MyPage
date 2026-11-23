import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/** Shared with the offline geometry review; no renderer is needed to create the lights. */
export function createStudyLighting(scene: THREE.Scene, coarse = false) {
  RectAreaLightUniformsLib.init();
  const lights: THREE.Light[] = [];
  const sky = new THREE.HemisphereLight(0xe1e7e5, 0xb2a58c, .84);
  scene.add(sky); lights.push(sky);

  const sun = new THREE.DirectionalLight(0xffe9cb, 2.46);
  sun.name = 'Clear morning over the open courtyard';
  sun.position.set(-24, 31, 29);
  sun.target.position.set(3, 0, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -31, right: 31, top: 29, bottom: -29, near: 1, far: 100 });
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target); lights.push(sun);

  const doorway = new THREE.RectAreaLight(0xe4edf0, 1.65, 9.2, 2.4);
  doorway.name = 'Broad courtyard sky over the north study';
  doorway.position.set(0, 3.3, -5.3); doorway.lookAt(0, 1.5, -9.6);
  scene.add(doorway); lights.push(doorway);

  const shelfBounce = new THREE.RectAreaLight(0xf4e8d4, 1.8, 3.8, 2.2);
  shelfBounce.name = 'Open-court sky in the library wing';
  shelfBounce.position.set(-2.95, 2.76, -1.38); shelfBounce.lookAt(-5.55, 1.45, -1.82);
  scene.add(shelfBounce); lights.push(shelfBounce);

  const sideSky = new THREE.RectAreaLight(0xe4edf0, 1.6, 3.8, 2.2);
  sideSky.name = 'Open-court sky in the instrument wing';
  sideSky.position.set(2.95, 2.7, -2.8); sideSky.lookAt(5.9, 1.4, -2.8);
  scene.add(sideSky); lights.push(sideSky);

  // A broad, quiet wash gives the silk painting and its timber rim a readable
  // silhouette. The picture remains a reflective surface, not a glowing portal.
  const paintingWash = new THREE.RectAreaLight(0xfff2d8, 1.7, 3.5, 2.1);
  paintingWash.name = 'Soft reflected light over the circular silk painting';
  paintingWash.position.set(-0.4, 3.45, -7.8); paintingWash.lookAt(-0.5, 2.45, -9.4);
  scene.add(paintingWash); lights.push(paintingWash);

  return {
    sun,
    dispose() { lights.forEach(light => { light.removeFromParent(); light.dispose(); }); sun.target.removeFromParent(); },
  };
}

/** A small, deterministic HDR sky supplies broad reflections without an external download. */
export function createSkyTexture(): THREE.DataTexture {
  const width = 256, height = 128;
  const data = new Float32Array(width * height * 4);
  const zenith = new THREE.Color(0x9ccce8), horizon = new THREE.Color(0xe1ecea), ground = new THREE.Color(0x8e9d88);
  const sunDirection = new THREE.Vector3(-9, 15, 11).normalize();
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
