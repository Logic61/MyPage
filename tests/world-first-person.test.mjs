import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInteractionPicker, movementDirection } from '../src/scripts/mountain-world/first-person.ts';

// The previous all-scene algorithm is a semantic oracle for the accelerated picker.
function referencePicker(roots, interactions) {
  const meshes = [], owner = new WeakMap(), ray = new THREE.Raycaster(), centre = new THREE.Vector2();
  roots.forEach(root => root.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); }));
  interactions.forEach(item => item.meshes.forEach(root => root.traverse(object => owner.set(object, item))));
  ray.near = .03; ray.far = Math.max(0, ...interactions.map(item => item.radius));
  return camera => {
    camera.updateMatrixWorld(); ray.setFromCamera(centre, camera);
    for (const hit of ray.intersectObjects(meshes, false)) {
      let visible = true;
      for (let p = hit.object; p; p = p.parent) if (!p.visible || p.userData.ignoreInteractionRay === true) visible = false;
      if (!visible) continue;
      const m = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material;
      if (!m?.visible || (m.transparent && m.opacity < .5)) continue;
      const item = owner.get(hit.object);
      return item && hit.distance <= item.radius ? item : null;
    }
    return null;
  };
}

function sceneWithBook() {
  const root = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(67, 1, 0.055, 100);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), new THREE.MeshStandardMaterial());
  book.position.z = -1.5; root.add(book);
  const item = { id: 'book', kind: 'books', position: book.position, approach: new THREE.Vector3(), radius: 2.1, label: '书', labelEn: 'Book', meshes: [book] };
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1), new THREE.MeshStandardMaterial());
  blocker.position.set(0, 0, -0.8); root.add(blocker);
  const picker = createInteractionPicker([root], [item]);
  const pick = () => { root.updateMatrixWorld(true); camera.updateMatrixWorld(true); return picker.pick(camera); };
  return { root, camera, book, blocker, item, pick };
}

test('a wall blocks an otherwise reachable book, and moving the wall reveals it', () => {
  const { blocker, item, pick } = sceneWithBook();
  assert.equal(pick(), null);
  blocker.position.x = 3;
  assert.equal(pick(), item);
});

test('a hidden parent does not occlude the ray, while an invisible book cannot be activated', () => {
  const { root, blocker, book, item, pick } = sceneWithBook();
  const hidden = new THREE.Group(); root.add(hidden); hidden.add(blocker); hidden.visible = false;
  assert.equal(pick(), item);
  const hiddenShelf = new THREE.Group(); root.add(hiddenShelf); hiddenShelf.add(book); hiddenShelf.visible = false;
  assert.equal(pick(), null);
});

test('mist is ignored but solid glass and out-of-reach objects still block interaction', () => {
  const { blocker, book, item, pick } = sceneWithBook();
  blocker.material.transparent = true; blocker.material.opacity = 0.12;
  assert.equal(pick(), item);
  blocker.material.opacity = 0.8;
  assert.equal(pick(), null);
  blocker.visible = false; book.position.z = -2.6;
  assert.equal(pick(), null);
});

test('turning away cannot activate a book that happens to remain nearby', () => {
  const { camera, blocker, item, pick } = sceneWithBook();
  blocker.visible = false;
  assert.equal(pick(), item);
  camera.rotation.y = Math.PI;
  assert.equal(pick(), null);
});

test('first-person movement follows camera yaw and diagonal input has no speed advantage', () => {
  const front = movementDirection(0, 1, 0);
  assert.deepEqual(front, { x: 0, z: -1 });
  const turn = movementDirection(Math.PI / 2, 1, 0);
  assert.ok(Math.abs(turn.x + 1) < 1e-12 && Math.abs(turn.z) < 1e-12);
  const diagonal = movementDirection(0, 1, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-12);
});

test('empty aim never runs detailed world occlusion, and a target limits the blocking segment', () => {
  const { root, camera, book, blocker, item } = sceneWithBook();
  blocker.position.z = -4;
  let calls = 0, maximumFar = 0;
  const original = blocker.raycast;
  blocker.raycast = function(ray, hits) { calls++; maximumFar = Math.max(maximumFar, ray.far); original.call(this, ray, hits); };
  const picker = createInteractionPicker([root], [item]);
  root.updateMatrixWorld(true);
  camera.rotation.y = Math.PI;
  assert.equal(picker.pick(camera), null);
  assert.equal(calls, 0);
  camera.rotation.y = 0;
  assert.equal(picker.pick(camera), item);
  assert.ok(calls > 0 && maximumFar < 1.5);
  book.visible = false; calls = 0;
  assert.equal(picker.pick(camera), null);
  assert.equal(calls, 0);
});

test('an out-of-reach target in front still blocks a farther target with a longer reach', () => {
  const { root, camera, book, blocker, item } = sceneWithBook();
  blocker.visible = false;
  const nearer = new THREE.Mesh(book.geometry, book.material);
  nearer.position.z = -1; root.add(nearer); root.updateMatrixWorld(true);
  const nearItem = { ...item, id: 'near', radius: .5, meshes: [nearer] };
  const picker = createInteractionPicker([root], [item, nearItem]);
  assert.equal(picker.pick(camera), null);
});

test('ignoreInteractionRay, layers, and exactly coplanar ordering preserve the original result', () => {
  const { root, camera, book, blocker, item } = sceneWithBook();
  blocker.userData.ignoreInteractionRay = true; root.updateMatrixWorld(true);
  assert.equal(createInteractionPicker([root], [item]).pick(camera), item);
  delete blocker.userData.ignoreInteractionRay; blocker.layers.set(1);
  assert.equal(createInteractionPicker([root], [item]).pick(camera), item);
  blocker.layers.set(0); blocker.position.z = book.position.z; root.updateMatrixWorld(true);
  // The book was added first: equal-distance hits keep that stable traversal order.
  assert.equal(createInteractionPicker([root], [item]).pick(camera), item);
  root.remove(book); root.add(book); root.updateMatrixWorld(true);
  assert.equal(createInteractionPicker([root], [item]).pick(camera), null);
});

test('dense transformed meshes, material groups, and draw ranges match exact all-scene picking', () => {
  const root = new THREE.Group(), camera = new THREE.PerspectiveCamera(67, 1, .055, 100);
  const shelf = new THREE.Group(); shelf.position.set(-.18, .12, -2.1); shelf.rotation.set(.08, .28, -.04); shelf.scale.set(-1.1, .9, 1.3); root.add(shelf);
  const geometry = new THREE.BoxGeometry(1.6, 1.8, .32, 18, 24, 8);
  const book = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })); shelf.add(book);
  const materials = Array.from({ length: 6 }, () => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
  materials[4].transparent = true; materials[4].opacity = .12;
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(.62, 1.6, .16, 12, 18, 4), materials);
  blocker.position.set(.22, 0, -1.1); blocker.rotation.y = -.2; root.add(blocker);
  const item = { id: 'dense', radius: 3.5, meshes: [shelf] };
  const picker = createInteractionPicker([root], [item]), reference = referencePicker([root], [item]);
  let hits = 0, misses = 0;
  for (const limitedRange of [false, true]) {
    geometry.setDrawRange(limitedRange ? 384 : 0, limitedRange ? geometry.index.count - 768 : Infinity);
    const saved = { ...geometry.drawRange };
    for (const visible of [true, false]) {
      blocker.visible = visible; root.updateMatrixWorld(true);
      for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) {
        camera.rotation.set(y * .09, x * .10, 0, 'YXZ');
        const expected = reference(camera), actual = picker.pick(camera);
        assert.equal(actual, expected, `range=${limitedRange}, visible=${visible}, yaw=${x}, pitch=${y}`);
        assert.deepEqual(geometry.drawRange, saved);
        if (actual) hits++; else misses++;
      }
    }
  }
  assert.ok(hits > 0 && misses > 0);
});

test('conservative chunks reduce triangle tests without approximating the selected surface', () => {
  const root = new THREE.Group(), camera = new THREE.PerspectiveCamera(67, 1, .055, 100);
  const geometry = new THREE.PlaneGeometry(4, 4, 64, 64);
  const book = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); book.position.z = -1.5; root.add(book); root.updateMatrixWorld(true);
  const item = { id: 'dense-plane', radius: 2.1, meshes: [book] };
  const picker = createInteractionPicker([root], [item]), reference = referencePicker([root], [item]);
  const original = THREE.Ray.prototype.intersectTriangle;
  let triangles = 0;
  THREE.Ray.prototype.intersectTriangle = function(...args) { triangles++; return original.apply(this, args); };
  try {
    assert.equal(reference(camera), item); const allSceneTriangles = triangles;
    triangles = 0; assert.equal(picker.pick(camera), item);
    assert.ok(triangles < allSceneTriangles / 8, `${triangles} versus ${allSceneTriangles} exact triangle tests`);
  } finally { THREE.Ray.prototype.intersectTriangle = original; }
  assert.deepEqual(geometry.drawRange, { start: 0, count: Infinity });
});

test('updated vertex buffers rebuild bounds and instanced targets retain exact transforms', () => {
  const root = new THREE.Group(), camera = new THREE.PerspectiveCamera(67, 1, .055, 100);
  const geometry = new THREE.PlaneGeometry(1.2, 1.2, 24, 24).toNonIndexed();
  const book = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
  book.position.z = -1.5; root.add(book); root.updateMatrixWorld(true);
  const item = { id: 'editable', radius: 3.5, meshes: [book] }, picker = createInteractionPicker([root], [item]);
  assert.equal(picker.pick(camera), item);
  geometry.translate(1.6, 0, 0);
  camera.lookAt(1.6, 0, -1.5);
  assert.equal(picker.pick(camera), item);
  book.visible = false;
  const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .8, .15, 12, 12, 4), book.material, 2);
  instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 0, -1));
  instances.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 0, -1.4));
  root.add(instances); root.updateMatrixWorld(true); camera.rotation.set(0, 0, 0);
  const instanceItem = { ...item, id: 'instanced', meshes: [instances] };
  assert.equal(createInteractionPicker([root], [instanceItem]).pick(camera), instanceItem);
});
