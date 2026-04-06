/**
 * Wipe-reveal animation for h1/h2 headings.
 * Splits text by <br> into lines, wraps each in a reveal container,
 * then fires the animation via IntersectionObserver.
 */
(function () {
  'use strict';

  function wrapHeading(el) {
    const raw = el.innerHTML;
    const parts = raw.split(/<br\s*\/?>/i);
    el.innerHTML = parts
      .map(function (part, i) {
        return '<span class="wipe-line" style="--i:' + i + '">'
          + '<span class="wipe-line-in">' + part + '</span>'
          + '</span>';
      })
      .join('');
    el.classList.add('wipe-heading');
  }

  function init() {
    /* Animate only headings outside the configurator panel */
    document.querySelectorAll('h1, h2').forEach(function (el) {
      if (el.closest('#app') || el.closest('.panel')) return;
      wrapHeading(el);
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.wipe-heading').forEach(function (el) {
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
