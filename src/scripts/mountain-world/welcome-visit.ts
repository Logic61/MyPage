const welcomeKey = 'mountain-first-person:welcome-seen';
let shownThisVisit = false;

export function hasSeenWelcome() {
  if (shownThisVisit) return true;
  try { if (localStorage.getItem(welcomeKey) === '1') return true; } catch {}
  try { return sessionStorage.getItem(welcomeKey) === '1'; } catch { return false; }
}

export function rememberWelcome() {
  shownThisVisit = true;
  try { localStorage.setItem(welcomeKey, '1'); return; } catch {}
  try { sessionStorage.setItem(welcomeKey, '1'); } catch {}
}

export function loadWelcomeImages(page: HTMLElement, priority: 'low' | 'auto' = 'auto') {
  for (const image of page.querySelectorAll<HTMLImageElement>('img[data-src]')) {
    image.fetchPriority = priority;
    image.src = image.dataset.src!;
    delete image.dataset.src;
  }
}
