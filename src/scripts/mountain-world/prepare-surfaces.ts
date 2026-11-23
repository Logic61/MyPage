import type { PreparedSurfaces } from './surface-pixels';

/** Start during the engine download. Unsupported workers use the same generator in the library. */
export function prepareSurfacePixels(signal: AbortSignal): Promise<PreparedSurfaces | undefined> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(undefined); return; }
    let worker: Worker;
    try {
      worker = new Worker(new URL('./surface-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(undefined);
      return;
    }
    function finish(maps?: PreparedSurfaces) {
      window.removeEventListener('pagehide', onHide);
      signal.removeEventListener('abort', cancel);
      worker.terminate();
      resolve(maps);
    }
    function cancel() { finish(); }
    function onHide(event: PageTransitionEvent) {
      if (!event.persisted) finish();
    }
    worker.onmessage = (event: MessageEvent<PreparedSurfaces>) => finish(event.data);
    worker.onerror = () => finish();
    worker.onmessageerror = () => finish();
    window.addEventListener('pagehide', onHide);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
