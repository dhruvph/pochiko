// ===== WAVE LINES — flowing sinusoidal dot trails =====
// A few thin wave lines made of small dots, drifting horizontally.
// Think: gentle ripples on a still pond.

(() => {
  const bg = document.getElementById('water-bg');
  if (!bg) return;

  const PX = 8;
  const COLS = Math.ceil(window.innerWidth / PX);

  // Each wave is a thin sinusoidal line of dots
  const waveLines = [
    { yFrac: 0.50, amp: 6,  speed: 25, wl: 30, spacing: 3, opacity: 0.18, color: 0 },
    { yFrac: 0.62, amp: 8,  speed: 18, wl: 24, spacing: 3, opacity: 0.14, color: 1 },
    { yFrac: 0.74, amp: 5,  speed: 30, wl: 35, spacing: 4, opacity: 0.12, color: 0 },
    { yFrac: 0.85, amp: 7,  speed: 22, wl: 20, spacing: 3, opacity: 0.16, color: 2 },
  ];

  const frag = document.createDocumentFragment();

  waveLines.forEach((w) => {
    const band = document.createElement('div');
    band.className = 'wave-band';
    band.style.animationDuration = w.speed + 's';

    const yBase = Math.round(w.yFrac * window.innerHeight / PX);

    for (let x = 0; x < COLS; x += w.spacing) {
      const yOff = Math.round(w.amp * Math.sin(x / w.wl * Math.PI * 2));
      const y = yBase + yOff;

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
})();
