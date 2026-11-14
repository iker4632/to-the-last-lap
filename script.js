/* Misión The Last Lap — animaciones (no a escala real) */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TAU = Math.PI * 2;
  const DAY = 864e5;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Idioma: 'es' (por defecto) o 'en'. L(es, en) devuelve el texto en el idioma activo.
  let LANG = 'es';
  try { if (localStorage.getItem('lang') === 'en') LANG = 'en'; } catch (e) { /* sin almacenamiento */ }
  const L = (es, en) => (LANG === 'en' ? en : es);
  const onLang = []; // funciones que refrescan textos generados por JS al cambiar de idioma

  // Periodos (días) y la oposición de Marte del 19 de febrero de 2027
  const P_EARTH = 365.256, P_MARS = 686.98, P_MOON = 27.32;
  const OPP_2027 = Date.UTC(2027, 1, 19);
  const SYNODIC = 1 / (1 / P_EARTH - 1 / P_MARS); // ~780 días ≈ 26 meses

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const mix = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const polar = (r, a) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });
  const fmtDate = (t, opts) => new Date(t).toLocaleDateString(L('es-ES', 'en-GB'), { timeZone: 'UTC', ...opts });
  const longDate = (t) => fmtDate(t, { day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = (t) => fmtDate(t, { day: 'numeric', month: 'short', year: 'numeric' });
  const monthYear = (t) => fmtDate(t, { month: 'long', year: 'numeric' });
  const num = (x, d = 0) => x.toLocaleString(L('es-ES', 'en-GB'), { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- utilidades de canvas ---------- */
  function makeCanvas(canvas, onResize) {
    const S = { ctx: canvas.getContext('2d'), w: 1, h: 1, ready: false };
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.w = r.width; S.h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (onResize && S.ready) onResize();
    };
    fit();
    S.ready = true;
    new ResizeObserver(fit).observe(canvas);
    return S;
  }

  // Ejecuta fn(dt) en cada frame solo mientras el elemento está en pantalla
  function runWhenVisible(el, fn) {
    let visible = false, raf = 0, last = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      fn(dt);
      if (visible) raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }).observe(el);
  }

  const COLORS = {
    earth: ['#bfe3ff', '#1d5fbf'],
    mars: ['#ffb894', '#b33c18'],
    moon: ['#f4f6fa', '#7d8597'],
  };

  function drawSun(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
    g.addColorStop(0, 'rgba(255,245,210,1)');
    g.addColorStop(0.24, 'rgba(255,205,95,1)');
    g.addColorStop(0.32, 'rgba(255,170,60,0.45)');
    g.addColorStop(1, 'rgba(255,130,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, TAU); ctx.fill();
  }

  function drawBody(ctx, x, y, r, [light, dark], sun) {
    let hx = x - r * 0.35, hy = y - r * 0.35;
    if (sun) {
      const a = Math.atan2(sun.y - y, sun.x - x);
      hx = x + Math.cos(a) * r * 0.45; hy = y + Math.sin(a) * r * 0.45;
    }
    const g = ctx.createRadialGradient(hx, hy, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function drawGlow(ctx, x, y, r, rgb, a = 0.35) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function drawOrbit(ctx, x, y, r, color = 'rgba(170,185,225,0.22)', dash = [3, 6]) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function label(ctx, text, x, y, { color = '#d6dcec', align = 'left', size = 12, weight = 600 } = {}) {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,7,15,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // Cohete apuntando hacia +x, centrado en (0,0). `thrust` enciende la llama grande.
  function drawRocket(ctx, thrust, s = 1, opts = {}) {
    ctx.save();
    ctx.scale(s, s);
    if (opts.dish) {
      // Antena parabólica en el costado (lado -y): se orienta hacia la Tierra para enviar datos
      ctx.strokeStyle = '#aab3c8'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-1, -3.4); ctx.lineTo(-1, -6.5); ctx.stroke();
      ctx.fillStyle = '#eef1f7';
      ctx.beginPath(); ctx.moveTo(-6, -10); ctx.quadraticCurveTo(-1, -4.5, 4, -10); ctx.closePath(); ctx.fill();
    }
    // Llama (siempre una pequeña; grande al acelerar o frenar)
    const fl = thrust ? 10 + Math.random() * 7 : 3 + Math.random() * 2;
    const g = ctx.createLinearGradient(-9, 0, -9 - fl, 0);
    g.addColorStop(0, 'rgba(255,240,180,1)');
    g.addColorStop(0.4, 'rgba(255,160,60,0.9)');
    g.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-8, -2.6); ctx.quadraticCurveTo(-9 - fl * 0.6, -2, -9 - fl, 0);
    ctx.quadraticCurveTo(-9 - fl * 0.6, 2, -8, 2.6); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 8;
    // Aletas
    ctx.fillStyle = '#e5482a';
    ctx.beginPath(); ctx.moveTo(-3, -3.2); ctx.lineTo(-9, -7); ctx.lineTo(-9, -3); ctx.lineTo(-7, -3.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, 3.2); ctx.lineTo(-9, 7); ctx.lineTo(-9, 3); ctx.lineTo(-7, 3.2); ctx.closePath(); ctx.fill();
    // Cuerpo
    const b = ctx.createLinearGradient(0, -3.6, 0, 3.6);
    b.addColorStop(0, '#ffffff'); b.addColorStop(1, '#b9c2d6');
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(-8, -3.2); ctx.lineTo(5, -3.6);
    ctx.quadraticCurveTo(11, -2.6, 13, 0);
    ctx.quadraticCurveTo(11, 2.6, 5, 3.6);
    ctx.lineTo(-8, 3.2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Punta roja
    ctx.fillStyle = '#ff6a3d';
    ctx.beginPath(); ctx.moveTo(8.2, -3); ctx.quadraticCurveTo(11.5, -2, 13, 0);
    ctx.quadraticCurveTo(11.5, 2, 8.2, 3); ctx.closePath(); ctx.fill();
    // Ventanilla
    ctx.fillStyle = '#4ea3ff';
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(2.5, 0, 1.8, 0, TAU); ctx.fill(); ctx.stroke();
    if (opts.lens) {
      // Cámara/telescopio en la punta
      ctx.fillStyle = '#7fd8ff'; ctx.strokeStyle = '#1b2233'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(13.4, 0, 1.6, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // Fotos reales de la Tierra (Apollo 17) y la Luna (LRO), con sombra según el Sol
  function photo(src) { const im = new Image(); im.src = src; return im; }
  const earthImg = photo('img/tierra-apollo17.jpg');
  const moonImg = photo('img/luna-lro.jpg');
  function drawPhotoBody(ctx, img, zoom, x, y, r, colors, sun, night = 0.8) {
    if (!img.complete || !img.naturalWidth || r < 1.5) return drawBody(ctx, x, y, r, colors, sun);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const s = r * 2 * zoom;
    ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    if (img === moonImg) { // la foto de la Luna es oscura: la aclaramos un poco
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(205,210,220,0.45)'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      ctx.globalCompositeOperation = 'source-over';
    }
    const sv = sun || { x: x - r, y: y - r };
    const a = Math.atan2(sv.y - y, sv.x - x);
    const g = ctx.createLinearGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, x - Math.cos(a) * r, y - Math.sin(a) * r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.08)'); g.addColorStop(1, `rgba(0,0,0,${night})`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  }
  const drawEarth = (ctx, x, y, r, sun) => drawPhotoBody(ctx, earthImg, 1.125, x, y, r, COLORS.earth, sun, 0.75);
  const drawMoon = (ctx, x, y, r, sun) => drawPhotoBody(ctx, moonImg, 1.02, x, y, r, COLORS.moon, sun, 0.6);

  // Foto de Marte (Hubble) para dibujar el planeta cuando está ampliado
  const marsImg = new Image();
  marsImg.src = 'img/marte-hubble-2003.jpg';
  function drawMarsPhoto(ctx, x, y, r, sun) {
    if (!marsImg.complete || !marsImg.naturalWidth) return drawBody(ctx, x, y, r, COLORS.mars, sun);
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const s = r * 2 * 1.15;
    ctx.drawImage(marsImg, x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = 'rgba(230,50,20,0.22)'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    const a = Math.atan2(sun.y - y, sun.x - x);
    const g = ctx.createLinearGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, x - Math.cos(a) * r, y - Math.sin(a) * r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  }

  /* ---------- fondo de estrellas ---------- */
  (function stars() {
    const c = $('#stars');
    const ctx = c.getContext('2d');
    let lastW = 0, lastH = 0;
    function draw() {
      const w = window.innerWidth, h = window.innerHeight;
      if (w === lastW && h <= lastH) return;
      lastW = w; lastH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const n = Math.round((w * h) / 1700);
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h;
        const r = rnd() < 0.93 ? rnd() * 0.8 + 0.25 : rnd() * 1.3 + 0.8;
        const tint = rnd();
        ctx.globalAlpha = 0.2 + rnd() * 0.75;
        ctx.fillStyle = tint < 0.08 ? '#ffd9b0' : tint < 0.2 ? '#bcd6ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    draw();
    let to;
    window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(draw, 150); });
  })();

  /* ---------- 1. Sistema solar interior + oposición ---------- */
  (function solarSystem() {
    const canvas = $('#solar');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());
    const btnPlay = $('#solar-play'), range = $('#solar-speed'), speedOut = $('#solar-speed-out');
    const dateOut = $('#solar-date'), nextOut = $('#solar-next'), btnOpp = $('#solar-opp'), status = $('#solar-status');
    const ROT = 0.55; // gira el dibujo para que la oposición quede arriba a la derecha

    let t = Math.floor(Date.now() / DAY) * DAY;
    let speed = Number(range.value);
    let playing = !reduceMotion;
    let target = null;
    let lastDay = null;

    const anglesAt = (tt) => {
      const d = (tt - OPP_2027) / DAY;
      return { e: TAU * d / P_EARTH + ROT, m: TAU * d / P_MARS + ROT, l: TAU * d / P_MOON };
    };
    const synodicPhase = (tt) => {
      const d = (tt - OPP_2027) / DAY;
      let f = (d / SYNODIC) % 1;
      if (f < 0) f += 1;
      return f;
    };
    const daysToNextOpp = (tt) => {
      const f = synodicPhase(tt);
      return f < 1e-6 ? SYNODIC : (1 - f) * SYNODIC;
    };

    function updatePlay() {
      btnPlay.textContent = playing ? L('⏸ Pausa', '⏸ Pause') : L('▶ Reproducir', '▶ Play');
      btnPlay.setAttribute('aria-pressed', String(playing));
    }

    function draw() {
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      const m = Math.min(w, h);
      const cx = w / 2, cy = h / 2;
      const rE = m * 0.29, rM = rE * 1.524, rL = m * 0.06;
      const a = anglesAt(t);
      const sun = { x: cx, y: cy };
      const E = { x: cx + rE * Math.cos(a.e), y: cy - rE * Math.sin(a.e) };
      const M = { x: cx + rM * Math.cos(a.m), y: cy - rM * Math.sin(a.m) };
      const Lm = { x: E.x + rL * Math.cos(a.l), y: E.y - rL * Math.sin(a.l) };

      drawOrbit(ctx, cx, cy, rE, 'rgba(78,163,255,0.28)');
      drawOrbit(ctx, cx, cy, rM, 'rgba(255,122,69,0.28)');
      drawOrbit(ctx, E.x, E.y, rL, 'rgba(210,215,230,0.18)', [2, 4]);

      // ¿Estamos cerca de la oposición?
      const f = synodicPhase(t);
      const near = Math.min(f, 1 - f) * SYNODIC; // días a la oposición más cercana
      if (near < 12) {
        const k = 1 - near / 12;
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.7 * k;
        ctx.strokeStyle = '#ff7a45'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(M.x + (M.x - cx) * 0.08, M.y + (M.y - cy) * 0.08); ctx.stroke();
        ctx.restore();
        drawGlow(ctx, M.x, M.y, m * 0.08, '255,106,61', 0.45 * k);
      }

      drawSun(ctx, cx, cy, m * 0.032);
      drawGlow(ctx, E.x, E.y, m * 0.06, '78,163,255', 0.25);
      drawEarth(ctx, E.x, E.y, Math.max(5, m * 0.021), sun);
      drawMoon(ctx, Lm.x, Lm.y, Math.max(2.2, m * 0.008), sun);
      drawBody(ctx, M.x, M.y, Math.max(4, m * 0.016), COLORS.mars, sun);

      const fs = m < 380 ? 11 : 12;
      label(ctx, L('Sol', 'Sun'), cx, cy + m * 0.07, { align: 'center', color: '#ffe2a0', size: fs });
      label(ctx, L('Tierra', 'Earth'), E.x + m * 0.035, E.y + m * 0.035, { size: fs, color: '#cfe5ff' });
      if (near >= 12) label(ctx, L('Luna', 'Moon'), Lm.x + 6, Lm.y - 8, { size: fs - 1, color: '#c9cfdc', weight: 500 });
      label(ctx, L('Marte', 'Mars'), M.x + m * 0.03, M.y + m * 0.03, { size: fs, color: '#ffc2a6' });
      if (near < 12) label(ctx, L('¡Oposición!', 'Opposition!'), M.x, M.y - m * 0.06, { align: 'center', color: '#ffb48f', size: fs + 2, weight: 700 });

      const day = Math.floor(t / DAY);
      if (day !== lastDay) {
        lastDay = day;
        dateOut.textContent = longDate(t);
        const dn = daysToNextOpp(t);
        nextOut.textContent = near < 1 ? L('¡Ahora!', 'Now!') : `${num(Math.round(dn))} ${L('días', 'days')} (${monthYear(t + dn * DAY)})`;
      }
    }

    function jumpToOpposition() {
      target = t + daysToNextOpp(t) * DAY;
      status.textContent = L(`Avanzando hasta la oposición de ${monthYear(target)}…`, `Fast-forwarding to the ${monthYear(target)} opposition…`);
      status.classList.remove('hl');
    }

    runWhenVisible(canvas, (dt) => {
      if (target !== null) {
        const remaining = (target - t) / DAY;
        const step = Math.min(remaining, Math.max(45 * dt, remaining * 2.2 * dt));
        t += step * DAY;
        if (remaining - step <= 0.01) {
          t = target; target = null; playing = false; updatePlay();
          status.textContent = L('Sol, Tierra y Marte alineados: es la oposición. Marte está lo más cerca posible en esta vuelta.', 'Sun, Earth and Mars lined up: this is opposition. Mars is as close as it gets on this lap.');
          status.classList.add('hl');
        }
      } else if (playing) {
        t += speed * dt * DAY;
      }
      draw();
    });

    btnPlay.addEventListener('click', () => {
      playing = !playing; target = null; updatePlay();
      if (playing) { status.textContent = ''; status.classList.remove('hl'); }
    });
    range.addEventListener('input', () => {
      speed = Number(range.value);
      speedOut.textContent = `${speed} ${L('días/s', 'days/s')}`;
    });
    btnOpp.addEventListener('click', jumpToOpposition);
    const goto = $('#goto-opp');
    if (goto) goto.addEventListener('click', () => {
      $('#solar-wrap').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      setTimeout(jumpToOpposition, reduceMotion ? 0 : 700);
    });

    const refreshLang = () => {
      lastDay = null; updatePlay();
      speedOut.textContent = `${speed} ${L('días/s', 'days/s')}`;
      if (target === null) { status.textContent = ''; status.classList.remove('hl'); }
      draw();
    };
    onLang.push(refreshLang);
    refreshLang();
  })();

  /* ---------- 3. Efecto honda ---------- */
  (function slingshot() {
    const canvas = $('#sling');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());
    const speedOut = $('#sling-speed'), meter = $('#sling-meter');
    const VW = 640, VH = 400;
    const GM = 800000;           // "gravedad" de la Luna (unidades del dibujo)
    const VM = { x: 70, y: 0 };  // la Luna avanza hacia la derecha
    const DUR = 7.5, HOLD = 2.2;
    let st;

    function reset() {
      const moon = { x: 90, y: 215 };
      const d = { x: -0.64, y: -0.77 };   // dirección de la nave vista desde la Luna
      const n = { x: -0.77, y: 0.64 };    // pasa por detrás (lado izquierdo) de la Luna
      const b = 95, vrel = 100, tc = 3;
      const ship = { x: moon.x + n.x * b - d.x * vrel * tc, y: moon.y + n.y * b - d.y * vrel * tc };
      const v = { x: d.x * vrel + VM.x, y: d.y * vrel + VM.y };
      st = { t: 0, hold: 0, moon, ship, v, trail: [{ ...ship }], start: { ...ship }, v0: Math.hypot(v.x, v.y), vStart: { ...v } };
    }

    function step(dt) {
      const h = 1 / 240;
      let left = dt;
      while (left > 1e-6) {
        const k = Math.min(h, left); left -= k;
        st.moon.x += VM.x * k;
        const rx = st.moon.x - st.ship.x, ry = st.moon.y - st.ship.y;
        const r = Math.max(22, Math.hypot(rx, ry));
        const a = GM / (r * r * r);
        st.v.x += a * rx * k; st.v.y += a * ry * k;
        st.ship.x += st.v.x * k; st.ship.y += st.v.y * k;
      }
      st.t += dt;
      const last = st.trail[st.trail.length - 1];
      if (Math.hypot(st.ship.x - last.x, st.ship.y - last.y) > 3) st.trail.push({ ...st.ship });
    }

    function arrow(ctx, x, y, vx, vy, color) {
      const len = Math.hypot(vx, vy);
      if (len < 1) return;
      const ux = vx / len, uy = vy / len;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx, y + vy); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + vx + ux * 6, y + vy + uy * 6);
      ctx.lineTo(x + vx - uy * 5, y + vy + ux * 5);
      ctx.lineTo(x + vx + uy * 5, y + vy - ux * 5);
      ctx.closePath(); ctx.fill();
    }

    function draw() {
      if (!st) return;
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      const sc = Math.min(w / VW, h / VH);
      ctx.save();
      ctx.translate((w - VW * sc) / 2, (h - VH * sc) / 2);
      ctx.scale(sc, sc);

      // Trayectoria de la Luna
      ctx.save();
      ctx.strokeStyle = 'rgba(210,215,230,0.18)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 215); ctx.lineTo(VW, 215); ctx.stroke();
      ctx.restore();
      label(ctx, L('La Luna avanza a ~1 km/s →', 'The Moon moves at ~1 km/s →'), 16, 238, { color: '#aab3c8', size: 12, weight: 500 });

      // Camino "sin Luna"
      ctx.save();
      ctx.strokeStyle = 'rgba(200,210,230,0.45)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(st.start.x, st.start.y);
      ctx.lineTo(st.start.x + st.vStart.x * 8, st.start.y + st.vStart.y * 8); ctx.stroke();
      ctx.restore();

      // Estela de la nave
      ctx.save();
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#ff7a45';
      ctx.shadowColor = 'rgba(255,122,69,0.7)'; ctx.shadowBlur = 8;
      ctx.beginPath();
      st.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineTo(st.ship.x, st.ship.y);
      ctx.stroke();
      ctx.restore();

      // Luna
      drawGlow(ctx, st.moon.x, st.moon.y, 80, '200,210,235', 0.12);
      drawMoon(ctx, st.moon.x, st.moon.y, 20);
      label(ctx, L('Luna', 'Moon'), st.moon.x, st.moon.y + 34, { align: 'center', size: 12 });

      // Nave + vector velocidad
      const { x, y } = st.ship;
      arrow(ctx, x, y, st.v.x * 0.35, st.v.y * 0.35, '#6be3b5');
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
      drawGlow(ctx, x, y, 16, '255,180,140', 0.5);

      const speed = Math.hypot(st.v.x, st.v.y);
      const gain = speed / st.v0;
      if (gain > 1.25) label(ctx, L('¡Impulso!', 'Boost!'), x + 14, y + 18, { color: '#6be3b5', size: 13, weight: 700 });
      ctx.restore();

      speedOut.textContent = `${num(Math.round(gain * 100))} %`;
      meter.style.width = `${clamp(gain / 2.2, 0, 1) * 100}%`;
    }

    reset();
    let running = !reduceMotion;
    runWhenVisible(canvas, (dt) => {
      if (running) {
        if (st.t < DUR) step(dt);
        else {
          st.hold += dt;
          if (st.hold > HOLD) reset();
        }
      }
      draw();
    });
    $('#sling-replay').addEventListener('click', () => { reset(); running = true; });
  })();

  /* ---------- Misión paso a paso ---------- */
  (function mission() {
    const canvas = $('#mission');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());

    const LAUNCH = OPP_2027 - 88 * DAY; // finales de noviembre de 2026
    const D_OPP = 88;                    // día de misión de la oposición
    const T_ARR = 275;                   // día de llegada (~9 meses)
    // Fases (días de misión). Los pasos 4–7 ocurren alrededor de Marte.
    const T_AERO = T_ARR + 6;            // fin del frenado: empieza el aerofrenado
    const T_LOW = T_AERO + 75;           // ~2,5 meses de aerofrenado (como Mars Odyssey) hasta la órbita baja
    // (así el envío del paso 7 ocurre antes de la conjunción solar, cuando el Sol bloquearía la radio)
    const T_PHOTO = T_LOW + 10;          // fotos
    const T_END = T_PHOTO + 10;          // envío a la Tierra
    const STEPS = [
      { from: 0, to: 2.2, ms: 4000 },
      { from: 2.2, to: 5, ms: 4500 },
      { from: 5, to: T_ARR, ms: 13000 },
      { from: T_ARR, to: T_AERO, ms: 5500 },
      { from: T_AERO, to: T_LOW, ms: 11000 },
      { from: T_LOW, to: T_PHOTO, ms: 7000 },
      { from: T_PHOTO, to: T_END, ms: 8000 },
    ];
    const NSTEPS = STEPS.length;
    const STATUS_EN = [
      'The spacecraft is waiting on Earth. Press a button to launch!',
      'Step 1 · Lift-off! The spacecraft leaves Earth, heading for the Moon.',
      'Step 2 · The spacecraft swings past the Moon: its gravity bends the path and speeds it up (slingshot effect).',
      'Step 3 · Travelling along a curved orbit around the Sun, chasing Mars.',
      'Step 4 · Braking: a short engine burn and Mars captures the spacecraft in a large orbit.',
      'Step 5 · Aerobraking: on every lap it skims the atmosphere and the orbit gets smaller.',
      'Step 6 · The spacecraft turns to point its camera at Mars and takes high-resolution photos.',
      'Step 7 · It turns to point its antenna at Earth and sends the photos by radio.',
    ];
    const STATUS = [
      'La nave espera en la Tierra. ¡Pulsa un botón para despegar!',
      'Paso 1 · ¡Despegue! La nave sale de la Tierra rumbo a la Luna.',
      'Paso 2 · La nave pasa junto a la Luna: su gravedad la curva y la acelera (efecto honda).',
      'Paso 3 · Viaje por una órbita curva alrededor del Sol, persiguiendo a Marte.',
      'Paso 4 · Frenado: un encendido corto del motor y Marte atrapa la nave en una órbita grande.',
      'Paso 5 · Aerofrenado: en cada vuelta roza la atmósfera y la órbita se hace más pequeña.',
      'Paso 6 · La nave gira para apuntar la cámara a Marte y toma fotos de alta resolución.',
      'Paso 7 · Gira para apuntar la antena a la Tierra y envía las fotos por radio.',
    ];
    // Alrededor de qué astro gira la nave en cada paso (0 = antes de despegar)
    const AROUND = ['earth', 'earth', 'moon', 'sun', 'mars', 'mars', 'mars', 'mars'];
    const AROUND_NAME = {
      earth: ['la Tierra', 'the Earth'], moon: ['la Luna', 'the Moon'], sun: ['el Sol', 'the Sun'], mars: ['Marte', 'Mars'],
    };
    const AROUND_COLOR = { earth: '#7fbfff', moon: '#e3e7ef', sun: '#ffd27a', mars: '#ff9a6b' };

    // Geometría del dibujo (unidades relativas al tamaño del canvas)
    const R_E = 0.28, R_M = R_E * 1.524, L_M = 0.075;
    const dayOffset = (LAUNCH - OPP_2027) / DAY;
    const ROT = -Math.PI / 2 - 0.35 - TAU * (dayOffset + 5) / P_EARTH; // salida abajo, llegada arriba
    const angE = (D) => TAU * (dayOffset + D) / P_EARTH + ROT;
    const angM = (D) => TAU * (dayOffset + D) / P_MARS + ROT;
    const earth = (D) => polar(R_E, angE(D));
    const mars = (D) => polar(R_M, angM(D));
    const TH_LC = angE(2.6); // la Luna, en el momento del paso cercano, está "por fuera" de la Tierra
    const moonAng = (D) => TH_LC + TAU * (D - 2.6) / P_MOON;
    // La distancia Tierra–Luna está exagerada; se encoge al alejar la cámara para no deformar el viaje
    const lmScale = (D) => (D <= 35 ? camera(D).z / 3 : 1 / 3);
    const scaled = (p, k) => ({ x: p.x * k, y: p.y * k });
    const moon = (D) => add(earth(D), polar(L_M * lmScale(D), moonAng(D)));

    // Despegue y paso por la Luna: puntos de paso en un marco ligado a la Tierra
    // (u = hacia fuera del Sol, v = sentido del movimiento de la Tierra), en unidades de distancia Tierra–Luna
    const WD = [0, 1.0, 1.9, 2.4, 2.8, 3.4, 4.1, 5.0];
    const WP = [[0.15, -0.05], [0.5, -0.2], [0.85, -0.25], [1.12, -0.12], [1.2, 0.1], [1.3, 0.5], [1.45, 1.0], [1.6, 1.7]];
    const cr = (p0, p1, p2, p3, t) => {
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    };
    function localOffset(D) {
      D = clamp(D, 0, 5);
      let i = 0;
      while (i < WD.length - 2 && D > WD[i + 1]) i++;
      const t = (D - WD[i]) / (WD[i + 1] - WD[i]);
      const P = (k) => WP[clamp(k, 0, WP.length - 1)];
      const u = cr(P(i - 1)[0], P(i)[0], P(i + 1)[0], P(i + 2)[0], t);
      const v = cr(P(i - 1)[1], P(i)[1], P(i + 1)[1], P(i + 2)[1], t);
      const cu = Math.cos(TH_LC), su = Math.sin(TH_LC);
      return { x: (u * cu - v * su) * L_M, y: (u * su + v * cu) * L_M };
    }

    // Órbita de transferencia (media elipse de la órbita terrestre a la marciana)
    const PHI0 = angE(5);
    const A = (R_E + R_M) / 2, ECC = (R_M - R_E) / (R_M + R_E);
    const kepler = (Mn, e) => {
      let E = Mn;
      for (let k = 0; k < 10; k++) E -= (E - e * Math.sin(E) - Mn) / (1 - e * Math.cos(E));
      return E;
    };
    function transfer(f) {
      const E = kepler(Math.PI * clamp(f, 0, 1), ECC);
      const nu = 2 * Math.atan2(Math.sqrt(1 + ECC) * Math.sin(E / 2), Math.sqrt(1 - ECC) * Math.cos(E / 2));
      return polar(A * (1 - ECC * Math.cos(E)), PHI0 + nu);
    }

    // Órbita alrededor de Marte (Marte agrandado; radio del planeta = MARS_RW)
    const MARS_RW = 0.006, ATM_RW = 0.0072;             // superficie y techo de la atmósfera
    const RP_CAP = 0.0078, RA_CAP = 0.045;               // órbita de captura, grande y alargada
    const RP_AERO = 0.0069, R_LOW = 0.0088;              // periapsis dentro de la atmósfera; órbita baja final
    const ALPHA0 = angM(T_ARR) + Math.PI;                // periapsis en el lado iluminado
    function marsOrbit(D) {
      let rp, ra, M;
      if (D < T_AERO) {
        rp = RP_CAP; ra = RA_CAP; M = TAU * (D - T_ARR) / (T_AERO - T_ARR);
      } else if (D < T_LOW) {
        const q = (D - T_AERO) / (T_LOW - T_AERO);
        rp = q < 0.86 ? lerp(RP_CAP, RP_AERO, smooth(q / 0.06)) : lerp(RP_AERO, R_LOW, smooth((q - 0.86) / 0.14));
        ra = Math.max(rp, R_LOW + (RA_CAP - R_LOW) * Math.pow(1 - q, 1.6));
        M = TAU * (1 + 8 * q);
      } else {
        rp = ra = R_LOW; M = TAU * (9 + 3 * (D - T_LOW) / 10);
      }
      return { rp, ra, M };
    }
    function orbitPos(o) {
      const a = (o.rp + o.ra) / 2, e = (o.ra - o.rp) / (o.ra + o.rp);
      const E = kepler(o.M, e);
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      return polar(a * (1 - e * Math.cos(E)), ALPHA0 + nu);
    }

    function shipPos(D, k = lmScale(D)) {
      if (D <= 5) return add(earth(D), scaled(localOffset(D), k));
      if (D <= T_ARR) {
        const f = (D - 5) / (T_ARR - 5);
        let p = transfer(f);
        if (f < 0.12) p = mix(add(earth(D), scaled(localOffset(5), k)), p, smooth(f / 0.12));
        if (f > 0.9) p = mix(p, add(mars(D), polar(RP_CAP, ALPHA0)), smooth((f - 0.9) / 0.1));
        return p;
      }
      return add(mars(D), orbitPos(marsOrbit(D)));
    }

    // Cámara: al acercarse se centra antes de ampliar, para que el astro no se salga de la imagen
    // far = vista general (zoom pequeño), near = vista cercana; w = 0 → far, w = 1 → near
    function blendCam(far, near, w) {
      const z = Math.exp(lerp(Math.log(far.z), Math.log(near.z), w));
      const wc = clamp(1 - (1 - w) * (far.z / z), 0, 1);
      return { c: mix(far.c, near.c, wc), z };
    }
    function marsCam(D) {
      const o = D >= T_ARR ? marsOrbit(D) : { rp: RP_CAP, ra: RA_CAP };
      return { c: add(mars(D), polar(-(o.ra - o.rp) * 0.4, ALPHA0)), z: clamp(0.36 / (o.ra + 0.006), 6, 22) };
    }
    function camera(D) {
      const O = { c: { x: 0, y: 0 }, z: 1 };
      if (D <= 5) { const w = smooth(D / 0.8); return { c: mix(O.c, earth(D), w), z: lerp(1, 3, w) }; }
      if (D < 35) { const w = smooth((D - 5) / 30); return { c: mix(earth(D), O.c, w), z: lerp(3, 1, w) }; }
      if (D < T_ARR - 22) return O;
      if (D < T_ARR + 2) return blendCam(O, marsCam(D), smooth((D - (T_ARR - 22)) / 24));
      if (D < T_PHOTO + 3.5) return marsCam(D);
      return blendCam(O, marsCam(D), 1 - smooth((D - (T_PHOTO + 3.5)) / 4));
    }

    // Estado
    let D = 0, step = 0, runner = null, playing = false, autoplay = false, gap = 0;
    let shipAng = 0, lastDrawT = 0, lastD = 0;
    const dayOut = $('#m-day'), dateOut = $('#m-date'), photosWrap = $('#m-photos-wrap'), photosOut = $('#m-photos');
    const aroundOut = $('#m-around'), delayWrap = $('#m-delay-wrap'), delayOut = $('#m-delay');
    const status = $('#m-status');
    const btnPrev = $('#m-prev'), btnNext = $('#m-next'), btnPlay = $('#m-play'), btnReset = $('#m-reset');
    const items = $$('#m-steps li');

    function updateUI() {
      items.forEach((li, i) => {
        const n = i + 1;
        li.classList.toggle('active', n === step);
        li.classList.toggle('done', n < step);
        li.querySelector('button').setAttribute('aria-current', n === step ? 'step' : 'false');
      });
      btnPrev.disabled = step <= 1;
      btnNext.disabled = step >= NSTEPS;
      btnPlay.textContent = playing && autoplay ? L('⏸ Pausa', '⏸ Pause') : L('▶ Reproducir todo', '▶ Play all');
      status.textContent = L(STATUS[step], STATUS_EN[step]);
      const body = AROUND[step];
      aroundOut.textContent = L(...AROUND_NAME[body]);
      aroundOut.style.color = AROUND_COLOR[body];
    }

    function startStep(i) {
      step = i + 1;
      D = STEPS[i].from;
      runner = { i };
      playing = true;
      gap = 0;
      updateUI();
    }

    btnNext.addEventListener('click', () => { autoplay = false; if (step < NSTEPS) startStep(step); });
    btnPrev.addEventListener('click', () => { autoplay = false; startStep(Math.max(0, step - 2)); });
    btnReset.addEventListener('click', () => {
      D = 0; step = 0; runner = null; playing = false; autoplay = false; gap = 0; updateUI();
    });
    btnPlay.addEventListener('click', () => {
      if (playing && autoplay) { playing = false; updateUI(); return; }
      const finished = step === NSTEPS && !runner;
      if (step === 0 || finished) { autoplay = true; startStep(0); return; }
      autoplay = true; playing = true;
      if (!runner && gap <= 0) startStep(step);
      updateUI();
    });
    items.forEach((li, i) => li.querySelector('button').addEventListener('click', () => {
      autoplay = false; startStep(i);
      if (window.innerWidth < 960) canvas.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));

    function tick(dt) {
      if (playing && runner) {
        const s = STEPS[runner.i];
        let rate = (s.to - s.from) / (s.ms / 1000);
        if (runner.i === 2 && Math.abs(D - D_OPP) < 9) rate *= 0.2; // frenamos para ver la oposición
        D = Math.min(s.to, D + rate * dt);
        if (D >= s.to) {
          runner = null;
          if (autoplay && step < NSTEPS) gap = 0.7;
          else if (step === NSTEPS) { autoplay = false; playing = false; }
          updateUI();
        }
      } else if (playing && gap > 0) {
        gap -= dt;
        if (gap <= 0) startStep(step);
      }
      if (step === NSTEPS && !runner) D += 0.6 * dt; // sigue en órbita enviando datos
      draw();
    }

    function draw() {
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      const m = Math.min(w, h) * 0.98;
      const cam = camera(D);
      const sc = m * cam.z;
      const toS = (p) => ({ x: w / 2 + (p.x - cam.c.x) * sc, y: h / 2 - (p.y - cam.c.y) * sc });
      const size = Math.sqrt(Math.min(cam.z, 4));
      const fs = w < 420 ? 11 : 12;
      const sunS = toS({ x: 0, y: 0 });
      const now = performance.now();
      const dtR = Math.min(0.1, (now - lastDrawT) / 1000 || 0);
      lastDrawT = now;

      drawOrbit(ctx, sunS.x, sunS.y, R_E * sc, 'rgba(78,163,255,0.25)');
      drawOrbit(ctx, sunS.x, sunS.y, R_M * sc, 'rgba(255,122,69,0.25)');

      // Ruta prevista
      if (cam.z < 4) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,220,190,0.28)'; ctx.setLineDash([2, 6]); ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) { const p = toS(transfer(i / 80)); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
        ctx.stroke();
        ctx.restore();
      }

      // Oposición: línea Sol–Tierra–Marte
      const oppAng = angE(D_OPP);
      if (D > 5 && D < T_ARR - 10) {
        const dist = Math.abs(D - D_OPP);
        const strong = dist < 9 ? 1 - dist / 9 : 0;
        if (D >= D_OPP - 9) {
          const a = D < D_OPP - 9 ? 0 : Math.max(strong, 0.3);
          const tip = toS(polar(R_M * 1.12, oppAng));
          ctx.save();
          ctx.globalAlpha = a; ctx.strokeStyle = '#ff7a45'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
          ctx.beginPath(); ctx.moveTo(sunS.x, sunS.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
          ctx.restore();
          if (strong > 0) {
            const lp = toS(polar(R_M * 1.06, oppAng));
            const al = Math.cos(oppAng) >= 0 ? 'left' : 'right';
            const dx = al === 'left' ? 4 : -4;
            label(ctx, L('¡Oposición!', 'Opposition!'), lp.x + dx, lp.y - 34, { align: al, color: '#ffb48f', size: fs + 2, weight: 700 });
            label(ctx, shortDate(LAUNCH + D_OPP * DAY), lp.x + dx, lp.y - 18, { align: al, color: '#ffd7c2', size: fs, weight: 500 });
          } else if (cam.z < 1.3) {
            const lp = toS(polar(R_M * 1.06, oppAng));
            label(ctx, L('oposición', 'opposition'), lp.x, lp.y - 18, { align: Math.cos(oppAng) >= 0 ? 'left' : 'right', color: 'rgba(255,180,143,0.7)', size: fs - 1, weight: 500 });
          }
        }
      }

      // Cuerpos
      const sunR = m * 0.03 * size;
      drawSun(ctx, sunS.x, sunS.y, sunR);
      label(ctx, L('Sol', 'Sun'), sunS.x, sunS.y + m * 0.075 * size, { align: 'center', color: '#ffe2a0', size: fs });

      const Es = toS(earth(D)), Ms = toS(mars(D)), Ls = toS(moon(D));
      const eR = Math.max(4, m * 0.016 * size), lR = Math.max(2, m * 0.0065 * size);
      const mR = Math.max(3.5, m * 0.012 * size, MARS_RW * sc);
      if (cam.z > 1.4 && D < 40) drawOrbit(ctx, Es.x, Es.y, L_M * lmScale(D) * sc, 'rgba(210,215,230,0.2)', [2, 4]);
      drawGlow(ctx, Es.x, Es.y, m * 0.05 * size, '78,163,255', 0.25);
      drawEarth(ctx, Es.x, Es.y, eR, sunS);
      drawMoon(ctx, Ls.x, Ls.y, lR, sunS);
      drawGlow(ctx, Ms.x, Ms.y, Math.max(m * 0.05 * size, mR * 1.6), '255,106,61', 0.22);
      if (mR > 14) {
        // Atmósfera (exagerada) alrededor de Marte
        const atmR = ATM_RW * sc;
        const g = ctx.createRadialGradient(Ms.x, Ms.y, mR * 0.98, Ms.x, Ms.y, atmR);
        g.addColorStop(0, 'rgba(255,170,120,0.45)'); g.addColorStop(1, 'rgba(255,140,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Ms.x, Ms.y, atmR, 0, TAU); ctx.fill();
        drawMarsPhoto(ctx, Ms.x, Ms.y, mR, sunS);
      } else {
        drawBody(ctx, Ms.x, Ms.y, mR, COLORS.mars, sunS);
      }
      label(ctx, L('Tierra', 'Earth'), Es.x + m * 0.03 * size, Es.y + m * 0.03 * size, { size: fs, color: '#cfe5ff' });
      if (cam.z > 1.4 && D < 40) label(ctx, L('Luna', 'Moon'), Ls.x + m * 0.02 * size, Ls.y - m * 0.02 * size, { size: fs, color: '#d3d8e4' });
      label(ctx, L('Marte', 'Mars'), Ms.x + mR * 0.75 + 8, Ms.y + mR * 0.75 + 8, { size: fs, color: '#ffc2a6' });

      // Astro alrededor del que gira la nave en este paso
      if (step > 0) {
        const body = AROUND[step];
        const pos = { earth: [Es, eR], moon: [Ls, lR], sun: [sunS, sunR * 1.4], mars: [Ms, mR] }[body];
        const pulse = 0.5 + 0.5 * Math.sin(now / 350);
        const rr = pos[1] + 9 + pulse * 3;
        ctx.save();
        ctx.strokeStyle = AROUND_COLOR[body]; ctx.globalAlpha = 0.55 + 0.35 * pulse; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -now / 60;
        ctx.beginPath(); ctx.arc(pos[0].x, pos[0].y, rr, 0, TAU); ctx.stroke();
        ctx.restore();
      }

      if (step === 0) {
        const Ae = toS(polar(R_M, PHI0 + Math.PI));
        label(ctx, L('punto de encuentro', 'meeting point'), Ae.x, Ae.y - 18, { align: 'center', size: fs - 1, color: 'rgba(255,220,190,0.75)', weight: 500 });
        ctx.save(); ctx.strokeStyle = 'rgba(255,220,190,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(Ae.x, Ae.y, 8, 0, TAU); ctx.stroke(); ctx.restore();
        return updateReadouts();
      }

      // Estela
      ctx.save();
      ctx.strokeStyle = '#ff7a45'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,122,69,0.7)'; ctx.shadowBlur = 6;
      ctx.beginPath();
      let first = true;
      const kNow = lmScale(D);
      // Los primeros días se dibujan relativos a la Tierra para que se vea el paso junto a la Luna
      const pushPt = (d) => {
        // Alrededor de Marte, la estela se dibuja relativa a Marte (si no, su movimiento la deforma)
        const p = toS(d < 5 ? add(earth(Math.min(D, 5)), scaled(localOffset(d), kNow))
          : d >= T_ARR ? add(mars(D), orbitPos(marsOrbit(d))) : shipPos(d, kNow));
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      };
      // Alrededor de Marte, solo se dibuja la última vuelta
      const span = D < T_AERO ? (T_AERO - T_ARR) : D < T_LOW ? (T_LOW - T_AERO) / 8 : 10 / 3;
      const tailStart = D > T_ARR + 1 ? Math.max(T_ARR, D - span * 0.97) : 0;
      for (let d = tailStart; d < Math.min(D, 5); d += 0.04) pushPt(d);
      for (let d = Math.max(5, tailStart); d < Math.min(D, T_ARR); d += 1.5) pushPt(d);
      for (let d = Math.max(T_ARR, tailStart); d < D; d += span / 160) pushPt(d);
      pushPt(D);
      ctx.stroke();
      ctx.restore();

      // Nave: hacia dónde apunta
      const P = shipPos(D), Pn = shipPos(D + 0.004);
      const S0 = toS(P), S1 = toS(Pn);
      const velAng = Math.atan2(S1.y - S0.y, S1.x - S0.x);
      const burning = D > T_ARR && D < T_ARR + 0.5;            // frenado: motor hacia delante
      let target = burning ? velAng + Math.PI : velAng;
      let aim = null;
      if (step === 6) { target = Math.atan2(Ms.y - S0.y, Ms.x - S0.x); aim = 'camera'; }
      if (step === 7) { target = Math.atan2(Es.y - S0.y, Es.x - S0.x) + Math.PI / 2; aim = 'antenna'; }
      if (step < 4 || D < lastD - 1 || Math.abs(D - lastD) > 40) shipAng = target;
      else {
        const diff = Math.atan2(Math.sin(target - shipAng), Math.cos(target - shipAng));
        shipAng += diff * (1 - Math.exp(-dtR * (aim ? 3.5 : 12)));
      }
      lastD = D;
      const thrust = (step === 1 && D < 1.4) || burning;

      // Aerofrenado: calor al rozar la atmósfera
      const rMars = Math.hypot(P.x - mars(D).x, P.y - mars(D).y);
      const inAtm = step === 5 && rMars < ATM_RW + 0.0002 && D > T_ARR;
      if (inAtm) drawGlow(ctx, S0.x, S0.y, 22, '255,150,60', 0.75);

      // Fotos: cono de visión de la cámara hacia Marte
      if (step === 6 && D > T_LOW + 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin(now / 160));
        ctx.fillStyle = '#fff6d8';
        const toM = Math.atan2(Ms.y - S0.y, Ms.x - S0.x);
        const rr = Math.max(0, Math.hypot(Ms.x - S0.x, Ms.y - S0.y) - mR * 0.6);
        ctx.beginPath(); ctx.moveTo(S0.x, S0.y);
        ctx.lineTo(S0.x + Math.cos(toM - 0.3) * rr, S0.y + Math.sin(toM - 0.3) * rr);
        ctx.lineTo(S0.x + Math.cos(toM + 0.3) * rr, S0.y + Math.sin(toM + 0.3) * rr);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Envío por radio: ondas que viajan de Marte a la Tierra
      if (step === 7 && D > T_PHOTO + 1) {
        const dir = Math.atan2(Es.y - S0.y, Es.x - S0.x);
        ctx.save();
        ctx.strokeStyle = 'rgba(127,216,255,0.25)'; ctx.setLineDash([3, 7]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(S0.x, S0.y); ctx.lineTo(Es.x, Es.y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const p = ((now / 1000) * 0.3 + k / 6) % 1;
          const x = lerp(S0.x, Es.x, p), y = lerp(S0.y, Es.y, p);
          ctx.globalAlpha = 0.9 - p * 0.4;
          ctx.strokeStyle = '#7fd8ff';
          ctx.beginPath(); ctx.arc(x, y, 7, dir - 0.7, dir + 0.7); ctx.stroke();
        }
        ctx.restore();
        if (cam.z < 2) {
          const mins = lightMinutes(D);
          label(ctx, L(`📡 ${num(mins, 1)} min a la velocidad de la luz`, `📡 ${num(mins, 1)} min at the speed of light`),
            (S0.x + Es.x) / 2, (S0.y + Es.y) / 2 - 16, { align: 'center', size: fs, color: '#9fe2ff' });
          label(ctx, L('Red de Espacio Profundo (NASA)', 'NASA Deep Space Network'), Es.x, Es.y - eR - 14, { align: 'center', size: fs - 1, color: '#cfe5ff', weight: 500 });
        }
      }

      ctx.save();
      ctx.translate(S0.x, S0.y);
      ctx.rotate(shipAng);
      drawRocket(ctx, thrust, w < 420 ? 1.1 : 1.4, { dish: D > T_ARR, lens: D > T_ARR });
      ctx.restore();

      if (D > 2.3 && D < 4.2) {
        const a = Math.sin(((D - 2.3) / 1.9) * Math.PI);
        ctx.save(); ctx.globalAlpha = a;
        label(ctx, L('¡Impulso de la Luna!', 'Boost from the Moon!'), S0.x + 12, S0.y + 22, { color: '#6be3b5', size: fs + 1, weight: 700 });
        ctx.restore();
      }
      // Etiquetas junto a la nave (en el lado contrario a Marte)
      const away = Math.atan2(S0.y - Ms.y, S0.x - Ms.x);
      const lx = S0.x + Math.cos(away) * 26, ly = S0.y + Math.sin(away) * 26;
      const lal = Math.cos(away) >= 0 ? 'left' : 'right';
      if (burning || (step === 4 && D < T_ARR + 1.2)) label(ctx, L('🔥 ¡Frenando!', '🔥 Braking!'), lx, ly, { align: lal, size: fs + 1, color: '#ffc857', weight: 700 });
      if (inAtm) label(ctx, L('🔥 rozando la atmósfera', '🔥 skimming the atmosphere'), lx, ly, { align: lal, size: fs, color: '#ffb36b', weight: 700 });
      if (aim === 'camera') label(ctx, L('📷 cámara → Marte', '📷 camera → Mars'), lx, ly, { align: lal, size: fs, color: '#fff2c8', weight: 700 });
      if (aim === 'antenna' && cam.z > 2) label(ctx, L('📡 antena → Tierra', '📡 antenna → Earth'), lx, ly, { align: lal, size: fs, color: '#9fe2ff', weight: 700 });
      updateReadouts();
    }

    // Distancia Tierra–Marte en el modelo → minutos que tarda la luz (1 unidad R_E = 1 UA)
    function lightMinutes(D) {
      const e = earth(D), mm = mars(D);
      const km = Math.hypot(e.x - mm.x, e.y - mm.y) / R_E * 149.6e6;
      return km / 299792.458 / 60;
    }

    let lastShown = '';
    function updateReadouts() {
      const day = Math.floor(D);
      const photos = D > T_LOW + 0.3 ? Math.floor((D - T_LOW - 0.3) * 18) : 0;
      const delay = step === NSTEPS ? num(lightMinutes(D), 1) : '';
      const key = `${day}|${photos}|${delay}`;
      if (key === lastShown) return;
      lastShown = key;
      dayOut.textContent = num(day);
      dateOut.textContent = longDate(LAUNCH + day * DAY);
      photosWrap.hidden = photos === 0;
      photosOut.textContent = num(photos);
      delayWrap.hidden = !delay;
      delayOut.textContent = delay ? `${delay} min` : '—';
    }

    // Fechas de la cronología coherentes con la animación
    const tlLaunch = $('#tl-launch'), tlArr = $('#tl-arrival'), tlAero = $('#tl-aero'), tlPhotos = $('#tl-photos');
    const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    const monYear = (t) => fmtDate(t, { month: 'short', year: 'numeric' });
    function setTimeline() {
      if (tlLaunch) tlLaunch.textContent = cap(monthYear(LAUNCH));
      if (tlArr) tlArr.textContent = cap(monthYear(LAUNCH + T_ARR * DAY));
      if (tlAero) tlAero.textContent = `${cap(monYear(LAUNCH + T_AERO * DAY))} – ${monYear(LAUNCH + T_LOW * DAY)}`;
      if (tlPhotos) tlPhotos.textContent = cap(monthYear(LAUNCH + T_LOW * DAY));
    }
    setTimeline();
    onLang.push(() => { lastShown = ''; updateUI(); setTimeline(); draw(); });

    updateUI();
    runWhenVisible(canvas, tick);
  })();

  /* ---------- Zoom: el paso por la Luna, parte a parte ---------- */
  (function lunarFlyby() {
    const canvas = $('#flyby');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());

    // Unidades: distancia Tierra–Luna = 1; la Luna da una vuelta cada 2π unidades de tiempo (27,3 días)
    const MU_M = 0.03;                 // gravedad de la Luna (exagerada, la real sería 0,0123)
    const R0 = 0.12, R_EARTH = 0.07, R_MOON = 0.03;
    const TH0 = -Math.PI / 3, VB = 3.8959; // posición inicial de la Luna y velocidad tras el encendido
    const DAYS_PER_T = 27.32 / TAU;
    const KM = 384400;
    const OMEGA0 = Math.sqrt(1 / (R0 * R0 * R0));
    const LAP = TAU / OMEGA0;
    const T_START = -2 * LAP, T_END = 1.75;
    const moonAt = (t) => polar(1, TH0 + t);

    // Trayectoria calculada con gravedad real (Runge-Kutta), con y sin la Luna
    function integrate(mu, tEnd) {
      const dt = 0.0005, pts = [];
      let s = [-R0, 0, 0, -VB], t = 0;
      const f = (st) => {
        const [x, y, vx, vy] = st;
        const r3 = Math.pow(x * x + y * y, 1.5);
        let ax = -x / r3, ay = -y / r3;
        if (mu) {
          const m = moonAt(t);
          const dx = x - m.x, dy = y - m.y, d3 = Math.pow(dx * dx + dy * dy, 1.5);
          ax -= mu * dx / d3; ay -= mu * dy / d3;
        }
        return [vx, vy, ax, ay];
      };
      pts.push(s);
      while (t < tEnd) {
        const k1 = f(s);
        const k2 = f(s.map((v, i) => v + k1[i] * dt / 2));
        const k3 = f(s.map((v, i) => v + k2[i] * dt / 2));
        const k4 = f(s.map((v, i) => v + k3[i] * dt));
        s = s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
        t += dt;
        pts.push(s);
      }
      return { dt, pts };
    }
    const traj = integrate(MU_M, T_END + 0.01);
    const ghost = integrate(0, 3.55);
    let ghostTop = ghost.pts[0];
    ghost.pts.forEach((p) => { if (p[1] > ghostTop[1]) ghostTop = p; });

    function stateAt(t) {
      if (t < 0) {
        const ang = Math.PI + OMEGA0 * t;
        const r = t < -LAP ? lerp(R_EARTH, R0, smooth((t - T_START) / LAP)) : R0;
        const p = polar(r, ang), v = polar(OMEGA0 * R0, ang + Math.PI / 2);
        return { x: p.x, y: p.y, vx: v.x, vy: v.y };
      }
      const fi = t / traj.dt;
      const i = Math.min(Math.floor(fi), traj.pts.length - 2), u = clamp(fi - i, 0, 1);
      const a = traj.pts[i], b = traj.pts[i + 1];
      return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), vx: lerp(a[2], b[2], u), vy: lerp(a[3], b[3], u) };
    }

    // Momentos en que la nave entra y sale de la "zona" de la Luna
    let tIn = 0.5, tOut = 0.9;
    {
      let inside = false;
      for (let i = 0; i < traj.pts.length; i++) {
        const t = i * traj.dt, m = moonAt(t);
        const d = Math.hypot(traj.pts[i][0] - m.x, traj.pts[i][1] - m.y);
        if (!inside && d < 0.2) { inside = true; tIn = t; }
        else if (inside && d > 0.2) { tOut = t; break; }
      }
    }

    const PARTS = [
      { from: T_START, to: -0.02, secs: 7, title: 'Despegue y órbita de espera', titleEn: 'Lift-off and parking orbit',
        textEn: 'The rocket lifts off and keeps circling the Earth a few hundred kilometres up. It waits for the exact moment to leave, so the Moon will be in just the right place when it gets there.',
        text: 'El cohete despega y se queda dando vueltas a la Tierra, a unos cientos de kilómetros de altura. Espera el momento exacto para salir: así la Luna estará en el sitio justo cuando llegue.' },
      { from: -0.02, to: 0.06, secs: 4, title: 'Encendido hacia la Luna', titleEn: 'Engine burn towards the Moon',
        textEn: 'At exactly the right point, the engine fires for a few minutes. The spacecraft gains a lot of speed and its orbit stretches out until it reaches the Moon’s distance.',
        text: 'En el punto preciso, el motor se enciende unos minutos. La nave gana mucha velocidad y su órbita se estira hasta llegar a la distancia de la Luna.' },
      { from: 0.06, to: tIn, secs: 6, title: 'Travesía de unos 3 días', titleEn: 'A journey of about 3 days',
        textEn: 'With the engine off, the spacecraft travels almost 384,000 km. Earth’s gravity slowly brakes it. It does not aim at where the Moon is now, but at where it will be in 3 days.',
        text: 'Con el motor apagado, la nave recorre casi 384.000 km. La gravedad de la Tierra la va frenando poco a poco. No apunta a donde está la Luna, sino a donde estará dentro de 3 días.' },
      { from: tIn, to: tOut, secs: 9, title: 'Paso por detrás de la Luna', titleEn: 'Passing behind the Moon',
        textEn: 'The spacecraft passes just behind the Moon, which moves at ~1 km/s. The Moon’s gravity (blue arrow) pulls on it, bends its path and drags it along: it leaves faster than it arrived. Keep an eye on the “Can it escape?” bar.',
        text: 'La nave pasa justo por detrás de la Luna, que avanza a ~1 km/s. La gravedad lunar (flecha azul) tira de ella, la curva y la arrastra consigo: sale más rápida de lo que entró. Fíjate en la barra «¿Puede escapar?».' },
      { from: tOut, to: T_END, secs: 6, title: 'Salida hacia Marte', titleEn: 'Off to Mars',
        textEn: 'Thanks to the boost, it now has enough energy to escape Earth and carry on to Mars. Without the Moon it would have turned around and come back home (dashed line).',
        text: 'Gracias al empujón, ya tiene energía para escapar de la Tierra y seguir hacia Marte. Sin la Luna habría dado la vuelta y regresado a casa (línea discontinua).' },
    ];

    const btnPlay = $('#fb-play'), btnReset = $('#fb-reset'), chkGhost = $('#fb-ghost');
    const daysOut = $('#fb-days'), distOut = $('#fb-dist'), moonOut = $('#fb-moon');
    const escOut = $('#fb-escape'), escFill = $('#fb-escape-fill');
    const kicker = $('#fb-part-kicker'), titleOut = $('#fb-part-title'), textOut = $('#fb-part-text');
    const items = $$('#fb-parts li');

    let t = T_START, playing = !reduceMotion, part = -1;
    const cam = { x: 0, y: 0, h: 0.3 };

    const partAt = (tt) => { let p = 0; PARTS.forEach((P, i) => { if (tt >= P.from) p = i; }); return p; };

    function camTarget() {
      const p = partAt(t);
      if (p <= 1) return { x: 0, y: 0, h: 0.3 };
      if (p === 2) return { x: 0.42, y: -0.3, h: 0.56 };
      if (p === 3) { const m = moonAt(t), s = stateAt(t); const c = mix(m, s, 0.4); return { x: c.x, y: c.y, h: 0.2 }; }
      return { x: 0.95, y: 0.05, h: 1.0 };
    }

    function updatePart() {
      const p = partAt(t);
      if (p === part) return;
      part = p;
      items.forEach((li, i) => { li.classList.toggle('active', i === p); li.classList.toggle('done', i < p); });
      kicker.textContent = L(`Parte ${p + 1} de 5`, `Part ${p + 1} of 5`);
      titleOut.textContent = L(PARTS[p].title, PARTS[p].titleEn);
      textOut.textContent = L(PARTS[p].text, PARTS[p].textEn);
    }
    function updatePlay() {
      btnPlay.textContent = playing ? L('⏸ Pausa', '⏸ Pause') : (t >= T_END ? L('↺ Ver otra vez', '↺ Watch again') : L('▶ Reproducir', '▶ Play'));
    }

    btnPlay.addEventListener('click', () => {
      if (!playing && t >= T_END) t = T_START;
      playing = !playing; updatePlay();
    });
    btnReset.addEventListener('click', () => { t = T_START; playing = false; updatePlay(); draw(); });
    chkGhost.addEventListener('change', () => draw());
    items.forEach((li, i) => li.querySelector('button').addEventListener('click', () => {
      t = PARTS[i].from; playing = true; updatePlay();
      if (window.innerWidth < 960) canvas.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));

    function arrowTo(ctx, x, y, dx, dy, color) {
      const len = Math.hypot(dx, dy);
      if (len < 4) return;
      const ux = dx / len, uy = dy / len;
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + dx + ux * 7, y + dy + uy * 7);
      ctx.lineTo(x + dx - uy * 5, y + dy + ux * 5);
      ctx.lineTo(x + dx + uy * 5, y + dy - ux * 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function draw() {
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      const sc = Math.min(w, h) / (2 * cam.h);
      const toS = (x, y) => ({ x: w / 2 + (x - cam.x) * sc, y: h / 2 - (y - cam.y) * sc });
      const fs = w < 420 ? 11 : 12;
      const p = partAt(t);
      const E0 = toS(0, 0);

      // Órbita de la Luna
      drawOrbit(ctx, E0.x, E0.y, sc, 'rgba(210,215,230,0.22)', [3, 6]);

      // Camino sin la Luna
      if (chkGhost.checked && t > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(200,210,230,0.45)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < ghost.pts.length; i += 10) {
          const q = toS(ghost.pts[i][0], ghost.pts[i][1]);
          i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        }
        ctx.stroke();
        ctx.restore();
        if (p >= 3) {
          const a = toS(ghostTop[0], ghostTop[1]);
          label(ctx, L('sin la Luna: volvería a la Tierra', 'without the Moon: it would come back to Earth'), a.x, a.y - 12, { align: 'center', size: fs, color: 'rgba(220,226,240,0.8)', weight: 500 });
        }
      }

      // Estela del cohete
      ctx.save();
      ctx.strokeStyle = '#ff7a45'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,122,69,0.7)'; ctx.shadowBlur = 6;
      ctx.beginPath();
      let first = true;
      const push = (tt) => {
        const s = stateAt(tt), q = toS(s.x, s.y);
        if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y);
      };
      const tailFrom = Math.max(T_START, t < 0 ? t - LAP * 0.9 : -LAP * 0.5);
      for (let tt = tailFrom; tt < Math.min(t, 0); tt += LAP / 80) push(tt);
      for (let tt = Math.max(0, tailFrom); tt < t; tt += 0.003) push(tt);
      push(t);
      ctx.stroke();
      ctx.restore();

      // Tierra y Luna
      const m = moonAt(t), M = toS(m.x, m.y);
      const sunDir = { x: E0.x - sc * 6, y: E0.y - sc * 2 }; // luz del Sol desde la izquierda
      drawGlow(ctx, E0.x, E0.y, R_EARTH * sc * 2.6, '78,163,255', 0.3);
      drawEarth(ctx, E0.x, E0.y, Math.max(6, R_EARTH * sc), sunDir);
      label(ctx, L('Tierra', 'Earth'), E0.x, E0.y + Math.max(6, R_EARTH * sc) + 14, { align: 'center', size: fs, color: '#cfe5ff' });
      drawGlow(ctx, M.x, M.y, R_MOON * sc * 2.5, '200,210,235', 0.18);
      drawMoon(ctx, M.x, M.y, Math.max(4, R_MOON * sc), sunDir);
      label(ctx, L('Luna', 'Moon'), M.x + Math.max(4, R_MOON * sc) + 8, M.y + Math.max(4, R_MOON * sc) + 6, { size: fs, color: '#e1e5ee' });
      if (p >= 2 && p <= 3) {
        const mv = { x: -Math.sin(TH0 + t), y: Math.cos(TH0 + t) };
        const len = Math.max(26, R_MOON * sc * 2.2);
        const off = Math.max(6, R_MOON * sc * 1.3);
        const from = { x: M.x + mv.x * off, y: M.y - mv.y * off };
        arrowTo(ctx, from.x, from.y, mv.x * len, -mv.y * len, 'rgba(225,230,240,0.85)');
        if (p === 2) label(ctx, L('la Luna avanza ~1 km/s', 'the Moon moves at ~1 km/s'), from.x + mv.x * len + 10, from.y - mv.y * len, { size: fs - 1, color: '#d6dcec', weight: 500 });
      }

      // Cohete
      const s = stateAt(t), R = toS(s.x, s.y);
      const ang = Math.atan2(-s.vy, s.vx);
      const thrust = (t >= -0.02 && t <= 0.03) || (t < T_START + LAP * 0.7);
      if (p === 3) {
        // Gravedad de la Luna sobre la nave y velocidad de la nave
        const dx = m.x - s.x, dy = m.y - s.y, d = Math.hypot(dx, dy);
        const g = clamp(0.0016 / (d * d), 0.15, 1) * 70;
        arrowTo(ctx, R.x, R.y, (dx / d) * g, -(dy / d) * g, '#7fd8ff');
        arrowTo(ctx, R.x, R.y, s.vx * 34, -s.vy * 34, '#6be3b5');
        label(ctx, L('gravedad de la Luna', 'Moon’s gravity'), R.x + (dx / d) * g * 0.5 + 10, R.y - (dy / d) * g * 0.5 + 14, { size: fs, color: '#9fe2ff' });
        label(ctx, L('velocidad', 'velocity'), R.x + s.vx * 34 + 10, R.y - s.vy * 34, { size: fs, color: '#8ff0c8' });
      }
      ctx.save();
      ctx.translate(R.x, R.y);
      ctx.rotate(ang);
      drawRocket(ctx, thrust, clamp(sc / 420, 1, 2));
      ctx.restore();
      if (p === 1 && t <= 0.04) label(ctx, L('¡Encendido!', 'Ignition!'), R.x - 18, R.y + 26, { align: 'right', size: fs + 1, color: '#ffc857', weight: 700 });
      if (p === 4) label(ctx, L('hacia Marte →', 'towards Mars →'), R.x + 16, R.y - 18, { size: fs + 1, color: '#ffb48f', weight: 700 });

      // Datos
      const r = Math.hypot(s.x, s.y), dm = Math.hypot(s.x - m.x, s.y - m.y);
      const v2 = s.vx * s.vx + s.vy * s.vy;
      const E = v2 / 2 - 1 / r;
      daysOut.textContent = num(Math.max(0, t) * DAYS_PER_T, 1);
      distOut.textContent = r < 0.2 ? L('órbita baja', 'low orbit') : `≈ ${num(Math.round(r * KM / 1000) * 1000)} km`;
      moonOut.textContent = `≈ ${num(Math.round(dm * KM / 1000) * 1000)} km`;
      let pct;
      if (E < -0.8) pct = 40 * clamp((E + 4.3) / 3.5, 0, 1);
      else if (E < 0) pct = 40 + 40 * (E + 0.8) / 0.8;
      else pct = 80 + 20 * clamp(E / 0.2, 0, 1);
      escFill.style.width = `${pct}%`;
      const free = E >= 0;
      escOut.textContent = free ? L('¡Sí! Ya es libre', 'Yes! It’s free now') : (t < 0 ? L('No: está en órbita', 'No: it’s in orbit') : L('Todavía no: sin ayuda volvería', 'Not yet: on its own it would fall back'));
      escOut.classList.toggle('free', free);
      updatePart();
    }

    runWhenVisible(canvas, (dt) => {
      if (playing) {
        const P = PARTS[partAt(t)];
        t += ((P.to - P.from) / P.secs) * dt;
        if (t >= T_END) { t = T_END; playing = false; updatePlay(); }
      }
      const target = camTarget();
      const k = 1 - Math.exp(-dt * 2.4);
      cam.x += (target.x - cam.x) * k; cam.y += (target.y - cam.y) * k; cam.h += (target.h - cam.h) * k;
      draw();
    });
    onLang.push(() => { part = -1; updatePlay(); draw(); });
    updatePlay();
    draw();
  })();

  /* ---------- La nave gira sobre sí misma ---------- */
  (function spinDemo() {
    const probe = $('#probe');
    if (!probe) return;
    const line = $('#spin-line'), caption = $('#spin-caption');
    const btns = $$('[data-aim]');
    const C = { x: 200, y: 150 };
    // Objetivo de cada aparato (coordenadas del esquema) y hacia dónde mira ese aparato con la nave sin girar
    const TARGETS = { camera: ['mars', 352, 150], antenna: ['earth', 58, 246], panels: ['sun', 64, 52], engine: ['thrust', 337, 28] };
    const PART = { camera: 0, antenna: -90, panels: 90, engine: 180 };
    const TEXT = {
      camera: ['La cámara mira a Marte: lista para hacer fotos.', 'The camera faces Mars: ready to take photos.'],
      antenna: ['La antena apunta a la Tierra: lista para enviar datos.', 'The antenna points at Earth: ready to send data.'],
      panels: ['Los paneles miran al Sol: cargando las baterías.', 'The solar panels face the Sun: charging the batteries.'],
      engine: ['El motor apunta en el sentido de la marcha: al encenderlo, la nave frena.', 'The engine points in the direction of travel: firing it slows the spacecraft down.'],
    };
    let rot = 0, current = null, timer = 0;
    function aim(key) {
      const [tgt, tx, ty] = TARGETS[key];
      const want = Math.atan2(ty - C.y, tx - C.x) * 180 / Math.PI - PART[key];
      rot += ((want - rot) % 360 + 540) % 360 - 180; // giro más corto
      probe.style.transform = `rotate(${rot}deg)`;
      probe.classList.add('turning');
      probe.classList.remove('burn');
      clearTimeout(timer);
      timer = setTimeout(() => { probe.classList.remove('turning'); if (key === 'engine') probe.classList.add('burn'); }, reduceMotion ? 0 : 1300);
      line.setAttribute('x2', tx); line.setAttribute('y2', ty); line.classList.add('on');
      $$('.tgt').forEach((g) => g.classList.toggle('on', g.dataset.tgt === tgt));
      btns.forEach((b) => b.classList.toggle('on', b.dataset.aim === key));
      current = key;
      caption.textContent = L(...TEXT[key]);
    }
    btns.forEach((b) => b.addEventListener('click', () => aim(b.dataset.aim)));
    onLang.push(() => {
      caption.textContent = current ? L(...TEXT[current]) : L('Elige qué quieres apuntar.', 'Choose what you want to point.');
    });
  })();

  /* ---------- Estación en órbita de Marte, junto a Fobos ---------- */
  (function marsStation() {
    const canvas = $('#station');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw(0));
    let t = 0;
    marsImg.addEventListener('load', () => draw(0));

    function drawPhobos(ctx, x, y, r) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(0.5);
      const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r * 1.3);
      g.addColorStop(0, '#c4b3a4'); g.addColorStop(0.6, '#7a6555'); g.addColorStop(1, '#3b2f27');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(40,30,25,0.55)';
      [[-0.4, -0.2, 0.28], [0.45, 0.25, 0.18], [0.1, 0.45, 0.12]].forEach(([a, b, c]) => {
        ctx.beginPath(); ctx.arc(a * r, b * r, c * r, 0, TAU); ctx.fill();
      });
      ctx.restore();
    }

    function drawStation(ctx, x, y, s, ang) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
      ctx.strokeStyle = '#aab3c8'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
      ctx.fillStyle = '#2b5cb8'; ctx.strokeStyle = '#9fc2ff'; ctx.lineWidth = 0.8;
      [[-25, -8], [13, -8]].forEach(([px, py]) => { ctx.fillRect(px, py, 12, 16); ctx.strokeRect(px, py, 12, 16); });
      ctx.fillStyle = '#e3e8f2';
      ctx.fillRect(-9, -3.5, 18, 7);
      ctx.fillRect(-3.5, -9, 7, 18);
      ctx.fillStyle = '#ff9a6b';
      ctx.beginPath(); ctx.arc(0, -10, 2.2, 0, TAU); ctx.fill(); // puerto de atraque
      ctx.restore();
    }

    function draw(dt) {
      t += dt;
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      const fs = w < 420 ? 11 : 12;
      const R = Math.min(w, h) * 0.21;
      const cx = w * 0.42, cy = h * 0.55;
      const oa = Math.min(R * 2.6, w * 0.5), ob = oa * 0.32;   // órbita de Fobos vista en perspectiva
      const angP = t * 0.28 + 0.6, angS = angP + 0.38;        // Fobos y la estación, muy juntos
      const P = { x: cx + oa * Math.cos(angP), y: cy + ob * Math.sin(angP) };
      const St = { x: cx + oa * Math.cos(angS), y: cy + ob * Math.sin(angS) };
      const behind = (a) => Math.sin(a) < 0;
      const sun = { x: cx - R * 6, y: cy - R * 2 };

      const orbitHalf = (front) => {
        ctx.save();
        ctx.strokeStyle = 'rgba(210,200,190,0.3)'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(cx, cy, oa, ob, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
        ctx.restore();
      };
      const drawSat = () => {
        drawPhobos(ctx, P.x, P.y, Math.max(7, R * 0.11));
        drawGlow(ctx, St.x, St.y, 26, '127,216,255', 0.25);
        drawStation(ctx, St.x, St.y, Math.max(0.85, R / 80), Math.sin(t * 0.3) * 0.2);
      };

      orbitHalf(false);
      if (behind(angP)) drawSat();

      // Marte
      drawGlow(ctx, cx, cy, R * 1.6, '255,90,50', 0.3);
      const ag = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.08);
      ag.addColorStop(0, 'rgba(255,170,120,0.4)'); ag.addColorStop(1, 'rgba(255,140,90,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, TAU); ctx.fill();
      drawMarsPhoto(ctx, cx, cy, R, sun);
      label(ctx, L('Marte', 'Mars'), cx - R * 0.95, cy + R * 0.95, { size: fs, color: '#ffc2a6' });

      // Rover en la superficie: sus datos suben a la estación y de ahí van a la Tierra
      const rover = { x: cx - R * 0.25, y: cy + R * 0.45 };
      ctx.fillStyle = '#6be3b5';
      ctx.beginPath(); ctx.arc(rover.x, rover.y, 3, 0, TAU); ctx.fill();
      label(ctx, L('rover', 'rover'), rover.x - 8, rover.y + 14, { align: 'right', size: fs - 1, color: '#8ff0c8', weight: 500 });
      const earthDir = { x: w - 18, y: 18 };
      const linkOk = !behind(angS);
      if (linkOk) {
        const now = performance.now() / 1000;
        ctx.save();
        ctx.strokeStyle = 'rgba(127,216,255,0.35)'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(rover.x, rover.y); ctx.lineTo(St.x, St.y); ctx.lineTo(earthDir.x, earthDir.y); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#7fd8ff';
        for (let k = 0; k < 3; k++) {
          const q = (now * 0.5 + k / 3) % 1;
          const a = q < 0.5 ? mix(rover, St, q * 2) : mix(St, earthDir, (q - 0.5) * 2);
          ctx.beginPath(); ctx.arc(a.x, a.y, 2.4, 0, TAU); ctx.fill();
        }
        ctx.restore();
        label(ctx, L('datos → Tierra', 'data → Earth'), earthDir.x - 4, earthDir.y + 16, { align: 'right', size: fs - 1, color: '#9fe2ff', weight: 500 });
      }

      orbitHalf(true);
      if (!behind(angP)) drawSat();
      label(ctx, L('Fobos', 'Phobos'), P.x, P.y + Math.max(7, R * 0.11) + 14, { align: 'center', size: fs - 1, color: '#d8c8bb', weight: 500 });
      label(ctx, L('Estación', 'Station'), St.x, St.y - 26, { align: 'center', size: fs, color: '#cfe5ff' });

      // Nave de suministros que llega, reposta y se va (ciclo de 12 s)
      const ph = (t % 12) / 12;
      const dock = { x: St.x, y: St.y - 16 };
      const far = { x: w + 40, y: h * 0.12 };
      let ship = null, ang = 0;
      if (ph < 0.4) { const q = smooth(ph / 0.4); ship = mix(far, dock, q); ang = Math.atan2(dock.y - far.y, dock.x - far.x); }
      else if (ph < 0.7) { ship = dock; ang = Math.PI / 2; label(ctx, L('⛽ repostando', '⛽ refuelling'), dock.x + 16, dock.y - 10, { size: fs - 1, color: '#ffd27a', weight: 600 }); }
      else { const q = smooth((ph - 0.7) / 0.3); ship = mix(dock, far, q); ang = Math.atan2(far.y - dock.y, far.x - dock.x); }
      if (ship.x < w + 20) {
        ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ang);
        drawRocket(ctx, ph < 0.4 || ph > 0.7, 0.9);
        ctx.restore();
      }
    }

    runWhenVisible(canvas, (dt) => draw(reduceMotion ? 0 : dt));
    onLang.push(() => draw(0));
  })();

  /* ---------- Simulador de gravedad: una pelota de tenis en la Tierra, la Luna y Marte ---------- */
  (function gravitySim() {
    const canvas = $('#gsim');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());

    // g en m/s², R en m, velocidades de órbita y escape en m/s (datos de la sección)
    const BODIES = {
      earth: { g: 9.81, R: 6371e3, vo: 7900, ve: 11200, color: '#4ea3ff', name: ['Tierra', 'Earth'] },
      mars: { g: 3.71, R: 3390e3, vo: 3550, ve: 5030, color: '#ff7a45', name: ['Marte', 'Mars'] },
      moon: { g: 1.62, R: 1737e3, vo: 1680, ve: 2380, color: '#d9dde6', name: ['Luna', 'Moon'] },
    };
    const ORDER = ['earth', 'mars', 'moon'];
    const GROUND_MAX = 1000;                // hasta aquí, vista de suelo plano
    const V_MIN = 1, V_MAX = 13000;         // deslizador logarítmico
    const sToV = (s) => V_MIN * Math.pow(V_MAX / V_MIN, s / 1000);
    const vToS = (v) => Math.round(1000 * Math.log(v / V_MIN) / Math.log(V_MAX / V_MIN));
    const STATE = {
      fall: ['Vuelve a caer, más lejos, siguiendo la curva del astro', 'Falls back down, further away, following the curve of the body'],
      circle: ['En órbita: da vueltas sin caer', 'In orbit: it keeps circling without falling'],
      ellipse: ['Órbita alargada (elipse)', 'Stretched orbit (ellipse)'],
      escape: ['Escapa: se va y no vuelve', 'Escapes: it leaves and never comes back'],
    };

    const speedIn = $('#gs-speed'), angleIn = $('#gs-angle'), speedOut = $('#gs-speed-out'), angleOut = $('#gs-angle-out');
    const modeOut = $('#gs-mode'), speedupOut = $('#gs-speedup'), results = $('#gs-results');
    const bodyBtns = $$('[data-body]'), quickBtns = $$('[data-quick]');

    let sel = 'all', speedMode = 'custom', vCustom = 20, angle = 45;
    let runs = [], groundFactor = 1, lastResults = '';

    const keys = () => (sel === 'all' ? ORDER : [sel]);
    const speedFor = (k) => (speedMode === 'orbit' ? BODIES[k].vo : speedMode === 'escape' ? BODIES[k].ve : vCustom);
    const fmtSpeed = (v) => (v < 1000 ? `${num(Math.round(v))} m/s` : `${num(v / 1000, 2)} km/s`);
    const fmtDist = (m) => (m < 10 ? `${num(m, 1)} m` : m < 1000 ? `${num(Math.round(m))} m` : `${num(m / 1000, m < 1e5 ? 1 : 0)} km`);
    const fmtTime = (s) => (s < 120 ? `${num(s, 1)} s` : s < 7200 ? `${num(s / 60, 1)} min` : `${num(s / 3600, 1)} h`);
    const niceNum = (f) => {
      const p = Math.pow(10, Math.floor(Math.log10(f))), m = f / p;
      return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    };

    function makeRun(k, launched) {
      const B = BODIES[k], v = speedFor(k), th = angle * Math.PI / 180;
      if (v <= GROUND_MAX) {
        // Tiro parabólico sin aire: distancia = v²·sin(2θ)/g ; altura = v²·sin²(θ)/(2g) ; tiempo = 2·v·sin(θ)/g
        const vx = v * Math.cos(th), vy = v * Math.sin(th);
        const T = 2 * vy / B.g;
        return { k, v, mode: 'ground', vx, vy, g: B.g, T, D: vx * T, H: vy * vy / (2 * B.g), t: 0, launched, done: T <= 0 };
      }
      // Vista del astro entero, en unidades del astro: radio = 1, g en la superficie = 1
      // Con los botones rápidos se usa la velocidad exacta de cada astro (+0,2 % para no rozar el suelo por redondeo)
      const u = speedMode === 'orbit' ? 1.002 : speedMode === 'escape' ? Math.SQRT2 * 1.002 : v / Math.sqrt(B.g * B.R);
      const T0 = Math.sqrt(B.R / B.g);                // segundos reales por unidad de tiempo
      const E = u * u / 2 - 1, hh = u * Math.cos(th);
      let state, viewR;
      if (E >= 0) { state = 'escape'; viewR = 3.2; }
      else {
        const a = -1 / (2 * E), e = Math.sqrt(Math.max(0, 1 + 2 * E * hh * hh));
        const rp = a * (1 - e), ra = a * (1 + e);
        state = rp < 0.9998 ? 'fall' : (e < 0.03 ? 'circle' : 'ellipse');
        viewR = clamp(ra * 1.12, 1.3, 6);
      }
      const factor = niceNum((TAU / 6) * T0);         // una órbita baja ≈ 6 s de animación
      return {
        k, v, mode: 'orbit', p: { x: 0, y: 1 }, vel: { x: u * Math.cos(th), y: u * Math.sin(th) }, t: 0, T0, factor,
        rate: factor / T0, state, viewR, rmax: 1, trail: [{ x: 0, y: 1 }], launched, done: false, landedArc: null,
      };
    }

    function rebuild(launched) {
      runs = keys().map((k) => makeRun(k, launched));
      const tMax = Math.max(0, ...runs.filter((r) => r.mode === 'ground').map((r) => r.T));
      groundFactor = tMax <= 20 ? 1 : niceNum(tMax / 8);
      lastResults = '';
      draw();
    }

    // Integración paso a paso con Velocity Verlet: a = -g·R²/r² (en unidades del astro, a = -1/r²)
    const accel = (p) => { const r = Math.hypot(p.x, p.y), k = -1 / (r * r * r); return { x: p.x * k, y: p.y * k }; };
    function stepOrbit(r, dtReal) {
      let left = dtReal * r.rate, n = 0;
      const h = 0.002;
      while (left > 1e-9 && !r.done && n < 6000) {
        const dt = Math.min(h, left); left -= dt; n++;
        const a1 = accel(r.p);
        r.p.x += r.vel.x * dt + 0.5 * a1.x * dt * dt;
        r.p.y += r.vel.y * dt + 0.5 * a1.y * dt * dt;
        const a2 = accel(r.p);
        r.vel.x += 0.5 * (a1.x + a2.x) * dt;
        r.vel.y += 0.5 * (a1.y + a2.y) * dt;
        r.t += dt;
        const rr = Math.hypot(r.p.x, r.p.y);
        r.rmax = Math.max(r.rmax, rr);
        if (r.t > 0.001 && rr < 0.9998) {
          // Toca el suelo: distancia recorrida sobre la superficie
          r.p.x /= rr; r.p.y /= rr;
          let ang = Math.atan2(r.p.x, r.p.y);
          if (ang < 0) ang += TAU;
          r.landedArc = ang * BODIES[r.k].R;
          r.done = true;
        } else if (rr > r.viewR * 1.7) {
          r.done = true;
        }
      }
      r.trail.push({ x: r.p.x, y: r.p.y });
      if (r.trail.length > 1600) r.trail.shift();
    }

    function drawBall(ctx, x, y, rad = 5) {
      drawGlow(ctx, x, y, rad * 3, '216,240,74', 0.35);
      ctx.fillStyle = '#d8f04a';
      ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x - rad * 0.9, y, rad * 0.75, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + rad * 0.9, y, rad * 0.75, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    }

    function drawGround(ctx, w, h) {
      const fs = w < 420 ? 11 : 12;
      const pad = { l: 40, r: 18, t: 26, b: 40 };
      const Dm = Math.max(1, ...runs.map((r) => r.D)), Hm = Math.max(1, ...runs.map((r) => r.H));
      const W = w - pad.l - pad.r, Hh = h - pad.t - pad.b;
      const sc = Math.min(W / (Dm * 1.06), Hh / (Hm * 1.18));
      const X = (x) => pad.l + x * sc, Y = (y) => h - pad.b - y * sc;

      // Suelo y escala de distancias
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(0, Y(0), w, h - Y(0));
      ctx.strokeStyle = 'rgba(200,210,230,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke();
      const span = W / sc, step = niceNum(span / (w < 420 ? 3.5 : 6));
      for (let x = 0; x <= span + 1e-9; x += step) {
        ctx.strokeStyle = 'rgba(200,210,230,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(0) + 6); ctx.stroke();
        label(ctx, fmtDist(x), X(x), Y(0) + 18, { align: 'center', size: fs - 1, color: '#9aa4bf', weight: 500 });
      }
      label(ctx, '🙋', X(0) - 16, Y(0) - 12, { size: 18 });

      runs.forEach((r, i) => {
        const B = BODIES[r.k];
        const t = r.launched ? r.t : 0;
        // Altura máxima
        if (r.launched && t >= r.T / 2 && r.H > 0) {
          ctx.save(); ctx.strokeStyle = B.color; ctx.globalAlpha = 0.35; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X(0), Y(r.H)); ctx.lineTo(X(r.vx * r.T / 2), Y(r.H)); ctx.stroke(); ctx.restore();
        }
        // Trayectoria
        ctx.save();
        ctx.strokeStyle = B.color; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.shadowColor = B.color; ctx.shadowBlur = 6;
        ctx.beginPath();
        const nPts = 90;
        for (let j = 0; j <= nPts; j++) {
          const s = t * j / nPts;
          const x = X(r.vx * s), y = Y(r.vy * s - 0.5 * r.g * s * s);
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.restore();
        const bx = X(r.vx * t), by = Y(Math.max(0, r.vy * t - 0.5 * r.g * t * t));
        drawBall(ctx, bx, by, w < 420 ? 4.5 : 5.5);
        if (r.done && r.launched) {
          label(ctx, `${L(...B.name)}: ${fmtDist(r.D)}`, Math.min(bx, w - 8), Y(0) - 14 - i * 16, { align: bx > w - 90 ? 'right' : 'center', size: fs, color: B.color, weight: 700 });
        }
      });
    }

    function drawPlanet(ctx, k, x, y, R) {
      const sun = { x: x - R * 6, y: y - R * 3 };
      if (k === 'mars') return drawMarsPhoto(ctx, x, y, R, sun);
      if (k === 'earth') {
        drawGlow(ctx, x, y, R * 1.25, '78,163,255', 0.35);
        drawEarth(ctx, x, y, R, sun);
        return null;
      }
      drawMoon(ctx, x, y, R, sun);
      return null;
    }

    function drawOrbitView(ctx, w, h) {
      const fs = w < 420 ? 10 : 12;
      const n = runs.length, pw = w / n;
      runs.forEach((r, i) => {
        const B = BODIES[r.k];
        const cx = pw * i + pw / 2, cy = h / 2 + 10;
        const sc = Math.min(pw, h - 44) / (2 * r.viewR) * 0.95;
        ctx.save();
        ctx.beginPath(); ctx.rect(pw * i, 0, pw, h); ctx.clip();
        if (i > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(pw * i, 10); ctx.lineTo(pw * i, h - 10); ctx.stroke();
        }
        drawPlanet(ctx, r.k, cx, cy, sc);
        // Estela
        ctx.strokeStyle = '#d8f04a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(216,240,74,0.7)'; ctx.shadowBlur = 5;
        ctx.beginPath();
        r.trail.forEach((p, j) => { const x = cx + p.x * sc, y = cy - p.y * sc; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Punto de lanzamiento
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx, cy - sc, 2.5, 0, TAU); ctx.fill();
        drawBall(ctx, cx + r.p.x * sc, cy - r.p.y * sc, n > 1 ? 3.6 : 5);
        ctx.restore();
        label(ctx, L(...B.name), cx, 14, { align: 'center', size: fs + 1, color: B.color, weight: 700 });
        label(ctx, `x${num(r.factor)}`, cx, 30, { align: 'center', size: fs - 1, color: '#9fe2ff', weight: 600 });
      });
    }

    function updateText() {
      const mode = runs[0] ? runs[0].mode : 'ground';
      modeOut.textContent = mode === 'ground' ? L('Vista: suelo plano', 'View: flat ground') : L('Vista: astro entero', 'View: whole body');
      if (mode === 'ground') {
        speedupOut.textContent = groundFactor === 1 ? L('Tiempo real (x1)', 'Real time (x1)') : L(`Tiempo acelerado x${num(groundFactor)}`, `Time sped up x${num(groundFactor)}`);
      } else {
        speedupOut.textContent = runs.length === 1 ? L(`Tiempo acelerado x${num(runs[0].factor)}`, `Time sped up x${num(runs[0].factor)}`)
          : L('Tiempo acelerado (factor en cada astro)', 'Time sped up (factor on each body)');
      }
      const html = runs.map((r) => {
        const B = BODIES[r.k];
        const name = `<span class="gs-name"><i class="g-dot ${r.k}"></i>${L(...B.name)}</span>`;
        if (r.mode === 'ground') {
          const t = r.launched ? r.t : 0;
          const x = r.done && r.launched ? r.D : r.vx * t;
          const hNow = t >= r.T / 2 ? r.H : r.vy * t - 0.5 * r.g * t * t;
          const tt = r.done && r.launched ? r.T : t;
          return `<div class="gs-row">${name}<span>${L('Distancia', 'Distance')} <b>${fmtDist(x)}</b></span>` +
            `<span>${L('Altura máx.', 'Max height')} <b>${fmtDist(Math.max(0, hNow))}</b></span>` +
            `<span>${L('Tiempo en el aire', 'Time in the air')} <b>${fmtTime(tt)}</b></span></div>`;
        }
        const extra = r.landedArc !== null ? `<span>${L('Cae a', 'Lands')} <b>${fmtDist(r.landedArc)}</b> ${L('del lanzamiento', 'from launch')}</span>` : '';
        return `<div class="gs-row">${name}<span>${L('Velocidad', 'Speed')} <b>${fmtSpeed(r.v)}</b></span>` +
          `<span class="gs-state">${L(...STATE[r.state])}</span>` +
          `<span>${L('Altura máx.', 'Max height')} <b>${fmtDist((r.rmax - 1) * B.R)}</b></span>` +
          `<span>${L('Tiempo', 'Time')} <b>${fmtTime(r.t * r.T0)}</b></span>${extra}</div>`;
      }).join('');
      if (html !== lastResults) { results.innerHTML = html; lastResults = html; }
    }

    function draw() {
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      if (!runs.length) return;
      if (runs[0].mode === 'ground') drawGround(ctx, w, h); else drawOrbitView(ctx, w, h);
      updateText();
    }

    function syncControls() {
      angleIn.value = angle;
      angleOut.textContent = `${angle}°`;
      if (speedMode === 'custom') { speedIn.value = vToS(vCustom); speedOut.textContent = fmtSpeed(vCustom); }
      else if (sel === 'all') speedOut.textContent = speedMode === 'orbit' ? L('la de órbita de cada astro', 'each body’s orbital speed') : L('la de escape de cada astro', 'each body’s escape speed');
      else { const v = speedFor(sel); speedIn.value = vToS(v); speedOut.textContent = fmtSpeed(v); }
      quickBtns.forEach((b) => b.classList.toggle('on', (b.dataset.quick === 'human' && speedMode === 'custom' && vCustom === 20 && angle === 45) || b.dataset.quick === speedMode));
      bodyBtns.forEach((b) => b.classList.toggle('on', b.dataset.body === sel));
    }

    speedIn.addEventListener('input', () => {
      speedMode = 'custom';
      const v = sToV(Number(speedIn.value));
      vCustom = v < 100 ? Math.round(v) : v < 1000 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10;
      syncControls(); rebuild(false);
    });
    angleIn.addEventListener('input', () => { angle = Number(angleIn.value); syncControls(); rebuild(false); });
    bodyBtns.forEach((b) => b.addEventListener('click', () => { sel = b.dataset.body; syncControls(); rebuild(false); }));
    $('#gs-launch').addEventListener('click', () => rebuild(true));
    $('#gs-reset').addEventListener('click', () => rebuild(false));
    quickBtns.forEach((b) => b.addEventListener('click', () => {
      const q = b.dataset.quick;
      if (q === 'human') { speedMode = 'custom'; vCustom = 20; angle = 45; }
      else { speedMode = q; if (q === 'orbit') angle = 0; }
      syncControls(); rebuild(true);
    }));

    runWhenVisible(canvas, (dt) => {
      runs.forEach((r) => {
        if (!r.launched || r.done) return;
        if (r.mode === 'ground') { r.t = Math.min(r.T, r.t + dt * groundFactor); if (r.t >= r.T) r.done = true; }
        else stepOrbit(r, dt);
      });
      draw();
    });
    onLang.push(() => { lastResults = ''; syncControls(); draw(); });
    syncControls();
    rebuild(!reduceMotion);
  })();

  /* ---------- Reto lunar: lanza la pelota y usa el efecto honda de la Luna ---------- */
  (function moonChallenge() {
    const canvas = $('#moongame');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());

    // Unidades: distancia Tierra–Luna = 1; gravedad de la Tierra GM = 1; la Luna da una vuelta cada 2π
    const MU = 0.05;                     // gravedad de la Luna (exagerada para que el reto sea jugable)
    const R_EARTH = 0.07, R_MOON = 0.03, ZONE = 0.2;
    const V_MIN = 4.9, V_MAX = 5.5;      // rango de la "fuerza"
    const T_MAX = 6, DAYS_PER_T = 27.32 / TAU;
    const START = { x: 0, y: R_EARTH };  // la pelota sale de lo alto de la Tierra
    const MSG = {
      earth: ['La pelota volvió a caer a la Tierra.', 'The ball fell back to Earth.', 'Prueba con más fuerza.', 'Try more strength.'],
      moonhit: ['💥 ¡Choque contra la Luna!', '💥 It crashed into the Moon!', 'Casi: apunta un poco más por detrás de ella.', 'Close: aim a little more behind it.'],
      escape: ['Se fue al espacio sin pasar por la Luna.', 'It flew off into space without passing the Moon.', 'Apunta a donde estará la Luna y usa menos fuerza.', 'Aim at where the Moon will be and use less strength.'],
      bound: ['Se quedó dando vueltas a la Tierra sin llegar a la Luna.', 'It kept circling the Earth without reaching the Moon.', 'Ajusta la dirección para cruzarte con la Luna.', 'Adjust the direction to meet the Moon.'],
      reachEsc: ['Pasó por la Luna, pero ya iba tan rápida que habría escapado igualmente.', 'It passed the Moon, but it was already fast enough to escape on its own.', 'Para el efecto honda de verdad, lánzala con menos fuerza.', 'For a real slingshot, launch it with less strength.'],
      reach: ['¡Llegó a la Luna! Su gravedad la desvió, pero no lo bastante para escapar.', 'It reached the Moon! Its gravity bent the path, but not enough to escape.', 'Pasa más cerca y por detrás de la Luna.', 'Pass closer to the Moon, and behind it.'],
      capture: ['🌙 ¡Atrapada en órbita de la Luna!', '🌙 Caught in orbit around the Moon!', 'La gravedad lunar la ha retenido un buen rato.', 'The Moon’s gravity held on to it for a good while.'],
      sling: ['🚀 ¡Efecto honda! La Luna la ha lanzado fuera de la Tierra, rumbo a Marte, como el cohete.', '🚀 Slingshot! The Moon has flung it away from Earth, towards Mars, just like the rocket.', 'Antes de la Luna no podía escapar; después, sí.', 'Before the Moon it could not escape; afterwards, it could.'],
    };

    const angleIn = $('#mg-angle'), powerIn = $('#mg-power'), angleOut = $('#mg-angle-out'), powerOut = $('#mg-power-out');
    const resultOut = $('#mg-result'), easyIn = $('#mg-easy');
    const goals = [$('#mg-g1'), $('#mg-g2'), $('#mg-g3'), $('#mg-g4')];

    let th0 = -Math.PI / 6;             // posición inicial de la Luna
    let angle = 60, power = 0.5;
    let preview = null, flight = null, playT = 0, dragging = false, lastMsg = null;
    const best = [false, false, false, false];

    const moonAt = (t) => ({ x: Math.cos(th0 + t), y: Math.sin(th0 + t) });
    const speed = () => V_MIN + (V_MAX - V_MIN) * power;

    // Simulación con gravedad de la Tierra y de la Luna en movimiento (Velocity Verlet)
    function simulate(tEnd, dt) {
      const th = angle * Math.PI / 180, v = speed();
      let x = START.x, y = START.y, vx = v * Math.cos(th), vy = v * Math.sin(th), t = 0;
      const acc = (px, py, tt) => {
        const r3 = Math.pow(px * px + py * py, 1.5);
        const m = moonAt(tt), dx = px - m.x, dy = py - m.y, d3 = Math.pow(dx * dx + dy * dy, 1.5);
        return [-px / r3 - MU * dx / d3, -py / r3 - MU * dy / d3];
      };
      const pts = [{ x, y, t }];
      const res = { pts, outcome: 'bound', tEvent: tEnd, reached: false, tReach: null, Ein: null, Eout: null, dMin: 9, tMin: 0, zoneTime: 0 };
      let [ax, ay] = acc(x, y, t), n = 0;
      while (t < tEnd) {
        x += vx * dt + 0.5 * ax * dt * dt; y += vy * dt + 0.5 * ay * dt * dt;
        const [bx, by] = acc(x, y, t + dt);
        vx += 0.5 * (ax + bx) * dt; vy += 0.5 * (ay + by) * dt;
        ax = bx; ay = by; t += dt; n++;
        const r = Math.hypot(x, y), m = moonAt(t), d = Math.hypot(x - m.x, y - m.y);
        const E = 0.5 * (vx * vx + vy * vy) - 1 / r;
        if (n % 4 === 0) pts.push({ x, y, t });
        if (d < res.dMin) { res.dMin = d; res.tMin = t; }
        if (d < 0.25) res.zoneTime += dt;
        if (!res.reached && d < ZONE) { res.reached = true; res.tReach = t; res.Ein = E; }
        if (res.reached && res.Eout === null && d > ZONE * 1.6) res.Eout = E;
        if (r < R_EARTH && t > 0.02) { res.outcome = 'earth'; res.tEvent = t; break; }
        if (d < R_MOON) { res.outcome = 'moonhit'; res.tEvent = t; break; }
        if (r > 2.6) {
          res.Eout = res.Eout === null ? E : res.Eout;
          res.outcome = !res.reached ? 'escape' : (res.Ein < 0 && E >= 0 ? 'sling' : 'reachEsc');
          res.tEvent = t; break;
        }
      }
      pts.push({ x, y, t });
      if (res.outcome === 'bound' && res.reached) res.outcome = res.zoneTime > 1.2 ? 'capture' : 'reach';
      if (res.outcome === 'bound' && res.zoneTime > 1.2) res.outcome = 'capture';
      res.gain = res.reached && res.Eout !== null && res.Ein !== null && res.Eout - res.Ein > 0.12;
      return res;
    }

    function updatePreview() {
      preview = simulate(easyIn.checked ? T_MAX : 0.5, 0.001); // mismo paso que el lanzamiento real
      draw();
    }

    function syncControls() {
      angleIn.value = angle; powerIn.value = Math.round(power * 1000);
      angleOut.textContent = `${num(angle, angle % 1 ? 1 : 0)}°`;
      powerOut.textContent = `${num(power * 100, 1)} %`;
    }

    function showResult() {
      if (!flight) { resultOut.className = 'game-result'; resultOut.innerHTML = L('Arrastra desde la pelota (o usa los deslizadores) y pulsa «Lanzar».', 'Drag from the ball (or use the sliders) and press “Launch”.'); return; }
      if (playT < Math.min(flight.tEvent, T_MAX) - 1e-6) {
        resultOut.className = 'game-result';
        resultOut.innerHTML = L(`En vuelo… día ${num(playT * DAYS_PER_T, 1)}`, `In flight… day ${num(playT * DAYS_PER_T, 1)}`);
        return;
      }
      const m = MSG[flight.outcome];
      const win = ['sling', 'capture'].includes(flight.outcome) || flight.reached;
      resultOut.className = `game-result ${win ? 'win' : 'fail'}`;
      resultOut.innerHTML = `${L(m[0], m[1])}<span class="sub">${L(m[2], m[3])}</span>`;
    }

    function award() {
      const got = [flight.reached, flight.gain, flight.outcome === 'sling', flight.outcome === 'capture'];
      got.forEach((g, i) => { if (g) best[i] = true; });
      goals.forEach((li, i) => li.classList.toggle('got', best[i]));
    }

    // Dibujo
    const view = () => {
      const { w, h } = S;
      // Vista ampliada: la Tierra a la izquierda y la órbita de la Luna llenando el dibujo
      const narrow = w < 500;
      const sc = Math.min(w / (narrow ? 2.15 : 2.75), h / 2.35);
      const cx = narrow ? 0.62 : 0.55;
      return { sc, toS: (p) => ({ x: w / 2 + (p.x - cx) * sc, y: h / 2 - (p.y - 0.08) * sc }) };
    };

    function drawPath(ctx, pts, toS, upTo, style) {
      ctx.save();
      Object.assign(ctx, style.ctx);
      if (style.dash) ctx.setLineDash(style.dash);
      ctx.beginPath();
      let first = true;
      for (const p of pts) {
        if (p.t > upTo) break;
        const q = toS(p);
        if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      const { sc, toS } = view();
      const fs = w < 420 ? 11 : 12;
      const t = flight ? playT : 0;
      const E = toS({ x: 0, y: 0 });

      drawOrbit(ctx, E.x, E.y, sc, 'rgba(210,215,230,0.22)', [3, 6]);
      // Tierra
      drawGlow(ctx, E.x, E.y, R_EARTH * sc * 2.6, '78,163,255', 0.3);
      drawEarth(ctx, E.x, E.y, R_EARTH * sc);
      label(ctx, L('Tierra', 'Earth'), E.x, E.y + R_EARTH * sc + 14, { align: 'center', size: fs, color: '#cfe5ff' });

      // Vista previa (antes de lanzar)
      if (!flight && preview) {
        const ok = preview.reached;
        drawPath(ctx, preview.pts, toS, Infinity, { ctx: { strokeStyle: ok ? 'rgba(143,240,200,0.85)' : 'rgba(216,240,74,0.7)', lineWidth: 2 }, dash: [3, 6] });
        if (easyIn.checked && preview.dMin < 0.6) {
          // Dónde estará la Luna cuando la pelota pase más cerca
          const gm = toS(moonAt(preview.tMin));
          ctx.save(); ctx.globalAlpha = 0.45;
          drawMoon(ctx, gm.x, gm.y, Math.max(4, R_MOON * sc));
          ctx.restore();
          label(ctx, L('aquí estará la Luna', 'the Moon will be here'), gm.x, gm.y - Math.max(4, R_MOON * sc) - 12, { align: 'center', size: fs - 1, color: 'rgba(220,226,240,0.8)', weight: 500 });
        }
      }

      // Luna y su zona de alcance
      const mPos = moonAt(t), M = toS(mPos);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
      ctx.save();
      ctx.strokeStyle = 'rgba(143,240,200,0.55)'; ctx.globalAlpha = 0.5 + 0.4 * pulse; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(M.x, M.y, ZONE * sc, 0, TAU); ctx.stroke();
      ctx.restore();
      drawGlow(ctx, M.x, M.y, R_MOON * sc * 3, '200,210,235', 0.2);
      drawMoon(ctx, M.x, M.y, Math.max(5, R_MOON * sc));
      label(ctx, L('Luna', 'Moon'), M.x, M.y + Math.max(5, R_MOON * sc) + 14, { align: 'center', size: fs, color: '#e1e5ee' });
      const mv = { x: -Math.sin(th0 + t), y: Math.cos(th0 + t) };
      const a0 = { x: M.x + mv.x * (R_MOON * sc + 8), y: M.y - mv.y * (R_MOON * sc + 8) };
      ctx.save(); ctx.strokeStyle = 'rgba(225,230,240,0.8)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a0.x + mv.x * 22, a0.y - mv.y * 22); ctx.stroke(); ctx.restore();

      // Vuelo
      let ball = START;
      if (flight) {
        drawPath(ctx, flight.pts, toS, t, { ctx: { strokeStyle: '#d8f04a', lineWidth: 2.4, lineCap: 'round', lineJoin: 'round', shadowColor: 'rgba(216,240,74,0.7)', shadowBlur: 6 } });
        const pts = flight.pts;
        let i = 0;
        while (i < pts.length - 1 && pts[i + 1].t <= t) i++;
        ball = pts[i];
        const done = t >= Math.min(flight.tEvent, T_MAX) - 1e-6;
        if (flight.reached && t > flight.tMin) {
          // Dónde estaba la Luna cuando la pelota pasó más cerca: ahí ocurrió el efecto honda
          const gm = toS(moonAt(flight.tMin));
          ctx.save(); ctx.globalAlpha = 0.4;
          drawMoon(ctx, gm.x, gm.y, Math.max(4, R_MOON * sc));
          ctx.restore();
          label(ctx, L('aquí pasó junto a la Luna', 'it passed the Moon here'), gm.x, gm.y + Math.max(4, R_MOON * sc) + 13, { align: 'center', size: fs - 1, color: '#8ff0c8', weight: 600 });
        }
        if (done && flight.outcome === 'sling') {
          const q = toS(ball);
          label(ctx, L('→ rumbo a Marte', '→ heading for Mars'), Math.min(q.x, w - 8), Math.max(16, Math.min(h - 16, q.y)), { align: 'right', size: fs + 1, color: '#ffb48f', weight: 700 });
        }
      }
      const B = toS(ball);
      // Flecha de lanzamiento
      if (!flight) {
        const len = 18 + power * 0.26 * Math.min(w, h);
        const th = angle * Math.PI / 180;
        const tip = { x: B.x + Math.cos(th) * len, y: B.y - Math.sin(th) * len };
        ctx.save();
        ctx.strokeStyle = '#ffc857'; ctx.fillStyle = '#ffc857'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tip.x + Math.cos(th) * 9, tip.y - Math.sin(th) * 9);
        ctx.lineTo(tip.x + Math.cos(th + 2.4) * 9, tip.y - Math.sin(th + 2.4) * 9);
        ctx.lineTo(tip.x + Math.cos(th - 2.4) * 9, tip.y - Math.sin(th - 2.4) * 9);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        if (!dragging) label(ctx, L('arrastra para apuntar', 'drag to aim'), Math.max(B.x, 70), B.y + R_EARTH * sc + 32, { align: 'center', size: fs - 1, color: '#ffe3a1', weight: 500 });
      }
      drawGlow(ctx, B.x, B.y, 16, '216,240,74', 0.4);
      ctx.fillStyle = '#d8f04a';
      ctx.beginPath(); ctx.arc(B.x, B.y, 5, 0, TAU); ctx.fill();
      showResult();
    }

    // Arrastrar para apuntar
    function aimFrom(e) {
      const rect = canvas.getBoundingClientRect();
      const B = view().toS(START);
      const dx = e.clientX - rect.left - B.x, dy = -(e.clientY - rect.top - B.y);
      let a = Math.atan2(dy, dx) * 180 / Math.PI;
      if (a < 0) a = a < -90 ? 180 : 0;
      angle = Math.round(a * 2) / 2;
      power = clamp((Math.hypot(dx, dy) - 18) / (0.26 * Math.min(S.w, S.h)), 0, 1);
      syncControls(); updatePreview();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (flight) { flight = null; playT = 0; }
      dragging = true; canvas.setPointerCapture(e.pointerId); aimFrom(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (dragging) aimFrom(e); });
    const endDrag = () => { dragging = false; draw(); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    angleIn.addEventListener('input', () => { flight = null; angle = Number(angleIn.value); syncControls(); updatePreview(); });
    powerIn.addEventListener('input', () => { flight = null; power = Number(powerIn.value) / 1000; syncControls(); updatePreview(); });
    easyIn.addEventListener('change', updatePreview);
    $('#mg-launch').addEventListener('click', () => {
      flight = simulate(T_MAX, 0.001); playT = 0; lastMsg = null; draw();
    });
    $('#mg-reset').addEventListener('click', () => { flight = null; playT = 0; updatePreview(); });
    $('#mg-shuffle').addEventListener('click', () => {
      th0 = (-80 + Math.random() * 110) * Math.PI / 180;
      flight = null; playT = 0; updatePreview();
    });

    runWhenVisible(canvas, (dt) => {
      if (flight) {
        const end = Math.min(flight.tEvent, T_MAX);
        if (playT < end) {
          playT = Math.min(end, playT + dt * 0.45);
          if (playT >= end && lastMsg !== flight) { lastMsg = flight; award(); }
        }
      }
      draw();
    });
    onLang.push(() => draw());
    syncControls();
    updatePreview();
  })();

  /* ---------- Comparador de distancias ---------- */
  (function distances() {
    const MOON_KM = 384400;
    const LIGHT = 299792; // km/s
    const CASES = {
      record: { km: 55.8e6, note: '(oposición récord de 2003)', noteEn: '(record opposition of 2003)' },
      y2027: { km: 101e6, note: '(oposición de febrero de 2027)', noteEn: '(February 2027 opposition)' },
      max: { km: 401e6, note: '(Marte al otro lado del Sol, lo más lejos posible)', noteEn: '(Mars on the far side of the Sun, as far as it gets)' },
    };
    const tabs = $$('#distancias .seg button');
    const barMoon = $('#bar-moon'), barMars = $('#bar-mars'), marsOut = $('#dist-mars');
    const ratioOut = $('#dist-ratio'), metersOut = $('#dist-meters'), lightOut = $('#dist-light');
    const dots = $('#dist-dots'), note = $('#dist-case-note');
    if (!dots) return;

    let current = 'record';
    function show(key) {
      current = key;
      const c = CASES[key];
      const ratio = c.km / MOON_KM;
      tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.case === key)));
      barMoon.style.width = `${(MOON_KM / c.km) * 100}%`;
      barMars.style.width = '100%';
      marsOut.textContent = `${num(c.km / 1e6, c.km < 1e8 ? 1 : 0)} ${L('millones de km', 'million km')}`;
      ratioOut.textContent = `×${num(Math.round(ratio))}`;
      metersOut.textContent = `${num(Math.round(ratio))} m`;
      lightOut.textContent = `${num(c.km / LIGHT / 60, 1)} min`;
      note.textContent = L(c.note, c.noteEn);
      const n = Math.round(ratio);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const el = document.createElement('i');
        if (!reduceMotion) el.style.animationDelay = `${Math.min(i * 2, 900)}ms`;
        frag.appendChild(el);
      }
      dots.replaceChildren(frag);
    }

    tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.case)));
    onLang.push(() => show(current));
    show('record');
  })();

  /* ---------- Juego: historia con decisiones (presupuesto, equipo, herramientas y recursos) ---------- */
  (function adventure() {
    const root = $('#adv-game');
    if (!root) return;

    const B = (es, en) => ({ es, en });
    const T = (o) => (typeof o === 'string' ? o : L(o.es, o.en));
    const BUDGET0 = 1000;          // millones de euros
    const TRIP = 210;              // días de viaje hasta Marte
    const roll = (p) => Math.random() < p;

    // --- Catálogo de la fase de preparación ---
    const ROCKETS = [
      { id: 'light', icon: '🚀', cost: 150, fuel: 70, hull: 70, risk: 0.25,
        name: B('Lanzador ligero', 'Light launcher'),
        desc: B('Barato, pero lleva poco combustible y es el más arriesgado en el despegue.', 'Cheap, but carries little fuel and is the riskiest at launch.') },
      { id: 'reuse', icon: '♻️', cost: 280, fuel: 85, hull: 85, risk: 0.12,
        name: B('Cohete reutilizable', 'Reusable rocket'),
        desc: B('Equilibrado: su primera etapa aterriza y se vuelve a usar, por eso cuesta menos.', 'Balanced: its first stage lands and is flown again, which makes it cheaper.') },
      { id: 'heavy', icon: '🏗️', cost: 450, fuel: 100, hull: 100, risk: 0.05,
        name: B('Cohete pesado', 'Heavy rocket'),
        desc: B('El más fiable y con más combustible, pero se come casi la mitad del presupuesto.', 'The most reliable and with the most fuel, but it eats almost half the budget.') },
    ];
    const CREW = [
      { id: 'pilot', icon: '🧑‍✈️', cost: 60, name: B('Valeria · Piloto', 'Valeria · Pilot'),
        desc: B('Maniobras precisas: ahorra combustible en la Luna y al llegar a Marte.', 'Precise manoeuvres: saves fuel at the Moon and on arrival at Mars.') },
      { id: 'eng', icon: '🔧', cost: 60, name: B('Tomás · Ingeniero', 'Tomás · Engineer'),
        desc: B('Arregla averías y puede salir de la nave en un paseo espacial.', 'Fixes breakdowns and can go outside on a spacewalk.') },
      { id: 'med', icon: '🩺', cost: 50, name: B('Nuria · Médica', 'Nuria · Doctor'),
        desc: B('Cuida de la salud del equipo durante los 7 meses de viaje.', 'Looks after the crew’s health during the 7-month journey.') },
      { id: 'geo', icon: '🔬', cost: 40, name: B('Kenji · Geólogo', 'Kenji · Geologist'),
        desc: B('No ayuda en el viaje, pero multiplica la ciencia al llegar a Marte.', 'No help on the journey, but multiplies the science once at Mars.') },
      { id: 'com', icon: '📡', cost: 40, name: B('Amara · Comunicaciones', 'Amara · Communications'),
        desc: B('Mantiene el contacto con la Tierra y avisa antes de las tormentas solares.', 'Keeps in touch with Earth and gives early warning of solar storms.') },
    ];
    const SUPPLIES = [
      { id: 'min', days: 200, name: B('Justas', 'Bare minimum'), desc: B('200 días: menos que el viaje. Habrá que racionar.', '200 days: less than the trip. You will have to ration.') },
      { id: 'ok', days: 240, name: B('Con margen', 'With a margin'), desc: B('240 días: el viaje y un mes de reserva.', '240 days: the trip plus a month in reserve.') },
      { id: 'max', days: 300, name: B('De sobra', 'Plenty'), desc: B('300 días: tranquilidad, pero pesan y cuestan.', '300 days: peace of mind, but heavy and costly.') },
    ];
    const SUP_COST = 0.15; // M€ por persona y día
    const TOOLS = [
      { id: 'kit', icon: '🧰', cost: 40, name: B('Kit de reparación', 'Repair kit'), desc: B('Parches y piezas para tapar fugas.', 'Patches and spare parts to seal leaks.') },
      { id: 'shield', icon: '🛡️', cost: 80, name: B('Escudo antirradiación', 'Radiation shield'), desc: B('Protege de las tormentas solares.', 'Protects against solar storms.') },
      { id: 'printer', icon: '🖨️', cost: 60, name: B('Impresora 3D', '3D printer'), desc: B('Fabrica piezas de repuesto a bordo.', 'Makes spare parts on board.') },
      { id: 'medkit', icon: '💊', cost: 30, name: B('Botiquín avanzado', 'Advanced medical kit'), desc: B('Medicinas y aparatos de diagnóstico.', 'Medicines and diagnostic equipment.') },
      { id: 'panels', icon: '☀️', cost: 50, name: B('Paneles solares de repuesto', 'Spare solar panels'), desc: B('Energía extra si algo falla.', 'Extra power if something fails.') },
      { id: 'tank', icon: '⛽', cost: 70, name: B('Depósito extra', 'Extra tank'), desc: B('+15 % de combustible.', '+15% fuel.') },
    ];
    const byId = (list, id) => list.find((x) => x.id === id);

    // --- Recursos ---
    const RES = [
      { k: 'budget', icon: '💶', name: B('Presupuesto', 'Budget'), fmt: (v) => `${num(v)} M€`, max: BUDGET0 },
      { k: 'fuel', icon: '⛽', name: B('Combustible', 'Fuel'), fmt: (v) => `${num(v)} %`, max: 100 },
      { k: 'food', icon: '🥫', name: B('Provisiones', 'Supplies'), fmt: (v) => L(`${num(v)} días`, `${num(v)} days`), max: 300 },
      { k: 'health', icon: '❤️', name: B('Salud del equipo', 'Crew health'), fmt: (v) => `${num(v)} %`, max: 100 },
      { k: 'hull', icon: '🛰️', name: B('Estado de la nave', 'Ship condition'), fmt: (v) => `${num(v)} %`, max: 100 },
    ];

    // --- Capítulos del viaje ---
    // Cada opción: req (requisitos), hint (efecto previsto) y run(s) → { text, d (cambios), fact? }
    const EVENTS = [
      { id: 'launch', day: 0, icon: '🌩️', place: B('Despegue', 'Launch'),
        title: B('Tormenta sobre la base de lanzamiento', 'A storm over the launch site'),
        text: B('Faltan dos horas para el despegue y se acerca una tormenta eléctrica. La ventana de lanzamiento hacia Marte solo está abierta unos días: si esperas, el camino será un poco menos eficiente.',
          'Two hours before launch, a thunderstorm is approaching. The launch window to Mars is only open for a few days: if you wait, the route will be slightly less efficient.'),
        fact: B('Las ventanas de lanzamiento a Marte se abren cada ~26 meses, cerca de la oposición. Perderla significa esperar más de dos años.', 'Launch windows to Mars open every ~26 months, near opposition. Missing one means waiting more than two years.'),
        choices: [
          { title: B('Esperar 3 días', 'Wait 3 days'), hint: B('−30 M€ · −5 % combustible · riesgo bajo', '−€30M · −5% fuel · low risk'), req: { budget: 30 },
            run: (s) => (roll(s.rocket.risk / 3)
              ? { text: B('Aun con buen tiempo, un sensor falla en el despegue. La nave sale dañada.', 'Even in good weather, a sensor fails during launch. The ship leaves damaged.'), d: { budget: -30, fuel: -5, hull: -20 } }
              : { text: B('Cielo despejado. Despegue perfecto, aunque la espera ha costado dinero y la trayectoria es algo peor.', 'Clear skies. A perfect launch, although the wait cost money and the route is slightly worse.'), d: { budget: -30, fuel: -5 } }) },
          { title: B('Despegar ya', 'Launch now'), hint: (s) => B(`Gratis · riesgo ${Math.round((s.rocket.risk + 0.15) * 100)} % de daños`, `Free · ${Math.round((s.rocket.risk + 0.15) * 100)}% risk of damage`),
            run: (s) => (roll(s.rocket.risk + 0.15)
              ? { text: B('Un rayo cae cerca y el viento sacude el cohete. Llegáis a órbita, pero con daños y gastando combustible de más.', 'Lightning strikes nearby and the wind shakes the rocket. You reach orbit, but damaged and using extra fuel.'), d: { hull: -30, fuel: -10 } }
              : { text: B('¡Arriesgado, pero sale bien! El cohete atraviesa las nubes sin problemas.', 'Risky, but it works! The rocket punches through the clouds without trouble.'), d: {} }) },
        ] },
      { id: 'orbit', day: 1, icon: '🔋', place: B('Órbita terrestre', 'Earth orbit'),
        title: B('Un panel solar no se despliega', 'A solar panel will not deploy'),
        text: B('Ya en órbita, uno de los paneles solares se ha quedado atascado. Con un solo panel la nave tendrá menos energía para la calefacción y el soporte vital.',
          'Now in orbit, one of the solar panels is stuck. With only one panel, the ship will have less power for heating and life support.'),
        fact: B('Los paneles solares dan menos energía cuanto más lejos del Sol: en Marte llega menos de la mitad de luz que en la Tierra.', 'Solar panels make less power the farther you are from the Sun: at Mars there is less than half the sunlight we get at Earth.'),
        choices: [
          { title: B('Montar los paneles de repuesto', 'Fit the spare panels'), hint: B('Sin coste', 'No cost'), req: { tool: 'panels' },
            run: () => ({ text: B('Los paneles de repuesto funcionan a la primera. Energía de sobra.', 'The spare panels work first time. Plenty of power.'), d: {} }) },
          { title: B('Paseo espacial para desatascarlo', 'Spacewalk to free it'), hint: B('Riesgo 20 % para la salud', '20% risk to health'), req: { crew: 'eng' },
            run: () => (roll(0.2)
              ? { text: B('Tomás lo consigue, pero se golpea el traje y sufre un susto serio.', 'Tomás manages it, but knocks his suit and has a serious scare.'), d: { health: -15 } }
              : { text: B('Tomás sale, da un par de golpes precisos con la herramienta y el panel se despliega.', 'Tomás goes out, gives it a couple of precise taps and the panel unfolds.'), d: {} }) },
          { title: B('Pagar un parche de software', 'Pay for a software patch'), hint: B('−40 M€', '−€40M'), req: { budget: 40 },
            run: () => ({ text: B('Los ingenieros de la Tierra mueven el panel a sacudidas desde el ordenador. Funciona.', 'Engineers on Earth jiggle the panel loose by computer. It works.'), d: { budget: -40 } }) },
          { title: B('Seguir con un solo panel', 'Carry on with one panel'), hint: B('Gratis · el equipo pasará frío', 'Free · the crew will be cold'),
            run: (s) => { s.lowPower = true; return { text: B('Ahorras dinero, pero la nave irá justa de energía todo el viaje.', 'You save money, but the ship will be short of power all the way.'), d: { health: -10 } }; } },
        ] },
      { id: 'moon', day: 4, icon: '🌙', place: B('Paso por la Luna', 'Lunar flyby'),
        title: B('El efecto honda', 'The slingshot'),
        text: B('Os acercáis a la Luna. Si pasáis justo por detrás de ella, su gravedad os dará un empujón gratis hacia Marte. Pero hay que encender el motor en el momento exacto.',
          'You are approaching the Moon. If you pass right behind it, its gravity will give you a free push towards Mars. But the engine must fire at exactly the right moment.'),
        fact: B('En el efecto honda la nave «roba» un poquito de la velocidad de la Luna. La Luna ni se entera, pero la nave gana mucha velocidad.', 'In a slingshot the spacecraft “steals” a tiny bit of the Moon’s speed. The Moon does not notice, but the spacecraft gains a lot of speed.'),
        choices: [
          { title: B('Maniobra manual', 'Manual manoeuvre'), hint: B('−5 % combustible · riesgo 10 %', '−5% fuel · 10% risk'), req: { crew: 'pilot' },
            run: () => (roll(0.1)
              ? { text: B('Valeria enciende el motor un segundo tarde. Hay que corregir y se gasta más.', 'Valeria fires the engine a second late. A correction is needed, using more fuel.'), d: { fuel: -15 } }
              : { text: B('¡Perfecta! Valeria clava la maniobra y la Luna os lanza hacia Marte.', 'Perfect! Valeria nails it and the Moon flings you towards Mars.'), d: { fuel: -5 } }) },
          { title: B('Piloto automático', 'Autopilot'), hint: B('−12 % combustible · sin riesgo', '−12% fuel · no risk'),
            run: () => ({ text: B('El ordenador hace la maniobra con prudencia: funciona, aunque gasta algo más.', 'The computer flies the manoeuvre cautiously: it works, though it uses a bit more.'), d: { fuel: -12 } }) },
          { title: B('Ir directos, sin pasar por la Luna', 'Go straight, skip the Moon'), hint: B('−25 % combustible', '−25% fuel'),
            run: () => ({ text: B('Sin la ayuda de la Luna, el motor tiene que hacer todo el trabajo.', 'Without the Moon’s help, the engine has to do all the work.'), d: { fuel: -25 } }) },
        ] },
      { id: 'storm', day: 45, icon: '☀️', place: B('Crucero · mes 2', 'Cruise · month 2'),
        title: B('¡Tormenta solar!', 'Solar storm!'),
        text: (s) => (s.crew.includes('com')
          ? B('Amara recibe un aviso: el Sol ha lanzado una enorme nube de partículas. Llegará en 6 horas. Hay tiempo para prepararse.', 'Amara receives a warning: the Sun has hurled a huge cloud of particles. It will arrive in 6 hours. There is time to get ready.')
          : B('Los sensores se disparan: una nube de partículas del Sol os alcanza ya. Fuera de la Tierra no hay campo magnético que os proteja.', 'The sensors go wild: a cloud of particles from the Sun is hitting you right now. Away from Earth there is no magnetic field to protect you.')),
        fact: B('La Tierra nos protege con su campo magnético y su atmósfera. En el espacio, los astronautas se refugian detrás del agua y la comida, que frenan la radiación.', 'The Earth protects us with its magnetic field and atmosphere. In space, astronauts shelter behind water and food, which block radiation.'),
        choices: [
          { title: B('Activar el escudo antirradiación', 'Switch on the radiation shield'), hint: B('Sin daños', 'No harm'), req: { tool: 'shield' },
            run: () => ({ text: B('El escudo aguanta la tormenta. Nadie recibe radiación de más.', 'The shield holds through the storm. Nobody gets an extra dose.'), d: {} }) },
          { title: B('Refugiarse tras el agua y la comida', 'Shelter behind the water and food'), hint: (s) => (s.crew.includes('com') ? B('−5 % salud · −5 días de provisiones', '−5% health · −5 days of supplies') : B('−12 % salud · −5 días de provisiones', '−12% health · −5 days of supplies')),
            run: (s) => ({ text: B('Pasáis dos días apretados en el refugio. Se estropea algo de comida, pero estáis a salvo.', 'You spend two cramped days in the shelter. Some food spoils, but you are safe.'), d: { health: s.crew.includes('com') ? -5 : -12, food: -5 } }) },
          { title: B('Seguir trabajando como si nada', 'Keep working as normal'), hint: B('−30 % salud', '−30% health'),
            run: () => ({ text: B('Mala idea: la tripulación recibe mucha radiación y se encuentra mal varios días.', 'Bad idea: the crew takes a big radiation dose and feels ill for days.'), d: { health: -30 } }) },
        ] },
      { id: 'meteor', day: 100, icon: '☄️', place: B('Crucero · mes 4', 'Cruise · month 4'),
        title: B('Impacto de un micrometeorito', 'Micrometeoroid impact'),
        text: B('¡Clonc! Una piedrecita del tamaño de un grano de arena, a 20 km/s, ha hecho un agujero en el almacén. El aire se escapa poco a poco.',
          'Clonk! A pebble the size of a grain of sand, travelling at 20 km/s, has punched a hole in the storeroom. Air is slowly leaking out.'),
        fact: B('A esas velocidades, un grano de arena golpea con tanta energía como una bala. Por eso las naves llevan capas de blindaje.', 'At those speeds, a grain of sand hits as hard as a bullet. That is why spacecraft carry layers of shielding.'),
        choices: [
          { title: B('Usar el kit de reparación', 'Use the repair kit'), hint: B('−5 % nave', '−5% ship'), req: { tool: 'kit' },
            run: () => ({ text: B('Un parche, un poco de sellador y listo. Fuga controlada.', 'A patch, a bit of sealant, done. Leak under control.'), d: { hull: -5 } }) },
          { title: B('Imprimir una pieza en 3D', '3D-print a part'), hint: B('−10 % nave', '−10% ship'), req: { tool: 'printer' },
            run: () => ({ text: B('La impresora fabrica una tapa a medida en tres horas. Aguanta bien.', 'The printer makes a custom cover in three hours. It holds well.'), d: { hull: -10 } }) },
          { title: B('Que el ingeniero improvise', 'Let the engineer improvise'), hint: B('−15 % nave', '−15% ship'), req: { crew: 'eng' },
            run: () => ({ text: B('Tomás tapa el agujero con cinta, una placa y mucho ingenio.', 'Tomás plugs the hole with tape, a plate and a lot of ingenuity.'), d: { hull: -15 } }) },
          { title: B('Cerrar el almacén para siempre', 'Seal off the storeroom for good'), hint: B('−25 % nave · −30 días de provisiones', '−25% ship · −30 days of supplies'),
            run: () => ({ text: B('Cerráis la escotilla. Se acaba la fuga, pero perdéis todo lo que había dentro.', 'You close the hatch. The leak stops, but you lose everything inside.'), d: { hull: -25, food: -30 } }) },
        ] },
      { id: 'sick', day: 140, icon: '🤒', place: B('Crucero · mes 5', 'Cruise · month 5'),
        title: B('Alguien se pone enfermo', 'Someone falls ill'),
        text: (s) => B(`Un miembro del equipo tiene fiebre alta y dolor fuerte.${s.lowPower ? ' El frío por la falta de energía no ayuda.' : ''} Estáis a más de 10 minutos-luz: cada mensaje a la Tierra tarda en llegar.`,
          `A crew member has a high fever and severe pain.${s.lowPower ? ' The cold from the power shortage does not help.' : ''} You are more than 10 light-minutes away: every message to Earth takes a while to arrive.`),
        fact: B('La luz (y la radio) tarda entre 3 y 22 minutos en ir de la Tierra a Marte. No se puede hablar en directo: es como mandar cartas.', 'Light (and radio) takes between 3 and 22 minutes to travel from Earth to Mars. You cannot talk live: it is like sending letters.'),
        choices: [
          { title: B('La médica la atiende con el botiquín', 'The doctor treats them with the medical kit'), hint: B('+10 % salud', '+10% health'), req: { crew: 'med', tool: 'medkit' },
            run: () => ({ text: B('Nuria hace un diagnóstico rápido y el tratamiento funciona. ¡Todos mejoran!', 'Nuria makes a quick diagnosis and the treatment works. Everyone feels better!'), d: { health: 10 } }) },
          { title: B('La médica improvisa', 'The doctor improvises'), hint: B('−5 % salud', '−5% health'), req: { crew: 'med' },
            run: () => ({ text: B('Sin el material ideal, Nuria lo resuelve con lo que hay. Recuperación lenta.', 'Without ideal equipment, Nuria makes do. A slow recovery.'), d: { health: -5 } }) },
          { title: B('Usar el botiquín siguiendo las instrucciones', 'Use the medical kit with the instructions'), hint: B('−8 % salud', '−8% health'), req: { tool: 'medkit' },
            run: () => ({ text: B('El botiquín trae guías paso a paso. No es como tener una médica, pero funciona.', 'The kit has step-by-step guides. Not like having a doctor, but it works.'), d: { health: -8 } }) },
          { title: B('Pedir ayuda a los médicos de la Tierra', 'Ask doctors on Earth for help'), hint: (s) => (s.crew.includes('com') ? B('−10 % salud', '−10% health') : B('−20 % salud', '−20% health')),
            run: (s) => ({ text: s.crew.includes('com')
              ? B('Amara organiza las consultas y, pese al retraso, el tratamiento llega a tiempo.', 'Amara organises the calls and, despite the delay, the treatment arrives in time.')
              : B('Las respuestas tardan horas. La recuperación es lenta y a todos les afecta.', 'Replies take hours. Recovery is slow and it affects everyone.'), d: { health: s.crew.includes('com') ? -10 : -20 } }) },
        ] },
      { id: 'nav', day: 170, icon: '🧭', place: B('Crucero · mes 6', 'Cruise · month 6'),
        title: B('Os estáis desviando', 'You are drifting off course'),
        text: B('Los cálculos indican que, si no corregís, pasaréis a 5.000 km de Marte… demasiado lejos para quedaros en órbita.',
          'The calculations show that, if you do not correct, you will pass 5,000 km from Mars… too far to go into orbit.'),
        fact: B('Todas las naves hacen pequeñas «correcciones de trayectoria» durante el viaje: un pequeño error al principio se hace enorme después de millones de kilómetros.', 'Every spacecraft makes small “course corrections” along the way: a tiny error at the start grows huge after millions of kilometres.'),
        choices: [
          { title: B('Corrección precisa a mano', 'Precise manual correction'), hint: B('−4 % combustible', '−4% fuel'), req: { crew: 'pilot' },
            run: () => ({ text: B('Valeria enciende el motor 12 segundos. Rumbo corregido.', 'Valeria fires the engine for 12 seconds. Course corrected.'), d: { fuel: -4 } }) },
          { title: B('Pagar cálculos a la red de antenas', 'Pay the antenna network for calculations'), hint: B('−50 M€ · −4 % combustible', '−€50M · −4% fuel'), req: { budget: 50 },
            run: () => ({ text: B('Las grandes antenas de la Tierra miden vuestra posición al metro. Corrección perfecta.', 'Earth’s big antennas measure your position to the metre. A perfect correction.'), d: { budget: -50, fuel: -4 } }) },
          { title: B('Corrección automática', 'Automatic correction'), hint: B('−10 % combustible', '−10% fuel'),
            run: () => ({ text: B('El ordenador corrige con margen de seguridad y gasta algo más.', 'The computer corrects with a safety margin and uses a bit more.'), d: { fuel: -10 } }) },
        ] },
      { id: 'arrive', day: TRIP, icon: '🔴', place: B('Llegada a Marte', 'Arrival at Mars'),
        title: B('Hay que frenar', 'Time to brake'),
        text: B('Marte ya se ve enorme por la ventanilla. Vais demasiado rápido: si no frenáis, pasaréis de largo y seguiréis hacia el espacio profundo.',
          'Mars looks huge through the window. You are going too fast: if you do not brake, you will fly past and carry on into deep space.'),
        fact: B('El aerofrenado usa el roce con la atmósfera de Marte para frenar sin gastar combustible. Es barato, pero calienta y sacude la nave.', 'Aerobraking uses friction with the Martian atmosphere to slow down without fuel. It is cheap, but it heats and shakes the ship.'),
        choices: [
          { title: B('Frenar solo con el motor', 'Brake with the engine only'), hint: (s) => B(`−${s.crew.includes('pilot') ? 30 : 35} % combustible · sin riesgo`, `−${s.crew.includes('pilot') ? 30 : 35}% fuel · no risk`), req: (s) => ({ fuel: s.crew.includes('pilot') ? 30 : 35 }),
            run: (s) => ({ text: B('El motor ruge durante 20 minutos. Entráis en órbita de Marte con suavidad.', 'The engine roars for 20 minutes. You slip gently into orbit around Mars.'), d: { fuel: s.crew.includes('pilot') ? -30 : -35 } }) },
          { title: B('Combinar motor y aerofrenado', 'Combine engine and aerobraking'), hint: B('−18 % combustible · −12 % nave', '−18% fuel · −12% ship'), req: { fuel: 18 },
            run: () => ({ text: B('Un frenazo con el motor y varias pasadas por la atmósfera. Equilibrado.', 'One burn with the engine and several passes through the atmosphere. Balanced.'), d: { fuel: -18, hull: -12 } }) },
          { title: B('Solo aerofrenado', 'Aerobraking only'), hint: (s) => B(`−6 % combustible · −25 % nave · riesgo ${s.crew.includes('pilot') ? 10 : 30} %`, `−6% fuel · −25% ship · ${s.crew.includes('pilot') ? 10 : 30}% risk`), req: { fuel: 6 },
            run: (s) => (roll(s.crew.includes('pilot') ? 0.1 : 0.3)
              ? { text: B('Entráis demasiado bajo. El escudo térmico brilla al rojo y algo se rompe.', 'You go in too low. The heat shield glows red-hot and something breaks.'), d: { fuel: -6, hull: -45 } }
              : { text: B('La atmósfera de Marte os frena como un paracaídas gigante. ¡Qué ahorro!', 'The Martian atmosphere slows you like a giant parachute. What a saving!'), d: { fuel: -6, hull: -25 } }) },
        ] },
    ];
    const STAGES = [B('Preparación', 'Preparation')].concat(EVENTS.map((e) => e.place));

    let s;
    function reset() {
      s = { phase: 'rocket', rocket: null, crew: [], supplies: null, tools: [], ev: 0, outcome: null, lowPower: false,
        budget: BUDGET0, fuel: 0, food: 0, health: 100, hull: 0, log: [], end: null };
    }
    const crewCost = () => s.crew.reduce((a, id) => a + byId(CREW, id).cost, 0);
    const supCost = (opt) => Math.round(opt.days * Math.max(s.crew.length, 1) * SUP_COST);
    const toolCost = () => s.tools.reduce((a, id) => a + byId(TOOLS, id).cost, 0);
    const spentPrep = () => (s.rocket ? s.rocket.cost : 0) + crewCost() + (s.supplies ? supCost(s.supplies) : 0) + toolCost();

    function check(req) {
      if (!req) return null;
      if (typeof req === 'function') req = req(s);
      if (req.crew && !s.crew.includes(req.crew)) return L(`Necesitas a ${T(byId(CREW, req.crew).name).split(' · ')[0]}`, `You need ${T(byId(CREW, req.crew).name).split(' · ')[0]}`);
      if (req.tool && !s.tools.includes(req.tool)) return L(`Necesitas: ${T(byId(TOOLS, req.tool).name)}`, `You need: ${T(byId(TOOLS, req.tool).name)}`);
      if (req.budget && s.budget < req.budget) return L('No queda presupuesto', 'Not enough budget');
      if (req.fuel && s.fuel < req.fuel) return L('No queda combustible suficiente', 'Not enough fuel');
      return null;
    }

    // --- Pintado ---
    const fmtDelta = (k, v) => {
      const r = RES.find((x) => x.k === k);
      const sign = v > 0 ? '+' : '−';
      return `<span class="adv-delta ${v > 0 ? 'up' : 'down'}">${r.icon} ${sign}${r.fmt(Math.abs(v))}</span>`;
    };
    function hud() {
      const prep = s.phase !== 'trip' && s.phase !== 'end';
      const vals = prep
        ? { budget: BUDGET0 - spentPrep(), fuel: s.rocket ? Math.min(100, s.rocket.fuel + (s.tools.includes('tank') ? 15 : 0)) : 0,
          food: s.supplies ? s.supplies.days : 0, health: 100, hull: s.rocket ? s.rocket.hull : 0 }
        : s;
      const meters = RES.map((r) => {
        const v = vals[r.k];
        const pct = clamp(v / r.max, 0, 1) * 100;
        const low = r.k === 'food' ? v < (prep ? TRIP : TRIP - (EVENTS[Math.min(s.ev, EVENTS.length - 1)].day)) : (r.k !== 'budget' && pct < 30);
        return `<div class="adv-meter${low && v > 0 ? ' low' : ''}${v < 0 ? ' neg' : ''}">
          <span class="adv-m-head"><span>${r.icon} ${T(r.name)}</span><b>${r.fmt(v)}</b></span>
          <span class="adv-m-track"><span class="adv-m-bar ${r.k}" style="width:${pct}%"></span></span></div>`;
      }).join('');
      const chips = s.crew.map((id) => { const c = byId(CREW, id); return `<span class="adv-chip">${c.icon} ${T(c.name).split(' · ')[0]}</span>`; })
        .concat(s.tools.map((id) => { const t = byId(TOOLS, id); return `<span class="adv-chip tool">${t.icon} ${T(t.name)}</span>`; })).join('');
      const cur = s.phase === 'trip' ? s.ev + 1 : s.phase === 'end' ? STAGES.length : 0;
      const route = STAGES.map((st, i) => `<li class="${i < cur ? 'done' : i === cur ? 'now' : ''}"><span class="adv-dot"></span><span class="adv-st">${T(st)}</span></li>`).join('');
      return `<ol class="adv-route" aria-label="${L('Etapas del viaje', 'Journey stages')}">${route}</ol>
        <div class="adv-hud">${meters}</div>${chips ? `<div class="adv-chips">${chips}</div>` : ''}`;
    }

    function optCard(o, { on, disabled, reason, cost, group, value, multi }) {
      return `<button type="button" class="adv-opt${on ? ' on' : ''}" data-${group}="${value}" ${multi ? `aria-pressed="${!!on}"` : `aria-pressed="${!!on}"`} ${disabled ? 'disabled' : ''}>
        <span class="adv-opt-head"><span class="adv-opt-icon" aria-hidden="true">${o.icon || ''}</span><span class="adv-opt-name">${T(o.name)}</span>${cost != null ? `<span class="adv-cost">${num(cost)} M€</span>` : ''}</span>
        <span class="adv-opt-desc">${T(o.desc)}</span>${reason ? `<span class="adv-why">${reason}</span>` : ''}</button>`;
    }

    function prepView() {
      const left = BUDGET0 - spentPrep();
      const steps = ['rocket', 'crew', 'supplies', 'tools'];
      const n = steps.indexOf(s.phase) + 1;
      const head = (k, title, lead) => `<p class="kicker">${L('Preparación', 'Preparation')} · ${n}/4</p><h3 class="adv-title">${title}</h3><p class="adv-text">${lead}</p>`;
      let body = '', next = '', ok = false;
      if (s.phase === 'rocket') {
        body = ROCKETS.map((r) => optCard(Object.assign({}, r, { desc: B(`${r.desc.es} Combustible ${r.fuel} %, nave ${r.hull} %, riesgo en despegue ${Math.round(r.risk * 100)} %.`,
          `${r.desc.en} Fuel ${r.fuel}%, ship ${r.hull}%, launch risk ${Math.round(r.risk * 100)}%.`) }), { on: s.rocket === r, cost: r.cost, group: 'rocket', value: r.id })).join('');
        ok = !!s.rocket;
        return head('rocket', L('Elige el cohete', 'Choose the rocket'), L('Es la decisión más cara. Un cohete mejor lleva más combustible y es más resistente, pero deja menos dinero para lo demás.', 'This is the most expensive decision. A better rocket carries more fuel and is tougher, but leaves less money for everything else.'))
          + `<div class="adv-opts">${body}</div>` + nav(ok, L('Siguiente: el equipo ▶', 'Next: the crew ▶'), false);
      }
      if (s.phase === 'crew') {
        body = CREW.map((c) => {
          const on = s.crew.includes(c.id);
          const full = !on && s.crew.length >= 4;
          const poor = !on && c.cost > left;
          return optCard(c, { on, cost: c.cost, group: 'crew', value: c.id, multi: true, disabled: full || poor, reason: full ? L('Máximo 4 personas', 'Maximum 4 people') : poor ? L('No hay presupuesto', 'Not enough budget') : '' });
        }).join('');
        ok = s.crew.length >= 2;
        return head('crew', L('Forma el equipo (de 2 a 4 personas)', 'Pick the crew (2 to 4 people)'), L('Cada especialista cobra su sueldo y sabe resolver problemas distintos. Más personas también significa más comida, agua y oxígeno.', 'Each specialist has a salary and can solve different problems. More people also means more food, water and oxygen.'))
          + `<div class="adv-opts">${body}</div>` + nav(ok, L('Siguiente: provisiones ▶', 'Next: supplies ▶'), true);
      }
      if (s.phase === 'supplies') {
        body = SUPPLIES.map((o) => {
          const c = supCost(o);
          const poor = s.supplies !== o && c > left + (s.supplies ? supCost(s.supplies) : 0);
          return optCard(Object.assign({ icon: '🥫' }, o), { on: s.supplies === o, cost: c, group: 'sup', value: o.id, disabled: poor, reason: poor ? L('No hay presupuesto', 'Not enough budget') : '' });
        }).join('');
        ok = !!s.supplies;
        return head('supplies', L('Comida, agua y oxígeno', 'Food, water and oxygen'), L(`El viaje dura unos ${TRIP} días (7 meses). El precio depende de cuántas personas viajan: ${s.crew.length}.`, `The journey takes about ${TRIP} days (7 months). The price depends on how many people travel: ${s.crew.length}.`))
          + `<div class="adv-opts">${body}</div>` + nav(ok, L('Siguiente: herramientas ▶', 'Next: tools ▶'), true);
      }
      body = TOOLS.map((t) => {
        const on = s.tools.includes(t.id);
        const poor = !on && t.cost > left;
        return optCard(t, { on, cost: t.cost, group: 'tool', value: t.id, multi: true, disabled: poor, reason: poor ? L('No hay presupuesto', 'Not enough budget') : '' });
      }).join('');
      return head('tools', L('Herramientas y equipamiento', 'Tools and equipment'), L('Opcionales. Lo que no gastes queda como fondo de emergencia para pagar ayuda desde la Tierra durante el viaje.', 'Optional. Whatever you do not spend stays as an emergency fund to pay for help from Earth during the trip.'))
        + `<div class="adv-opts">${body}</div>` + nav(true, L('🚀 ¡Al despegue!', '🚀 Go for launch!'), true);
    }
    const nav = (ok, label, back) => `<div class="controls adv-nav">${back ? `<button type="button" class="btn small ghost" data-act="back">◀ ${L('Atrás', 'Back')}</button>` : ''}<button type="button" class="btn small primary" data-act="next" ${ok ? '' : 'disabled'}>${label}</button></div>`;

    function tripView() {
      const e = EVENTS[s.ev];
      const head = `<p class="kicker">${L('Día', 'Day')} ${e.day} · ${T(e.place)}</p><h3 class="adv-title"><span aria-hidden="true">${e.icon}</span> ${T(e.title)}</h3>
        <p class="adv-text">${T(typeof e.text === 'function' ? e.text(s) : e.text)}</p>`;
      if (s.outcome) {
        const o = s.outcome;
        const ds = Object.entries(o.d).filter(([, v]) => v).map(([k, v]) => fmtDelta(k, v)).join('') || `<span class="adv-delta">${L('Sin cambios', 'No change')}</span>`;
        return head + `<div class="adv-outcome" aria-live="polite"><p class="adv-chosen">${L('Has elegido', 'You chose')}: <strong>${T(o.choice)}</strong></p><p>${T(o.text)}</p>
          <div class="adv-deltas">${ds}</div>${o.extra ? `<p class="adv-extra">${T(o.extra)}</p>` : ''}</div>
          <aside class="adv-fact"><span aria-hidden="true">💡</span><p>${T(e.fact)}</p></aside>
          <div class="controls adv-nav"><button type="button" class="btn small primary" data-act="continue">${s.end ? L('Ver el final ▶', 'See the ending ▶') : L('Continuar ▶', 'Continue ▶')}</button></div>`;
      }
      const opts = e.choices.map((c, i) => {
        const why = check(c.req);
        const hint = typeof c.hint === 'function' ? c.hint(s) : c.hint;
        return `<button type="button" class="adv-opt choice" data-choice="${i}" ${why ? 'disabled' : ''}>
          <span class="adv-opt-name">${T(c.title)}</span><span class="adv-opt-desc">${T(hint)}</span>${why ? `<span class="adv-why">🔒 ${why}</span>` : ''}</button>`;
      }).join('');
      return head + `<div class="adv-opts choices">${opts}</div>`;
    }

    function endView() {
      const e = s.end;
      if (!e.win) {
        return `<div class="adv-end fail"><p class="kicker">${L('Fin de la misión', 'Mission over')}</p><h3 class="adv-title">${e.icon} ${T(e.title)}</h3><p class="adv-text">${T(e.text)}</p>
          <p class="adv-text">${L('Revisa el diario de a bordo: ¿qué habrías cambiado en la preparación?', 'Look back at the logbook: what would you change in the preparation?')}</p>
          <div class="controls adv-nav"><button type="button" class="btn small primary" data-act="restart">↺ ${L('Intentarlo otra vez', 'Try again')}</button></div></div>`;
      }
      const rows = e.parts.map((p) => `<li><span>${T(p[0])}</span><b>+${num(p[1])}</b></li>`).join('');
      let best = 0;
      try { best = +localStorage.getItem('advBest') || 0; if (e.score > best) localStorage.setItem('advBest', e.score); } catch (err) { /* sin almacenamiento */ }
      return `<div class="adv-end win"><p class="kicker">${L('¡Misión cumplida!', 'Mission accomplished!')}</p><h3 class="adv-title">🔴 ${L('Estáis en órbita de Marte', 'You are in orbit around Mars')}</h3>
        <p class="adv-stars" aria-label="${e.stars} / 3">${'⭐'.repeat(e.stars)}${'<span class="off">⭐</span>'.repeat(3 - e.stars)}</p>
        <p class="adv-text">${T(e.text)}</p><ul class="adv-score">${rows}<li class="total"><span>${L('Puntuación', 'Score')}</span><b>${num(e.score)}</b></li></ul>
        ${best && e.score <= best ? `<p class="fine">${L('Tu récord', 'Your best')}: ${num(Math.max(best, e.score))}</p>` : (best ? `<p class="fine">🏆 ${L('¡Nuevo récord!', 'New record!')}</p>` : '')}
        <div class="controls adv-nav"><button type="button" class="btn small primary" data-act="restart">↺ ${L('Jugar otra vez', 'Play again')}</button></div></div>`;
    }

    function logView() {
      if (!s.log.length) return '';
      const items = s.log.map((l) => `<li><span class="adv-log-day">${L('Día', 'Day')} ${l.day}</span> ${T(l.text)}</li>`).join('');
      return `<details class="adv-log"><summary>📓 ${L('Diario de a bordo', 'Logbook')} (${s.log.length})</summary><ol>${items}</ol></details>`;
    }

    function render(focus) {
      const main = s.phase === 'end' ? endView() : s.phase === 'trip' ? tripView() : prepView();
      root.innerHTML = `${hud()}<div class="adv-stage">${main}</div>${logView()}`;
      if (focus) { const h = root.querySelector('.adv-title'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    }

    // --- Lógica ---
    function startTrip() {
      s.budget = BUDGET0 - spentPrep();
      s.fuel = Math.min(100, s.rocket.fuel + (s.tools.includes('tank') ? 15 : 0));
      s.food = s.supplies.days;
      s.hull = s.rocket.hull;
      s.health = 100;
      s.phase = 'trip'; s.ev = 0; s.outcome = null;
      s.log.push({ day: 0, text: B(`Despegáis con ${s.rocket.name.es.toLowerCase()}, ${s.crew.length} tripulantes y ${s.tools.length} herramientas. Quedan ${s.budget} M€.`,
        `You lift off on a ${s.rocket.name.en.toLowerCase()} with ${s.crew.length} crew and ${s.tools.length} tools. €${s.budget}M left.`) });
    }

    function choose(i) {
      const e = EVENTS[s.ev];
      const c = e.choices[i];
      if (check(c.req)) return;
      const r = c.run(s);
      const d = Object.assign({}, r.d);
      // Provisiones gastadas hasta el siguiente capítulo (con racionamiento si faltan)
      const nextDay = s.ev + 1 < EVENTS.length ? EVENTS[s.ev + 1].day : TRIP;
      const days = nextDay - e.day;
      Object.entries(d).forEach(([k, v]) => { s[k] = k === 'budget' ? s[k] + v : clamp(s[k] + v, 0, 100 + (k === 'food' ? 300 : 0)); });
      let extra = null;
      if (days > 0) {
        const eaten = Math.min(days, s.food);
        s.food -= eaten;
        d.food = (d.food || 0) - eaten;
        if (eaten < days) {
          const hurt = Math.round((days - eaten) * 0.6);
          s.health = clamp(s.health - hurt, 0, 100);
          d.health = (d.health || 0) - hurt;
          extra = B(`⚠️ Se acaban las provisiones: ${days - eaten} días a media ración.`, `⚠️ Supplies run out: ${days - eaten} days on half rations.`);
        } else extra = B(`Viajáis ${days} días hasta el siguiente capítulo.`, `You travel ${days} days to the next chapter.`);
      }
      s.outcome = { choice: c.title, text: r.text, d, extra };
      s.log.push({ day: e.day, text: B(`${e.place.es}: ${c.title.es}.`, `${e.place.en}: ${c.title.en}.`) });
      s.end = verdict(e);
      render(true);
    }

    function verdict(e) {
      if (s.hull <= 0) return { win: false, icon: '💥', title: B('La nave no ha aguantado', 'The ship did not survive'),
        text: B('Los daños acumulados eran demasiados. Por suerte, la cápsula de emergencia devuelve al equipo a casa, pero la misión se pierde.', 'The damage had piled up too much. Luckily, the escape capsule takes the crew home, but the mission is lost.') };
      if (s.health <= 0) return { win: false, icon: '🚑', title: B('La tripulación no puede seguir', 'The crew cannot go on'),
        text: B('El equipo está demasiado débil. Control de misión ordena dar la vuelta usando la gravedad de Marte.', 'The crew is too weak. Mission control orders a turnaround using the gravity of Mars.') };
      if (e.id !== 'arrive' && s.ev + 1 < EVENTS.length) {
        const ne = EVENTS[s.ev + 1];
        const can = ne.choices.some((c) => !check(c.req));
        if (!can) return { win: false, icon: '🌌', title: B('Sin combustible para frenar', 'No fuel left to brake'),
          text: B('Llegáis a Marte sin combustible para frenar y pasáis de largo. La nave queda girando alrededor del Sol.', 'You reach Mars with no fuel to brake and fly straight past. The ship ends up circling the Sun.') };
        return null;
      }
      if (e.id !== 'arrive') return null;
      const parts = [
        [B('Salud del equipo', 'Crew health'), s.health * 3],
        [B('Estado de la nave', 'Ship condition'), s.hull * 2],
        [B('Combustible sobrante', 'Fuel left over'), s.fuel * 2],
        [B('Provisiones sobrantes', 'Supplies left over'), s.food * 2],
        [B('Presupuesto sobrante', 'Budget left over'), Math.max(0, Math.round(s.budget / 2))],
      ];
      if (s.crew.includes('geo')) parts.push([B('Ciencia de Kenji en Marte', 'Kenji’s science at Mars'), 150]);
      const score = parts.reduce((a, p) => a + p[1], 0);
      const stars = s.health >= 60 && s.hull >= 40 ? (score >= 650 ? 3 : 2) : 1;
      const text = stars === 3 ? B('¡Una misión de libro! Has gestionado el dinero, el equipo y los recursos con mucha cabeza.', 'A textbook mission! You managed money, crew and resources very wisely.')
        : stars === 2 ? B('Buena misión. Habéis llegado en forma, aunque con algunos sustos por el camino.', 'A good mission. You arrived in good shape, with a few scares along the way.')
          : B('¡Habéis llegado! Por los pelos: la nave o la tripulación están muy tocadas.', 'You made it! Only just: the ship or the crew are badly battered.');
      return { win: true, parts, score, stars, text };
    }

    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled || !root.contains(b)) return;
      const d = b.dataset;
      if (d.rocket) { s.rocket = byId(ROCKETS, d.rocket); }
      else if (d.crew) {
        const i = s.crew.indexOf(d.crew);
        if (i >= 0) s.crew.splice(i, 1); else s.crew.push(d.crew);
        s.supplies = null; // el precio de las provisiones depende del equipo
      }
      else if (d.sup) s.supplies = byId(SUPPLIES, d.sup);
      else if (d.tool) { const i = s.tools.indexOf(d.tool); if (i >= 0) s.tools.splice(i, 1); else s.tools.push(d.tool); }
      else if (d.choice) return choose(+d.choice);
      else if (d.act === 'next') {
        const order = ['rocket', 'crew', 'supplies', 'tools'];
        const i = order.indexOf(s.phase);
        if (s.phase === 'rocket' && BUDGET0 - spentPrep() < 0) return;
        if (i < 3) s.phase = order[i + 1]; else startTrip();
        // Si al cambiar de cohete o de equipo ya no alcanza el dinero, se deshacen las herramientas
        while (BUDGET0 - spentPrep() < 0 && s.tools.length) s.tools.pop();
        return render(true);
      } else if (d.act === 'back') {
        const order = ['rocket', 'crew', 'supplies', 'tools'];
        s.phase = order[Math.max(0, order.indexOf(s.phase) - 1)];
        return render(true);
      } else if (d.act === 'continue') {
        if (s.end) { s.phase = 'end'; return render(true); }
        s.ev += 1; s.outcome = null; return render(true);
      } else if (d.act === 'restart') { reset(); return render(true); }
      else return;
      // Volver a ajustar si el presupuesto queda negativo (p. ej., al cambiar de cohete)
      if (s.phase === 'rocket') { s.crew.length && BUDGET0 - spentPrep() < 0 && (s.crew = [], s.supplies = null, s.tools = []); }
      render(false);
    });

    reset();
    render(false);
    onLang.push(() => render(false));
  })();

  /* ---------- Cambio de idioma (botón con bandera) ---------- */
  (function i18n() {
    const EN = window.I18N_EN || {};
    // Textos que pone el JavaScript: no se traducen desde el diccionario
    const SKIP = new Set(['solar-date', 'solar-next', 'solar-play', 'solar-status', 'sling-speed', 'm-day', 'm-date', 'm-photos',
      'm-status', 'm-play', 'fb-days', 'fb-dist', 'fb-moon', 'fb-escape', 'fb-play', 'fb-part-kicker', 'fb-part-title', 'fb-part-text',
      'dist-mars', 'dist-ratio', 'dist-meters', 'dist-light', 'dist-case-note', 'tl-launch', 'tl-arrival', 'lang-btn',
      'm-around', 'm-photos', 'm-delay', 'tl-aero', 'tl-photos', 'spin-caption', 'gs-mode', 'gs-speedup', 'gs-results', 'mg-result', 'adv-game']);
    const INLINE = new Set(['STRONG', 'EM', 'B', 'I', 'BR', 'SPAN', 'A', 'SMALL', 'ABBR']);
    const IGNORE = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'INPUT', 'OUTPUT', 'DEFS', 'NOSCRIPT']);
    const norm = (str) => str.replace(/\s+/g, ' ').trim();
    const inlineOnly = (el) => Array.from(el.childNodes).every((n) => n.nodeType === 3 ||
      (n.nodeType === 1 && INLINE.has(n.tagName.toUpperCase()) && !n.id && inlineOnly(n)));

    // Bloques de texto: elementos que solo contienen texto y etiquetas en línea.
    // La clave del diccionario es el texto visible en español (sin etiquetas, espacios normalizados).
    const blocks = [];
    (function visit(el) {
      for (const c of Array.from(el.children)) {
        if (IGNORE.has(c.tagName.toUpperCase()) || (c.id && SKIP.has(c.id))) continue;
        if (c.textContent.trim() && inlineOnly(c)) blocks.push({ el: c, es: c.innerHTML, key: norm(c.textContent) });
        else visit(c);
      }
    })(document.body);
    const attrs = $$('[aria-label]').filter((el) => el.id !== 'lang-btn' && !el.closest('#adv-game')).map((el) => ({ el, es: el.getAttribute('aria-label') }));
    const meta = $('meta[name="description"]');
    const metaEs = meta ? meta.content : '';
    const btn = $('#lang-btn');

    // Para revisar en consola qué textos no tienen traducción
    window.__i18nMissing = () => blocks.filter((b) => /[a-záéíóúñ]/i.test(b.key) && !EN[b.key]).map((b) => b.key)
      .concat(attrs.filter((a) => !EN[norm(a.es)]).map((a) => norm(a.es)));

    function apply() {
      document.documentElement.lang = LANG;
      blocks.forEach((b) => { b.el.innerHTML = LANG === 'en' && EN[b.key] ? EN[b.key] : b.es; });
      attrs.forEach((a) => { const en = EN[norm(a.es)]; a.el.setAttribute('aria-label', LANG === 'en' && en ? en : a.es); });
      document.title = L('Misión The Last Lap', 'Mission The Last Lap');
      if (meta) meta.content = L(metaEs, 'An interactive, educational website about a hypothetical mission to Mars that uses the Moon as a boost: orbits, the opposition of Mars, the slingshot effect and the mission plan.');
      if (btn) {
        btn.setAttribute('aria-label', L('Switch to English', 'Cambiar a español'));
        btn.title = L('English', 'Español');
      }
      onLang.forEach((f) => f());
    }

    if (btn) btn.addEventListener('click', () => {
      LANG = LANG === 'en' ? 'es' : 'en';
      try { localStorage.setItem('lang', LANG); } catch (e) { /* sin almacenamiento */ }
      apply();
    });
    apply();
  })();
})();
