import { hasSeenWelcome, loadWelcomeImages, rememberWelcome } from './welcome-visit';

export function createWelcomeGuide(dialog: HTMLDialogElement, signal: AbortSignal, resume: (requestMouse: boolean) => void) {
  const pages = [...dialog.querySelectorAll<HTMLElement>('[data-welcome-page]')];
  const back = dialog.querySelector<HTMLButtonElement>('[data-welcome-back]')!;
  const next = dialog.querySelector<HTMLButtonElement>('[data-welcome-next]')!;
  const nextLabel = next.querySelector<HTMLElement>('[data-welcome-next-label]')!;
  const nextTitle = nextLabel.textContent;
  const done = dialog.querySelector<HTMLButtonElement>('[data-welcome-done]')!;
  const progress = dialog.querySelector<HTMLElement>('[data-welcome-progress]')!;
  const scroll = dialog.querySelector<HTMLElement>('[data-welcome-scroll]')!;

  function showPage(index: number) {
    for (const [i, page] of pages.entries()) page.hidden = i !== index;
    const page = pages[index];
    loadWelcomeImages(page);
    const lastPage = index === pages.length - 1;
    back.hidden = index === 0;
    next.hidden = lastPage;
    done.hidden = !lastPage;
    progress.textContent = `${index + 1} / ${pages.length}`;
    scroll.scrollTop = 0;
    page.querySelector<HTMLElement>('[data-welcome-heading]')?.focus({ preventScroll: true });
  }
  function dismiss(requestMouse: boolean) {
    if (!dialog.open) return;
    dialog.close();
    resume(requestMouse);
  }
  back.addEventListener('click', () => showPage(0), { signal });
  let turning = false;
  next.addEventListener('click', async () => {
    if (turning) return;
    turning = true;
    next.setAttribute('aria-busy', 'true');
    try {
      const page = pages[1];
      loadWelcomeImages(page);
      const images = [...page.querySelectorAll('img')];
      if (images.some(img => !img.complete || !img.naturalWidth)) nextLabel.textContent = next.dataset.loading!;
      await Promise.all(images.map(img => {
        if (img.complete && !img.naturalWidth) img.src = img.src;
        return img.decode();
      }));
      if (dialog.open && !signal.aborted) {
        nextLabel.textContent = nextTitle;
        showPage(1);
      }
    } catch {
      nextLabel.textContent = next.dataset.retry!;
    } finally {
      turning = false;
      next.removeAttribute('aria-busy');
    }
  }, { signal });
  done.addEventListener('click', () => dismiss(true), { signal });
  dialog.querySelector('[data-welcome-close]')!.addEventListener('click', () => dismiss(true), { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(false); }, { signal });
  signal.addEventListener('abort', () => { if (dialog.open) dialog.close(); }, { once: true });
  return {
    showIfNew() {
      if (hasSeenWelcome()) return false;
      dialog.showModal();
      showPage(0);
      rememberWelcome();
      return true;
    },
  };
}
