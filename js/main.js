// ============================================================
// Cargo Foundry — bootstrap + game loop
// Depends on: config.js, game.js, render.js, ui.js
//
// The loop separates SIMULATION (fixed 10 ticks/sec) from RENDERING
// (every animation frame). That keeps factory speed identical on a
// 60Hz laptop and a 240Hz gaming monitor.
// ============================================================

window.addEventListener('load', () => {
  newWorld();                                   // generate ore, reset orders
  initRender(document.getElementById('game'));  // size the canvas
  initUI();                                     // toolbar, panels, input

  let acc = 0;
  let last = performance.now();
  const step = 1000 / TICKS_PER_SEC;

  function frame(now) {
    acc += now - last;
    last = now;
    // Run as many fixed ticks as elapsed time demands (cap: 5 per frame,
    // so a tab that was backgrounded doesn't spiral trying to catch up).
    let n = 0;
    while (acc >= step && n < 5) { tick(); acc -= step; n++; }
    if (n === 5) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
