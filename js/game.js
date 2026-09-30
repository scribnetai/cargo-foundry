// ============================================================
// Cargo Foundry — game state, world generation, and simulation
// Depends on: config.js
// Note: this file touches no DOM, so the logic can be tested with
// plain Node by concatenating config.js + game.js.
// ============================================================

const Game = {
  grid: [],          // [y][x] -> { ore: null | 'iron' | 'copper', b: null | building }
  tickCount: 0,
  orderIndex: 0,     // which entry of ORDERS is active
  orderHave: [],     // delivered counts, parallel to the active order's `wants`
  deliveredTotal: 0, // every item ever fed to a hub
  ordersDone: 0,
  startTime: Date.now(),
  won: false,
  onEvent: null,     // UI hook: (type, data) => {} — 'deliver' | 'order-complete' | 'win'
};

// ---- buildings ------------------------------------------------
// Every building: { type, dir } where dir is 0=up 1=right 2=down 3=left.
// Per-type state:
//   belt:      { items: [] }                    queue of item ids, max BELT_CAPACITY
//   miner:     { progress }                     ticks toward the next ore
//   furnace:   { inType, inN, smelting, progress, out: [] }
//   assembler: { recipe, inbuf: {}, crafting, progress, out: [] }
//   hub:       {}                               no state; just eats items
//
// Buildings can span multiple tiles (the delivery hub is 2x2). The one
// building OBJECT is referenced by every cell it covers; ax/ay is the
// anchor (top-left) tile of the footprint.
const FOOTPRINTS = { hub: { w: 2, h: 2 } };
function footprint(type) { return FOOTPRINTS[type] || { w: 1, h: 1 }; }

function newBuilding(type, dir = 1) {
  const b = { type, dir }; // face `dir` (default right)
  const fp = footprint(type);
  b.w = fp.w; b.h = fp.h;
  b.ax = 0; b.ay = 0;      // set for real by placeBuildingAt
  if (type === 'belt') b.items = [];
  if (type === 'miner') b.progress = 0;
  if (type === 'furnace') { b.inType = null; b.inN = 0; b.smelting = null; b.progress = 0; b.out = []; }
  if (type === 'assembler') { b.recipe = 'wire'; b.inbuf = {}; b.crafting = false; b.progress = 0; b.out = []; }
  return b;
}

// ---- world generation ------------------------------------------
function newWorld() {
  Game.grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) row.push({ ore: null, b: null });
    Game.grid.push(row);
  }

  // Three iron patches and three copper patches, each a random blob
  for (const ore of ['iron', 'copper']) {
    for (let p = 0; p < 3; p++) growOreBlob(ore);
  }

  // One delivery hub pre-placed near the right edge, vertically centered.
  // It's a 2x2 shipping crate — stamp it as one building over 4 cells.
  placeBuildingAt('hub', COLS - 6, Math.floor(ROWS / 2) - 1, 1);

  Game.tickCount = 0;
  Game.orderIndex = 0;
  Game.ordersDone = 0;
  Game.deliveredTotal = 0;
  Game.won = false;
  Game.startTime = Date.now();
  resetOrderProgress();
}

// Random-walk blob of ore tiles
function growOreBlob(ore) {
  let x = 4 + Math.floor(Math.random() * (COLS - 8));
  let y = 4 + Math.floor(Math.random() * (ROWS - 8));
  const target = 45 + Math.floor(Math.random() * 25);
  let placed = 0, guard = 0;
  while (placed < target && guard < 900) {
    guard++;
    if (!Game.grid[y][x].ore) { Game.grid[y][x].ore = ore; placed++; }
    x += Math.floor(Math.random() * 3) - 1;
    y += Math.floor(Math.random() * 3) - 1;
    x = Math.max(1, Math.min(COLS - 2, x));
    y = Math.max(1, Math.min(ROWS - 2, y));
  }
}

function resetOrderProgress() {
  Game.orderHave = ORDERS[Game.orderIndex].wants.map(() => 0);
}

// ---- grid helpers ----------------------------------------------
function inBounds(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
function cellAt(x, y) { return inBounds(x, y) ? Game.grid[y][x] : null; }
function forEachCell(fn) {
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      fn(x, y, Game.grid[y][x]);
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- item transfer ---------------------------------------------
// Can building `b` accept `item` arriving from direction `fromDir`
// (fromDir is the compass direction the item comes FROM, target's view)?
function canAccept(b, item, fromDir) {
  if (!b) return false;
  if (b.type === 'belt') {
    // Belts take input from any side except the side they output to
    return b.items.length < BELT_CAPACITY && fromDir !== b.dir;
  }
  if (b.type === 'furnace') {
    if (!FURNACE_RECIPES[item]) return false;                 // only ore
    if (b.inType !== null && b.inType !== item) return false; // one ore kind at a time
    return b.inN < MACHINE_INPUT_CAP;
  }
  if (b.type === 'assembler') {
    const rec = ASSEMBLER_RECIPES[b.recipe];
    if (!rec.in[item]) return false;                          // only recipe ingredients
    return (b.inbuf[item] || 0) < MACHINE_INPUT_CAP;
  }
  if (b.type === 'hub') return true;                          // hubs eat anything
  return false; // miners take no input
}

function receive(b, item) {
  if (b.type === 'belt') b.items.push(item);
  else if (b.type === 'furnace') { if (b.inType === null) b.inType = item; b.inN++; }
  else if (b.type === 'assembler') b.inbuf[item] = (b.inbuf[item] || 0) + 1;
  else if (b.type === 'hub') deliverToHub(item);
}

// Push one item from the building at (x, y) into the neighbor it faces.
// Returns true if the neighbor took it.
function emitFrom(x, y, item) {
  const cell = cellAt(x, y);
  if (!cell || !cell.b) return false;
  const d = DIRS[cell.b.dir];
  const n = cellAt(x + d.x, y + d.y);
  if (!n || !n.b) return false;
  const fromDir = (cell.b.dir + 2) % 4; // direction the item enters the target from
  if (!canAccept(n.b, item, fromDir)) return false;
  receive(n.b, item);
  return true;
}

// ---- shipment orders -------------------------------------------
function deliverToHub(item) {
  Game.deliveredTotal++;
  const order = ORDERS[Game.orderIndex];
  if (order && !Game.won) {
    order.wants.forEach((w, i) => {
      if (w.item === item && Game.orderHave[i] < w.need) Game.orderHave[i]++;
    });
    if (order.wants.every((w, i) => Game.orderHave[i] >= w.need)) completeOrder();
  }
  if (Game.onEvent) Game.onEvent('deliver', { item });
}

function completeOrder() {
  Game.ordersDone++;
  if (Game.onEvent) Game.onEvent('order-complete', { index: Game.orderIndex });
  if (Game.orderIndex + 1 >= ORDERS.length) {
    Game.won = true;
    if (Game.onEvent) Game.onEvent('win', {});
  } else {
    Game.orderIndex++;
    resetOrderProgress();
  }
}

// ---- simulation tick --------------------------------------------
function tick() {
  Game.tickCount++;

  // 1. Miners dig ore out of their tile and push it in their facing direction.
  //    Progress only resets on a successful push, so ore is never voided.
  forEachCell((x, y, cell) => {
    const b = cell.b;
    if (!b || b.type !== 'miner') return;
    b.progress++;
    if (b.progress >= MINER_RATE) {
      if (emitFrom(x, y, cell.ore + '-ore')) b.progress = 0;
    }
  });

  // 2. Furnaces smelt: pull from input buffer, craft, push plates to output.
  forEachCell((x, y, cell) => {
    const b = cell.b;
    if (!b || b.type !== 'furnace') return;
    if (b.out.length && emitFrom(x, y, b.out[0])) b.out.shift();
    if (!b.smelting && b.inN > 0) {
      b.smelting = b.inType;
      b.inN--;
      if (b.inN === 0) b.inType = null;
      b.progress = 0;
    }
    if (b.smelting) {
      b.progress++;
      const rec = FURNACE_RECIPES[b.smelting];
      if (b.progress >= rec.time && b.out.length < BELT_CAPACITY) {
        b.out.push(rec.out);
        b.smelting = null;
        b.progress = 0;
      }
    }
  });

  // 3. Assemblers: same pattern, but with multi-ingredient recipes.
  forEachCell((x, y, cell) => {
    const b = cell.b;
    if (!b || b.type !== 'assembler') return;
    if (b.out.length && emitFrom(x, y, b.out[0])) b.out.shift();
    const rec = ASSEMBLER_RECIPES[b.recipe];
    if (!b.crafting) {
      const ready = Object.keys(rec.in).every(k => (b.inbuf[k] || 0) >= rec.in[k]);
      if (ready) {
        for (const k of Object.keys(rec.in)) b.inbuf[k] -= rec.in[k];
        b.crafting = true;
        b.progress = 0;
      }
    }
    if (b.crafting) {
      b.progress++;
      if (b.progress >= rec.time) {
        const outs = [];
        for (const [item, n] of Object.entries(rec.out))
          for (let i = 0; i < n; i++) outs.push(item);
        if (b.out.length + outs.length <= BELT_CAPACITY) {
          b.out.push(...outs);
          b.crafting = false;
          b.progress = 0;
        }
        // else: output full — hold the finished craft until there is room
      }
    }
  });

  // 4. Belts move their front item forward. Shuffled each tick so no
  //    direction gets a systematic advantage in long chains.
  const belts = [];
  forEachCell((x, y, cell) => { if (cell.b && cell.b.type === 'belt') belts.push([x, y]); });
  shuffle(belts);
  for (const [x, y] of belts) {
    const b = Game.grid[y][x].b;
    if (b.items.length && emitFrom(x, y, b.items[0])) b.items.shift();
  }
}

// Stamp a building object over its whole footprint, anchored at (ax, ay).
// All covered cells reference the same object.
function placeBuildingAt(type, ax, ay, dir = 1) {
  const b = newBuilding(type, dir);
  b.ax = ax; b.ay = ay;
  for (let dy = 0; dy < b.h; dy++)
    for (let dx = 0; dx < b.w; dx++) {
      const cell = cellAt(ax + dx, ay + dy);
      if (cell) { cell.ore = null; cell.b = b; }
    }
  return b;
}

// Remove every cell of a multi-tile building's footprint.
function clearBuilding(b) {
  forEachCell((x, y, cell) => { if (cell.b === b) cell.b = null; });
}

// ---- building placement -----------------------------------------
// Shared rule check used by both the ghost preview and real placement.
function canPlace(tool, x, y) {
  const cell = cellAt(x, y);
  if (!cell) return { ok: false };
  if (tool === 'selector') {
    // Inspect, don't place: a building selects it, empty ground just
    // dismisses the panel (no toast — that's the common case).
    if (cell.b) return { ok: true };
    return { ok: false };
  }
  if (tool === 'rotate') {
    if (cell.b && cell.b.dir !== undefined) return { ok: true };
    return { ok: false, message: 'Nothing to rotate here.' };
  }
  if (tool === 'delete') {
    if (cell.b) return { ok: true };
    return { ok: false, message: 'Nothing to delete here.' };
  }
  if (tool === 'hub') {
    // 2x2 footprint: every covered cell must be free and ore-free
    const fp = footprint('hub');
    for (let dy = 0; dy < fp.h; dy++)
      for (let dx = 0; dx < fp.w; dx++) {
        const c = cellAt(x + dx, y + dy);
        if (!c) return { ok: false, message: 'The hub needs a clear 2×2 area.' };
        if (c.b) return { ok: false, message: 'The hub needs a clear 2×2 area.' };
        if (c.ore) return { ok: false, message: 'The hub needs a clear 2×2 area.' };
      }
    return { ok: true };
  }
  if (cell.b) {
    // Clicking a building with its own tool: rotate it (assembler cycles recipe)
    if (cell.b.type === tool) return { ok: true, reconfigure: true };
    return { ok: false, message: 'Tile is occupied.' };
  }
  if (tool === 'miner') {
    if (!cell.ore) return { ok: false, message: 'Miners must be placed on an ore patch.' };
  } else if (cell.ore) {
    return { ok: false, message: 'Only miners go on ore — belts can run over it though.' };
  }
  return { ok: true };
}

function placeTool(tool, x, y, dir = 1) {
  const cell = cellAt(x, y);
  const check = canPlace(tool, x, y);
  if (!check.ok) return check;
  if (tool === 'rotate') {
    cell.b.dir = (cell.b.dir + 1) % 4; // multi-tile: one shared object, rotates whole building
    return { ok: true };
  }
  if (tool === 'delete') {
    clearBuilding(cell.b); // clears the whole footprint, not just this cell
    return { ok: true };
  }
  if (tool === 'selector') {
    return { ok: true, building: cell.b }; // UI layer decides what to do with it
  }
  if (check.reconfigure) {
    if (tool === 'assembler') cycleRecipe(cell.b);
    else cell.b.dir = (cell.b.dir + 1) % 4;
    return { ok: true };
  }
  if (tool === 'hub') { placeBuildingAt('hub', x, y, dir); return { ok: true }; }
  cell.b = newBuilding(tool, dir);
  return { ok: true };
}

// Set an assembler's recipe directly; buffered ingredients are dropped
// so a half-fed machine can't get stuck on the wrong inputs.
function setRecipe(b, key) {
  if (!ASSEMBLER_RECIPES[key]) return;
  b.recipe = key;
  b.inbuf = {};
  b.crafting = false;
  b.progress = 0;
}

// Switch an assembler to the next recipe (the click-cycle path).
function cycleRecipe(b) {
  const i = ASSEMBLER_RECIPE_ORDER.indexOf(b.recipe);
  setRecipe(b, ASSEMBLER_RECIPE_ORDER[(i + 1) % ASSEMBLER_RECIPE_ORDER.length]);
}
