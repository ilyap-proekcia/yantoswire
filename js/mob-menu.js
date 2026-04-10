/**
 * mob-menu.js — Mobile menu morphing animation
 *
 * Phase 1 (open):  small square → large marsala panel (CSS transition)
 * Phase 2 (open):  stagger reveal of inner content (CSS class + delays)
 *
 * Phase 1 (close): hide content fast
 * Phase 2 (close): panel collapses back to square
 *
 * Only active on mobile (≤ 768px). Safe to load on all pages.
 */
(function () {
  'use strict';

  if (window.innerWidth > 768) return;

  const menu    = document.getElementById('mob-menu');
  if (!menu) return;

  const trigger  = menu.querySelector('.mm-trigger');
  const closeBtn = menu.querySelector('.mm-close');
  const navLinks = menu.querySelectorAll('.mm-nav-item');
  const callback = menu.querySelector('.mm-callback');

  // Timing constants (must match CSS transition durations)
  const EXPAND_DUR    = 480;  // ms — container expand (CSS: 0.48s)
  const CONTENT_DELAY = 320;  // ms after open start → show content
  const CONTENT_OUT   = 200;  // ms to wait for content to hide before collapsing
  const COLLAPSE_DUR  = 420;  // ms — container collapse

  let isOpen    = false;
  let animTimer = null;

  // ── Open ─────────────────────────────────────────────────────
  function open() {
    if (isOpen) return;
    isOpen = true;
    clearTimeout(animTimer);

    menu.classList.add('mm-open');
    menu.setAttribute('aria-hidden', 'false');

    // Phase 2: reveal content after container is large enough
    animTimer = setTimeout(function () {
      menu.classList.remove('mm-closing');
      menu.classList.add('mm-content-visible');
    }, CONTENT_DELAY);
  }

  // ── Close ────────────────────────────────────────────────────
  function close() {
    if (!isOpen) return;
    isOpen = false;
    clearTimeout(animTimer);

    // Phase 1: hide content fast
    menu.classList.remove('mm-content-visible');
    menu.classList.add('mm-closing');

    // Phase 2: collapse container after content is gone
    animTimer = setTimeout(function () {
      menu.classList.remove('mm-open');
      menu.classList.remove('mm-closing');
      menu.setAttribute('aria-hidden', 'true');
    }, CONTENT_OUT);
  }

  // ── Events ───────────────────────────────────────────────────
  trigger.addEventListener('click', open);
  trigger.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  closeBtn.addEventListener('click', close);

  // Close when a nav link is tapped
  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      // Small delay so the tap registers before menu disappears
      setTimeout(close, 80);
    });
  });

  // Callback button — close and navigate (customize href as needed)
  if (callback) {
    callback.addEventListener('click', function () {
      close();
      setTimeout(function () {
        var modal = document.getElementById('callback-modal');
        if (modal) modal.classList.add('cbm--open');
      }, CONTENT_OUT + COLLAPSE_DUR);
    });
  }

  // ESC key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

}());
