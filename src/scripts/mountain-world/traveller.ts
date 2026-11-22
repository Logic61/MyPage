import * as THREE from 'three';

export function createTraveller() {
  const root = new THREE.Group(); root.name = 'mountain-visitor';
  const body = new THREE.Group(); root.add(body);
  const cloth = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 1 });
  const cape = new THREE.MeshStandardMaterial({ color: 0x507474, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x313c40, roughness: 0.95 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x704b37, roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9b99b, roughness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x735235, metalness: 0.45, roughness: 0.7 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffdf9c, emissive: 0xffb94b, emissiveIntensity: 1.6, roughness: 0.8 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  const torso = mesh(new THREE.CylinderGeometry(0.18, 0.29, 0.62, 8), cloth, body, 0, 0.78, 0);
  torso.scale.z = 0.8;
  const shoulder = mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.57), cape, body, 0, 1.03, -0.025);
  shoulder.scale.set(1.1, 0.5, 0.9);
  const backCape = mesh(new THREE.CylinderGeometry(0.19, 0.3, 0.55, 8, 1, true, Math.PI * 0.55, Math.PI * 0.9), cape, body, 0, 0.78, -0.06);
  backCape.rotation.y = Math.PI;
  mesh(new THREE.SphereGeometry(0.19, 12, 10), skin, body, 0, 1.22, 0.025);
  const hair = mesh(new THREE.SphereGeometry(0.205, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.57), dark, body, 0, 1.25, 0.005);
  hair.rotation.x = -0.12;
  const hat = mesh(new THREE.ConeGeometry(0.39, 0.18, 12), cloth, body, 0, 1.43, 0);
  hat.rotation.z = 0.06;
  mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.02, 12), leather, body, 0, 1.38, 0);
  for (const x of [-0.065, 0.065]) mesh(new THREE.SphereGeometry(0.014, 6, 4), dark, body, x, 1.24, 0.197);
  const pack = mesh(new THREE.BoxGeometry(0.26, 0.29, 0.14), leather, body, 0, 0.88, -0.24);
  mesh(new THREE.BoxGeometry(0.27, 0.055, 0.16), brass, pack, 0, 0.08, 0);
  const legs = [-1, 1].map(side => {
    const leg = new THREE.Group(); leg.position.set(side * 0.12, 0.48, 0); body.add(leg);
    mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 7), dark, leg, 0, -0.15, 0);
    mesh(new THREE.BoxGeometry(0.145, 0.12, 0.24), dark, leg, 0, -0.36, 0.045);
    return leg;
  });
  const arms = [-1, 1].map(side => {
    const arm = new THREE.Group(); arm.position.set(side * 0.22, 0.98, 0); body.add(arm);
    arm.rotation.z = side * 0.13;
    mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.34, 7), cloth, arm, 0, -0.15, 0);
    mesh(new THREE.SphereGeometry(0.06, 8, 6), skin, arm, 0, -0.34, 0);
    return arm;
  });
  const lantern = new THREE.Group(); lantern.position.set(0, -0.48, 0); arms[1].add(lantern);
  mesh(new THREE.TorusGeometry(0.075, 0.012, 5, 10), brass, lantern, 0, 0.14, 0);
  mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.16, 6), glow, lantern, 0, 0, 0);
  for (const y of [-0.1, 0.1]) mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 6), brass, lantern, 0, y, 0);
  const lamp = new THREE.PointLight(0xffc881, 0.65, 2.4, 2); lamp.position.y = 0.05; lantern.add(lamp);
  let gait = 0;
  function update(time: number, delta: number, speed: number, seated = false) {
    gait += speed * delta * 2.7;
    const moving = Math.min(1, speed / 2);
    body.position.y = seated ? -0.21 : Math.abs(Math.sin(gait)) * 0.035 * moving + Math.sin(time * 1.5) * 0.006;
    legs[0].rotation.x = seated ? -1.25 : Math.sin(gait) * 0.63 * moving;
    legs[1].rotation.x = seated ? -1.25 : -Math.sin(gait) * 0.63 * moving;
    arms[0].rotation.x = seated ? -0.6 : -Math.sin(gait) * 0.38 * moving;
    arms[1].rotation.x = seated ? -0.6 : Math.sin(gait) * 0.2 * moving;
    lantern.rotation.z = Math.sin(gait + 0.8) * 0.1 * moving;
    backCape.rotation.x = Math.sin(gait) * 0.04 * moving;
  }
  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    geometries.forEach(g => g.dispose());
    [cloth, cape, dark, leather, skin, brass, glow].forEach(m => m.dispose());
  }
  return { root, update, dispose };
}
