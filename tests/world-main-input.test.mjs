import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setImmediate as nextTurn } from 'node:timers/promises';
import ts from 'typescript';
import * as THREE from 'three';
import * as lookControls from '../src/scripts/mountain-world/look-controls.ts';
import * as music from '../src/scripts/mountain-world/music.ts';
import * as pointerLock from '../src/scripts/mountain-world/pointer-lock.ts';
import * as firstPerson from '../src/scripts/mountain-world/first-person.ts';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// Execute the real entry point and real CPU picking against small DOM/WebGL stubs.
// These are event/lifecycle regressions, not browser rendering or Pointer Lock support tests.
const main = ts.transpileModule(fs.readFileSync(new URL('../src/scripts/mountain-world/main.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function world({ coarse = false, legacy = false, unavailable = false, bench = false, reduced = false,
  assetsReady = Promise.resolve(), backdropReady = Promise.resolve(), compileReady = Promise.resolve(),
  expectReady = true, expectFailure = false, hash = '', session = {},
  canWalk = () => true, hasFloor = () => true, nearest = point => point } = {}) {
  let now = 100, nextId = 0, readerOpen = false, actions, camera, exitRequests = 0;
  const frames = new Map(), timers = new Map(), requests = [], activated = [], errors = [], toasts = [];
  const motionPreference = { matches: reduced };
  const lifecycle = { compiles: 0, renders: 0, ready: 0, backdropUpdates: 0, landscapeTime: 0, environmentUpdates: [], disposed: {} };
  const disposed = name => { lifecycle.disposed[name] = (lifecycle.disposed[name] || 0) + 1; };
  const rect = { left: 80, top: 40, width: 1200, height: 800 };
  class Element {
    listeners = new Map(); children = new Map(); captures = new Set(); dataset = {}; style = {};
    hidden = false; value = ''; checked = false; textContent = '';
    clientWidth = rect.width; clientHeight = rect.height;
    addEventListener(type, handler, options = {}) {
      const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list);
      options.signal?.addEventListener('abort', () => this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)), { once: true });
    }
    emit(type, values = {}) {
      const event = { type, target: this, timeStamp: now, button: 0, pointerId: 1, pointerType: 'mouse',
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        preventDefault() {}, ...values };
      for (const callback of [...this.listeners.get(type) || []]) callback(event);
      return event;
    }
    querySelector(selector) { return this.children.get(selector) || null; }
    closest() { return null; }
    getBoundingClientRect() { return { ...rect }; }
    focus() { document.activeElement = this; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  }
  class Input extends Element {}
  class Select extends Element {}
  const root = new Element(), canvas = new Element(), document = new Element(), window = new Element();
  document.hidden = false; document.pointerLockElement = null;
  document.querySelector = () => root;
  document.getElementById = () => ({ textContent: JSON.stringify({ isEn: true, prefix: '', base: '/', posts: [] }) });
  document.exitPointerLock = () => { exitRequests++; };
  const controls = {};
  for (const name of ['arrival', 'track', 'hint', 'settings', 'settings-open', 'settings-close', 'entry', 'enter', 'entry-title', 'entry-copy', 'pause', 'lock', 'stand', 'jump', 'stick', 'stick-thumb', 'fall', 'respawn', 'quality', 'sensitivity', 'bob']) {
    controls[name] = name === 'quality' ? new Select() : ['sensitivity', 'bob'].includes(name) ? new Input() : new Element();
    root.children.set(`[data-world-${name}]`, controls[name]);
  }
  controls.enter.children.set('[data-world-enter-label]', new Element());
  root.children.set('.mw-stage', new Element());
  controls.hint.hidden = true;
  controls.fall.showModal = () => { controls.fall.open = true; };
  controls.fall.close = () => { controls.fall.open = false; };
  root.children.set('#mountain-canvas', canvas);
  if (!unavailable) canvas.requestPointerLock = options => {
    const request = { raw: options?.unadjustedMovement === true, ...deferred() };
    requests.push(request);
    return legacy ? undefined : request.promise;
  };
  window.setTimeout = (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + delay }); return id; };
  window.clearTimeout = id => timers.delete(id);
  const storage = (initial = {}) => { const data = new Map(Object.entries(initial)); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
  const sessionStore = storage(session);
  const items = [], meshes = new THREE.Group();
  for (const [id, x] of [['centre', 0], ['side', .75]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.25, .6, .1), new THREE.MeshStandardMaterial());
    meshes.add(mesh);
    items.push({ id, kind: bench && id === 'centre' ? 'bench' : 'lantern', position: mesh.position, approach: new THREE.Vector3(),
      label: id, labelEn: id, radius: 2.5, meshes: [mesh], activate: () => activated.push(id) });
  }
  const ui = {
    setSound() {}, updateWaymarks() {}, useCentredWaymark() {},
    interaction: null, screen: undefined,
    setInteraction(item, screen) { this.interaction = item; this.screen = screen; },
    setLocation(name, nameEn) { this.location = { name, nameEn }; }, showToast(message) { toasts.push(message); },
    isOpen: () => readerOpen,
    openContent() { readerOpen = true; actions.onReadingChange(true); },
    setReady() { lifecycle.ready++; root.dataset.state = 'ready'; },
    setFailed(message) { root.dataset.state = 'failed'; errors.push(message); }, dispose() { disposed('ui'); },
  };
  const modules = {
    three: { ...THREE, WebGLRenderer: class { debug = {}; compileAsync() { lifecycle.compiles++; return compileReady; } dispose() { disposed('renderer'); } } },
    './music': music, './look-controls': lookControls, './pointer-lock': pointerLock, './first-person': firstPerson,
    './landscape-backdrop': { createLandscapeBackdrop(scene) {
      const root = new THREE.Group(); root.name = 'test-backdrop'; root.userData.ignoreAmbientOcclusion = true; scene.add(root);
      return { root, ready: backdropReady, update(time) { lifecycle.backdropUpdates++; lifecycle.landscapeTime = time; }, dispose() { disposed('backdrop'); root.removeFromParent(); } };
    } },
    './materials': { createSurfaceLibrary: () => ({ dispose() { disposed('surfaces'); } }) },
    './environment': { createEnvironment(scene) { const root = new THREE.Group(); scene.add(root); return { root, walkAreas: [], colliders: [], update(_time, _delta, indoor) { lifecycle.environmentUpdates.push(indoor); }, dispose() { disposed('environment'); } }; } },
    './furnishings': { createFurnishings(scene) { scene.add(meshes); return { root: meshes, interactions: items, colliders: [], assetsReady, update() {}, dispose() { disposed('furnishings'); } }; } },
    './lighting': { createStudyLighting: () => ({ sun: { shadow: {} }, dispose() { disposed('lighting'); } }) },
    './rendering': { createStudyRenderer(_renderer, _scene, value) {
      assert.equal(_scene.getObjectByName('test-backdrop')?.userData.ignoreAmbientOcclusion, true,
        'The backdrop must exist before the rendering pipeline collects AO exclusions.');
      camera = value;
      return { dispose() { disposed('pipeline'); }, setQuality() {}, render() { lifecycle.renders++; }, easeResolution: () => false,
        resize(width, height) { camera.aspect = width / height; camera.updateProjectionMatrix(); } };
    } },
    './navigation': { createNavigation: () => ({ nearest, canWalk, hasFloor,
      findPath: (_start, end) => [{ x: end.x, z: end.z }],
      move: (point, dx, dz) => ({ x: point.x + dx, z: point.z + dz }) }) },
    './ui': { createWorldUI(_root, _config, value) { actions = value; return ui; } },
  };
  const context = vm.createContext({
    exports: {}, require(name) { assert.ok(name in modules, `Unexpected runtime import: ${name}`); return modules[name]; },
    document, window, HTMLElement: Element, HTMLInputElement: Input, HTMLSelectElement: Select,
    performance: { now: () => now, timeOrigin: 1700000000000 },
    matchMedia: query => query.includes('reduced-motion') ? motionPreference : { matches: query === '(pointer: coarse)' && coarse },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} disconnect() { disposed('resize'); } }, AbortController,
    sessionStorage: sessionStore, localStorage: storage(), location: { hash },
    console: { ...console, error: (...values) => errors.push(values.join(' ')) },
  });
  function step(milliseconds = 16) {
    now += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now));
  }
  function emit(target, type, values = {}) { now++; return target.emit(type, values); }
  function pointer(type, values = {}) { return emit(canvas, type, values); }
  function point(id) {
    const projected = items.find(item => item.id === id).position.clone().project(camera);
    return { clientX: rect.left + (projected.x + 1) * rect.width / 2, clientY: rect.top + (1 - projected.y) * rect.height / 2 };
  }
  function key(code) { emit(window, 'keydown', { code }); emit(window, 'keyup', { code }); }
  function click(position = {}) { pointer('pointerdown', position); pointer('pointerup', position); }
  function enter() { emit(controls.enter, 'click'); }
  async function fail(name = 'NotAllowedError', index = requests.length - 1) {
    emit(document, 'pointerlockerror');
    if (!legacy) requests[index].reject(new DOMException('Lock failed', name));
    await nextTurn();
  }
  async function lock(index = requests.length - 1) {
    document.pointerLockElement = canvas; emit(document, 'pointerlockchange');
    if (index >= 0 && !legacy) requests[index].resolve();
    await nextTurn();
  }
  function unlock() { document.pointerLockElement = null; emit(document, 'pointerlockchange'); }
  function reader(open, notify = true) { readerOpen = open; if (notify) actions.onReadingChange(open); }
  vm.runInContext(main, context, { filename: 'main.ts' });
  void context.exports.initializeWorld(root, music.createAmbience('/', () => {}));
  step(); await nextTurn();
  if (!expectFailure) assert.deepEqual(errors, []);
  if (camera) {
    // Input fixtures follow the initialized eye; moving the real map's entrance
    // must not silently turn a cursor regression into a test of old coordinates.
    for (const [index, item] of items.entries()) {
      item.position.set(index * .75, 0, -1.5).applyQuaternion(camera.quaternion).add(camera.position);
      item.approach.set(camera.position.x + index * .75, .3, camera.position.z);
      if (item.kind === 'bench') { item.sitPosition = item.approach.clone().add(new THREE.Vector3(0,.52,-.4)); item.sitYaw = 1.25; }
    }
    meshes.updateMatrixWorld(true);
  }
  if (expectReady) {
    assert.equal(root.dataset.state, 'ready');
    assert.equal(root.dataset.inputMode, coarse ? 'touch' : 'pointer');
  }
  return { root, canvas, document, window, controls, ui, requests, activated, toasts, camera, lifecycle, errors, sessionStore, motionPreference,
    actions, step, emit, pointer, point, key, click, enter, fail, lock, unlock, reader,
    exitRequests: () => exitRequests, pendingTimers: () => timers.size, pendingFrames: () => frames.size };
}

test('Space jumps once, allows forward movement, and needs a fresh press after landing', async () => {
  const h = await world();
  const start = h.camera.position.clone();
  h.emit(h.window, 'keydown', { code: 'KeyW' });
  h.emit(h.window, 'keydown', { code: 'Space', target: h.canvas });
  h.step(100);
  assert.ok(h.camera.position.y > start.y && h.camera.position.z < start.z);
  for (let i = 0; i < 4; i++) h.step(100);
  const descending = h.camera.position.y;
  h.key('Space');
  h.step(100);
  assert.ok(h.camera.position.y < descending, 'A fresh press in midair cannot start a second arc.');
  for (let i = 0; i < 4; i++) h.step(100);
  assert.equal(h.camera.position.y, start.y);
  h.emit(h.window, 'keydown', { code: 'Space', repeat: true });
  h.step(100);
  assert.equal(h.camera.position.y, start.y);
  h.key('Space'); h.step(100);
  assert.ok(h.camera.position.y > start.y);
});

test('a second touch jumps while steering, and pausing freezes the airborne player', async () => {
  const h = await world({ coarse: true });
  const start = h.camera.position.clone();
  const stick = h.controls.stick, bounds = stick.getBoundingClientRect();
  h.emit(stick, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientY: bounds.top + bounds.height / 2 - 35 });
  h.emit(h.controls.jump, 'pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false });
  h.step(100);
  assert.ok(h.camera.position.z < start.z && h.camera.position.y > start.y);
  assert.ok(stick.hasPointerCapture(1));
  h.emit(h.controls.pause, 'click');
  const paused = h.camera.position.clone();
  h.key('Space'); h.step(100);
  assert.ok(h.camera.position.equals(paused));
  h.enter();
  for (let i = 0; i < 10; i++) h.step(100);
  assert.equal(h.camera.position.y, start.y);
  h.emit(h.controls.jump, 'click', { detail: 1 }); h.step(100);
  assert.equal(h.camera.position.y, start.y, 'A delayed touch click cannot jump again after landing.');
});

test('jumping past a cliff falls through ground level and respawns ready to jump', async () => {
  const h = await world({ hasFloor: (_x, z) => z >= 17.61 });
  const start = h.camera.position.clone();
  h.emit(h.window, 'keydown', { code: 'KeyW' }); h.key('Space'); h.step(100); h.step(100);
  assert.ok(h.camera.position.z < 17.61 && h.camera.position.y > start.y);
  assert.equal(h.root.dataset.mode, 'exploring');
  for (let i = 0; i < 8; i++) h.step(100);
  assert.equal(h.root.dataset.mode, 'falling');
  assert.equal(h.controls.fall.open, true);
  assert.ok(h.camera.position.y < start.y);
  for (let i = 0; i < 12; i++) h.step(100);
  assert.equal(h.root.dataset.mode, 'fallen');
  h.emit(h.controls.respawn, 'click');
  assert.equal(h.controls.fall.open, false);
  assert.ok(h.camera.position.equals(start));
  h.key('Space'); h.step(100);
  assert.ok(h.camera.position.y > start.y);
});

test('a failed lock uses the visible mouse ray for hover, click, and E; leaving the canvas clears it', async () => {
  const h = await world(); h.enter();
  assert.equal(h.root.dataset.inputMode, 'pending');
  h.click(h.point('side')); h.key('KeyE'); h.step();
  assert.equal(h.ui.interaction, null); assert.deepEqual(h.activated, []);
  h.emit(h.document, 'pointerlockerror');
  assert.equal(h.root.dataset.inputMode, 'pending', 'A generic event does not race the Promise rejection.');
  await h.fail();
  assert.equal(h.root.dataset.inputMode, 'pointer');
  const side = h.point('side'); h.pointer('pointermove', side); h.step();
  assert.equal(h.ui.interaction?.id, 'side');
  assert.ok(Math.abs(h.ui.screen.x - (side.clientX - 80)) < 1e-9);
  assert.ok(Math.abs(h.ui.screen.y - (side.clientY - 40)) < 1e-9);
  h.click(side); h.key('KeyE');
  assert.deepEqual(h.activated, ['side', 'side']);
  h.pointer('pointerleave', { relatedTarget: h.controls.lock });
  assert.equal(h.ui.interaction, null);
  h.key('KeyE'); h.actions.onInteract();
  assert.deepEqual(h.activated, ['side', 'side']);
});

test('the explicit lock button waits for native success, then centre aim ignores old free-pointer coordinates', async () => {
  const h = await world(); h.enter(); await h.fail();
  h.pointer('pointermove', h.point('side')); h.step();
  assert.equal(h.ui.interaction?.id, 'side');
  h.emit(h.controls.lock, 'click');
  assert.equal(h.requests.length, 2);
  assert.equal(h.root.dataset.inputMode, 'pending'); assert.equal(h.ui.interaction, null);
  h.key('KeyE'); assert.deepEqual(h.activated, []);
  await h.lock(); h.step();
  assert.equal(h.root.dataset.inputMode, 'locked'); assert.equal(h.root.dataset.pointerLocked, 'true');
  assert.equal(h.ui.interaction?.id, 'centre'); assert.equal(h.ui.screen, undefined);
  h.pointer('pointerdown', h.point('side'));
  assert.deepEqual(h.activated, ['centre']);
  h.unlock();
  assert.equal(h.root.dataset.mode, 'paused'); assert.equal(h.root.dataset.inputMode, 'none');
  h.key('KeyE'); assert.deepEqual(h.activated, ['centre']);
});

test('fallback dragging has centre aim only during a real drag and never activates on release', async () => {
  const h = await world(); h.enter(); await h.fail();
  const start = h.point('side');
  h.pointer('pointerdown', start);
  assert.equal(h.root.dataset.inputMode, 'pointer');
  for (let i = 1; i <= 120; i++) h.pointer('pointermove', { ...start, clientX: start.clientX + i });
  assert.equal(h.root.dataset.inputMode, 'drag');
  h.step(); assert.equal(h.ui.screen, undefined);
  h.pointer('pointerup', { ...start, clientX: start.clientX + 130 });
  assert.equal(h.root.dataset.inputMode, 'pointer');
  assert.deepEqual(h.activated, []); assert.equal(h.canvas.captures.size, 0);
  h.pointer('pointerdown', start); h.pointer('pointermove', { ...start, clientX: start.clientX + 10 });
  h.pointer('pointercancel');
  assert.equal(h.root.dataset.inputMode, 'pointer'); assert.equal(h.canvas.captures.size, 0);
  h.emit(h.window, 'blur');
  assert.equal(h.root.dataset.inputMode, 'none'); assert.equal(h.ui.interaction, null);
});

test('read, return, resume, and a renewed pending request cannot leave an ambiguous exploring mode', async () => {
  const h = await world(); h.enter(); await h.lock();
  h.reader(true);
  assert.equal(h.root.dataset.inputMode, 'none'); assert.equal(h.root.dataset.mode, 'reading');
  assert.equal(h.exitRequests(), 1); h.unlock();
  h.reader(false);
  assert.equal(h.root.dataset.mode, 'paused'); assert.equal(h.root.dataset.inputMode, 'none');
  h.enter(); assert.equal(h.requests.length, 2);
  h.emit(h.window, 'blur');
  assert.equal(h.root.dataset.mode, 'paused');
  h.enter();
  assert.equal(h.requests.length, 2, 'Resume reuses the sole unresolved native request.');
  assert.equal(h.root.dataset.inputMode, 'pending');
  await h.fail('NotAllowedError', 1);
  assert.equal(h.root.dataset.mode, 'exploring'); assert.equal(h.root.dataset.inputMode, 'pointer');
  h.pointer('pointermove', h.point('side')); h.step();
  assert.equal(h.ui.interaction?.id, 'side');
});

test('late lock success during a reader is released, and an unrestarted cancelled failure stays ignored', async () => {
  const h = await world(); h.enter(); h.reader(true);
  await h.lock();
  assert.equal(h.root.dataset.mode, 'reading'); assert.equal(h.root.dataset.inputMode, 'none');
  assert.equal(h.exitRequests(), 1);
  h.unlock(); assert.equal(h.root.dataset.mode, 'reading');
  h.reader(false); h.enter(); h.key('Escape');
  const toasts = h.toasts.length;
  await h.fail('NotSupportedError');
  assert.equal(h.requests.length, 2, 'A cancelled raw failure cannot trigger an ordinary retry.');
  assert.equal(h.toasts.length, toasts);
  assert.equal(h.root.dataset.mode, 'paused'); assert.equal(h.root.dataset.inputMode, 'none');
});

test('navigation can request a lock in its click, and a queued reader close does not undo it', async () => {
  const h = await world(); h.reader(true); h.reader(false, false);
  h.actions.onNavigate('side');
  assert.equal(h.root.dataset.mode, 'exploring'); assert.equal(h.root.dataset.inputMode, 'pending');
  assert.equal(h.requests.length, 1);
  h.actions.onReadingChange(false);
  assert.equal(h.root.dataset.mode, 'exploring');
  await h.fail();
  assert.equal(h.root.dataset.inputMode, 'pointer');
  assert.equal(h.ui.interaction, null, 'Navigation does not invent a free-pointer hover.');
});

test('event-only failures and an unavailable API both expose an explicit pointer fallback', async () => {
  for (const options of [{ legacy: true }, { unavailable: true }]) {
    const h = await world(options); h.enter();
    if (options.legacy) { assert.equal(h.root.dataset.inputMode, 'pending'); await h.fail(); }
    assert.equal(h.root.dataset.inputMode, 'pointer');
    h.click(h.point('side')); assert.deepEqual(h.activated, ['side']);
  }
});

test('touch exploration retains centre interaction without attempting native mouse lock', async () => {
  const h = await world({ coarse: true }); h.enter();
  assert.equal(h.root.dataset.inputMode, 'touch'); assert.equal(h.requests.length, 0);
  h.pointer('pointerdown', { ...h.point('side'), pointerType: 'touch' });
  h.pointer('pointerup', { ...h.point('side'), pointerType: 'touch' });
  assert.deepEqual(h.activated, ['centre']);
  assert.equal(h.root.dataset.inputMode, 'touch');
});

test('a real mouse on a coarse device switches to cursor picking, and touch can take over again', async () => {
  const h = await world({ coarse: true }); h.enter();
  const side = h.point('side'); h.pointer('pointermove', side); h.step();
  assert.equal(h.root.dataset.inputMode, 'pointer'); assert.equal(h.root.dataset.touch, 'false');
  assert.equal(h.ui.interaction?.id, 'side');
  h.click(side); assert.deepEqual(h.activated, ['side']);
  h.pointer('pointerdown', { ...side, pointerType: 'touch' });
  h.pointer('pointerup', { ...side, pointerType: 'touch' });
  assert.equal(h.root.dataset.inputMode, 'touch'); assert.equal(h.root.dataset.touch, 'true');
  assert.deepEqual(h.activated, ['side', 'centre']);
});

test('a native state change awaiting its notification cannot click with a different visible aim mode', async () => {
  const h = await world(); h.enter();
  h.document.pointerLockElement = h.canvas;
  h.key('KeyE'); assert.deepEqual(h.activated, []);
  await h.lock();
  h.document.pointerLockElement = null;
  h.key('KeyE'); h.click(h.point('side'));
  assert.deepEqual(h.activated, []);
  h.unlock(); assert.equal(h.root.dataset.inputMode, 'none');
});

test('sitting keeps a native lock and the first click after losing it only reacquires the mouse', async () => {
  const h = await world({ bench: true });
  h.enter(); await h.lock(); h.key('KeyE');
  assert.equal(h.exitRequests(), 0);
  assert.equal(h.root.dataset.seated, 'true'); assert.equal(h.root.dataset.inputMode, 'locked');
  for (let i = 0; i < 60; i++) h.step();
  const yaw = h.camera.rotation.y;
  h.emit(h.document, 'mousemove', { movementX: 100, movementY: 0 }); h.step(35);
  assert.ok(h.camera.rotation.y < yaw - .1);
  h.unlock(); assert.equal(h.root.dataset.inputMode, 'pointer');
  h.click(h.point('centre')); assert.equal(h.requests.length, 2);
  assert.deepEqual(h.activated, ['centre']); assert.equal(h.root.dataset.seated, 'true');
  await h.lock(); h.key('KeyE');
  for (let i = 0; i < 28; i++) h.step();
  assert.equal(h.root.dataset.seated, undefined); assert.equal(h.root.dataset.inputMode, 'locked');
  assert.equal(h.camera.position.z, 17.65);
});

test('clicking the exposed scene after a walking unlock resumes without firing the aimed object', async () => {
  const h = await world(); h.enter(); await h.lock(); h.unlock();
  assert.equal(h.root.dataset.mode, 'paused');
  h.click(h.point('centre')); assert.equal(h.requests.length, 2); assert.deepEqual(h.activated, []);
  await h.fail(); h.click({clientX: 100, clientY: 200});
  assert.equal(h.requests.length, 3); assert.deepEqual(h.activated, []);
  await h.lock(); assert.equal(h.root.dataset.inputMode, 'locked');
  h.click(h.point('centre')); assert.deepEqual(h.activated, ['centre']);
});

test('a browser that denies capture still turns at the edge and stops when the cursor leaves', async () => {
  const h = await world(); h.enter(); await h.fail();
  h.pointer('pointermove', h.point('centre'));
  const start = h.camera.rotation.y;
  for (let i = 0; i < 15; i++) h.step();
  assert.equal(h.camera.rotation.y, start);
  const rect = h.canvas.getBoundingClientRect();
  h.pointer('pointermove', {clientX:rect.left + rect.width - 1, clientY:rect.top + rect.height / 2});
  for (let i = 0; i < 30; i++) h.step();
  assert.ok(h.camera.rotation.y < start - .4);
  h.pointer('pointerleave');
  for (let i = 0; i < 60; i++) h.step();
  const stopped = h.camera.rotation.y;
  for (let i = 0; i < 10; i++) h.step();
  assert.ok(Math.abs(h.camera.rotation.y - stopped) < .0001);
  assert.equal(h.root.dataset.pointerLocked, 'false');
});

test('a seated visitor can pause, resume, and use the stand control without pointing at a mesh', async () => {
  const h=await world({bench:true,unavailable:true,reduced:true});
  h.enter(); h.click(h.point('centre')); h.step(16);
  assert.equal(h.root.dataset.seated,'true'); assert.equal(h.camera.rotation.y,1.25);
  const seatedEye = h.camera.position.y;
  h.key('Space'); h.step(100);
  assert.equal(h.camera.position.y, seatedEye);
  h.reader(true); h.reader(false); h.enter();
  h.emit(h.controls.stand,'click'); h.step(320);
  assert.equal(h.root.dataset.seated,undefined); assert.equal(h.root.dataset.inputMode,'pointer');
  assert.equal(h.camera.position.z,17.65);
});

test('escaping a seated mouse lock keeps the seat and exposes its controls', async () => {
  const h=await world({bench:true});
  h.enter(); await h.lock(); h.key('KeyE'); h.unlock();
  h.emit(h.controls.lock,'click'); await h.lock(); h.key('Escape'); h.unlock(); h.key('Escape');
  assert.equal(h.root.dataset.mode,'exploring'); assert.equal(h.root.dataset.seated,'true');
  assert.equal(h.root.dataset.inputMode,'pointer');
});

test('losing the graphics context disables interactions and refuses a late lock', async () => {
  const h = await world(); h.enter();
  h.pointer('webglcontextlost');
  assert.equal(h.root.dataset.inputMode, 'none'); assert.equal(h.root.dataset.mode, 'paused');
  await h.lock();
  assert.equal(h.exitRequests(), 1); assert.equal(h.root.dataset.inputMode, 'none');
  h.key('KeyE'); assert.deepEqual(h.activated, []);
});

const graphicsResources = ['renderer', 'backdrop', 'surfaces', 'environment', 'furnishings', 'lighting', 'pipeline', 'resize'];
function assertReleasedOnce(h) {
  for (const resource of graphicsResources) assert.equal(h.lifecycle.disposed[resource], 1, resource);
}

test('painting and backdrop share one deadline and both settle before early compilation', async () => {
  const artwork = deferred(), backdrop = deferred();
  const h = await world({ assetsReady: artwork.promise, backdropReady: backdrop.promise, expectReady: false });
  assert.equal(h.lifecycle.compiles, 0); assert.equal(h.lifecycle.ready, 0);
  assert.equal(h.pendingTimers(), 1);
  artwork.resolve(); await nextTurn();
  assert.equal(h.lifecycle.compiles, 0, 'A ready painting must not bypass the still-loading backdrop.');
  assert.equal(h.pendingTimers(), 1);
  backdrop.resolve(); await nextTurn();
  assert.equal(h.lifecycle.compiles, 1); assert.equal(h.lifecycle.ready, 1);
  assert.equal(h.pendingTimers(), 1, 'Only the opening guide timer remains');
  assert.deepEqual(h.lifecycle.disposed, {});
});

test('stalled decorative assets allow entry after one 1500ms deadline; late images do not reinitialize', async () => {
  const artwork = deferred(), backdrop = deferred();
  const h = await world({ assetsReady: artwork.promise, backdropReady: backdrop.promise, expectReady: false });
  h.step(1499); await nextTurn();
  assert.equal(h.lifecycle.compiles, 0); assert.equal(h.lifecycle.ready, 0);
  h.step(1); await nextTurn();
  assert.equal(h.lifecycle.compiles, 1); assert.equal(h.lifecycle.ready, 1);
  assert.equal(h.pendingTimers(), 1, 'Only the opening guide timer remains');
  artwork.resolve(); backdrop.resolve(); await nextTurn(); h.step(40);
  assert.equal(h.lifecycle.compiles, 1); assert.equal(h.lifecycle.ready, 1);
  assert.ok(h.lifecycle.renders > 1);
  assert.ok(h.lifecycle.backdropUpdates > 0);
  assert.deepEqual(h.lifecycle.disposed, {}, 'Timing out never disposes the still-usable artwork or scene.');
});

test('leaving during asset loading cancels the deadline and disposes before any late compiler or ready callback', async () => {
  const artwork = deferred(), backdrop = deferred();
  const h = await world({ assetsReady: artwork.promise, backdropReady: backdrop.promise, expectReady: false });
  h.emit(h.window, 'pagehide', { persisted: false });
  assert.equal(h.pendingTimers(), 0); assert.equal(h.pendingFrames(), 0);
  assertReleasedOnce(h);
  await nextTurn();
  assert.equal(h.lifecycle.compiles, 0);
  artwork.resolve(); backdrop.resolve(); await nextTurn(); h.step(2000);
  assert.equal(h.lifecycle.compiles, 0); assert.equal(h.lifecycle.ready, 0); assert.equal(h.lifecycle.renders, 0);
  h.emit(h.window, 'pagehide', { persisted: false });
  assertReleasedOnce(h); assert.deepEqual(h.errors, []);
});

test('leaving during compilation releases immediately and ignores its late rejection', async () => {
  const compile = deferred();
  const h = await world({ compileReady: compile.promise, expectReady: false });
  assert.equal(h.lifecycle.compiles, 1); assert.equal(h.lifecycle.ready, 0);
  h.emit(h.window, 'pagehide', { persisted: false });
  assertReleasedOnce(h); assert.equal(h.pendingTimers(), 0);
  compile.reject(new Error('Context disappeared after pagehide')); await nextTurn();
  assertReleasedOnce(h);
  assert.equal(h.lifecycle.renders, 0); assert.equal(h.lifecycle.ready, 0);
  assert.deepEqual(h.errors, [], 'A disposed page must not display a late initialization failure.');
});

test('context loss during the shared asset wait cannot later reopen the failed scene', async () => {
  const artwork = deferred(), backdrop = deferred();
  const h = await world({ assetsReady: artwork.promise, backdropReady: backdrop.promise, expectReady: false });
  h.pointer('webglcontextlost');
  assert.equal(h.root.dataset.state, 'failed'); assert.equal(h.pendingTimers(), 0);
  assertReleasedOnce(h);
  artwork.resolve(); backdrop.resolve(); await nextTurn();
  assert.equal(h.lifecycle.compiles, 0); assert.equal(h.lifecycle.ready, 0);
  h.emit(h.window, 'pagehide', { persisted: false });
  assertReleasedOnce(h);
});

test('an optional backdrop failure preserves the painting wait and allows the fallback scene', async () => {
  const artwork = deferred(), backdrop = deferred();
  const h = await world({ assetsReady: artwork.promise, backdropReady: backdrop.promise, expectReady: false });
  backdrop.reject(new Error('Decorative panorama unavailable')); await nextTurn();
  assert.equal(h.lifecycle.compiles, 0); assert.equal(h.pendingTimers(), 1);
  artwork.resolve(); await nextTurn();
  assert.equal(h.lifecycle.compiles, 1); assert.equal(h.lifecycle.ready, 1);
  assert.equal(h.pendingTimers(), 1, 'Only the opening guide timer remains'); assert.deepEqual(h.errors, []);
  h.emit(h.window, 'pagehide', { persisted: false }); assertReleasedOnce(h);
});

const courtyardStateKey = 'mountain-first-person-v4-pine-court:/';
test('the new layout ignores old coordinates, validates study links, and restores its own safe session', async () => {
  const old = JSON.stringify({ x: -5, z: -8, yaw: 1, pitch: .2 });
  const h = await world({ session: { 'mountain-first-person-v3-cloud-court:/': old } });
  assert.equal(h.camera.position.x, 0); assert.equal(h.camera.position.z, 17.65);
  h.actions.onReset();
  const saved = JSON.parse(h.sessionStore.getItem(courtyardStateKey));
  assert.equal(saved.x, 0); assert.equal(saved.z, 17.65);
  const fromArticle = await world({ hash: '#study' });
  assert.equal(fromArticle.camera.position.x, 0); assert.equal(fromArticle.camera.position.z, -4.6);
  const blockedArticle = await world({ hash: '#study', canWalk: (_x, z) => z !== -4.6 });
  assert.equal(blockedArticle.camera.position.z, 17.65, 'An unsafe nearest result cannot replace the valid entrance.');
  const returning = await world({ hash: '#study', session: { [courtyardStateKey]: JSON.stringify({ x: 7, z: -4, yaw: .3, pitch: .1 }) } });
  assert.equal(returning.camera.position.x, 7); assert.equal(returning.camera.position.z, -4);
  assert.equal(returning.camera.rotation.y, .3); assert.equal(returning.camera.rotation.x, .1);
});

test('an unsafe entrance uses only a validated neighbour or fails without an unchecked spawn', async () => {
  const h = await world({ canWalk: x => x === 1.8, nearest: () => ({ x: 1.8, z: 11 }) });
  assert.equal(h.camera.position.x, 1.8); assert.equal(h.camera.position.z, 11);
  for (const nearest of [() => null, () => ({ x: 0, z: 3 })]) {
    const failed = await world({ canWalk: () => false, nearest, expectReady: false, expectFailure: true });
    assert.equal(failed.root.dataset.state, 'failed');
    assert.equal(failed.lifecycle.compiles, 0); assert.equal(failed.lifecycle.ready, 0);
    assert.equal(failed.pendingTimers(), 0); assert.equal(failed.pendingFrames(), 0);
    assert.ok(failed.errors.some(message => message.includes('no safe walking position')));
    for (const resource of graphicsResources.filter(name => name !== 'resize')) assert.equal(failed.lifecycle.disposed[resource], 1, resource);
  }
});

test('roofed courtyard wings and outdoor spaces use their matching location and ambience', async () => {
  for (const [x, z, name, indoor] of [
    [0, -7, '云庭书斋', true], [-4, -2, '藏书小阁', true], [4, -2, '临庭观物', true],
    [0, -2, '天光水庭', false], [0, 6, '天光水庭', false], [7, -4, '临云长廊', false],
    [10, 5, '松间露台', false], [1.3, 11, '云山石径', false],
  ]) {
    const h = await world({ session: { [courtyardStateKey]: JSON.stringify({ x, z }) } });
    h.step(40);
    assert.equal(h.ui.location.name, name);
    assert.equal(h.lifecycle.environmentUpdates.at(-1), indoor);
    assert.equal(h.lifecycle.backdropUpdates, 1);
    h.emit(h.window, 'pagehide', { persisted: false }); assertReleasedOnce(h);
  }
});

test('AO failure restores scene state and whole-background/particle visibility before direct rendering', () => {
  // Run the application pipeline with the installed GTAOPass's real override
  // methods. Only GPU calls and the unrelated full-screen passes are stubbed.
  const source = ts.transpileModule(fs.readFileSync(new URL('../src/scripts/mountain-world/rendering.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const background = new THREE.Group(); background.userData.ignoreAmbientOcclusion = true;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial());
  background.add(sky); scene.add(background);
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
  const alreadyHidden = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial()); alreadyHidden.visible = false;
  scene.add(points, line, alreadyHidden);
  let ao, throwInAO = false, normalRenders = 0;
  const direct = [], warnings = [];
  const clearColor = new THREE.Color('#123456'); let clearAlpha = .42, target = null;
  const renderer = {
    shadowMap: {}, capabilities: { maxSamples: 2 }, autoClear: true,
    getClearColor(out) { return out.copy(clearColor); }, getClearAlpha() { return clearAlpha; },
    setClearColor(value, alpha) { clearColor.set(value); if (alpha !== undefined) clearAlpha = alpha; },
    setClearAlpha(value) { clearAlpha = value; }, setRenderTarget(value) { target = value; }, clear() {},
    render(value) {
      if (value.overrideMaterial === ao.normalMaterial) {
        normalRenders++;
        assert.equal(background.visible, false); assert.equal(sky.visible, true);
        assert.equal(points.visible, false); assert.equal(line.visible, false); assert.equal(alreadyHidden.visible, false);
        if (throwInAO) throw new Error('Deliberate failure inside the normal pass');
      } else direct.push({ material: value.overrideMaterial, autoClear: this.autoClear,
        color: clearColor.getHexString(), alpha: clearAlpha, target, background: background.visible,
        points: points.visible, line: line.visible, hidden: alreadyHidden.visible });
    },
  };
  class Pass { enabled = true; setSize() {} dispose() {} }
  class AO extends Pass {
    constructor(scene, camera) {
      super(); this.scene = scene; this.camera = camera; this._visibilityCache = [];
      this._originalClearColor = new THREE.Color(); this.normalMaterial = new THREE.MeshNormalMaterial(); ao = this;
    }
    updateGtaoMaterial() {} updatePdMaterial() {}
    render(renderer) {
      GTAOPass.prototype._overrideVisibility.call(this);
      GTAOPass.prototype._renderOverride.call(this, renderer, this.normalMaterial, {}, 0x7777ff, 1);
      GTAOPass.prototype._restoreVisibility.call(this);
    }
    dispose() { this.normalMaterial.dispose(); }
  }
  class Composer {
    passes = [];
    constructor(_renderer, target) { this.renderTarget1 = target; }
    setPixelRatio() {} addPass(pass) { this.passes.push(pass); } setSize() {}
    render(delta) { this.passes.forEach(pass => { if (pass.enabled) pass.render?.(renderer, null, null, delta, false); }); }
    dispose() { this.renderTarget1.dispose(); }
  }
  const modules = {
    three: { ...THREE, PMREMGenerator: class { fromEquirectangular() { return { texture: new THREE.Texture(), dispose() {} }; } dispose() {} } },
    'three/addons/postprocessing/EffectComposer.js': { EffectComposer: Composer },
    'three/addons/postprocessing/RenderPass.js': { RenderPass: Pass },
    'three/addons/postprocessing/GTAOPass.js': { GTAOPass: AO },
    'three/addons/postprocessing/UnrealBloomPass.js': { UnrealBloomPass: Pass },
    'three/addons/postprocessing/OutputPass.js': { OutputPass: Pass },
    './lighting': { createSkyTexture: () => new THREE.Texture() },
  };
  const context = vm.createContext({ exports: {}, require(name) { assert.ok(name in modules); return modules[name]; },
    window: { devicePixelRatio: 1 }, console: { warn: message => warnings.push(message) } });
  vm.runInContext(source, context);
  const pipeline = context.exports.createStudyRenderer(renderer, scene, camera, false);
  pipeline.render(0);
  assert.equal(background.visible, true); assert.equal(points.visible, true); assert.equal(line.visible, true);
  assert.equal(alreadyHidden.visible, false); assert.equal(warnings.length, 0);
  const originalOverride = new THREE.MeshBasicMaterial(); scene.overrideMaterial = originalOverride;
  throwInAO = true; pipeline.render(.016);
  assert.equal(warnings.length, 1); assert.equal(normalRenders, 2); assert.equal(ao._visibilityCache.length, 0);
  assert.equal(direct.length, 1);
  assert.deepEqual(direct[0], { material: originalOverride, autoClear: true, color: '123456', alpha: .42,
    target: null, background: true, points: true, line: true, hidden: false });
  pipeline.render(.016);
  assert.equal(normalRenders, 2, 'Subsequent frames use the recovered direct scene.');
  assert.deepEqual(direct[1], direct[0]);
  pipeline.dispose(); originalOverride.dispose();
  scene.traverse(object => { if (object.geometry) object.geometry.dispose(); if (object.material) object.material.dispose(); });
});

test('the cloud clock freezes in place while reading or when the live motion preference changes', async () => {
  const h = await world();
  h.step(100);
  const first = h.lifecycle.landscapeTime;
  assert.ok(first > .04, 'Cloud drift uses real time even when physics limits its step');
  h.motionPreference.matches = true;
  h.step(120); assert.equal(h.lifecycle.landscapeTime, first);
  h.reader(true); h.motionPreference.matches = false;
  h.step(120); assert.equal(h.lifecycle.landscapeTime, first);
  h.reader(false); h.step(120);
  assert.ok(Math.abs(h.lifecycle.landscapeTime - first - .12) < 1e-6);
});

test('the entrance guide follows the opening and disappears five seconds later', async () => {
  const h = await world({ coarse: true });
  assert.equal(h.root.dataset.mode, 'exploring');
  assert.equal(h.controls.arrival.hidden, true);
  assert.equal(h.controls.hint.hidden, true);
  h.step(950);
  assert.equal(h.controls.hint.hidden, false);
  h.step(4999);
  assert.equal(h.controls.hint.hidden, false);
  h.step(1);
  assert.equal(h.controls.hint.hidden, true);
});
