const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/**
 * Small, shared motion loop for the frontispiece. It sleeps whenever every
 * spring has settled, so the reading pages do not carry a permanent DOM loop.
 */
export function mountSiteMotion() {
  const root = document.documentElement;
  const cleanups = [];
  const springs = [];
  const activeAnimations = new Set();
  let raf = 0;
  let previousTime = 0;

  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  const wake = () => {
    if (!raf && !motionPreference.matches && !document.hidden) {
      previousTime = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  const tick = (now) => {
    raf = 0;
    const dt = Math.min((now - previousTime) / 1000, 1 / 30);
    previousTime = now;
    let busiest = 0;

    for (const spring of springs) {
      const result = spring.update(dt);
      busiest = Math.max(busiest, result);
    }

    if (busiest > 0.012 && !document.hidden && !motionPreference.matches) {
      raf = requestAnimationFrame(tick);
    }
  };

  const resetSprings = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const spring of springs) spring.reset();
  };

  const onMotionChange = () => {
    if (motionPreference.matches) {
      resetSprings();
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations.clear();
    }
  };
  listen(motionPreference, 'change', onMotionChange);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) resetSprings();
  });

  const animate = (element, keyframes, options) => {
    if (!element || motionPreference.matches) return;
    const animation = element.animate(keyframes, { fill: 'backwards', ...options });
    activeAnimations.add(animation);
    const forget = () => activeAnimations.delete(animation);
    animation.addEventListener('finish', forget, { once: true });
    animation.addEventListener('cancel', forget, { once: true });
  };

  // The opening reads as an unrolling title and a seal being pressed, not a
  // page-wide collection of identical fade-up entrances.
  document.querySelectorAll('.frontispiece-label').forEach((label) => {
    animate(label, [
      { opacity: 0, transform: 'scaleY(.18)', transformOrigin: 'top' },
      { opacity: 1, transform: 'scaleY(1)', transformOrigin: 'top' },
    ], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
  });

  document.querySelectorAll('.home-intro h1, .page-heading:not(.archive-heading) h1, .article-header h1, .cv-header h1').forEach((heading) => {
    animate(heading, [
      { opacity: 0, clipPath: 'inset(0 100% 0 0)', transform: 'translateX(-10px)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0)', transform: 'translateX(0)' },
    ], { duration: 760, delay: 90, easing: 'cubic-bezier(.16,1,.3,1)' });
  });

  document.querySelectorAll('.home-avatar').forEach((avatar) => {
    animate(avatar, [
      { opacity: 0, transform: 'rotate(-5deg) scale(.88)' },
      { opacity: 1, transform: 'rotate(0) scale(1)' },
    ], { duration: 720, delay: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });

  document.querySelectorAll('.home-motto, .home-actions, .frontispiece-author figcaption').forEach((element, index) => {
    animate(element, [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 460, delay: 420 + index * 90, easing: 'cubic-bezier(.16,1,.3,1)' });
  });

  // Reveal homepage rows and projects; archive cards stay visible during filtering.
  const revealItems = [...document.querySelectorAll('.home-posts .post-item, .project')];
  if (!motionPreference.matches && 'IntersectionObserver' in window) {
    revealItems.forEach((item, index) => { item.dataset.motionOrder = String(index % 4); });
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        revealObserver.unobserve(entry.target);
        const isProject = entry.target.classList.contains('project');
        animate(entry.target, [
          { opacity: 0, transform: isProject ? 'translateX(14px)' : 'translateX(-12px)' },
          { opacity: 1, transform: 'translateX(0)' },
        ], {
          duration: isProject ? 520 : 430,
          delay: Number(entry.target.dataset.motionOrder || 0) * 65,
          easing: 'cubic-bezier(.16,1,.3,1)',
        });
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach((item) => revealObserver.observe(item));
    cleanups.push(() => revealObserver.disconnect());
  }

  // A fine, content-specific reading map. Unsupported browsers simply omit it.
  if (document.querySelector('.article-body') && CSS.supports('animation-timeline: scroll()')) {
    const progress = document.createElement('div');
    progress.className = 'reading-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.append(progress);
    cleanups.push(() => progress.remove());
  }

  // Magnetic feedback is limited to explicit navigation actions. Values live
  // in closures rather than framework state and use one frame-independent loop.
  if (finePointer.matches) {
    document.querySelectorAll('.home-actions .text-link, .brand').forEach((element) => {
      const strength = element.classList.contains('brand') ? 0.035 : 0.09;
      const state = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
      const render = () => {
        element.style.transform = `translate3d(${state.x.toFixed(2)}px,${state.y.toFixed(2)}px,0)`;
      };
      const spring = {
        update(dt) {
          state.vx += (state.tx - state.x) * 170 * dt;
          state.vy += (state.ty - state.y) * 170 * dt;
          const damping = Math.exp(-17 * dt);
          state.vx *= damping;
          state.vy *= damping;
          state.x += state.vx * dt;
          state.y += state.vy * dt;
          render();
          return Math.max(Math.abs(state.tx - state.x), Math.abs(state.ty - state.y), Math.abs(state.vx), Math.abs(state.vy));
        },
        reset() {
          state.x = state.y = state.vx = state.vy = state.tx = state.ty = 0;
          element.style.transform = '';
        },
      };
      springs.push(spring);
      listen(element, 'pointerenter', () => { element.dataset.magnetic = 'true'; });
      listen(element, 'pointermove', (event) => {
        if (motionPreference.matches) return;
        const rect = element.getBoundingClientRect();
        state.tx = clamp((event.clientX - rect.left - rect.width / 2) * strength, -7, 7);
        state.ty = clamp((event.clientY - rect.top - rect.height / 2) * strength, -5, 5);
        wake();
      }, { passive: true });
      listen(element, 'pointerleave', () => {
        delete element.dataset.magnetic;
        state.tx = state.ty = 0;
        wake();
      });
    });
  }

  const quote = document.querySelector('.frontispiece-quote');
  if (quote) {
    const accessibleText = quote.textContent.trim().replace(/\s+/g, ' ');
    const phrases = [...quote.querySelectorAll(':scope > span')];
    const characters = [];

    for (const phrase of phrases) {
      const text = phrase.textContent;
      phrase.textContent = '';
      phrase.setAttribute('aria-hidden', 'true');
      phrase.classList.add('motion-phrase');
      for (const character of text) {
        const span = document.createElement('span');
        span.className = 'motion-char';
        span.textContent = character;
        if (/\s/.test(character)) span.style.whiteSpace = 'pre';
        phrase.append(span);
        characters.push({
          element: span,
          baseX: 0,
          baseY: 0,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        });
      }
    }

    if (characters.length) {
      const hiddenText = document.createElement('span');
      hiddenText.className = 'sr-only';
      hiddenText.textContent = accessibleText;
      quote.append(hiddenText);
      quote.dataset.motionSplit = 'true';
      root.classList.add('motion-ready');

      const pointer = { x: 0, y: 0, active: false };
      const measure = () => {
        for (const character of characters) {
          const element = character.element;
          character.baseX = element.offsetLeft + element.offsetWidth / 2;
          character.baseY = element.offsetTop + element.offsetHeight / 2;
        }
      };
      measure();

      if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(quote);
        cleanups.push(() => resizeObserver.disconnect());
      } else {
        listen(window, 'resize', measure, { passive: true });
      }

      const updatePointer = (event) => {
        if (motionPreference.matches) return;
        const rect = quote.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.active = true;
        wake();
      };
      const releasePointer = () => {
        pointer.active = false;
        wake();
      };
      listen(quote, 'pointermove', updatePointer, { passive: true });
      listen(quote, 'pointerdown', updatePointer, { passive: true });
      listen(quote, 'pointerup', releasePointer, { passive: true });
      listen(quote, 'pointercancel', releasePointer, { passive: true });
      listen(quote, 'pointerleave', releasePointer, { passive: true });

      for (const character of characters) {
        const spring = {
          update(dt) {
            let tx = 0;
            let ty = 0;
            if (pointer.active) {
              const dx = character.baseX + character.x - pointer.x;
              const dy = character.baseY + character.y - pointer.y;
              const distance = Math.hypot(dx, dy) || 1;
              const radius = 76;
              if (distance < radius) {
                const force = (1 - distance / radius) ** 2 * 25;
                tx = dx / distance * force;
                ty = dy / distance * force * 0.36;
              }
            }
            character.vx += (tx - character.x) * 145 * dt;
            character.vy += (ty - character.y) * 145 * dt;
            const damping = Math.exp(-11 * dt);
            character.vx *= damping;
            character.vy *= damping;
            character.x += character.vx * dt;
            character.y += character.vy * dt;
            const lean = clamp(character.vx * 0.025, -7, 7);
            character.element.style.transform = `translate3d(${character.x.toFixed(2)}px,${character.y.toFixed(2)}px,0) rotate(${lean.toFixed(2)}deg)`;
            return Math.max(Math.abs(tx - character.x), Math.abs(ty - character.y), Math.abs(character.vx), Math.abs(character.vy));
          },
          reset() {
            pointer.active = false;
            character.x = character.y = character.vx = character.vy = 0;
            character.element.style.transform = '';
          },
        };
        springs.push(spring);
      }
    }
  }

  root.dataset.siteMotion = 'ready';
  const destroy = () => {
    resetSprings();
    activeAnimations.forEach((animation) => animation.cancel());
    activeAnimations.clear();
    cleanups.forEach((cleanup) => cleanup());
    delete root.dataset.siteMotion;
  };
  listen(window, 'pagehide', destroy, { once: true });
  return { destroy };
}

mountSiteMotion();
