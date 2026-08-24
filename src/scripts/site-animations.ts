import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function initAnimations() {
  const mm = gsap.matchMedia();

  mm.add({ reduceMotion: '(prefers-reduced-motion: reduce)' }, (context) => {
    const { reduceMotion } = context.conditions as { reduceMotion: boolean };

    const header = document.querySelector('header');
    if (header) {
      gsap.from(header, { y: -24, autoAlpha: 0, duration: reduceMotion ? 0 : 0.8, ease: 'power3.out' });
    }

    gsap.utils.toArray<HTMLElement>('[data-animate]').forEach((el) => {
      const delay = reduceMotion ? 0 : Number(el.dataset.delay || 0);
      gsap.from(el, { y: 28, autoAlpha: 0, duration: reduceMotion ? 0 : 0.9, delay, ease: 'power3.out' });
    });

    ScrollTrigger.batch('.card', {
      start: 'top 90%',
      onEnter: (batch) =>
        gsap.from(batch, {
          y: 28,
          autoAlpha: 0,
          duration: reduceMotion ? 0 : 0.7,
          stagger: reduceMotion ? 0 : 0.1,
          ease: 'power3.out',
          overwrite: true,
        }),
    });

    return () => {
      // gsap.matchMedia() reverts tweens/ScrollTriggers created above automatically
    };
  });

  // Glass specular highlight that follows the pointer (independent of reduced-motion gate)
  document.querySelectorAll<HTMLElement>('.card, .button').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--x', `${e.clientX - rect.left}px`);
      el.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnimations);
} else {
  initAnimations();
}
