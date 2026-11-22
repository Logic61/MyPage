import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInteractionPicker, movementDirection } from '../src/scripts/mountain-world/first-person.ts';

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
