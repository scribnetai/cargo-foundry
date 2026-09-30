// ============================================================
// Cargo Foundry — canvas renderer
// Depends on: config.js, game.js
// Reads Game state + the current tool/hover from ui.js globals.
//
// Art direction (v5): every sprite is drawn from layered shapes —
// drop shadow, beveled shell, inner panel, rivets — so machines read
// as physical objects. Belts are conveyors with side rails, end
// rollers, and scrolling flow chevrons; items are shape-coded icons.
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

// Wall-clock seconds, refreshed each frame — drives smooth animation
// (belt flow, drill spin, embers) independent of the 10Hz sim tick.
let animT = 0;

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
  animT = performance.now() / 1000;
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

// ---- small helpers ---------------------------------------------

// Deterministic pseudo-random from tile coords so speckles don't flicker
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Lighten/darken a #rrggbb color by amt (-255..255)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
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

// ---- ground ----------------------------------------------------

function drawTileBase(x, y, cell) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = (x + y) % 2 === 0 ? '#0e141b' : '#0c1117';
  ctx.fillRect(px, py, TILE, TILE);
  // faint grain so empty ground isn't perfectly flat
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  const sx = px + 3 + hash2(x * 13 + 1, y * 7 + 2) * (TILE - 6);
  const sy = py + 3 + hash2(x * 7 + 3, y * 13 + 5) * (TILE - 6);
  ctx.fillRect(sx, sy, 1.6, 1.6);
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
  const iron = ore === 'iron';
  ctx.fillStyle = iron ? '#1a2230' : '#2b2015';
  ctx.fillRect(px, py, TILE, TILE);
  // rocky clusters: dark-rimmed nuggets with a highlight dot
  const ncol = iron ? '#8a94a6' : '#d08a4e';
  const hcol = iron ? '#cdd5e4' : '#f2b878';
  for (let i = 0; i < 4; i++) {
    const nx = px + 4 + hash2(x * 5 + i * 13, y * 11 + i * 7) * (TILE - 8);
    const ny = py + 4 + hash2(x * 11 + i * 3, y * 5 + i * 17) * (TILE - 8);
    const r = 2.2 + hash2(x * 3 + i, y * 7 + i) * 2.2;
    ctx.fillStyle = '#0b0e13';
    ctx.beginPath(); ctx.arc(nx, ny, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ncol;
    ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hcol;
    ctx.beginPath(); ctx.arc(nx - r * 0.3, ny - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- item icons ------------------------------------------------
// One item glyph centered at (cx, cy), ~s px half-size. Every shape
// carries a dark outline + a light touch so it reads as a physical
// object both on belts and inside machines.
function drawItemShape(item, cx, cy, s) {
  const color = ITEMS[item].color;
  if (item.endsWith('-ore')) {
    // rocky nugget: irregular hexagon
    const k = [1, 0.78, 0.95, 0.7, 0.9, 0.82];
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const r = s * k[i];
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85]);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([X, Y], i) => i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y));
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#0a0d12'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(pts[4][0], pts[4][1]); ctx.lineTo(pts[5][0], pts[5][1]); ctx.lineTo(pts[0][0], pts[0][1]);
    ctx.stroke();
  } else if (item.endsWith('-plate')) {
    // flat ingot bar
    ctx.fillStyle = color;
    roundRect(cx - s, cy - s * 0.55, s * 2, s * 1.1, 2);
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#0a0d12'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - s + 2.5, cy - s * 0.55 + 1.6);
    ctx.lineTo(cx + s - 2.5, cy - s * 0.55 + 1.6);
    ctx.stroke();
  } else if (item === 'copper-wire') {
    // coil: dark rim, copper ring, dark core
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.6, s * 0.44);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(cx - s * 0.3, cy - s * 0.35, s * 0.14, 0, Math.PI * 2); ctx.fill();
  } else if (item === 'iron-gear') {
    // gear: teeth + body + hub hole
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillRect(-s * 0.26, -s * 1.08, s * 0.52, s * 0.55);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.74, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#0a0d12';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.74, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(cx - s * 0.24, cy - s * 0.26, s * 0.15, 0, Math.PI * 2); ctx.fill();
  } else if (item === 'circuit') {
    // chip: green die, silver pins, dark core dot
    const w = s * 1.5;
    ctx.fillStyle = color;
    roundRect(cx - w / 2, cy - w / 2, w, w, 1.5);
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#0a0d12'; ctx.stroke();
    ctx.strokeStyle = '#c9d4e3'; ctx.lineWidth = 1.5;
    for (const off of [-w * 0.22, w * 0.22]) {
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 - 2.5, cy + off); ctx.lineTo(cx - w / 2, cy + off);
      ctx.moveTo(cx + w / 2, cy + off); ctx.lineTo(cx + w / 2 + 2.5, cy + off);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  } else {
    // fallback: simple rounded token in the item's color
    ctx.fillStyle = color;
    roundRect(cx - s * 0.8, cy - s * 0.8, s * 1.6, s * 1.6, 2);
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#0a0d12'; ctx.stroke();
  }
}

// ---- machine chassis -------------------------------------------
// Shared construction for miner / furnace / assembler: drop shadow,
// beveled shell, gradient inner panel, corner rivets.
function chassis(px, py, w, h, base, panel) {
  const W = w * TILE, H = h * TILE;
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(px + 3, py + 4, W - 2, H - 2, 5);
  ctx.fill();
  // shell
  ctx.fillStyle = base;
  roundRect(px + 1, py + 1, W - 2, H - 2, 5);
  ctx.fill();
  // bevel: light top/left, dark bottom/right
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(px + 5, py + H - 4);
  ctx.lineTo(px + 5, py + 5);
  ctx.quadraticCurveTo(px + 5, py + 2, px + 8, py + 2);
  ctx.lineTo(px + W - 5, py + 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(px + W - 5, py + 2);
  ctx.lineTo(px + W - 5, py + H - 5);
  ctx.quadraticCurveTo(px + W - 5, py + H - 2, px + W - 8, py + H - 2);
  ctx.lineTo(px + 5, py + H - 2);
  ctx.stroke();
  // inner panel with vertical gradient
  const grad = ctx.createLinearGradient(px, py, px, py + H);
  grad.addColorStop(0, panel);
  grad.addColorStop(1, shade(panel, -18));
  ctx.fillStyle = grad;
  roundRect(px + 5, py + 5, W - 10, H - 10, 3);
  ctx.fill();
  // rivets
  ctx.fillStyle = '#0a0d12';
  for (const X of [px + 3.5, px + W - 3.5])
    for (const Y of [py + 3.5, py + H - 3.5]) {
      ctx.beginPath(); ctx.arc(X, Y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
}

// A port chevron on the edge of a tile in compass direction `dir`.
// Output (inward=false): bright green, jutting OUT of the edge so it
// visually "emits" into the neighbor tile.
// Input (inward=true): cyan, hugging the edge, pointing inward.
// Each chevron sits on a dark backing tab so it reads on any body color.
const PORT_OUT = '#4ade80';
const PORT_IN = '#38bdf8';

function portChevron(px, py, dir, inward, color) {
  const d = DIRS[dir];
  // edge midpoint
  const ex = px + TILE / 2 + d.x * TILE / 2;
  const ey = py + TILE / 2 + d.y * TILE / 2;
  // dark backing tab, oriented across the edge
  ctx.fillStyle = 'rgba(5,8,12,0.85)';
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(Math.atan2(d.y, d.x) + Math.PI / 2);
  roundRect(-6.5, inward ? -6 : -3.5, 13, 9, 2);
  ctx.fill();
  ctx.restore();
  // the chevron itself
  const px2 = -d.y, py2 = d.x; // perpendicular
  const s = 5.5; // chevron size
  ctx.fillStyle = color;
  ctx.globalAlpha = inward ? 0.8 : 1;
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

// ---- buildings -------------------------------------------------

function drawBuilding(x, y, b) {
  // Multi-tile buildings draw once from their anchor cell; 1x1 buildings
  // (which may not carry anchor coords) draw at their own cell.
  const ox = b.w > 1 ? b.ax : x, oy = b.h > 1 ? b.ay : y;
  if (b.type === 'belt') drawBelt(ox, oy, b);
  else if (b.type === 'miner') drawMiner(ox, oy, b);
  else if (b.type === 'furnace') drawFurnace(ox, oy, b);
  else if (b.type === 'assembler') drawAssembler(ox, oy, b);
  else if (b.type === 'hub') drawHub(ox, oy, b);
  drawProgressBar(ox * TILE, oy * TILE, b);
}

// Conveyor belt: dark track bed, raised side rails, scrolling flow
// chevrons, and end rollers where the line terminates — so a run of
// belts reads as one continuous conveyor.
function drawBelt(tx, ty, b) {
  const px = tx * TILE, py = ty * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const d = DIRS[b.dir];
  const qx = -d.y, qy = d.x; // perpendicular unit

  // track bed
  ctx.fillStyle = '#12161d';
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  // inner bed shading: darker center stripe
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  if (d.x !== 0) ctx.fillRect(px + 1, cy - 3.5, TILE - 2, 7);
  else ctx.fillRect(cx - 3.5, py + 1, 7, TILE - 2);

  // side rails along both edges of travel
  for (const s of [-1, 1]) {
    const rx = cx + qx * s * (TILE / 2 - 2.5);
    const ry = cy + qy * s * (TILE / 2 - 2.5);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#05070a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx - d.x * TILE / 2, ry - d.y * TILE / 2);
    ctx.lineTo(rx + d.x * TILE / 2, ry + d.y * TILE / 2);
    ctx.stroke();
    ctx.strokeStyle = '#55617a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx - d.x * TILE / 2 + qx * s, ry - d.y * TILE / 2 + qy * s);
    ctx.lineTo(rx + d.x * TILE / 2 + qx * s, ry + d.y * TILE / 2 + qy * s);
    ctx.stroke();
  }

  // scrolling flow chevrons — direction + motion at a glance
  ctx.strokeStyle = 'rgba(158,172,192,0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const speed = 16; // px per second
  for (let i = 0; i < 2; i++) {
    const t = ((animT * speed + i * (TILE / 2)) % TILE) - TILE / 2; // -12..12
    const hx = cx + d.x * t, hy = cy + d.y * t;
    ctx.beginPath();
    ctx.moveTo(hx - d.x * 4 + qx * 3.5, hy - d.y * 4 + qy * 3.5);
    ctx.lineTo(hx + d.x * 1.5, hy + d.y * 1.5);
    ctx.lineTo(hx - d.x * 4 - qx * 3.5, hy - d.y * 4 - qy * 3.5);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // end rollers where the belt line terminates (not between segments)
  const front = cellAt(tx + d.x, ty + d.y);
  const back = cellAt(tx - d.x, ty - d.y);
  if (!(front && front.b && front.b.type === 'belt')) drawRoller(px, py, d, 1);
  if (!(back && back.b && back.b.type === 'belt')) drawRoller(px, py, d, -1);

  // items ride along the belt, spaced by queue position
  const n = b.items.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1); // 0..1 along travel direction
    const ix = cx - d.x * 8 + d.x * 16 * t;
    const iy = cy - d.y * 8 + d.y * 16 * t;
    drawItemShape(b.items[i], ix, iy, 4.2);
  }
}

// Roller bar across the tile at one end of a belt (end=1 front, -1 back)
function drawRoller(px, py, d, end) {
  const cx = px + TILE / 2 + d.x * end * (TILE / 2 - 3);
  const cy = py + TILE / 2 + d.y * end * (TILE / 2 - 3);
  const grad = d.x !== 0
    ? ctx.createLinearGradient(cx, cy - 4, cx, cy + 4)
    : ctx.createLinearGradient(cx - 4, cy, cx + 4, cy);
  grad.addColorStop(0, '#5a6579');
  grad.addColorStop(0.5, '#2c3340');
  grad.addColorStop(1, '#171c25');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#05070a';
  ctx.lineWidth = 1;
  if (d.x !== 0) roundRect(cx - 2.5, py + 3, 5, TILE - 6, 2.5);
  else roundRect(px + 3, cy - 2.5, TILE - 6, 5, 2.5);
  ctx.fill();
  ctx.stroke();
}

function drawMiner(tx, ty, b) {
  const px = tx * TILE, py = ty * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  chassis(px, py, 1, 1, '#241d0e', '#4a3d1e');
  // ore tint ring: shows what this miner is digging
  const cell = cellAt(tx, ty);
  const oreColor = cell && cell.ore
    ? ITEMS[cell.ore === 'iron' ? 'iron-ore' : 'copper-ore'].color
    : '#8a94a6';
  // drill pit: dark recess
  ctx.fillStyle = '#0d0a04';
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = oreColor;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  // static tooth ring
  ctx.fillStyle = '#8a6d2f';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillRect(-1, -9.5, 2, 2.5);
    ctx.restore();
  }
  // spinning drill blades
  const a0 = animT * 2.5;
  ctx.fillStyle = '#e8b23e';
  ctx.strokeStyle = '#5c4517';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i / 3) * Math.PI * 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(6.5, -2.2); ctx.lineTo(6.5, 2.2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // hub
  ctx.fillStyle = '#2c2310';
  ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b23e';
  ctx.beginPath(); ctx.arc(cx, cy, 1.2, 0, Math.PI * 2); ctx.fill();
  // ore exits here: bright green output port
  drawMachinePorts(px, py, b, false);
}

function drawFurnace(tx, ty, b) {
  const px = tx * TILE, py = ty * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  chassis(px, py, 1, 1, '#2a160e', '#4a2a1a');
  // firebox: recessed frame
  ctx.fillStyle = '#0d0705';
  roundRect(px + 6, py + 9, TILE - 12, TILE - 13, 2);
  ctx.fill();
  if (b.smelting) {
    // animated heat glow
    const flick = 0.75 + 0.25 * Math.sin(animT * 9) * Math.sin(animT * 5.3);
    const g = ctx.createRadialGradient(cx, cy + 2, 1, cx, cy + 2, 8);
    g.addColorStop(0, `rgba(255,190,90,${0.95 * flick})`);
    g.addColorStop(0.6, `rgba(255,110,30,${0.75 * flick})`);
    g.addColorStop(1, 'rgba(180,50,10,0)');
    ctx.fillStyle = g;
    roundRect(px + 6, py + 9, TILE - 12, TILE - 13, 2);
    ctx.fill();
    // rising embers
    for (let i = 0; i < 2; i++) {
      const et = (animT * 0.9 + i * 0.5) % 1;
      const ex = cx + Math.sin(animT * 3 + i * 2.4) * 3;
      const ey = py + 8 - et * 7;
      ctx.globalAlpha = (1 - et) * 0.9;
      ctx.fillStyle = '#ffcf7a';
      ctx.fillRect(ex - 1, ey - 1, 2, 2);
      ctx.globalAlpha = 1;
    }
  } else {
    // cold furnace: faint ash bed
    ctx.fillStyle = 'rgba(120,90,70,0.25)';
    roundRect(px + 8, py + 11, TILE - 16, TILE - 17, 2);
    ctx.fill();
  }
  // chimney with cap
  ctx.fillStyle = '#1c100a';
  ctx.fillRect(cx - 3.5, py + 1.5, 7, 6);
  ctx.fillStyle = '#5a3220';
  ctx.fillRect(cx - 3.5, py + 1.5, 7, 4);
  ctx.fillStyle = '#7a4a2e';
  ctx.fillRect(cx - 4.5, py + 0.5, 9, 2);
  // waiting output item, bottom-right of the panel
  if (b.out.length) drawItemShape(b.out[0], px + TILE - 7.5, py + TILE - 8.5, 3);
  // ore in (blue ports) / plates out (green port)
  drawMachinePorts(px, py, b, true);
}

function drawAssembler(tx, ty, b) {
  const px = tx * TILE, py = ty * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  chassis(px, py, 1, 1, '#12202b', '#1e3a4f');
  const rec = ASSEMBLER_RECIPES[b.recipe];
  const outItem = Object.keys(rec.out)[0];
  // work pad: recessed circle
  ctx.fillStyle = '#0b141c';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(140,200,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
  // product icon — the recipe, readable at a glance
  drawItemShape(outItem, cx, cy, 5);
  // progress ring while crafting
  if (b.crafting) {
    const frac = b.progress / rec.time;
    ctx.strokeStyle = 'rgba(124,196,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 10.5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }
  // ingredients in (blue ports) / parts out (green port)
  drawMachinePorts(px, py, b, true);
}

// The delivery hub: a 2x2 shipping crate. Drawn once over its whole
// footprint from the anchor cell. Cyan IN chevrons on all four outer
// edges say "feed items in from any side"; the down-arrow badge says
// "drop goods here".
function drawHub(tx, ty, b) {
  const px = tx * TILE, py = ty * TILE;
  const W = b.w * TILE, H = b.h * TILE;
  const cx = px + W / 2, cy = py + H / 2;
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(px + 4, py + 5, W - 4, H - 4, 6);
  ctx.fill();
  // wooden crate body with vertical gradient
  const g = ctx.createLinearGradient(px, py, px, py + H);
  g.addColorStop(0, '#7d5732');
  g.addColorStop(1, '#5e3f22');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#2e1f0e';
  ctx.lineWidth = 2.5;
  roundRect(px + 2, py + 2, W - 4, H - 4, 6);
  ctx.fill();
  ctx.stroke();
  // lid band across the top
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(px + 4, py + 4, W - 8, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + 4, py + 13, W - 8, 1.5);
  // stencil label
  ctx.fillStyle = 'rgba(255,244,230,0.75)';
  ctx.font = '700 7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C A R G O', cx, py + 9);
  // plank seams
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + 3, py + H / 2); ctx.lineTo(px + W - 3, py + H / 2);
  ctx.moveTo(px + W / 2, py + 16); ctx.lineTo(px + W / 2, py + H - 3);
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
  ctx.arc(cx, cy + 3, 10, 0, Math.PI * 2);
  ctx.fill();
  drawArrow(cx, cy + 1, 2, 6, '#ffffff'); // pointing down
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

// Thin progress bar along the bottom of a tile while a machine works
function drawProgressBar(px, py, b) {
  let frac = -1;
  if (b.type === 'miner') frac = b.progress / MINER_RATE;
  else if (b.type === 'furnace' && b.smelting) frac = b.progress / FURNACE_RECIPES[b.smelting].time;
  else if (b.type === 'assembler' && b.crafting) frac = b.progress / ASSEMBLER_RECIPES[b.recipe].time;
  if (frac < 0) return;
  const bx = px + 3, by = py + TILE - 6, bw = TILE - 6;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(bx, by, bw, 3.5, 1.75);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(bx + 1, by + 0.75, Math.max(0, (bw - 2) * Math.min(1, frac)), 2);
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
