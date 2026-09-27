// ============================================================
// Cargo Foundry — canvas renderer
// Depends on: config.js, game.js
// Reads Game state + the current tool/hover from ui.js globals.
// ============================================================

let canvas = null;
let ctx = null;

// ui.js sets these; render only reads them
let selectedTool = 'belt';
let hoverCell = null; // { x, y } | null
let placeDir = 1;     // compass direction the ghost (and new buildings) face;
                      // the mouse wheel adjusts it (scroll down = clockwise)

function initRender(c) {
  canvas = c;
  ctx = c.getContext('2d');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
}

function render() {
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  forEachCell((x, y, cell) => {
    drawTileBase(x, y, cell);
    if (cell.ore) drawOre(x, y, cell.ore);
    if (cell.b) drawBuilding(x, y, cell.b);
  });

  drawGridLines();
  if (hoverCell) {
    drawHoverHighlight(hoverCell.x, hoverCell.y);
    drawGhost(hoverCell.x, hoverCell.y);
  }
}

// Deterministic pseudo-random from tile coords so speckles don't flicker
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawTileBase(x, y, cell) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = (x + y) % 2 === 0 ? '#0e1319' : '#0d1218';
  ctx.fillRect(px, py, TILE, TILE);
}

function drawGridLines() {
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * TILE + 0.5, 0); ctx.lineTo(x * TILE + 0.5, ROWS * TILE); }
  for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * TILE + 0.5); ctx.lineTo(COLS * TILE, y * TILE + 0.5); }
  ctx.stroke();
}

function drawOre(x, y, ore) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = ore === 'iron' ? '#232c38' : '#3a2a1c';
  ctx.fillRect(px, py, TILE, TILE);
  // speckles
  ctx.fillStyle = ore === 'iron' ? '#8a94a6' : '#d08a4e';
  for (let i = 0; i < 5; i++) {
    const sx = px + 3 + hash2(x * 7 + i, y * 3) * (TILE - 6);
    const sy = py + 3 + hash2(x * 3, y * 7 + i) * (TILE - 6);
    ctx.fillRect(sx, sy, 3, 3);
  }
}

function drawBuilding(x, y, b) {
  const px = x * TILE, py = y * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  if (b.type === 'belt') drawBelt(px, py, cx, cy, b);
  else if (b.type === 'miner') drawMiner(px, py, cx, cy, b);
  else if (b.type === 'furnace') drawFurnace(px, py, cx, cy, b);
  else if (b.type === 'assembler') drawAssembler(px, py, cx, cy, b);
  else if (b.type === 'hub') drawHub(px, py, cx, cy, b);
  drawProgressBar(px, py, b);
}

function bodyRect(px, py, inset, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  roundRect(px + inset, py + inset, TILE - inset * 2, TILE - inset * 2, 4);
  ctx.fill();
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Arrow pointing in `dir`, centered at (cx, cy), size s
function drawArrow(cx, cy, dir, s, color) {
  const d = DIRS[dir];
  const tipX = cx + d.x * s, tipY = cy + d.y * s;
  const backX = cx - d.x * s, backY = cy - d.y * s;
  // perpendicular
  const px = -d.y, py = d.x;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backX + px * s * 0.7, backY + py * s * 0.7);
  ctx.lineTo(backX - px * s * 0.7, backY - py * s * 0.7);
  ctx.closePath();
  ctx.fill();
}

function drawBelt(px, py, cx, cy, b) {
  bodyRect(px, py, 2, '#20262f', '#3a4350');
  drawArrow(cx, cy, b.dir, 6, '#7d8aa0');
  // items ride along the belt, spaced by queue position
  const d = DIRS[b.dir];
  const n = b.items.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1); // 0..1 along travel direction
    const ix = cx - d.x * 8 + d.x * 16 * t - 3;
    const iy = cy - d.y * 8 + d.y * 16 * t - 3;
    ctx.fillStyle = ITEMS[b.items[i]].color;
    ctx.fillRect(ix, iy, 6, 6);
  }
}

function drawMiner(px, py, cx, cy, b) {
  bodyRect(px, py, 2, '#3d3418', '#8a6d2f');
  // drill head
  ctx.fillStyle = '#c98f2d';
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c4517';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // small direction tick on the output edge
  const d = DIRS[b.dir];
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(cx + d.x * 9 - 1.5, cy + d.y * 9 - 1.5, 3, 3);
}

function drawFurnace(px, py, cx, cy, b) {
  const hot = b.smelting ? (0.6 + 0.4 * Math.sin(Game.tickCount / 3)) : 0;
  bodyRect(px, py, 2, '#40251a', '#a3542a');
  ctx.fillStyle = `rgba(255,120,30,${0.25 + hot * 0.45})`;
  roundRect(px + 6, py + 6, TILE - 12, TILE - 12, 3);
  ctx.fill();
  // chimney
  ctx.fillStyle = '#6b3a22';
  ctx.fillRect(cx - 3, py + 2, 6, 5);
  if (b.out.length) {
    ctx.fillStyle = ITEMS[b.out[0]].color;
    ctx.fillRect(cx - 3, cy + 4, 6, 6);
  }
}

function drawAssembler(px, py, cx, cy, b) {
  bodyRect(px, py, 2, '#1c3446', '#3f7ea6');
  const rec = ASSEMBLER_RECIPES[b.recipe];
  const outItem = Object.keys(rec.out)[0];
  // recipe indicator dot = first output item's color
  ctx.fillStyle = ITEMS[outItem].color;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e1a24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  if (b.crafting) {
    ctx.strokeStyle = 'rgba(140,200,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, -Math.PI / 2, -Math.PI / 2 + (b.progress / rec.time) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawHub(px, py, cx, cy) {
  bodyRect(px, py, 1, '#123f22', '#35c759');
  // little crate glyph
  ctx.strokeStyle = '#d7ffe0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 5, cy - 5, 10, 10);
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
  ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
  ctx.stroke();
}

// Thin progress bar along the bottom of a tile while a machine works
function drawProgressBar(px, py, b) {
  let frac = -1;
  if (b.type === 'miner') frac = b.progress / MINER_RATE;
  else if (b.type === 'furnace' && b.smelting) frac = b.progress / FURNACE_RECIPES[b.smelting].time;
  else if (b.type === 'assembler' && b.crafting) frac = b.progress / ASSEMBLER_RECIPES[b.recipe].time;
  if (frac < 0) return;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px + 2, py + TILE - 5, TILE - 4, 3);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(px + 2, py + TILE - 5, (TILE - 4) * Math.min(1, frac), 3);
}

function drawHoverHighlight(x, y) {
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
}

// Translucent preview of what the selected tool would do here
function drawGhost(x, y) {
  const check = canPlace(selectedTool, x, y);
  if (selectedTool === 'rotate' || selectedTool === 'delete') return; // no ghost for these
  ctx.globalAlpha = 0.45;
  const px = x * TILE, py = y * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  if (check.ok) {
    const ghost = newBuilding(selectedTool, placeDir);
    const cell = cellAt(x, y);
    if (check.reconfigure && cell.b) ghost.dir = cell.b.dir;
    drawBuilding(x, y, ghost);
  } else {
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.fillRect(px, py, TILE, TILE);
  }
  ctx.globalAlpha = 1;
}
