// ============================================================
// Cargo Foundry — UI: toolbar, orders panel, modals, input
// Depends on: config.js, game.js, render.js
// Sets the render.js globals: selectedTool, hoverCell
// ============================================================

function initUI() {
  buildToolbar();
  buildRecipes();
  bindCanvas();
  bindButtons();
  bindKeys();
  bindMusic();
  Game.onEvent = onGameEvent;
  renderOrders();
  setInterval(updateStats, 500);
  updateStats();
}

// ---- toolbar ----------------------------------------------------
function buildToolbar() {
  const wrap = document.getElementById('tool-buttons');
  wrap.innerHTML = '';
  for (const t of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool' + (t.id === selectedTool ? ' active' : '');
    btn.dataset.tool = t.id;
    btn.innerHTML = `<span class="glyph">${t.glyph}</span>
                     <span class="tname">${t.name}</span>
                     <span class="hotkey">${t.hotkey}</span>`;
    btn.title = t.desc;
    btn.addEventListener('click', () => selectTool(t.id));
    wrap.appendChild(btn);
  }
  showToolDesc(selectedTool);
}

function selectTool(id) {
  selectedTool = id; // render.js global
  document.querySelectorAll('#tool-buttons .tool').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === id);
  });
  showToolDesc(id);
}

function showToolDesc(id) {
  const t = TOOLS.find(t => t.id === id);
  document.getElementById('tool-desc').textContent = t ? t.desc : '';
}

// ---- recipes reference -------------------------------------------
function buildRecipes() {
  const el = document.getElementById('recipes');
  let html = '<div class="recipe"><div class="r-title">🔥 Furnace</div>';
  for (const [inp, rec] of Object.entries(FURNACE_RECIPES)) {
    html += `<div class="r-line">${itemChip(inp)} → ${itemChip(rec.out)}</div>`;
  }
  html += '</div><div class="recipe"><div class="r-title">⚙️ Assembler</div>';
  for (const rec of Object.values(ASSEMBLER_RECIPES)) {
    const ins = Object.entries(rec.in).map(([it, n]) => `${n}× ${itemChip(it)}`).join(' + ');
    const outs = Object.entries(rec.out).map(([it, n]) => `${n}× ${itemChip(it)}`).join(' + ');
    html += `<div class="r-line"><b>${rec.name}:</b> ${ins} → ${outs}</div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

function itemChip(item) {
  const info = ITEMS[item];
  return `<span class="chip"><span class="dot" style="background:${info.color}"></span>${info.name}</span>`;
}

// ---- canvas input -------------------------------------------------
// Drag state for belt laying: null when not dragging, else the last cell
// a belt was placed/aimed on during this drag.
let beltDrag = null;

function bindCanvas() {
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    // Map CSS pixels into world tiles — zoom-aware, not a flat fraction.
    // (getBoundingClientRect scales with the zoom transform since the
    // canvas's backing pixels stay fixed.)
    const sx = (e.clientX - r.left) * (canvas.width / r.width);
    const sy = (e.clientY - r.top) * (canvas.height / r.height);
    const t = screenToTile(sx, sy); // render.js global
    hoverCell = inBounds(t.x, t.y) ? { x: t.x, y: t.y } : null;
    canvas.style.cursor = selectedTool === 'delete' ? 'not-allowed' : 'crosshair';
    if (beltDrag) continueBeltDrag();
  });
  canvas.addEventListener('mouseleave', () => { hoverCell = null; beltDrag = null; });
  // Left button places on mousedown (not click) so belt drags start instantly.
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !hoverCell) return;
    applyToolAt(selectedTool, hoverCell.x, hoverCell.y);
    if (selectedTool === 'belt') beltDrag = { x: hoverCell.x, y: hoverCell.y };
  });
  window.addEventListener('mouseup', () => { beltDrag = null; });
  // Scroll wheel zooms the map around the cursor (zoomFactor: render.js global)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // don't scroll the page; zoom instead
    const r = canvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (canvas.width / r.width);
    const sy = (e.clientY - r.top) * (canvas.height / r.height);
    zoomFactor(e.deltaY > 0 ? 1 / 1.12 : 1.12, sx, sy);
  }, { passive: false });
  // Right-click also rotates whatever is under the cursor — handy
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!hoverCell) return;
    applyToolAt('rotate', hoverCell.x, hoverCell.y);
  });
}

// Apply a tool at a cell; toast on failure (except during drags, which stay quiet)
function applyToolAt(tool, x, y, quiet) {
  const res = placeTool(tool, x, y, placeDir); // placeDir: render.js global
  if (!res.ok && res.message && !quiet) toast(res.message);
  renderOrders(); // assembler recipe clicks change the panel hint
  return res;
}

// While the left button is held with the belt tool, lay belts along the
// drag path — each new cell gets a belt facing the direction of travel.
// Dragging over an existing belt re-aims it along the drag instead.
function continueBeltDrag() {
  if (!beltDrag || !hoverCell) return;
  const px = beltDrag.x, py = beltDrag.y;
  const x = hoverCell.x, y = hoverCell.y;
  if (x === px && y === py) return;
  const dx = x - px, dy = y - py;
  // Face along the dominant axis of movement
  const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  const cell = cellAt(x, y);
  if (!cell) return;
  if (!cell.b) {
    if (cell.ore) return; // belts can't go on ore — skip quietly, keep dragging
    cell.b = newBuilding('belt', dir);
    beltDrag = { x, y };
  } else if (cell.b.type === 'belt') {
    cell.b.dir = dir;
    beltDrag = { x, y };
  }
  // Anything else occupying the cell: skip quietly, keep dragging
}

// ---- factory soundtrack ---------------------------------------------
function bindMusic() {
  // Autoplay policy: the AudioContext may only start inside a user gesture,
  // so the soundtrack kicks in on the player's first click anywhere.
  window.addEventListener('pointerdown', () => CFMusic.start(), { once: true });
  const btn = document.getElementById('btn-music');
  const slider = document.getElementById('vol-slider');
  const sync = () => { btn.textContent = CFMusic.isMuted() ? '🔇' : '🔊'; };
  btn.addEventListener('click', () => { CFMusic.toggle(); sync(); });
  if (slider) {
    slider.value = Math.round(CFMusic.getVolume() * 100);
    slider.addEventListener('input', () => {
      CFMusic.start();               // start the engine so the volume is audible
      CFMusic.setVolume(slider.value / 100);
    });
  }
  sync();
}

// ---- buttons, keys, modals -----------------------------------------
function bindButtons() {
  document.getElementById('btn-newmap').addEventListener('click', () => {
    if (confirm('Start over with a fresh map? Your current factory will be cleared.')) {
      newWorld();
      renderOrders();
      hideModal('win-modal');
      toast('Fresh map generated.');
    }
  });
  document.getElementById('btn-help').addEventListener('click', () => showModal('help-modal'));
  document.getElementById('btn-close-help').addEventListener('click', () => hideModal('help-modal'));
  document.getElementById('btn-keep-building').addEventListener('click', () => hideModal('win-modal'));
  document.getElementById('btn-win-newmap').addEventListener('click', () => {
    newWorld();
    renderOrders();
    hideModal('win-modal');
  });
  document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target.id === 'help-modal') hideModal('help-modal');
  });
  // Show help on first visit
  if (!localStorage.getItem('cargo-foundry-seen-help')) {
    showModal('help-modal');
    localStorage.setItem('cargo-foundry-seen-help', '1');
  }
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideModal('help-modal'); hideModal('win-modal'); return; }
    // Don't steal keystrokes while the player is typing (feedback form etc.)
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // R rotates the held item clockwise (was the scroll wheel's job)
    if (e.key === 'r' || e.key === 'R') { placeDir = (placeDir + 1) % 4; return; }
    const t = TOOLS.find(t => t.hotkey === e.key);
    if (t) selectTool(t.id);
  });
}

function showModal(id) { document.getElementById(id).hidden = false; }
function hideModal(id) { document.getElementById(id).hidden = true; }

// ---- orders panel ----------------------------------------------------
function renderOrders() {
  const el = document.getElementById('orders');
  const total = ORDERS.length;
  let html = `<div class="orders-head">Order ${Math.min(Game.orderIndex + 1, total)} of ${total}</div>`;

  if (Game.won) {
    html += `<div class="order-card done"><div class="o-title">✅ All orders complete!</div>
             <div class="o-sub">Free-build mode — keep expanding the factory.</div></div>`;
  } else {
    const order = ORDERS[Game.orderIndex];
    html += `<div class="order-card active"><div class="o-title">📦 Current shipment</div>`;
    order.wants.forEach((w, i) => {
      const have = Game.orderHave[i];
      const pct = Math.min(100, (have / w.need) * 100);
      html += `<div class="o-line">${itemChip(w.item)}
                 <span class="o-count">${have} / ${w.need}</span></div>
               <div class="bar"><div class="fill" style="width:${pct}%"></div></div>`;
    });
    html += `</div>`;
    if (Game.orderIndex + 1 < total) {
      const next = ORDERS[Game.orderIndex + 1].wants
        .map(w => `${w.need}× ${ITEMS[w.item].name}`).join(' + ');
      html += `<div class="order-card next"><div class="o-title">Next up</div>
               <div class="o-sub">${next}</div></div>`;
    }
  }
  el.innerHTML = html;
  updateStats();
}

function updateStats() {
  document.getElementById('stat-orders').textContent = `Orders ${Game.ordersDone}/${ORDERS.length}`;
  document.getElementById('stat-delivered').textContent = `Delivered ${Game.deliveredTotal}`;
  const s = Math.floor((Date.now() - Game.startTime) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  document.getElementById('stat-time').textContent = `${mm}:${ss}`;
}

// ---- game events -> UI -------------------------------------------------
function onGameEvent(type, data) {
  if (type === 'deliver') {
    renderOrders();
  } else if (type === 'order-complete') {
    toast(`✅ Order ${data.index + 1} complete!`);
    renderOrders();
  } else if (type === 'win') {
    const s = Math.floor((Date.now() - Game.startTime) / 1000);
    document.getElementById('win-stats').textContent =
      `You filled all ${ORDERS.length} shipment orders in ${Math.floor(s / 60)}m ${s % 60}s, ` +
      `delivering ${Game.deliveredTotal} items. The factory is yours — keep building.`;
    showModal('win-modal');
    renderOrders();
  }
}

// ---- toasts ---------------------------------------------------------------
function toast(msg) {
  const layer = document.getElementById('toasts');
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  layer.appendChild(div);
  setTimeout(() => div.classList.add('show'), 10);
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 300);
  }, 2600);
}
