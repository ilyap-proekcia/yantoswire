/**
 * fence-builder.js — Procedural 3D fence construction
 *
 * Reads ST (config.js) and writes meshes into `scene` (scene.js).
 *
 * Public API:
 *   buildFence()   — (re)builds the entire fence from current ST values
 *   updateStat()   — refreshes the stats overlay chips in the DOM
 */

// Reference to the current fence group; replaced on every rebuild
let fenceGroup = null;

// ─── HUMAN FIGURE 3D (scale reference) ────────────────────────
let _humanGroup = null;
let _humanLoading = false;

function _buildHumanFigure() {
  if (_humanGroup || _humanLoading) return;
  _humanLoading = true;

  const draco = new THREE.DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');

  const loader = new THREE.GLTFLoader();
  loader.setDRACOLoader(draco);

  // Quaternius "Man" — CC0 Public Domain via poly.pizza
  loader.load(
    'https://static.poly.pizza/3746be88-6799-4817-929b-6bc067c47caa.glb',
    (gltf) => {
      const model = gltf.scene;

      // Neutral grey material — same look as reference image
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x383c3b).convertSRGBToLinear(),
        roughness: 0.90, metalness: 0.0, envMapIntensity: 0.15,
        skinning: true,  // required for SkinnedMesh
      });
      model.traverse(n => {
        if (n.isMesh) { n.material = mat; n.castShadow = true; }
      });

      // Play idle animation and freeze at a natural standing frame
      if (gltf.animations && gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations.find(a => /idle/i.test(a.name)) || gltf.animations[0];
        mixer.clipAction(clip).play();
        mixer.update(0.4); // advance to natural pose
      }

      // Scale to exactly 1.75 m tall
      const box = new THREE.Box3().setFromObject(model);
      const scale = 1.75 / (box.max.y - box.min.y);
      model.scale.setScalar(scale);

      // Stand on ground
      box.setFromObject(model);
      model.position.y = -box.min.y;

      // Fixed position: slightly right of centre, in front of fence
      model.position.x = 0.55;
      model.position.z = 1.0;
      model.rotation.y = -0.3; // slight turn toward viewer

      _humanGroup = model;
      scene.add(model);
      invalidate();
    },
    null,
    (err) => { console.warn('Human model load failed:', err); _humanLoading = false; }
  );
}

// ─── RENDER BUDGET ────────────────────────────────────────────
// For very long fences we only build this many metres centred on x=0.
// The ends dissolve via x-based alpha fade injected into every material.
const MAX_RENDER = 16.0;  // metres actually built (fade kicks in beyond this)
const FADE_ZONE  =  2.0;  // metres over which opacity fades to 0

// Shared uniform objects — updated by buildFence(), referenced by all mats.
// Using objects so the shader keeps a live pointer (no re-compile needed).
const _fadeU = {
  uFadeStart: { value: 9999.0 },
  uFadeEnd:   { value: 10000.0 },
};

// ─── MATERIAL HELPER ──────────────────────────────────────────
/**
 * @param {string} hex           - colour as CSS hex, e.g. '#111413'
 * @param {number} r             - roughness 0–1  (0 = mirror, 1 = fully matte)
 * @param {number} m             - metalness 0–1
 * @param {number} envIntensity  - how strongly the HDR env map reflects (0–1)
 *
 * Матово-глянцевый (сатиновый) эффект:
 *   roughness 0.30–0.42 — не зеркало, но с чётким бликом
 *   metalness 0.72–0.82 — металл, но не хром
 *   envMapIntensity 0.55 — HDR добавляет объём, не засвечивает
 */
function mat(hex, r = 0.65, m = 0.10, envIntensity = 0.20) {
  const m3 = new THREE.MeshStandardMaterial({
    color:           new THREE.Color(hex).convertSRGBToLinear(),
    roughness:       r,
    metalness:       m,
    envMapIntensity: envIntensity,
    transparent:     true,   // required for x-fade alpha
  });

  m3.onBeforeCompile = (shader) => {
    // Pass shared fade uniforms (live pointer — no re-compile on value change)
    shader.uniforms.uFadeStart = _fadeU.uFadeStart;
    shader.uniforms.uFadeEnd   = _fadeU.uFadeEnd;

    // Vertex: compute world X/Y and pass to fragment
    shader.vertexShader = 'varying float vWorldX;\nvarying float vWorldY;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'void main() {\n  vec4 _wp = modelMatrix * vec4(position,1.0);\n  vWorldX = _wp.x;\n  vWorldY = _wp.y;'
    );

    // Fragment: brushed metal roughness variation + x-fade alpha
    shader.fragmentShader =
      'varying float vWorldX;\nvarying float vWorldY;\nuniform float uFadeStart;\nuniform float uFadeEnd;\n'
      + shader.fragmentShader;

    // Horizontal brushing scratches: multi-frequency hash noise along Y
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       float _b  = fract(sin(vWorldY * 313.7)  * 43758.5);
       _b += fract(sin(vWorldY * 1256.8) * 17341.2) * 0.5;
       _b += fract(sin(vWorldY * 5027.3) * 7823.5)  * 0.25;
       roughnessFactor = clamp(roughnessFactor + _b * 0.10 - 0.05, 0.0, 1.0);`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#include <fog_fragment>
       float _xf = 1.0 - smoothstep(uFadeStart, uFadeEnd, abs(vWorldX));
       if (_xf <= 0.001) discard;
       gl_FragColor.a *= _xf;`
    );
  };

  return m3;
}

// ─── BAR GEOMETRY (with optional angled top cut) ──────────────
// tipH > 0: back face top is HIGH (+hh), front face top is LOW (hh-t).
// Each face uses its own (non-shared) vertices so computeVertexNormals()
// produces hard, flat edges — no blurry normal-averaging at seams.
function makeBarGeometry(W, H, D, tipH) {
  if (!tipH || tipH <= 0) return new THREE.BoxGeometry(W, H, D);

  const t  = Math.min(tipH, H * 0.95);
  const hw = W / 2, hh = H / 2, hd = D / 2;

  // 8 logical corners
  const p0 = [-hw, -hh, -hd]; // bot-back-left
  const p1 = [ hw, -hh, -hd]; // bot-back-right
  const p2 = [ hw, -hh,  hd]; // bot-front-right
  const p3 = [-hw, -hh,  hd]; // bot-front-left
  const p4 = [-hw,  hh, -hd]; // top-back-left   (HIGH)
  const p5 = [ hw,  hh, -hd]; // top-back-right  (HIGH)
  const p6 = [ hw, hh-t, hd]; // top-front-right (LOW)
  const p7 = [-hw, hh-t, hd]; // top-front-left  (LOW)

  // Non-indexed: each quad uses 4 unique vertex slots → flat shading at edges
  // quad(A,B,C,D) emits tri A-B-C + tri A-C-D (CCW from outside, verified)
  const pos = [];
  function quad(A, B, C, D) {
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  }

  quad(p0, p1, p2, p3); // bottom → -Y
  quad(p4, p7, p6, p5); // top    → +Y+Z (angled plane)
  quad(p3, p2, p6, p7); // front  → +Z
  quad(p0, p4, p5, p1); // back   → -Z
  quad(p0, p3, p7, p4); // left   → -X
  quad(p1, p5, p6, p2); // right  → +X

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  geo.computeVertexNormals(); // each face isolated → clean hard edges
  return geo;
}

// ─── SMALL GATE (хвіртка) ─────────────────────────────────────
// ~1 m wide, placed at `offsetX` along the X axis
function buildSmallGate(group, H, color, offsetX) {
  const mG  = mat(color, 0.60, 0.10, 0.22);
  const mGf = mat(color, 0.68, 0.06, 0.15);
  const gW  = 1.0;
  const frameT = 0.052;

  // Left post + cap
  const lp = new THREE.Mesh(new THREE.BoxGeometry(frameT, H + 0.14, frameT), mG);
  lp.position.set(offsetX, H / 2, 0);
  lp.castShadow = true; group.add(lp);
  const lc = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.022, 0.078), mG);
  lc.position.set(offsetX, H + 0.081, 0); group.add(lc);

  // Right post + cap
  const rp = new THREE.Mesh(new THREE.BoxGeometry(frameT, H + 0.14, frameT), mG);
  rp.position.set(offsetX + gW, H / 2, 0);
  rp.castShadow = true; group.add(rp);
  const rc = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.022, 0.078), mG);
  rc.position.set(offsetX + gW, H + 0.081, 0); group.add(rc);

  // Top + bottom rails
  [H - 0.12, 0.18].forEach(ry => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(gW, 0.038, 0.038), mG);
    r.position.set(offsetX + gW / 2, ry, 0); r.castShadow = true; group.add(r);
  });

  // Diagonal brace
  const diagLen = Math.sqrt(gW * gW + (H - 0.3) * (H - 0.3));
  const diag    = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.032, 0.032), mGf);
  diag.position.set(offsetX + gW / 2, H / 2, 0.02);
  diag.rotation.z = Math.atan2(H - 0.3, gW);
  diag.castShadow = true; group.add(diag);

  // Vertical pickets
  const pc  = 7;
  const gap = gW / pc;
  for (let i = 0; i < pc; i++) {
    const pk = new THREE.Mesh(new THREE.BoxGeometry(0.028, H - 0.35, 0.028), mGf);
    pk.position.set(offsetX + gap / 2 + i * gap, H / 2, 0);
    pk.castShadow = true; group.add(pk);
  }

  // Hinges (decorative)
  [0.3, H - 0.3].forEach(hy => {
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.045), mG);
    hinge.position.set(offsetX + 0.01, hy, 0.01); group.add(hinge);
  });

  // Lock
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), mG);
  lock.position.set(offsetX + gW - 0.08, H / 2, 0.01); group.add(lock);
}

// ─── DOUBLE GATE (ворота) ─────────────────────────────────────
// ~3 m wide, 2 leaves, placed at `offsetX` along the X axis
function buildDoubleGate(group, H, color, offsetX) {
  const mG  = mat(color, 0.60, 0.10, 0.22);
  const mGf = mat(color, 0.68, 0.06, 0.15);
  const gW  = 3.0;
  const leafW  = gW / 2;
  const frameT = 0.065;

  // Outer posts + caps
  [-0.01, gW + 0.01].forEach(px => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.075, H + 0.14, 0.075), mG);
    p.position.set(offsetX + px, H / 2, 0); p.castShadow = true; group.add(p);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.025, 0.095), mG);
    c.position.set(offsetX + px, H + 0.082, 0); group.add(c);
  });

  // Centre divider post (thin)
  const cp = new THREE.Mesh(new THREE.BoxGeometry(0.04, H + 0.1, 0.04), mG);
  cp.position.set(offsetX + leafW, H / 2, 0); cp.castShadow = true; group.add(cp);

  // Each leaf
  [0, leafW].forEach(lx => {
    // Top + bottom frame bars
    [H - 0.1, 0.15].forEach(ry => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.02, frameT, frameT), mG);
      r.position.set(offsetX + lx + leafW / 2, ry, 0); r.castShadow = true; group.add(r);
    });

    // Middle rail
    const mid = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.02, frameT * 0.8, frameT * 0.8), mG);
    mid.position.set(offsetX + lx + leafW / 2, H * 0.45, 0); mid.castShadow = true; group.add(mid);

    // Z-brace diagonal
    const diagLen = Math.sqrt((leafW - 0.02) * (leafW - 0.02) + (H * 0.45 - 0.15) * (H * 0.45 - 0.15));
    const diag    = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.030, 0.030), mGf);
    diag.position.set(offsetX + lx + leafW / 2, (H * 0.45 + 0.15) / 2, 0.015);
    diag.rotation.z = (lx === 0 ? 1 : -1) * Math.atan2(H * 0.45 - 0.15, leafW - 0.02);
    group.add(diag);

    // Pickets
    const pc  = Math.round((leafW - 0.04) / 0.09);
    const gap = (leafW - 0.04) / pc;
    for (let i = 0; i < pc; i++) {
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.030, H - 0.32, 0.030), mGf);
      pk.position.set(offsetX + lx + 0.02 + gap / 2 + i * gap, H / 2, 0);
      pk.castShadow = true; group.add(pk);
    }

    // Hinges
    [0.25, H - 0.25].forEach(hy => {
      const side  = lx === 0 ? 0.01 : leafW - 0.01;
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.055), mG);
      hinge.position.set(offsetX + lx + side, hy, 0.01); group.add(hinge);
    });
  });
}

// ─── MAIN FENCE BUILDER ───────────────────────────────────────
function buildFence() {
  // Remove old geometry to avoid memory leaks
  if (fenceGroup) {
    scene.remove(fenceGroup);
    fenceGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material)  o.material.dispose();
    });
  }

  fenceGroup = new THREE.Group();
  scene.add(fenceGroup);

  const { length: L, height: H, span, profile, fill, postType, color } = ST;
  const pkg = ST.package;
  const p   = profile / 1000; // mm → metres

  // ── Render-budget clamp ─────────────────────────────────────
  // Only build up to MAX_RENDER metres; longer fences fade at the ends.
  // Gate packages also clamp — gate stays centred, fence halves fade.
  const renderL = Math.min(L, MAX_RENDER);
  const doFade  = L > MAX_RENDER;

  _fadeU.uFadeStart.value = doFade ? (renderL / 2 - FADE_ZONE) : 9999.0;
  _fadeU.uFadeEnd.value   = doFade ? (renderL / 2)              : 10000.0;

  // Resolve geometry params for the selected fence style
  const FP = FENCE_STYLES[ST.fenceStyle] || FENCE_STYLES[1];

  // Порошкове покриття: низький metalness = точна передача кольору RAL
  const mPost = mat(color, 0.60, 0.10, 0.22);
  const mRail = mat(color, 0.65, 0.08, 0.18);
  const mFill = mat(color, 0.68, 0.06, 0.15);

  // Widths of optional gate openings
  const gateW   = 3.0;   // ворота
  const wicketW = 1.0;   // хвіртка
  const postGap = 0.12;  // spacing between fence post and gate post

  let gapTotal = 0;
  if (pkg === 'fence+gate')       gapTotal = gateW   + postGap * 2;
  if (pkg === 'fence+gate-small') gapTotal = wicketW + postGap * 2;
  if (pkg === 'fence+gate+small') gapTotal = gateW   + wicketW + postGap * 4;

  // Use renderL (capped) for geometry, L stays as display value in stats
  const sideL = (renderL - gapTotal) / 2; // length of each fence half

  // ── Build one fence segment (posts + rails + infill) ──────────
  function buildSegment(startX, segL) {
    if (segL <= 0) return;

    const nSec  = Math.max(1, Math.round(segL / span));
    const aSpan = segL / nSec;
    const nPost = nSec + 1;

    // ── Posts ────────────────────────────────────────────────────
    const postH = H + FP.postExtra;
    for (let i = 0; i < nPost; i++) {
      const x  = startX + i * aSpan;
      let   pg;
      if      (postType === 'round')     pg = new THREE.CylinderGeometry(FP.postW / 2, FP.postW / 2, postH, 16);
      else if (postType === 'bigSquare') pg = new THREE.BoxGeometry(FP.postW * 1.3, postH, FP.postD * 1.3);
      else                               pg = new THREE.BoxGeometry(FP.postW, postH, FP.postD);

      const post = new THREE.Mesh(pg, mPost);
      post.position.set(x, postH / 2, 0);
      post.castShadow = true; post.receiveShadow = true;
      fenceGroup.add(post);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(FP.capW, FP.capH, FP.capD), mPost);
      cap.position.set(x, postH + FP.capH / 2, 0);
      cap.castShadow = true; fenceGroup.add(cap);
    }

    const cx = startX + segL / 2;

    if (FP.barDir === 'horizontal') {
      // ── Горизонтальні прути (стиль D) ──────────────────────────
      // Структура секції:
      //   [СТОВП] --[кронштейн 70мм]-- [СТІЙКА 40×40] ===прути=== [СТІЙКА 40×40] --[кронштейн 70мм]-- [СТОВП]
      // Прути кріпляться до стійки, стійка кріпиться до стовпа через 2 кронштейни (верх/низ)

      const bH     = FP.barH      || 0.080;   // висота прута (Y)
      const bD     = FP.barD      || 0.020;   // глибина прута (Z)
      const barGap = FP.barGap    || 0.090;   // цільовий проміжок між прутами

      // Секція: знизу — відступ secBot, зверху — до верху стовпа
      const secBot = FP.sectionBotOff || 0;
      const secH   = H - secBot;

      // Кількість прутів: підбирається автоматично під висоту секції
      const botM   = FP.barBotMar || 0.030;
      const avail  = secH - 2 * botM;
      const nBars  = Math.max(1, Math.floor((avail + barGap) / (bH + barGap)));
      // Фактичний зазор (може трохи відрізнятись від barGap)
      const gapH   = nBars > 1 ? (avail - nBars * bH) / (nBars - 1) : 0;

      const stileW   = FP.stileW   || 0.040;
      const stileD   = FP.stileD   || 0.040;
      const stileExt = FP.stileExt || 0;

      const brkLen   = FP.brkLen   || 0.070;
      const brkYUOff = FP.brkYUOff || 0.250;
      const brkYLOff = FP.brkYLOff || 0.250;
      const brkH     = 0.040;   // кронштейн завжди 40мм (незалежно від стійки)
      const brkD     = 0.040;

      const stileOffX = FP.postW / 2 + brkLen + stileW / 2;

      // Кронштейни відносно меж секції
      const brkYU = secBot + secH - brkYUOff - brkH / 2;
      const brkYL = secBot + brkYLOff        + brkH / 2;

      // Будуємо посекційно (між кожною парою сусідніх стовпів)
      for (let sec = 0; sec < nSec; sec++) {
        const x0   = startX + sec * aSpan;        // центр лівого стовпа
        const x1   = startX + (sec + 1) * aSpan;  // центр правого стовпа
        const barCX = (x0 + x1) / 2;
        // Прути йдуть від центра лівої стійки до центра правої стійки
        const barLen = aSpan - 2 * stileOffX;

        // ── Горизонтальні прути або вертикальні (залежно від стилю) ──
        if (FP.verticalInner) {
          // Вертикальні прути всередині рамки (стиль 6)
          // Висота = висота рамки мінус верхня і нижня перемичка (rH розраховується нижче, але тут потрібно наперед)
          const _rH = FP.topBotRail ? (FP.topBotRailH || bH) : 0;
          const innerH  = secH - 2 * _rH;
          const innerCY = secBot + secH / 2;
          const iD   = FP.innerBarD   || 0.040;
          const iGap = FP.innerBarGap || 0.110;
          if (FP.innerBarAlt) {
            // Чергування: вузький / широкий (починається з вузького)
            const iWide    = FP.innerBarWide    || 0.080;
            const iNarrow  = FP.innerBarNarrow  || 0.040;
            const sideMar  = FP.innerBarSideMar || 0;
            const avail    = barLen - 2 * sideMar;
            const nVert    = Math.max(1, Math.round(avail / iGap));
            const vStep    = avail / nVert;
            for (let vi = 0; vi < nVert; vi++) {
              const vx = barCX - barLen / 2 + sideMar + vStep / 2 + vi * vStep;
              const w  = vi % 2 === 0 ? iNarrow : iWide;
              const vbar = new THREE.Mesh(new THREE.BoxGeometry(w, innerH, iD), mFill);
              vbar.position.set(vx, innerCY, 0);
              vbar.castShadow = true; fenceGroup.add(vbar);
            }
          } else {
            const iW = FP.innerBarW || 0.020;
            const nVert = Math.max(1, Math.round((barLen - iW) / iGap));
            const vStep = (barLen - iW) / nVert;
            for (let vi = 0; vi < nVert; vi++) {
              const vx  = barCX - barLen / 2 + iW / 2 + vStep / 2 + vi * vStep;
              const vbar = new THREE.Mesh(new THREE.BoxGeometry(iW, innerH, iD), mFill);
              vbar.position.set(vx, innerCY, 0);
              vbar.castShadow = true; fenceGroup.add(vbar);
            }
          }
        } else {
          // Горизонтальні прути (стилі 4, 5)
          for (let i = 0; i < nBars; i++) {
            const isSmall = FP.smallBarH && i >= nBars - 3;
            const h   = isSmall ? FP.smallBarH : bH;
            const by  = secBot + botM + bH / 2 + i * (bH + gapH);
            const bar = new THREE.Mesh(new THREE.BoxGeometry(barLen, h, bD), mFill);
            bar.position.set(barCX, by, 0);
            bar.castShadow = true; fenceGroup.add(bar);
          }
        }

        // ── Горизонтальні перемички зверху і знизу (topBotRail) ──
        const rH = FP.topBotRail ? (FP.topBotRailH || bH) : 0;
        if (FP.topBotRail) {
          const rD = stileD;
          // Перемичка від зовнішнього краю лівої стійки до зовнішнього краю правої
          const railLen = barLen + stileW;
          [secBot + rH / 2, secBot + secH - rH / 2].forEach(ry => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, rH, rD), mPost);
            rail.position.set(barCX, ry, 0);
            rail.castShadow = true; fenceGroup.add(rail);
          });
        }

        // ── Ліва стійка + кронштейни (→ лівий стовп x0) ──────
        // При topBotRail стійки входять між перемичками (рамка), інакше виступають на stileExt
        const stileH  = FP.topBotRail ? (secH - 2 * rH) : (secH + 2 * stileExt);
        const stileCY = secBot + secH / 2;      // центр секції

        const lsx = x0 + stileOffX;
        const ls  = new THREE.Mesh(new THREE.BoxGeometry(stileW, stileH, stileD), mPost);
        ls.position.set(lsx, stileCY, 0);
        ls.castShadow = true; fenceGroup.add(ls);

        const lbrkX = x0 + FP.postW / 2 + brkLen / 2;
        [brkYU, brkYL].forEach(by => {
          const brk = new THREE.Mesh(new THREE.BoxGeometry(brkLen, brkH, brkD), mPost);
          brk.position.set(lbrkX, by, 0);
          brk.castShadow = true; fenceGroup.add(brk);
        });

        // ── Права стійка + кронштейни (→ правий стовп x1) ────
        const rsx = x1 - stileOffX;
        const rs  = new THREE.Mesh(new THREE.BoxGeometry(stileW, stileH, stileD), mPost);
        rs.position.set(rsx, stileCY, 0);  // той самий stileCY
        rs.castShadow = true; fenceGroup.add(rs);

        const rbrkX = x1 - FP.postW / 2 - brkLen / 2;
        [brkYU, brkYL].forEach(by => {
          const brk = new THREE.Mesh(new THREE.BoxGeometry(brkLen, brkH, brkD), mPost);
          brk.position.set(rbrkX, by, 0);
          brk.castShadow = true; fenceGroup.add(brk);
        });
      }

    } else {
      // ── Рейки (стилі 1-3) ──────────────────────────────────────
      const topRailY = postH - FP.railTopOff;
      const railYs   = [FP.railBot, topRailY];
      if (FP.railMid) railYs.splice(1, 0, (FP.railBot + topRailY) / 2);
      railYs.forEach((ry, idx) => {
        const rh = (idx === 0 && FP.railBotH) ? FP.railBotH : FP.railH;
        const r  = new THREE.Mesh(new THREE.BoxGeometry(segL, rh, FP.railD), mRail);
        r.position.set(cx, ry, 0);
        r.castShadow = true; r.receiveShadow = true; fenceGroup.add(r);
      });

      // ── Вертикальні прути (стилі 1-3) ──────────────────────────
      const barTopExt = FP.barTopExt || 0;
      const barBotExt = FP.barBotExt || 0;
      const barYbot   = railYs[0] - FP.railH / 2 - barBotExt;
      const barYtop   = topRailY + FP.railH / 2 + barTopExt;
      const barH2     = barYtop - barYbot;
      const barCY     = (barYbot + barYtop) / 2;
      const barCount  = Math.max(1, Math.round((segL - FP.postW) / FP.barGap));
      const barStep   = (segL - FP.postW) / barCount;

      const barZ = FP.barOnRail ? (FP.postD / 2 + FP.barD / 2 + 0.001) : 0;

      const postXs = [];
      for (let i = 0; i < nPost; i++) postXs.push(startX + i * aSpan);
      const minDist = FP.postW / 2 + FP.barW / 2;

      for (let i = 0; i < barCount; i++) {
        const bx = startX + FP.postW / 2 + barStep / 2 + i * barStep;
        if (postXs.some(px => Math.abs(bx - px) < minDist)) continue;
        const m2 = new THREE.Mesh(makeBarGeometry(FP.barW, barH2, FP.barD, FP.barTipH || 0), mFill);
        m2.position.set(bx, barCY, barZ);
        m2.castShadow = true; fenceGroup.add(m2);
      }
    }
  }

  // ── Assemble the full fence ──────────────────────────────────
  if (pkg === 'fence') {
    buildSegment(-renderL / 2, renderL);
  } else {
    buildSegment(-renderL / 2, sideL);    // left half
    buildSegment(gapTotal / 2, sideL);    // right half

    if (pkg === 'fence+gate') {
      buildDoubleGate(fenceGroup, H, color, -gateW / 2);
    } else if (pkg === 'fence+gate-small') {
      buildSmallGate(fenceGroup, H, color, -wicketW / 2);
    } else if (pkg === 'fence+gate+small') {
      const total       = gateW + postGap * 2 + wicketW;
      const gateStart   = -total / 2 + postGap;
      const wicketStart = gateStart + gateW + postGap * 2;
      buildDoubleGate(fenceGroup, H, color, gateStart);
      buildSmallGate(fenceGroup,  H, color, wicketStart);
    }
  }

  _mergeFenceGroup();
  updateStat();
  if (typeof adjustCameraToFence === 'function') adjustCameraToFence();
  invalidate(); // fence changed → redraw
}

// ─── GEOMETRY MERGE ───────────────────────────────────────────
// After building, merge all individual meshes into one per material.
// Reduces WebGL draw calls from ~80 to ~4 with zero visual change.
function _mergeFenceGroup() {
  if (!THREE.BufferGeometryUtils) return;

  const groups = new Map(); // key → { mat, cast, recv, geos[] }
  const toRemove = [];

  fenceGroup.children.forEach(obj => {
    if (!obj.isMesh) return;
    const key = `${obj.material.uuid}_${+obj.castShadow}_${+obj.receiveShadow}`;
    if (!groups.has(key)) {
      groups.set(key, { mat: obj.material, cast: obj.castShadow, recv: obj.receiveShadow, geos: [] });
    }
    obj.updateMatrix();
    const geo = obj.geometry.clone();
    obj.geometry.dispose(); // free original immediately after clone
    geo.applyMatrix4(obj.matrix);
    // Ensure uv attribute exists (custom geometries may lack it)
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    groups.get(key).geos.push(geo);
    toRemove.push(obj);
  });

  toRemove.forEach(obj => fenceGroup.remove(obj));

  groups.forEach(({ mat, cast, recv, geos }) => {
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
    geos.forEach(g => g.dispose()); // free clones after merge
    if (!merged) return;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow    = cast;
    mesh.receiveShadow = recv;
    fenceGroup.add(mesh);
  });
}

// ─── STATS OVERLAY UPDATE ─────────────────────────────────────
function updateStat() {
  const nSec = Math.max(1, Math.round(ST.length / ST.span));
  const el   = id => document.getElementById(id);
  if (el('stat-len')) el('stat-len').textContent = ST.length;
  if (el('stat-sec')) el('stat-sec').textContent = nSec;
  if (el('stat-col')) el('stat-col').textContent = nSec + 1;
}
