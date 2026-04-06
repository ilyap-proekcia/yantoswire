// ─── DEV PANEL: SCENE COLOR ───────────────────────────────────
// Floating panel to tweak background + floor colors.
// Only visible in config mode. Remove <script> tag to ship.
(function () {

  let _bgHex  = '#F5F4F0';
  let _gndHex = '#EBE8E1';

  const BG_PRESETS = [
    { label: 'Porcelain', hex: '#F5F4F0' },
    { label: 'White',     hex: '#FFFFFF' },
    { label: 'Cool Gray', hex: '#E8EAED' },
    { label: 'Warm Sand', hex: '#EDE8DF' },
    { label: 'Slate',     hex: '#D0D5DD' },
    { label: 'Dark',      hex: '#1C1C1E' },
  ];

  const GND_PRESETS = [
    { label: 'Linen',     hex: '#EBE8E1' },
    { label: 'White',     hex: '#F8F8F6' },
    { label: 'Concrete',  hex: '#D6D3CC' },
    { label: 'Asphalt',   hex: '#B0ADA6' },
    { label: 'Grass',     hex: '#8FAF72' },
    { label: 'Dark',      hex: '#3A3A3A' },
  ];

  // ── Build panel UI ────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'scene-color-dev';

  function presetsHTML(list, cls) {
    return list.map(p =>
      `<button class="${cls} scd-swatch" data-hex="${p.hex}" title="${p.label}"
        style="background:${p.hex}"></button>`
    ).join('');
  }

  panel.innerHTML = `
    <div id="scd-header">
      <span>🎨 Кольори сцени</span>
      <button id="scd-close">✕</button>
    </div>
    <div id="scd-body">

      <div class="scd-section">
        <div class="scd-section-label">Фон</div>
        <div class="scd-row">
          <input type="color" id="scd-bg-picker" value="${_bgHex}">
          <input type="text"  id="scd-bg-hex"    value="${_bgHex}" maxlength="7" spellcheck="false">
        </div>
        <div class="scd-swatches">${presetsHTML(BG_PRESETS, 'scd-bg-preset')}</div>
      </div>

      <div class="scd-divider"></div>

      <div class="scd-section">
        <div class="scd-section-label">Підлога</div>
        <div class="scd-row">
          <input type="color" id="scd-gnd-picker" value="${_gndHex}">
          <input type="text"  id="scd-gnd-hex"    value="${_gndHex}" maxlength="7" spellcheck="false">
        </div>
        <div class="scd-swatches">${presetsHTML(GND_PRESETS, 'scd-gnd-preset')}</div>
      </div>

      <div class="scd-output">
        bg: <span id="scd-bg-val">${_bgHex}</span><br>
        gnd: <span id="scd-gnd-val">${_gndHex}</span>
      </div>

    </div>
  `;

  // ── Styles ────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #scene-color-dev {
      position: fixed; bottom: 16px; left: 16px; z-index: 9999;
      background: #1a1a1a; color: #eee; border-radius: 10px;
      font: 12px/1.4 ui-monospace,'SF Mono',monospace;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      width: 240px; display: none;
    }
    #scd-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; border-bottom: 1px solid #333; font-size: 13px;
    }
    #scd-close {
      background: none; border: none; color: #888; cursor: pointer;
      font-size: 15px; line-height: 1; padding: 0;
    }
    #scd-close:hover { color: #fff; }
    #scd-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .scd-section { display: flex; flex-direction: column; gap: 7px; }
    .scd-section-label { color: #aaa; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .scd-row { display: flex; align-items: center; gap: 8px; }
    .scd-row input[type=color] {
      width: 36px; height: 36px; border: none; padding: 0;
      border-radius: 6px; cursor: pointer; background: none; flex-shrink: 0;
    }
    .scd-row input[type=text] {
      flex: 1; background: #2a2a2a; border: 1px solid #444; border-radius: 6px;
      color: #fff; font: inherit; padding: 6px 10px; text-transform: uppercase;
    }
    .scd-row input[type=text]:focus { outline: none; border-color: #888; }
    .scd-swatches { display: flex; gap: 5px; }
    .scd-swatch {
      flex: 1; height: 22px; border: 1.5px solid transparent;
      border-radius: 4px; cursor: pointer; transition: border-color 0.12s;
      padding: 0;
    }
    .scd-swatch:hover { border-color: #fff8; }
    .scd-swatch.active { border-color: #fff; }
    .scd-divider { height: 1px; background: #333; margin: 2px 0; }
    .scd-output {
      background: #111; border-radius: 5px; padding: 7px 10px;
      font-size: 10px; color: #6a9; line-height: 1.8;
    }
  `;

  document.head.appendChild(style);

  if (document.readyState !== 'loading') {
    document.body.appendChild(panel);
    _bindEvents();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(panel);
      _bindEvents();
    });
  }

  // ── Apply background color ────────────────────────────────────
  function _applyBg(hex) {
    _bgHex = hex;
    document.getElementById('scd-bg-val').textContent    = hex.toUpperCase();
    document.getElementById('scd-bg-hex').value          = hex.toUpperCase();
    document.getElementById('scd-bg-picker').value       = hex;
    document.querySelectorAll('.scd-bg-preset').forEach(b =>
      b.classList.toggle('active', b.dataset.hex.toUpperCase() === hex.toUpperCase()));

    if (typeof scene !== 'undefined' && scene.background) {
      scene.background.set(hex);
      if (scene.fog) scene.fog.color.set(hex);
      if (typeof renderer !== 'undefined') renderer.setClearColor(hex, 1);
    }
    document.documentElement.style.setProperty('--bg', hex);
    document.documentElement.style.setProperty('--porcelain', hex);
    if (typeof invalidate === 'function') invalidate();
  }

  // ── Apply floor color ─────────────────────────────────────────
  function _applyGnd(hex) {
    _gndHex = hex;
    document.getElementById('scd-gnd-val').textContent   = hex.toUpperCase();
    document.getElementById('scd-gnd-hex').value         = hex.toUpperCase();
    document.getElementById('scd-gnd-picker').value      = hex;
    document.querySelectorAll('.scd-gnd-preset').forEach(b =>
      b.classList.toggle('active', b.dataset.hex.toUpperCase() === hex.toUpperCase()));

    if (typeof gnd !== 'undefined') {
      gnd.material.color.set(hex);
      gnd.material.needsUpdate = true;
    }
    if (typeof invalidate === 'function') invalidate();
  }

  // ── Bind events ───────────────────────────────────────────────
  function _bindEvents() {
    // Background
    document.getElementById('scd-bg-picker').addEventListener('input', e => _applyBg(e.target.value));
    document.getElementById('scd-bg-hex').addEventListener('change', e => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value.trim())) _applyBg(e.target.value.trim());
    });
    document.getElementById('scd-bg-hex').addEventListener('keydown', e => {
      if (e.key === 'Enter') e.target.blur();
    });
    document.querySelectorAll('.scd-bg-preset').forEach(b =>
      b.addEventListener('click', () => _applyBg(b.dataset.hex)));

    // Floor
    document.getElementById('scd-gnd-picker').addEventListener('input', e => _applyGnd(e.target.value));
    document.getElementById('scd-gnd-hex').addEventListener('change', e => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value.trim())) _applyGnd(e.target.value.trim());
    });
    document.getElementById('scd-gnd-hex').addEventListener('keydown', e => {
      if (e.key === 'Enter') e.target.blur();
    });
    document.querySelectorAll('.scd-gnd-preset').forEach(b =>
      b.addEventListener('click', () => _applyGnd(b.dataset.hex)));

    // Close
    document.getElementById('scd-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }

  // ── Public ────────────────────────────────────────────────────
  window.showSceneColorDev = function () {
    panel.style.display = 'block';
    if (typeof scene !== 'undefined' && scene.background && scene.background.isColor) {
      _bgHex = '#' + scene.background.getHexString();
    }
    if (typeof gnd !== 'undefined') {
      _gndHex = '#' + gnd.material.color.getHexString();
    }
    _applyBg(_bgHex);
    _applyGnd(_gndHex);
  };

})();
