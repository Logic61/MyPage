type Section = 'blog' | 'projects' | 'cv' | 'map';
interface ReadingOptions {
  entry?: HTMLAnchorElement;
  anchor?: string;
  catalogue?: boolean;
  fromHistory?: boolean;
}
interface FolioOptions {
  isEn: boolean;
  prefix: string;
  signal: AbortSignal;
  getPose: () => { x: number; z: number; yaw: number } | null;
  onReadingChange: (open: boolean) => void;
}

const fragments = { blog: '.article-body', projects: '.project-list', cv: '.cv-document' } as const;

function pathKey(url: URL) {
  try { return decodeURIComponent(url.pathname).replace(/\/+$/, ''); }
  catch { return url.pathname; }
}

function sanitizeContent(container: Element, pageURL: URL) {
  container.querySelectorAll('script,style,link,base,iframe,object,embed,form,.article-return-links,.mobile-toc,.study-prelude,.study-return,.project-index,.workbench-directory').forEach(element => element.remove());
  container.querySelectorAll<HTMLElement>('*').forEach(element => {
    [...element.attributes].forEach(attribute => {
      if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc') element.removeAttribute(attribute.name);
    });
    for (const attribute of ['href', 'src', 'poster', 'xlink:href']) {
      const value = element.getAttribute(attribute);
      if (!value || value.startsWith('#') || (attribute !== 'href' && value.startsWith('data:image/'))) continue;
      try {
        const url = new URL(value, pageURL);
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) element.removeAttribute(attribute);
        else element.setAttribute(attribute, url.href);
      } catch { element.removeAttribute(attribute); }
    }
    const srcset = element.getAttribute('srcset');
    if (srcset) {
      const resolved = srcset.split(',').map(part => {
        const [url, ...size] = part.trim().split(/\s+/);
        try { return `${new URL(url, pageURL).href} ${size.join(' ')}`.trim(); } catch { return ''; }
      }).filter(Boolean).join(', ');
      element.setAttribute('srcset', resolved);
    }
    if (element instanceof HTMLAnchorElement && element.target === '_blank') element.rel = 'noopener noreferrer';
  });
}

async function readManuscript(section: keyof typeof fragments, url: URL, signal: AbortSignal, manuscript?: string, priority: RequestPriority = 'high') {
  const response = await fetch(manuscript || url, { signal, credentials: 'same-origin', priority });
  if (!response.ok) throw new Error('Unavailable manuscript');
  const html = await response.text();
  signal.throwIfAborted();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const content = doc.querySelector(fragments[section]);
  if (!content) throw new Error('Missing manuscript');
  if (!(manuscript && new URL(response.url).origin === location.origin && content.getAttribute('data-folio-ready') === '1')) {
    for (const use of content.querySelectorAll('svg[data-icon] use[href^="#"]')) {
      const symbol = doc.getElementById(use.getAttribute('href')!.slice(1));
      if (symbol && !content.contains(symbol) && !content.querySelector(`[id="${CSS.escape(symbol.id)}"]`)) use.before(symbol.cloneNode(true));
    }
    sanitizeContent(content, url);
  }
  content.removeAttribute('class');
  return content;
}

/** The Meridian folio keeps the index, each manuscript and the visitor's place independent. */
export function createFolio(dialog: HTMLDialogElement, options: FolioOptions) {
  const { signal, prefix } = options;
  const t = (zh: string, en: string) => options.isEn ? en : zh;
  const el = <T extends Element = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const reading = el('#folio-reading'), body = el('#folio-body'), manuscript = el('.manuscript');
  const documentPane = el('#folio-document'), mapPane = el('#folio-map'), status = el('[data-reader-status]');
  const search = el<HTMLInputElement>('#find-writing'), category = el<HTMLSelectElement>('#category');
  const contents = el<HTMLButtonElement>('#show-contents'), closeButton = el<HTMLButtonElement>('#close');
  const original = el<HTMLAnchorElement>('[data-reader-original]');
  const rows = [...dialog.querySelectorAll<HTMLAnchorElement>('[data-world-article]')];
  const byPath = new Map(rows.map(row => [pathKey(new URL(row.href)), row]));
  for (const row of rows) if (row.dataset.alias) byPath.set(pathKey(new URL(row.dataset.alias, location.href)), row);
  const positions = new Map<string, number>(), cache = new Map<string, Element>();
  const pending = new Map<string, { controller: AbortController; result: Promise<Element> }>();
  let selected = rows[0], activeKey = '', loaded = false;
  let view = 0, hoverTimer: number | undefined, opener: HTMLElement | null = null;

  function stopOtherRequests(keep?: string) {
    window.clearTimeout(hoverTimer);
    for (const [key, request] of pending) {
      if (key === keep) continue;
      request.controller.abort();
      pending.delete(key);
    }
  }
  function obtain(section: keyof typeof fragments, url: URL, fragment?: string, priority: RequestPriority = 'high') {
    const key = pathKey(url), existing = pending.get(key);
    if (existing) return existing.result;
    const controller = new AbortController();
    const result = readManuscript(section, url, controller.signal, fragment, priority).catch(error => {
      if (!fragment || controller.signal.aborted) throw error;
      return readManuscript(section, url, controller.signal, undefined, priority);
    }).then(content => {
      controller.signal.throwIfAborted();
      cache.set(key, content);
      if (cache.size > 3) cache.delete(cache.keys().next().value!);
      return content;
    }).finally(() => {
      if (pending.get(key)?.controller === controller) pending.delete(key);
    });
    pending.set(key, { controller, result });
    return result;
  }
  function prefetch(row?: HTMLAnchorElement) {
    if (!row || signal.aborted || (navigator as Navigator & { connection?: { saveData: boolean } }).connection?.saveData) return;
    const url = new URL(row.href), key = pathKey(url);
    // Keep a visitor's in-progress read ahead of any speculative request.
    if (cache.has(key) || pending.has(key) || (dialog.open && !loaded)) return;
    stopOtherRequests();
    void obtain('blog', url, row.dataset.manuscript, 'low').catch(() => {});
  }

  function catalogue(open: boolean, focus = false) {
    manuscript.dataset.catalogue = open ? 'open' : 'closed';
    contents.setAttribute('aria-expanded', String(open));
    if (focus) (open ? search : reading).focus({ preventScroll: true });
  }
  function filter() {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    rows.forEach((row) => {
      const text = [row.textContent, row.dataset.description, row.dataset.category].join(' ').toLocaleLowerCase();
      const visible = (!category.value || row.dataset.category === category.value) && text.includes(query);
      row.parentElement!.hidden = !visible;
      if (visible) count++;
    });
    el('[data-world-empty]').hidden = count !== 0;
    el('[data-world-count]').textContent = t(`共 ${count} 篇`, `${count} ${count === 1 ? 'page' : 'pages'}`);
  }
  function remember() { if (activeKey && loaded) positions.set(activeKey, reading.scrollTop); }
  function jump(hash?: string) {
    if (!hash) return;
    try {
      const id = decodeURIComponent(hash.replace(/^#/, ''));
      const entry = body.querySelector(`[id="${CSS.escape(id)}"]`);
      if (entry) reading.scrollTop += entry.getBoundingClientRect().top - reading.getBoundingClientRect().top - 20;
    } catch { /* Malformed author anchors do not interrupt reading. */ }
  }
  function neighbours() {
    const entries = rows;
    const index = entries.indexOf(selected), previous = entries[index - 1], next = entries[index + 1];
    for (const [id, target, label] of [['#newer', previous, t('上一篇','Newer')], ['#older', next, t('下一篇','Older')]] as const) {
      const button = el<HTMLButtonElement>(id);
      button.hidden = !target;
      button.textContent = target ? label + ' · ' + target.textContent!.trim() : '';
      button.onclick = target ? () => { void show('blog', { entry: target }); reading.focus({ preventScroll: true }); } : null;
    }
    el('#reading-neighbours').hidden = !previous && !next;
  }
  function setAddress(section: Section, opening: boolean) {
    const hash = '#folio/' + section + (section === 'blog' ? '/' + encodeURIComponent(selected.dataset.slug!) : '');
    if (hash === location.hash) return;
    try {
      if (opening) history.pushState({ ...history.state, courtFolio: true }, '', hash);
      else history.replaceState(history.state, '', hash);
    } catch { /* The reader also works without the History API. */ }
  }
  async function show(section: Section, opts: ReadingOptions = {}) {
    if (section === 'blog') {
      if (opts.entry) selected = opts.entry;
      if (!selected) section = 'map';
      el('[data-catalogue-title]').textContent = t('藏书目录', 'Contents');
    }
    const opening = !dialog.open;
    if (opening) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      options.onReadingChange(true);
      closeButton.focus({ preventScroll: true });
    }
    if (!opts.fromHistory) setAddress(section, opening);
    catalogue(Boolean(opts.catalogue));
    const url = new URL(section === 'blog' ? selected.href : `${prefix}/${section}/`, location.href);
    const key = pathKey(url);
    dialog.dataset.tab = section;
    for (const tab of dialog.querySelectorAll<HTMLElement>('.folio-bar [data-section-link]')) {
      if (tab.dataset.sectionLink === section) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    if (section === 'map') {
      const pose = options.getPose(), marker = el<SVGElement>('#map-player');
      marker.style.display = pose ? '' : 'none';
      if (pose) marker.setAttribute('transform', `translate(${pose.x} ${pose.z}) rotate(${-pose.yaw * 180 / Math.PI}) scale(.17)`);
    }
    if (activeKey === key && loaded) {
      if (opening) reading.scrollTop = positions.get(key) ?? reading.scrollTop;
      if (section === 'blog') neighbours();
      jump(opts.anchor);
      return;
    }
    remember();
    const currentView = ++view;
    stopOtherRequests(key);
    activeKey = key; loaded = false;
    reading.scrollTop = 0;
    documentPane.hidden = section === 'map'; mapPane.hidden = section !== 'map';
    body.replaceChildren(); status.hidden = true;
    el('#reading-neighbours').hidden = true;
    if (section === 'map') { loaded = true; reading.removeAttribute('aria-busy'); return; }

    const blog = section === 'blog';
    el('#rubric').textContent = blog ? selected.dataset.category! : section === 'cv' ? t('北厅东壁','North hall') : t('工作案','The workbench');
    el('#reading-title').textContent = blog ? selected.textContent!.trim() : section === 'cv' ? t('简历','CV') : t('项目','Projects');
    el('#byline').textContent = blog ? [selected.dataset.author, selected.dataset.date].filter(Boolean).join('  ·  ') : '';
    if (blog) for (const row of rows) {
      if (row === selected) row.setAttribute('aria-current','page'); else row.removeAttribute('aria-current');
    }
    original.href = url.href;
    reading.setAttribute('aria-busy','true');
    const cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); }
    const showStatus = cached ? undefined : window.setTimeout(() => {
      if (view !== currentView || !dialog.open) return;
      status.textContent = t('正在展开手稿…','Unrolling the manuscript…'); status.hidden = false;
    }, 150);
    try {
      const content = cached ?? await obtain(section, url, blog ? selected.dataset.manuscript : undefined);
      if (currentView !== view || !dialog.open) return;
      body.replaceChildren(content); status.hidden = true;
      if (blog) neighbours();
      loaded = true;
      reading.scrollTop = positions.get(key) ?? 0;
      jump(opts.anchor);
    } catch {
      if (currentView !== view || !dialog.open) return;
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = t('重新展开','Try again');
      retry.onclick = () => void show(section, opts);
      status.replaceChildren(document.createTextNode(t('这份手稿暂时没有载入。','This manuscript could not be loaded. ')), retry);
      status.hidden = false;
    } finally {
      window.clearTimeout(showStatus);
      if (currentView === view) reading.removeAttribute('aria-busy');
    }
  }
  function close() {
    if (dialog.open) { remember(); dialog.close(); }
  }
  function fromAddress() {
    const match = location.hash.match(/^#folio\/(blog|projects|cv|map)(?:\/(.*))?$/);
    if (!match) { close(); return; }
    let slug = '';
    try { slug = decodeURIComponent(match[2] || ''); } catch { /* Start at the last selected writing. */ }
    void show(match[1] as Section, { entry: rows.find(row => row.dataset.slug === slug), fromHistory: true });
  }
  dialog.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
      return;
    }
    const tab = event.target.closest<HTMLElement>('[data-section-link]');
    if (tab) { event.preventDefault(); void show(tab.dataset.sectionLink as Section); return; }
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const href = link.getAttribute('href')!;
    if (body.contains(link) && href.startsWith('#')) { event.preventDefault(); jump(href); return; }
    const target = new URL(link.href);
    if (target.origin !== location.origin) return;
    const entry = byPath.get(pathKey(target));
    if (entry) {
      event.preventDefault();
      void show('blog', { entry, anchor: target.hash });
      reading.focus({ preventScroll: true });
    } else if (body.contains(link)) {
      const section = (['blog','cv','projects'] as const).find(id => pathKey(target) === `${prefix}/${id}`);
      if (section) { event.preventDefault(); void show(section, { anchor: target.hash }); }
    }
  }, { signal });
  search.addEventListener('input', filter, { signal });
  category.addEventListener('change', filter, { signal });
  function intendedRow(event: Event) {
    return event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('[data-world-article]') ?? undefined : undefined;
  }
  dialog.addEventListener('pointerover', event => {
    window.clearTimeout(hoverTimer);
    const row = intendedRow(event);
    if (row) hoverTimer = window.setTimeout(() => prefetch(row), 100);
  }, { signal });
  dialog.addEventListener('pointerout', () => window.clearTimeout(hoverTimer), { signal });
  dialog.addEventListener('focusin', event => prefetch(intendedRow(event)), { signal });
  contents.addEventListener('click', () => catalogue(true, true), { signal });
  el('#hide-contents').addEventListener('click', () => catalogue(false, true), { signal });
  dialog.addEventListener('cancel', remember, { signal });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    ++view; stopOtherRequests(); catalogue(false);
    reading.removeAttribute('aria-busy');
    opener?.focus({ preventScroll: true }); options.onReadingChange(false);
    if (location.hash.startsWith('#folio/')) {
      if (history.state?.courtFolio) history.back();
      else history.replaceState(history.state, '', location.pathname + location.search);
    }
  }, { signal });
  window.addEventListener('hashchange', fromAddress, { signal });
  if (location.hash.startsWith('#folio/')) fromAddress();
  else prefetch(selected);
  return {
    show,
    close,
    dispose() { ++view; stopOtherRequests(); if (dialog.open) dialog.close(); cache.clear(); }
  };
}
