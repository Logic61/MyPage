import { createWaymarks } from './waymarks';
import type { Interaction, InteractionKind, WorldConfig, WorldUI } from './types';

interface UIActions {
  onInteract: () => void;
  onReset: () => void;
  onSound: () => boolean;
  onNavigate: (id: string) => void;
  onReadingChange?: (open: boolean) => void;
}

export function createWorldUI(root: HTMLElement, config: WorldConfig, actions: UIActions): WorldUI {
  const one = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing mountain study interface: ${selector}`);
    return element;
  };
  const en = config.isEn;
  const waymarks = createWaymarks(root);
  const controller = new AbortController();
  const { signal } = controller;
  const dialog = one<HTMLDialogElement>('[data-world-reader]');
  const title = one<HTMLElement>('[data-reader-title]');
  const eyebrow = one<HTMLElement>('[data-reader-eyebrow]');
  const directory = one<HTMLElement>('[data-reader-directory]');
  const article = one<HTMLElement>('[data-reader-article]');
  const status = one<HTMLElement>('[data-reader-status]');
  const toolbar = one<HTMLElement>('[data-reader-toolbar]');
  const original = one<HTMLAnchorElement>('[data-reader-original]');
  const scroll = one<HTMLElement>('[data-reader-scroll]');
  const search = one<HTMLInputElement>('[data-world-search]');
  const category = one<HTMLSelectElement>('[data-world-category]');
  const postRows = [...root.querySelectorAll<HTMLElement>('[data-world-post]')];
  const count = one<HTMLElement>('[data-world-count]');
  const empty = one<HTMLElement>('[data-world-empty]');
  const prompt = one<HTMLButtonElement>('[data-world-interaction]');
  const promptLabel = one<HTMLElement>('[data-world-interaction-label]');
  const locationLabel = one<HTMLElement>('[data-world-location]');
  const toast = one<HTMLElement>('[data-world-toast]');
  const soundButton = one<HTMLButtonElement>('[data-world-action="sound"]');
  let lastFocus: HTMLElement | null = null;
  let currentKind: InteractionKind = 'books';
  let currentInteraction: string | null = null;
  let currentPage = '';
  let catalogueScroll = 0;
  let toastTimer = 0;
  let requestId = 0;
  let pageRequest: AbortController | null = null;
  let failed = false;
  let cachedPages = new Map<string, string>();

  try {
    if (sessionStorage.getItem('mountain-study:hint-dismissed') === '1') one<HTMLElement>('[data-world-hint]').hidden = true;
  } catch { /* Private browsing may disable storage. */ }

  function showToast(message: string) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3400);
  }

  function openDialog() {
    if (!dialog.open) {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      root.classList.add('mw-reading');
      actions.onReadingChange?.(true);
    }
    title.focus({ preventScroll: true });
  }

  function cancelPageRequest() {
    requestId++;
    pageRequest?.abort();
    pageRequest = null;
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function filterPosts() {
    const query = search.value.trim().toLocaleLowerCase(en ? 'en' : 'zh-CN');
    let visible = 0;
    postRows.forEach(row => {
      const index = Number(row.dataset.postIndex);
      const post = config.posts[index];
      if (!post) { row.hidden = true; return; }
      const matches = (currentKind !== 'latest' || index < 8)
        && (!category.value || post.category === category.value)
        && (!query || `${post.title} ${post.description} ${post.category}`.toLocaleLowerCase(en ? 'en' : 'zh-CN').includes(query));
      row.hidden = !matches;
      if (matches) visible++;
    });
    count.textContent = en ? `${visible} ${visible === 1 ? 'page' : 'pages'}` : `共 ${visible} 篇`;
    empty.hidden = visible > 0;
  }

  function showDirectory(kind: InteractionKind = 'books', reset = true) {
    cancelPageRequest();
    currentKind = kind === 'latest' ? 'latest' : 'books';
    currentPage = '';
    dialog.dataset.view = 'directory';
    title.textContent = currentKind === 'latest' ? (en ? 'The open notebook' : '案头手记') : (en ? 'The collected pages' : '藏书与手记');
    eyebrow.textContent = currentKind === 'latest' ? (en ? 'RECENT WRITING' : '最近写下的文字') : (en ? 'FROM THE BOOKSHELF' : '书架之间');
    directory.hidden = false;
    article.hidden = true;
    status.hidden = true;
    toolbar.hidden = true;
    if (reset) { search.value = ''; category.value = ''; }
    filterPosts();
    openDialog();
    if (reset) catalogueScroll = 0;
    scroll.scrollTop = catalogueScroll;
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

  async function openPage(href: string, kind: InteractionKind = 'books') {
    let pageURL: URL;
    try { pageURL = new URL(href, location.href); } catch { return; }
    if (pageURL.origin !== location.origin || !pageURL.pathname.startsWith(`${config.prefix}/`)) {
      window.location.assign(pageURL.href);
      return;
    }
    cancelPageRequest();
    const request = requestId;
    pageRequest = new AbortController();
    if (dialog.open && !directory.hidden) catalogueScroll = scroll.scrollTop;
    currentPage = pageURL.href;
    dialog.dataset.view = kind === 'projects' || kind === 'about' ? kind : 'article';
    currentKind = kind;
    directory.hidden = true;
    article.hidden = true;
    article.replaceChildren();
    toolbar.hidden = false;
    status.hidden = false;
    status.textContent = en ? 'Opening the page…' : '正在翻开这一页…';
    title.textContent = kind === 'projects' ? (en ? 'Work & experiments' : '作品与实践') : kind === 'about' ? (en ? 'The host’s scroll' : '山居自序') : (en ? 'Collected writings' : '云庭文集');
    eyebrow.textContent = kind === 'projects' ? (en ? 'ON THE WORKBENCH' : '工作案上') : kind === 'about' ? (en ? 'ABOUT & CURRICULUM VITAE' : '关于与简历') : (en ? 'FROM THE STUDY' : '云庭书斋');
    original.href = pageURL.href;
    scroll.scrollTop = 0;
    openDialog();
    try {
      let html = cachedPages.get(pageURL.href);
      if (!html) {
        const response = await fetch(pageURL.href, { signal: pageRequest.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Page request failed: ${response.status}`);
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const extracted = kind === 'projects' ? doc.querySelector('.project-list') : kind === 'about' ? doc.querySelector('.cv-document') : doc.querySelector('article.article');
        if (!extracted) throw new Error('The expected reading content was not found.');
        sanitizeContent(extracted, new URL(response.url || pageURL.href));
        html = extracted.outerHTML;
        cachedPages.set(pageURL.href, html);
      }
      if (request !== requestId || !dialog.open) return;
      article.innerHTML = html;
      status.hidden = true;
      article.hidden = false;
      scroll.scrollTop = 0;
      if (pageURL.hash) {
        const target = article.querySelector(`[id="${CSS.escape(decodeURIComponent(pageURL.hash.slice(1)))}"]`);
        target?.scrollIntoView({ block: 'start' });
      }
    } catch (error) {
      if (request !== requestId || (error instanceof DOMException && error.name === 'AbortError')) return;
      status.replaceChildren(document.createTextNode(en ? 'This page could not be opened here. ' : '这一页暂时未能在书斋中展开。'));
      const link = document.createElement('a');
      link.href = pageURL.href;
      link.textContent = en ? 'Read it on its own page.' : '可以前往原页面继续阅读。';
      status.append(link);
      status.hidden = false;
    }
  }

  function openContent(kind: InteractionKind) {
    if (kind === 'books' || kind === 'latest') showDirectory(kind);
    else if (kind === 'projects' || kind === 'about') void openPage(`${config.prefix}/${kind === 'projects' ? 'projects' : 'cv'}`, kind);
  }

  function useWaymark(kind: InteractionKind, id: string) {
    if (kind === 'lantern' || kind === 'bench') actions.onNavigate(id);
    else openContent(kind);
  }

  root.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;
    const mark = element.closest<HTMLButtonElement>('[data-world-mark]');
    if (mark && !mark.hidden && mark.dataset.destinationId) {
      event.preventDefault();
      useWaymark(mark.dataset.worldMark as InteractionKind, mark.dataset.destinationId);
      return;
    }
    const destination = element.closest<HTMLElement>('[data-world-destination]');
    if (destination) {
      event.preventDefault();
      const id = destination.dataset.worldDestination!;
      if (failed) {
        if (id === 'books' || id === 'latest' || id === 'projects' || id === 'about') openContent(id);
        else showToast(en ? 'The path needs a browser with 3D support.' : '山间行走需要浏览器支持三维场景。');
      } else {
        closeDialog();
        actions.onNavigate(id);
      }
      return;
    }
    const actionElement = element.closest<HTMLElement>('[data-world-action]');
    if (actionElement instanceof HTMLAnchorElement && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    const action = actionElement?.dataset.worldAction;
    if (action) {
      event.preventDefault();
      if (action === 'directory' || action === 'map') showDirectory('books');
      else if (action === 'close') closeDialog();
      else if (action === 'back') showDirectory(currentKind === 'latest' ? 'latest' : 'books', false);
      else if (action === 'reset') actions.onReset();
      else if (action === 'interact') actions.onInteract();
      else if (action === 'sound') {
        const playing = actions.onSound();
        soundButton.setAttribute('aria-pressed', String(playing));
        soundButton.setAttribute('aria-label', playing ? (en ? 'Turn ambient sound off' : '关闭环境声音') : (en ? 'Turn ambient sound on' : '开启环境声音'));
        one<HTMLElement>('[data-sound-label]').textContent = playing ? (en ? 'Sound on' : '声音开启') : (en ? 'Sound off' : '声音关闭');
        showToast(playing ? (en ? 'Listen to the mountain.' : '听一听山间。') : (en ? 'Ambient sound off.' : '环境声音已关闭。'));
      } else if (action === 'dismiss-hint') {
        one<HTMLElement>('[data-world-hint]').hidden = true;
        try { sessionStorage.setItem('mountain-study:hint-dismissed', '1'); } catch { /* Storage is optional. */ }
      }
      return;
    }
    const link = element.closest<HTMLAnchorElement>('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || link.target === '_blank' || link.hasAttribute('download')) return;
    if (link.hasAttribute('data-world-article')) {
      event.preventDefault();
      void openPage(link.href, currentKind === 'latest' ? 'latest' : 'books');
      return;
    }
    if (article.contains(link)) {
      const rawHref = link.getAttribute('href') || '';
      if (rawHref.startsWith('#')) {
        event.preventDefault();
        try { article.querySelector(`[id="${CSS.escape(decodeURIComponent(rawHref.slice(1)))}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { /* A malformed author-provided anchor is left inert. */ }
      } else {
        const url = new URL(link.href, currentPage || location.href);
        if (url.origin === location.origin && url.pathname.startsWith(`${config.prefix}/blog/`)) {
          event.preventDefault();
          void openPage(url.href, 'books');
        }
      }
    }
  }, { signal });
  search.addEventListener('input', filterPosts, { signal });
  category.addEventListener('change', filterPosts, { signal });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  }, { signal });
  dialog.addEventListener('close', () => {
    // A queued close event must not cancel a subsequently opened reading request.
    if (dialog.open) return;
    cancelPageRequest();
    root.classList.remove('mw-reading');
    lastFocus?.focus({ preventScroll: true });
    actions.onReadingChange?.(false);
  }, { signal });

  return {
    updateWaymarks: waymarks.update,
    useCentredWaymark() {
      const item = waymarks.atCentre();
      if (item) useWaymark(item.kind, item.id);
    },
    setReady() {
      failed = false;
      root.dataset.state = 'ready';
      one<HTMLElement>('[data-world-fallback]').hidden = true;
      soundButton.disabled = false;
      one<HTMLButtonElement>('[data-world-action="reset"]').disabled = false;
    },
    setFailed(reason) {
      failed = true;
      root.dataset.state = 'failed';
      one<HTMLElement>('[data-world-loading]').hidden = true;
      one<HTMLElement>('[data-world-fallback]').hidden = false;
      one<HTMLElement>('[data-world-failure]').textContent = en ? 'The 3D scene is unavailable in this browser. You can still read every page below.' : '此浏览器暂时无法展开三维场景，仍可直接翻阅全部文章、项目与简历。';
      root.dataset.failure = reason;
      prompt.hidden = true;
    },
    setLocation(name, nameEn) {
      const value = en ? nameEn : name;
      if (locationLabel.textContent !== value) locationLabel.textContent = value;
    },
    setInteraction(interaction: Interaction | null, screen) {
      if (!interaction || failed) { prompt.hidden = true; currentInteraction = null; return; }
      if (currentInteraction !== interaction.id) {
        currentInteraction = interaction.id;
        promptLabel.textContent = en ? interaction.labelEn : interaction.label;
      }
      prompt.hidden = false;
      if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
        const margin = Math.min(root.clientWidth / 2, Math.max(100, prompt.offsetWidth / 2 + 12));
        prompt.style.left = `${Math.max(margin, Math.min(root.clientWidth - margin, screen.x))}px`;
        prompt.style.top = `${Math.max(110, Math.min(root.clientHeight - 145, screen.y + 24))}px`;
      } else { prompt.style.left = '50%'; prompt.style.top = 'calc(50% + 42px)'; }
    },
    showToast,
    openContent,
    isOpen: () => dialog.open,
    dispose() {
      cancelPageRequest();
      window.clearTimeout(toastTimer);
      controller.abort();
      if (dialog.open) dialog.close();
      root.classList.remove('mw-reading');
      cachedPages.clear();
    },
  };
}
