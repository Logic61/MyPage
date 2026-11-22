export interface PointerLockRequestOptions {
  /** Invoke the native API immediately; false means call it without raw-input options. */
  request: (raw: boolean) => void | Promise<void>;
  /** Whether the current page mode still permits this request to affect its input mode. */
  isActive: () => boolean;
  /** A confirmed failure of the current request; the caller can enable drag-to-look. */
  onFallback: () => void;
}

interface Attempt {
  generation: number;
  raw: boolean;
  transport: 'calling' | 'promise' | 'legacy';
  errorDuringCall: boolean;
}

/**
 * Coordinates Promise-returning and older event-only Pointer Lock implementations.
 *
 * Call start() directly from a user gesture, onError() from pointerlockerror, and
 * onLocked() whenever the canvas actually becomes document.pointerLockElement.
 * Call cancel() on pause, unlock, reading, or teardown. The caller owns the native
 * lock state: even a late successful lock must be released if its mode disallows it.
 *
 * No timers, synthetic gestures, or permission-error retries are used. Only a
 * raw request's named NotSupportedError permits one immediate ordinary retry.
 * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
 *
 * The 2.0 algorithm fires pointerlockerror BEFORE rejecting its Promise. Thus an
 * error event cannot terminate a Promise-backed attempt before its catch runs.
 * https://www.w3.org/TR/pointerlock/#dom-element-requestpointerlock
 */
export function createPointerLockRequest(options: PointerLockRequestOptions) {
  let generation = 0;
  let pending: Attempt | null = null;
  let locked = false;

  function current(attempt: Attempt) {
    return attempt.generation === generation && options.isActive();
  }

  function failed(attempt: Attempt, error?: unknown) {
    if (pending !== attempt) return;
    pending = null;
    if (!current(attempt)) return;

    const unsupported = typeof error === 'object' && error !== null
      && 'name' in error && error.name === 'NotSupportedError';
    if (attempt.raw && unsupported) {
      // Preserve this gesture's attempt; the browser still enforces activation.
      // NotAllowedError/SecurityError and generic legacy events never reach here.
      issue(attempt.generation, false);
    } else {
      options.onFallback();
    }
  }

  function issue(requestGeneration: number, raw: boolean) {
    const attempt: Attempt = {
      generation: requestGeneration, raw, transport: 'calling', errorDuringCall: false,
    };
    pending = attempt;
    let result: void | Promise<void>;
    try {
      result = options.request(raw);
    } catch (error) {
      failed(attempt, error);
      return;
    }

    if (result && typeof result.then === 'function') {
      attempt.transport = 'promise';
      // Runtime detection is necessary even when lib.dom declares Promise<void>.
      // Promise.resolve also handles a Promise from another realm.
      void Promise.resolve(result).then(() => {
        if (pending !== attempt) return;
        pending = null;
        if (current(attempt)) locked = true;
      }, error => failed(attempt, error));
    } else {
      attempt.transport = 'legacy';
      // Undefined means "wait for an event", not success and not unsupported raw input.
      if (attempt.errorDuringCall) failed(attempt);
    }
  }

  return {
    start() {
      if (!options.isActive() || locked || pending) return;
      issue(++generation, true);
    },
    onError() {
      const attempt = pending;
      if (!attempt) return;
      if (attempt.transport === 'calling') attempt.errorDuringCall = true;
      else if (attempt.transport === 'legacy') failed(attempt);
      // Promise requests are classified by their own rejection, not this generic event.
    },
    cancel() {
      generation++;
      locked = false;
      // Keep a cancelled native request until it settles. Legacy events have no
      // request ID: starting another native request now would misattribute old errors.
    },
    onLocked() {
      generation++;
      pending = null;
      locked = true;
    },
  };
}
