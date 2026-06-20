/* Moodle Scraper — landing page interactions */
(function () {
  'use strict';

  // ── Reveal-on-scroll (staggered within a section) ──
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // stagger siblings that share a parent
        const sibs = Array.from(el.parentElement.querySelectorAll(':scope > .reveal'));
        const idx = sibs.indexOf(el);
        el.style.transitionDelay = (idx > 0 ? idx * 0.08 : 0) + 's';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // ── Nav: solid background after scrolling ──
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 12) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
