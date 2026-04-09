/**
 * dev-panel.js — Live tuning panel for carousel + camera
 *
 * Toggle:  ` (backtick) or button bottom-right corner
 * Drag:    drag the panel header
 * Copy:    "Copy" button logs JSON config to console + copies to clipboard
 *
 * Only active when ?dev or #dev is in the URL, OR when
 * localStorage.devPanel === '1'.
 * Force-show: localStorage.setItem('devPanel','1') in console.
 */
(function () {
  'use strict';

  // ── activation guard ──────────────────────────────────────────
  const active =
    location.search.includes('dev') ||
    location.hash.includes('dev')   ||
    localStorage.getItem('devPanel') === '1';

  if (!active) return;

  // ── inject styles ─────────────────────────────────────────────
  const CSS = `
    #dp {
      position: fixed;
      top: 80px; right: 20px;
      z-index: 99999;
      width: 280px;
      background: rgba(18,18,20,0.96);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      font: 11px/1.4 'SF Mono', 'Fira Code', monospace;
      color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      user-select: none;
      transition: opacity .2s;
    }
    #dp.dp-hidden { opacity: 0; pointer-events: none; }

    #dp-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px;
      cursor: move;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    #dp-head span { font-size:12px; font-weight:700; letter-spacing:.06em; color:#fff; }
    #dp-close {
      background:none; border:none; color:#888; font-size:16px;
      cursor:pointer; padding:0 2px; line-height:1;
    }
    #dp-close:hover { color:#fff; }

    #dp-body { padding: 10px 14px 14px; max-height: 80vh; overflow-y: auto; }
    #dp-body::-webkit-scrollbar { width:4px; }
    #dp-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,.2); border-radius:2px; }

    .dp-section {
      margin-bottom: 12px;
    }
    .dp-section-title {
      font-size:9px; letter-spacing:.12em; text-transform:uppercase;
      color:#666; margin-bottom:8px; padding-bottom:4px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .dp-row {
      display: grid;
      grid-template-columns: 72px 1fr 42px;
      align-items: center;
      gap: 6px;
      margin-bottom: 7px;
    }
    .dp-label { color:#aaa; font-size:10px; }
    .dp-val {
      text-align:right; color:#7dd3fc; font-size:10px;
      font-variant-numeric: tabular-nums;
    }

    input[type=range] {
      -webkit-appearance: none;
      width: 100%; height: 3px;
      background: rgba(255,255,255,0.15);
      border-radius:2px; outline:none; cursor:pointer;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance:none;
      width:12px; height:12px;
      border-radius:50%;
      background:#7dd3fc;
      cursor:pointer;
      transition: background .15s;
    }
    input[type=range]:hover::-webkit-slider-thumb { background:#38bdf8; }

    .dp-actions {
      display:flex; gap:8px; margin-top:14px; padding-top:10px;
      border-top:1px solid rgba(255,255,255,0.08);
    }
    .dp-btn {
      flex:1; padding:6px 0; border-radius:6px; border:none;
      font:11px/1 'SF Mono', monospace; cursor:pointer; letter-spacing:.04em;
    }
    .dp-btn-copy  { background:#1e3a5f; color:#7dd3fc; }
    .dp-btn-copy:hover  { background:#1e4a7f; }
    .dp-btn-reset { background:#2a1a1a; color:#f87171; }
    .dp-btn-reset:hover { background:#3a2020; }

    #dp-toggle {
      position:fixed; bottom:24px; right:24px; z-index:99998;
      width:36px; height:36px; border-radius:50%;
      background:rgba(18,18,20,0.9); border:1px solid rgba(255,255,255,0.2);
      color:#7dd3fc; font-size:16px; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 12px rgba(0,0,0,.5);
      transition: background .15s;
    }
    #dp-toggle:hover { background:rgba(30,30,34,0.98); }
  `;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── defaults (mirror hero-carousel.js + camera.js values) ─────
  const isMob = window.innerWidth <= 768;
  const DEFAULTS = {
    cfg: {
      cyOffset: isMob ? -0.5 : 0,
      radius:   isMob ? 12.5 : 6.5,
    },
    cam: isMob ? {
      phi:    1.57,
      radius: 8.5,
      theta:  0.00,
      cx:     0.00,
      cy:     0.50,
    } : {
      phi:    1.57,
      radius: 6.5,
      theta:  0.00,
      cx:     0.00,
      cy:     1.40,
    },
    carousel: isMob ? {
      R:       6.9,
      thetaS:  0.54,
      scaleS:  0.87,
      dimS:    0.70,
      pause:   2200,
      dur:     2000,
    } : {
      R:       10.5,
      thetaS:  0.54,
      scaleS:  0.87,
      dimS:    0.70,
      pause:   2200,
      dur:     2000,
    },
  };

  // ── slider definitions ────────────────────────────────────────
  const CFG_SLIDERS = [
    { key:'cyOffset', label:'scene lift',  min:-2.0, max:2.0, step:0.05 },
    { key:'radius',   label:'zoom out',    min:3,    max:22,  step:0.5  },
  ];

  const CAM_SLIDERS = [
    { key:'phi',    label:'phi (vert)',   min:0.60,  max:1.57, step:0.01 },
    { key:'radius', label:'radius',       min:4,     max:25,   step:0.5  },
    { key:'theta',  label:'theta (horiz)',min:-0.8,  max:0.8,  step:0.01 },
    { key:'cy',     label:'look-at Y',    min:-1,    max:4,    step:0.1  },
  ];

  const CAR_SLIDERS = [
    { key:'R',       label:'orbit R (m)',  min:3,    max:12,   step:0.1  },
    { key:'thetaS',  label:'θ side (rad)', min:0.3,  max:1.57, step:0.01 },
    { key:'scaleS',  label:'scale side',   min:0.4,  max:1.0,  step:0.01 },
    { key:'dimS',    label:'dim side',     min:0.0,  max:1.0,  step:0.01 },
    { key:'pause',   label:'pause (ms)',   min:1000, max:8000, step:100  },
    { key:'dur',     label:'duration (ms)',min:500,  max:4000, step:100  },
  ];

  // ── build panel HTML ──────────────────────────────────────────
  function _fmt(v, step) {
    if (step < 0.1) return v.toFixed(2);
    if (step < 1)   return v.toFixed(1);
    return Math.round(v).toString();
  }

  function _makeSection(title, sliders, namespace) {
    let html = `<div class="dp-section">
      <div class="dp-section-title">${title}</div>`;
    sliders.forEach(s => {
      const id  = `dp-${namespace}-${s.key}`;
      const def = DEFAULTS[namespace][s.key];
      html += `
        <div class="dp-row">
          <label class="dp-label" for="${id}">${s.label}</label>
          <input type="range" id="${id}"
            min="${s.min}" max="${s.max}" step="${s.step}"
            value="${def}">
          <span class="dp-val" id="${id}-val">${_fmt(def, s.step)}</span>
        </div>`;
    });
    html += '</div>';
    return html;
  }

  const panel = document.createElement('div');
  panel.id = 'dp';
  panel.innerHTML = `
    <div id="dp-head">
      <span>🎛 DEV PANEL</span>
      <button id="dp-close" title="Close (or press \`)">✕</button>
    </div>
    <div id="dp-body">
      ${_makeSection('CONFIG SCENE', CFG_SLIDERS, 'cfg')}
      ${_makeSection('HERO CAMERA', CAM_SLIDERS, 'cam')}
      ${_makeSection('CAROUSEL', CAR_SLIDERS, 'carousel')}
      <div class="dp-actions">
        <button class="dp-btn dp-btn-copy"  id="dp-copy">Copy config</button>
        <button class="dp-btn dp-btn-reset" id="dp-reset">Reset</button>
      </div>
    </div>`;

  document.body.appendChild(panel);

  // ── toggle button ─────────────────────────────────────────────
  const toggle = document.createElement('button');
  toggle.id = 'dp-toggle';
  toggle.title = 'Dev panel (`)';
  toggle.textContent = '🎛';
  document.body.appendChild(toggle);

  // ── show / hide ───────────────────────────────────────────────
  let visible = true;
  function _show(v) {
    visible = v;
    panel.classList.toggle('dp-hidden', !v);
    toggle.style.opacity = v ? '0' : '1';
    toggle.style.pointerEvents = v ? 'none' : 'auto';
  }
  toggle.addEventListener('click', () => _show(true));
  document.getElementById('dp-close').addEventListener('click', () => _show(false));
  document.addEventListener('keydown', e => {
    if (e.key === '`' || e.key === '~') _show(!visible);
  });

  // ── live update helpers ───────────────────────────────────────
  function _cfgApply() {
    if (typeof CAM === 'undefined') return;
    const offset = parseFloat(document.getElementById('dp-cfg-cyOffset').value);
    const r      = parseFloat(document.getElementById('dp-cfg-radius').value);
    const H      = (typeof ST !== 'undefined') ? ST.height : 2.0;
    if (typeof _cfgCyOffset !== 'undefined') _cfgCyOffset = offset;
    CAM.tCy     = H / 2 + offset;
    CAM.tRadius = r;
    CAM.speed   = 0.12;
    if (typeof invalidate === 'function') invalidate();
  }

  function _camApply() {
    if (typeof CAM === 'undefined') return;
    CAM.tPhi    = parseFloat(document.getElementById('dp-cam-phi').value);
    CAM.tRadius = parseFloat(document.getElementById('dp-cam-radius').value);
    CAM.tTheta  = parseFloat(document.getElementById('dp-cam-theta').value);
    CAM.tCy     = parseFloat(document.getElementById('dp-cam-cy').value);
    CAM.tCx     = parseFloat(document.getElementById('dp-cam-cx') ? document.getElementById('dp-cam-cx').value : 0);
    CAM.speed   = 0.12;
    if (typeof invalidate === 'function') invalidate();
  }

  function _carApply() {
    if (typeof heroCarousel === 'undefined') return;
    const cfg = heroCarousel.cfg;
    cfg.R       = parseFloat(document.getElementById('dp-carousel-R').value);
    cfg.thetaS  = parseFloat(document.getElementById('dp-carousel-thetaS').value);
    cfg.scaleS  = parseFloat(document.getElementById('dp-carousel-scaleS').value);
    cfg.dimS    = parseFloat(document.getElementById('dp-carousel-dimS').value);
    cfg.pause   = parseFloat(document.getElementById('dp-carousel-pause').value);
    cfg.dur     = parseFloat(document.getElementById('dp-carousel-dur').value);
    heroCarousel.reapply();
  }

  // ── bind sliders ──────────────────────────────────────────────
  function _bindSliders(sliders, namespace, applyFn) {
    sliders.forEach(s => {
      const id    = `dp-${namespace}-${s.key}`;
      const input = document.getElementById(id);
      const val   = document.getElementById(`${id}-val`);
      input.addEventListener('input', () => {
        val.textContent = _fmt(parseFloat(input.value), s.step);
        applyFn();
      });
    });
  }

  _bindSliders(CFG_SLIDERS, 'cfg', _cfgApply);
  _bindSliders(CAM_SLIDERS, 'cam', _camApply);
  _bindSliders(CAR_SLIDERS, 'carousel', _carApply);

  // ── copy config ───────────────────────────────────────────────
  document.getElementById('dp-copy').addEventListener('click', () => {
    const cfg = {
      camera: {
        phi:    parseFloat(document.getElementById('dp-cam-phi').value),
        radius: parseFloat(document.getElementById('dp-cam-radius').value),
        theta:  parseFloat(document.getElementById('dp-cam-theta').value),
        cy:     parseFloat(document.getElementById('dp-cam-cy').value),
      },
      carousel: typeof heroCarousel !== 'undefined'
        ? { ...heroCarousel.cfg }
        : {},
    };
    const json = JSON.stringify(cfg, null, 2);
    console.log('%c[DEV PANEL] Current config:', 'color:#7dd3fc;font-weight:bold');
    console.log(json);

    // Fallback copy that works on http:// (no secure context required)
    function _copyText(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      // execCommand fallback for http / local dev servers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve();
    }

    _copyText(json).then(() => {
      const btn = document.getElementById('dp-copy');
      btn.textContent = 'Copied ✓';
      setTimeout(() => btn.textContent = 'Copy config', 1500);
    });
  });

  // ── reset to defaults ─────────────────────────────────────────
  document.getElementById('dp-reset').addEventListener('click', () => {
    CFG_SLIDERS.forEach(s => {
      const id  = `dp-cfg-${s.key}`;
      const inp = document.getElementById(id);
      const val = document.getElementById(`${id}-val`);
      inp.value       = DEFAULTS.cfg[s.key];
      val.textContent = _fmt(DEFAULTS.cfg[s.key], s.step);
    });
    CAM_SLIDERS.forEach(s => {
      const id  = `dp-cam-${s.key}`;
      const inp = document.getElementById(id);
      const val = document.getElementById(`${id}-val`);
      inp.value       = DEFAULTS.cam[s.key];
      val.textContent = _fmt(DEFAULTS.cam[s.key], s.step);
    });
    CAR_SLIDERS.forEach(s => {
      const id  = `dp-carousel-${s.key}`;
      const inp = document.getElementById(id);
      const val = document.getElementById(`${id}-val`);
      inp.value       = DEFAULTS.carousel[s.key];
      val.textContent = _fmt(DEFAULTS.carousel[s.key], s.step);
    });
    _cfgApply();
    _camApply();
    _carApply();
  });

  // ── drag to move panel ────────────────────────────────────────
  const head = document.getElementById('dp-head');
  let _drag = null;
  head.addEventListener('mousedown', e => {
    if (e.target.id === 'dp-close') return;
    const r = panel.getBoundingClientRect();
    _drag = { ox: e.clientX - r.left, oy: e.clientY - r.top };
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!_drag) return;
    panel.style.left  = (e.clientX - _drag.ox) + 'px';
    panel.style.top   = (e.clientY - _drag.oy) + 'px';
    panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { _drag = null; });

  // ── sync sliders to live values on first open ─────────────────
  //    (in case camera was already moved before panel was shown)
  function _syncFromLive() {
    const set = (id, v, step) => {
      const inp = document.getElementById(id);
      const lbl = document.getElementById(`${id}-val`);
      if (inp) { inp.value = v; lbl.textContent = _fmt(v, step); }
    };
    if (typeof CAM !== 'undefined') {
      set('dp-cam-phi',    CAM.phi,    0.01);
      set('dp-cam-radius', CAM.radius, 0.5);
      set('dp-cam-theta',  CAM.theta,  0.01);
      set('dp-cam-cy',     CAM.cy,     0.1);
    }
    if (typeof _cfgCyOffset !== 'undefined') {
      set('dp-cfg-cyOffset', _cfgCyOffset, 0.05);
    }
    if (typeof CAM !== 'undefined') {
      set('dp-cfg-radius', CAM.radius, 0.5);
    }
  }

  // Sync after a short delay to let main.js init finish
  setTimeout(_syncFromLive, 800);

  console.log('%c[DEV PANEL] Active — press ` to toggle', 'color:#7dd3fc;font-weight:bold');

}());
