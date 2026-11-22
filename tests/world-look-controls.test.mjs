import test from 'node:test';
import assert from 'node:assert/strict';
import { LookController, DragLookGesture, StanceTransition, pointerToNDC } from '../src/scripts/mountain-world/look-controls.ts';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test('free-pointer picking uses the displayed canvas rectangle and rejects positions outside it', () => {
  const rect = { left: 120, top: 80, width: 960, height: 540 };
  assert.deepEqual(pointerToNDC(600, 350, rect), { x: 0, y: 0 });
  assert.deepEqual(pointerToNDC(840, 215, rect), { x: .5, y: .5 });
  assert.deepEqual(pointerToNDC(120, 620, rect), { x: -1, y: -1 });
  for (const [x, y] of [[119, 350], [1081, 350], [600, 79], [600, 621], [NaN, 350]]) {
    assert.equal(pointerToNDC(x, y, rect), null);
  }
  assert.equal(pointerToNDC(600, 350, { ...rect, width: 0 }), null);
  // Render resolution / device pixel ratio never enter this conversion.
  assert.deepEqual(pointerToNDC(840, 215, { ...rect, width: 1920 }), { x: -.25, y: .5 });
});

test('equal mouse distance produces equal turns at different frame and polling rates', () => {
  for (const [frames, polls] of [[30, 125], [60, 1000], [144, 500], [240, 1000]]) {
    const look = new LookController(0, 0);
    look.begin('locked', 0);
    let event = 1;
    for (let frame = 1; frame <= frames * 2; frame++) {
      const now = frame / frames * 1000;
      while (event <= polls && event / polls * 1000 <= now + 1e-7) {
        const time = event / polls * 1000;
        assert.equal(look.sample('locked', 600 / polls, 0, time, time, 1), true);
        event++;
      }
      look.advance(1 / frames);
    }
    close(look.yaw, -600 * 0.0021);
  }
});

test('mouse response is monotonic and settles quickly without overshoot', () => {
  const look = new LookController(0, 0);
  look.begin('locked', 0);
  look.sample('locked', 100, 0, 10, 10, 1);
  look.advance(1 / 60);
  assert.ok(look.yaw < -0.15 && look.yaw > -0.21);
  const first = look.yaw;
  look.advance(1 / 60);
  assert.ok(look.yaw < first && look.yaw > -0.21);
  assert.ok(Math.abs(look.yaw + 0.21) < 0.014);
});

test('a sequence of one-pixel moves is a drag, even after returning to its starting point', () => {
  const drag = new DragLookGesture(1, 30, 40, 'drag');
  const look = new LookController(0, 0);
  look.begin('drag', 0);
  for (let step = 1; step <= 120; step++) {
    const { dx, dy } = drag.move(30 + step, 40);
    look.sample(drag.source, dx, dy, step, step, 1);
  }
  assert.equal(drag.moved, true, 'releasing this gesture must not activate an object');
  look.end('drag');
  look.advance(0.5);
  close(look.yaw, -120 * 0.0021);
  drag.move(30, 40);
  assert.equal(drag.moved, true);
  const tap = new DragLookGesture(2, 30, 40, 'drag');
  tap.move(31, 40);
  assert.equal(tap.moved, false);
});

test('releasing a short flick before the next frame keeps the final motion', () => {
  const look = new LookController(0, 0);
  look.begin('drag', 0);
  look.sample('drag', 80, -20, 6, 6, 1);
  look.end('drag');
  look.advance(0.5);
  close(look.yaw, -0.168); close(look.pitch, 0.042);
});

test('lock handoff ignores a recenter-sized first sample and stale or invalid input', () => {
  const look = new LookController(0, 0);
  look.begin('locked', 100);
  assert.equal(look.sample('locked', 800, 0, 104, 104, 1), false);
  assert.equal(look.sample('locked', 20, 0, 90, 105, 1), false);
  assert.equal(look.sample('locked', 20, 0, 105, 250, 1), false);
  assert.equal(look.sample('locked', NaN, 0, 251, 251, 1), false);
  assert.equal(look.sample('locked', 20, 0, 252, 252, 1), true);
  assert.equal(look.sample('locked', 10, 0, 251, 253, 1), false);
  look.advance(0.5);
  close(look.yaw, -0.042);
});

test('ordinary fast sweeps retain their full distance and direction beyond half a turn', () => {
  const look = new LookController(0, 0);
  look.begin('locked', 0);
  look.sample('locked', 10, 0, 1, 1, 1);
  look.sample('locked', 2000, 0, 15, 15, 1);
  look.advance(0.5);
  close(look.yaw, -2010 * 0.0021);
  assert.ok(look.yaw < -Math.PI);
});

test('locked and dragging input cannot both control the same session', () => {
  const look = new LookController(0, 0);
  look.begin('drag', 0);
  look.begin('locked', 10);
  assert.equal(look.sample('drag', 20, 0, 11, 11, 1), false);
  assert.equal(look.sample('locked', 20, 0, 11, 11, 1), true);
  look.advance(0.5);
  close(look.yaw, -0.042);
});

test('pause discards queued movement so resuming does not continue an old turn', () => {
  const look = new LookController(0, 0);
  look.begin('locked', 0);
  look.sample('locked', 100, 0, 5, 5, 1);
  look.advance(1 / 144);
  const pausedYaw = look.yaw;
  look.suspend();
  assert.equal(look.sample('locked', 100, 0, 10, 10, 1), false);
  look.begin('locked', 1000);
  look.advance(0.5);
  close(look.yaw, pausedYaw);
});

test('automatic turns cross the yaw seam by the shortest arc with a bounded first step', () => {
  const look = new LookController(Math.PI - 0.04, 0);
  const initial = look.yaw;
  look.turnTo(-Math.PI + 0.04, -0.6);
  assert.equal(look.yaw, initial, 'requesting a turn must not immediately move the camera');
  look.advance(1 / 60);
  assert.ok(look.yaw > initial && look.yaw - initial < 0.04);
  assert.ok(Math.abs(look.pitch) <= 2.6 / 60);
  for (let i = 0; i < 120; i++) look.advance(1 / 60);
  close(look.yaw, Math.PI + 0.04, 1e-6);
  close(look.pitch, -0.6, 1e-6);
});

test('even one pixel of manual input immediately takes over an automatic turn', () => {
  const look = new LookController(0, 0);
  look.begin('locked', 0);
  look.turnTo(Math.PI, -0.6);
  look.advance(1 / 60);
  const displayedYaw = look.yaw, displayedPitch = look.pitch;
  assert.equal(look.sample('locked', 1, 0, 17, 17, 1), true);
  look.advance(0.5);
  close(look.yaw, displayedYaw - 0.0021);
  close(look.pitch, displayedPitch);
});

test('looking away from a pitch limit responds immediately without hidden overshoot', () => {
  const look = new LookController(0, 0);
  look.begin('locked', 0);
  look.sample('locked', 0, -1000, 100, 100, 1);
  look.advance(0.5);
  close(look.pitch, 1.4);
  look.sample('locked', 0, 20, 110, 110, 1);
  look.advance(0.5);
  close(look.pitch, 1.4 - 0.042);
});

test('sitting and an interrupted stand-up preserve the currently displayed position', () => {
  const transition = new StanceTransition(0.3);
  const standing = { x: 10, y: 1.98, z: 3.65 }, seated = { x: 10, y: 1.58, z: 4.88 };
  transition.rebase(standing, seated);
  assert.deepEqual(transition.apply(seated, 0), standing);
  const first = transition.apply(seated, 1 / 60);
  assert.ok(first.z > standing.z && first.z - standing.z < 0.02);
  transition.rebase(first, standing);
  assert.deepEqual(transition.apply(standing, 0), first);
  assert.deepEqual(transition.apply(standing, 0.3), standing);
  const walk = { x: 10.1, y: 1.98, z: 3.5 };
  assert.deepEqual(transition.apply(walk, 1 / 60), walk, 'normal walking has no extra positional lag');
});
