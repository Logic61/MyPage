import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSkyTexture } from './lighting';

export type RenderQuality = 'detail' | 'smooth';

export function createStudyRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, coarse: boolean) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sky = createSkyTexture();
  const environment = pmrem.fromEquirectangular(sky);
  sky.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.42;

  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: coarse ? 0 : Math.min(2, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, target);
  // Size the composer in physical pixels so DPR and viewport changes are atomic.
  composer.setPixelRatio(1);
  const beauty = new RenderPass(scene, camera);
  const ao = new GTAOPass(scene, camera, 512, 512);
  const resizeAO = ao.setSize.bind(ao);
  ao.setSize = (w, h) => resizeAO(Math.max(1, Math.floor(w * 0.65)), Math.max(1, Math.floor(h * 0.65)));
  ao.updateGtaoMaterial({ radius: 0.42, thickness: 0.7, distanceFallOff: 1, samples: 8, screenSpaceRadius: false });
  ao.updatePdMaterial({ lumaPhi: 8, depthPhi: 2, normalPhi: 4, radius: 4, rings: 2, samples: 8 });
  ao.blendIntensity = 0.62;
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.16, 0.38, 1.7);
  const output = new OutputPass();
  composer.addPass(beauty); composer.addPass(ao); composer.addPass(bloom); composer.addPass(output);

  // Mist and lamp glass should never become opaque silhouettes in the normal pass.
  const transparent: THREE.Object3D[] = [];
  scene.traverse(object => {
    if (object instanceof THREE.Sprite) { transparent.push(object); return; }
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => material.transparent && material.opacity < 0.7)) transparent.push(object);
  });
  const renderAO = ao.render.bind(ao);
  ao.render = (r, write, read, delta, mask) => {
    const hidden = transparent.filter(object => object.visible);
    hidden.forEach(object => { object.visible = false; });
    try { renderAO(r, write, read, delta, mask); }
    finally { hidden.forEach(object => { object.visible = true; }); }
  };

  let quality: RenderQuality = coarse ? 'smooth' : 'detail';
  let width = 1, height = 1, dynamicScale = 1;
  let appliedWidth = 0, appliedHeight = 0, appliedRatio = 0;
  let postprocessing = true;

  function resize(w: number, h: number) {
    width = Math.max(1, w); height = Math.max(1, h);
    const cap = quality === 'detail' ? 1.5 : 1.1;
    const pixelBudget = quality === 'detail' ? 2_350_000 : 1_450_000;
    // Keep each drawing-buffer axis at least one pixel without defeating the budget at large viewports.
    const minimumRatio = (1 + Number.EPSILON) / Math.min(width, height);
    const ratio = Math.max(minimumRatio, Math.min(window.devicePixelRatio || 1, cap, Math.sqrt(pixelBudget / (width * height))) * dynamicScale);
    ao.enabled = quality === 'detail';
    bloom.enabled = quality === 'detail';
    if (width === appliedWidth && height === appliedHeight && ratio === appliedRatio) return;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setDrawingBufferSize(width, height, ratio);
    composer.setSize(Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio)));
    appliedWidth = width; appliedHeight = height; appliedRatio = ratio;
  }

  return {
    render(delta: number) {
      if (!postprocessing) { renderer.render(scene, camera); return; }
      try { composer.render(delta); }
      catch (error) {
        // A missing optional framebuffer format must not make the reading paths disappear.
        console.warn('Mountain study post-processing unavailable; using the direct scene.', error);
        postprocessing = false; renderer.setRenderTarget(null); renderer.render(scene, camera);
      }
    },
    resize,
    setQuality(value: RenderQuality) { quality = value; dynamicScale = 1; resize(width, height); },
    easeResolution() {
      if (dynamicScale <= 0.7) return false;
      const previousPixels = composer.renderTarget1.width * composer.renderTarget1.height;
      dynamicScale = Math.max(0.7, dynamicScale - 0.12); resize(width, height);
      return composer.renderTarget1.width * composer.renderTarget1.height < previousPixels;
    },
    dispose() {
      scene.environment = null; environment.dispose();
      beauty.dispose(); ao.dispose(); bloom.dispose(); output.dispose(); composer.dispose();
    },
  };
}
