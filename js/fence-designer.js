/**
 * fence-designer.js — Style 5 section tweaker (DEV only)
 * Floating draggable panel. Remove <script> tag when done.
 */
(function () {

  const TARGET = 8;
  const FD = Object.assign({}, FENCE_STYLES[TARGET]);

  function applyDesign() {
    FENCE_STYLES[TARGET] = Object.assign({}, FD);
    if (ST.fenceStyle === TARGET) buildFence();
  }

  const mm  = v => Math.round(v * 1000) + ' мм';
  const pcs = v => Math.round(v) + ' шт';

  const PARAMS = [
    { key:'barTipH', label:'Гострота кінця прута (мм)', min:0, max:0.300, step:0.005, fmt:mm },
  ];

  // ── Build rows HTML ───────────────────────────────────────────
  const rows = PARAMS.map(p => `<div class="fds-row">
      <div class="fds-label">${p.label}</div>
      <div class="fds-right">
        <span class="fds-val" id="fdv-${p.key}">${p.fmt(FD[p.key] ?? p.min)}</span>
        <input class="fds-slider" type="range"
          min="${p.min}" max="${p.max}" step="${p.step}" value="${FD[p.key] ?? p.min}"
          oninput="FD_update('${p.key}', +this.value)">
      </div>
    </div>`).join('');

  // ── Panel DOM ─────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'fence-designer';
  panel.innerHTML = `
    <div class="fds-header">
      <span>✏️ Стиль 8 — гострота</span>
      <button class="fds-close" onclick="this.closest('#fence-designer').style.display='none'">✕</button>
    </div>
    <div class="fds-body">${rows}</div>
    <div class="fds-hint">Налаштуй → скажи значення → захардкожу</div>`;

  const style = document.createElement('style');
  style.textContent = `
    #fence-designer{
      position:fixed;bottom:20px;right:20px;z-index:9999;
      background:#1e2221;color:#e8e4dc;
      font-family:'Montserrat',sans-serif;font-size:11px;
      border-radius:10px;padding:14px;width:310px;
      box-shadow:0 8px 32px rgba(0,0,0,.5);
    }
    .fds-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;
      font-weight:700;font-size:12px;letter-spacing:1px;color:#C3AD8B;cursor:grab;}
    .fds-header span{flex:1;}
    .fds-close{background:none;border:none;color:#888;cursor:pointer;font-size:14px;padding:0 4px;}
    .fds-close:hover{color:#fff;}
    .fds-body{max-height:65vh;overflow-y:auto;}
    .fds-group{margin:10px 0 4px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
      color:#888;border-top:1px solid #333;padding-top:8px;}
    .fds-group:first-child{border-top:none;margin-top:0;}
    .fds-row{margin-bottom:8px;}
    .fds-label{color:#aaa;margin-bottom:2px;font-size:10px;}
    .fds-right{display:flex;align-items:center;gap:8px;}
    .fds-val{min-width:52px;text-align:right;color:#C3AD8B;font-weight:700;font-size:11px;}
    .fds-slider{flex:1;accent-color:#C3AD8B;cursor:pointer;}
    .fds-hint{margin-top:10px;color:#555;font-size:10px;text-align:center;}
  `;
  document.head.appendChild(style);
  document.body.appendChild(panel);

  // ── Global update handler ─────────────────────────────────────
  window.FD_update = function (key, val) {
    FD[key] = val;
    const el  = document.getElementById('fdv-' + key);
    const par = PARAMS.find(p => p.key === key);
    if (el && par) el.textContent = par.fmt(val);
    applyDesign();
  };

  // ── Draggable ─────────────────────────────────────────────────
  const hdr = panel.querySelector('.fds-header');
  let drag=false, ox=0, oy=0;
  hdr.addEventListener('mousedown', e => {
    drag=true; ox=e.clientX-panel.offsetLeft; oy=e.clientY-panel.offsetTop;
    hdr.style.cursor='grabbing'; e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.right='auto'; panel.style.bottom='auto';
    panel.style.left=(e.clientX-ox)+'px'; panel.style.top=(e.clientY-oy)+'px';
  });
  document.addEventListener('mouseup', () => { drag=false; hdr.style.cursor='grab'; });

})();
