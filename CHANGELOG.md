# Changelog

## 2026-09-29 — Dropped the blue input arrows
- Machines no longer show blue IN chevrons — just the single green OUT chevron. Ingredients feed in from any side except the output side, so the three blue markers per machine were pure noise. The delivery hub keeps its cyan input ring (it's input-only — that's its whole identity). Help text and toolbar descriptions updated to match. Touched: js/render.js, js/config.js, index.html (cache-busters bumped).
## 2026-09-29 — Delivery hub is 2×1, multi-tile render fix
- **Delivery hub is now 2×1** (was 2×2): a single shipping crate — wood-grain gradient, lid band, "CARGO" stencil, corner brackets, drop-in badge, IN chevrons on all four outer edges. Placement, ghost, hover highlight, and toasts all follow the new footprint automatically.
- **Fixed: only part of the hub rendered.** The render loop painted tiles and buildings in one pass, so the ground tiles of the hub's later cells were drawn *over* most of the hub art — only the anchor cell's quarter showed. The loop is now two passes (all terrain, then all buildings), so multi-tile art always paints on top. Also hardened the anchor-cell skip to cover any wide-or-tall building. Touched: js/config.js, js/game.js, js/render.js, index.html (cache-busters bumped).
## 2026-09-29 — Selector tool + assembler recipe picker
- New **Selector** tool (👆, hotkey 8): click any building to inspect it — hovering outlines it in green, clicking shows what it's doing (miner ore type, furnace smelt state, hub hint). Clicking an **assembler** opens a floating recipe picker next to the cursor with all three recipes, ingredient lists, and craft times; picking one switches the recipe immediately (buffers clear, same as the old click-cycle). The old click-with-assembler-tool cycle still works. Touched: js/config.js, js/game.js (new `setRecipe()`, `cycleRecipe` now routes through it), js/render.js (selector hover outline), js/ui.js, index.html, styles.css (cache-busters bumped).
## 2026-09-29 — Furnace & assembler polish pass
- **Furnace is a proper kiln now:** arched firebox door with a riveted frame, animated flame tongues over a flickering heat glow, smoke puffs drifting from the chimney while smelting, and dark coals when idle. A status light (green = burning, amber = idle) sits top-left; the waiting plate moved to a clear spot top-right.
- **Assembler is a precision machine:** the work pad has corner screws, a dashed servo ring that spins while crafting, and the progress arc now fills that same ring so progress reads as the ring completing. Status light: green pulse = crafting, amber = waiting for inputs.
- Both use the same status-light language; miner keeps its drill (already the favorite). Touched: js/render.js (cache-buster bumped to v=6).
## 2026-09-29 — Visual art pass: defined belts, machines, and item icons
- **Belts are real conveyors now:** dark track bed with a center stripe, raised side rails with highlight edges, scrolling flow chevrons that show direction and motion, and metal end rollers where a belt line terminates (segments in a line merge visually — no roller between them).
- **Items are shape-coded, not just colored squares:** rocky nuggets (ore), flat ingot bars (plates), copper coil rings (wire), toothed gears with hub holes (gears), and pin-out chips (circuits) — each with a dark outline and highlight so they read as physical objects on the belt.
- **Machines share a proper chassis:** drop shadow, beveled shell, gradient inner panel, and corner rivets. Miner has a spinning 3-blade drill with a static tooth ring and an ore-tint ring showing what it's digging; furnace has a recessed firebox with animated heat glow, rising embers, and a capped chimney; assembler shows the actual recipe product icon on a recessed work pad with a progress ring.
- **Ports pop:** every port chevron now sits on a dark backing tab so the green OUT / cyan IN indicators read clearly on any machine body color.
- **Ore patches look rocky:** dark-rimmed nuggets with highlight dots instead of flat speckles; ground tiles have a faint grain so empty space isn't perfectly flat.
- **Hub polish:** wood-grain gradient body, lid band, and a "CARGO" stencil label on the 2×2 shipping crate.
- Verified with a headless Node render harness (full render loop + every draw path + ghost previews, all passing). Touched: js/render.js (cache-buster bumped to v=5), index.html.
## 2026-09-29 — Full SEO head tags

- Added canonical URL, meta description, Open Graph + Twitter Card tags, and JSON-LD structured data (`WebApplication`) to the page head.
## 2026-09-29 — Prompts page added to the app-switcher header

- The scribnet.io `/prompts.html` workflow-prompts page is now one click away from the app-switcher dropdown in the header, alongside the other destinations.
## 2026-09-29 — Mobile load fix: guard first-visit localStorage
- **Bug:** `bindButtons()` read `localStorage` unguarded for the first-visit help flag. On phones/tablets where storage is blocked (e.g. Safari "Block all cookies", locked-down webviews) that access throws, aborting `initUI()` before the game loop starts — the page looked frozen / "not loaded" (static UI shell, blank canvas, dead timer). Now guarded with try/catch; a storage failure can no longer block startup. Touched: js/ui.js (cache-buster bumped to v=5).
- Known mobile limitation (not fixed here): the layout is desktop-first — on a ~390px phone the page is a ~1500px horizontally scrolling strip, and canvas input is mouse-events only (no touch drag/pinch). Full mobile support (responsive layout + touch controls) is a separate build.

## 2026-09-28 — Zoom, R-to-rotate, volume slider, port indicators, 2×2 hub
- **Zoom:** the scroll wheel now zooms the map (0.5×–3×) anchored at the cursor; camera clamps so the map never scrolls off-canvas. Hit-testing is zoom-aware so placement always matches the rendered grid.
- **R rotates:** the scroll wheel's old job (rotating the held item) moved to the **R** key — ghost included. R is ignored while typing in the feedback form.
- **Volume slider:** new range slider in the top bar next to the mute button, bound to the Web Audio master gain; volume persists in localStorage (`cargo-foundry-volume`) independent of mute. The music itself is unchanged.
- **Port indicators:** every machine now shows a bright green chevron on its output edge jutting into the neighbor tile, and cyan input chevrons on the input edges (miners: output only; furnaces/assemblers: inputs on the other three edges). Replaces the miner's tiny direction tick.
- **Delivery hub is now a 2×2 shipping crate:** one building object over 4 cells (rotate/delete work from any cell, whole footprint clears on delete); drawn as a big wooden crate with plank seams, corner brackets, a drop-in arrow badge, and cyan input chevrons on all four outer edges ("feed from any side"). Toolbar placement previews the full 2×2 footprint and rejects partial overlaps. Touched: index.html, styles.css, js/config.js, js/game.js, js/render.js, js/ui.js, js/music.js (cache-busters bumped to v=4).

## 2026-09-28 — Canonical subdomain links
- Replaced legacy `scribnetai.github.io/<repo>/` links with canonical
  `https://<repo>.scribnet.io/` URLs (the old URLs 301-redirect, but docs and
  on-page links should point at the real address).

## 2026-09-28
- Added Umami website analytics (cookieless, no consent banner): pageview tracking plus custom events for ad-slot impression/click reporting.

## 2026-09-28
- Added a floating Feedback button (bottom-right) that opens a dialog to send feedback via email — topic chips, optional name, and message, addressed to the site owner with the app name in the subject.

## 2026-09-28
- TLS certificate provisioned for the `cargo-foundry.scribnet.io` custom domain (GitHub's stuck DNS check was reset 2026-09-28); HTTPS is now enforced on the site. App-switcher menu links switched from legacy `scribnetai.github.io` URLs to direct `https://<app>.scribnet.io` URLs for all 10 apps (footer/launcher links updated likewise). This entry also covers the net-zero CNAME delete/re-add commits from the DNS-check reset, which carried no changelog entries. Touched: index.html, js/app-switcher.js.


## 2026-09-27
- Added a favicon (inline SVG monogram badge, matching the other apps) so browser bookmarks and tabs show the app logo instead of a generic globe.

## 2026-09-29 — Prompts removed from app-switcher dropdown

- Removed the Prompts entry from the in-app dropdown menu so it lists only the SE-job apps (plus the scribnet.io home link). The prompts page itself is untouched.

