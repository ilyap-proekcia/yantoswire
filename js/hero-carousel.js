/**
 * hero-carousel.js — True 3D orbit carousel (viewer outside the circle)
 *
 * ─── GEOMETRY ────────────────────────────────────────────────────────────────
 *
 * Fences sit on a circle of radius R whose front-most point is the origin.
 * The camera is at positive Z, looking toward negative Z — outside the circle.
 *
 *   Circle center = (0, 0, −R)
 *   Fence at angle θ:
 *     x    = −R · sin(θ)         θ>0 → left side of screen (negative x)
 *     z    = R · (cos(θ) − 1)    θ=0 → z=0 (closest); sides go negative (farther)
 *     rotY = −θ                  OUTWARD-facing: normal points away from circle center
 *
 * WHY rotY = −θ (not +θ):
 *   The viewer is OUTSIDE the circle. Fences must face outward so the camera
 *   sees their front face. Outward normal = (−sin θ, 0, cos θ), requires rotY = −θ.
 *   Effect: left fence → right/inner edge closer; right fence → left/inner edge closer.
 *
 * ─── LIVE CONFIG ─────────────────────────────────────────────────────────────
 *   All parameters live in heroCarousel.cfg — mutate them at runtime and call
 *   heroCarousel.reapply() to see the change immediately.
 *
 * ─── PUBLIC API ──────────────────────────────────────────────────────────────
 *   heroCarousel.init()      — build all 8 fences, start autoplay
 *   heroCarousel.stop()      — clean up, cancel timers
 *   heroCarousel.reapply()   — re-pose visible fences with current cfg values
 *   heroCarousel.cfg         — live config object (mutate freely)
 */
(function () {
  'use strict';

  // ─── LIVE CONFIG — separate presets per device ───────────────
  const _isMob = window.innerWidth <= 768;

  const _cfg = _isMob ? {
    // ── Mobile preset ──────────────────────────────────────────
    R:       6.9,    // orbit radius (metres)
    thetaS:  0.54,
    thetaH:  1.20,
    scaleC:  1.00,
    scaleS:  0.87,
    scaleH:  0.65,
    dimC:    1.00,
    dimS:    0.70,
    dimH:    0.00,
    pause:   2200,
    dur:     2000,
  } : {
    // ── Desktop preset ─────────────────────────────────────────
    R:       10.5,   // orbit radius (metres)
    thetaS:  0.54,
    thetaH:  1.20,
    scaleC:  1.00,
    scaleS:  0.87,
    scaleH:  0.65,
    dimC:    1.00,
    dimS:    0.70,
    dimH:    0.00,
    pause:   2200,
    dur:     2000,
  };

  // ─── BUILD SETTINGS ──────────────────────────────────────────
  const COLOR = '#393E42';   // Anthracite RAL 7016
  const LEN   = 3.5;
  const HT    = 2.0;
  const SPAN  = 2.0;

  // ─── STATE ───────────────────────────────────────────────────
  let _groups  = [];
  let _slots   = [7, 0, 1];   // [leftIdx, centerIdx, rightIdx]
  let _active  = false;
  let _trans   = null;
  let _rafId   = null;
  let _timerId = null;

  // ─── POSE FUNCTION ───────────────────────────────────────────
  /**
   * Convert orbit angle θ → { x, z, rotY, scale, dim }
   * Uses _cfg — live-updatable.
   */
  function _pose(θ) {
    const { R, thetaS, thetaH, scaleC, scaleS, scaleH, dimC, dimS, dimH } = _cfg;
    const a = Math.abs(θ);

    let scale, dim;
    if (a <= thetaS) {
      const f = a / thetaS;
      scale   = scaleC + (scaleS - scaleC) * f;
      dim     = dimC   + (dimS   - dimC)   * f;
    } else {
      const f = Math.min(1, (a - thetaS) / (thetaH - thetaS));
      scale   = scaleS + (scaleH - scaleS) * f;
      dim     = dimS   + (dimH   - dimS)   * f;
    }

    return {
      x:    -R * Math.sin(θ),
      z:     R * (Math.cos(θ) - 1),
      rotY: -θ,                       // outward-facing (critical)
      scale: Math.max(0.01, scale),
      dim:   Math.max(0,    dim),
    };
  }

  // ─── BUILD WRAPPER ───────────────────────────────────────────
  function _buildGroup(styleNum) {
    const prevFG = fenceGroup;
    const prevST = Object.assign({}, ST);

    ST.fenceStyle = styleNum;
    ST.length     = LEN;
    ST.height     = HT;
    ST.color      = COLOR;
    ST.package    = 'fence';
    ST.span       = SPAN;

    fenceGroup = null;
    buildFence();

    const g = fenceGroup;
    scene.remove(g);

    fenceGroup = prevFG;
    Object.assign(ST, prevST);
    return g;
  }

  // ─── APPLY POSE ──────────────────────────────────────────────
  function _apply(g, p) {
    g.position.set(p.x, 0, p.z);
    g.rotation.y  = p.rotY;
    g.scale.setScalar(p.scale);
    g.renderOrder = Math.round(p.scale * 10);

    g.traverse(o => {
      if (!o.isMesh) return;
      o.renderOrder = g.renderOrder;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { m.opacity = p.dim; });
    });
  }

  // ─── EASING ──────────────────────────────────────────────────
  function _ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ─── FRAME LOOP ──────────────────────────────────────────────
  function _frame() {
    if (!_active || !_trans) { _rafId = null; return; }

    const t = Math.min(1, (performance.now() - _trans.t0) / _trans.dur);
    const e = _ease(t);

    _trans.items.forEach(item => {
      const θ = item.θ0 + (item.θ1 - item.θ0) * e;
      _apply(item.g, _pose(θ));
    });

    invalidate();

    if (t >= 1) {
      _trans.done();
      _trans   = null;
      _rafId   = null;
      _timerId = setTimeout(() => _advance(1), _cfg.pause);
    } else {
      _rafId = requestAnimationFrame(_frame);
    }
  }

  // ─── ADVANCE ─────────────────────────────────────────────────
  function _advance(dir) {
    if (!_active || _trans) return;
    clearTimeout(_timerId);

    const N = _groups.length;
    const [li, ci, ri] = _slots;
    const { thetaS, thetaH } = _cfg;
    let newIdx, exitIdx, newSlots, items;

    if (dir >= 0) {
      newIdx   = (ri + 1) % N;
      exitIdx  = li;
      newSlots = [ci, ri, newIdx];
      items = [
        { g: _groups[li],     θ0: -thetaS, θ1: -thetaH },
        { g: _groups[ci],     θ0:  0,       θ1: -thetaS },
        { g: _groups[ri],     θ0:  thetaS,  θ1:  0      },
        { g: _groups[newIdx], θ0:  thetaH,  θ1:  thetaS },
      ];
      _apply(_groups[newIdx], _pose(thetaH));
      scene.add(_groups[newIdx]);

    } else {
      newIdx   = (li - 1 + N) % N;
      exitIdx  = ri;
      newSlots = [newIdx, li, ci];
      items = [
        { g: _groups[ri],     θ0:  thetaS,  θ1:  thetaH },
        { g: _groups[ci],     θ0:  0,        θ1:  thetaS },
        { g: _groups[li],     θ0: -thetaS,  θ1:  0       },
        { g: _groups[newIdx], θ0: -thetaH,  θ1: -thetaS  },
      ];
      _apply(_groups[newIdx], _pose(-thetaH));
      scene.add(_groups[newIdx]);
    }

    _trans = {
      items,
      done() {
        scene.remove(_groups[exitIdx]);
        _slots = newSlots;
      },
      t0:  performance.now(),
      dur: _cfg.dur,
    };

    _rafId = requestAnimationFrame(_frame);
  }

  // ─── PUBLIC API ──────────────────────────────────────────────
  window.heroCarousel = {

    cfg: _cfg,

    init() {
      if (_active) return;
      for (let s = 1; s <= 8; s++) _groups.push(_buildGroup(s));

      _apply(_groups[7], _pose(-_cfg.thetaS));
      _apply(_groups[0], _pose(0));
      _apply(_groups[1], _pose(_cfg.thetaS));
      scene.add(_groups[7]);
      scene.add(_groups[0]);
      scene.add(_groups[1]);

      _active  = true;
      invalidate();
      _timerId = setTimeout(() => _advance(1), _cfg.pause);
    },

    /** Re-pose currently visible fences using the current cfg values.
     *  Call after mutating heroCarousel.cfg to see changes live. */
    reapply() {
      if (!_active || !_slots) return;
      const [li, ci, ri] = _slots;
      _apply(_groups[li], _pose(-_cfg.thetaS));
      _apply(_groups[ci], _pose(0));
      _apply(_groups[ri], _pose(_cfg.thetaS));
      invalidate();
    },

    stop() {
      _active = false;
      clearTimeout(_timerId);
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      _trans = null;

      _groups.forEach(g => {
        if (g.parent) g.parent.remove(g);
        g.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach(m => m.dispose());
          }
        });
      });

      _groups = [];
      _slots  = null;
    },

  };

}());
