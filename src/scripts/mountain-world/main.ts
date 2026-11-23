import * as THREE from 'three';
import type { createAmbience } from './music';
import { createEnvironment } from './environment';
import { createFurnishings } from './furnishings';
import { createSurfaceLibrary } from './materials';
import { createNavigation, type Point } from './navigation';
import { createWorldUI } from './ui';
import { createStudyLighting } from './lighting';
import { createLandscapeBackdrop } from './landscape-backdrop';
import { createStudyRenderer, type RenderQuality } from './rendering';
import { createInteractionPicker, movementDirection, FLOOR_HEIGHT, EYE_HEIGHT, SEATED_EYE_HEIGHT } from './first-person';
import { LookController, DragLookGesture, StanceTransition, pointerToNDC } from './look-controls';
import { createPointerLockRequest } from './pointer-lock';
import type { Interaction, WorldConfig } from './types';

type Mode = 'welcome' | 'exploring' | 'paused' | 'reading' | 'transition' | 'falling' | 'fallen';
type InputMode = 'none' | 'pending' | 'locked' | 'pointer' | 'drag' | 'touch';

const GRAVITY = 9.8;
const JUMP_SPEED = 3.8;

// A free cursor can turn the camera inside the outer 15% of each edge.
function edgeTurn(position: number) {
  const amount = Math.max(0, (Math.abs(position) - .7) / .3);
  return Math.sign(position) * amount * amount;
}

/** Floor-level regions of the U-shaped courtyard; open galleries retain outdoor sound. */
function describePlace(x: number, z: number) {
  if (x >= -6.1 && x <= 6.1 && z >= -10 && z <= -5.8)
    return { name: '云庭书斋', nameEn: 'Cloud Court Study', indoor: true };
  if (x >= -6.1 && x <= -3.2 && z > -5.8 && z <= .6)
    return { name: '藏书小阁', nameEn: 'The library wing', indoor: true };
  if (x >= 3.2 && x <= 6.1 && z > -5.8 && z <= .6)
    return { name: '临庭观物', nameEn: 'The courtyard workroom', indoor: true };
  if (Math.abs(x) >= 6.1 && Math.abs(x) <= 8.4 && z >= -8.2 && z <= 7.5)
    return { name: '临云长廊', nameEn: 'The cloudside gallery', indoor: false };
  if ((Math.abs(x) <= 3.2 && z > -5.8 && z <= .6) || (Math.abs(x) < 6.35 && z > .6 && z <= 8.4))
    return { name: '天光水庭', nameEn: 'The sunlit water court', indoor: false };
  if (Math.abs(x) > 8.4 && z >= -8.2 && z <= 8.5)
    return { name: '松间露台', nameEn: 'The pine terrace', indoor: false };
  return { name: '云山石径', nameEn: 'The cloud mountain path', indoor: false };
}

export async function initializeWorld(root: HTMLElement, ambience: ReturnType<typeof createAmbience>) {
  const canvas = root.querySelector<HTMLCanvasElement>('#mountain-canvas');
  const configElement = document.getElementById('mountain-world-config');
  if (!canvas || !configElement) return;
  const config: WorldConfig = JSON.parse(configElement.textContent || '{}');
  const en = config.isEn;
  const abort = new AbortController(), { signal } = abort;
  const musicPreferenceKey = 'mountain-study:music';

  let alive = true, teardown = () => {};
  let suspendAction = () => {}, resumeAction = () => {};
  let interactionAction = () => {}, resetAction = () => {};
  let navigateAction = (_id: string) => {}, readingAction = (_open: boolean) => {};
  let visitorPose: () => { x: number; z: number; yaw: number } | null = () => null;
  const ui = createWorldUI(root, config, {
    onInteract: () => interactionAction(), onReset: () => resetAction(),
    onSound: () => {
      const playing = ambience.toggle();
      try { localStorage.setItem(musicPreferenceKey, playing ? 'on' : 'off'); } catch {}
      return playing;
    }, onNavigate: id => navigateAction(id),
    onReadingChange: open => readingAction(open), getPose: () => visitorPose(),
  });
  root.addEventListener('mountain-music-error', () => {
    ui.setSound(false);
    ui.showToast(en ? 'Music could not play. Click the speaker to retry.' : '音乐暂时无法播放，点击喇叭可重试。');
  }, { signal });
  function failWorld(reason: string) {
    ambience.dispose();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    ui.setFailed(reason);
  }
  document.addEventListener('visibilitychange', () => ambience.setHidden(document.hidden), { signal });
  ambience.setHidden(document.hidden);
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
    failWorld('WebGL2 could not be initialized.');
    return;
  }
  const resources: (() => void)[] = [() => renderer.dispose()];
  let resourcesDisposed = false;
  let cancelInitializationWait = () => {}, stopWorld = () => {};
  // Register disposal before the first asynchronous initialization step. A page
  // can leave while fonts, artwork, or the GPU compiler are still pending.
  teardown = () => {
    if (resourcesDisposed) return;
    resourcesDisposed = true;
    cancelInitializationWait();
    try { stopWorld(); } catch { /* Still release every owned graphics resource. */ }
    for (const dispose of resources.splice(0)) { try { dispose(); } catch {} }
  };
  function waitForOptionalAsset(promise: Promise<unknown>, maximumMs: number) {
    return new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true; window.clearTimeout(timer);
        cancelInitializationWait = () => {};
        resolve();
      };
      const timer = window.setTimeout(finish, maximumMs);
      cancelInitializationWait = finish;
      // Optional assets have their own visual fallback. Neither a failed request
      // nor a stalled connection may hold the usable scene behind the loader.
      void Promise.resolve(promise).then(finish, finish);
    });
  }
  try {
    // Wait for the subset used by the canvas book labels, with a bounded fallback.
    await new Promise<void>(resolve => {
      const finish = () => { cancelInitializationWait = () => {}; resolve(); };
      const initialFrame = requestAnimationFrame(finish);
      cancelInitializationWait = () => { cancelAnimationFrame(initialFrame); finish(); };
    });
    if (!alive || resourcesDisposed) return;
    if (document.fonts) await waitForOptionalAsset(
      document.fonts.load('500 48px "Noto Serif SC"', '藏书简历近作项目山中手记读诗小记数学随笔桃源读书札记自由的代价初中生活残灵光明算法导论计算机系统离散数学编译原理机器学习新年格物札记夜光何德死则又育坐听松风归观物求知致来访者羽'),
      2200,
    );
    if (!alive || resourcesDisposed) return;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    const reducedMotion = motionPreference.matches;
    root.dataset.touch = String(coarse);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc7dfe6);
    scene.fog = new THREE.FogExp2(0xc7dfe6, 0.0035);
    const camera = new THREE.PerspectiveCamera(coarse ? 72 : 67, 1, 0.055, 230);
    camera.rotation.order = 'YXZ';
    const backdrop = createLandscapeBackdrop(scene); resources.unshift(() => backdrop.dispose());
    const surfaces = createSurfaceLibrary(); resources.unshift(() => surfaces.dispose());
    const environment = createEnvironment(scene, surfaces, en); resources.unshift(() => environment.dispose());
    const furniture = createFurnishings(scene, en, surfaces); resources.unshift(() => furniture.dispose());
    const lighting = createStudyLighting(scene, coarse); resources.unshift(() => lighting.dispose());
    lighting.sun.shadow.autoUpdate = false; lighting.sun.shadow.needsUpdate = true;
    const pipeline = createStudyRenderer(renderer, scene, camera, coarse); resources.unshift(() => pipeline.dispose());
    const navigation = createNavigation(environment.walkAreas, [...environment.colliders, ...furniture.colliders], .32, environment.outline);
    const picker = createInteractionPicker([environment.root, furniture.root], furniture.interactions);
    const entrance = { x: 0, z: 17.65 };
    const arrivalPitch = .085;
    const spawn = navigation.canWalk(entrance.x, entrance.z) ? entrance : navigation.nearest(entrance, 3);
    if (!spawn || !navigation.canWalk(spawn.x, spawn.z)) throw new Error('The courtyard entrance has no safe walking position.');
    const position = new THREE.Vector3(spawn.x, FLOOR_HEIGHT, spawn.z);
    const velocity = new THREE.Vector2();
    let verticalSpeed = 0;
    const keys = new Set<string>();
    const joystick = new THREE.Vector2();
    // Layout changes invalidate old world coordinates, while language switches
    // still share the same safe place within this courtyard.
    const stateKey = `mountain-first-person-v4-pine-court:${config.base}`;
    const look = new LookController(0, arrivalPitch);
    visitorPose = () => ({ x: position.x, z: position.z, yaw: look.yaw });
    const stance = new StanceTransition(.3);
    let sensitivity = 1, headBob = false;
    let mode: Mode = 'welcome';
    let achievementUntil = 0;
    let route: Point[] = [], destination: Interaction | null = null;
    let aimed: Interaction | null = null, seatedAt: Interaction | null = null;
    let seatReturn: THREE.Vector3 | null = null;
    let restoreWalkingLock = false, lastSeatUnlock = -Infinity, relockOnTap = false;
    let selectedId: string | null = null, selectedUntil = 0;
    let elapsed = 0, landscapeTime = 0, walked = 0, interactionTimer = 0;
    let frame = 0, previousFrame = performance.now(), lastRender = 0, lastPick = -1, lastSave = 0;
    let frameSum = 0, frameSamples = 0, qualityAdjustments = 0;
    let hadPointerLock = false, dragLook = false, touchInput = coarse;
    let inputMode: InputMode = 'none', pointerInside = false, aimDirty = true;
    const pointerClient = new THREE.Vector2(), pointerNDC = new THREE.Vector2(), centre = new THREE.Vector2();
    let press: DragLookGesture | null = null;
    let stickPointer: number | null = null;
    const entry = root.querySelector<HTMLElement>('[data-world-entry]')!;
    const enterButton = root.querySelector<HTMLButtonElement>('[data-world-enter]')!;
    const trackSelect = root.querySelector<HTMLSelectElement>('[data-world-track]')!;
    trackSelect.value = ambience.selection;
    trackSelect.addEventListener('change', () => {
      ambience.select(trackSelect.value);
      try { localStorage.setItem('mountain-study:track', ambience.selection); } catch {}
    }, { signal });
    const stage = root.querySelector<HTMLElement>('.mw-stage')!;
    const hint = root.querySelector<HTMLElement>('[data-world-hint]')!;
    const settings = root.querySelector<HTMLDialogElement>('[data-world-settings]')!;
    const settingsButton = root.querySelector<HTMLButtonElement>('[data-world-settings-open]')!;
    let introTimer = 0, hintTimer = 0, resumeAfterSettings = false;
    const pauseButton = root.querySelector<HTMLButtonElement>('[data-world-pause]')!;
    const standButton = root.querySelector<HTMLButtonElement>('[data-world-stand]');
    const lockButton = root.querySelector<HTMLButtonElement>('[data-world-lock]');
    const jumpButton = root.querySelector<HTMLButtonElement>('[data-world-jump]')!;
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
        look.snap(Number.isFinite(saved.yaw) ? saved.yaw : 0, Number.isFinite(saved.pitch) ? saved.pitch : -0.035);
      } else if (location.hash === '#study') {
        look.snap(0, -.035);
        const inside = navigation.nearest({ x: 0, z: -4.6 }, 2);
        if (inside && navigation.canWalk(inside.x, inside.z)) position.set(inside.x, FLOOR_HEIGHT, inside.z);
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
    const pointerLock = createPointerLockRequest({
      request: raw => raw ? canvas.requestPointerLock({ unadjustedMovement: true }) : canvas.requestPointerLock(),
      isActive: () => alive && mode === 'exploring' && !ui.isOpen(),
      onFallback: () => {
        if (document.pointerLockElement === canvas) return;
        dragLook = true; relockOnTap = false;
        syncInputMode();
        if (performance.now() < achievementUntil) return;
        ui.showToast(en ? 'Move the pointer to an edge or drag to look around. Click open ground to retry mouse lock.' : '鼠标靠近画面边缘或按住拖动都能环顾。点击空处可重试锁定。');
      },
    });

    function clearAim() {
      aimed = null; ui.setInteraction(null); root.dataset.aimed = 'false'; aimDirty = true;
    }
    function setInputMode(value: InputMode) {
      if (inputMode !== value) clearAim();
      inputMode = value; root.dataset.inputMode = value;
      // This attribute reports native state, never a CSS approximation of a lock.
      root.dataset.pointerLocked = String(document.pointerLockElement === canvas);
    }
    function syncInputMode() {
      if (mode !== 'exploring' || ui.isOpen()) setInputMode('none');
      else if (document.pointerLockElement === canvas) setInputMode('locked');
      else if (touchInput || press?.source === 'touch') setInputMode('touch');
      else if (!dragLook) setInputMode('pending');
      else setInputMode(press?.moved ? 'drag' : 'pointer');
    }
    function clearPointer() { pointerInside = false; clearAim(); }
    function trackPointer(event: PointerEvent) {
      if (document.pointerLockElement === canvas) return;
      if (event.pointerType) {
        // A coarse primary pointer does not mean the user has no physical mouse.
        touchInput = event.pointerType === 'touch'; root.dataset.touch = String(touchInput);
        syncInputMode();
      }
      if (touchInput) { clearPointer(); return; }
      const point = pointerToNDC(event.clientX, event.clientY, canvas!.getBoundingClientRect());
      pointerInside = point !== null;
      pointerClient.set(event.clientX, event.clientY);
      if (point) pointerNDC.copy(point);
      else if (inputMode === 'pointer') clearAim();
      aimDirty = true;
    }
    function clearDrag() {
      const pointerId = press?.id;
      if (press) look.end(press.source);
      press = null;
      if (pointerId !== undefined && canvas!.hasPointerCapture(pointerId)) canvas!.releasePointerCapture(pointerId);
      syncInputMode();
    }
    function clearMovement() {
      keys.clear(); joystick.set(0, 0); velocity.set(0, 0);
      clearDrag();
      const thumbId = stickPointer; stickPointer = null;
      if (thumbId !== null && stick.hasPointerCapture(thumbId)) stick.releasePointerCapture(thumbId);
      stickThumb.style.transform = 'translate(-50%, -50%)';
    }
    function cancelRoute() { route = []; destination = null; delete root.dataset.guided; }
    const fallDialog = root.querySelector<HTMLDialogElement>('[data-world-fall]');
    const respawnButton = root.querySelector<HTMLButtonElement>('[data-world-respawn]');
    let fallTime = 0, fallDX = 0, fallDZ = 0, awardedThisVisit = false;
    function inFall() { return mode === 'falling' || mode === 'fallen'; }
    function save() {
      if (inFall()) return;
      const p = seatReturn || position;
      if (!navigation.hasFloor(p.x, p.z)) return;
      try { sessionStorage.setItem(stateKey, JSON.stringify({ x: p.x, z: p.z, yaw: look.yaw, pitch: look.pitch })); } catch {}
    }
    function setMode(value: Mode) {
      mode = value; root.dataset.mode = value;
      entry.hidden = value !== 'paused';
      if (value !== 'exploring' && value !== 'welcome') {
        window.clearTimeout(introTimer); window.clearTimeout(hintTimer);
        delete root.dataset.arriving; hint.hidden = true;
      }
      pauseButton.hidden = value !== 'exploring';
      if (value !== 'exploring') {
        pointerLock.cancel(); look.suspend();
        clearMovement(); clearPointer();
      }
      syncInputMode();
    }
    function unlock() { if (document.pointerLockElement === canvas) document.exitPointerLock(); }
    function pause() {
      if (mode === 'reading' || mode === 'welcome' || inFall()) return;
      window.clearTimeout(interactionTimer); cancelRoute(); setMode('paused'); unlock(); save();
      enterButton.focus({ preventScroll: true });
    }
    function requestLock() {
      if (mode !== 'exploring' || ui.isOpen()) return;
      clearDrag(); clearPointer(); canvas!.focus({ preventScroll: true });
      if (document.pointerLockElement === canvas) {
        dragLook = false; syncInputMode(); look.begin('locked', performance.now()); return;
      }
      look.suspend();
      if (touchInput || !canvas!.requestPointerLock) { dragLook = true; syncInputMode(); return; }
      dragLook = false; syncInputMode();
      // Keep the native request in the click handler's user activation.
      pointerLock.start();
    }
    function enter() {
      if (ui.isOpen()) return;
      setMode('exploring');
      requestLock();
    }
    function airborne() {
      return verticalSpeed !== 0 || position.y > FLOOR_HEIGHT;
    }
    function jump() {
      if (mode !== 'exploring' || seatedAt || ui.isOpen() || settings.open || airborne()) return;
      cancelRoute(); look.cancelTurn();
      verticalSpeed = JUMP_SPEED;
    }
    function advanceHeight(dt: number) {
      position.y += verticalSpeed * dt - 0.5 * GRAVITY * dt * dt;
      verticalSpeed -= GRAVITY * dt;
    }
    function eyePosition() {
      return { x: position.x, y: position.y + (seatedAt ? SEATED_EYE_HEIGHT : EYE_HEIGHT), z: position.z };
    }
    function standUp(resumeMouse = false) {
      if (!seatedAt) return;
      position.copy(seatReturn || seatedAt.approach); position.y = FLOOR_HEIGHT;
      seatedAt = null; seatReturn = null; look.cancelTurn();
      delete root.dataset.seated;
      if (standButton) standButton.hidden = true;
      clearAim();
      if (reducedMotion) stance.reset();
      else stance.rebase(camera.position, eyePosition());
      if (resumeMouse && restoreWalkingLock && document.pointerLockElement !== canvas) requestLock();
      restoreWalkingLock = false;
    }
    function face(item: Interaction) {
      // The displayed camera may still be between sitting and standing positions.
      const eye = eyePosition();
      const dx = item.position.x - eye.x, dy = item.position.y - eye.y, dz = item.position.z - eye.z;
      look.turnTo(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    }
    function updateCamera(delta: number, speed = 0) {
      const eye = stance.apply(eyePosition(), delta);
      const bob = headBob && !seatedAt && !airborne() && speed > 0.3 ? Math.sin(walked * 8) * 0.014 * Math.min(1, speed / 2.2) : 0;
      camera.position.set(eye.x, eye.y + bob, eye.z);
      camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
      camera.updateMatrixWorld();
    }
    function aimPoint() {
      if (mode !== 'exploring' || ui.isOpen() || seatedAt) return null;
      // Loss of native lock is authoritative even before lockchange is dispatched.
      if (inputMode === 'locked') return document.pointerLockElement === canvas ? centre : null;
      if (document.pointerLockElement === canvas) return null;
      if (inputMode === 'pointer') return pointerInside ? pointerNDC : null;
      return inputMode === 'drag' || inputMode === 'touch' ? centre : null;
    }
    function findAimed() {
      const point = aimPoint();
      if (!point) return null;
      scene.updateMatrixWorld();
      const item = picker.pick(camera, point);
      return item?.kind === 'bench' && airborne() ? null : item;
    }
    function showInteraction() {
      aimDirty = false; lastPick = elapsed; aimed = findAimed();
      const rect = inputMode === 'pointer' ? root.getBoundingClientRect() : null;
      const screen = rect ? { x: pointerClient.x - rect.left, y: pointerClient.y - rect.top } : undefined;
      ui.setInteraction(aimed, screen);
      root.dataset.aimed = String(Boolean(aimed));
    }
    function activate(item: Interaction) {
      cancelRoute(); clearMovement(); selectedId = item.id; selectedUntil = elapsed + 1.35;
      item.activate?.(); lighting.sun.shadow.needsUpdate = true;
      if (item.kind === 'lantern') return;
      if (item.kind === 'bench') {
        seatReturn = position.clone();
        seatedAt = item; root.dataset.seated = 'true';
        if (standButton) standButton.hidden = false;
        restoreWalkingLock = document.pointerLockElement === canvas;
        clearAim(); syncInputMode();
        if (item.sitPosition) position.copy(item.sitPosition);
        const view = item.sitYaw ?? look.yaw;
        if (reducedMotion) { stance.reset(); look.snap(view,.05); }
        else { stance.rebase(camera.position, eyePosition()); look.turnTo(view,.05); }
        ui.showToast(touchInput ? (en ? 'Drag to look around. Tap Stand up to leave.' : '拖动环顾，轻触「起身」离座。')
          : (en ? 'Look around. Press E to stand up.' : '环顾山色，按 E 起身。'));
      } else {
        setMode('transition'); unlock();
        interactionTimer = window.setTimeout(() => {
          if (alive && mode === 'transition') ui.openContent(item.kind);
        }, reducedMotion ? 0 : 620);
      }
      save();
    }
    interactionAction = () => {
      if (!aimPoint()) return;
      const item = findAimed();
      if (item) activate(item);
      else if (inputMode === 'locked') ui.useCentredWaymark();
    };
    readingAction = open => {
      if (inFall()) return;
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
        setMode('paused'); ui.showToast(en ? 'There is no clear path from here. Return to the courtyard gate and try again.' : '这里暂时没有通路，可以先回到庭门。'); return;
      }
      route = path; destination = item; root.dataset.guided = 'true';
      enter(); ui.showToast(en ? `Walking to ${item.labelEn.toLowerCase()}. Look around or move to take control.` : `向${item.label}走去。转动视线或自行走动即可接管。`);
    };
    resetAction = () => {
      if (inFall()) return;
      window.clearTimeout(interactionTimer);
      if (mode === 'transition') setMode('paused');
      standUp(); cancelRoute(); clearMovement();
      verticalSpeed = 0;
      position.set(spawn.x, FLOOR_HEIGHT, spawn.z); look.snap(0, arrivalPitch); stance.reset();
      updateCamera(1); save(); ui.showToast(en ? 'Back at the courtyard gate.' : '回到庭门，云庭就在眼前。');
    };
    fallDialog?.addEventListener('cancel', event => event.preventDefault(), {signal});
    respawnButton?.addEventListener('click', () => {
      if (mode !== 'fallen') return;
      fallDialog?.close();
      setMode('paused'); resetAction(); enter();
      const key = 'mountain-study:achievement:first-fall';
      let first = !awardedThisVisit;
      try { first = first && !localStorage.getItem(key); localStorage.setItem(key,'1'); } catch {}
      awardedThisVisit = true;
      if (first) {
        achievementUntil = performance.now()+3400;
        ui.showToast(en ? 'Achievement unlocked: A Flying Leap of Three Thousand Feet' : '获得成就：飞人直下三千尺');
      }
    }, {signal});
    function savePreferences() {
      try { localStorage.setItem('mountain-first-person:preferences', JSON.stringify({ quality: qualitySelect.value, sensitivity, headBob })); } catch {}
    }
    qualitySelect.addEventListener('change', () => {
      pipeline.setQuality(qualitySelect.value as RenderQuality); qualityAdjustments = 0; savePreferences();
    }, { signal });
    sensitivityInput.addEventListener('input', () => { sensitivity = Number(sensitivityInput.value); savePreferences(); }, { signal });
    bobInput.addEventListener('change', () => { headBob = bobInput.checked && !reducedMotion; savePreferences(); }, { signal });
    settingsButton.addEventListener('click', () => {
      if (mode !== 'exploring' && mode !== 'paused') return;
      resumeAfterSettings = mode === 'exploring';
      if (resumeAfterSettings) pause();
      settings.showModal();
    }, { signal });
    root.querySelector('[data-world-settings-close]')!.addEventListener('click', () => {
      settings.close();
      if (resumeAfterSettings) enter();
      else settingsButton.focus();
    }, { signal });
    enterButton.addEventListener('click', enter, { signal });
    standButton?.addEventListener('click', () => {
      if (mode === 'exploring' && seatedAt) { standUp(true); canvas!.focus({ preventScroll: true }); }
    }, { signal });
    pauseButton.addEventListener('click', pause, { signal });
    lockButton?.addEventListener('click', requestLock, { signal });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      const wasLocked = hadPointerLock;
      hadPointerLock = locked;
      if (locked) {
        if (mode === 'welcome') return;
        pointerLock.onLocked();
        clearDrag(); clearPointer();
        if (!alive || ui.isOpen() || mode !== 'exploring') {
          look.suspend(); syncInputMode(); document.exitPointerLock(); return;
        }
        look.begin('locked', performance.now()); dragLook = false; relockOnTap = false;
      } else {
        pointerLock.cancel();
        look.suspend(); dragLook = true;
        if (wasLocked) relockOnTap = true;
        if (wasLocked && mode === 'exploring') {
          if (seatedAt) lastSeatUnlock = performance.now();
          else pause();
        }
        clearDrag(); clearPointer();
      }
      syncInputMode();
    }, { signal });
    document.addEventListener('pointerlockerror', () => pointerLock.onError(), { signal });
    function eventTime(event: Event) {
      // Older engines use epoch timestamps; keep input and performance.now on one clock.
      return event.timeStamp > performance.timeOrigin ? event.timeStamp - performance.timeOrigin : event.timeStamp;
    }
    document.addEventListener('mousemove', event => {
      if (mode !== 'exploring' || document.pointerLockElement !== canvas || ui.isOpen()) return;
      if (look.sample('locked', event.movementX, event.movementY, eventTime(event), performance.now(), sensitivity)) cancelRoute();
    }, { signal });
    canvas.addEventListener('pointerdown', event => {
      // The pause overlay passes the exposed scene through to this canvas.
      if (mode === 'paused' && !ui.isOpen() && event.pointerType === 'mouse' && event.button === 0) {
        relockOnTap = true; touchInput = false; root.dataset.touch = 'false'; enter(); return;
      }
      if (mode !== 'exploring' || ui.isOpen() || (event.button !== 0 && event.button !== 2)) return;
      canvas.focus({ preventScroll: true });
      if (document.pointerLockElement === canvas) { if (event.button === 0) interactionAction(); return; }
      trackPointer(event);
      if (!dragLook && !touchInput) return;
      if (press) return;
      press = new DragLookGesture(event.pointerId, event.clientX, event.clientY, event.pointerType === 'touch' ? 'touch' : 'drag');
      look.begin(press.source, eventTime(event));
      syncInputMode();
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    function dragMove(event: PointerEvent) {
      if (!press || press.id !== event.pointerId || mode !== 'exploring' || document.pointerLockElement === canvas || ui.isOpen()) return;
      const { dx, dy } = press.move(event.clientX, event.clientY);
      if (look.sample(press.source, dx, dy, eventTime(event), performance.now(), sensitivity)) cancelRoute();
      syncInputMode();
    }
    canvas.addEventListener('pointermove', event => { trackPointer(event); dragMove(event); }, { signal });
    canvas.addEventListener('pointerleave', clearPointer, { signal });
    canvas.addEventListener('pointerup', event => {
      if (!press || press.id !== event.pointerId) return;
      trackPointer(event);
      dragMove(event);
      const tap = !press.moved && event.button === 0, mouse = press.source === 'drag';
      clearDrag();
      if (!tap) return;
      showInteraction();
      if (mouse && typeof canvas.requestPointerLock === 'function' && (relockOnTap || seatedAt || !aimed)) {
        requestLock(); return;
      }
      interactionAction();
    }, { signal });
    const endDrag = (event: PointerEvent) => { if (event.pointerId === press?.id) clearDrag(); };
    canvas.addEventListener('pointercancel', endDrag, { signal });
    canvas.addEventListener('lostpointercapture', endDrag, { signal });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); window.clearTimeout(interactionTimer);
      cancelRoute(); setMode('paused'); teardown();
      failWorld('The graphics context was lost. Reload the page to restart the study.');
    }, { signal });
    function updateStick(event: PointerEvent) {
      const rect = stick.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / 39;
      const y = (event.clientY - rect.top - rect.height / 2) / 39;
      const length = Math.max(1, Math.hypot(x, y));
      joystick.set(x / length, -y / length);
      stickThumb.style.transform = `translate(calc(-50% + ${joystick.x * 29}px), calc(-50% - ${joystick.y * 29}px))`;
    }
    // A second finger can jump immediately while the first holds the thumbstick.
    jumpButton.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      jump();
    }, { signal });
    jumpButton.addEventListener('click', event => {
      if (event.detail === 0) jump();
    }, { signal });
    stick.addEventListener('pointerdown', event => {
      if (mode !== 'exploring') return;
      event.preventDefault(); stickPointer = event.pointerId; cancelRoute(); look.cancelTurn();
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
      if (settings.open) return;
      if (event.code === 'KeyH' && mode === 'exploring' && !hint.hidden) { hint.hidden = true; return; }
      if (ui.isOpen() || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Escape' && mode === 'exploring' && seatedAt && (document.pointerLockElement === canvas || performance.now() - lastSeatUnlock < 180)) {
        if (document.pointerLockElement === canvas) unlock();
        return;
      }
      if (event.code === 'Escape') { if (mode === 'exploring' || mode === 'transition') pause(); return; }
      if (mode !== 'exploring') return;
      if (event.code === 'Space') {
        if (event.target instanceof HTMLElement && event.target.closest('button, a[href], textarea, [contenteditable]:not([contenteditable="false"])')) return;
        event.preventDefault();
        if (!event.repeat) jump();
        return;
      }
      if (event.code === 'KeyM') { event.preventDefault(); ui.openContent('books', true); return; }
      if (event.code === 'KeyE') { event.preventDefault(); if (!event.repeat) { if (seatedAt) standUp(true); else interactionAction(); } return; }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        if (seatedAt && ['KeyW','KeyA','KeyS','KeyD'].includes(event.code)) standUp(true);
        event.preventDefault(); keys.add(event.code); cancelRoute(); look.cancelTurn();
      }
    }, { signal });
    window.addEventListener('keyup', event => keys.delete(event.code), { signal });
    window.addEventListener('blur', () => { clearMovement(); if (mode === 'exploring') pause(); }, { signal });
    document.addEventListener('visibilitychange', () => {
      clearMovement();
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
      clearPointer();
    }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); resize();
    resources.unshift(() => resizeObserver.disconnect());
    updateCamera(1); scene.updateMatrixWorld(true);
    let shaderFailed = false;
    renderer.debug.onShaderError = (gl, program) => {
      shaderFailed = true; console.error('Mountain study material could not compile:', gl.getProgramInfoLog(program));
    };
    stopWorld = () => {
      save(); window.clearTimeout(interactionTimer); window.clearTimeout(introTimer); window.clearTimeout(hintTimer); cancelAnimationFrame(frame);
      pointerLock.cancel(); look.suspend(); clearMovement(); unlock();
    };
    // Painting and mountains share one deadline. Their existing fallbacks remain
    // usable, and their own callbacks may still install late images until disposal.
    await waitForOptionalAsset(Promise.allSettled([environment.assetsReady, furniture.assetsReady, backdrop.ready]), 1500);
    if (!alive || resourcesDisposed) return;
    await renderer.compileAsync(scene, camera);
    if (!alive || resourcesDisposed) return;
    pipeline.render(0);
    if (shaderFailed) throw new Error('A scene material shader could not compile.');
    ui.setReady(); ui.setSound(ambience.enabled);
    root.querySelector<HTMLElement>('[data-world-arrival]')!.hidden = true;
    stage.inert = false;
    hadPointerLock = document.pointerLockElement === canvas;
    dragLook = !hadPointerLock;
    setMode(ui.isOpen() ? 'reading' : document.hidden ? 'paused' : 'exploring');
    if (!ui.isOpen() && !document.hidden) {
      canvas.focus({ preventScroll: true });
      if (hadPointerLock) look.begin('locked', performance.now());
      root.dataset.arriving = 'true';
      introTimer = window.setTimeout(() => {
        delete root.dataset.arriving; hint.hidden = false;
        hintTimer = window.setTimeout(() => { hint.hidden = true; }, 5000);
      }, motionPreference.matches ? 0 : 950);
    } else { unlock(); }

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
        if (inputMode === 'pointer' && pointerInside && !press) {
          const pan = edgeTurn(pointerNDC.x), tilt = edgeTurn(pointerNDC.y);
          if (pan || tilt) {
            look.rotate(-pan * delta * 1.8 * sensitivity, tilt * delta * 1.15 * sensitivity);
            cancelRoute();
          }
        }
        look.rotate((Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * delta * 1.45,
          (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * delta * 1.05);
        let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + joystick.y;
        let right = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + joystick.x;
        if (Math.abs(forward) + Math.abs(right) > 0.01) standUp();
        let movement = movementDirection(look.yaw, forward, right);
        let pace = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.6 : 2.2;
        const guided = route.length > 0 && !seatedAt;
        if (guided) {
          let next = route[0];
          if (Math.hypot(next.x - position.x, next.z - position.z) < 0.12) { route.shift(); next = route[0]; }
          if (next) {
            const dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz);
            movement = { x: dx / distance, z: dz / distance }; pace = Math.min(2, distance / delta);
            look.turnTo(Math.atan2(-dx, -dz), -0.035);
          } else {
            if (destination) {
              face(destination);
              const prompt = touchInput ? (en ? 'Tap the object prompt.' : '轻触物件提示。') : (en ? `Press E · ${destination.labelEn}` : `按 E ${destination.label}。`);
              ui.showToast(prompt);
            }
            cancelRoute(); movement = { x: 0, z: 0 }; velocity.set(0, 0);
          }
        }
        look.advance(rawDelta);
        if (!guided) movement = movementDirection(look.yaw, forward, right);
        const damping = 1 - Math.exp(-delta * 14);
        velocity.x = THREE.MathUtils.lerp(velocity.x, movement.x * pace, damping);
        velocity.y = THREE.MathUtils.lerp(velocity.y, movement.z * pace, damping);
        if (!seatedAt) {
          const next = navigation.move(position, velocity.x * delta, velocity.y * delta, !guided);
          const distance = Math.hypot(next.x - position.x, next.z - position.z);
          position.x = next.x; position.z = next.z;
          speed = distance / delta; walked += distance;
          if (airborne()) advanceHeight(Math.min(0.12, Math.max(0, rawDelta)));
          if (position.y <= FLOOR_HEIGHT && verticalSpeed <= 0) {
            if (navigation.hasFloor(next.x, next.z)) {
              position.y = FLOOR_HEIGHT;
              verticalSpeed = 0;
            } else {
              fallTime = 0; fallDX = velocity.x; fallDZ = velocity.y;
              cancelRoute(); clearAim(); setMode('falling'); unlock(); fallDialog?.showModal();
            }
          }
        }
      } else if (mode === 'falling') {
        const dt = Math.min(0.12, Math.max(0, rawDelta));
        fallTime += dt;
        position.x += fallDX * dt; position.z += fallDZ * dt;
        advanceHeight(dt);
        if (fallTime >= (motionPreference.matches ? .12 : 1.15)) {
          setMode('fallen'); respawnButton?.focus();
        }
      }
      updateCamera(Math.min(0.05, Math.max(0, rawDelta)), speed);
      const place = describePlace(position.x, position.z), indoor = place.indoor;
      // Clouds keep the same pace across frame rates. A preference change freezes the current view.
      const landscapeDelta = motionPreference.matches || mode === 'reading' ? 0 : Math.min(.25, Math.max(0, rawDelta));
      landscapeTime += landscapeDelta;
      environment.update(landscapeTime, landscapeDelta, indoor);
      backdrop.update(landscapeTime);
      const highlighted = elapsed < selectedUntil ? selectedId : mode === 'exploring' ? aimed?.id ?? null : null;
      furniture.update(elapsed, delta, highlighted);
      if (elapsed < selectedUntil) lighting.sun.shadow.needsUpdate = true;
      ambience.update(indoor, speed, delta);
      if (aimDirty || elapsed - lastPick > 0.075) showInteraction();
      if (mode === 'exploring' && !seatedAt) ui.updateWaymarks(camera, furniture.interactions, aimed?.id);
      if (seatedAt) ui.setLocation('临崖小坐', 'Among the clouds');
      else ui.setLocation(place.name, place.nameEn);
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
    teardown();
    if (alive) {
      console.error('The mountain study could not open:', error);
      failWorld(error instanceof Error ? error.message : 'The 3D scene could not start.');
    }
  }
}
