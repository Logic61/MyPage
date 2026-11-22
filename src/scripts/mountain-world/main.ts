import * as THREE from 'three';
import { createEnvironment } from './environment';
import { createFurnishings } from './furnishings';
import { createSurfaceLibrary } from './materials';
import { createNavigation, type Point } from './navigation';
import { createWorldUI } from './ui';
import { createStudyLighting } from './lighting';
import { createStudyRenderer, type RenderQuality } from './rendering';
import { createInteractionPicker, movementDirection, FLOOR_HEIGHT, EYE_HEIGHT, SEATED_EYE_HEIGHT } from './first-person';
import type { Interaction, WorldConfig } from './types';

type Mode = 'welcome' | 'exploring' | 'paused' | 'reading' | 'transition';
const root = document.querySelector<HTMLElement>('[data-mountain-world]');
if (root) void initializeWorld(root);

async function initializeWorld(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('#mountain-canvas');
  const configElement = document.getElementById('mountain-world-config');
  if (!canvas || !configElement) return;
  const config: WorldConfig = JSON.parse(configElement.textContent || '{}');
  const en = config.isEn;
  const abort = new AbortController(), { signal } = abort;
  const ambience = createAmbience();
  let alive = true, teardown = () => {};
  let suspendAction = () => {}, resumeAction = () => {};
  let interactionAction = () => {}, resetAction = () => {};
  let navigateAction = (_id: string) => {}, readingAction = (_open: boolean) => {};
  const ui = createWorldUI(root, config, {
    onInteract: () => interactionAction(), onReset: () => resetAction(),
    onSound: () => ambience.toggle(), onNavigate: id => navigateAction(id),
    onReadingChange: open => readingAction(open),
  });
  window.addEventListener('pagehide', event => {
    // BFCache restores this same document and its listeners, so retain its resources.
    if (event.persisted) { suspendAction(); return; }
    alive = false; teardown(); abort.abort(); ui.dispose(); ambience.dispose();
  }, { signal });
  window.addEventListener('pageshow', event => { if (event.persisted) resumeAction(); }, { signal });

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    ui.setFailed('WebGL2 could not be initialized.');
    return;
  }
  const resources: (() => void)[] = [() => renderer.dispose()];
  try {
    // Wait for the subset used by the canvas book labels, with a bounded fallback.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (document.fonts) await Promise.race([
      document.fonts.load('500 48px "Noto Serif SC"', '藏书山中手记读诗小记数学随笔桃源读书札记自由的代价初中生活残灵光明算法导论计算机系统离散数学编译原理机器学习新年格物札记夜光何德死则又育坐听松风归观物求知致来访者羽').catch(() => []),
      new Promise(resolve => window.setTimeout(resolve, 2200)),
    ]);
    if (!alive) { renderer.dispose(); return; }
    const coarse = matchMedia('(pointer: coarse)').matches;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.dataset.touch = String(coarse);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x91a5a6);
    scene.fog = new THREE.FogExp2(0x91a5a6, 0.0095);
    const camera = new THREE.PerspectiveCamera(coarse ? 72 : 67, 1, 0.055, 230);
    camera.rotation.order = 'YXZ';
    const surfaces = createSurfaceLibrary(); resources.unshift(() => surfaces.dispose());
    const environment = createEnvironment(scene, surfaces); resources.unshift(() => environment.dispose());
    const furniture = createFurnishings(scene, en, surfaces); resources.unshift(() => furniture.dispose());
    const lighting = createStudyLighting(scene, coarse); resources.unshift(() => lighting.dispose());
    lighting.sun.shadow.autoUpdate = false; lighting.sun.shadow.needsUpdate = true;
    const pipeline = createStudyRenderer(renderer, scene, camera, coarse); resources.unshift(() => pipeline.dispose());
    const navigation = createNavigation(environment.walkAreas, [...environment.colliders, ...furniture.colliders]);
    const picker = createInteractionPicker([environment.root, furniture.root], furniture.interactions);
    const spawn = navigation.nearest({ x: 0, z: 4.8 }, 5) || { x: 0, z: 3 };
    const position = new THREE.Vector3(spawn.x, FLOOR_HEIGHT, spawn.z);
    const velocity = new THREE.Vector2();
    const keys = new Set<string>();
    const joystick = new THREE.Vector2();
    const stateKey = `mountain-first-person-v2:${config.base}`;
    let yaw = 0, pitch = -0.035, sensitivity = 1, headBob = false;
    let mode: Mode = 'welcome';
    let route: Point[] = [], destination: Interaction | null = null;
    let aimed: Interaction | null = null, seatedAt: Interaction | null = null;
    let selectedId: string | null = null, selectedUntil = 0;
    let elapsed = 0, walked = 0, interactionTimer = 0;
    let frame = 0, previousFrame = performance.now(), lastRender = 0, lastPick = -1, lastSave = 0;
    let frameSum = 0, frameSamples = 0, qualityAdjustments = 0;
    let hadPointerLock = false, dragLook = false;
    let press: { id: number; x: number; y: number; moved: boolean } | null = null;
    let stickPointer: number | null = null;
    let eyeY = FLOOR_HEIGHT + EYE_HEIGHT;
    const entry = root.querySelector<HTMLElement>('[data-world-entry]')!;
    const enterButton = root.querySelector<HTMLButtonElement>('[data-world-enter]')!;
    const entryTitle = root.querySelector<HTMLElement>('[data-world-entry-title]')!;
    const entryCopy = root.querySelector<HTMLElement>('[data-world-entry-copy]')!;
    const pauseButton = root.querySelector<HTMLButtonElement>('[data-world-pause]')!;
    const stick = root.querySelector<HTMLElement>('[data-world-stick]')!;
    const stickThumb = root.querySelector<HTMLElement>('[data-world-stick-thumb]')!;
    const qualitySelect = root.querySelector<HTMLSelectElement>('[data-world-quality]')!;
    const sensitivityInput = root.querySelector<HTMLInputElement>('[data-world-sensitivity]')!;
    const bobInput = root.querySelector<HTMLInputElement>('[data-world-bob]')!;
    qualitySelect.value = coarse ? 'smooth' : 'detail';
    try {
      const saved = JSON.parse(sessionStorage.getItem(stateKey) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.z) && navigation.canWalk(saved.x, saved.z)) {
        position.set(saved.x, FLOOR_HEIGHT, saved.z);
        if (Number.isFinite(saved.yaw)) yaw = saved.yaw;
        if (Number.isFinite(saved.pitch)) pitch = THREE.MathUtils.clamp(saved.pitch, -1.4, 1.4);
      } else if (location.hash === '#study') {
        const inside = navigation.nearest({ x: 0, z: -2.8 }, 4);
        if (inside) position.set(inside.x, FLOOR_HEIGHT, inside.z);
      }
      const preferences = JSON.parse(localStorage.getItem('mountain-first-person:preferences') || 'null');
      if (preferences) {
        if (preferences.quality === 'detail' || preferences.quality === 'smooth') qualitySelect.value = preferences.quality;
        if (Number.isFinite(preferences.sensitivity)) sensitivity = THREE.MathUtils.clamp(preferences.sensitivity, 0.4, 1.8);
        headBob = !reducedMotion && preferences.headBob === true;
      }
    } catch { /* Storage is optional. */ }
    sensitivityInput.value = String(sensitivity); bobInput.checked = headBob;
    pipeline.setQuality(qualitySelect.value as RenderQuality);

    function clearMovement() {
      keys.clear(); joystick.set(0, 0); velocity.set(0, 0);
      const pointerId = press?.id; press = null;
      if (pointerId !== undefined && canvas!.hasPointerCapture(pointerId)) canvas!.releasePointerCapture(pointerId);
      const thumbId = stickPointer; stickPointer = null;
      if (thumbId !== null && stick.hasPointerCapture(thumbId)) stick.releasePointerCapture(thumbId);
      stickThumb.style.transform = 'translate(-50%, -50%)';
    }
    function cancelRoute() { route = []; destination = null; delete root.dataset.guided; }
    function save() {
      const p = seatedAt?.approach || position;
      try { sessionStorage.setItem(stateKey, JSON.stringify({ x: p.x, z: p.z, yaw, pitch })); } catch {}
    }
    function setMode(value: Mode) {
      mode = value; root.dataset.mode = value;
      const visible = value === 'welcome' || value === 'paused';
      entry.hidden = !visible;
      if (visible) {
        entryTitle.textContent = value === 'welcome' ? (en ? 'A quiet place, among the mountains.' : '山中有灯，且坐片刻。') : (en ? 'Stay a little longer.' : '稍作停留。');
        entryCopy.textContent = value === 'welcome'
          ? (en ? 'Step inside, find a book, and let the world slow down.' : '走入石窟，取一卷书，让山间的时光慢下来。')
          : (en ? 'The study is waiting, just where you left it.' : '书斋仍在，回到刚才驻足的地方。');
        enterButton.querySelector('[data-world-enter-label]')!.textContent = value === 'welcome' ? (en ? 'Enter the study' : '走进书斋') : (en ? 'Continue exploring' : '继续探索');
      }
      pauseButton.hidden = value !== 'exploring';
      if (value !== 'exploring') {
        clearMovement(); aimed = null; ui.setInteraction(null); root.dataset.aimed = 'false';
      }
    }
    function unlock() { if (document.pointerLockElement === canvas) document.exitPointerLock(); }
    function pause() {
      if (mode === 'reading' || mode === 'welcome') return;
      window.clearTimeout(interactionTimer); cancelRoute(); setMode('paused'); unlock(); save();
      enterButton.focus({ preventScroll: true });
    }
    function enter() {
      if (ui.isOpen()) return;
      setMode('exploring'); canvas!.focus({ preventScroll: true });
      if (coarse || !canvas!.requestPointerLock) { dragLook = true; return; }
      try {
        const request = canvas!.requestPointerLock();
        request?.catch(() => {
          if (mode !== 'exploring') return;
          dragLook = true;
          ui.showToast(en ? 'Drag to look around. WASD still moves you.' : '可按住画面拖动视角，WASD 仍可行走。');
        });
      } catch { dragLook = true; }
    }
    function standUp() {
      if (!seatedAt) return;
      position.copy(seatedAt.approach); position.y = FLOOR_HEIGHT;
      seatedAt = null;
    }
    function face(item: Interaction) {
      const direction = new THREE.Vector3().subVectors(item.position, camera.position);
      yaw = Math.atan2(-direction.x, -direction.z);
      pitch = THREE.MathUtils.clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), -1.4, 1.4);
    }
    function updateCamera(delta: number, speed = 0) {
      const targetEye = seatedAt ? position.y + SEATED_EYE_HEIGHT : FLOOR_HEIGHT + EYE_HEIGHT;
      eyeY = THREE.MathUtils.lerp(eyeY, targetEye, reducedMotion ? 1 : 1 - Math.exp(-delta * 10));
      const bob = headBob && !seatedAt && speed > 0.3 ? Math.sin(walked * 8) * 0.014 * Math.min(1, speed / 2.2) : 0;
      camera.position.set(position.x, eyeY + bob, position.z);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      camera.updateMatrixWorld();
    }
    function findAimed() {
      if (mode !== 'exploring' || ui.isOpen()) return null;
      scene.updateMatrixWorld();
      return picker.pick(camera);
    }
    function activate(item: Interaction) {
      cancelRoute(); clearMovement(); selectedId = item.id; selectedUntil = elapsed + 1.35;
      item.activate?.(); lighting.sun.shadow.needsUpdate = true;
      if (item.kind === 'lantern') {
        ui.showToast(en ? 'A little light in the mountains.' : '山间一盏灯。');
      } else if (item.kind === 'bench') {
        seatedAt = item;
        if (item.sitPosition) position.copy(item.sitPosition);
        if (item.sitYaw !== undefined) yaw = item.sitYaw;
        pitch = -0.045;
        ui.showToast(en ? 'Watch the clouds. Move or press E to stand.' : '坐看云起。移动或按 E 即可起身。');
      } else {
        setMode('transition'); unlock();
        interactionTimer = window.setTimeout(() => {
          if (alive && mode === 'transition') ui.openContent(item.kind);
        }, reducedMotion ? 0 : 620);
      }
      save();
    }
    interactionAction = () => {
      if (mode !== 'exploring' || ui.isOpen()) return;
      if (seatedAt) { standUp(); ui.showToast(en ? 'Back on the stone path.' : '起身，再走走。'); return; }
      const item = findAimed();
      if (item) activate(item);
    };
    readingAction = open => {
      if (open) {
        window.clearTimeout(interactionTimer); cancelRoute(); setMode('reading'); unlock(); save();
      } else if (mode === 'reading') {
        setMode('paused'); enterButton.focus({ preventScroll: true });
      }
    };
    navigateAction = id => {
      const item = furniture.interactions.find(item => item.id === id || item.kind === id);
      if (!item) return;
      standUp(); cancelRoute();
      const path = navigation.findPath(position, item.approach);
      if (!path.length) {
        setMode('paused'); ui.showToast(en ? 'There is no clear path from here. Return to the entrance and try again.' : '这里暂时没有通路，可以先回到洞口。'); return;
      }
      route = path; destination = item; root.dataset.guided = 'true';
      enter(); ui.showToast(en ? `Walking to ${item.labelEn.toLowerCase()}. WASD stops the guide.` : `向${item.label}走去。按 W A S D 可随时自行行走。`);
    };
    resetAction = () => {
      window.clearTimeout(interactionTimer);
      if (mode === 'transition') setMode('paused');
      standUp(); cancelRoute(); clearMovement();
      position.set(spawn.x, FLOOR_HEIGHT, spawn.z); yaw = 0; pitch = -0.035; eyeY = FLOOR_HEIGHT + EYE_HEIGHT;
      updateCamera(1); save(); ui.showToast(en ? 'Back at the cave entrance.' : '回到洞口，书斋就在眼前。');
    };
    function savePreferences() {
      try { localStorage.setItem('mountain-first-person:preferences', JSON.stringify({ quality: qualitySelect.value, sensitivity, headBob })); } catch {}
    }
    qualitySelect.addEventListener('change', () => {
      pipeline.setQuality(qualitySelect.value as RenderQuality); qualityAdjustments = 0; savePreferences();
    }, { signal });
    sensitivityInput.addEventListener('input', () => { sensitivity = Number(sensitivityInput.value); savePreferences(); }, { signal });
    bobInput.addEventListener('change', () => { headBob = bobInput.checked && !reducedMotion; savePreferences(); }, { signal });
    enterButton.addEventListener('click', enter, { signal });
    pauseButton.addEventListener('click', pause, { signal });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) {
        if (ui.isOpen() || mode !== 'exploring') { document.exitPointerLock(); return; }
        dragLook = false;
      } else if (hadPointerLock && mode === 'exploring') pause();
      hadPointerLock = locked; root.dataset.pointerLocked = String(locked);
    }, { signal });
    document.addEventListener('pointerlockerror', () => { if (mode === 'exploring') dragLook = true; }, { signal });
    document.addEventListener('mousemove', event => {
      if (mode !== 'exploring' || document.pointerLockElement !== canvas || ui.isOpen()) return;
      if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) cancelRoute();
      yaw -= event.movementX * 0.0021 * sensitivity;
      pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0021 * sensitivity, -1.4, 1.4);
    }, { signal });
    canvas.addEventListener('pointerdown', event => {
      if (mode !== 'exploring' || ui.isOpen() || (event.button !== 0 && event.button !== 2)) return;
      canvas.focus({ preventScroll: true });
      if (document.pointerLockElement === canvas) { if (event.button === 0) interactionAction(); return; }
      if (!dragLook && !coarse) { enter(); return; }
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (!press || press.id !== event.pointerId || mode !== 'exploring') return;
      const dx = event.clientX - press.x, dy = event.clientY - press.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) { press.moved = true; cancelRoute(); }
      yaw -= dx * 0.0035 * sensitivity;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0035 * sensitivity, -1.4, 1.4);
      press.x = event.clientX; press.y = event.clientY;
    }, { signal });
    canvas.addEventListener('pointerup', event => {
      if (!press || press.id !== event.pointerId) return;
      if (!press.moved && event.button === 0) interactionAction();
      press = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener('pointercancel', () => { press = null; }, { signal });
    canvas.addEventListener('lostpointercapture', () => { press = null; }, { signal });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); cancelAnimationFrame(frame); clearMovement(); unlock();
      ui.setFailed('The graphics context was lost. Reload the page to restart the study.');
    }, { signal });
    function updateStick(event: PointerEvent) {
      const rect = stick.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / 39;
      const y = (event.clientY - rect.top - rect.height / 2) / 39;
      const length = Math.max(1, Math.hypot(x, y));
      joystick.set(x / length, -y / length);
      stickThumb.style.transform = `translate(calc(-50% + ${joystick.x * 29}px), calc(-50% - ${joystick.y * 29}px))`;
    }
    stick.addEventListener('pointerdown', event => {
      if (mode !== 'exploring') return;
      event.preventDefault(); stickPointer = event.pointerId; cancelRoute();
      stick.setPointerCapture(event.pointerId); updateStick(event);
    }, { signal });
    stick.addEventListener('pointermove', event => { if (mode === 'exploring' && event.pointerId === stickPointer) updateStick(event); }, { signal });
    const endStick = (event: PointerEvent) => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = null; joystick.set(0, 0); stickThumb.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('pointerup', endStick, { signal });
    stick.addEventListener('pointercancel', endStick, { signal });
    stick.addEventListener('lostpointercapture', endStick, { signal });
    window.addEventListener('keydown', event => {
      if (ui.isOpen() || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Escape') { if (mode === 'exploring' || mode === 'transition') pause(); return; }
      if (mode !== 'exploring') return;
      if (event.code === 'KeyM') { event.preventDefault(); ui.openContent('books'); return; }
      if (event.code === 'KeyE') { event.preventDefault(); if (!event.repeat) interactionAction(); return; }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault(); keys.add(event.code); cancelRoute();
      }
    }, { signal });
    window.addEventListener('keyup', event => keys.delete(event.code), { signal });
    window.addEventListener('blur', () => { clearMovement(); if (mode === 'exploring') pause(); }, { signal });
    document.addEventListener('visibilitychange', () => {
      ambience.setHidden(document.hidden); clearMovement();
      if (document.hidden) { save(); if (mode === 'exploring') pause(); }
      previousFrame = performance.now();
    }, { signal });
    suspendAction = () => {
      save(); clearMovement(); pause(); ambience.setHidden(true);
    };
    resumeAction = () => {
      clearMovement(); previousFrame = performance.now(); lastRender = 0;
      ambience.setHidden(document.hidden);
    };

    function resize() {
      const rect = canvas!.getBoundingClientRect(); pipeline.resize(rect.width, rect.height);
    }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); resize();
    resources.unshift(() => resizeObserver.disconnect());
    updateCamera(1); scene.updateMatrixWorld(true);
    let shaderFailed = false;
    renderer.debug.onShaderError = (gl, program) => {
      shaderFailed = true; console.error('Mountain study material could not compile:', gl.getProgramInfoLog(program));
    };
    await renderer.compileAsync(scene, camera);
    if (!alive) { resources.forEach(dispose => dispose()); return; }
    pipeline.render(0);
    if (shaderFailed) throw new Error('A scene material shader could not compile.');
    ui.setReady(); setMode(ui.isOpen() ? 'reading' : 'welcome');
    teardown = () => {
      save(); window.clearTimeout(interactionTimer); cancelAnimationFrame(frame); unlock();
      resources.forEach(dispose => dispose());
    };

    function tick(now: number) {
      if (!alive) return;
      frame = requestAnimationFrame(tick);
      if (document.hidden) { previousFrame = now; return; }
      const minimumInterval = mode === 'reading' ? 100 : mode === 'paused' || mode === 'welcome' ? 33 : 0;
      if (now - lastRender < minimumInterval) return;
      const rawDelta = (now - previousFrame) / 1000;
      const delta = Math.min(0.04, Math.max(0.001, rawDelta));
      previousFrame = now; lastRender = now;
      if (mode !== 'reading') elapsed += delta;
      let speed = 0;
      if (mode === 'exploring') {
        yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * delta * 1.45;
        pitch = THREE.MathUtils.clamp(pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * delta * 1.05, -1.4, 1.4);
        let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + joystick.y;
        let right = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + joystick.x;
        if (Math.abs(forward) + Math.abs(right) > 0.01) standUp();
        let movement = movementDirection(yaw, forward, right);
        let pace = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.6 : 2.2;
        if (route.length && !seatedAt) {
          let next = route[0];
          if (Math.hypot(next.x - position.x, next.z - position.z) < 0.12) { route.shift(); next = route[0]; }
          if (next) {
            const dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz);
            movement = { x: dx / distance, z: dz / distance }; pace = Math.min(2, distance / delta);
            const targetYaw = Math.atan2(-dx, -dz);
            yaw += Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw)) * Math.min(1, delta * 4.5);
            pitch = THREE.MathUtils.lerp(pitch, -0.035, delta * 3);
          } else {
            if (destination) { face(destination); ui.showToast(en ? 'Look at the object and press E.' : '看向眼前物件，按 E 细看。'); }
            cancelRoute(); movement = { x: 0, z: 0 }; velocity.set(0, 0);
          }
        }
        const damping = 1 - Math.exp(-delta * 14);
        velocity.x = THREE.MathUtils.lerp(velocity.x, movement.x * pace, damping);
        velocity.y = THREE.MathUtils.lerp(velocity.y, movement.z * pace, damping);
        if (!seatedAt) {
          const next = navigation.move(position, velocity.x * delta, velocity.y * delta);
          const distance = Math.hypot(next.x - position.x, next.z - position.z);
          position.x = next.x; position.z = next.z;
          speed = distance / delta; walked += distance;
        }
      }
      updateCamera(delta, speed);
      const indoor = position.z < -0.8 && position.x < 6.2 && position.x > -6.2;
      environment.update(elapsed, delta, indoor);
      const highlighted = elapsed < selectedUntil ? selectedId : mode === 'exploring' ? aimed?.id ?? null : null;
      furniture.update(elapsed, delta, highlighted);
      if (elapsed < selectedUntil) lighting.sun.shadow.needsUpdate = true;
      ambience.update(indoor, speed, delta);
      if (elapsed - lastPick > 0.075) {
        lastPick = elapsed; aimed = findAimed();
        if (seatedAt && mode === 'exploring') {
          ui.setInteraction({ ...seatedAt, id: 'stand-up', label: '起身，继续走走', labelEn: 'Stand up and explore' });
        } else ui.setInteraction(aimed);
        root.dataset.aimed = String(Boolean(aimed || seatedAt));
      }
      if (seatedAt) ui.setLocation('临崖小坐', 'Among the clouds');
      else if (indoor) ui.setLocation('灯下书斋', 'Inside the study');
      else if (position.x > 6) ui.setLocation('松间露台', 'The pine terrace');
      else ui.setLocation('洞前石径', 'The mountain path');
      pipeline.render(delta);
      if (elapsed - lastSave > 5) { lastSave = elapsed; save(); }
      if (mode === 'exploring' && rawDelta < 0.15 && elapsed > 5) {
        frameSum += rawDelta; frameSamples++;
        if (frameSamples >= 180) {
          if (frameSum / frameSamples > 0.029 && qualityAdjustments < 3 && pipeline.easeResolution()) qualityAdjustments++;
          frameSum = 0; frameSamples = 0;
        }
      }
    }
    previousFrame = performance.now(); frame = requestAnimationFrame(tick);
  } catch (error) {
    console.error('The mountain study could not open:', error);
    resources.forEach(dispose => { try { dispose(); } catch {} });
    if (alive) ui.setFailed(error instanceof Error ? error.message : 'The 3D scene could not start.');
  }
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
