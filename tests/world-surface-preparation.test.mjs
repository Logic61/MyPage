import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSurfacePixels } from '../src/scripts/mountain-world/prepare-surfaces.ts';

test('courtyard textures transfer once and release the worker on completion, failure or early exit', async t => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  let worker;
  class TestWorker {
    stops = 0;
    constructor() { worker = this; }
    terminate() { this.stops++; }
  }
  globalThis.window = new EventTarget();
  globalThis.Worker = TestWorker;
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
    if (previousWorker) Object.defineProperty(globalThis, 'Worker', previousWorker);
    else delete globalThis.Worker;
  });

  const visit = new AbortController();
  const prepared = prepareSurfacePixels(visit.signal);
  const returned = new Map();
  worker.onmessage({ data: returned });
  assert.equal(await prepared, returned);
  visit.abort();
  assert.equal(worker.stops, 1);

  const failed = prepareSurfacePixels(new AbortController().signal);
  worker.onerror();
  assert.equal(await failed, undefined);
  assert.equal(worker.stops, 1);

  const noRenderer = new AbortController();
  const pending = prepareSurfacePixels(noRenderer.signal);
  noRenderer.abort();
  assert.equal(await pending, undefined);
  assert.equal(worker.stops, 1);

  delete globalThis.Worker;
  assert.equal(await prepareSurfacePixels(new AbortController().signal), undefined);
});
