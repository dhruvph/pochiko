// ===== POND WATER — WebGL Pixel Wave Background =====
// Inspired by arscontexta.org's ASCII shader
// Adapted: pixel blocks instead of ASCII, hippo pond colors

(() => {
  const canvas = document.getElementById('pond-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) return;

  // Vertex shader — full screen quad
  const vertSrc = `
    attribute vec2 a;
    void main() { gl_Position = vec4(a, 0, 1); }
  `;

  // Fragment shader — pixel waves with cursor interaction
  const fragSrc = `
    precision mediump float;
    uniform vec2 u_size;
    uniform float u_time;
    uniform vec2 u_cursor;
    uniform float u_velocity;
    uniform float u_theme; // 0 = dark, 1 = light

    /* Hash function */
    float h21(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }

    void main() {
      float sz = 10.; /* pixel size */
      vec2 cur = vec2(u_cursor.x * u_size.x, (1. - u_cursor.y) * u_size.y);

      vec2 px = gl_FragCoord.xy;
      vec2 cell = floor(px / sz);
      float seed = h21(cell);

      /* cursor repulsion */
      vec2 cellMid = (cell + .5) * sz;
      vec2 away = cellMid - cur;
      float dist = length(away);
      float repel = 1. / (1. + dist * .004);
      px += normalize(away + .01) * repel * (8. + u_velocity * 5.);

      cell = floor(px / sz);
      cellMid = (cell + .5) * sz;
      seed = h21(cell);

      /* sparse: ~15% of cells carry a pixel */
      float active = step(.85, seed);

      /* wave bands — diagonal drift like water surface */
      float phase = dot(cellMid / u_size, vec2(1.8, 2.2)) - u_time * 0.04 + seed * 6.28;
      float wave = sin(phase) * .5 + .5;
      float band = smoothstep(.35, .55, wave) * smoothstep(.95, .65, wave);

      /* density: denser at bottom (like water pooling) */
      float yN = gl_FragCoord.y / u_size.y;
      float base = band * active * (.06 + smoothstep(.4, .0, yN) * .08);

      /* cursor glow */
      float cd = length(cellMid - cur) / u_size.x;
      float glow = exp(-cd * cd * 40.) * (1. + u_velocity * .5);
      float vis = base + glow * (.12 + u_velocity * .06) * (active + .3);

      /* colors — blue/indigo/teal for dark, soft blue for light */
      vec3 ink;
      if (u_theme < .5) {
        /* dark: pond at night */
        ink = vec3(.23, .45, .75) + glow * vec3(.08, .12, .18);
      } else {
        /* light: morning pond */
        ink = vec3(.35, .50, .70) + glow * vec3(.05, .08, .12);
      }

      /* subtle color variation per pixel */
      ink += (seed - .5) * .08;

      /* vignette */
      vec2 sc = gl_FragCoord.xy / u_size - .5;
      float vig = 1. - .4 * dot(sc, sc);
      vis *= vig;

      /* film grain */
      float n = h21(gl_FragCoord.xy + fract(u_time * 13.7)) - .5;
      vec3 col = ink * vis + n * .025;

      gl_FragColor = vec4(col, vis * .7);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = createShader(gl.VERTEX_SHADER, vertSrc);
  const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }

  // Full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);

  const uSize = gl.getUniformLocation(prog, 'u_size');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uCursor = gl.getUniformLocation(prog, 'u_cursor');
  const uVelocity = gl.getUniformLocation(prog, 'u_velocity');
  const uTheme = gl.getUniformLocation(prog, 'u_theme');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  // Resize
  function resize() {
    const w = Math.min(window.innerWidth, 3840);
    const h = Math.min(window.innerHeight, 2160);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl.viewport(0, 0, w, h);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Mouse tracking
  let mx = 0.5, my = 0.5, vel = 0, prevMx = 0.5, prevMy = 0.5;
  function onMove(x, y) {
    const nx = x / window.innerWidth;
    const ny = y / window.innerHeight;
    vel = 600 * Math.hypot(nx - prevMx, ny - prevMy);
    prevMx = mx = nx;
    prevMy = my = ny;
  }
  window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', e => {
    if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // Theme detection
  function getTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'light') return 1;
    if (t === 'dark') return 0;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 1 : 0;
  }

  // Animation loop
  let rafId, startTime = performance.now(), lastFrame = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0.016;
    lastFrame = now;

    // Smooth velocity decay
    const smooth = 1 - Math.exp(-dt / 0.12);
    let dispVel = 0;
    dispVel += (vel - dispVel) * smooth;
    vel *= Math.exp(-dt / 0.14);

    // Throttle to ~30fps for performance
    if (now - lastFrame >= 30) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uSize, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - startTime) / 1000);
      gl.uniform2f(uCursor, mx, my);
      gl.uniform1f(uVelocity, Math.min(dispVel / 40, 1));
      gl.uniform1f(uTheme, getTheme());
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (!reducedMotion) rafId = requestAnimationFrame(frame);
  }

  if (!reducedMotion) rafId = requestAnimationFrame(frame);

  // Pause when hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else if (!reducedMotion) {
      lastFrame = 0;
      rafId = requestAnimationFrame(frame);
    }
  }, { passive: true });
})();
