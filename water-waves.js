// ===== HALFTONE WAVES — density-based wave pattern =====
// Inspired by halftone printing: uniform dots, varying density.
// Dense clusters = wave crests, sparse = troughs.
// All dots animate together for a flowing effect.

(() => {
  const bg = document.getElementById('water-bg');
  if (!bg) return;

  const PX = 8;
  const COLS = Math.ceil(window.innerWidth / PX);
  const ROWS = Math.ceil(window.innerHeight / PX);

  // Halftone wave params — each wave is a density field
  const waves = [
    { yFrac: 0.78, amp: 4,  speed: 18, wl: 20, baseDensity: 0.08, peakDensity: 0.35, color: 0 },
    { yFrac: 0.86, amp: 3,  speed: 12, wl: 14, baseDensity: 0.06, peakDensity: 0.28, color: 1 },
    { yFrac: 0.93, amp: 2,  speed: 24, wl: 28, baseDensity: 0.04, peakDensity: 0.20, color: 0 },
  ];

  // Seeded random for deterministic placement
  function rng(seed) {
    let s = seed | 0;
    return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0xffffffff; };
  }

  const frag = document.createDocumentFragment();

  waves.forEach((w, wi) => {
    const band = document.createElement('div');
    band.className = 'wave-band';
    band.style.animationDuration = w.speed + 's';

    const yBase = Math.round(w.yFrac * ROWS);
    const rand = rng(wi * 7919 + 104729);

    for (let x = 0; x < COLS; x++) {
      // Wave function: 0 at troughs, 1 at crests
      const waveVal = (Math.sin(x / w.wl * Math.PI * 2) + 1) / 2;

      // Density varies with wave: sparse at troughs, dense at crests
      const density = w.baseDensity + (w.peakDensity - w.baseDensity) * waveVal;

      // Y position follows the wave
      const yOff = Math.round(w.amp * Math.sin(x / w.wl * Math.PI * 2));
      const yCenter = yBase + yOff;

      // Place dots in a small vertical band around the wave center
      for (let dy = -2; dy <= 2; dy++) {
        const y = yCenter + dy;
        if (y < 0 || y >= ROWS) continue;

        // Halftone: probability based on distance from center AND wave density
        const distFactor = 1 - Math.abs(dy) / 3;
        const prob = density * distFactor;

        if (rand() > prob) continue;

        const px = document.createElement('div');
        px.className = 'wave-px';
        px.dataset.color = w.color;
        px.style.left = (x * PX) + 'px';
        px.style.top = (y * PX) + 'px';
        band.appendChild(px);
      }
    }

    frag.appendChild(band);
  });

  bg.appendChild(frag);

  // Subtle cursor glow
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
