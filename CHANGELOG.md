# Changelog

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
