/**
 * camera.js — Camera state, smooth interpolation & orbit controls
 *
 * CAM stores current and target spherical coordinates.
 * applyCamera() converts them to a Cartesian position each frame.
 * lerpCam()     smoothly moves current → target each frame.
 *
 * Mouse orbit is enabled after the hero-to-configurator transition
 * via enableOrbit(). Touch orbit is enabled on mobile via initTouchOrbit().
 */

const isMob = window.innerWidth <= 768;

// ═══════════════════════════════════════════════════════════════
// ─── НАСТРОЙКИ КАМЕРЫ ─────────────────────────────────────────
//
// Здесь задаётся начальная (hero) и конечная (configurator) позиции.
// Измени значения → обнови страницу → смотри результат.
//
// theta  — горизонтальный угол:  < 0 левее,  > 0 правее
// phi    — вертикальный угол:    1.0 = высоко, 1.57 = уровень глаз
// radius — расстояние до забора: меньше = крупнее
// cx     — горизонтальный сдвиг точки взгляда
// cy     — вертикальный сдвиг точки взгляда
//
const CAM_CONFIG = {

  // ── Стартовая позиция (hero-экран / orbital carousel) ───────
  // phi < π/2 даёт вид немного сверху — видна орбитальная глубина (z-offset боковых)
  // radius достаточно большой чтобы охватить все 3 забора
  hero: {
    desktop: { theta: 0, phi: 1.57, radius:  6.5, cx: 0, cy: 1.4 },
    mobile:  { theta: 0, phi: 1.57, radius:  8.5, cx: 0, cy: 0.5 },
  },

  // ── Конечная позиция (конфигуратор) ─────────────────────────
  // ↓ Меняй эти значения чтобы подобрать нужный ракурс
  config: {
    desktop: { theta:  0.24, phi: 1.42, radius:  6.5, cx:  0.0, cy: 1.0, cyOffset:  0.0 },
    mobile:  { theta: -0.30, phi: 1.31, radius: 12.5, cx:  0.0, cy: 1.0, cyOffset: -0.5 },
  },

  // ── Длительность перехода hero → configurator (миллисекунды) ──
  // 1200 = быстро, 2000 = кинематографично, 3000 = очень медленно
  transitionDuration: 1800,

};
// ═══════════════════════════════════════════════════════════════

// ─── CAMERA STATE ─────────────────────────────────────────────
const _hero = isMob ? CAM_CONFIG.hero.mobile : CAM_CONFIG.hero.desktop;
const CAM = {
  theta:  _hero.theta,
  phi:    _hero.phi,
  radius: _hero.radius,
  cx:     _hero.cx,
  cy:     _hero.cy,

  tTheta:  _hero.theta,
  tPhi:    _hero.phi,
  tRadius: _hero.radius,
  tCx:     _hero.cx,
  tCy:     _hero.cy,

  speed: 0.055  // lerp factor (overridden during transition)
};

// Convert spherical → Cartesian and position the camera
function applyCamera() {
  const sp = Math.sin(CAM.phi),   cp = Math.cos(CAM.phi);
  const st = Math.sin(CAM.theta), ct = Math.cos(CAM.theta);
  camera.position.set(
    CAM.cx + CAM.radius * sp * st,
    CAM.cy + CAM.radius * cp,
    CAM.radius * sp * ct
  );
  camera.lookAt(CAM.cx, CAM.cy, 0);
}

// ─── EASING TRANSITION ────────────────────────────────────────
// Плавное ускорение в начале и торможение в конце (ease-in-out cubic)
function _easeInOut(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
}

let _trans = null; // активный easing-переход

// ─── VIEWPORT CENTERING (projection-based) ────────────────────
// Shifts camera.setViewOffset so the fence appears centred in the VISIBLE
// portion of the canvas — works at any orbit angle and any zoom level.
//
//   Desktop : right panel 460 px  → shift principal ray LEFT  by 230 px
//   Mobile  : bottom panel 55–58% → shift principal ray UP by panel/2 px
//
// setViewOffset(fullW, fullH, x, y, w, h):
//   renders sub-region [x,y] of a virtual fullW×fullH canvas.
//   principal ray (world origin) lands at screen coords
//     ((fullW/2 − x)/w·screenW,  (fullH/2 − y)/h·screenH)
//   → setting x = panelW/2     centres the fence in the left visible strip
//   → setting y = screenH/2 − visCtrY  centres it in the top visible strip
function updateCameraViewOffset() {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  if (screenW > 900) {
    // Desktop: shift principal ray by half the actual panel width
    const panelEl = document.querySelector('.panel');
    const panelW  = panelEl ? panelEl.offsetWidth : 460;
    camera.setViewOffset(screenW, screenH, Math.round(panelW / 2), 0, screenW, screenH);
  } else {
    // Mobile: bottom panel occupies 55 % (58 % on narrow phones)
    const ratio   = screenW <= 420 ? 0.58 : 0.55;
    const panelH  = screenH * ratio;
    const headerH = 50; // CSS .site-header { height: 50px }
    const visH    = screenH - panelH - headerH;
    const visCtrY = headerH + visH / 2;
    const shift   = Math.round(screenH / 2 - visCtrY);
    camera.setViewOffset(screenW, screenH, 0, shift, screenW, screenH);
  }
}

function clearCameraViewOffset() {
  camera.clearViewOffset();
}

// ─── CONFIG CAMERA FIT ────────────────────────────────────────
// Dev-panel adjustable offset (additive, controlled via _cfgCyOffset)
let _cfgCyOffset = 0;

// Call every time fence height changes (from buildFence / adjDim).
// Centres look-at on the fence mid-height and gently zooms out for taller fences.
function adjustCameraToFence() {
  if (typeof appMode === 'undefined' || appMode !== 'config') return;
  const H   = (typeof ST !== 'undefined') ? ST.height : 2.0;
  const cfg = isMob ? CAM_CONFIG.config.mobile : CAM_CONFIG.config.desktop;
  const dH  = Math.max(0, H - 2.0);
  const kR  = isMob ? 1.5 : 0.8; // radius increase per metre above 2 m
  CAM.tCx     = 0;
  CAM.tCy     = H / 2 + (cfg.cyOffset || 0) + _cfgCyOffset;
  CAM.tRadius = cfg.radius + dH * kR;
  CAM.speed   = 0.08;
  invalidate();
}

// Returns hero→config transition progress 0..1, or -1 when no transition is active
function getCameraTransProgress() {
  if (!_trans) return -1;
  return Math.min(1, (performance.now() - _trans.t0) / _trans.dur);
}

// Apply a partial viewOffset for smooth centering during the hero→config transition.
// t=0 → no offset (hero),  t=1 → full offset (config).
// Uses the same easing curve as the camera transition.
function applyPartialViewOffset(t) {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const e = _easeInOut(Math.max(0, Math.min(1, t)));

  if (screenW > 900) {
    const panelEl = document.querySelector('.panel');
    const panelW  = panelEl ? panelEl.offsetWidth : 460;
    const shift   = Math.round((panelW / 2) * e);
    camera.setViewOffset(screenW, screenH, shift, 0, screenW, screenH);
  } else {
    const ratio      = screenW <= 420 ? 0.58 : 0.55;
    const panelH     = screenH * ratio;
    const headerH    = 50;
    const visH       = screenH - panelH - headerH;
    const visCtrY    = headerH + visH / 2;
    const fullShift  = Math.round(screenH / 2 - visCtrY);
    camera.setViewOffset(screenW, screenH, 0, Math.round(fullShift * e), screenW, screenH);
  }
}

// Запустить плавный кинематографичный переход камеры к dest за duration мс
function startCameraTransition(dest) {
  _trans = {
    s:   { theta: CAM.theta, phi: CAM.phi, radius: CAM.radius, cx: CAM.cx, cy: CAM.cy },
    d:   dest,
    dur: CAM_CONFIG.transitionDuration,
    t0:  performance.now()
  };
  // Синхронизируем targets чтобы orbit-lerp не мешал
  CAM.tTheta = CAM.theta; CAM.tPhi = CAM.phi;
  CAM.tRadius = CAM.radius; CAM.tCx = CAM.cx; CAM.tCy = CAM.cy;
}

// Smoothly interpolate current values toward targets; returns true while moving
function lerpCam() {

  // ── Easing-переход (hero → configurator) ──────────────────────
  if (_trans) {
    const raw = (performance.now() - _trans.t0) / _trans.dur;
    const t   = Math.min(1, raw);
    const e   = _easeInOut(t);

    CAM.theta  = _trans.s.theta  + (_trans.d.theta  - _trans.s.theta)  * e;
    CAM.phi    = _trans.s.phi    + (_trans.d.phi    - _trans.s.phi)    * e;
    CAM.radius = _trans.s.radius + (_trans.d.radius - _trans.s.radius) * e;
    CAM.cx     = _trans.s.cx    + (_trans.d.cx     - _trans.s.cx)     * e;
    CAM.cy     = _trans.s.cy    + (_trans.d.cy     - _trans.s.cy)     * e;

    // Держим targets в sync — orbit подхватит плавно после окончания
    CAM.tTheta = CAM.theta; CAM.tPhi = CAM.phi;
    CAM.tRadius = CAM.radius; CAM.tCx = CAM.cx; CAM.tCy = CAM.cy;

    if (t >= 1) _trans = null;
    return t < 1;
  }

  // ── Обычный lerp для orbit-управления ─────────────────────────
  const eps = 0.0005;
  let   mv  = false;
  [['theta','tTheta'],['phi','tPhi'],['radius','tRadius'],['cx','tCx'],['cy','tCy']].forEach(([k, t]) => {
    const d = CAM[t] - CAM[k];
    if (Math.abs(d) > eps) { CAM[k] += d * CAM.speed; mv = true; }
    else                     CAM[k]  = CAM[t];
  });
  return mv;
}

// ─── MOUSE ORBIT ──────────────────────────────────────────────
// Called once when the configurator opens
let orbitOn = false;

function enableOrbit() {
  if (orbitOn) return;
  orbitOn = true;

  let dragging = false, lx = 0, ly = 0;
  const vp = document.getElementById('viewport');
  vp.style.cursor = 'grab';

  // No pan — camera always looks at fence center
  vp.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // left button only
    dragging = true;
    lx = e.clientX; ly = e.clientY;
    vp.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    if (orbitOn) document.getElementById('viewport').style.cursor = 'grab';
    CAM.speed = 0.055;
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    CAM.tTheta -= dx * 0.004;
    CAM.tPhi    = Math.max(0.12, Math.min(Math.PI / 2.05, CAM.tPhi - dy * 0.004));
    CAM.speed = 0.35;
    invalidate();
  });

  vp.addEventListener('wheel', e => {
    CAM.tRadius = Math.max(3, Math.min(22, CAM.tRadius + e.deltaY * 0.022));
    CAM.speed   = 0.2;
    invalidate();
    e.preventDefault();
  }, { passive: false });

  vp.addEventListener('contextmenu', e => e.preventDefault());
}

// ─── TOUCH ORBIT (mobile) ─────────────────────────────────────
let touchOrbitActive = false;

function initTouchOrbit() {
  if (touchOrbitActive) return;
  touchOrbitActive = true;

  let t0 = null, lastDist = 0;

  // Skip touches that start on panel / header / form controls
  function isUI(el) {
    return el.closest('.panel, .site-header, select, input, button, textarea');
  }

  document.addEventListener('touchstart', e => {
    if (isUI(e.target)) return;
    if (e.touches.length === 1) {
      t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      t0 = null;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!t0 && e.touches.length < 2) return;
    if (isUI(e.target)) return;
    e.preventDefault();

    if (e.touches.length === 1 && t0) {
      const dx = e.touches[0].clientX - t0.x;
      const dy = e.touches[0].clientY - t0.y;
      t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      CAM.tTheta -= dx * 0.005;
      CAM.tPhi    = Math.max(0.12, Math.min(Math.PI / 2.05, CAM.tPhi - dy * 0.005));
      CAM.speed   = 0.4;
      invalidate();
    } else if (e.touches.length === 2) {
      const dist  = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      CAM.tRadius = Math.max(3, Math.min(22, CAM.tRadius + (lastDist - dist) * 0.05));
      CAM.speed   = 0.25;
      lastDist    = dist;
      invalidate();
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    t0        = null;
    CAM.speed = 0.055;
  }, { passive: true });
}
