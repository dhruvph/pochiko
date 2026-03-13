// ===== POND WATER — CSS Pixel Wave Background =====
// Creates animated pixel blocks that pulse like water surface
// Cursor interaction via CSS custom properties

(() => {
  const bg = document.getElementById('water-bg');
  if (!bg) return;

  const PX_SIZE = 10;
  const COLS = Math.ceil(window.innerWidth / PX_SIZE);
  const ROWS = Math.ceil(window.innerHeight / PX_SIZE);
  const DENSITY = 0.15; // 15% of cells active

  // Pseudo-random based on position
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0xffff) / 0xffff;
  }

  // Create pixel grid
  const frag = document.createDocumentFragment();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const r = hash(x, y);
      if (r > DENSITY) continue;

      const px = document.createElement('div');
      px.className = 'pond-px';

      // Position
      px.style.left = (x * PX_SIZE) + 'px';
      px.style.top = (y * PX_SIZE) + 'px';

      // Wave animation timing (diagonal drift)
      const wave = Math.sin(x * 0.15 + y * 0.2);
      const delay = wave * 3 + hash(x * 7, y * 13) * 4;
      const duration = 4 + hash(x * 3, y * 7) * 3;
      px.style.animationDelay = delay + 's';
      px.style.animationDuration = duration + 's';

      // Color variation
      const colorIdx = Math.floor(r * 4);
      px.dataset.color = colorIdx;

      // Denser at bottom
      const bottomBias = y / ROWS;
      if (hash(x * 17, y * 23) < bottomBias * 0.3) {
        px.style.opacity = '0.6';
      }

      frag.appendChild(px);
    }
  }

  bg.appendChild(frag);

  // Cursor tracking — glow near mouse
  let mouseX = -1000, mouseY = -1000;
  const cursorGlow = document.createElement('div');
  cursorGlow.className = 'pond-cursor-glow';
  bg.appendChild(cursorGlow);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorGlow.style.left = mouseX + 'px';
    cursorGlow.style.top = mouseY + 'px';
  }, { passive: true });

  // Track velocity for glow intensity
  let lastX = 0, lastY = 0, velocity = 0;
  document.addEventListener('mousemove', (e) => {
    velocity = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    cursorGlow.style.opacity = Math.min(0.3 + velocity * 0.01, 0.6);
  }, { passive: true });
})();
