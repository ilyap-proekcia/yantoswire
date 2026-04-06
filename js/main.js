/**
 * main.js — Entry point
 *
 * Wires everything together:
 *   - Window resize handler
 *   - Hero → Configurator transition
 *   - Animation loop
 *   - Initial build
 *
 * Script load order in index.html must be:
 *   three.min.js → config.js → scene.js → fence-builder.js → camera.js → ui.js → main.js
 */

// ─── RESIZE ───────────────────────────────────────────────────
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Re-apply view offset after resize (screen dimensions changed)
  if (typeof appMode !== 'undefined' && appMode === 'config') {
    updateCameraViewOffset();
  }
  invalidate();
}
window.addEventListener('resize', resize);
resize();

// ─── HERO → CONFIGURATOR TRANSITION ──────────────────────────
//
// Sequence (ms):
//   0        — фото и текст начинают исчезать
//   0        — камера СРАЗУ начинает плавно двигаться (пока фото ещё видно)
//   800      — фото полностью исчезло → фон сцены восстанавливается
//   900      — конфигуратор появляется
//
document.getElementById('btn-start').addEventListener('click', () => {
  if (appMode === 'config') return;
  appMode = 'config';

  // Шаг 1 (t=0): фото и текст уходят
  document.getElementById('hero-bg').classList.add('fade-out');
  document.getElementById('hero').classList.add('hiding');

  // Шаг 1 (t=0): камера начинает ease-in-out переход СРАЗУ, пока фото исчезает
  const _cfg = isMob ? CAM_CONFIG.config.mobile : CAM_CONFIG.config.desktop;
  // Use fence-centre as lookAt; setViewOffset handles visual centering in the panel
  const _fH  = (typeof ST !== 'undefined' && ST.height) ? ST.height : 2.0;
  const dest = Object.assign({}, _cfg, { cx: 0, cy: _fH / 2 });
  startCameraTransition(dest);

  // Шаг 2 (t=800): фото исчезло → восстанавливаем фон сцены
  setTimeout(() => {
    enterConfigMode();
  }, 800);

  // Шаг 3 (t=900): показываем конфигуратор
  setTimeout(() => {
    document.getElementById('hero').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    document.getElementById('site-header').classList.remove('hdr-theme-light');
    const footer = document.getElementById('site-footer');
    if (footer) footer.classList.add('site-footer--sandstone');

    if (window.innerWidth <= 768) {
      document.getElementById('main-canvas').classList.add('touch-active');
      initTouchOrbit();

      const hint = document.getElementById('mobile-pull-hint');
      if (hint) {
        hint.style.display = 'block';
        setTimeout(() => {
          hint.style.opacity    = '0';
          hint.style.transition = 'opacity 0.5s';
        }, 3500);
      }
    }

    enableOrbit();
    initMobileDrawer();
    initCounters();
  }, 900);
});

function _updatePerf() {}

// ─── ANIMATION LOOP ───────────────────────────────────────────
// Render-on-demand: only draw when invalidate() was called.
// lerpCam() returns true while a camera transition is in progress —
// keep rendering every frame during transitions and orbiting.
let _transWasActive = false; // tracks when the hero→config transition ends
function animate() {
  requestAnimationFrame(animate);
  const camMoving = lerpCam();
  if (camMoving) invalidate();   // camera is animating → keep rendering

  // Smoothly interpolate the projection offset (viewOffset) during the
  // hero→config transition so the fence glides into the visible viewport
  // with no sudden snap.
  if (appMode === 'config') {
    const p = getCameraTransProgress();
    if (p >= 0 && p < 1) {
      // Transition in progress — blend offset 0→full
      applyPartialViewOffset(p);
      invalidate();
      _transWasActive = true;
    } else if (_transWasActive) {
      // Transition just finished — lock in exact full offset
      updateCameraViewOffset();
      invalidate();
      _transWasActive = false;
    }
  }

  if (!consumeRender()) return;  // nothing changed → skip this frame
  applyCamera();
  const t0 = performance.now();
  renderer.render(scene, camera);
  _updatePerf(performance.now() - t0);
}

// ─── INIT ─────────────────────────────────────────────────────
buildFence();
applyCamera();

// Pre-warm shaders: compile both hero (no-fog) and config (fog) variants
// so the camera transition has zero shader-compile stalls.
(function prewarmShaders() {
  // Temporarily enter config mode to compile fog-variant shaders
  enterConfigMode();
  renderer.compile(scene, camera);
  // Restore hero state (transparent canvas, no fog, no ground, no projection shift)
  scene.background = null;
  scene.fog        = null;
  renderer.setClearColor(0x000000, 0);
  gnd.visible = false;
  clearCameraViewOffset(); // remove the config-mode setViewOffset from the hero camera
})();

animate();

// ─── DIRECT CONFIG via URL hash ───────────────────────────────
// При переході з about.html — одразу показуємо конфігуратор без анімації
if (location.hash === '#app') {
  appMode = 'config';
  enterConfigMode();

  const _cfg = isMob ? CAM_CONFIG.config.mobile : CAM_CONFIG.config.desktop;
  const _fH  = (typeof ST !== 'undefined' && ST.height) ? ST.height : 2.0;
  CAM.theta  = CAM.tTheta  = _cfg.theta;
  CAM.phi    = CAM.tPhi    = _cfg.phi;
  CAM.radius = CAM.tRadius = _cfg.radius;
  CAM.cx     = CAM.tCx     = 0;
  CAM.cy     = CAM.tCy     = _fH / 2;
  updateCameraViewOffset();
  applyCamera();
  invalidate();

  document.getElementById('hero-bg').classList.add('fade-out');
  document.getElementById('hero').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('site-header').classList.remove('hdr-theme-light');
  const _footer = document.getElementById('site-footer');
  if (_footer) _footer.classList.add('site-footer--sandstone');

  if (window.innerWidth <= 768) {
    document.getElementById('main-canvas').classList.add('touch-active');
    initTouchOrbit();
  }
  enableOrbit();
  initMobileDrawer();
  initCounters();
}

