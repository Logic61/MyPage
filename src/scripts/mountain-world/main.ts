import * as THREE from 'three';
import { createEnvironment } from './environment';
import { createFurnishings } from './furnishings';
import { createTraveller } from './traveller';
import { createNavigation, type Point } from './navigation';
import { createWorldUI } from './ui';
import type { Interaction, WorldConfig } from './types';

const root = document.querySelector<HTMLElement>('[data-mountain-world]');
if (root) initializeWorld(root);

function initializeWorld(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('#mountain-canvas');
  const configElement = document.getElementById('mountain-world-config');
  if (!canvas || !configElement) return;
  const config: WorldConfig = JSON.parse(configElement.textContent || '{}');
  const abort = new AbortController();
  const signal = abort.signal;
  let disposeScene = () => {};
  let navigateAction = (_id: string) => {};
  let interactionAction = () => {};
  let resetAction = () => {};
  const ambience = createAmbience();
  const ui = createWorldUI(root, config, {
    onInteract: () => interactionAction(),
    onReset: () => resetAction(),
    onSound: () => ambience.toggle(),
    onNavigate: id => navigateAction(id),
  });

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    ui.setFailed(config.isEn ? 'This browser could not start the 3D view. Your reading paths are still open.' : '这个浏览器暂时无法开启三维画面，你仍可以直接翻阅文章。');
    return;
  }
  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let quality = Math.min(window.devicePixelRatio || 1, coarse ? 1.35 : 1.7);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x718b94);
    scene.fog = new THREE.FogExp2(0x718b94, 0.012);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.15, 220);
    const skyLight = new THREE.HemisphereLight(0xc7dcdb, 0x424744, 1.8); scene.add(skyLight);
    const sunlight = new THREE.DirectionalLight(0xffe2b6, 3.0);
    sunlight.position.set(-10, 22, 8); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    Object.assign(sunlight.shadow.camera, { left: -25, right: 25, top: 24, bottom: -24, near: 1, far: 75 });
    sunlight.shadow.bias = -0.00025; sunlight.shadow.normalBias = 0.035;
    scene.add(sunlight); scene.add(sunlight.target);

    const environment = createEnvironment(scene);
    const furniture = createFurnishings(scene, config.isEn);
    const traveller = createTraveller(); scene.add(traveller.root);
    const navigation = createNavigation(environment.walkAreas, [...environment.colliders, ...furniture.colliders]);
    const spawn = navigation.nearest({ x: 2, z: 10 }, 8) || { x: 0, z: 5 };
    const player = traveller.root;
    player.position.set(spawn.x, 0.3, spawn.z); player.rotation.y = Math.PI;
    const stateKey = `mountain-world-v1:${config.base}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(stateKey) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.z) && navigation.canWalk(saved.x, saved.z)) {
        player.position.set(saved.x, 0.3, saved.z);
        if (Number.isFinite(saved.angle)) player.rotation.y = saved.angle;
      } else if (location.hash === '#study') {
        const entry = navigation.nearest({ x: 0, z: -2.8 }, 4);
        if (entry) player.position.set(entry.x, 0.3, entry.z);
      }
    } catch { /* Storage is optional. */ }

    let route: Point[] = [];
    let pendingInteraction: Interaction | null = null;
    let nearestInteraction: Interaction | null = null;
    let seatedAt: Interaction | null = null;
    let selectedId: string | null = null;
    let running = true, raf = 0, lastSave = 0, lastStats = 0;
    let lastLocation = '', selectedUntil = 0;
    let orbit = 0.48, elevation = 0.77, zoom = 1, frameCount = 0;
    let frameTime = 0, qualitySamples = 0;
    const cameraFocus = new THREE.Vector3(player.position.x * 0.7, 1.2, player.position.z - 4.4);
    const desiredFocus = new THREE.Vector3();
    const keys = new Set<string>();
    const clock = new THREE.Clock();
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
    const intersection = new THREE.Vector3();
    const pickTargets: THREE.Object3D[] = [];
    const environmentOccluders: THREE.Mesh[] = [];
    environment.root.traverse(object => { if (object instanceof THREE.Mesh) environmentOccluders.push(object); });
    const pickMap = new WeakMap<THREE.Object3D, Interaction>();
    for (const item of furniture.interactions) for (const mesh of item.meshes) {
      pickTargets.push(mesh);
      mesh.traverse(object => pickMap.set(object, item));
    }
    const targetMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.23, 0.28, 40),
      new THREE.MeshBasicMaterial({ color: 0xf4d39a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
    );
    targetMarker.rotation.x = -Math.PI / 2; targetMarker.position.y = 0.335; targetMarker.visible = false; scene.add(targetMarker);

    const save = () => {
      const p = seatedAt?.approach || player.position;
      try { sessionStorage.setItem(stateKey, JSON.stringify({ x: p.x, z: p.z, angle: player.rotation.y })); } catch {}
    };
    function standUp() {
      if (!seatedAt) return;
      player.position.set(seatedAt.approach.x, 0.3, seatedAt.approach.z);
      seatedAt = null;
    }
    function walkTo(point: Point, item: Interaction | null = null) {
      standUp();
      route = navigation.findPath(player.position, point);
      pendingInteraction = item;
      if (route.length) {
        const end = route[route.length - 1];
        targetMarker.position.set(end.x, 0.335, end.z); targetMarker.visible = true;
        root.dataset.walking = 'true';
      } else {
        pendingInteraction = null;
        ui.showToast(config.isEn ? 'Choose a place along the stone path.' : '沿着石径，换一个落脚处吧。');
      }
    }
    function activate(item: Interaction) {
      route = []; pendingInteraction = null; targetMarker.visible = false; keys.clear();
      selectedId = item.id; selectedUntil = clock.elapsedTime + 1.3;
      const direction = new THREE.Vector3().subVectors(item.position, player.position);
      if (Math.hypot(direction.x, direction.z) > 0.1) player.rotation.y = Math.atan2(direction.x, direction.z);
      item.activate?.(); save();
      if (item.kind === 'lantern') {
        ui.showToast(config.isEn ? 'A little light in the mountains.' : '山间一盏灯。');
      } else if (item.kind === 'bench') {
        seatedAt = item;
        if (item.sitPosition) player.position.copy(item.sitPosition);
        if (item.sitYaw !== undefined) player.rotation.y = item.sitYaw;
        ui.showToast(config.isEn ? 'Stay a while. Move when you are ready.' : '坐看云起。移动即可起身。');
      } else {
        ui.openContent(item.kind);
      }
    }
    interactionAction = () => {
      if (ui.isOpen()) return;
      if (nearestInteraction) activate(nearestInteraction);
    };
    navigateAction = id => {
      const item = furniture.interactions.find(item => item.id === id || item.kind === id);
      if (item) { walkTo(item.approach); ui.showToast(config.isEn ? `Walking to ${item.labelEn.toLowerCase()}.` : `向${item.label}走去。`); }
    };
    resetAction = () => {
      orbit = 0.48; elevation = 0.77; zoom = 1;
      ui.showToast(config.isEn ? 'The view has settled.' : '镜头已归正。');
    };

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
      renderer.setPixelRatio(quality); renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); resize();
    let press: { id: number; x: number; y: number; lastX: number; lastY: number; moved: boolean } | null = null;
    canvas.tabIndex = 0;
    canvas.addEventListener('pointerdown', event => {
      if (ui.isOpen() || (event.button !== 0 && event.button !== 2)) return;
      canvas.focus({ preventScroll: true });
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: event.button === 2 };
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (!press || press.id !== event.pointerId || ui.isOpen()) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press.moved = true;
      if (press.moved) {
        orbit = THREE.MathUtils.clamp(orbit - (event.clientX - press.lastX) * 0.0055, -0.8, 1.35);
        elevation = THREE.MathUtils.clamp(elevation + (event.clientY - press.lastY) * 0.003, 0.51, 1.02);
        root.dataset.cameraMoved = 'true';
      }
      press.lastX = event.clientX; press.lastY = event.clientY;
    }, { signal });
    canvas.addEventListener('pointerup', event => {
      if (!press || press.id !== event.pointerId) return;
      const click = !press.moved; press = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!click || ui.isOpen()) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickTargets, true);
      const firstHit = hits[0];
      const opaqueMeshes = environmentOccluders.filter(mesh => {
        if (!mesh.visible) return false;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        return materials.some(material => material.visible && (!material.transparent || material.opacity > 0.65));
      });
      const obstruction = firstHit ? raycaster.intersectObjects(opaqueMeshes, false)[0] : undefined;
      const visibleTarget = firstHit && (!obstruction || obstruction.distance >= firstHit.distance - 0.08);
      const item = visibleTarget ? pickMap.get(firstHit.object) : undefined;
      if (item) {
        if (Math.hypot(player.position.x - item.approach.x, player.position.z - item.approach.z) <= item.radius
          && navigation.clearLine(player.position, item.approach)) activate(item);
        else walkTo(item.approach, item);
        return;
      }
      if (raycaster.ray.intersectPlane(ground, intersection)) {
        const target = navigation.nearest(intersection, 1.2);
        if (target) walkTo(target);
      }
    }, { signal });
    canvas.addEventListener('pointercancel', () => { press = null; }, { signal });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    canvas.addEventListener('wheel', event => {
      if (ui.isOpen()) return;
      event.preventDefault(); zoom = THREE.MathUtils.clamp(zoom + event.deltaY * 0.0007, 0.72, 1.3);
    }, { passive: false, signal });
    window.addEventListener('keydown', event => {
      if (ui.isOpen() || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'shift'].includes(key)) {
        event.preventDefault(); keys.add(key); standUp(); route = []; pendingInteraction = null; targetMarker.visible = false;
      } else if (key === 'e' && !event.repeat) { event.preventDefault(); interactionAction(); }
      else if (key === 'r' && !event.repeat) resetAction();
    }, { signal });
    window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()), { signal });
    window.addEventListener('blur', () => { keys.clear(); press = null; save(); }, { signal });
    window.addEventListener('pagehide', save, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); save(); } ambience.setHidden(document.hidden); }, { signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); running = false; cancelAnimationFrame(raf); save();
      ui.setFailed(config.isEn ? 'The 3D view was interrupted. You can continue reading below.' : '三维画面暂时中断，仍可从目录继续阅读。');
    }, { signal });

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const rawDelta = clock.getDelta(), delta = Math.min(rawDelta, 0.04), time = clock.elapsedTime;
      if (document.hidden) return;
      const paused = ui.isOpen();
      let speed = 0;
      if (!paused && !seatedAt) {
        let dx = 0, dz = 0;
        const vertical = +(keys.has('w') || keys.has('arrowup')) - +(keys.has('s') || keys.has('arrowdown'));
        const horizontal = +(keys.has('d') || keys.has('arrowright')) - +(keys.has('a') || keys.has('arrowleft'));
        if (vertical || horizontal) {
          dx = -Math.sin(orbit) * vertical + Math.cos(orbit) * horizontal;
          dz = -Math.cos(orbit) * vertical - Math.sin(orbit) * horizontal;
          const length = Math.hypot(dx, dz), amount = (keys.has('shift') ? 5 : 3.5) * delta;
          dx = dx / length * amount; dz = dz / length * amount;
        } else if (route.length) {
          const goal = route[0], vx = goal.x - player.position.x, vz = goal.z - player.position.z;
          const distance = Math.hypot(vx, vz), amount = Math.min(distance, 3.6 * delta);
          if (distance < 0.06) route.shift();
          else { dx = vx / distance * amount; dz = vz / distance * amount; }
        }
        if (dx || dz) {
          const next = navigation.move(player.position, dx, dz);
          const mx = next.x - player.position.x, mz = next.z - player.position.z;
          speed = Math.hypot(mx, mz) / Math.max(delta, 0.001);
          player.position.set(next.x, 0.3, next.z);
          if (speed > 0.05) {
            const desired = Math.atan2(mx, mz);
            const diff = Math.atan2(Math.sin(desired - player.rotation.y), Math.cos(desired - player.rotation.y));
            player.rotation.y += diff * Math.min(1, delta * 14);
          }
        }
        if (!route.length) {
          targetMarker.visible = false; root.dataset.walking = 'false';
          if (pendingInteraction) { const item = pendingInteraction; pendingInteraction = null; activate(item); }
        }
      } else keys.clear();
      const indoor = player.position.z < -1.25 && player.position.x < 6.1 && player.position.x > -6.1;
      const locationName = indoor ? '书斋' : player.position.x > 7 && player.position.z < 8 ? '临崖小台' : player.position.z > 11.2 ? '山径' : '前庭';
      if (locationName !== lastLocation) {
        lastLocation = locationName;
        ui.setLocation(locationName, ({ '书斋': 'The study', '临崖小台': 'Cloud terrace', '山径': 'Mountain path', '前庭': 'The courtyard' })[locationName]);
        root.dataset.worldLocation = locationName;
      }
      if (!paused) {
        nearestInteraction = null;
        let closest = Infinity;
        for (const item of furniture.interactions) {
          const distance = Math.hypot(item.approach.x - player.position.x, item.approach.z - player.position.z);
          if (distance <= item.radius && distance < closest && navigation.clearLine(player.position, item.approach)) { nearestInteraction = item; closest = distance; }
        }
        if (seatedAt) nearestInteraction = null;
        if (time > selectedUntil) selectedId = nearestInteraction?.id || null;
      }
      environment.update(reducedMotion ? 0 : time, delta, indoor);
      furniture.update(reducedMotion ? 0 : time, delta, selectedId);
      traveller.update(reducedMotion ? 0 : time, delta, speed, !!seatedAt);
      ambience.update(indoor, speed, delta);

      const portrait = camera.aspect < 0.85;
      const distance = (indoor ? 21 : seatedAt ? 31 : 34) * zoom * (portrait ? 1.22 : 1);
      desiredFocus.set(player.position.x * 0.72, indoor ? 1.3 : 0.8, player.position.z - (indoor ? 2 : 4.4));
      desiredFocus.x = THREE.MathUtils.clamp(desiredFocus.x, -5, 9);
      desiredFocus.z = THREE.MathUtils.clamp(desiredFocus.z, -6.5, 4.5);
      if (!paused) cameraFocus.lerp(desiredFocus, reducedMotion ? 1 : 1 - Math.exp(-delta * 3));
      const lift = indoor ? elevation * 0.92 : elevation;
      const cameraDestination = new THREE.Vector3(
        cameraFocus.x + Math.sin(orbit) * Math.cos(lift) * distance,
        cameraFocus.y + Math.sin(lift) * distance,
        cameraFocus.z + Math.cos(orbit) * Math.cos(lift) * distance,
      );
      camera.position.lerp(cameraDestination, frameCount === 0 || reducedMotion ? 1 : 1 - Math.exp(-delta * 5));
      camera.lookAt(cameraFocus);
      if (nearestInteraction && !paused) {
        const projected = nearestInteraction.position.clone().project(camera);
        const rect = canvas!.getBoundingClientRect();
        ui.setInteraction(nearestInteraction, { x: (projected.x * 0.5 + 0.5) * rect.width, y: (-projected.y * 0.5 + 0.5) * rect.height });
      } else ui.setInteraction(null);
      targetMarker.scale.setScalar(1 + Math.sin(time * 4) * 0.1);
      if (!paused || frameCount % 4 === 0) renderer.render(scene, camera);
      frameCount++;
      if (frameCount === 2) { ui.setReady(); root.dataset.renderer = 'webgl'; }
      if (time - lastSave > 2 && !paused) { save(); lastSave = time; }
      if (time - lastStats > 0.5) {
        root.dataset.playerPosition = `${player.position.x.toFixed(2)},${player.position.z.toFixed(2)}`;
        root.dataset.nearby = nearestInteraction?.id || '';
        root.dataset.seated = String(!!seatedAt);
        root.dataset.drawCalls = String(renderer.info.render.calls);
        lastStats = time;
      }
      // Only reduce resolution after a sustained slow sample; never trade away navigation.
      if (!paused && frameCount > 100 && rawDelta < 0.3) {
        frameTime += rawDelta; qualitySamples++;
        if (qualitySamples === 120) {
          if (frameTime / qualitySamples > 0.034 && quality > 0.85) { quality = Math.max(0.85, quality * 0.8); resize(); }
          qualitySamples = 0; frameTime = 0;
        }
      }
    }
    disposeScene = () => {
      running = false; cancelAnimationFrame(raf); save(); resizeObserver.disconnect();
      environment.dispose(); furniture.dispose(); traveller.dispose();
      targetMarker.geometry.dispose(); targetMarker.material.dispose(); renderer.dispose();
      ambience.dispose(); ui.dispose(); abort.abort();
    };
    document.addEventListener('astro:before-swap', disposeScene, { once: true, signal });
    frame();
  } catch (error) {
    console.error('Mountain scene could not start:', error);
    renderer.dispose();
    ui.setFailed(config.isEn ? 'The mountain view could not start. The reading room is still available.' : '山中景色暂时未能展开，你仍可以直接进入阅读。');
  }
  if (import.meta.hot) import.meta.hot.dispose(() => disposeScene());
}

function createAmbience() {
  let context: AudioContext | null = null, master: GainNode | null = null, windGain: GainNode | null = null;
  let enabled = false, hidden = false, footClock = 0;
  const sources: AudioScheduledSourceNode[] = [];
  function ensure() {
    if (context) return;
    context = new AudioContext();
    master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    const noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02; samples[i] = previous * 3; }
    const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
    const low = context.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 750;
    windGain = context.createGain(); windGain.gain.value = 0.18;
    source.connect(low).connect(windGain).connect(master); source.start(); sources.push(source);
  }
  return {
    toggle() {
      try { ensure(); enabled = !enabled; void context?.resume(); master?.gain.setTargetAtTime(enabled ? 0.6 : 0, context!.currentTime, 0.4); }
      catch { enabled = false; }
      return enabled;
    },
    setHidden(value: boolean) { hidden = value; if (master && context) master.gain.setTargetAtTime(enabled && !hidden ? 0.6 : 0, context.currentTime, 0.2); },
    update(indoor: boolean, speed: number, delta: number) {
      if (!context || !enabled || hidden) return;
      windGain?.gain.setTargetAtTime(indoor ? 0.07 : 0.18, context.currentTime, 1.2);
      footClock += speed * delta;
      if (speed > 0.5 && footClock > 1.1) {
        footClock = 0;
        const tone = context.createOscillator(), gain = context.createGain();
        tone.type = 'sine'; tone.frequency.setValueAtTime(indoor ? 130 : 95, context.currentTime);
        tone.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.07);
        gain.gain.setValueAtTime(0.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
        tone.connect(gain).connect(master!); tone.start(); tone.stop(context.currentTime + 0.1);
        tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      }
    },
    dispose() { sources.forEach(source => source.stop()); void context?.close(); },
  };
}
