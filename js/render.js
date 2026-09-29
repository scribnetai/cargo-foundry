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
                      // the R key rotates it (R = clockwise)

// ---- zoom camera ------------------------------------------------
// zoom: pixels per tile multiplier (1 = classic view).
// camX/camY: camera offset in canvas pixels. ui.js drives the camera
// through zoomAt() / screenToTile(); all drawing happens in world space
// (tile * TILE) with the transform applied.
let zoom = 1, camX = 0, camY = 0;
const ZOOM_MIN = 0.5, ZOOM_MAX = 3;

function zoomFactor(f, anchorSX, anchorSY) {
  // Keep the tile under the cursor pinned at the same screen position.
  const wx = (anchorSX - camX) / (TILE * zoom);
  const wy = (anchorSY - camY) / (TILE * zoom);
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * f));
  camX = anchorSX - wx * TILE * zoom;
  camY = anchorSY - wy * TILE * zoom;
  clampCamera();
}

function clampCamera() {
  const worldW = COLS * TILE * zoom, worldH = ROWS * TILE * zoom;
  const W = canvas.width, H = canvas.height;
  camX = worldW >= W ? Math.min(0, Math.max(W - worldW, camX)) : (W - worldW) / 2;
  camY = worldH >= H ? Math.min(0, Math.max(H - worldH, camY)) : (H - worldH) / 2;
}

// Screen (canvas CSS pixel) -> tile coords, zoom-aware. Mirrors ui.js
// hit-testing so placement always matches the rendered grid.
function screenToTile(sx, sy) {
  return {
    x: Math.floor((sx - camX) / (TILE * zoom)),
    y: Math.floor((sy - camY) / (TILE * zoom)),
  };
}

function initRender(c) {
  canvas = c;
  ctx = c.getContext('2d');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  clampCamera();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to raw canvas pixels
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(zoom, 0, 0, zoom, camX, camY); // world space: px = tile * TILE
  forEachCell((x, y, cell) => {
    drawTileBase(x, y, cell);
    if (cell.ore) drawOre(x, y, cell.ore);
    // Multi-tile buildings draw once, from their anchor cell
    if (cell.b && !(cell.b.w > 1 && (cell.b.ax !== x || cell.b.ay !== y))) {
      drawBuilding(x, y, cell.b);
    }
  });

  drawGridLines();
  if (hoverCell) {
    drawHoverHighlight(hoverCell.x, hoverCell.y);
    drawGhost(hoverCell.x, hoverCell.y);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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

// A port chevron on the edge of a tile in compass direction `dir`.
// Output (inward=false): bright green, jutting OUT of the edge so it
// visually "emits" into the neighbor tile.
// Input (inward=true): cyan, hugging the edge, pointing inward.
const PORT_OUT = '#4ade80';
const PORT_IN = '#38bdf8';

function portChevron(px, py, dir, inward, color) {
  const d = DIRS[dir];
  // edge midpoint
  const ex = px + TILE / 2 + d.x * TILE / 2;
  const ey = py + TILE / 2 + d.y * TILE / 2;
  const px2 = -d.y, py2 = d.x; // perpendicular
  const s = 5; // chevron size
  ctx.fillStyle = color;
  ctx.globalAlpha = inward ? 0.75 : 1;
  ctx.beginPath();
  if (inward) {
    // triangle sitting on the edge, tip pointing INTO the tile
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + px2 * s * 1.4 - d.x * s * 1.8, ey + py2 * s * 1.4 - d.y * s * 1.8);
    ctx.lineTo(ex - px2 * s * 1.4 - d.x * s * 1.8, ey - py2 * s * 1.4 - d.y * s * 1.8);
  } else {
    // triangle straddling the edge, tip pointing OUT of the tile
    ctx.moveTo(ex + d.x * s * 1.6, ey + d.y * s * 1.6);
    ctx.lineTo(ex + px2 * s * 1.2, ey + py2 * s * 1.2);
    ctx.lineTo(ex - px2 * s * 1.2, ey - py2 * s * 1.2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Machine port layout: OUT chevron on the facing edge, IN chevrons on
// the remaining edges (miners have no inputs — output only).
function drawMachinePorts(px, py, b, hasInput) {
  portChevron(px, py, b.dir, false, PORT_OUT);
  if (hasInput) {
    for (let d = 0; d < 4; d++) {
      if (d === b.dir) continue;
      portChevron(px, py, d, true, PORT_IN);
    }
  }
}

function drawBuilding(x, y, b) {
  // Multi-tile buildings draw once from their anchor cell; 1x1 buildings
  // (which may not carry anchor coords) draw at their own cell.
  const ox = b.w > 1 ? b.ax : x, oy = b.h > 1 ? b.ay : y;
  const px = ox * TILE, py = oy * TILE;
  const cx = px + (b.w * TILE) / 2, cy = py + (b.h * TILE) / 2;
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
  // ore exits here: bright green output port
  drawMachinePorts(px, py, b, false);
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
  // ore in (blue ports) / plates out (green port)
  drawMachinePorts(px, py, b, true);
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
  // ingredients in (blue ports) / parts out (green port)
  drawMachinePorts(px, py, b, true);
}

// The delivery hub: a 2x2 shipping crate. Drawn once over its whole
// footprint from the anchor cell. Cyan IN chevrons on all four outer
// edges say "feed items in from any side"; the down-arrow badge says
// "drop goods here".
function drawHub(px, py, cx, cy, b) {
  const W = b.w * TILE, H = b.h * TILE;
  // wooden crate body
  ctx.fillStyle = '#6b4a2a';
  ctx.strokeStyle = '#3d2a17';
  ctx.lineWidth = 3;
  roundRect(px + 2, py + 2, W - 4, H - 4, 6);
  ctx.fill();
  ctx.stroke();
  // plank seams
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + 3, py + H / 2); ctx.lineTo(px + W - 3, py + H / 2);
  ctx.moveTo(px + W / 2, py + 3); ctx.lineTo(px + W / 2, py + H - 3);
  ctx.stroke();
  // corner brackets
  ctx.strokeStyle = '#d7a45e';
  ctx.lineWidth = 2.5;
  const c = 9;
  const corners = [[px + 5, py + 5, 1, 1], [px + W - 5, py + 5, -1, 1],
                   [px + 5, py + H - 5, 1, -1], [px + W - 5, py + H - 5, -1, -1]];
  for (const [qx, qy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(qx + sx * c, qy);
    ctx.lineTo(qx, qy);
    ctx.lineTo(qx, qy + sy * c);
    ctx.stroke();
  }
  // drop-in badge: dark disc with a white down arrow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();
  drawArrow(cx, cy - 2, 2, 6, '#ffffff'); // pointing down
  // IN chevrons along every outer edge, one per tile
  for (let i = 0; i < b.w; i++) {
    const ex = px + i * TILE;
    portChevron(ex, py, 0, true, PORT_IN);                    // top
    portChevron(ex, py + (b.h - 1) * TILE, 2, true, PORT_IN); // bottom
  }
  for (let j = 0; j < b.h; j++) {
    const ey = py + j * TILE;
    portChevron(px, ey, 3, true, PORT_IN);                    // left
    portChevron(px + (b.w - 1) * TILE, ey, 1, true, PORT_IN); // right
  }
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
  // The hub tool previews a 2x2 footprint; highlight the whole area.
  const fp = footprint(selectedTool);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x * TILE + 1, y * TILE + 1, fp.w * TILE - 2, fp.h * TILE - 2);
}

// Translucent preview of what the selected tool would do here
function drawGhost(x, y) {
  const check = canPlace(selectedTool, x, y);
  if (selectedTool === 'rotate' || selectedTool === 'delete') return; // no ghost for these
  ctx.globalAlpha = 0.45;
  const px = x * TILE, py = y * TILE;
  if (check.ok) {
    const ghost = newBuilding(selectedTool, placeDir);
    ghost.ax = x; ghost.ay = y;
    const cell = cellAt(x, y);
    if (check.reconfigure && cell.b) ghost.dir = cell.b.dir;
    drawBuilding(x, y, ghost);
  } else if (selectedTool === 'hub') {
    // red 2x2 preview so the footprint is obvious even when it fails
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.fillRect(px, py, 2 * TILE, 2 * TILE);
  } else {
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.fillRect(px, py, TILE, TILE);
  }
  ctx.globalAlpha = 1;
}
