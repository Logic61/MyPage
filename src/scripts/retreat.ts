type RetreatScene = 'mountain' | 'study';
type CatalogueView = 'all' | 'recent';

const ordinaryClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function mountRetreat(host: HTMLElement) {
  const root = document.documentElement;
  const stateKey = host.dataset.stateKey || 'shane-retreat';
  const isEn = host.dataset.language === 'en';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canDrift = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)');
  const main = host.querySelector<HTMLElement>('.retreat-main')!;
  const sections = [...host.querySelectorAll<HTMLElement>('[data-scene]')];
  const catalogue = host.querySelector<HTMLDialogElement>('[data-study-catalogue]')!;
  const catalogueTitle = catalogue.querySelector<HTMLElement>('#catalogue-title')!;
  const catalogueList = catalogue.querySelector<HTMLOListElement>('[data-catalogue-list]')!;
  const entries = [...catalogue.querySelectorAll<HTMLElement>('[data-catalogue-post]')];
  const category = catalogue.querySelector<HTMLSelectElement>('#study-category')!;
  const status = catalogue.querySelector<HTMLElement>('[data-catalogue-status]')!;
  const views = [...catalogue.querySelectorAll<HTMLButtonElement>('[data-catalogue-view]')];
  let current: RetreatScene = root.dataset.retreatScene === 'study' ? 'study' : 'mountain';
  let view: CatalogueView = 'all';
  let opener: HTMLElement | null = null;
  let transitionTimer = 0;
  let revealTimer = 0;
  let switching = false;

  const remember = (scene: RetreatScene) => {
    try { sessionStorage.setItem(stateKey, scene); } catch { /* The hash remains a durable fallback. */ }
  };
  const historyState = () => typeof history.state === 'object' && history.state ? history.state : {};
  const updateLanguageLink = () => {
    const link = host.querySelector<HTMLAnchorElement>('.nav-tools a[hreflang]');
    if (link) link.href = `${link.href.split('#')[0]}#${current}`;
  };
  const renderScene = (scene: RetreatScene, focus = false) => {
    current = scene;
    root.dataset.retreatScene = scene;
    sections.forEach(section => { section.hidden = section.dataset.scene !== scene; });
    remember(scene);
    updateLanguageLink();
    if (focus) document.getElementById(`${scene}-title`)?.focus({ preventScroll: true });
  };

  const changeScene = (scene: RetreatScene, push = true, focus = true) => {
    if (switching || scene === current) return;
    const finish = () => {
      main.inert = false;
      renderScene(scene, focus);
      if (push) history.pushState({ ...historyState(), retreatScene: scene }, '', `#${scene}`);
      window.scrollTo({ top: 0, behavior: 'instant' });
      revealTimer = window.setTimeout(() => {
        host.removeAttribute('data-switching');
        switching = false;
      }, motion.matches ? 0 : 45);
    };
    if (motion.matches) { finish(); return; }
    switching = true;
    main.inert = true;
    host.setAttribute('data-switching', '');
    transitionTimer = window.setTimeout(finish, 190);
  };

  host.querySelectorAll<HTMLAnchorElement>('[data-enter-study], [data-leave-study]').forEach(link => {
    link.addEventListener('click', event => {
      if (!ordinaryClick(event)) return;
      event.preventDefault();
      changeScene(link.hasAttribute('data-enter-study') ? 'study' : 'mountain');
    });
  });

  const fromLocation = () => {
    const hashScene = location.hash === '#study' ? 'study' : location.hash === '#mountain' ? 'mountain' : undefined;
    const rememberedState = historyState().retreatScene;
    const next = hashScene || (rememberedState === 'study' || rememberedState === 'mountain' ? rememberedState : current);
    window.clearTimeout(transitionTimer);
    window.clearTimeout(revealTimer);
    switching = false;
    main.inert = false;
    host.removeAttribute('data-switching');
    if (catalogue.open) catalogue.close();
    renderScene(next);
  };
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  window.addEventListener('pageshow', event => { if (event.persisted) fromLocation(); });

  const renderCatalogue = () => {
    let count = 0;
    entries.forEach(entry => {
      const visible = (view === 'all' || entry.dataset.recent === 'true') && (!category.value || entry.dataset.category === category.value);
      entry.hidden = !visible;
      if (visible) count += 1;
    });
    views.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.catalogueView === view)));
    status.textContent = isEn ? `${count} ${count === 1 ? 'entry' : 'entries'}${category.value ? ` · ${category.value}` : ''}` : `共 ${count} 篇${category.value ? ` · ${category.value}` : ''}`;
    catalogueList.scrollTop = 0;
  };

  host.querySelectorAll<HTMLAnchorElement>('[data-catalogue-open]').forEach(link => {
    if (typeof catalogue.showModal !== 'function') return;
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', 'study-catalogue');
    link.addEventListener('click', event => {
      if (!ordinaryClick(event)) return;
      event.preventDefault();
      opener = link;
      view = link.dataset.catalogueOpen === 'recent' ? 'recent' : 'all';
      category.value = '';
      renderCatalogue();
      remember('study');
      catalogue.showModal();
      catalogueTitle.focus({ preventScroll: true });
    });
  });
  views.forEach(button => button.addEventListener('click', () => {
    view = button.dataset.catalogueView === 'recent' ? 'recent' : 'all';
    category.value = '';
    renderCatalogue();
  }));
  category.addEventListener('change', () => { view = 'all'; renderCatalogue(); });
  catalogue.addEventListener('click', event => {
    if (event.target !== catalogue) return;
    const rect = catalogue.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) catalogue.close();
  });
  catalogue.addEventListener('close', () => {
    // Ctrl/⌘ K may already have opened the shared search dialog.
    if (document.querySelector('dialog[open]')) return;
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true });
  });
  catalogue.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => link.addEventListener('click', event => {
    if (ordinaryClick(event)) { remember('study'); catalogue.close(); }
  }));
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && catalogue.open) catalogue.close();
  }, { capture: true });

  // Move the whole canvas, including its links. No object-fit/coordinate drift.
  const canvases = [...host.querySelectorAll<HTMLElement>('[data-scene-canvas]')];
  const resetDrift = () => canvases.forEach(canvas => {
    canvas.style.removeProperty('--scene-drift-x');
    canvas.style.removeProperty('--scene-drift-y');
  });
  canvases.forEach(canvas => {
    const frame = canvas.parentElement!;
    let raf = 0;
    frame.addEventListener('pointermove', event => {
      if (motion.matches || !canDrift.matches || event.pointerType === 'touch' || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = frame.getBoundingClientRect();
        canvas.style.setProperty('--scene-drift-x', `${((event.clientX - rect.left) / rect.width - .5) * -5}px`);
        canvas.style.setProperty('--scene-drift-y', `${((event.clientY - rect.top) / rect.height - .5) * -3}px`);
      });
    }, { passive: true });
    frame.addEventListener('pointerleave', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.style.removeProperty('--scene-drift-x');
      canvas.style.removeProperty('--scene-drift-y');
    });
  });
  motion.addEventListener('change', resetDrift);
  canDrift.addEventListener('change', resetDrift);
  document.addEventListener('visibilitychange', () => {
    host.toggleAttribute('data-paused', document.hidden);
    if (document.hidden) resetDrift();
  });
  window.addEventListener('pagehide', () => {
    window.clearTimeout(transitionTimer);
    window.clearTimeout(revealTimer);
    main.inert = false;
    switching = false;
    host.removeAttribute('data-switching');
    resetDrift();
  });

  renderScene(current);
  history.replaceState({ ...historyState(), retreatScene: current }, '', location.href);
  root.classList.add('retreat-js');
}

const retreat = document.querySelector<HTMLElement>('[data-retreat]');
if (retreat) mountRetreat(retreat);

export {};
