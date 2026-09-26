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
function bindCanvas() {
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / COLS));
    const y = Math.floor((e.clientY - r.top) / (r.height / ROWS));
    hoverCell = inBounds(x, y) ? { x, y } : null; // render.js global
    canvas.style.cursor = selectedTool === 'delete' ? 'not-allowed' : 'crosshair';
  });
  canvas.addEventListener('mouseleave', () => { hoverCell = null; });
  canvas.addEventListener('click', (e) => {
    if (!hoverCell) return;
    const res = placeTool(selectedTool, hoverCell.x, hoverCell.y);
    if (!res.ok && res.message) toast(res.message);
    renderOrders(); // assembler recipe clicks change the panel hint
  });
  // Right-click also rotates whatever is under the cursor — handy
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!hoverCell) return;
    const res = placeTool('rotate', hoverCell.x, hoverCell.y);
    if (!res.ok && res.message) toast(res.message);
  });
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
