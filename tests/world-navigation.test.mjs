import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation } from '../src/scripts/mountain-world/navigation.ts';

test('click-to-walk routes around a solid obstacle with body clearance', () => {
  const nav = createNavigation([{ x: 0, z: 0, halfX: 8, halfZ: 8 }], [{ x: 0, z: 0, halfX: 3, halfZ: 1 }]);
  const start = { x: 0, z: 4 }, end = { x: 0, z: -4 };
  const path = nav.findPath(start, end);
  assert.ok(path.length > 1);
  let previous = start;
  for (const point of path) { assert.ok(nav.clearLine(previous, point)); previous = point; }
  assert.ok(Math.hypot(previous.x - end.x, previous.z - end.z) < 0.01);
});

test('a long movement cannot pass through a wall or off the ledge', () => {
  const nav = createNavigation([{ x: 0, z: 0, halfX: 8, halfZ: 8 }], [{ x: 0, z: 0, halfX: 3, halfZ: 1 }]);
  assert.ok(nav.move({ x: 0, z: 2 }, 0, -5).z > 1.3);
  assert.equal(nav.canWalk(7.9, 0), false);
  assert.equal(nav.canWalk(5, 0), true);
  assert.equal(nav.canWalk(NaN, 0), false);
});

test('a narrow doorway connects two rooms without corner cutting', () => {
  const nav = createNavigation([{ x: 0, z: 0, halfX: 6, halfZ: 6 }], [
    { x: -3.5, z: 0, halfX: 2.5, halfZ: 0.4 },
    { x: 3.5, z: 0, halfX: 2.5, halfZ: 0.4 },
  ]);
  const start = { x: -4, z: 3 }, end = { x: 4, z: -3 };
  const path = nav.findPath(start, end);
  assert.ok(path.length > 0);
  let previous = start;
  for (const point of path) { assert.ok(nav.clearLine(previous, point)); previous = point; }
});

test('unreachable destinations do not move the visitor through a wall', () => {
  const nav = createNavigation([{ x: 0, z: 0, halfX: 6, halfZ: 6 }], [{ x: 0, z: 0, halfX: 0.2, halfZ: 7 }]);
  assert.deepEqual(nav.findPath({ x: -3, z: 0 }, { x: 3, z: 0 }), []);
});

test('walking crosses former route boundaries, clearing a real cliff but respecting solid posts', () => {
  const nav = createNavigation([{x:0,z:0,halfX:1,halfZ:1}], [{x:2,z:0,halfX:.2,halfZ:.2}], .25,
    [[-3,-3],[3,-3],[3,3],[-3,3]]);
  assert.equal(nav.canWalk(2,1),true);
  assert.ok(nav.move({x:1,z:0},2,0,true).x < 2);
  const beyond = nav.move({x:2,z:1},2,0,true);
  assert.equal(nav.hasFloor(beyond.x,beyond.z),false);
  assert.equal(nav.clearLine({x:2,z:1},beyond),false);
});
