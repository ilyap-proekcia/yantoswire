/**
 * Wipe-reveal animation for h1/h2 headings.
 * Detects actual rendered visual lines via word position measurement,
 * so the number of wipe strips always matches the real rendered rows.
 */
(function () {
  'use strict';

  function buildLines(el) {
    /* Use innerHTML to preserve &nbsp; — split only on regular spaces/whitespace,
       keeping &nbsp; glued to adjacent words */
    var raw = el.innerHTML.trim();
    /* Split on whitespace but NOT on &nbsp; (\u00a0) */
    var tokens = raw.split(/[ \t\r\n]+/).filter(Boolean);
    if (!tokens.length) return;

    /* Temporarily render each token as an inline-block span to measure position */
    el.innerHTML = tokens.map(function (w) {
      return '<span style="display:inline-block">' + w + '</span>';
    }).join(' ');

    var wordEls = Array.prototype.slice.call(el.children);
    var lines = [];
    var curLine = [];
    var curTop = null;

    wordEls.forEach(function (span) {
      var top = Math.round(span.getBoundingClientRect().top);
      if (curTop === null) {
        curTop = top;
      } else if (Math.abs(top - curTop) > 4) {
        lines.push(curLine);
        curLine = [];
        curTop = top;
      }
      curLine.push(span.textContent);
    });
    if (curLine.length) lines.push(curLine);

    /* Rebuild with wipe-line wrappers */
    el.innerHTML = lines.map(function (lineWords, i) {
      return '<span class="wipe-line" style="--i:' + i + '">'
        + '<span class="wipe-line-in">' + lineWords.join(' ') + '</span>'
        + '</span>';
    }).join('');

    el.classList.add('wipe-heading');
  }

  function init() {
    document.querySelectorAll('h1, h2, .js-wipe-heading').forEach(function (el) {
      if (el.closest('#app') || el.closest('.panel')) return;
      if (el.classList.contains('contacts-title')) return;
      buildLines(el);
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
