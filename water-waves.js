// ===== BEACH WAVES — CSS Pixel Wave Background =====
// Horizontal wave bands that flow like water on a beach.
// Sparse, subtle, and organized — not random noise.

(() => {
  const bg = document.getElementById('water-bg');
  if (!bg) return;

  const PX_SIZE = 10;
  const COLS = Math.ceil(window.innerWidth / PX_SIZE);
  const ROWS = Math.ceil(window.innerHeight / PX_SIZE);

  // Wave configuration — each wave is a horizontal band
  const waves = [
    { yStart: 0.55, amplitude: 3, speed: 8,  wavelength: 12, opacity: 0.06, color: 0 },
    { yStart: 0.65, amplitude: 4, speed: 12, wavelength: 18, opacity: 0.08, color: 1 },
    { yStart: 0.75, amplitude: 5, speed: 6,  wavelength: 15, opacity: 0.10, color: 0 },
    { yStart: 0.85, amplitude: 3, speed: 10, wavelength: 10, opacity: 0.07, color: 2 },
  ];

  const frag = document.createDocumentFragment();

  // Create wave band elements (one per wave, animated via CSS)
  waves.forEach((wave, i) => {
    const band = document.createElement('div');
    band.className = 'wave-band';
    band.dataset.wave = i;

    const yBase = Math.floor(wave.yStart * ROWS);

    for (let x = 0; x < COLS; x++) {
      // Sinusoidal Y offset for wave shape
      const yWave = Math.round(wave.amplitude * Math.sin(x / wave.wavelength * Math.PI * 2));

      // Only place pixels near the wave crest (sparse)
      for (let dy = -1; dy <= 1; dy++) {
        const y = yBase + yWave + dy;
        if (y < 0 || y >= ROWS) continue;

        // Sparse: only ~40% of wave positions get a pixel
        if (((x * 7 + y * 13 + i * 31) & 0xff) > 100) continue;

        const px = document.createElement('div');
        px.className = 'wave-px';
        px.dataset.color = wave.color;
        px.style.left = (x * PX_SIZE) + 'px';
        px.style.top = (y * PX_SIZE) + 'px';
        px.style.opacity = wave.opacity;
        band.appendChild(px);
      }
    }

    // Animate the whole band horizontally
    band.style.animationDuration = wave.speed + 's';
    frag.appendChild(band);
  });

  bg.appendChild(frag);

  // Subtle cursor glow
  const cursorGlow = document.createElement('div');
  cursorGlow.className = 'pond-cursor-glow';
  bg.appendChild(cursorGlow);

  let lastX = 0, lastY = 0;
  document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = e.clientX + 'px';
    cursorGlow.style.top = e.clientY + 'px';
    const velocity = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    cursorGlow.style.opacity = Math.min(0.15 + velocity * 0.005, 0.3);
  }, { passive: true });
})();
