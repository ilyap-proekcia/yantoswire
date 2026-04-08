/**
 * ui.js — Form step navigation & selection helpers
 *
 * Manages the 5-step configurator panel:
 *   goStep(n)                 — jump to step n (0-based)
 *   selectRadio(groupId, el, stateKey, val) — single-select list card
 *   selectGrid(groupId, el, stateKey, val)  — single-select grid card
 *   submitForm()              — show success screen
 *   restartForm()             — reset to step 0
 */

// ─── STEP NAVIGATION ─────────────────────────────────────────
const STEP_LABELS = ['Розмір', 'Комплектація', 'Доставка', 'Стиль', 'Колір', 'Контакти'];

// Animation timings (ms)
const SB_COLLAPSE = 210;
const SB_EXPAND   = 250;
const SB_LABEL    = 160;
let _sbCleanup = null;

function _sbClear(item) {
  item.style.flex = item.style.width = item.style.background = item.style.transition = '';
}

function goStep(n) {
  // ── Switch step content ──
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sp-item').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
  const target = document.getElementById('step-' + n);
  if (target) target.classList.add('active');

  // ── Step bar ──
  const items    = Array.from(document.querySelectorAll('.step-bar__item'));
  const fromItem = items.find(i => i.classList.contains('is-active'));
  const toItem   = items.find(i => parseInt(i.dataset.step, 10) === n);

  // Abort previous animation
  if (_sbCleanup) { _sbCleanup(); _sbCleanup = null; }

  if (!fromItem || !toItem || fromItem === toItem) {
    items.forEach(item => {
      const s = parseInt(item.dataset.step, 10);
      item.classList.toggle('is-active', s === n);
      item.classList.toggle('is-done',   s < n);
    });
    return;
  }

  const fromLabel = fromItem.querySelector('.step-bar__label');
  const toLabel   = toItem.querySelector('.step-bar__label');
  const expandedW = fromItem.getBoundingClientRect().width;
  const refItem   = items.find(i => i !== fromItem && i !== toItem);
  const compactW  = refItem ? refItem.getBoundingClientRect().width : 48;

  const timers = [];
  _sbCleanup = () => {
    timers.forEach(clearTimeout);
    [fromItem, toItem].forEach(_sbClear);
    [fromLabel, toLabel].forEach(l => { l.style.opacity = l.style.transition = ''; });
    items.forEach(item => {
      const s = parseInt(item.dataset.step, 10);
      item.classList.toggle('is-active', s === n);
      item.classList.toggle('is-done',   s < n);
    });
    _sbCleanup = null;
  };

  // ── PHASE 1: Collapse from-item ────────────────────────────
  fromLabel.style.transition = 'none';
  fromLabel.style.opacity    = '0';
  fromItem.style.transition  = 'none';
  fromItem.style.flex        = 'none';
  fromItem.style.width       = expandedW + 'px';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const doneBg = n > parseInt(fromItem.dataset.step, 10) ? 'var(--sandstone)' : '#EEEEEE';
    fromItem.style.transition = `width ${SB_COLLAPSE}ms cubic-bezier(0.4,0,0.2,1),`
                               + `background ${SB_COLLAPSE}ms ease`;
    fromItem.style.width      = compactW + 'px';
    fromItem.style.background = doneBg;
  }));

  // ── PHASE 2: Expand to-item ────────────────────────────────
  const t1 = setTimeout(() => {
    // Update all class states
    items.forEach(item => {
      const s = parseInt(item.dataset.step, 10);
      item.classList.remove('is-active', 'is-done');
      if (s === n) item.classList.add('is-active');
      else if (s < n) item.classList.add('is-done');
      if (item !== toItem && item !== fromItem) _sbClear(item);
    });
    _sbClear(fromItem);
    fromLabel.style.transition = fromLabel.style.opacity = '';

    // Pin to-item at compact, hide label
    toLabel.style.transition = 'none';
    toLabel.style.opacity    = '0';
    toItem.style.transition  = 'none';
    toItem.style.flex        = 'none';
    toItem.style.width       = compactW + 'px';

    requestAnimationFrame(() => requestAnimationFrame(() => {
      toItem.style.transition = `width ${SB_EXPAND}ms cubic-bezier(0.4,0,0.2,1)`;
      toItem.style.width      = expandedW + 'px';
    }));

    // ── PHASE 3: Fade in label at ~55% of expand ───────────
    const t2 = setTimeout(() => {
      toLabel.style.transition = `opacity ${SB_LABEL}ms ease`;
      toLabel.style.opacity    = '1';

      // ── PHASE 4: Cleanup ───────────────────────────────────
      const t3 = setTimeout(() => {
        _sbClear(toItem);
        toLabel.style.transition = toLabel.style.opacity = '';
        _sbCleanup = null;
      }, SB_LABEL + 30);
      timers.push(t3);
    }, Math.round(SB_EXPAND * 0.55));
    timers.push(t2);
  }, SB_COLLAPSE + 20);
  timers.push(t1);
}

// ─── RADIO CARD SELECTION (list layout) ──────────────────────
function selectRadio(groupId, el, stateKey, val) {
  document.getElementById(groupId)
    .querySelectorAll('.radio-card')
    .forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  ST[stateKey] = val;
}

// ─── GRID CARD SELECTION (2×2 layout) ────────────────────────
function selectGrid(groupId, el, stateKey, val) {
  document.getElementById(groupId)
    .querySelectorAll('.rg-card')
    .forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  ST[stateKey] = val;

  // Rebuild the 3D fence whenever package or style changes
  if (stateKey === 'package' || stateKey === 'fenceStyle') buildFence();
  if (stateKey === 'fenceStyle') updateStyleSettings();
}

// ─── STYLE-SPECIFIC SETTINGS ──────────────────────────────────
// Shows/hides the matching settings panel for the current fence style
function updateStyleSettings() {
  document.querySelectorAll('.style-section').forEach(el => el.style.display = 'none');
  const panel = document.getElementById('ss-' + ST.fenceStyle);
  if (panel) {
    panel.style.display = 'block';
    syncFP4Settings();
  }
}

// Sync displayed values to actual FENCE_STYLES[4] values
function syncFP4Settings() {
  if (ST.fenceStyle !== 4) return;
  const fp = FENCE_STYLES[4];
  const el = id => document.getElementById(id);
  if (el('ss-barCount'))  el('ss-barCount').textContent  = fp.barCount || 9;
  if (el('ss-barBotMar')) el('ss-barBotMar').textContent = Math.round((fp.barBotMar || 0.030) * 1000);
}

// ── Слайдери секції стилю 4 ───────────────────────────────────
function ss4BarCount(v) {
  FENCE_STYLES[4].barCount = +v;
  document.getElementById('ss-barCount').textContent = v + ' шт';
  if (ST.fenceStyle === 4) buildFence();
}
function ss4BarBotMar(v) {
  FENCE_STYLES[4].barBotMar = +v / 1000;
  document.getElementById('ss-barBotMar').textContent = v + ' мм';
  if (ST.fenceStyle === 4) buildFence();
}
function ss4StileExt(v) {
  FENCE_STYLES[4].stileExt = +v / 1000;
  document.getElementById('ss-stileExt').textContent = v + ' мм';
  if (ST.fenceStyle === 4) buildFence();
}

// ─── COLOR SELECTION (Step 4) ─────────────────────────────────
const FENCE_COLORS = [
  { hex: '#114232', name: 'Зелений',    ral: 'RAL 6005' },
  { hex: '#374145', name: 'Антрацит',   ral: 'RAL 7016' },
  { hex: '#44322D', name: 'Коричневий', ral: 'RAL 8017' },
  { hex: '#0D0D0D', name: 'Чорний',     ral: 'RAL 9005' },
];

function selectColor(el, hex, name, ral) {
  document.querySelectorAll('#color-grid .color-card')
    .forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  ST.color     = hex;
  ST.colorName = name + ' ' + ral;
  buildFence();
}

// ─── FORM SUBMIT ──────────────────────────────────────────────
function submitForm() {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sp-item').forEach(el => el.classList.add('done'));
  document.getElementById('success-screen').classList.add('active');
}

// ─── RESTART ─────────────────────────────────────────────────
function restartForm() {
  document.getElementById('success-screen').classList.remove('active');
  goStep(0);
}

// ─── MOBILE DRAWER INIT ───────────────────────────────────────
// Currently a no-op; panel scrolls naturally in its fixed bottom slot.
// Extend this if a pull-up handle is added later.
function initMobileDrawer() {}

// ─── ANIMATED COUNTER ────────────────────────────────────────
function initCounters() {
  const CONFIGS = {
    'dim-length-val': { dim: 'length', min: 2,   max: Infinity, step: 1   },
    'dim-height-val': { dim: 'height', min: 0.5, max: 4,   step: 0.5 }
  };

  Object.entries(CONFIGS).forEach(([id, cfg]) => {
    const el = document.getElementById(id);
    if (!el || el.querySelector('.dim-slot')) return;

    // Slot
    const slot = document.createElement('span');
    slot.className = 'dim-slot';
    slot.textContent = el.textContent.trim();
    el.textContent = '';
    el.appendChild(slot);

    // Input (type=text so cursor stays centered when empty)
    const input = document.createElement('input');
    input.className = 'dim-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    el.appendChild(input);

    // Open editor on click
    el.addEventListener('click', () => {
      if (input.style.display === 'block') return;
      const s = el.querySelector('.dim-slot');
      if (s) s.style.opacity = '0';
      input.value = cfg.dim === 'length' ? ST.length : ST.height;
      input._dirty = false;
      input.style.display = 'block';
      input.focus();
      input.select();
    });

    // Commit — only applies if user actually typed something
    function commit() {
      input.style.display = 'none';
      const s = el.querySelector('.dim-slot');
      if (s) s.style.opacity = '1';

      if (!input._dirty) return;
      input._dirty = false;

      let val = parseFloat(input.value);
      const current = cfg.dim === 'length' ? ST.length : ST.height;
      if (isNaN(val)) return;
      val = Math.round(val / cfg.step) * cfg.step;
      val = Math.max(cfg.min, Math.min(cfg.max, val));

      if (val !== current) {
        const goingUp = val > current;
        if (cfg.dim === 'length') {
          ST.length = val;
          document.getElementById('f-length').value = val;
        } else {
          ST.height = val;
          document.getElementById('f-height').value = val;
        }
        setCounterValue(el, val, goingUp);
        buildFence();
      }
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input._dirty = false; input.blur(); }
    });
    // Allow only digits (and decimal separator for height); mark dirty
    input.addEventListener('input', () => {
      input._dirty = true;
      const allowDecimal = cfg.step < 1;
      const clean = allowDecimal
        ? input.value.replace(/[^0-9.,]/g, '').replace(',', '.')
        : input.value.replace(/[^0-9]/g, '');
      if (input.value !== clean) input.value = clean;
    });
  });
}

function setCounterValue(el, newVal, goingUp) {
  // Cancel any pending entrance (rapid clicks)
  if (el._cTimer) { clearTimeout(el._cTimer); el._cTimer = null; }

  const outY = goingUp ? '-120%' : '120%';
  const inY  = goingUp ?  '120%' : '-120%';

  const newSlot = document.createElement('span');
  newSlot.className = 'dim-slot';
  newSlot.textContent = newVal;
  newSlot.style.transform = `translateY(${inY})`;

  const oldSlot = el.querySelector('.dim-slot');

  if (oldSlot) {
    // Exit old first — then enter new (no overlap)
    oldSlot.style.transition = 'transform 0.15s cubic-bezier(0.4,0,1,1)';
    oldSlot.style.transform  = `translateY(${outY})`;

    el._cTimer = setTimeout(() => {
      oldSlot.remove();
      el.appendChild(newSlot);
      void newSlot.offsetHeight;
      newSlot.style.transition = 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)';
      newSlot.style.transform  = 'translateY(0)';
      el._cTimer = null;
    }, 150);
  } else {
    el.appendChild(newSlot);
    void newSlot.offsetHeight;
    newSlot.style.transition = 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)';
    newSlot.style.transform  = 'translateY(0)';
  }
}

// ─── DIMENSION ADJUSTER (Step 0) ─────────────────────────────
function adjDim(dim, delta) {
  if (dim === 'length') {
    ST.length = Math.max(2, ST.length + delta);
    const el = document.getElementById('dim-length-val');
    if (el) setCounterValue(el, ST.length, delta > 0);
    const inp = document.getElementById('f-length');
    if (inp) inp.value = ST.length;
  } else {
    ST.height = Math.max(0.5, Math.min(4, Math.round((ST.height + delta) * 10) / 10));
    const el = document.getElementById('dim-height-val');
    if (el) setCounterValue(el, ST.height, delta > 0);
    const inp = document.getElementById('f-height');
    if (inp) inp.value = ST.height;
  }
  buildFence();
}

// ─── PACKAGE SELECTION (Step 1) ──────────────────────────────
function selectPkg(el, val) {
  document.querySelectorAll('#rg-package .pkg-card')
    .forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  ST.package = val;
  buildFence();
}

// ─── FENCE STYLE SELECTION (Step 3 accordion) ────────────────
function selectStyle(el, styleNum) {
  document.querySelectorAll('#rg-style .style-card')
    .forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  ST.fenceStyle = styleNum;
  buildFence();
  updateStyleSettings();
}

// ─── ACCORDION SELECTION (Step 3) ────────────────────────────
function selectAccord(type) {
  ST.orderType = type;
  // Update radio states
  document.querySelectorAll('.accord-head').forEach(h => {
    h.classList.remove('accord-head--on');
    h.querySelector('.accord-radio').classList.remove('accord-radio--on');
  });
  // Open/close accordion bodies
  document.querySelectorAll('.accord-item').forEach(i => i.classList.remove('accord-open'));
  const item = document.getElementById('acc-' + type);
  if (item) {
    const head = item.querySelector('.accord-head');
    head.classList.add('accord-head--on');
    head.querySelector('.accord-radio').classList.add('accord-radio--on');
    if (type === 'standard') item.classList.add('accord-open');
  }
}
