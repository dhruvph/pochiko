// ===== BEACH WAVES — Subtle horizontal pixel waves =====
// Sparse wave crests flowing along the bottom of the screen.

(() => {
  const bg = document.getElementById('water-bg');
  if (!bg) return;

  const PX = 12; // slightly larger pixels, fewer of them
  const COLS = Math.ceil(window.innerWidth / PX);
  const ROWS = Math.ceil(window.innerHeight / PX);

  // Wave bands — only in bottom half of screen
  const waves = [
    { yFrac: 0.70, amp: 2,  speed: 20, wl: 16, opacity: 0.05, color: 0 },
    { yFrac: 0.80, amp: 3,  speed: 14, wl: 22, opacity: 0.06, color: 1 },
    { yFrac: 0.90, amp: 2,  speed: 25, wl: 12, opacity: 0.04, color: 0 },
  ];

  const frag = document.createDocumentFragment();

  waves.forEach((w, wi) => {
    const band = document.createElement('div');
    band.className = 'wave-band';
    band.style.animationDuration = w.speed + 's';

    const yBase = Math.round(w.yFrac * ROWS);

    for (let x = 0; x < COLS; x++) {
      const yOff = Math.round(w.amp * Math.sin(x / w.wl * Math.PI * 2));
      const y = yBase + yOff;
      if (y < 0 || y >= ROWS) continue;

      // Very sparse: ~25% of positions
      if (((x * 37 + y * 53 + wi * 97) % 4) !== 0) continue;

      const px = document.createElement('div');
      px.className = 'wave-px';
      px.dataset.color = w.color;
      px.style.left = (x * PX) + 'px';
      px.style.top = (y * PX) + 'px';
      px.style.opacity = w.opacity;
      band.appendChild(px);
    }

    frag.appendChild(band);
  });

  bg.appendChild(frag);

  // Very subtle cursor glow
  const glow = document.createElement('div');
  glow.className = 'pond-cursor-glow';
  bg.appendChild(glow);

  let lx = 0, ly = 0;
  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    const v = Math.hypot(e.clientX - lx, e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
    glow.style.opacity = Math.min(0.1 + v * 0.003, 0.2);
  }, { passive: true });
})();
