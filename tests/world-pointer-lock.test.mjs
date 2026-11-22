import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createPointerLockRequest } from '../src/scripts/mountain-world/pointer-lock.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(request) {
  const calls = [];
  let active = true, fallbacks = 0;
  const controller = createPointerLockRequest({
    request: raw => { calls.push(raw); return request(raw, calls.length); },
    isActive: () => active,
    onFallback: () => fallbacks++,
  });
  return { controller, calls, setActive: value => { active = value; }, fallbackCount: () => fallbacks };
}

const failure = name => new DOMException('Pointer lock request failed', name);

test('the error event before a raw Promise rejection preserves the ordinary-input retry', async () => {
  const raw = deferred(), ordinary = deferred();
  const h = harness(wantsRaw => wantsRaw ? raw.promise : ordinary.promise);
  h.controller.start();
  h.controller.onError();
  assert.equal(h.fallbackCount(), 0);
  assert.deepEqual(h.calls, [true]);

  raw.reject(failure('NotSupportedError'));
  await nextTurn();
  assert.deepEqual(h.calls, [true, false]);
  assert.equal(h.fallbackCount(), 0);

  h.controller.onLocked();
  ordinary.resolve();
  await nextTurn();
  h.controller.onError();
  h.controller.start();
  assert.deepEqual(h.calls, [true, false]);
  assert.equal(h.fallbackCount(), 0);
});

test('a confirmed ordinary-request failure falls back once without an endless raw retry', async () => {
  const h = harness(() => Promise.reject(failure('NotSupportedError')));
  h.controller.start();
  await nextTurn();
  h.controller.onError();
  assert.deepEqual(h.calls, [true, false]);
  assert.equal(h.fallbackCount(), 1);
});

test('permission, activation, focus, and document errors never trigger an ordinary retry', async t => {
  for (const name of ['NotAllowedError', 'SecurityError', 'WrongDocumentError', 'InvalidStateError']) {
    await t.test(name, async () => {
      const pending = deferred();
      const h = harness(() => pending.promise);
      h.controller.start(); h.controller.onError();
      assert.equal(h.fallbackCount(), 0);
      pending.reject(failure(name));
      await nextTurn();
      assert.deepEqual(h.calls, [true]);
      assert.equal(h.fallbackCount(), 1);
    });
  }
});

test('an event-only return waits for lock success and ignores later unrelated errors', () => {
  const h = harness(() => undefined);
  h.controller.start(); h.controller.start();
  assert.deepEqual(h.calls, [true]);
  assert.equal(h.fallbackCount(), 0);
  h.controller.onLocked();
  h.controller.onError(); h.controller.start();
  assert.deepEqual(h.calls, [true]);
  assert.equal(h.fallbackCount(), 0);
});

test('a generic legacy error is terminal without guessing that raw input was unsupported', () => {
  const h = harness(() => undefined);
  h.controller.start(); h.controller.onError(); h.controller.onError();
  assert.deepEqual(h.calls, [true]);
  assert.equal(h.fallbackCount(), 1);
});

test('rapid clicks do not queue competing native Promise requests', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  h.controller.start(); h.controller.start(); h.controller.start();
  assert.deepEqual(h.calls, [true]);
  pending.resolve();
  await nextTurn();
  h.controller.start();
  assert.deepEqual(h.calls, [true]);
});

test('a cancelled Promise cannot retry or change input mode, and a fresh gesture can start later', async () => {
  const first = deferred(), second = deferred();
  const h = harness((_raw, number) => number === 1 ? first.promise : second.promise);
  h.controller.start(); h.controller.cancel();
  first.reject(failure('NotSupportedError'));
  await nextTurn();
  assert.equal(h.fallbackCount(), 0);
  assert.deepEqual(h.calls, [true]);

  h.controller.start();
  assert.deepEqual(h.calls, [true, true]);
  h.controller.onLocked(); second.resolve();
  await nextTurn();
  assert.equal(h.fallbackCount(), 0);
});

test('a cancelled event-only request stays ignored unless a new gesture renews it', () => {
  const h = harness(() => undefined);
  h.controller.start(); h.controller.cancel();
  assert.deepEqual(h.calls, [true]);
  h.controller.onError();
  assert.equal(h.fallbackCount(), 0);
  h.controller.start();
  assert.deepEqual(h.calls, [true, true]);
  h.controller.onError();
  assert.equal(h.fallbackCount(), 1);
});

test('an explicit resume while a Promise is pending reaches fallback instead of waiting forever', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  h.controller.start(); h.controller.cancel(); h.controller.start();
  assert.deepEqual(h.calls, [true], 'Renew intent without overlapping native requests.');
  h.controller.onError();
  assert.equal(h.fallbackCount(), 0, 'The generic event must still wait for its Promise.');
  pending.reject(failure('NotAllowedError'));
  await nextTurn();
  assert.equal(h.fallbackCount(), 1);
  assert.deepEqual(h.calls, [true], 'An activation failure never causes a retry.');
});

test('an explicit resume renews an event-only request without misattributing another request', () => {
  const h = harness(() => undefined);
  h.controller.start(); h.controller.cancel(); h.controller.start();
  assert.deepEqual(h.calls, [true]);
  h.controller.onError();
  assert.equal(h.fallbackCount(), 1);
  h.controller.start(); h.controller.onLocked();
  assert.deepEqual(h.calls, [true, true]);
  assert.equal(h.fallbackCount(), 1);
});

test('cancelling a renewed request again prevents its late retry and fallback', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  h.controller.start(); h.controller.cancel(); h.controller.start(); h.controller.cancel();
  pending.reject(failure('NotSupportedError'));
  await nextTurn();
  assert.deepEqual(h.calls, [true]);
  assert.equal(h.fallbackCount(), 0);
});

test('lockchange is authoritative even if an old Promise rejects after a new request starts', async () => {
  const old = deferred(), fresh = deferred();
  const h = harness((_raw, number) => number === 1 ? old.promise : fresh.promise);
  h.controller.start(); h.controller.onLocked(); h.controller.cancel(); h.controller.start();
  old.reject(failure('NotSupportedError'));
  await nextTurn();
  assert.deepEqual(h.calls, [true, true]);
  assert.equal(h.fallbackCount(), 0);
  fresh.reject(failure('NotAllowedError'));
  await nextTurn();
  assert.equal(h.fallbackCount(), 1);
});

test('inactive modes neither start a request nor react to a pending failure', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  h.setActive(false); h.controller.start();
  assert.deepEqual(h.calls, []);
  h.setActive(true); h.controller.start(); h.setActive(false);
  pending.reject(failure('NotSupportedError'));
  await nextTurn();
  assert.deepEqual(h.calls, [true]);
  assert.equal(h.fallbackCount(), 0);
});

test('a synchronous named raw-input error gets one synchronous ordinary attempt', () => {
  const h = harness(raw => { if (raw) throw failure('NotSupportedError'); });
  h.controller.start();
  assert.deepEqual(h.calls, [true, false]);
  assert.equal(h.fallbackCount(), 0);
  h.controller.onLocked();
  assert.equal(h.fallbackCount(), 0);
});

test('a synchronous activation error is not retried or postponed to manufacture a gesture', () => {
  const h = harness(() => { throw failure('NotAllowedError'); });
  h.controller.start();
  assert.deepEqual(h.calls, [true]);
  assert.equal(h.fallbackCount(), 1);
});
