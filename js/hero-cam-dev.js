;(function heroCamDev() {

  // ── helpers ────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }
  function slider(id, min, max, step, val, label) {
    return `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="opacity:.8">${label}</span>
          <span id="${id}-v" style="color:#a8c5a0;font-weight:700">${(+val).toFixed(2)}</span>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"
          style="width:100%;accent-color:#a8c5a0">
      </div>`;
  }

  const CAM_PARAMS = [
    { key:'theta',  label:'Theta',  min:-1.5, max:1.5,  step:0.01 },
    { key:'phi',    label:'Phi (↑1.57=горизонт↓)', min:0.5, max:1.75, step:0.01 },
    { key:'radius', label:'Radius', min:1.0,  max:12.0, step:0.1  },
    { key:'cx',     label:'CX',     min:-8.0, max:8.0,  step:0.05 },
    { key:'cy',     label:'CY',     min:-4.0, max:6.0,  step:0.05 },
  ];

  // ── panel container ────────────────────────────────────────
  const panel = document.createElement('div');
  panel.style.cssText = `
    position:fixed; bottom:16px; left:16px; z-index:9999;
    background:#1a1f1e; color:#e8e4dc;
    font:12px/1.4 ui-monospace,'SF Mono','Cascadia Code','Consolas',monospace;
    padding:14px 16px; border-radius:10px; width:300px;
    box-shadow:0 4px 24px rgba(0,0,0,.55);
    max-height:90vh; overflow-y:auto;
  `;

  // ── section: camera ────────────────────────────────────────
  function buildCamSection(device) {
    const src = CAM_CONFIG.hero[device];
    let h = '';
    CAM_PARAMS.forEach(p => {
      h += slider(`hcd-${device}-${p.key}`, p.min, p.max, p.step, src[p.key], p.label);
    });
    h += `<button id="hcd-${device}-copy" style="
      width:100%;padding:5px;background:#3a4f3a;color:#e8e4dc;
      border:none;border-radius:6px;cursor:pointer;font:11px monospace;margin-top:4px
    ">Скопіювати ${device}</button>
    <div id="hcd-${device}-msg" style="margin-top:4px;font-size:10px;color:#a8c5a0;text-align:center;min-height:14px"></div>`;
    return h;
  }

  // ── section: video ─────────────────────────────────────────
  const videoBg = el('hero-bg');
  // Read current object-position or default 50% 50%
  const _cs = videoBg ? getComputedStyle(videoBg) : null;
  const _op = (_cs && _cs.objectPosition) ? _cs.objectPosition : '50% 50%';
  const _parts = _op.split(' ');
  const _vx0 = parseFloat(_parts[0]) || 50;
  const _vy0 = parseFloat(_parts[1] || _parts[0]) || 50;
  const _vs0 = 100;

  const videoSection = `
    <div style="font-weight:700;font-size:12px;margin:12px 0 8px;
      border-top:1px solid #2e3635;padding-top:10px;color:#c8b894">
      📹 Відео фон
    </div>
    ${slider('hvd-x',  0, 100, 1,   _vx0, 'Position X (%)')}
    ${slider('hvd-y', -50,  50, 1,    0,  'Position Y (vh зсув)')}
    ${slider('hvd-s', 100, 200, 1, _vs0, 'Scale (%)')}
    <button id="hvd-copy" style="
      width:100%;padding:5px;background:#4a3a2a;color:#e8e4dc;
      border:none;border-radius:6px;cursor:pointer;font:11px monospace;margin-top:4px
    ">Скопіювати CSS</button>
    <div id="hvd-msg" style="margin-top:4px;font-size:10px;color:#c8b894;text-align:center;min-height:14px"></div>`;

  // ── tabs ───────────────────────────────────────────────────
  function tabStyle(active) {
    return `padding:4px 10px;border:none;border-radius:5px;cursor:pointer;font:11px monospace;
      background:${active ? '#3a4f3a' : '#2a3530'};color:#e8e4dc;`;
  }

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;cursor:pointer"
         id="hcd-header">
      <span style="font-weight:700;font-size:13px">🎥 Hero камера</span>
      <span id="hcd-toggle" style="font-size:16px;line-height:1;color:#a8c5a0">−</span>
    </div>
    <div id="hcd-body">
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button id="hcd-tab-desktop" style="${tabStyle(true)}">Desktop</button>
        <button id="hcd-tab-mobile"  style="${tabStyle(false)}">Mobile</button>
      </div>
      <div id="hcd-section-desktop">${buildCamSection('desktop')}</div>
      <div id="hcd-section-mobile" style="display:none">${buildCamSection('mobile')}</div>
      ${videoSection}
    </div>
  `;

  document.body.appendChild(panel);

  // ── collapse / expand (starts collapsed) ──────────────────
  let collapsed = true;
  el('hcd-body').style.display = 'none';
  el('hcd-toggle').textContent = '+';
  panel.style.minWidth         = 'unset';

  el('hcd-header').addEventListener('click', () => {
    collapsed = !collapsed;
    el('hcd-body').style.display = collapsed ? 'none' : '';
    el('hcd-toggle').textContent = collapsed ? '+' : '−';
    panel.style.minWidth         = collapsed ? 'unset' : '300px';
  });

  // ── tab switching ──────────────────────────────────────────
  let activeTab = 'desktop';
  ['desktop', 'mobile'].forEach(dev => {
    el(`hcd-tab-${dev}`).addEventListener('click', () => {
      activeTab = dev;
      el('hcd-section-desktop').style.display = dev === 'desktop' ? '' : 'none';
      el('hcd-section-mobile').style.display  = dev === 'mobile'  ? '' : 'none';
      el('hcd-tab-desktop').style.background = dev === 'desktop' ? '#3a4f3a' : '#2a3530';
      el('hcd-tab-mobile').style.background  = dev === 'mobile'  ? '#3a4f3a' : '#2a3530';
    });
  });

  // ── camera: apply & copy ───────────────────────────────────
  function applyCamera(device) {
    const isActive = (device === 'desktop' && !isMob) || (device === 'mobile' && isMob);
    CAM_PARAMS.forEach(p => {
      const v = parseFloat(el(`hcd-${device}-${p.key}`).value);
      el(`hcd-${device}-${p.key}-v`).textContent = v.toFixed(2);
      if (isActive) {
        CAM[p.key] = v;
        CAM['t' + p.key[0].toUpperCase() + p.key.slice(1)] = v;
      }
    });
    if (isActive) invalidate();
  }

  ['desktop', 'mobile'].forEach(dev => {
    CAM_PARAMS.forEach(p => {
      el(`hcd-${dev}-${p.key}`).addEventListener('input', () => applyCamera(dev));
    });

    el(`hcd-${dev}-copy`).addEventListener('click', () => {
      const vals = {};
      CAM_PARAMS.forEach(p => { vals[p.key] = +parseFloat(el(`hcd-${dev}-${p.key}`).value).toFixed(2); });
      const txt = `${dev}: { theta: ${vals.theta}, phi: ${vals.phi}, radius: ${vals.radius}, cx: ${vals.cx}, cy: ${vals.cy} }`;
      navigator.clipboard.writeText(txt).then(() => {
        el(`hcd-${dev}-msg`).textContent = '✓ Скопійовано!';
        setTimeout(() => { el(`hcd-${dev}-msg`).textContent = ''; }, 2000);
      });
    });
  });

  // ── video: apply & copy ────────────────────────────────────
  function applyVideo() {
    const x = +el('hvd-x').value;
    const y = +el('hvd-y').value; // vh offset: negative = shift up (show bottom), positive = shift down (show top)
    const s = +el('hvd-s').value;
    el('hvd-x-v').textContent = x + '.00';
    el('hvd-y-v').textContent = (y >= 0 ? '+' : '') + y + '.00';
    el('hvd-s-v').textContent = s + '.00';
    if (!videoBg) return;

    // X: object-position works horizontally (video is wider than viewport on mobile portrait)
    videoBg.style.objectPosition = `${x}% 50%`;

    // Y + Scale: expand element beyond viewport and apply offsets.
    // object-position Y has no effect when object-fit:cover fills the height exactly,
    // so we shift the element's top instead.
    const scaleOff = -((s - 100) / 2); // centre the oversize element
    const topVh    = scaleOff + y;      // combine scale-centering with Y nudge

    if (s === 100 && y === 0) {
      // Restore CSS defaults
      videoBg.style.left   = '';
      videoBg.style.top    = '';
      videoBg.style.right  = '';
      videoBg.style.bottom = '';
      videoBg.style.width  = '';
      videoBg.style.height = '';
    } else {
      videoBg.style.left   = `${scaleOff}vw`;
      videoBg.style.top    = `${topVh}vh`;
      videoBg.style.right  = 'unset';
      videoBg.style.bottom = 'unset';
      videoBg.style.width  = `${s}vw`;
      videoBg.style.height = `${s}vh`;
    }
  }

  ['hvd-x', 'hvd-y', 'hvd-s'].forEach(id => {
    el(id).addEventListener('input', applyVideo);
  });

  el('hvd-copy').addEventListener('click', () => {
    const x = +el('hvd-x').value;
    const y = +el('hvd-y').value;
    const s = +el('hvd-s').value;
    const scaleOff = -((s - 100) / 2);
    const topVh    = scaleOff + y;
    let txt = `object-position: ${x}% 50%;`;
    if (s !== 100 || y !== 0) {
      txt += `\nleft: ${scaleOff}vw;\ntop: ${topVh}vh;\nright: unset;\nbottom: unset;\nwidth: ${s}vw;\nheight: ${s}vh;`;
    }
    navigator.clipboard.writeText(txt).then(() => {
      el('hvd-msg').textContent = '✓ Скопійовано!';
      setTimeout(() => { el('hvd-msg').textContent = ''; }, 2000);
    });
  });

  // ── hide when entering configurator ───────────────────────
  el('btn-start').addEventListener('click', () => { panel.style.display = 'none'; });

  // ── open correct tab for current device ───────────────────
  if (isMob) el('hcd-tab-mobile').click();

})();
