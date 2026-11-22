interface Bookmark {
  id: string;
  block: number;
  fraction: number;
}

const key = (lang: string) => `shane-study:bookmark:${import.meta.env.BASE_URL}:${lang}`;

export function readBookmark(lang: string): Bookmark | null {
  try {
    const mark = JSON.parse(localStorage.getItem(key(lang)) || 'null');
    return mark && typeof mark.id === 'string' && Number.isInteger(mark.block) && mark.block >= -1
      && Number.isFinite(mark.fraction) && mark.fraction >= 0 && mark.fraction <= 1 ? mark : null;
  } catch { return null; }
}

export function keepPlace(body: HTMLElement) {
  const id = body.dataset.readingId;
  if (!id) return;
  const lang = document.documentElement.lang;
  const blocks = Array.from(body.children);
  const mark = location.hash === '#study-bookmark' ? readBookmark(lang) : null;
  let restoring = mark?.id === id && !!blocks[mark.block];
  let timer = 0;
  let wasVisible = !document.hidden;
  const readingLine = () => Math.min(innerHeight * .18, 120);
  const blockSpan = (index: number, rect: DOMRect) => {
    const next = blocks[index + 1];
    return next ? Math.max(rect.height, next.getBoundingClientRect().top - rect.top) : rect.height;
  };

  function save() {
    clearTimeout(timer);
    if (restoring || !wasVisible) return;
    const line = readingLine();
    let block = -1;
    for (let index = 0; index < blocks.length; index++) {
      const rect = blocks[index].getBoundingClientRect();
      if (rect.top > line) break;
      if (rect.height) block = index;
    }
    const rect = blocks[block]?.getBoundingClientRect();
    const fraction = rect ? Math.min(1, (line - rect.top) / blockSpan(block, rect)) : 0;
    try { localStorage.setItem(key(lang), JSON.stringify({id, block, fraction})); } catch {}
  }

  if (restoring && mark) {
    const cancel = () => { restoring = false; };
    const inputs = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
    for (const type of inputs) window.addEventListener(type, cancel, {passive: true});
    const restore = async () => {
      await document.fonts.ready;
      if (restoring) {
        const rect = blocks[mark.block].getBoundingClientRect();
        window.scrollBy({top: rect.top + blockSpan(mark.block, rect) * mark.fraction - readingLine(), behavior: 'instant'});
      }
      restoring = false;
      for (const type of inputs) window.removeEventListener(type, cancel);
      save();
    };
    if (document.readyState === 'complete') void restore();
    else window.addEventListener('load', restore, {once: true});
  } else save();

  window.addEventListener('scroll', () => {
    clearTimeout(timer);
    if (!document.hidden) timer = window.setTimeout(save, 240);
  }, {passive: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    wasVisible = !document.hidden;
    if (wasVisible) save();
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('pageshow', event => {
    if (event.persisted) { wasVisible = !document.hidden; save(); }
  });
}
