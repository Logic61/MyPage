import { createFolio } from './folio';
import { createWaymarks } from './waymarks';
import type { Interaction, InteractionKind, WorldConfig, WorldUI } from './types';

interface UIActions {
  onInteract: () => void;
  onReset: () => void;
  onSound: () => boolean;
  onNavigate: (id: string) => void;
  getPose: () => { x: number; z: number; yaw: number } | null;
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
  const folio = createFolio(dialog, {
    isEn: en, prefix: config.prefix, signal, getPose: actions.getPose,
    onReadingChange(open) {
      root.classList.toggle('mw-reading', open);
      actions.onReadingChange?.(open);
    },
  });
  const prompt = one<HTMLButtonElement>('[data-world-interaction]');
  const promptLabel = one<HTMLElement>('[data-world-interaction-label]');
  const locationLabel = one<HTMLElement>('[data-world-location]');
  const toast = one<HTMLElement>('[data-world-toast]');
  const soundButton = one<HTMLButtonElement>('[data-world-action="sound"]');
  let currentInteraction: string | null = null;
  let toastTimer = 0;
  let failed = false;

  function showToast(message: string) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3400);
  }

  function setSound(playing: boolean) {
    soundButton.setAttribute('aria-pressed', String(playing));
    soundButton.setAttribute('aria-label', playing ? (en ? 'Turn background music off' : '关闭背景音乐') : (en ? 'Turn background music on' : '开启背景音乐'));
    one<HTMLElement>('[data-sound-label]').textContent = playing ? (en ? 'Music on' : '音乐开启') : (en ? 'Music off' : '音乐关闭');
  }

  function openContent(kind: InteractionKind, catalogue = false) {
    if (kind === 'books') void folio.show('blog', { catalogue });
    else if (kind === 'projects' || kind === 'about') void folio.show(kind === 'projects' ? 'projects' : 'cv');
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
        if (id === 'books' || id === 'projects' || id === 'about') openContent(id);
        else showToast(en ? 'The path needs a browser with 3D support.' : '山间行走需要浏览器支持三维场景。');
      } else {
        folio.close();
        actions.onNavigate(id);
      }
      return;
    }
    const actionElement = element.closest<HTMLElement>('[data-world-action]');
    if (actionElement instanceof HTMLAnchorElement && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    const action = actionElement?.dataset.worldAction;
    if (action) {
      event.preventDefault();
      if (action === 'directory') openContent('books', true);
      else if (action === 'map') void folio.show('map');
      else if (action === 'close') folio.close();
      else if (action === 'reset') actions.onReset();
      else if (action === 'interact') actions.onInteract();
      else if (action === 'sound') {
        const playing = actions.onSound();
        setSound(playing);
        showToast(playing ? (en ? 'Background music on.' : '背景音乐已开启。') : (en ? 'Background music off.' : '背景音乐已关闭。'));
      } else if (action === 'dismiss-hint') {
        one<HTMLElement>('[data-world-hint]').hidden = true;
      }
      return;
    }
  }, { signal });

  return {
    setSound,
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
      window.clearTimeout(toastTimer);
      controller.abort();
      folio.dispose();
      root.classList.remove('mw-reading');
    },
  };
}
