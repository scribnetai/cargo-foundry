# 🏭 Cargo Foundry

A Factorio-style factory browser game. Mine ore, smelt it into plates, assemble parts, and feed finished goods into delivery hubs to fill shipment orders.

**Play it live:** https://cargo-foundry.scribnet.io/

## How to play

1. **Miners** (⛏️) go on the orange/gray **ore patches** and dig ore out of the ground.
2. **Belts** (➡️) carry items. **Scroll** to rotate the ghost before placing, or **click-drag** to lay a whole line of belts facing the drag direction. Right-click rotates anything already placed.
3. **Furnaces** (🔥) smelt ore into plates. **Assemblers** (⚙️) craft parts — click a placed assembler with the assembler tool to switch recipes.
4. Feed finished goods into the green **delivery hub** (📦) to fill the **shipment orders** panel. Fill all 6 orders to win, then keep free-building.

### Controls

| Input | Action |
|---|---|
| Keys `1`–`7` | Select toolbar tool |
| Left click | Place / use selected tool |
| Left click-drag (belt tool) | Lay belts along the drag path, facing the drag direction |
| Mouse wheel | Rotate the held item (scroll down = clockwise, up = counterclockwise) |
| Right click | Rotate building under cursor |
| Click a placed belt/machine with its own tool | Rotate it (assembler switches recipe instead) |
| `Esc` | Close dialogs |
| 🔊 button (top bar) | Toggle the generative factory soundtrack — starts on your first click, grows as your factory grows |

### Recipes

**Furnace:** iron ore → iron plate · copper ore → copper plate

**Assembler:**
- 1 copper plate → 2 copper wire
- 2 iron plates → 1 iron gear
- 1 iron plate + 3 copper wire → 1 circuit

### Shipment orders

1. 15 iron plates
2. 15 copper plates
3. 10 iron gears
4. 24 copper wire
5. 8 circuits
6. 6 circuits + 6 iron gears

## How it works (for the curious)

No build step, no dependencies — plain HTML/CSS/JS that runs anywhere, including right from this repo via GitHub Pages.

| File | What it does |
|---|---|
| `index.html` | Page shell: top bar, toolbar, canvas, side panels, dialogs |
| `styles.css` | Dark industrial theme |
| `js/config.js` | All tunable game data: grid size, items, recipes, orders, toolbar |
| `js/game.js` | Game state, ore-patch generation, placement rules, and the simulation tick (miners → furnaces → assemblers → belts). DOM-free, so the logic can be unit-tested with plain Node. |
| `js/render.js` | Canvas drawing: tiles, ore, buildings, items on belts, progress bars, ghost preview |
| `js/ui.js` | Toolbar, orders panel, recipes reference, toasts, modals, mouse/keyboard input |
| `js/main.js` | Bootstrap + game loop: fixed 10 ticks/sec simulation, render every animation frame |

**Run it locally:** open `index.html` in a browser, or `python3 -m http.server` in this folder and visit `http://localhost:8000`.

**Deploy:** pushing to `main` redeploys the GitHub Pages site automatically.
