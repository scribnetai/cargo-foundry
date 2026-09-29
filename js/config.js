// ============================================================
// Cargo Foundry — configuration
// Everything tunable about the game lives here: grid size, items,
// machine recipes, shipment orders, and the toolbar.
// ============================================================

// Grid: 42 x 28 tiles, each 24px -> 1008 x 672 canvas
const TILE = 24;
const COLS = 42;
const ROWS = 28;

// Simulation speed: logic ticks per second (rendering is separate)
const TICKS_PER_SEC = 10;

// How many items fit in a belt segment / machine output queue
const BELT_CAPACITY = 4;
// How many of one ingredient a machine input buffer holds
const MACHINE_INPUT_CAP = 6;
// Ticks a miner needs to dig up one ore
const MINER_RATE = 20;

// Directions: 0 = up, 1 = right, 2 = down, 3 = left
const DIRS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

// Every item in the game: display name + the color used on belts/machines
const ITEMS = {
  'iron-ore':     { name: 'Iron ore',    color: '#9aa3b2' },
  'copper-ore':   { name: 'Copper ore',  color: '#d08a4e' },
  'iron-plate':   { name: 'Iron plate',  color: '#d5dbe7' },
  'copper-plate': { name: 'Copper plate', color: '#f0a35e' },
  'copper-wire':  { name: 'Copper wire', color: '#ffd166' },
  'iron-gear':    { name: 'Iron gear',   color: '#8fd0ff' },
  'circuit':      { name: 'Circuit',     color: '#4ade80' },
};

// Furnace: ore in -> plate out. Keyed by input item.
const FURNACE_RECIPES = {
  'iron-ore':   { out: 'iron-plate',   time: 30 },
  'copper-ore': { out: 'copper-plate', time: 30 },
};

// Assembler recipes. `in` maps item -> count consumed per craft,
// `out` maps item -> count produced, `time` is ticks per craft.
const ASSEMBLER_RECIPES = {
  wire:    { name: 'Copper wire', in: { 'copper-plate': 1 },                          out: { 'copper-wire': 2 }, time: 20 },
  gear:    { name: 'Iron gear',   in: { 'iron-plate': 2 },                            out: { 'iron-gear': 1 },   time: 25 },
  circuit: { name: 'Circuit',     in: { 'iron-plate': 1, 'copper-wire': 3 },          out: { 'circuit': 1 },    time: 40 },
};
// Order recipes cycle through in this sequence when you click an assembler
const ASSEMBLER_RECIPE_ORDER = ['wire', 'gear', 'circuit'];

// Shipment orders, in sequence. Each order is a list of { item, need }.
// Feed matching items into a delivery hub to fill them.
const ORDERS = [
  { wants: [ { item: 'iron-plate', need: 15 } ] },
  { wants: [ { item: 'copper-plate', need: 15 } ] },
  { wants: [ { item: 'iron-gear', need: 10 } ] },
  { wants: [ { item: 'copper-wire', need: 24 } ] },
  { wants: [ { item: 'circuit', need: 8 } ] },
  { wants: [ { item: 'circuit', need: 6 }, { item: 'iron-gear', need: 6 } ] },
];

// Toolbar tools: id, label, hotkey, icon, and the one-line helper text
const TOOLS = [
  { id: 'belt',      name: 'Belt',         hotkey: '1', glyph: '➡️', desc: 'Carries items in the direction it faces. Scroll to zoom the map; press R to rotate the ghost; click-drag to lay a belt line. Click a placed belt to rotate it.' },
  { id: 'miner',     name: 'Miner',        hotkey: '2', glyph: '⛏️', desc: 'Digs ore out of the ground. Must be placed on an ore patch. Ore comes OUT of the green port.' },
  { id: 'furnace',   name: 'Furnace',      hotkey: '3', glyph: '🔥', desc: 'Smelts ore into plates: iron ore → iron plate, copper ore → copper plate. Ore goes IN the blue ports, plates come OUT of the green port.' },
  { id: 'assembler', name: 'Assembler',    hotkey: '4', glyph: '⚙️', desc: 'Crafts parts. Ingredients go IN the blue ports, parts come OUT of the green port. Click a placed assembler to switch its recipe.' },
  { id: 'hub',       name: 'Delivery hub', hotkey: '5', glyph: '📦', desc: 'A 2×2 shipping crate. Feed items in from ANY side to fill the current shipment order.' },
  { id: 'rotate',    name: 'Rotate',       hotkey: '6', glyph: '🔄', desc: 'Turns a building clockwise.' },
  { id: 'delete',    name: 'Delete',       hotkey: '7', glyph: '❌', desc: 'Removes a building. Ore patches stay.' },
];
