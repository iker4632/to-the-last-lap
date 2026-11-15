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
    // Dificultad: cambia el presupuesto, el riesgo, los daños, el tiempo de los minijuegos y la puntuación
    const LEVELS = {
      easy: { budget: 1200, risk: 0.6, dmg: 0.75, time: 1.3, score: 0.8, icon: '🟢', name: B('Fácil', 'Easy'), desc: B('1.200 M€ · menos riesgo · más tiempo', '€1,200M · less risk · more time') },
      normal: { budget: 1000, risk: 1, dmg: 1, time: 1, score: 1, icon: '🟡', name: B('Normal', 'Normal'), desc: B('1.000 M€ · la misión tal cual', '€1,000M · the mission as it is') },
      hard: { budget: 850, risk: 1.4, dmg: 1.25, time: 0.75, score: 1.3, icon: '🔴', name: B('Difícil', 'Hard'), desc: B('850 M€ · más riesgo y daños · ×1,3 puntos', '€850M · more risk and damage · ×1.3 points') },
    };
    let LV = LEVELS.normal;
    let BUDGET0 = LV.budget;       // millones de euros
    const TRIP = 210;              // días de viaje hasta Marte
    const roll = (p) => Math.random() < Math.min(0.95, p * LV.risk);

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
    // ---------- Objetivo científico, instrumentos y misiones reales parecidas ----------
    const GOALS = [
      { id: 'water', icon: '💧', site: 'pole', instr: 'radar', name: B('Buscar agua', 'Search for water'), desc: B('¿Hay hielo bajo la superficie? Sería clave para futuras bases.', 'Is there ice below the surface? It would be key for future bases.'),
        missions: [B('<b>Phoenix</b> (NASA, 2008) aterrizó cerca del polo norte y tocó hielo de agua con su brazo robótico.', '<b>Phoenix</b> (NASA, 2008) landed near the north pole and touched water ice with its robotic arm.'),
          B('<b>Mars Reconnaissance Orbiter</b> (NASA, 2006) cartografía el hielo enterrado con su radar SHARAD.', '<b>Mars Reconnaissance Orbiter</b> (NASA, 2006) maps buried ice with its SHARAD radar.')] },
      { id: 'life', icon: '🦠', site: 'jezero', instr: 'lab', name: B('Rastros de vida antigua', 'Signs of ancient life'), desc: B('¿Hubo vida en Marte cuando tenía ríos y lagos?', 'Was there life on Mars when it had rivers and lakes?'),
        missions: [B('<b>Perseverance</b> (NASA, 2021) recoge muestras de roca en el cráter Jezero, un antiguo lago.', '<b>Perseverance</b> (NASA, 2021) collects rock samples in Jezero Crater, an ancient lake.'),
          B('<b>Curiosity</b> (NASA, 2012) demostró que el cráter Gale pudo ser habitable hace miles de millones de años.', '<b>Curiosity</b> (NASA, 2012) showed that Gale Crater could have been habitable billions of years ago.')] },
      { id: 'climate', icon: '🌪️', site: 'stay', instr: 'spectro', name: B('Clima y atmósfera', 'Climate and atmosphere'), desc: B('¿Cómo perdió Marte su atmósfera? Se estudia mejor desde la órbita.', 'How did Mars lose its atmosphere? It is best studied from orbit.'),
        missions: [B('<b>MAVEN</b> (NASA, 2014) mide cómo el viento solar le arranca la atmósfera a Marte.', '<b>MAVEN</b> (NASA, 2014) measures how the solar wind strips away Mars’ atmosphere.'),
          B('<b>Mars Express</b> (ESA, 2003) estudia la atmósfera y la superficie desde la órbita.', '<b>Mars Express</b> (ESA, 2003) studies the atmosphere and surface from orbit.')] },
      { id: 'quake', icon: '🌋', site: 'utopia', instr: 'seis', name: B('Interior y terremotos', 'Interior and quakes'), desc: B('¿Cómo es Marte por dentro? Hace falta una llanura tranquila.', 'What is Mars like inside? You need a quiet plain.'),
        missions: [B('<b>InSight</b> (NASA, 2018) registró más de 1.300 «martemotos» desde una llanura lisa.', '<b>InSight</b> (NASA, 2018) recorded more than 1,300 “marsquakes” from a flat plain.'),
          B('<b>Viking</b> (NASA, 1976) llevó los primeros sismómetros a la superficie de Marte.', '<b>Viking</b> (NASA, 1976) took the first seismometers to the surface of Mars.')] },
    ];
    const INSTR = [
      { id: 'radar', icon: '📡', cost: 60, name: B('Radar de subsuelo', 'Ground-penetrating radar'), desc: B('Ve el hielo enterrado.', 'Sees buried ice.') },
      { id: 'lab', icon: '🔬', cost: 60, name: B('Laboratorio de rocas', 'Rock laboratory'), desc: B('Busca moléculas de la vida.', 'Looks for the molecules of life.') },
      { id: 'spectro', icon: '🌈', cost: 60, name: B('Espectrómetro atmosférico', 'Atmospheric spectrometer'), desc: B('Analiza los gases del aire.', 'Analyses the gases in the air.') },
      { id: 'seis', icon: '📈', cost: 60, name: B('Sismómetro', 'Seismometer'), desc: B('Escucha los «martemotos».', 'Listens for “marsquakes”.') },
    ];
    // Niveles de madurez del concepto (CML, del JPL de la NASA) para cada paso de la preparación
    const CML = { goal: [1, B('Idea de misión', 'Mission idea')], rocket: [2, B('Viabilidad: ¿podemos llegar?', 'Feasibility: can we get there?')],
      crew: [3, B('Comparar opciones', 'Trade studies')], supplies: [3, B('Comparar opciones', 'Trade studies')], tools: [4, B('Diseño detallado', 'Point design')] };
    // Los 4 segmentos de una misión
    const SEGS = { launch: ['🚀', B('Segmento de lanzamiento', 'Launch segment')], space: ['🛰️', B('Segmento espacial', 'Space segment')],
      ground: ['📡', B('Segmento terrestre', 'Ground segment')], user: ['🔬', B('Segmento de usuarios', 'User segment')] };
    const EV_SEG = { launch: 'launch', orbit: 'space', moon: 'space', storm: 'space', meteor: 'space', sick: 'space', nav: 'ground', arrive: 'space', land: 'user',
      signal: 'ground', cables: 'space', oxygen: 'space', water: 'space', asteroid: 'user', computer: 'ground', morale: 'ground', sponsor: 'user',
      goal: 'user', rocket: 'launch', crew: 'space', supplies: 'space', tools: 'space' };
    const segChip = (id) => { const sg = SEGS[EV_SEG[id]]; return sg ? `<span class="seg-chip seg-${EV_SEG[id]}" title="${L('Los 4 segmentos de una misión', 'The 4 segments of a mission')}">${sg[0]} ${T(sg[1])}</span>` : ''; };
    const goalOf = () => byId(GOALS, s.goal);


    // --- Recursos ---
    const RES = [
      { k: 'budget', icon: '💶', name: B('Presupuesto', 'Budget'), short: B('Dinero', 'Money'), fmt: (v) => `${num(v)} M€`, get max() { return BUDGET0; } },
      { k: 'fuel', icon: '⛽', name: B('Combustible', 'Fuel'), short: B('Combustible', 'Fuel'), fmt: (v) => `${num(v)} %`, max: 100 },
      { k: 'food', icon: '🥫', name: B('Provisiones', 'Supplies'), short: B('Comida', 'Supplies'), fmt: (v) => (v === 1 ? L('1 día', '1 day') : L(`${num(v)} días`, `${num(v)} days`)), max: 300 },
      { k: 'health', icon: '❤️', name: B('Salud del equipo', 'Crew health'), short: B('Salud', 'Health'), fmt: (v) => `${num(v)} %`, max: 100 },
      { k: 'hull', icon: '🛰️', name: B('Estado de la nave', 'Ship condition'), short: B('Nave', 'Ship'), fmt: (v) => `${num(v)} %`, max: 100 },
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
              ? { bad: true, text: B('Aun con buen tiempo, un sensor falla en el despegue. La nave sale dañada.', 'Even in good weather, a sensor fails during launch. The ship leaves damaged.'), d: { budget: -30, fuel: -5, hull: -20 } }
              : { text: B('Cielo despejado. Despegue perfecto, aunque la espera ha costado dinero y la trayectoria es algo peor.', 'Clear skies. A perfect launch, although the wait cost money and the route is slightly worse.'), d: { budget: -30, fuel: -5 } }) },
          { title: B('Despegar ya', 'Launch now'), hint: (s) => B(`Gratis · riesgo ${Math.round((s.rocket.risk + 0.15) * 100)} % de daños`, `Free · ${Math.round((s.rocket.risk + 0.15) * 100)}% risk of damage`),
            run: (s) => (roll(s.rocket.risk + 0.15)
              ? { bad: true, text: B('Un rayo cae cerca y el viento sacude el cohete. Llegáis a órbita, pero con daños y gastando combustible de más.', 'Lightning strikes nearby and the wind shakes the rocket. You reach orbit, but damaged and using extra fuel.'), d: { hull: -30, fuel: -10 } }
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
              ? { bad: true, text: B('Tomás lo consigue, pero se golpea el traje y sufre un susto serio.', 'Tomás manages it, but knocks his suit and has a serious scare.'), d: { health: -15 } }
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
          { fx: 'manual', mini: 'sling', title: B('Encender el motor tú (minijuego)', 'Fire the engine yourself (mini-game)'), hint: B('Pulsa en el momento justo: menos combustible si aciertas', 'Press at the right moment: less fuel if you nail it') },
          { title: B('Maniobra manual', 'Manual manoeuvre'), hint: B('−5 % combustible · riesgo 10 %', '−5% fuel · 10% risk'), req: { crew: 'pilot' },
            run: () => (roll(0.1)
              ? { bad: true, text: B('Valeria enciende el motor un segundo tarde. Hay que corregir y se gasta más.', 'Valeria fires the engine a second late. A correction is needed, using more fuel.'), d: { fuel: -15 } }
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
        text: (s) => B(`Un miembro del equipo tiene fiebre alta y dolor fuerte.${s.lowPower ? ' El frío por la falta de energía no ayuda.' : ''} Estáis a varios minutos-luz: cada mensaje a la Tierra tarda en llegar.`,
          `A crew member has a high fever and severe pain.${s.lowPower ? ' The cold from the power shortage does not help.' : ''} You are several light-minutes away: every message to Earth takes a while to arrive.`),
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
          { fx: 'aero', mini: 'aero', title: B('Pilotar tú el aerofrenado (minijuego)', 'Fly the aerobraking yourself (mini-game)'), hint: B('Mantén la nave en la franja de la atmósfera', 'Keep the ship in the atmosphere band'), req: { fuel: 6 } },
          { title: B('Frenar solo con el motor', 'Brake with the engine only'), hint: (s) => B(`−${s.crew.includes('pilot') ? 30 : 35} % combustible · sin riesgo`, `−${s.crew.includes('pilot') ? 30 : 35}% fuel · no risk`), req: (s) => ({ fuel: s.crew.includes('pilot') ? 30 : 35 }),
            run: (s) => ({ text: B('El motor ruge durante 20 minutos. Entráis en órbita de Marte con suavidad.', 'The engine roars for 20 minutes. You slip gently into orbit around Mars.'), d: { fuel: s.crew.includes('pilot') ? -30 : -35 } }) },
          { title: B('Combinar motor y aerofrenado', 'Combine engine and aerobraking'), hint: B('−18 % combustible · −12 % nave', '−18% fuel · −12% ship'), req: { fuel: 18 },
            run: () => ({ text: B('Un frenazo con el motor y varias pasadas por la atmósfera. Equilibrado.', 'One burn with the engine and several passes through the atmosphere. Balanced.'), d: { fuel: -18, hull: -12 } }) },
          { title: B('Solo aerofrenado', 'Aerobraking only'), hint: (s) => B(`−6 % combustible · −25 % nave · riesgo ${s.crew.includes('pilot') ? 10 : 30} %`, `−6% fuel · −25% ship · ${s.crew.includes('pilot') ? 10 : 30}% risk`), req: { fuel: 6 },
            run: (s) => (roll(s.crew.includes('pilot') ? 0.1 : 0.3)
              ? { bad: true, text: B('Entráis demasiado bajo. El escudo térmico brilla al rojo y algo se rompe.', 'You go in too low. The heat shield glows red-hot and something breaks.'), d: { fuel: -6, hull: -45 } }
              : { text: B('La atmósfera de Marte os frena como un paracaídas gigante. ¡Qué ahorro!', 'The Martian atmosphere slows you like a giant parachute. What a saving!'), d: { fuel: -6, hull: -25 } }) },
        ] },
      { id: 'land', day: TRIP + 5, icon: '🛬', place: B('Aterrizaje', 'Landing'),
        title: B('¿Dónde aterrizáis?', 'Where do you land?'),
        text: B('Ya estáis en órbita. Es la última decisión: elegir dónde baja el módulo de aterrizaje. Cuanto más interesante es el sitio para la ciencia, más difícil es llegar.',
          'You are in orbit now. This is the last decision: choosing where the lander goes down. The more interesting the place is for science, the harder it is to reach.'),
        fact: B('Aterrizar en Marte es dificilísimo: la atmósfera es muy fina para frenar solo con paracaídas, pero lo bastante densa para calentar la nave. Por eso se combinan escudo térmico, paracaídas y retrocohetes.',
          'Landing on Mars is extremely hard: the atmosphere is too thin to slow down with parachutes alone, but thick enough to heat the ship. That is why a heat shield, parachutes and retro-rockets are combined.'),
        choices: [
          { fx: 'utopia', title: B('Llanura de Utopía: lisa y segura', 'Utopia Planitia: flat and safe'), hint: B('−5 % combustible · −5 % nave · ciencia +60', '−5% fuel · −5% ship · science +60'), req: { fuel: 5 },
            run: () => ({ science: 60, landed: true, text: B('Un aterrizaje de manual en una llanura enorme. ¡Estáis en Marte!', 'A textbook landing on a huge plain. You are on Mars!'), d: { fuel: -5, hull: -5 } }) },
          { fx: 'jezero', title: B('Cráter Jezero, un antiguo lago', 'Jezero Crater, an ancient lake'), hint: (s) => B(`−6 % combustible · riesgo ${s.crew.includes('pilot') ? 8 : 20} % · ciencia +130`, `−6% fuel · ${s.crew.includes('pilot') ? 8 : 20}% risk · science +130`), req: { fuel: 6 },
            run: (s) => (roll(s.crew.includes('pilot') ? 0.08 : 0.2)
              ? { bad: true, science: 130, landed: true, text: B('Bajáis junto a un antiguo delta de río, pero una roca rompe una pata del módulo.', 'You land next to an ancient river delta, but a rock breaks one of the lander’s legs.'), d: { fuel: -6, hull: -25 } }
              : { science: 130, landed: true, text: B('¡Aterrizaje junto al antiguo delta del río! Aquí trabaja el rover Perseverance buscando rastros de vida.', 'Landing next to the ancient river delta! This is where the Perseverance rover searches for signs of life.'), d: { fuel: -6 } }) },
          { fx: 'pole', title: B('Polo norte, con hielo de agua', 'North pole, with water ice'), hint: B('−8 % combustible · riesgo 35 % · ciencia +180', '−8% fuel · 35% risk · science +180'), req: { fuel: 8 },
            run: () => (roll(0.35)
              ? { bad: true, science: 180, landed: true, text: B('El hielo resbala y el módulo vuelca un poco. Pero habéis encontrado agua.', 'The ice is slippery and the lander tips over a little. But you have found water.'), d: { fuel: -8, hull: -30 } }
              : { science: 180, landed: true, text: B('¡Hielo de agua bajo vuestros pies! Un tesoro para futuras bases en Marte.', 'Water ice under your feet! A treasure for future bases on Mars.'), d: { fuel: -8 } }) },
          { fx: 'stay', title: B('Quedarse en órbita y estudiar desde arriba', 'Stay in orbit and study from above'), hint: B('Sin riesgo · ciencia +30', 'No risk · science +30'),
            run: () => ({ science: 30, text: B('Desde la órbita fotografiáis todo el planeta. Sin riesgos, aunque sin pisar Marte.', 'From orbit you photograph the whole planet. No risks, but no footsteps on Mars.'), d: {} }) },
        ] },
    ];
    // Situaciones extra: en cada partida salen al azar (el cortocircuito con el minijuego siempre aparece)
    const NEW_EVENTS = [
      { id: 'cables', icon: '⚡', title: B('Cortocircuito en el panel eléctrico', 'Short circuit in the electrical panel'),
        text: B('¡Zas! Salta un chispazo y se apagan las luces. Los cables del panel principal se han soltado. Si no se reconectan pronto, la nave perderá la calefacción y el control.',
          'Zap! A spark flies and the lights go out. The main panel’s cables have come loose. If they are not reconnected soon, the ship will lose heating and control.'),
        fact: B('Las naves llevan los sistemas importantes duplicados («redundancia»): si uno falla, otro toma el relevo. Aun así, saber reparar a mano sigue siendo clave.',
          'Spacecraft carry duplicate copies of important systems (“redundancy”): if one fails, another takes over. Even so, being able to repair things by hand is still key.'),
        choices: [
          { fx: 'puzzle', puzzle: true, title: B('Reconectar los cables tú (minijuego)', 'Reconnect the cables yourself (mini-game)'),
            hint: (s) => (s.crew.includes('eng') ? B('Tomás te guía: más tiempo', 'Tomás guides you: more time') : B('Une cada cable con su pareja a contrarreloj', 'Match each cable with its pair against the clock')) },
          { fx: 'backup', title: B('Encender el sistema de reserva', 'Switch on the backup system'), hint: B('−8 % combustible · −10 % nave', '−8% fuel · −10% ship'),
            run: () => ({ text: B('El sistema de reserva funciona, pero gasta combustible y deja parte de la nave sin protección.', 'The backup works, but it burns fuel and leaves part of the ship unprotected.'), d: { fuel: -8, hull: -10 } }) },
          { fx: 'remote', title: B('Que la Tierra lo arregle a distancia', 'Let Earth fix it remotely'), hint: B('−60 M€', '−€60M'), req: { budget: 60 },
            run: () => ({ text: B('Los ingenieros de la Tierra reprograman el panel durante horas. Caro, pero sin riesgos.', 'Engineers on Earth reprogram the panel for hours. Expensive, but safe.'), d: { budget: -60 } }) },
        ] },
      { id: 'signal', icon: '📡', title: B('Se pierde el contacto con la Tierra', 'Contact with Earth is lost'),
        text: B('La nave ha girado sin querer y la antena ya no apunta a la Tierra. Sin contacto, no llegan los datos ni las instrucciones.',
          'The ship has turned by accident and the antenna no longer points at Earth. Without contact, no data or instructions get through.'),
        fact: B('Las antenas de las naves son muy direccionales: tienen que apuntar a la Tierra con una precisión de décimas de grado. Allí las escuchan las enormes antenas de la Red de Espacio Profundo.',
          'Spacecraft antennas are very directional: they must point at Earth to within tenths of a degree. There, the huge antennas of the Deep Space Network listen to them.'),
        choices: [
          { fx: 'aim', mini: 'antenna', title: B('Apuntar la antena tú (minijuego)', 'Point the antenna yourself (mini-game)'), hint: B('Gira la nave hasta encontrar la señal', 'Turn the ship until you find the signal') },
          { fx: 'com', title: B('Amara recalcula el apuntado', 'Amara recalculates the pointing'), hint: B('Sin daños', 'No harm'), req: { crew: 'com' },
            run: () => ({ text: B('Amara calcula dónde está la Tierra con las estrellas y reorienta la antena. ¡Contacto!', 'Amara works out where Earth is from the stars and re-aims the antenna. Contact!'), d: {} }) },
          { fx: 'wait', title: B('Esperar al modo seguro automático', 'Wait for automatic safe mode'), hint: B('−12 días de provisiones · −5 % salud', '−12 days of supplies · −5% health'),
            run: () => ({ text: B('Tras días de silencio, el ordenador encuentra la Tierra solo. Han sido días largos.', 'After days of silence, the computer finds Earth on its own. They were long days.'), d: { food: -12, health: -5 } }) },
        ] },
      { id: 'oxygen', icon: '🫁', title: B('Falla el filtro de CO₂', 'The CO₂ filter fails'),
        text: B('El aparato que limpia el dióxido de carbono del aire se ha atascado. Sin él, el aire se irá volviendo irrespirable poco a poco.',
          'The device that removes carbon dioxide from the air has jammed. Without it, the air will slowly become unbreathable.'),
        fact: B('En el Apolo 13 pasó algo parecido: los astronautas fabricaron un filtro con cartón, bolsas y cinta adhesiva siguiendo instrucciones desde la Tierra.',
          'Something similar happened on Apollo 13: the astronauts built a filter out of cardboard, bags and duct tape following instructions from Earth.'),
        choices: [
          { fx: 'printer', title: B('Imprimir un filtro nuevo', 'Print a new filter'), hint: B('Sin daños', 'No harm'), req: { tool: 'printer' },
            run: () => ({ text: B('La impresora 3D fabrica la pieza exacta. El aire vuelve a estar limpio en una hora.', 'The 3D printer makes the exact part. The air is clean again within an hour.'), d: {} }) },
          { fx: 'eng', title: B('El ingeniero lo desmonta y lo limpia', 'The engineer takes it apart and cleans it'), hint: B('−5 % salud', '−5% health'), req: { crew: 'eng' },
            run: () => ({ text: B('Tomás encuentra el atasco y lo limpia. Unas horas de dolor de cabeza y listo.', 'Tomás finds the blockage and cleans it. A few hours of headaches and it is done.'), d: { health: -5 } }) },
          { fx: 'tape', title: B('Filtro casero con cinta, como en el Apolo 13', 'Home-made filter with tape, like Apollo 13'), hint: B('Riesgo 35 %', '35% risk'),
            run: () => (roll(0.35)
              ? { bad: true, text: B('El filtro casero se despega dos veces. La tripulación pasa días mareada.', 'The home-made filter comes loose twice. The crew feels dizzy for days.'), d: { health: -25 } }
              : { text: B('¡Funciona! Cinta, bolsas y mucho ingenio. Un poco de dolor de cabeza, nada más.', 'It works! Tape, bags and lots of ingenuity. A bit of a headache, nothing more.'), d: { health: -8 } }) },
          { fx: 'reserve', title: B('Gastar el oxígeno de reserva', 'Use the reserve oxygen'), hint: B('−20 días de provisiones', '−20 days of supplies'),
            run: () => ({ text: B('Abrís las botellas de reserva. Respiráis bien, pero esas reservas ya no estarán al final.', 'You open the reserve tanks. You breathe fine, but those reserves will not be there at the end.'), d: { food: -20 } }) },
        ] },
      { id: 'water', icon: '💧', title: B('Fuga en el reciclador de agua', 'Leak in the water recycler'),
        text: B('El sistema que convierte el sudor y la orina en agua potable está goteando. Sí: en el espacio se recicla todo. Las gotas flotan por la cabina como pompas.',
          'The system that turns sweat and urine into drinking water is leaking. Yes: in space, everything is recycled. The drops float around the cabin like bubbles.'),
        fact: B('La Estación Espacial Internacional recicla cerca del 98 % de su agua, incluida la orina de los astronautas.', 'The International Space Station recycles about 98% of its water, including the astronauts’ urine.'),
        choices: [
          { fx: 'kit', title: B('Tapar la fuga con el kit', 'Seal the leak with the kit'), hint: B('−3 días de provisiones', '−3 days of supplies'), req: { tool: 'kit' },
            run: () => ({ text: B('Un parche y una abrazadera. Solo se pierden unos litros.', 'A patch and a clamp. Only a few litres are lost.'), d: { food: -3 } }) },
          { fx: 'eng', title: B('El ingeniero cambia la tubería', 'The engineer replaces the pipe'), hint: B('−5 % nave', '−5% ship'), req: { crew: 'eng' },
            run: () => ({ text: B('Tomás saca una tubería de otro sistema menos importante. Apaño resuelto.', 'Tomás takes a pipe from a less important system. Sorted.'), d: { hull: -5 } }) },
          { fx: 'ration', title: B('Racionar el agua hasta Marte', 'Ration water until Mars'), hint: B('−12 % salud', '−12% health'),
            run: () => ({ text: B('Menos agua para todos. Se nota el cansancio y la piel seca.', 'Less water for everyone. Tiredness and dry skin set in.'), d: { health: -12 } }) },
          { fx: 'leave', title: B('Dejarlo así', 'Leave it'), hint: B('−35 días de provisiones', '−35 days of supplies'),
            run: () => ({ bad: true, text: B('El goteo no para. Cuando os dais cuenta, falta muchísima agua.', 'The dripping never stops. By the time you notice, a lot of water is gone.'), d: { food: -35 } }) },
        ] },
      { id: 'asteroid', icon: '🪨', title: B('Un asteroide pasa cerca', 'An asteroid flies by'),
        text: B('Un pequeño asteroide cruzará a solo 2.000 km de la nave. Una agencia científica de la Tierra ofrece dinero por fotos de cerca.',
          'A small asteroid will pass just 2,000 km from the ship. A science agency on Earth is offering money for close-up photos.'),
        fact: B('Las sondas aprovechan a veces el viaje para estudiar asteroides por el camino: la sonda Galileo fotografió Gaspra e Ida camino de Júpiter.',
          'Probes sometimes use the journey to study asteroids along the way: the Galileo probe photographed Gaspra and Ida on its way to Jupiter.'),
        choices: [
          { fx: 'close', title: B('Acercarse y fotografiarlo', 'Get close and photograph it'), hint: (s) => B(`+${s.crew.includes('geo') ? 120 : 80} M€ · −8 % combustible · riesgo 15 %`, `+€${s.crew.includes('geo') ? 120 : 80}M · −8% fuel · 15% risk`),
            run: (s) => { const m = s.crew.includes('geo') ? 120 : 80; return roll(0.15)
              ? { bad: true, text: B('¡Fotos espectaculares! Pero un trozo de roca golpea la nave al pasar.', 'Spectacular photos! But a chunk of rock hits the ship as you pass.'), d: { budget: m, fuel: -8, hull: -20 } }
              : { text: s.crew.includes('geo') ? B('Kenji identifica los minerales del asteroide. ¡La agencia paga extra!', 'Kenji identifies the asteroid’s minerals. The agency pays extra!') : B('Fotos increíbles y sin un rasguño. La agencia paga encantada.', 'Amazing photos without a scratch. The agency pays happily.'), d: { budget: m, fuel: -8 } }; } },
          { fx: 'far', title: B('Fotografiarlo de lejos', 'Photograph it from afar'), hint: B('+25 M€', '+€25M'),
            run: () => ({ text: B('Las fotos salen pequeñas, pero algo pagan.', 'The photos are small, but they still pay something.'), d: { budget: 25 } }) },
          { fx: 'ignore', title: B('Seguir sin desviarse', 'Carry on without detours'), hint: B('Sin cambios', 'No change'),
            run: () => ({ text: B('El asteroide pasa de largo. Nada que contar.', 'The asteroid sails past. Nothing to report.'), d: {} }) },
        ] },
      { id: 'computer', icon: '💻', title: B('El ordenador de a bordo se cuelga', 'The on-board computer crashes'),
        text: B('La pantalla se llena de errores y la nave empieza a girar lentamente sin control. Hay que actuar antes de que los paneles dejen de mirar al Sol.',
          'The screen fills with errors and the ship starts slowly spinning out of control. You must act before the panels stop facing the Sun.'),
        fact: B('Durante el alunizaje del Apolo 11, el ordenador mostró alarmas de sobrecarga. Estaba programado para ignorar las tareas menos importantes, y eso salvó la misión.',
          'During the Apollo 11 landing, the computer showed overload alarms. It was programmed to drop the least important tasks, and that saved the mission.'),
        choices: [
          { fx: 'pilot', title: B('La piloto estabiliza a mano', 'The pilot stabilises it by hand'), hint: B('−6 % combustible', '−6% fuel'), req: { crew: 'pilot' },
            run: () => ({ text: B('Valeria frena el giro con los propulsores mientras el ordenador arranca de nuevo.', 'Valeria stops the spin with the thrusters while the computer restarts.'), d: { fuel: -6 } }) },
          { fx: 'reboot', title: B('Reiniciar el sistema', 'Reboot the system'), hint: B('Riesgo 30 %', '30% risk'),
            run: () => (roll(0.3)
              ? { bad: true, text: B('El reinicio tarda una eternidad y la nave da muchas vueltas antes de recuperarse.', 'The reboot takes ages and the ship spins a lot before recovering.'), d: { fuel: -15, hull: -10 } }
              : { text: B('Apagar y encender… ¡y funciona! Como con cualquier ordenador.', 'Turn it off and on again… and it works! Just like any computer.'), d: { fuel: -3 } }) },
          { fx: 'patch', title: B('Parche de software desde la Tierra', 'Software patch from Earth'), hint: B('−45 M€', '−€45M'), req: { budget: 45 },
            run: () => ({ text: B('Los programadores de la Tierra encuentran el error y mandan la solución.', 'Programmers on Earth find the bug and send the fix.'), d: { budget: -45 } }) },
        ] },
      { id: 'morale', icon: '😔', title: B('La tripulación echa de menos la Tierra', 'The crew misses Earth'),
        text: B('Llevan meses encerrados en un espacio del tamaño de una furgoneta. Hay discusiones y nadie duerme bien.',
          'They have spent months shut in a space the size of a van. There are arguments and nobody sleeps well.'),
        fact: B('La salud mental es uno de los mayores retos de un viaje a Marte. En el experimento Mars-500 seis personas vivieron 520 días encerradas para estudiarlo.',
          'Mental health is one of the biggest challenges of a trip to Mars. In the Mars-500 experiment, six people lived shut in for 520 days to study it.'),
        choices: [
          { fx: 'call', title: B('Videollamada con las familias', 'Video call with the families'), hint: (s) => (s.crew.includes('com') ? B('+12 % salud', '+12% health') : B('+4 % salud (los mensajes tardan minutos)', '+4% health (messages take minutes)')),
            run: (s) => ({ text: s.crew.includes('com') ? B('Amara organiza los mensajes para que parezca una conversación. ¡Sonrisas para todos!', 'Amara arranges the messages so it feels like a conversation. Smiles all round!')
              : B('Con minutos de retraso cuesta hablar, pero ver a la familia ayuda un poco.', 'With minutes of delay it is hard to chat, but seeing family helps a little.'), d: { health: s.crew.includes('com') ? 12 : 4 } }) },
          { fx: 'party', title: B('Fiesta con la comida especial', 'Party with the special food'), hint: B('+8 % salud · −6 días de provisiones', '+8% health · −6 days of supplies'),
            run: () => ({ text: B('Postre, música y un torneo de juegos flotantes. El ambiente mejora mucho.', 'Dessert, music and a floating games tournament. The mood improves a lot.'), d: { health: 8, food: -6 } }) },
          { fx: 'work', title: B('Seguir trabajando', 'Keep working'), hint: B('−10 % salud', '−10% health'),
            run: () => ({ text: B('El trabajo sale, pero el cansancio y el mal humor se acumulan.', 'The work gets done, but tiredness and bad moods build up.'), d: { health: -10 } }) },
        ] },
      { id: 'sponsor', icon: '🎥', title: B('Un anuncio desde el espacio', 'An advert from space'),
        text: B('Una empresa de la Tierra ofrece 100 M€ por grabar un anuncio dentro de la nave. Pero llevará días de trabajo extra para la tripulación.',
          'A company on Earth offers €100M to film an advert inside the ship. But it will mean days of extra work for the crew.'),
        fact: B('En la Estación Espacial ya se han grabado anuncios, entrevistas e incluso escenas de una película.', 'Adverts, interviews and even scenes from a film have already been shot on the Space Station.'),
        choices: [
          { fx: 'yes', title: B('Aceptar', 'Accept'), hint: B('+100 M€ · −10 % salud', '+€100M · −10% health'),
            run: () => ({ text: B('Tres días de grabación agotadores, pero el dinero llega a la cuenta de la misión.', 'Three exhausting days of filming, but the money lands in the mission’s account.'), d: { budget: 100, health: -10 } }) },
          { fx: 'short', title: B('Aceptar, pero solo una mañana', 'Accept, but only one morning'), hint: B('+40 M€', '+€40M'),
            run: () => ({ text: B('Un vídeo corto y divertido. Pagan menos, pero nadie se agota.', 'A short, fun video. They pay less, but nobody gets worn out.'), d: { budget: 40 } }) },
          { fx: 'no', title: B('Rechazarlo', 'Turn it down'), hint: B('Sin cambios', 'No change'),
            run: () => ({ text: B('La misión es lo primero. Seguís con lo vuestro.', 'The mission comes first. You carry on.'), d: {} }) },
        ] },
    ];
    const FIXED_IDS = ['launch', 'orbit', 'moon', 'arrive', 'land'];
    const MID_DAYS = [30, 65, 100, 140, 175];
    function buildTrip() {
      const pool = EVENTS.filter((e) => !FIXED_IDS.includes(e.id)).concat(NEW_EVENTS.filter((e) => e.id !== 'cables'));
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const mid = shuffle(shuffle(pool).slice(0, MID_DAYS.length - 1).concat(byId(NEW_EVENTS, 'cables')));
      const month = (d) => Math.max(1, Math.ceil(d / 30));
      return [byId(EVENTS, 'launch'), byId(EVENTS, 'orbit'), byId(EVENTS, 'moon')]
        .concat(mid.map((e, i) => Object.assign({}, e, { day: MID_DAYS[i], place: B(`Crucero · mes ${month(MID_DAYS[i])}`, `Cruise · month ${month(MID_DAYS[i])}`) })))
        .concat(byId(EVENTS, 'arrive'), byId(EVENTS, 'land'));
    }
    const stages = () => [B('Preparación', 'Preparation')].concat(s.events ? s.events.map((e) => e.place) : Array.from({ length: 10 }, () => B('…', '…')));


    // ---------- Ilustraciones (SVG con las fotos reales de la Tierra, la Luna y Marte) ----------
    const IMG = { earth: ['img/tierra-apollo17.jpg', 1.125], moon: ['img/luna-lro.jpg', 1.02], mars: ['img/marte-hubble-2003.jpg', 1.15] };
    const STARS = (() => {
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let out = '';
      for (let i = 0; i < 70; i++) out += `<circle ${i % 4 === 0 ? `class="tw" style="animation-delay:${(i % 7) * 0.4}s"` : ''} cx="${(rnd() * 640).toFixed(1)}" cy="${(rnd() * 280).toFixed(1)}" r="${(rnd() * 1.1 + 0.3).toFixed(2)}" opacity="${(rnd() * 0.7 + 0.2).toFixed(2)}"/>`;
      return `<g class="sc-stars" fill="#fff">${out}</g>`;
    })();
    const DEFS = (p) => `<defs>
      <radialGradient id="${p}-shade" cx="32%" cy="30%" r="80%"><stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".75"/></radialGradient>
      <linearGradient id="${p}-body" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#aeb8cc"/></linearGradient>
      <linearGradient id="${p}-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffa03c"/><stop offset="1" stop-color="#ff4a1c" stop-opacity="0"/></linearGradient>
      <linearGradient id="${p}-flameh" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffa03c"/><stop offset="1" stop-color="#ff4a1c" stop-opacity="0"/></linearGradient>
      <radialGradient id="${p}-sun"><stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffc857"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}-glow"><stop offset="0" stop-color="#ff9a5a" stop-opacity=".9"/><stop offset="1" stop-color="#ff5a2a" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}-vign" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".6"/></radialGradient>
      <linearGradient id="${p}-plume" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dce6" stop-opacity="0"/><stop offset=".7" stop-color="#d9dce6" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".8"/></linearGradient>
      <linearGradient id="${p}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2140"/><stop offset="1" stop-color="#3a2f4a"/></linearGradient>
    </defs>`;
    function planet(p, body, cx, cy, r, extra = '') {
      const [src, z] = IMG[body];
      const sz = r * 2 * z;
      return `<g class="sc-planet ${body} ${extra}"><clipPath id="${p}-cp-${body}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
        <circle cx="${cx}" cy="${cy}" r="${r * 1.5}" fill="${body === 'mars' ? 'rgba(255,106,61,.12)' : body === 'earth' ? 'rgba(78,163,255,.14)' : 'rgba(220,225,240,.08)'}"/>
        <image href="${src}" x="${cx - sz / 2}" y="${cy - sz / 2}" width="${sz}" height="${sz}" clip-path="url(#${p}-cp-${body})" preserveAspectRatio="xMidYMid slice"/>
        ${body === 'mars' ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(230,60,20,.2)"/>` : ''}
        ${body === 'moon' ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(210,215,225,.35)" style="mix-blend-mode:screen"/>` : ''}
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${p}-shade)"/></g>`;
    }
    // Cohete vertical apoyado en (x, y) de altura h
    function rocket(p, x, y, h, kind, attrs = '') {
      const w = h * 0.2;
      const boosters = kind === 'heavy' ? [-1, 1].map((sgn) => `<g transform="translate(${sgn * w * 0.78} 0)">
          <rect x="${-w * 0.28}" y="${-h * 0.55}" width="${w * 0.56}" height="${h * 0.55}" rx="${w * 0.1}" fill="url(#${p}-body)"/>
          <path d="M${-w * 0.28} ${-h * 0.55} Q0 ${-h * 0.7} ${w * 0.28} ${-h * 0.55}Z" fill="#cfd6e4"/></g>`).join('') : '';
      const legs = kind === 'reuse' ? `<path d="M${-w * 0.5} ${-h * 0.08} L${-w * 0.95} 0 M${w * 0.5} ${-h * 0.08} L${w * 0.95} 0" stroke="#8a93a8" stroke-width="2"/>
          <path d="M${-w * 0.6} ${-h * 0.78} h${-w * 0.25} M${w * 0.6} ${-h * 0.78} h${w * 0.25}" stroke="#8a93a8" stroke-width="3"/>` : '';
      const acc = kind === 'light' ? '#4ea3ff' : kind === 'reuse' ? '#6be3b5' : '#ff6a3d';
      return `<g class="rk" transform="translate(${x} ${y})" ${attrs}><g class="rk-in">
        <g class="rk-flame"><path d="M${-w * 0.4} 0 Q0 ${h * 0.6} ${w * 0.4} 0Z" fill="url(#${p}-flame)"/></g>
        ${boosters}${legs}
        <path d="M${-w / 2} ${-h * 0.25} L${-w * 0.95} 0 L${-w / 2} 0Z M${w / 2} ${-h * 0.25} L${w * 0.95} 0 L${w / 2} 0Z" fill="${acc}"/>
        <rect x="${-w / 2}" y="${-h * 0.85}" width="${w}" height="${h * 0.85}" rx="${w * 0.12}" fill="url(#${p}-body)"/>
        <rect x="${-w / 2}" y="${-h * 0.38}" width="${w}" height="${h * 0.05}" fill="${acc}"/>
        <path d="M${-w / 2} ${-h * 0.85} Q0 ${-h * 1.12} ${w / 2} ${-h * 0.85}Z" fill="${acc}"/>
        <circle cy="${-h * 0.64}" r="${w * 0.2}" fill="#4ea3ff" stroke="#2a3550" stroke-width="1.5"/></g></g>`;
    }
    // Nave horizontal (mira a +x) con paneles solares arriba y abajo
    function ship(p, extra = '', stuck = false) {
      return `<g class="ship ${extra}"><g class="ship-in">
        <g class="ship-flame"><path d="M-27 -6 Q-58 0 -27 6Z" fill="url(#${p}-flameh)"/></g>
        <g class="ship-retro"><path d="M22 -5 Q48 0 22 5Z" fill="url(#${p}-flameh)" transform="scale(-1 1) translate(-44 0)"/></g>
        <rect x="-8" y="-62" width="16" height="48" rx="2" fill="#25407a" stroke="#7fb0ff" stroke-width="1"/>
        <path d="M-8 -50 h16 M-8 -38 h16 M-8 -26 h16 M0 -62 v48" stroke="#7fb0ff" stroke-width=".6"/>
        <g class="panel-b${stuck ? ' stuck' : ''}"><rect x="-8" y="14" width="16" height="48" rx="2" fill="#25407a" stroke="#7fb0ff" stroke-width="1"/>
        <path d="M-8 26 h16 M-8 38 h16 M-8 50 h16 M0 14 v48" stroke="#7fb0ff" stroke-width=".6"/></g>
        <path d="M-20 -6 L-28 -9 L-28 9 L-20 6Z" fill="#8a93a8"/>
        <rect x="-21" y="-12" width="42" height="24" rx="5" fill="url(#${p}-body)"/>
        <line x1="-4" y1="-12" x2="-4" y2="-18" stroke="#aab3c8" stroke-width="1.5"/><path d="M-12 -24 Q-4 -15 4 -24Z" fill="#eef1f7"/>
        <circle cx="10" cy="0" r="4" fill="#4ea3ff" stroke="#2a3550" stroke-width="1"/>
        <path d="M21 -8 Q30 0 21 8Z" fill="#ff6a3d"/></g></g>`;
    }
    function avatar(c, size = 48) {
      const A = { pilot: ['#2b4c8c', '#f1c7a5', '#3b2416'], eng: ['#8c5a2b', '#d9a27c', '#c9c9c9'], med: ['#2b8c6a', '#8d5a3b', '#1d1d1d'],
        geo: ['#6a2b8c', '#f3d2b3', '#1d1d1d'], com: ['#8c2b4a', '#5b3a29', '#2b1b12'] }[c.id];
      const [suit, skin, hair] = A;
      return `<svg class="adv-ava" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="24" cy="24" r="23" fill="${suit}" opacity=".35"/><path d="M6 46 Q24 28 42 46Z" fill="${suit}"/>
        <path d="M16 38 l8 4 l8 -4" stroke="#fff" stroke-opacity=".5" fill="none" stroke-width="1.5"/>
        <circle cx="24" cy="21" r="10" fill="${skin}"/>
        <path d="${c.id === 'med' || c.id === 'com' ? 'M13 22 Q12 9 24 9 Q36 9 35 22 Q33 14 24 14 Q15 14 13 22Z' : c.id === 'eng' ? 'M14 18 Q16 10 24 10 Q32 10 34 18 Q28 14 24 14 Q20 14 14 18Z' : 'M14 19 Q15 10 24 10 Q33 10 34 19 Q30 13 22 14 Q17 15 14 19Z'}" fill="${hair}"/>
        <circle cx="20.5" cy="22" r="1.4" fill="#1a1a1a"/><circle cx="27.5" cy="22" r="1.4" fill="#1a1a1a"/>
        <path d="M20.5 26.5 Q24 29 27.5 26.5" stroke="#1a1a1a" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <circle cx="24" cy="21" r="14.5" fill="none" stroke="#cfe5ff" stroke-opacity=".55" stroke-width="2"/></svg>`;
    }
    const svgWrap = (key, state, fx, inner, label) => `<svg class="adv-scene" data-scene="${key}" data-state="${state}" data-fx="${fx || ''}" viewBox="0 0 640 280" role="img" aria-label="${label}">
      ${DEFS('sc')}<rect width="640" height="280" fill="#070a16"/>${STARS}<g class="cam">${inner}</g><rect class="vign" width="640" height="280" fill="url(#sc-vign)" pointer-events="none"/></svg>`;
    const move = (pathId, dur, delay = 0) => `data-move="${pathId}" data-dur="${dur}" data-delay="${delay}"`;

    function prepScene() {
      const p = 'sc';
      if (s.phase === 'goal') {
        const pos = [[150, 70], [490, 70], [150, 215], [490, 215]];
        const marks = GOALS.map((g, i) => { const on = s.goal === g.id, [x, y] = pos[i];
          return `<g class="goal-pick${on ? ' on' : ''}${s.goal && !on ? ' off' : ''}" data-goal="${g.id}"><circle cx="${x}" cy="${y}" r="34" class="gp-ring"/>
            <text x="${x}" y="${y + 11}" text-anchor="middle" font-size="30">${g.icon}</text>
            <path d="M${x + (x < 320 ? 34 : -34)} ${y} L${x < 320 ? 250 : 390} 140" class="gp-line"/></g>`; }).join('');
        return svgWrap('prep-goal', 'idle', '', `${planet(p, 'mars', 320, 140, 82)}${marks}
          <text x="320" y="268" text-anchor="middle" class="sc-hint">${s.goal ? T(goalOf().name) : L('Toca un objetivo para elegirlo', 'Tap a goal to choose it')}</text>`, L('Marte con los cuatro objetivos científicos', 'Mars with the four science goals'));
      }
      if (s.phase === 'rocket') {
        const r = ROCKETS.map((k, i) => {
          const x = 170 + i * 150, h = [95, 140, 185][i];
          const on = s.rocket === k;
          return `<g class="pick${on ? ' on' : ''}${s.rocket && !on ? ' off' : ''}" data-rocket="${k.id}">
            ${on ? `<path d="M${x - 50} 240 L${x - 14} 0 L${x + 14} 0 L${x + 50} 240Z" fill="rgba(255,200,87,.10)"/>` : ''}
            <rect x="${x - 55}" y="20" width="110" height="225" fill="transparent"/>
            ${rocket(p, x, 238, h, k.id)}
            <text x="${x}" y="262" text-anchor="middle" class="sc-label">${num(k.cost)} M€</text></g>`;
        }).join('');
        return svgWrap('prep-rocket', 'idle', '', `<rect y="238" width="640" height="42" fill="#121828"/><path d="M0 238 H640" stroke="#2b3550"/>${r}
          <text x="320" y="22" text-anchor="middle" class="sc-hint">${L('Toca un cohete para elegirlo', 'Tap a rocket to choose it')}</text>`, L('Plataforma de lanzamiento con los tres cohetes', 'Launch pad with the three rockets'));
      }
      if (s.phase === 'crew') {
        const seats = [0, 1, 2, 3].map((i) => {
          const x = 170 + i * 100, id = s.crew[i];
          const c = id && byId(CREW, id);
          return `<g transform="translate(${x - 34} 92)"><rect width="68" height="92" rx="16" fill="#0d1428" stroke="${c ? '#4ea3ff' : '#3a4566'}" stroke-dasharray="${c ? '0' : '5 5'}" stroke-width="2"/>
            ${c ? `<g transform="translate(6 10)"><g class="pop">${avatar(c, 56).replace('<svg', '<svg x="0" y="0"')}</g></g><text x="34" y="82" text-anchor="middle" class="sc-label sm">${T(c.name).split(' · ')[0]}</text>` : `<text x="34" y="54" text-anchor="middle" class="sc-q">?</text>`}</g>`;
        }).join('');
        return svgWrap('prep-crew', 'idle', '', `<rect x="90" y="60" width="460" height="150" rx="70" fill="#1a2238" stroke="#3a4566" stroke-width="2"/>
          <path d="M550 90 Q620 135 550 180Z" fill="#ff6a3d"/><path d="M90 100 L50 85 L50 185 L90 170Z" fill="#8a93a8"/>${seats}
          <text x="320" y="240" text-anchor="middle" class="sc-hint">${L(`Asientos ocupados: ${s.crew.length} de 4`, `Seats taken: ${s.crew.length} of 4`)}</text>`, L('Cápsula con los asientos de la tripulación', 'Capsule with the crew seats'));
      }
      if (s.phase === 'supplies') {
        const n = s.supplies ? Math.round(s.supplies.days / 20) : 0;
        const crates = Array.from({ length: n }, (_, i) => {
          const col = i % 8, row = Math.floor(i / 8);
          return `<g transform="translate(${150 + col * 44} ${170 - row * 50})"><g class="pop" style="animation-delay:${i * 40}ms"><rect width="38" height="40" rx="4" fill="${['#6be3b5', '#4ea3ff', '#ffc857'][i % 3]}" opacity=".85"/><text x="19" y="27" text-anchor="middle" font-size="18">${['🥫', '💧', '🫁'][i % 3]}</text></g></g>`;
        }).join('');
        return svgWrap('prep-sup', 'idle', '', `<rect x="130" y="40" width="380" height="186" rx="10" fill="#111a30" stroke="#3a4566" stroke-width="2"/>
          <path d="M130 116 H510 M130 166 H510" stroke="#2b3550" stroke-width="3"/>${crates}
          <text x="320" y="252" text-anchor="middle" class="sc-hint">${s.supplies ? L(`Bodega: ${s.supplies.days} días de comida, agua y oxígeno`, `Hold: ${s.supplies.days} days of food, water and oxygen`) : L('La bodega está vacía', 'The hold is empty')}</text>`, L('Bodega de provisiones', 'Supplies hold'));
      }
      const slots = TOOLS.map((t, i) => {
        const x = 110 + i * 72, on = s.tools.includes(t.id);
        return `<g transform="translate(${x} 96)"><rect width="60" height="70" rx="10" fill="${on ? 'rgba(255,122,69,.18)' : '#0d1428'}" stroke="${on ? '#ff7a45' : '#3a4566'}" stroke-dasharray="${on ? '0' : '5 5'}" stroke-width="2"/>
          ${on ? `<text class="pop" x="30" y="46" text-anchor="middle" font-size="30">${t.icon}</text>` : ''}</g>`;
      }).join('');
      return svgWrap('prep-tools', 'idle', '', `<rect x="90" y="70" width="460" height="122" rx="14" fill="#151d33" stroke="#3a4566" stroke-width="2"/>${slots}
        <g transform="translate(320 40)"><rect x="-90" y="-24" width="180" height="40" rx="12" fill="${s.instr ? 'rgba(107,227,181,.16)' : '#0d1428'}" stroke="${s.instr ? '#6be3b5' : '#3a4566'}" stroke-dasharray="${s.instr ? '0' : '5 5'}" stroke-width="2"/>
          <text y="3" text-anchor="middle" class="sc-label">${s.instr ? `${byId(INSTR, s.instr).icon} ${T(byId(INSTR, s.instr).name)}` : `🔬 ${L('Sin instrumento', 'No instrument')}`}</text></g>
        <text x="320" y="230" text-anchor="middle" class="sc-hint">${L(`Material cargado: ${s.tools.length} de ${TOOLS.length}`, `Equipment loaded: ${s.tools.length} of ${TOOLS.length}`)}</text>`, L('Compartimento de herramientas', 'Tool bay'));
    }

    function tripScene(e, o) {
      const p = 'sc';
      const state = o ? 'out' : 'idle';
      const fx = o ? o.fx : '';
      const bad = o && o.bad ? ' bad' : '';
      const lbl = T(e.title);
      switch (e.id) {
        case 'launch': {
          const h = { light: 120, reuse: 150, heavy: 175 }[s.rocket.id];
          return svgWrap('launch', state, fx, `<rect width="640" height="280" fill="url(#${p}-sky)" class="sky"/>${STARS}
            <circle class="sun-out" cx="560" cy="60" r="60" fill="url(#${p}-sun)"/>
            <g class="clouds"><ellipse cx="120" cy="40" rx="110" ry="34" fill="#4a4f66"/><ellipse cx="260" cy="30" rx="120" ry="38" fill="#3e4359"/>
              <ellipse cx="430" cy="44" rx="130" ry="36" fill="#4a4f66"/><ellipse cx="590" cy="30" rx="100" ry="34" fill="#3e4359"/></g>
            <path class="bolt" d="M300 60 L285 105 L300 105 L282 150" stroke="#fff6b0" stroke-width="4" fill="none" stroke-linejoin="round"/>
            <rect y="246" width="640" height="34" fill="#121828"/>
            <g class="tower"><rect x="372" y="${246 - h - 10}" width="12" height="${h + 10}" fill="#4a5470"/><path d="M372 ${246 - h} h-26" stroke="#4a5470" stroke-width="4"/></g>
            <g class="smoke"><circle cx="300" cy="246" r="20"/><circle cx="340" cy="250" r="24"/><circle cx="260" cy="250" r="18"/><circle cx="380" cy="248" r="16"/></g>
            <rect class="plume" x="302" y="-120" width="36" height="366" fill="url(#${p}-plume)"/>
            <g class="${bad.trim()}">${rocket(p, 320, 246, h, s.rocket.id)}</g>
            ${state === 'out' ? `<g class="countdown">${['3', '2', '1'].map((n, i) => `<text x="160" y="160" class="cd" style="animation-delay:${i * 0.6}s">${n}</text>`).join('')}<text x="160" y="160" class="cd go" style="animation-delay:1.8s">${L('¡Despegue!', 'Liftoff!')}</text></g>` : ''}
            <rect class="flash" width="640" height="280" fill="#fff"/>`, lbl);
        }
        case 'orbit':
          return svgWrap('orbit', state, fx, `${planet(p, 'earth', 320, 600, 360)}
            <g transform="translate(320 120) scale(1.4)">${ship(p, `${bad}${fx === 'one' ? ' cold' : ''}`, true)}</g>
            ${fx === 'eva' ? `<g transform="translate(${state === 'out' ? 345 : 300} 190)"><g class="astro${bad}"><circle r="7" fill="#fff"/><rect x="-6" y="6" width="12" height="14" rx="4" fill="#e9edf7"/><circle r="4" cy="-1" fill="#ffb84d" opacity=".8"/></g></g>` : ''}
            ${fx === 'patch' ? `<g class="signal"><path d="M560 250 q30 -40 0 -80" /><path d="M580 260 q45 -60 0 -120"/></g>` : ''}
            ${fx === 'one' ? `<text x="360" y="90" class="sc-big">❄️</text>` : ''}`, lbl);
        case 'moon': {
          const P1 = 'M90 200 C 210 250, 320 245, 380 205 S 460 110, 640 40';
          const P1b = 'M90 200 C 210 255, 320 250, 372 218 S 430 200, 470 150 S 560 70, 640 50';
          const P2 = 'M90 200 Q 320 70 640 60';
          const path = fx === 'direct' ? P2 : (bad ? P1b : P1);
          return svgWrap('moon', state, fx, `${planet(p, 'earth', 70, 210, 36)}${planet(p, 'moon', 360, 160, 44)}
            <text x="600" y="28" text-anchor="end" class="sc-label">${L('hacia Marte →', 'to Mars →')}</text>
            <path d="${P1}" class="pred" />
            <path id="mv-path" d="${path}" class="trail ${fx === 'direct' ? 'warn' : ''}" pathLength="1"/>
            <g ${move('mv-path', 3200, 200)} class="mover"><g transform="scale(.6)">${ship(p, state === 'out' ? 'burn' : '')}</g></g>
            ${state === 'out' && fx !== 'direct' && !bad ? `<text x="470" y="96" class="sc-boost">${L('¡Impulso!', 'Boost!')}</text>` : ''}`, lbl);
        }
        case 'storm': {
          const pts = Array.from({ length: 26 }, (_, i) => `<line class="pt" x1="40" y1="${30 + (i * 37) % 220}" x2="${62 + (i % 3) * 8}" y2="${30 + (i * 37) % 220}" style="animation-delay:${((i * 0.23) % 1.6).toFixed(2)}s;animation-duration:${(1.3 + (i % 4) * 0.2).toFixed(1)}s"/>`).join('');
          return svgWrap('storm', state, fx, `<circle class="sunpulse" cx="-30" cy="140" r="170" fill="url(#${p}-sun)"/>${pts}
            <g transform="translate(470 140) scale(1.2)">${ship(p, `${fx === 'ignore' ? ' hurt' : ''}`)}</g>
            <circle class="shield" cx="470" cy="140" r="86"/>
            ${fx === 'shelter' ? `<g class="shelter"><rect x="440" y="215" width="64" height="26" rx="6"/><text x="472" y="233" text-anchor="middle" font-size="14">💧🥫</text></g>` : ''}
            <text class="warn-ic" x="560" y="70" font-size="34">⚠️</text>`, lbl);
        }
        case 'meteor':
          return svgWrap('meteor', state, fx, `<g transform="translate(300 140) scale(1.5)">${ship(p)}
              <g class="module${fx === 'seal' ? ' sealed' : ''}"><rect x="21" y="-14" width="46" height="28" rx="5" fill="url(#${p}-body)"/>
              <circle class="hole" cx="48" cy="-4" r="4" fill="#05070f"/>
              <g class="leak"><circle cx="54" cy="-14" r="2"/><circle cx="60" cy="-22" r="1.6"/><circle cx="50" cy="-26" r="1.3"/></g>
              <rect class="patch" x="42" y="-10" width="12" height="12" rx="2" fill="${fx === 'print' ? '#6be3b5' : '#ffc857'}"/>
              ${fx === 'seal' ? `<path d="M26 -10 L62 10 M62 -10 L26 10" stroke="#ff6a3d" stroke-width="3"/>` : ''}</g></g>
            <g transform="translate(372 134)"><g class="burst">${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="0" x2="${(Math.cos(i * 0.785) * 22).toFixed(1)}" y2="${(Math.sin(i * 0.785) * 22).toFixed(1)}"/>`).join('')}<circle r="10"/></g></g>
            <g class="rock"><line x1="0" y1="0" x2="40" y2="-30" stroke="#ffb48f" stroke-width="2" opacity=".6"/><circle r="4" fill="#d9c2a6"/></g>
            ${fx === 'print' ? `<text x="140" y="70" font-size="34" class="pop">🖨️</text>` : fx === 'kit' ? `<text x="140" y="70" font-size="34" class="pop">🧰</text>` : fx === 'eng' ? `<text x="140" y="70" font-size="34" class="pop">🔧</text>` : ''}`, lbl);
        case 'sick': {
          const dh = o ? (o.d.health || 0) : -1;
          const tone = !o ? 'red' : dh >= 0 ? 'green' : dh > -12 ? 'amber' : 'red';
          const crew = s.crew.map((id, i) => `<g transform="translate(${120 + i * 78} 120)">${avatar(byId(CREW, id), 64).replace('<svg', '<svg x="0" y="0"')}${i === 0 ? `<circle class="fever" cx="32" cy="32" r="36"/><text class="fever-ic" x="52" y="10" font-size="26">🤒</text><text class="ok-ic" x="52" y="10" font-size="26">😊</text>` : ''}</g>`).join('');
          return svgWrap('sick', state, `${fx} ${tone}`, `<rect x="90" y="50" width="460" height="190" rx="24" fill="#131b31" stroke="#3a4566" stroke-width="2"/>${crew}
            <g class="monitor ${tone}"><rect x="400" y="70" width="136" height="104" rx="10" fill="#060a14" stroke="#3a4566" stroke-width="2"/>
            <path d="M400 118 h136" stroke="#1c2540"/>
            <path class="ecg" pathLength="1" d="M406 118 h24 l8 -26 l10 48 l8 -22 h18 l6 -10 l6 10 h50"/>
            <text x="468" y="166" text-anchor="middle" class="sc-label sm">❤️ ${s.health} %</text></g>
            ${fx === 'earth' ? `<g class="signal"><path d="M560 60 q30 30 0 60"/><path d="M575 45 q50 45 0 90"/></g>${planet(p, 'earth', 620, 90, 16)}` : ''}
            ${fx === 'medkit' || fx === 'kit' ? `<text x="440" y="200" font-size="34" class="pop">💊</text>` : ''}`, lbl);
        }
        case 'nav': {
          const ok = 'M80 160 Q 330 120 498 150';
          return svgWrap('nav', state, fx, `${planet(p, 'mars', 560, 150, 56)}
            <path d="M80 160 Q 330 60 640 22" class="drift"/><text x="520" y="54" class="sc-label warn">5.000 km</text>
            <path id="mv-path" d="${ok}" class="trail" pathLength="1"/>
            ${fx === 'antenna' ? `${planet(p, 'earth', 40, 40, 18)}<g class="signal"><path d="M70 40 q20 20 0 40"/><path d="M85 30 q35 30 0 60"/></g>` : ''}
            <g ${move('mv-path', 2600, 300)} class="mover" transform="translate(80 160)"><g transform="scale(.7)">${ship(p, state === 'out' ? 'burn' : '')}</g></g>`, lbl);
        }
        case 'arrive': {
          const path = 'M20 60 C 200 40, 300 70, 330 150';
          return svgWrap('arrive', state, fx, `${planet(p, 'mars', 450, 150, 115)}
            <circle class="atmo" cx="450" cy="150" r="124"/>
            <ellipse class="orbit-line" cx="450" cy="150" rx="150" ry="132" pathLength="1"/>
            <path id="mv-path" d="${path}" class="pred"/>
            <g ${move('mv-path', 2600, 200)} class="mover" transform="translate(20 60)"><g transform="scale(.75)">${ship(p, state === 'out' ? `${fx === 'engine' || fx === 'combo' ? 'retro' : ''}${fx === 'aero' || fx === 'combo' ? ' plasma' : ''}${bad}` : '')}</g></g>`, lbl);
        }
        case 'land': {
          if (fx === 'stay' && state === 'out') return winScene();
          return svgWrap('land', state, fx, `${marsGround(p)}
            <g transform="translate(320 0)"><g class="descent${state === 'out' ? ' down' : ''}${bad}">${lander(p, true)}</g></g>
            ${state === 'out' ? `<g class="dust"><circle cx="300" cy="212" r="14"/><circle cx="340" cy="214" r="18"/><circle cx="320" cy="210" r="10"/></g>` : ''}
            ${state === 'idle' ? ['utopia', 'jezero', 'pole'].map((k, i) => `<g transform="translate(${110 + i * 210} 236)"><circle r="5" fill="#ffe08a"/><text y="22" text-anchor="middle" class="sc-label sm">${{ utopia: 'Utopía', jezero: 'Jezero', pole: L('Polo', 'Pole') }[k]}</text></g>`).join('') : ''}`, lbl);
        }
        case 'signal': {
          const ok = state === 'out' && !o.bad;
          return svgWrap('signal', state, fx, `${planet(p, 'earth', 80, 70, 26)}
            <g transform="translate(400 150)"><g class="${ok ? 'reaim' : 'lost'}"><path class="beam${ok ? ' ok' : ''}" d="M0 -20 L-14 -150 L14 -150Z"/>${ship(p)}</g></g>
            ${ok ? `<g class="signal"><path d="M120 90 q30 30 0 60"/><path d="M140 75 q45 45 0 90"/></g>` : `<text x="560" y="60" font-size="34" class="warn-ic">📵</text>`}`, lbl);
        }
        case 'cables': {
          const cols = ['#ff5a5a', '#4ea3ff', '#ffc857', '#6be3b5'];
          const ok = state === 'out' && fx === 'puzzle' && !o.bad;
          const wires = cols.map((c, i) => { const y = 70 + i * 45, y2 = 70 + ((i * 3) % 4) * 45;
            return `<path d="M150 ${y} h60" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M430 ${y2} h60" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
              ${ok ? `<path class="wire-ok" pathLength="1" d="M210 ${y} C 320 ${y}, 320 ${y2}, 430 ${y2}" stroke="${c}" stroke-width="6" fill="none"/>` : ''}`; }).join('');
          return svgWrap('cables', state, fx, `<rect x="110" y="30" width="420" height="220" rx="16" fill="#131b31" stroke="#3a4566" stroke-width="2"/>
            <rect x="130" y="48" width="380" height="184" rx="8" fill="#0a0f1d"/>${wires}
            ${state === 'idle' || o.bad ? `<g class="zap"><path d="M300 110 l14 18 l-10 4 l16 22" stroke="#fff6b0" stroke-width="3" fill="none"/><path d="M340 170 l-12 14 l10 4 l-14 18" stroke="#fff6b0" stroke-width="3" fill="none"/></g>` : ''}
            <circle class="lamp ${ok || (state === 'out' && !o.bad && fx !== 'backup') ? 'on' : fx === 'backup' && state === 'out' ? 'dim' : 'off'}" cx="560" cy="60" r="14"/>
            ${fx === 'remote' && state === 'out' ? `<g class="signal"><path d="M575 140 q25 25 0 50"/><path d="M590 125 q40 40 0 80"/></g>` : ''}`, lbl);
        }
        case 'oxygen': {
          const good = state === 'out' && !o.bad;
          return svgWrap('oxygen', state, fx, `<rect x="90" y="40" width="460" height="200" rx="24" fill="#131b31" stroke="#3a4566" stroke-width="2"/>
            ${s.crew.slice(0, 3).map((id, i) => `<g transform="translate(${130 + i * 74} 120)"><g class="${good ? '' : 'dizzy'}">${avatar(byId(CREW, id), 60).replace('<svg', '<svg x="0" y="0"')}</g></g>`).join('')}
            <g transform="translate(470 130)"><circle r="52" fill="#060a14" stroke="#3a4566" stroke-width="2"/>
              <path d="M-40 0 A40 40 0 0 1 40 0" fill="none" stroke="#2b3550" stroke-width="8"/>
              <path d="M-40 0 A40 40 0 0 1 -12 -38" fill="none" stroke="#6be3b5" stroke-width="8"/><path d="M12 -38 A40 40 0 0 1 40 0" fill="none" stroke="#ff5a3c" stroke-width="8"/>
              <g class="needle ${good ? 'ok' : 'bad'}"><line x1="0" y1="0" x2="0" y2="-34" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g><circle r="5" fill="#fff"/>
              <text y="30" text-anchor="middle" class="sc-label sm">CO₂</text></g>
            ${fx === 'tape' && state === 'out' ? `<text x="420" y="225" font-size="30" class="pop">📦</text>` : fx === 'printer' && state === 'out' ? `<text x="420" y="225" font-size="30" class="pop">🖨️</text>` : ''}
            <g class="bubbles">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${150 + i * 50}" cy="230" r="${3 + (i % 3)}" style="animation-delay:${i * 0.5}s"/>`).join('')}</g>`, lbl);
        }
        case 'water': {
          const drops = Array.from({ length: 9 }, (_, i) => `<circle class="drop" cx="${360 + (i % 3) * 22}" cy="${120 + Math.floor(i / 3) * 20}" r="${4 + (i % 2) * 2}" style="animation-delay:${(i * 0.3).toFixed(1)}s"/>`).join('');
          return svgWrap('water', state, fx, `<g transform="translate(260 140) scale(1.5)">${ship(p)}</g>
            <g class="${state === 'out' && fx !== 'leave' ? 'stopped' : ''}">${drops}</g>
            ${state === 'out' && (fx === 'kit' || fx === 'eng') ? `<text x="330" y="100" font-size="30" class="pop">${fx === 'kit' ? '🧰' : '🔧'}</text>` : ''}`, lbl);
        }
        case 'asteroid': {
          const photo = state === 'out' && fx !== 'ignore';
          return svgWrap('asteroid', state, fx, `<g class="rockpass ${fx === 'close' && state === 'out' ? 'near' : ''}"><path d="M0 -40 L32 -28 L46 4 L30 36 L-6 44 L-38 26 L-44 -8 L-26 -34Z" fill="#6f6a66" stroke="#9a948e" stroke-width="2"/>
              <circle cx="-10" cy="-8" r="7" fill="#57524f"/><circle cx="16" cy="14" r="5" fill="#57524f"/><circle cx="-18" cy="20" r="4" fill="#57524f"/></g>
            <g transform="translate(150 150) scale(1.1)">${ship(p)}</g>
            ${photo ? `<circle class="camflash" cx="190" cy="150" r="30"/><text x="320" y="60" text-anchor="middle" class="sc-money">+ ${num(o.d.budget || 0)} M€</text>` : ''}`, lbl);
        }
        case 'computer': {
          const ok = state === 'out' && !o.bad;
          return svgWrap('computer', state, fx, `<g transform="translate(470 140)"><g class="${ok ? '' : 'spin'}"><g transform="scale(1.1)">${ship(p)}</g></g></g>
            <rect x="70" y="60" width="250" height="160" rx="12" fill="#060a14" stroke="#3a4566" stroke-width="3"/>
            ${ok ? `<text x="195" y="150" text-anchor="middle" class="sc-ok">SISTEMA OK ✓</text>`
              : `<g class="glitch"><text x="195" y="120" text-anchor="middle" class="sc-err">ERROR 0x3F</text><text x="195" y="160" text-anchor="middle" class="sc-err sm">REBOOT? ▮</text>
              <rect x="80" y="100" width="230" height="4" fill="#ff5a3c" opacity=".5"/><rect x="80" y="175" width="230" height="3" fill="#4ea3ff" opacity=".4"/></g>`}`, lbl);
        }
        case 'morale': {
          const happy = state === 'out' && fx !== 'work';
          return svgWrap('morale', state, fx, `<rect x="90" y="40" width="460" height="200" rx="24" fill="#131b31" stroke="#3a4566" stroke-width="2"/>
            ${s.crew.map((id, i) => `<g transform="translate(${120 + i * 74} 130)">${avatar(byId(CREW, id), 60).replace('<svg', '<svg x="0" y="0"')}<text x="44" y="6" font-size="20" class="${happy ? 'pop' : ''}">${happy ? '😊' : '😔'}</text></g>`).join('')}
            ${fx === 'call' && state === 'out' ? `<rect x="420" y="60" width="110" height="74" rx="8" fill="#060a14" stroke="#4ea3ff"/>${planet(p, 'earth', 475, 97, 26)}` : ''}
            ${fx === 'party' && state === 'out' ? `<g class="confetti">${Array.from({ length: 14 }, (_, i) => `<rect x="${110 + i * 30}" y="50" width="6" height="10" fill="${['#ff5a5a', '#ffc857', '#6be3b5', '#4ea3ff'][i % 4]}" style="animation-delay:${(i * 0.13).toFixed(2)}s"/>`).join('')}</g><text x="470" y="110" font-size="40" class="pop">🎂</text>` : ''}`, lbl);
        }
        case 'sponsor': {
          return svgWrap('sponsor', state, fx, `<rect x="90" y="40" width="460" height="200" rx="24" fill="#131b31" stroke="#3a4566" stroke-width="2"/>
            ${s.crew.slice(0, 2).map((id, i) => `<g transform="translate(${150 + i * 80} 120)">${avatar(byId(CREW, id), 64).replace('<svg', '<svg x="0" y="0"')}</g>`).join('')}
            <text x="420" y="160" font-size="56">🎥</text>
            ${state === 'out' && fx !== 'no' ? `<g class="rec"><circle cx="470" cy="70" r="8" fill="#ff3d2a"/><text x="484" y="76" class="sc-label">REC</text></g><text x="320" y="225" text-anchor="middle" class="sc-money">+ ${num(o.d.budget || 0)} M€</text>` : ''}`, lbl);
        }
        default: return '';
      }
    }

    // Mapa del viaje: la nave avanza de la Tierra a Marte
    const MAP_PATH = 'M38 30 Q 66 8 92 15 Q 118 22 170 32 Q 390 64 598 27';
    function mapView() {
      const STAGES = stages();
      const cur = s.phase === 'trip' ? s.ev + 1 : s.phase === 'end' ? STAGES.length - 1 : 0;
      const f = cur / (STAGES.length - 1);
      const from = s.mapFrom == null ? f : s.mapFrom;
      s.mapFrom = f;
      const stageName = T(STAGES[cur]);
      return `<div class="adv-top"><p class="adv-stage-lbl"><span>${L('Etapa', 'Stage')} ${cur + 1}/${STAGES.length}</span><b>${stageName}</b></p>
        <svg class="adv-map" viewBox="0 0 640 56" role="img" aria-label="${L('Mapa del viaje', 'Journey map')}: ${stageName}">
        ${DEFS('mp')}${planet('mp', 'earth', 22, 30, 17)}${planet('mp', 'moon', 92, 15, 7)}${planet('mp', 'mars', 616, 27, 19)}
        <path d="${MAP_PATH}" fill="none" stroke="rgba(170,185,225,.35)" stroke-dasharray="3 6" stroke-width="2"/>
        <path id="map-path" d="${MAP_PATH}" fill="none" stroke="#ff7a45" stroke-width="3" stroke-linecap="round" pathLength="1"
          stroke-dasharray="1 1" stroke-dashoffset="${1 - from}"/>
        <g data-map="${from}" data-map-to="${f}"><g transform="scale(.32)">${ship('mp')}</g></g></svg>
        <div class="adv-tools">
        ${s.log.length ? `<button type="button" class="adv-diary-btn" data-act="diary" aria-label="${L('Abrir el diario de a bordo', 'Open the logbook')}">📓 <span>${L('Diario', 'Log')}</span> <b>${s.log.length}</b></button>` : ''}
        <button type="button" class="adv-icon-btn" data-act="ach" aria-label="${L('Ver las medallas', 'See the medals')}" title="${L('Medallas', 'Medals')}">🏅<small>${store.get('advAch', []).length}/${ACH.length}</small></button>
        <button type="button" class="adv-icon-btn" data-act="sound" aria-pressed="${SND.on}" aria-label="${SND.on ? L('Silenciar', 'Mute') : L('Activar el sonido', 'Turn sound on')}" title="${L('Sonido', 'Sound')}">${SND.on ? '🔊' : '🔇'}</button>
        ${s.phase !== 'goal' ? `<button type="button" class="adv-icon-btn" data-act="newgame" aria-label="${L('Empezar una partida nueva', 'Start a new game')}" title="${L('Nueva partida', 'New game')}">↺</button>` : ''}</div></div>`;
    }

    // Animaciones con JavaScript: movimiento a lo largo de un camino
    function placeOn(path, el, t) {
      const len = path.getTotalLength();
      const a = path.getPointAtLength(clamp(t, 0, 1) * len);
      const b = path.getPointAtLength(clamp(t + 0.01, 0, 1) * len);
      const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      el.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${t >= 0.995 ? el.dataset.ang || ang : ang})`);
      el.dataset.ang = ang;
    }
    function tween(dur, fn, delay = 0) {
      if (reduceMotion) { fn(1); return; }
      const t0 = performance.now() + delay;
      fn(0);
      const tick = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        if (fn(t) === false) return;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    function animate() {
      root.querySelectorAll('[data-move]').forEach((el) => {
        const path = root.querySelector('#' + el.dataset.move);
        if (!path) return;
        if (el.closest('svg').dataset.state !== 'out') { placeOn(path, el, 0); return; }
        const loop = el.dataset.loop === '1';
        const run = () => tween(+el.dataset.dur, (t) => {
          if (!el.isConnected) return false;
          placeOn(path, el, loop ? t : smooth(t) * 0.5 + t * 0.5);
          if (t === 1 && loop) run();
        }, +el.dataset.delay);
        run();
      });
      const mp = root.querySelector('#map-path'), mk = root.querySelector('[data-map]');
      if (mp && mk) {
        const from = +mk.dataset.map, to = +mk.dataset.mapTo;
        tween(from === to ? 1 : 1400, (t) => {
          if (!mk.isConnected) return false;
          const v = lerp(from, to, smooth(t));
          placeOn(mp, mk, v); mp.setAttribute('stroke-dashoffset', 1 - v);
        });
      }
      // Barras: la de «fantasma» marca lo que se ha perdido o ganado
      requestAnimationFrame(() => requestAnimationFrame(() => {
        root.querySelectorAll('.g-track [data-w]').forEach((b) => { b.style.width = b.dataset.w + '%'; });
      }));
      // Los números cuentan hasta su nuevo valor
      root.querySelectorAll('.g-val[data-from]').forEach((el) => {
        const r = RES.find((x) => x.k === el.dataset.k);
        const a = +el.dataset.from, b = +el.dataset.to;
        tween(1000, (t) => { if (!el.isConnected) return false; el.textContent = r.fmt(Math.round(lerp(a, b, smooth(t)))); }, 250);
      });
    }

    // Efecto visual de cada opción (mismo orden que en EVENTS)
    const FX = { launch: ['wait', 'now'], orbit: ['panels', 'eva', 'patch', 'one'], moon: ['manual', 'manual', 'auto', 'direct'],
      storm: ['shield', 'shelter', 'ignore'], meteor: ['kit', 'print', 'eng', 'seal'], sick: ['medkit', 'med', 'kit', 'earth'],
      nav: ['pilot', 'antenna', 'auto'], arrive: ['aero', 'engine', 'combo', 'aero'] };

    let s;
    function reset() {
      s = { phase: 'goal', goal: null, instr: null, rocket: null, crew: [], supplies: null, tools: [], ev: 0, outcome: null, lowPower: false,
        budget: BUDGET0, fuel: 0, food: 0, health: 100, hull: 0, log: [], end: null, prev: null, mapFrom: null, events: null, puzzle: null, mini: null, diary: false, level: s && s.level || 'normal', science: 0, landed: null, bonus: 0, quiz: null, quizUsed: [], quizOk: 0, quizAsked: [], newAch: [], achOpen: false };
      LV = LEVELS[s.level]; BUDGET0 = LV.budget; s.budget = BUDGET0;
    }
    const crewCost = () => s.crew.reduce((a, id) => a + byId(CREW, id).cost, 0);
    const supCost = (opt) => Math.round(opt.days * Math.max(s.crew.length, 1) * SUP_COST);
    const toolCost = () => s.tools.reduce((a, id) => a + byId(TOOLS, id).cost, 0);
    const spentPrep = () => (s.rocket ? s.rocket.cost : 0) + crewCost() + (s.supplies ? supCost(s.supplies) : 0) + toolCost() + (s.instr ? byId(INSTR, s.instr).cost : 0);

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
    // Nivel de cada recurso: ok, aviso o peligro
    function level(k, v, prep) {
      if (k === 'budget') return v < 0 ? 'danger' : v < 60 ? 'warn' : 'ok';
      if (k === 'food') {
        const need = prep || !s.events ? TRIP : TRIP - s.events[Math.min(s.ev + (s.outcome ? 1 : 0), s.events.length - 1)].day;
        return v < need ? 'danger' : v < need + 20 ? 'warn' : 'ok';
      }
      return v < 30 ? 'danger' : v < 60 ? 'warn' : 'ok';
    }
    function hud() {
      const prep = s.phase !== 'trip' && s.phase !== 'end';
      const vals = prep
        ? { budget: BUDGET0 - spentPrep(), fuel: s.rocket ? Math.min(100, s.rocket.fuel + (s.tools.includes('tank') ? 15 : 0)) : 0,
          food: s.supplies ? s.supplies.days : 0, health: 100, hull: s.rocket ? s.rocket.hull : 0 }
        : s;
      const prev = s.prev;
      return `<div class="adv-hud">${RES.map((r) => {
        const v = vals[r.k];
        const pv = prev ? prev[r.k] : v;
        const pct = clamp(v / r.max, 0, 1) * 100;
        const pPct = clamp(pv / r.max, 0, 1) * 100;
        const dv = v - pv;
        const lv = (prep && !v && r.k !== 'budget') ? 'empty' : level(r.k, v, prep);
        return `<div class="gauge g-${r.k} lv-${lv}${dv < 0 ? ' hit' : dv > 0 ? ' gain' : ''}" title="${T(r.name)}">
          <div class="g-head"><span class="g-ic" aria-hidden="true">${r.icon}</span>
            <b class="g-val" ${dv ? `data-from="${pv}" data-to="${v}" data-k="${r.k}"` : ''}>${r.fmt(pv)}</b></div>
          <div class="g-track"><i class="g-ghost" style="width:${pPct}%" data-w="${pct}"></i><i class="g-fill" style="width:${pPct}%" data-w="${pct}"></i></div><span class="g-name">${T(r.short)}</span>
          ${dv ? `<span class="adv-float ${dv > 0 ? 'up' : 'down'}">${dv > 0 ? '+' : '−'}${r.fmt(Math.abs(dv))}</span>` : ''}</div>`;
      }).join('')}</div>`;
    }
    // Tripulación y herramientas encima de la ilustración
    function crewOverlay() {
      if (!s.crew.length && !s.tools.length) return '';
      const crew = s.crew.map((id) => { const c = byId(CREW, id); return `<span class="ov-ava" title="${T(c.name)}">${avatar(c, 28)}</span>`; }).join('');
      const tools = s.tools.map((id) => { const t = byId(TOOLS, id); return `<span class="ov-tool" title="${T(t.name)}">${t.icon}</span>`; }).join('');
      return `<div class="adv-ov">${crew ? `<div class="ov-crew">${crew}</div>` : ''}${tools ? `<div class="ov-tools">${tools}</div>` : ''}</div>`;
    }
    function banner() {
      const o = s.outcome;
      if (s.phase !== 'trip' || !o) return '';
      const tone = toneOf(o);
      const txt = { ok: L('✅ ¡Bien hecho!', '✅ Well done!'), mid: L('🩹 Superado, con pérdidas', '🩹 Made it, with losses'), bad: L('⚠️ ¡Problemas!', '⚠️ Trouble!') }[tone];
      return `<div class="adv-banner ${tone}" role="status">${txt}</div>`;
    }
    function lostScene() {
      return svgWrap('lost', 'out', 'lost', `${planet('sc', 'mars', 560, 70, 34)}
        <g class="drifter"><g transform="translate(250 160)"><g class="tumble"><g transform="scale(1.3)">${ship('sc', 'hurt')}</g></g></g></g>
        <g class="smoke-trail"><circle cx="210" cy="175" r="10"/><circle cx="180" cy="185" r="14"/><circle cx="145" cy="196" r="18"/></g>`, L('La nave, dañada, va a la deriva', 'The damaged ship drifting'));
    }
    // Módulo de aterrizaje con paracaídas
    function lander(p, chute) {
      return `<g class="lander">${chute ? `<g class="chute"><path d="M-34 -70 Q0 -110 34 -70 Z" fill="#ff7a45" stroke="#fff" stroke-width="1.5"/><path d="M-34 -70 L-8 -18 M34 -70 L8 -18 M0 -98 L0 -18" stroke="#cfd6e4" stroke-width="1"/></g>` : ''}
        <path d="M-18 0 L-26 14 M18 0 L26 14" stroke="#aab3c8" stroke-width="3"/><path d="M-30 14 h8 M22 14 h8" stroke="#aab3c8" stroke-width="3"/>
        <path d="M-20 0 L-14 -18 L14 -18 L20 0Z" fill="url(#${p}-body)"/><rect x="-22" y="-2" width="44" height="6" rx="2" fill="#c9a24a"/>
        <circle cx="0" cy="-10" r="4" fill="#4ea3ff" stroke="#2a3550"/><g class="retro"><path d="M-8 4 Q0 26 8 4Z" fill="url(#${p}-flame)"/></g></g>`;
    }
    function marsGround(p) {
      return `<defs><linearGradient id="${p}-msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a2a"/><stop offset="1" stop-color="#c9805a"/></linearGradient>
        <linearGradient id="${p}-mgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b85a32"/><stop offset="1" stop-color="#6a2a14"/></linearGradient></defs>
        <rect width="640" height="280" fill="url(#${p}-msky)"/><path d="M0 200 Q120 186 230 196 T470 190 T640 198 V280 H0Z" fill="url(#${p}-mgr)"/>
        <path d="M60 206 l30 -14 l26 14Z M500 200 l40 -26 l44 26Z" fill="#8a3a1c"/><circle cx="560" cy="60" r="14" fill="#f6e3c0" opacity=".6"/>`;
    }
    function winScene() {
      if (s.landed) {
        const site = { utopia: B('Utopía', 'Utopia'), jezero: B('Jezero', 'Jezero'), pole: B('Polo norte', 'North pole') }[s.landed];
        return svgWrap('win', 'out', 'landed', `${marsGround('sc')}
          <g transform="translate(300 200)">${lander('sc', false)}</g>
          <g transform="translate(370 210)"><g class="flagup"><path d="M0 0 V-46" stroke="#e9edf7" stroke-width="2.5"/><path d="M0 -46 h30 v18 h-30Z" fill="#ff7a45"/><text x="15" y="-33" text-anchor="middle" font-size="10" fill="#fff">TLL</text></g></g>
          <g transform="translate(250 206)"><g class="astro"><circle r="7" fill="#fff"/><rect x="-6" y="6" width="12" height="14" rx="4" fill="#e9edf7"/><circle r="4" cy="-1" fill="#ffb84d" opacity=".8"/></g></g>
          ${s.landed === 'pole' ? `<path d="M420 214 q30 -10 60 0 q-30 8 -60 0Z" fill="#e8f4ff" opacity=".85"/>` : ''}
          <text x="24" y="36" class="sc-label">📍 ${T(site)}</text>`, L('El módulo de aterrizaje en la superficie de Marte', 'The lander on the surface of Mars'));
      }
      const sparks = Array.from({ length: 14 }, (_, i) => `<circle class="spark" cx="${320 + Math.cos(i) * 170}" cy="${140 + Math.sin(i * 1.7) * 110}" r="${2 + (i % 3)}" style="animation-delay:${(i * 0.21).toFixed(2)}s"/>`).join('');
      return svgWrap('win', 'out', 'win', `${planet('sc', 'mars', 320, 140, 96)}<ellipse class="orbit-line" cx="320" cy="140" rx="160" ry="66" pathLength="1"/>${sparks}
        <path id="mv-path" d="M480 140 A160 66 0 1 1 479.9 139.9" fill="none"/><g data-move="mv-path" data-dur="9000" data-delay="0" data-loop="1" class="mover"><g transform="scale(.5)">${ship('sc')}</g></g>`, L('La nave en órbita de Marte', 'The ship in orbit around Mars'));
    }

    function optCard(o, { on, disabled, reason, cost, group, value }) {
      return `<button type="button" class="adv-opt${on ? ' on' : ''}" data-${group}="${value}" aria-pressed="${!!on}" ${disabled ? 'disabled' : ''}>
        <span class="adv-opt-head"><span class="adv-opt-icon" aria-hidden="true">${o.icon || ''}</span><span class="adv-opt-name">${T(o.name)}</span>${cost != null ? `<span class="adv-cost">${num(cost)} M€</span>` : ''}</span>
        <span class="adv-opt-desc">${T(o.desc)}</span>${o.stats ? `<span class="adv-opt-stats">${o.stats}</span>` : ''}${reason ? `<span class="adv-why">${reason}</span>` : ''}</button>`;
    }

    function prepView() {
      const left = BUDGET0 - spentPrep();
      const cml = CML[s.phase];
      const stepper = `<ol class="cml-steps" aria-label="${L('Niveles de madurez del concepto (CML)', 'Concept maturity levels (CML)')}">${[[1, B('Idea', 'Idea')], [2, B('Viabilidad', 'Feasibility')], [3, B('Opciones', 'Trades')], [4, B('Diseño', 'Design')], [5, B('Lanzar', 'Launch')]]
        .map(([k, nm]) => `<li class="${k < cml[0] ? 'done' : k === cml[0] ? 'now' : ''}"><b>${k < 5 ? `CML ${k}` : '🚀'}</b><span>${T(nm)}</span></li>`).join('')}</ol>`;
      const head = (title, lead) => `${stepper}<p class="kicker">CML ${cml[0]} · ${T(cml[1])} ${segChip(s.phase)}</p><h3 class="adv-title">${title}</h3><p class="adv-text">${lead}</p>`;
      let body = '', ok = false;
      if (s.phase === 'goal') {
        body = GOALS.map((g) => optCard(g, { on: s.goal === g.id, group: 'goal', value: g.id })).join('');
        const lv = `<div class="adv-level" role="radiogroup" aria-label="${L('Dificultad', 'Difficulty')}">${Object.entries(LEVELS).map(([k, v]) => `<button type="button" role="radio" aria-checked="${s.level === k}" data-level="${k}" class="${s.level === k ? 'on' : ''}"><b>${v.icon} ${T(v.name)}</b><small>${T(v.desc)}</small></button>`).join('')}</div>`;
        return head(L('¿Qué queréis descubrir en Marte?', 'What do you want to discover on Mars?'), L('Toda misión empieza con una pregunta científica. Tu objetivo decidirá qué instrumento sirve y dónde conviene aterrizar.', 'Every mission starts with a science question. Your goal will decide which instrument is useful and where it is best to land.'))
          + `<div class="adv-opts">${body}</div>` + lv + nav(!!s.goal, L('Siguiente: el cohete ▶', 'Next: the rocket ▶'), false);
      }
      if (s.phase === 'rocket') {
        body = ROCKETS.map((r) => optCard(Object.assign({}, r, { stats: `<span title="${L('Combustible', 'Fuel')}">⛽ ${r.fuel} %</span><span title="${L('Nave', 'Ship')}">🛰️ ${r.hull} %</span><span title="${L('Riesgo en el despegue', 'Launch risk')}">⚠️ ${Math.round(r.risk * 100)} %</span>` }),
          { on: s.rocket === r, cost: r.cost, group: 'rocket', value: r.id })).join('');
        ok = !!s.rocket;
        return head(L('Elige el cohete', 'Choose the rocket'), L('Un cohete mejor lleva más combustible y aguanta más, pero deja menos dinero para lo demás.', 'A better rocket carries more fuel and is tougher, but leaves less money for everything else.'))
          + `<div class="adv-opts">${body}</div>` + nav(ok, L('Siguiente: el equipo ▶', 'Next: the crew ▶'), true);
      }
      if (s.phase === 'crew') {
        body = CREW.map((c) => {
          const on = s.crew.includes(c.id);
          const full = !on && s.crew.length >= 4;
          const poor = !on && c.cost > left;
          return optCard(Object.assign({}, c, { icon: avatar(c, 34) }), { on, cost: c.cost, group: 'crew', value: c.id, disabled: full || poor, reason: full ? L('Máximo 4 personas', 'Maximum 4 people') : poor ? L('No hay presupuesto', 'Not enough budget') : '' });
        }).join('');
        ok = s.crew.length >= 2;
        return head(L('Forma el equipo (2 a 4)', 'Pick the crew (2 to 4)'), L('Cada especialista cobra un sueldo y resuelve problemas distintos. Más gente = más comida y oxígeno.', 'Each specialist has a salary and solves different problems. More people = more food and oxygen.'))
          + `<div class="adv-opts">${body}</div>` + nav(ok, L('Siguiente: provisiones ▶', 'Next: supplies ▶'), true);
      }
      if (s.phase === 'supplies') {
        body = SUPPLIES.map((o) => {
          const c = supCost(o);
          const poor = s.supplies !== o && c > left + (s.supplies ? supCost(s.supplies) : 0);
          return optCard(Object.assign({ icon: '🥫' }, o), { on: s.supplies === o, cost: c, group: 'sup', value: o.id, disabled: poor, reason: poor ? L('No hay presupuesto', 'Not enough budget') : '' });
        }).join('');
        ok = !!s.supplies;
        return head(L('Comida, agua y oxígeno', 'Food, water and oxygen'), L(`El viaje dura unos ${TRIP} días. El precio depende de cuántas personas viajan (${s.crew.length}).`, `The journey takes about ${TRIP} days. The price depends on how many people travel (${s.crew.length}).`))
          + `<div class="adv-opts">${body}</div>` + nav(ok, L('Siguiente: herramientas ▶', 'Next: tools ▶'), true);
      }
      body = TOOLS.map((t) => {
        const on = s.tools.includes(t.id);
        const poor = !on && t.cost > left;
        return optCard(t, { on, cost: t.cost, group: 'tool', value: t.id, disabled: poor, reason: poor ? L('No hay presupuesto', 'Not enough budget') : '' });
      }).join('');
      const g = goalOf();
      const instr = INSTR.map((t) => {
        const fits = t.id === g.instr, on = s.instr === t.id, poor = !on && t.cost > left;
        return optCard(t, { on, cost: t.cost, group: 'instr', value: t.id, disabled: !fits || poor, reason: !fits ? L(`No sirve para «${T(g.name)}»`, `Not useful for “${T(g.name)}”`) : poor ? L('No hay presupuesto', 'Not enough budget') : L('⭐ Ciencia ×1,5', '⭐ Science ×1.5') });
      }).join('');
      return head(L('Instrumento y herramientas', 'Instrument and tools'), L('Lo que no gastes queda como fondo de emergencia para el viaje.', 'Whatever you do not spend stays as an emergency fund for the trip.'))
        + `<p class="adv-sub">🔬 ${L('Instrumento científico', 'Science instrument')} · <span class="adv-sub-note">${L(`para «${T(g.name)}» solo sirve: ${byId(INSTR, g.instr).icon} ${T(byId(INSTR, g.instr).name)} (⭐ ciencia ×1,5)`, `for “${T(g.name)}” only this fits: ${byId(INSTR, g.instr).icon} ${T(byId(INSTR, g.instr).name)} (⭐ science ×1.5)`)}</span></p>
        <div class="adv-opts instr-row">${instr}</div><p class="adv-sub">🧰 ${L('Herramientas', 'Tools')}</p><div class="adv-opts tools3">${body}</div>` + nav(true, L('🚀 ¡Al despegue!', '🚀 Go for launch!'), true);
    }
    const nav = (ok, label, back) => `<div class="controls adv-nav">${back ? `<button type="button" class="btn small ghost" data-act="back">◀ ${L('Atrás', 'Back')}</button>` : ''}<button type="button" class="btn small primary" data-act="next" ${ok ? '' : 'disabled'}>${label}</button></div>`;

    function tripView() {
      const e = s.events[s.ev];
      if (s.quiz) return quizPanel();
      if (s.puzzle) return puzzlePanel(e);
      if (s.mini) return miniPanel(e);
      const head = `<p class="kicker">${L('Día', 'Day')} ${e.day} · ${T(e.place)} ${segChip(e.id)}</p><h3 class="adv-title"><span aria-hidden="true">${e.icon}</span> ${T(e.title)}</h3>`;
      if (s.outcome) {
        const o = s.outcome;
        const ds = Object.entries(o.d).filter(([, v]) => v).map(([k, v]) => fmtDelta(k, v)).join('') || `<span class="adv-delta">${L('Sin cambios', 'No change')}</span>`;
        return head + `<div class="adv-outcome" aria-live="polite"><p class="adv-chosen">${L('Has elegido', 'You chose')}: <strong>${T(o.choice)}</strong></p><p>${T(o.text)}</p>
          <div class="adv-deltas">${ds}</div>${o.extra ? `<p class="adv-extra">${T(o.extra)}</p>` : ''}</div>
          <aside class="adv-fact"><span aria-hidden="true">💡</span><p>${T(e.fact)}${learnMore(e.id) ? `<br>${learnMore(e.id)}` : ''}</p></aside>
          <div class="controls adv-nav"><button type="button" class="btn small primary" data-act="continue">${s.end ? L('Ver el final ▶', 'See the ending ▶') : L('Continuar ▶', 'Continue ▶')}</button></div>`;
      }
      const opts = e.choices.map((c, i) => {
        const why = check(c.req);
        let hint = typeof c.hint === 'function' ? c.hint(s) : c.hint;
        if (e.id === 'land' && s.goal && goalOf().site === c.fx) hint = B(`${hint.es} · ⭐ ideal para tu objetivo (×2)`, `${hint.en} · ⭐ ideal for your goal (×2)`);
        return `<button type="button" class="adv-opt choice" data-choice="${i}" ${why ? 'disabled' : ''}>
          <span class="adv-opt-name"><span class="adv-key" aria-hidden="true">${'ABCD'[i]}</span>${T(c.title)}</span><span class="adv-opt-desc">${why ? `🔒 ${why}` : T(hint)}</span></button>`;
      }).join('');
      return head + `<p class="adv-text">${T(typeof e.text === 'function' ? e.text(s) : e.text)}</p><div class="adv-opts choices">${opts}</div>`;
    }

    function newAchView() {
      if (!s.newAch || !s.newAch.length) return '';
      return `<div class="adv-newach"><p>${L('Medallas nuevas', 'New medals')}</p>${s.newAch.map((id) => { const a = byId(ACH, id); return `<span title="${T(a.desc)}">${a.icon} ${T(a.name)}</span>`; }).join('')}</div>`;
    }
    function realMissions() {
      const g = goalOf(); if (!g) return '';
      return `<aside class="adv-real"><p class="adv-sub">🛰️ ${L(`Misiones reales parecidas a la tuya · ${T(g.icon + ' ' + T(g.name))}`, `Real missions similar to yours · ${g.icon} ${T(g.name)}`)}</p><ul>${g.missions.map((m) => `<li>${T(m)}</li>`).join('')}</ul></aside>`;
    }
    function endView() {
      const e = s.end;
      if (!e.win) {
        return `<div class="adv-end fail"><p class="kicker">${L('Fin de la misión', 'Mission over')}</p><h3 class="adv-title">${e.icon} ${T(e.title)}</h3><p class="adv-text">${T(e.text)}</p>
          <p class="adv-text">${L('Revisa el diario de a bordo: ¿qué cambiarías en la preparación?', 'Look back at the logbook: what would you change in the preparation?')}</p>
          ${realMissions()}<div class="controls adv-nav"><button type="button" class="btn small primary" data-act="restart">↺ ${L('Intentarlo otra vez', 'Try again')}</button><button type="button" class="btn small ghost" data-act="diary">📓 ${L('Ver el diario', 'See the logbook')}</button><button type="button" class="btn small ghost" data-act="share">📤 ${L('Compartir', 'Share')}</button></div>${newAchView()}</div>`;
      }
      const rows = e.parts.map((p) => `<li><span>${T(p[0])}</span><b>${p[1] < 0 ? '−' : '+'}${num(Math.abs(p[1]))}</b></li>`).join('');
      let best = 0;
      try { best = +localStorage.getItem('advBest') || 0; if (e.score > best) localStorage.setItem('advBest', e.score); } catch (err) { /* sin almacenamiento */ }
      return `<div class="adv-end win"><p class="kicker">${L('¡Misión cumplida!', 'Mission accomplished!')}</p><h3 class="adv-title">${s.landed ? `🚩 ${L('¡Habéis aterrizado en Marte!', 'You have landed on Mars!')}` : `🔴 ${L('Estáis en órbita de Marte', 'You are in orbit around Mars')}`}</h3>
        <p class="adv-stars" aria-label="${e.stars} / 3">${[0, 1, 2].map((i) => `<span class="${i < e.stars ? 'on' : 'off'}" style="animation-delay:${0.3 + i * 0.35}s">⭐</span>`).join('')}</p>
        <p class="adv-text">${T(e.text)}</p><ul class="adv-score">${rows}<li class="total"><span>${L('Puntuación', 'Score')}</span><b>${num(e.score)}</b></li></ul>
        ${best && e.score <= best ? `<p class="fine">${L('Tu récord', 'Your best')}: ${num(Math.max(best, e.score))}</p>` : (best ? `<p class="fine">🏆 ${L('¡Nuevo récord!', 'New record!')}</p>` : '')}
        ${realMissions()}<div class="controls adv-nav"><button type="button" class="btn small primary" data-act="restart">↺ ${L('Jugar otra vez', 'Play again')}</button><button type="button" class="btn small ghost" data-act="diary">📓 ${L('Ver el diario', 'See the logbook')}</button><button type="button" class="btn small ghost" data-act="share">📤 ${L('Compartir', 'Share')}</button></div>${newAchView()}</div>`;
    }

    function logView() {
      if (!s.log.length) return '';
      return '';
    }

    function render(focus) {
      const trip = s.phase === 'trip';
      const panel = s.phase === 'end' ? endView() : trip ? tripView() : prepView();
      const scene = s.phase === 'end' ? (s.end.win ? winScene() : lostScene()) : trip ? (s.quiz ? quizScene() : s.puzzle ? puzzleScene() : s.mini ? miniScene(s.events[s.ev]) : tripScene(s.events[s.ev], s.outcome)) : prepScene();
      const o = trip && s.outcome;
      const shake = o && (o.bad || Math.min(o.d.health || 0, 0) + Math.min(o.d.hull || 0, 0) <= -20);
      const key = `${s.phase}-${s.ev}-${s.outcome ? 1 : 0}`;
      const enter = key !== s.sceneKey;
      s.sceneKey = key;
      root.innerHTML = `${mapView()}<div class="adv-body${enter ? ' enter' : ''}"><div class="adv-viz">
          <div class="adv-screen${shake ? ' shake' : ''}">${scene}${s.puzzle || s.mini ? '' : crewOverlay()}${banner()}</div>${hud()}</div>
        <div class="adv-panel">${panel}</div></div>`;
      diaryHost.innerHTML = s.diary ? diaryView() : s.achOpen ? achView() : '';
      document.documentElement.classList.toggle('dia-open', !!(s.diary || s.achOpen));
      if (trip && !s.outcome && !s.quiz) markSeen(s.events[s.ev].id);
      saveGame();
      s.prev = null;
      animate();
      if (focus) {
        const h = root.querySelector('.adv-title'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
        const top = root.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.5) root.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        const p = root.querySelector('.adv-panel'); if (p) p.scrollTop = 0;
      }
    }

    // ---------- Diario de a bordo ----------
    // Va fuera de la tarjeta (su desenfoque «atraparía» una ventana fija)
    const diaryHost = document.createElement('div');
    diaryHost.className = 'adv-diary-host';
    document.body.appendChild(diaryHost);
    // Tono de un resultado: mira salud y nave, pero también combustible y provisiones gastados en la decisión
    const toneOf = (o) => {
      const d = o.cd || o.d;
      const hurt = Math.min(d.health || 0, 0) + Math.min(d.hull || 0, 0);
      const fuel = Math.min(d.fuel || 0, 0), food = Math.min(d.food || 0, 0);
      return o.bad || hurt <= -20 || fuel <= -30 ? 'bad' : (hurt < 0 || fuel <= -12 || food <= -20) ? 'mid' : 'ok';
    };
    function diaryView() {
      const items = s.log.map((l, k) => {
        const ds = l.d ? Object.entries(l.d).filter(([, v]) => v).map(([kk, v]) => fmtDelta(kk, v)).join('') : '';
        return `<li class="dia-entry t-${l.tone || 'info'}" style="animation-delay:${Math.min(k, 10) * 0.05}s">
          <div class="dia-day"><span>${L('Día', 'Day')}</span><b>${l.day}</b></div>
          <div class="dia-dot" aria-hidden="true">${l.icon || '📌'}</div>
          <div class="dia-body"><p class="dia-place">${T(l.place)}${l.tone && l.tone !== 'info' ? ` <span class="dia-tag">${{ ok: L('Bien', 'Good'), mid: L('Con pérdidas', 'Losses'), bad: L('Problema', 'Trouble') }[l.tone]}</span>` : ''}</p>
            <h4>${T(l.choice)}</h4>${l.text ? `<p>${T(l.text)}</p>` : ''}${ds ? `<div class="adv-deltas">${ds}</div>` : ''}</div></li>`;
      }).join('');
      const crew = s.crew.map((id) => `<span title="${T(byId(CREW, id).name)}">${avatar(byId(CREW, id), 30)}</span>`).join('');
      return `<div class="adv-diary" role="dialog" aria-modal="true" aria-labelledby="dia-h"><div class="dia-back" data-act="diary-close"></div>
        <div class="dia-book"><header class="dia-head"><div><h3 id="dia-h">📓 ${L('Diario de a bordo', 'Logbook')}</h3>
          <p>${L('Misión The Last Lap', 'Mission The Last Lap')}${s.rocket ? ` · ${T(s.rocket.name)}` : ''}</p></div><div class="dia-crew">${crew}</div>
          <button type="button" class="dia-close" data-act="diary-close" aria-label="${L('Cerrar el diario', 'Close the logbook')}">✕</button></header>
        ${items ? `<ol class="dia-list">${items}</ol>` : `<p class="dia-empty">${L('Todavía no hay entradas. ¡El diario empieza con el despegue!', 'No entries yet. The logbook starts at launch!')}</p>`}</div></div>`;
    }
    // ---------- Minijuego: reconectar los cables ----------
    const WIRES = [
      { c: '#ff5a5a', sym: '●' }, { c: '#4ea3ff', sym: '▲' }, { c: '#ffc857', sym: '■' }, { c: '#6be3b5', sym: '◆' }, { c: '#c58bff', sym: '★' },
    ];
    const pzY = (i, n) => 46 + i * (188 / (n - 1));
    function startPuzzle(i) {
      const eng = s.crew.includes('eng');
      const n = eng ? 4 : 5;
      let right;
      do { right = Array.from({ length: n }, (_, k) => k).sort(() => Math.random() - 0.5); } while (right.some((w, k) => w === k) && Math.random() < 0.85);
      s.puzzle = { choice: i, n, right, links: [], mistakes: 0, sel: null, wrong: null, t0: performance.now(), dur: Math.round((eng ? 22 : 16) * 1000 * LV.time) };
      render(true);
      puzzleTimer();
    }
    function puzzleTimer() {
      const tick = () => {
        const p = s.puzzle;
        if (!p) return;
        const left = Math.max(0, p.dur - (performance.now() - p.t0));
        const fill = root.querySelector('.pz-timer-fill'), secs = root.querySelector('.pz-secs');
        if (fill) { fill.style.width = (left / p.dur) * 100 + '%'; fill.classList.toggle('hurry', left < 5000); }
        if (secs) secs.textContent = `${Math.ceil(left / 1000)} s`;
        if (left <= 0) return finishPuzzle(false);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    function connect(i, j) {
      const p = s.puzzle;
      if (!p || p.links.includes(i)) return;
      if (p.right[j] === i) { p.links.push(i); p.wrong = null; sfx('plink'); }
      else { p.mistakes++; p.wrong = j; p.t0 -= 1500; sfx('spark'); } // un chispazo resta 1,5 s
      p.sel = null;
      if (p.links.length === p.n) return finishPuzzle(true);
      render(false);
    }
    function finishPuzzle(ok) {
      const p = s.puzzle;
      if (!p) return;
      s.puzzle = null;
      const e = s.events[s.ev], c = e.choices[p.choice];
      const secs = Math.max(0, Math.round((performance.now() - p.t0) / 1000));
      const r = ok
        ? (p.mistakes === 0
          ? { mini: 'wires-perfect', text: B(`¡Perfecto! Todos los cables conectados a la primera en ${secs} segundos. Vuelven las luces.`, `Perfect! All cables connected first time in ${secs} seconds. The lights come back on.`), d: {} }
          : { text: B(`¡Conseguido! Las luces vuelven, aunque ha habido ${p.mistakes} chispazo${p.mistakes > 1 ? 's' : ''} por el camino.`, `Done! The lights come back on, although there ${p.mistakes > 1 ? `were ${p.mistakes} sparks` : 'was 1 spark'} along the way.`), d: { hull: -4 * Math.min(p.mistakes, 4) } })
        : { bad: true, text: B(`Se acaba el tiempo con ${p.links.length} de ${p.n} cables conectados. El panel se recalienta y la cabina se llena de humo.`, `Time runs out with ${p.links.length} of ${p.n} cables connected. The panel overheats and the cabin fills with smoke.`),
          d: { hull: -12 - 4 * (p.n - p.links.length), health: -8 } };
      resolve(e, c, p.choice, r);
    }
    function puzzleScene() {
      const p = s.puzzle, n = p.n;
      const plugL = (i) => { const w = WIRES[i], y = pzY(i, n), on = p.links.includes(i);
        return `<g class="plug L${on ? ' done' : ''}${p.sel === i ? ' sel' : ''}" data-pl="${i}" tabindex="0" role="button" aria-label="${L('Cable', 'Cable')} ${w.sym}">
          <path d="M0 ${y} H108" stroke="${w.c}" stroke-width="10" stroke-linecap="round"/><circle cx="120" cy="${y}" r="27" fill="transparent"/>
          <circle class="ring" cx="120" cy="${y}" r="17" fill="#0a0f1d" stroke="${w.c}" stroke-width="4"/><text x="120" y="${y + 6}" text-anchor="middle" fill="${w.c}" class="pz-sym">${w.sym}</text></g>`; };
      const plugR = (j) => { const w = WIRES[p.right[j]], y = pzY(j, n), on = p.links.includes(p.right[j]);
        return `<g class="plug R${on ? ' done' : ''}${p.wrong === j ? ' wrong' : ''}" data-pr="${j}" tabindex="0" role="button" aria-label="${L('Enchufe', 'Socket')} ${w.sym}">
          <path d="M532 ${y} H640" stroke="${w.c}" stroke-width="10" stroke-linecap="round"/><circle cx="520" cy="${y}" r="27" fill="transparent"/>
          <circle class="ring" cx="520" cy="${y}" r="17" fill="#0a0f1d" stroke="${w.c}" stroke-width="4"/><text x="520" y="${y + 6}" text-anchor="middle" fill="${w.c}" class="pz-sym">${w.sym}</text>
          ${p.wrong === j ? `<g class="pz-spark">${[0, 1, 2, 3, 4, 5].map((k) => `<line x1="520" y1="${y}" x2="${(520 + Math.cos(k) * 30).toFixed(1)}" y2="${(y + Math.sin(k) * 30).toFixed(1)}"/>`).join('')}</g>` : ''}</g>`; };
      const links = p.links.map((i) => { const j = p.right.indexOf(i), y1 = pzY(i, n), y2 = pzY(j, n);
        return `<path class="pz-link" d="M137 ${y1} C 320 ${y1}, 320 ${y2}, 503 ${y2}" stroke="${WIRES[i].c}"/>`; }).join('');
      return `<svg class="adv-scene pz" data-scene="puzzle" data-state="idle" viewBox="0 0 640 280" role="application" aria-label="${L('Minijuego: une cada cable con el enchufe de su mismo color y símbolo', 'Mini-game: connect each cable to the socket with the same colour and symbol')}">
        <rect width="640" height="280" fill="#0b1020"/><rect x="150" y="14" width="340" height="252" rx="14" fill="#0e1528" stroke="#2b3550" stroke-dasharray="6 6"/>
        <text x="320" y="140" text-anchor="middle" class="pz-bg">⚡</text>${links}<path id="pz-temp" class="pz-temp" d=""/>
        ${Array.from({ length: n }, (_, i) => plugL(i)).join('')}${Array.from({ length: n }, (_, j) => plugR(j)).join('')}</svg>`;
    }
    function puzzlePanel(e) {
      const p = s.puzzle;
      return `<p class="kicker">${L('Día', 'Day')} ${e.day} · ${T(e.place)}</p><h3 class="adv-title">⚡ ${L('Reconecta los cables', 'Reconnect the cables')}</h3>
        <p class="adv-text">${L('Une cada cable de la izquierda con el enchufe de la derecha que tenga <strong>el mismo color y símbolo</strong>. Arrástralo, o toca uno y luego su pareja. Cada error da un chispazo y resta tiempo.', 'Connect each cable on the left to the socket on the right with <strong>the same colour and symbol</strong>. Drag it, or tap one and then its pair. Each mistake makes a spark and costs time.')}</p>
        <div class="pz-hud"><div class="pz-timer"><i class="pz-timer-fill"></i></div><span class="pz-secs">${Math.ceil(p.dur / 1000)} s</span></div>
        <div class="pz-stats"><span>🔌 ${p.links.length}/${p.n}</span><span>⚡ ${L('Chispazos', 'Sparks')}: ${p.mistakes}</span>${s.crew.includes('eng') ? `<span>🔧 ${L('Tomás te da más tiempo', 'Tomás gives you more time')}</span>` : ''}</div>
        <div class="controls adv-nav"><button type="button" class="btn small ghost" data-act="giveup">🏳️ ${L('Rendirse', 'Give up')}</button></div>`;
    }
    // Arrastrar un cable
    let drag = null;
    root.addEventListener('pointerdown', (ev) => {
      const g = ev.target.closest && ev.target.closest('[data-pl]');
      if (!g || !s.puzzle || s.puzzle.links.includes(+g.dataset.pl)) return;
      const svg = g.ownerSVGElement;
      drag = { i: +g.dataset.pl, svg, moved: false, x: ev.clientX, y: ev.clientY };
      ev.preventDefault();
    });
    window.addEventListener('pointermove', (ev) => {
      if (!drag || !drag.svg.isConnected) return;
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 6) drag.moved = true;
      const pt = drag.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const q = pt.matrixTransform(drag.svg.getScreenCTM().inverse());
      const y = pzY(drag.i, s.puzzle.n);
      const t = drag.svg.querySelector('#pz-temp');
      if (t) { t.setAttribute('d', `M137 ${y} C ${(137 + q.x) / 2} ${y}, ${(137 + q.x) / 2} ${q.y}, ${q.x} ${q.y}`); t.setAttribute('stroke', WIRES[drag.i].c); }
    });
    window.addEventListener('pointerup', (ev) => {
      if (!drag) return;
      const d0 = drag; drag = null;
      const t = d0.svg.querySelector('#pz-temp'); if (t) t.setAttribute('d', '');
      if (!d0.moved) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const r = el && el.closest && el.closest('[data-pr]');
      if (r) { suppressClick = true; connect(d0.i, +r.dataset.pr); }
    });
    let suppressClick = false;
    // ---------- Minijuegos de habilidad: honda, aerofrenado y antena ----------
    function startMini(type, i) {
      const pilot = s.crew.includes('pilot');
      const m = { type, choice: i, t0: performance.now(), done: false };
      if (type === 'sling') Object.assign(m, { c: 0.62, w: Math.min(0.34, (pilot ? 0.24 : 0.17) * LV.time), speed: 0.9 / LV.time, x: 0, dur: 10000 });
      if (type === 'aero') Object.assign(m, { y: 120, vy: 0, hold: false, inT: 0, lowT: 0, highT: 0, band: Math.round((pilot ? 66 : 54) * LV.time), dur: 8000, delay: 1200, trail: [] });
      if (type === 'antenna') Object.assign(m, { a: 0, va: 0, dir: 0, aim: null, e: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 70), lock: 0, tol: 7 * LV.time, dur: Math.round(14000 * LV.time) });
      s.mini = m;
      render(true);
      requestAnimationFrame(miniLoop);
    }
    let lastT = 0;
    function miniLoop(now) {
      const m = s.mini;
      if (!m || m.done) return;
      const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
      lastT = now;
      const t = now - m.t0;
      const $id = (id) => root.querySelector('#' + id);
      const timer = root.querySelector('.pz-timer-fill');
      if (timer) { timer.style.width = clamp(1 - t / (m.dur + (m.delay || 0)), 0, 1) * 100 + '%'; timer.classList.toggle('hurry', m.dur + (m.delay || 0) - t < 3000); }
      if (m.type === 'sling') {
        m.x = 1 - Math.abs(((t / 1000 * m.speed) % 2) - 1); // va y viene a velocidad constante
        const mk = $id('mn-marker'); if (mk) mk.setAttribute('transform', `translate(${100 + 440 * m.x} 0)`);
        if (t > m.dur) return finishMini('miss');
      }
      if (m.type === 'aero') {
        const band = 150 + Math.sin(t / 900) * 28;
        const top = band - m.band / 2, bot = band + m.band / 2;
        if (t > m.delay) {
          m.vy += (m.hold ? -620 : 300) * dt;
          m.vy = clamp(m.vy, -150, 150);
          m.y = clamp(m.y + m.vy * dt, 20, 262);
          if (m.y < top) m.highT += dt; else if (m.y > bot) m.lowT += dt; else m.inT += dt;
        }
        const x = 40 + 560 * clamp((t - m.delay) / m.dur, 0, 1);
        const bd = $id('mn-band'); if (bd) { bd.setAttribute('y', top); bd.setAttribute('height', m.band); }
        const lo = $id('mn-low'); if (lo) lo.setAttribute('y', bot);
        const sh = $id('mn-ship'); if (sh) { sh.setAttribute('transform', `translate(${x} ${m.y}) rotate(${m.vy / 6})`); sh.classList.toggle('plasma', m.y >= top && m.y <= bot); sh.classList.toggle('hot', m.y > bot); }
        if (t > m.delay && (!m.trail.length || x - m.trail[m.trail.length - 1][0] > 6)) { m.trail.push([x, m.y]); const tr = $id('mn-trail'); if (tr) tr.setAttribute('points', m.trail.map((q) => q.join(',')).join(' ')); }
        const st = $id('mn-status'); const tot = m.inT + m.lowT + m.highT;
        if (st) st.textContent = `${Math.round(tot ? (m.inT / tot) * 100 : 0)} %`;
        const go = $id('mn-go'); if (go) go.style.opacity = t < m.delay ? 1 : 0;
        if (t > m.delay + m.dur) return finishMini('aero');
      }
      if (m.type === 'antenna') {
        if (m.aim != null) { const diff = ((m.aim - m.a + 540) % 360) - 180; m.va += clamp(diff * 6, -400, 400) * dt; }
        m.va += m.dir * 260 * dt;
        m.va *= Math.pow(0.12, dt);
        m.a += m.va * dt;
        m.e += Math.sin(t / 1300) * 14 * dt;
        const diff = Math.abs(((m.a - m.e + 540) % 360) - 180);
        const ok = diff < m.tol;
        m.lock = clamp(m.lock + (ok ? dt / 2 : -dt / 1.5), 0, 1);
        const sh = $id('mn-ship'); if (sh) sh.setAttribute('transform', `translate(320 140) rotate(${m.a})`);
        const ea = $id('mn-earth'); if (ea) { const r = (m.e - 90) * Math.PI / 180; ea.setAttribute('transform', `translate(${320 + Math.cos(r) * 118} ${140 + Math.sin(r) * 118})`); }
        const bm = $id('mn-beam'); if (bm) bm.classList.toggle('ok', ok);
        const lk = $id('mn-lock'); if (lk) lk.setAttribute('width', 200 * m.lock);
        const st = $id('mn-status'); if (st) st.textContent = ok ? L('📶 ¡Señal!', '📶 Signal!') : diff < 30 ? L('📶 Débil', '📶 Weak') : L('📵 Sin señal', '📵 No signal');
        if (m.lock >= 1) return finishMini('locked');
        if (t > m.dur) return finishMini('lost');
      }
      requestAnimationFrame(miniLoop);
    }
    function miniPress() {
      const m = s.mini;
      if (!m || m.done || m.type !== 'sling') return;
      const dist = Math.abs(m.x - m.c);
      finishMini(dist < m.w * 0.15 ? 'perfect' : dist < m.w / 2 ? 'good' : 'miss');
    }
    function finishMini(res) {
      const m = s.mini;
      if (!m || m.done) return;
      m.done = true; lastT = 0;
      const e = s.events[s.ev], c = e.choices[m.choice];
      let r;
      if (m.type === 'sling') {
        r = res === 'perfect' ? { mini: 'sling-perfect', text: B('¡PERFECTO! Encendido en el instante exacto: la Luna os lanza hacia Marte casi gratis.', 'PERFECT! Ignition at the exact moment: the Moon flings you towards Mars almost for free.'), d: { fuel: -3 } }
          : res === 'good' ? { text: B('¡Bien! Un encendido casi perfecto. La honda funciona.', 'Good! An almost perfect burn. The slingshot works.'), d: { fuel: -7 } }
            : { bad: true, text: B('Demasiado pronto o demasiado tarde… Hay que corregir y se gasta mucho combustible.', 'Too early or too late… A correction is needed and lots of fuel is used.'), d: { fuel: -16 } };
      }
      if (m.type === 'aero') {
        const tot = m.inT + m.lowT + m.highT || 1, fin = m.inT / tot;
        const pct = Math.round(fin * 100);
        if (fin >= 0.75) r = { mini: 'aero-pro', text: B(`¡Aerofrenado de maestro! ${pct} % del tiempo dentro de la franja buena.`, `Master aerobraking! ${pct}% of the time inside the good band.`), d: { fuel: -6, hull: -8 } };
        else if (fin >= 0.5) r = { text: B(`Aerofrenado aceptable: ${pct} % dentro de la franja. La nave se calienta un poco más.`, `Acceptable aerobraking: ${pct}% inside the band. The ship heats up a bit more.`), d: { fuel: -8, hull: -15 } };
        else if (m.lowT >= m.highT) r = { bad: true, text: B(`Demasiado bajo (${pct} % en la franja): el escudo térmico se pone al rojo y se daña.`, `Too low (${pct}% in the band): the heat shield glows red and gets damaged.`), d: { fuel: -6, hull: -35 } };
        else r = s.fuel >= 24 ? { bad: true, text: B(`Demasiado alto (${pct} % en la franja): casi no frenáis y hay que terminar con el motor.`, `Too high (${pct}% in the band): you barely slow down and must finish with the engine.`), d: { fuel: -24, hull: -5 } }
          : { bad: true, text: B('Demasiado alto y sin combustible para corregir: la nave repite pasadas bruscas por la atmósfera.', 'Too high and no fuel to correct: the ship makes rough repeat passes through the atmosphere.'), d: { fuel: -s.fuel, hull: -30 } };
      }
      if (m.type === 'antenna') {
        const secs = Math.round((performance.now() - m.t0) / 1000);
        r = res === 'locked'
          ? { mini: secs <= 6 ? 'antenna-fast' : 'antenna', text: B(`¡Contacto recuperado en ${secs} segundos! Llegan de golpe todos los mensajes de la Tierra.`, `Contact restored in ${secs} seconds! All the messages from Earth arrive at once.`), d: {} }
          : { bad: true, text: B('No conseguís fijar la señal. La Tierra tiene que buscaros con todas sus antenas, y eso cuesta dinero y nervios.', 'You cannot lock the signal. Earth has to search for you with all its antennas, which costs money and nerves.'), d: { budget: -30, health: -5 } };
      }
      s.mini = null;
      resolve(e, c, m.choice, r);
    }
    function miniScene(e) {
      const m = s.mini, p = 'sc';
      if (m.type === 'sling') {
        return svgWrap('mini-sling', 'idle', '', `${planet(p, 'earth', 70, 120, 34)}${planet(p, 'moon', 360, 110, 44)}
          <path d="M90 110 C 210 160, 320 155, 380 115 S 460 40, 640 10" class="pred"/>
          <g transform="translate(330 155) rotate(-20) scale(.6)">${ship(p)}</g>
          <text x="320" y="222" text-anchor="middle" class="sc-label">${L('¡Enciende cuando la aguja esté en verde!', 'Fire when the needle is in the green!')}</text>
          <rect x="100" y="234" width="440" height="22" rx="11" fill="#0a0f1d" stroke="#3a4566" stroke-width="2"/>
          <rect x="${100 + 440 * (m.c - m.w / 2)}" y="236" width="${440 * m.w}" height="18" rx="9" fill="#2fae7f" opacity=".7"/>
          <rect x="${100 + 440 * (m.c - m.w * 0.15)}" y="236" width="${440 * m.w * 0.3}" height="18" rx="5" fill="#8ff0c8"/>
          <g id="mn-marker"><path d="M0 228 L-7 220 H7Z M0 228 V262" stroke="#fff" stroke-width="3" fill="#fff"/></g>`, L('Minijuego: encendido en el momento justo', 'Mini-game: fire at the right moment'));
      }
      if (m.type === 'aero') {
        return svgWrap('mini-aero', 'idle', '', `${planet(p, 'mars', 320, 900, 680)}
          <rect id="mn-low" x="0" y="190" width="640" height="200" fill="rgba(255,60,30,.22)"/>
          <rect id="mn-band" x="0" y="130" width="640" height="46" fill="rgba(255,170,90,.28)" stroke="#ffb36b" stroke-dasharray="6 6"/>
          <text x="630" y="20" text-anchor="end" class="sc-label sm">${L('Arriba: no frena', 'Up high: no braking')}</text>
          <text x="630" y="272" text-anchor="end" class="sc-label sm warn">${L('Abajo: ¡quema!', 'Down low: it burns!')}</text>
          <polyline id="mn-trail" points="" fill="none" stroke="#ffb36b" stroke-width="3" stroke-linecap="round" opacity=".7"/>
          <g id="mn-ship" transform="translate(40 120)"><g transform="scale(.55)">${ship(p)}</g></g>
          <text id="mn-go" x="320" y="110" text-anchor="middle" class="cd go" style="opacity:1;animation:none">${L('¡Prepárate!', 'Get ready!')}</text>`, L('Minijuego: mantén la nave en la franja de la atmósfera', 'Mini-game: keep the ship in the atmosphere band'));
      }
      return svgWrap('mini-antenna', 'idle', '', `<circle cx="320" cy="140" r="118" fill="none" stroke="rgba(170,185,225,.18)" stroke-dasharray="3 7"/>
        <g id="mn-earth" transform="translate(320 22)">${planet(p, 'earth', 0, 0, 20)}</g>
        <g id="mn-ship" transform="translate(320 140)"><path id="mn-beam" class="beam" d="M0 -20 L-14 -150 L14 -150Z"/><g transform="rotate(0)">${ship(p)}</g></g>
        <rect x="220" y="252" width="200" height="12" rx="6" fill="#0a0f1d" stroke="#3a4566"/><rect id="mn-lock" x="220" y="252" width="0" height="12" rx="6" fill="#6be3b5"/>
        <text x="320" y="244" text-anchor="middle" class="sc-label sm">${L('Fija la señal 2 segundos', 'Hold the signal for 2 seconds')}</text>`, L('Minijuego: apunta la antena a la Tierra', 'Mini-game: point the antenna at Earth'));
    }
    function miniPanel(e) {
      const m = s.mini;
      const head = `<p class="kicker">${L('Día', 'Day')} ${e.day} · ${T(e.place)} · ${L('Minijuego', 'Mini-game')}</p>`;
      const bar = `<div class="pz-hud"><div class="pz-timer"><i class="pz-timer-fill"></i></div><span class="pz-secs" id="mn-status"></span></div>`;
      if (m.type === 'sling') return head + `<h3 class="adv-title">🌙 ${L('Enciende el motor detrás de la Luna', 'Fire the engine behind the Moon')}</h3>
        <p class="adv-text">${L('La aguja va y viene. Pulsa <strong>¡Encender!</strong> (o la barra espaciadora) cuando esté en la zona verde. En la verde clara, ¡encendido perfecto!', 'The needle swings back and forth. Press <strong>Fire!</strong> (or the space bar) when it is in the green zone. In the light green, a perfect burn!')}${s.crew.includes('pilot') ? ` ${L('Valeria agranda la zona verde.', 'Valeria makes the green zone bigger.')}` : ''}</p>
        ${bar}<div class="controls adv-nav"><button type="button" class="btn primary mini-big" data-mini="press">🔥 ${L('¡Encender!', 'Fire!')}</button></div>`;
      if (m.type === 'aero') return head + `<h3 class="adv-title">🔥 ${L('Pilota el aerofrenado', 'Fly the aerobraking')}</h3>
        <p class="adv-text">${L('<strong>Mantén pulsado</strong> el botón (o la barra espaciadora, o la pantalla) para subir y suéltalo para bajar. Quédate dentro de la franja naranja: más abajo te quemas; más arriba no frenas.', '<strong>Hold</strong> the button (or the space bar, or the screen) to climb and let go to drop. Stay inside the orange band: lower and you burn; higher and you do not brake.')}</p>
        ${bar}<div class="controls adv-nav"><button type="button" class="btn primary mini-big" data-mini="hold">⬆️ ${L('Mantener para subir', 'Hold to climb')}</button></div>`;
      return head + `<h3 class="adv-title">📡 ${L('Apunta la antena a la Tierra', 'Point the antenna at Earth')}</h3>
        <p class="adv-text">${L('Gira la nave con <strong>◀ ▶</strong> (o las flechas del teclado, o tocando hacia dónde quieres apuntar) hasta que el haz toque la Tierra. Mantén la señal 2 segundos.', 'Turn the ship with <strong>◀ ▶</strong> (or the arrow keys, or by tapping where you want to point) until the beam touches Earth. Hold the signal for 2 seconds.')}</p>
        ${bar}<div class="controls adv-nav mini-pad"><button type="button" class="btn mini-big" data-mini="left" aria-label="${L('Girar a la izquierda', 'Turn left')}">◀</button><button type="button" class="btn mini-big" data-mini="right" aria-label="${L('Girar a la derecha', 'Turn right')}">▶</button></div>`;
    }
    // Controles de los minijuegos (ratón, táctil y teclado)
    const miniDown = (ev) => {
      const m = s.mini;
      if (!m) return;
      const b = ev.target.closest && ev.target.closest('[data-mini]');
      const onScene = ev.target.closest && ev.target.closest('.adv-screen');
      if (!b && !onScene) return;
      const k = b ? b.dataset.mini : null;
      if (m.type === 'sling' && (k === 'press' || onScene)) { ev.preventDefault(); miniPress(); }
      if (m.type === 'aero' && (k === 'hold' || onScene)) { ev.preventDefault(); m.hold = true; }
      if (m.type === 'antenna') {
        if (k === 'left' || k === 'right') { ev.preventDefault(); m.dir = k === 'left' ? -1 : 1; m.aim = null; }
        else if (onScene) { ev.preventDefault(); m.aiming = true; aimAt(ev); }
      }
    };
    const aimAt = (ev) => {
      const svg = root.querySelector('.adv-scene'); if (!svg || !s.mini) return;
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      s.mini.aim = Math.atan2(q.y - 140, q.x - 320) * 180 / Math.PI + 90;
    };
    root.addEventListener('pointerdown', miniDown);
    window.addEventListener('pointermove', (ev) => { if (s.mini && s.mini.aiming) aimAt(ev); });
    window.addEventListener('pointerup', () => { if (s.mini) { s.mini.hold = false; s.mini.dir = 0; s.mini.aiming = false; } });
    document.addEventListener('keydown', (ev) => {
      const m = s.mini; if (!m || ev.repeat && m.type === 'sling') return;
      if (ev.key === ' ' || ev.key === 'ArrowUp') { if (m.type === 'sling') { ev.preventDefault(); miniPress(); } if (m.type === 'aero') { ev.preventDefault(); m.hold = true; } }
      if (m.type === 'antenna' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); m.dir = ev.key === 'ArrowLeft' ? -1 : 1; m.aim = null; }
    });
    document.addEventListener('keyup', (ev) => {
      const m = s.mini; if (!m) return;
      if (ev.key === ' ' || ev.key === 'ArrowUp') m.hold = false;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') m.dir = 0;
    });

    // ---------- «Saber más»: cada dato enlaza con su apartado de la web ----------
    const LINKS = { launch: ['#oposicion', B('La oposición de Marte', 'The opposition of Mars')], orbit: ['#orientacion', B('La nave gira sobre sí misma', 'The spacecraft turns on itself')],
      moon: ['#honda', B('El efecto honda', 'The slingshot effect')], storm: ['#magnetismo', B('¿Marte tiene campo magnético?', 'Does Mars have a magnetic field?')],
      sick: ['#distancias', B('Comparador de distancias', 'Distance comparison')], nav: ['#mision', B('La misión paso a paso', 'The mission step by step')],
      arrive: ['#mision', B('El aerofrenado (paso 5)', 'Aerobraking (step 5)')], signal: ['#orientacion', B('Apuntar la antena', 'Pointing the antenna')],
      land: ['#gravedad', B('Simulador de gravedad', 'Gravity simulator')], meteor: ['#mision', B('La misión paso a paso', 'The mission step by step')] };
    const learnMore = (id) => (LINKS[id] ? `<a class="adv-more" href="${LINKS[id][0]}">📖 ${L('Saber más', 'Learn more')}: ${T(LINKS[id][1])} →</a>` : '');

    // ---------- Preguntas rápidas entre capítulos ----------
    const QUIZ = [
      { q: B('¿Por qué no se viaja a Marte en línea recta?', 'Why don’t we fly to Mars in a straight line?'), link: '#mision',
        o: [B('Porque todo se mueve: la nave sigue una órbita curva alrededor del Sol', 'Because everything moves: the ship follows a curved orbit around the Sun'), B('Para esquivar los asteroides', 'To dodge the asteroids'), B('Porque la Luna está en medio', 'Because the Moon is in the way')],
        x: B('La nave «persigue» a Marte por una órbita curva y apunta a donde estará, no a donde está.', 'The ship “chases” Mars along a curved orbit and aims at where it will be, not where it is.') },
      { q: B('¿Cada cuánto se repite la oposición de Marte?', 'How often does the opposition of Mars happen?'), link: '#oposicion',
        o: [B('Unos 26 meses', 'About 26 months'), B('Cada año', 'Every year'), B('Cada 10 años', 'Every 10 years')],
        x: B('La Tierra adelanta a Marte cada ~26 meses: por eso las ventanas de lanzamiento llegan con ese ritmo.', 'Earth overtakes Mars every ~26 months: that is why launch windows come at that pace.') },
      { q: B('¿Qué consigue el efecto honda?', 'What does the slingshot effect do?'), link: '#honda',
        o: [B('Ganar velocidad usando la gravedad de un astro que se mueve', 'Gain speed using the gravity of a moving body'), B('Frenar sin gastar combustible', 'Brake without using fuel'), B('Protegerse de la radiación', 'Shield against radiation')],
        x: B('La nave «roba» un poco del movimiento del astro y sale más rápido, sin gastar combustible.', 'The ship “steals” a little of the body’s motion and leaves faster, without using fuel.') },
      { q: B('¿Cuánto tarda un mensaje de radio de la Tierra a Marte?', 'How long does a radio message take from Earth to Mars?'), link: '#distancias',
        o: [B('Entre 3 y 22 minutos', 'Between 3 and 22 minutes'), B('Menos de 1 segundo', 'Under 1 second'), B('Unos 3 días', 'About 3 days')],
        x: B('Viaja a la velocidad de la luz, pero Marte está tan lejos que tarda minutos. ¡No se puede hablar en directo!', 'It travels at the speed of light, but Mars is so far away it takes minutes. You cannot talk live!') },
      { q: B('¿Por qué Marte perdió gran parte de su atmósfera?', 'Why did Mars lose much of its atmosphere?'), link: '#magnetismo',
        o: [B('Perdió su campo magnético y el viento solar se la fue arrancando', 'It lost its magnetic field and the solar wind stripped it away'), B('Se la llevó la Luna', 'The Moon took it'), B('Se congeló y cayó al suelo', 'It froze and fell to the ground')],
        x: B('Sin escudo magnético, el viento solar arrancó poco a poco su atmósfera. Lo midió la sonda MAVEN.', 'Without a magnetic shield, the solar wind slowly stripped its atmosphere. The MAVEN probe measured it.') },
      { q: B('¿Qué es el aerofrenado?', 'What is aerobraking?'), link: '#mision',
        o: [B('Frenar rozando la parte alta de la atmósfera', 'Slowing down by skimming the upper atmosphere'), B('Frenar con el viento solar', 'Slowing down with the solar wind'), B('Usar alas para planear', 'Using wings to glide')],
        x: B('En cada vuelta la nave roza la atmósfera y pierde algo de velocidad, sin gastar combustible.', 'On each lap the ship skims the atmosphere and loses some speed, without using fuel.') },
      { q: B('¿Cuánta gravedad tiene Marte comparada con la Tierra?', 'How strong is Mars’ gravity compared with Earth’s?'), link: '#gravedad',
        o: [B('Un 38 %', 'About 38%'), B('El doble', 'Twice as much'), B('La misma', 'The same')],
        x: B('En Marte pesarías algo más de un tercio de lo que pesas aquí.', 'On Mars you would weigh just over a third of what you weigh here.') },
      { q: B('¿A qué distancia está la Luna de la Tierra?', 'How far is the Moon from Earth?'), link: '#distancias',
        o: [B('Unos 384.000 km', 'About 384,000 km'), B('Unos 38.000 km', 'About 38,000 km'), B('Unos 55 millones de km', 'About 55 million km')],
        x: B('384.000 km: lejísimos… pero Marte está unas 150 veces más lejos incluso en sus mejores oposiciones.', '384,000 km: very far… but Mars is about 150 times farther even at its best oppositions.') },
      { q: B('¿Cómo gira una nave en el espacio sin rozar con nada?', 'How does a spacecraft turn in space without anything to push on?'), link: '#orientacion',
        o: [B('Con ruedas de reacción y pequeños propulsores', 'With reaction wheels and small thrusters'), B('Con un timón, como un barco', 'With a rudder, like a boat'), B('No puede girar', 'It cannot turn')],
        x: B('Las ruedas internas giran en un sentido y la nave gira en el contrario. Los propulsores ayudan.', 'Internal wheels spin one way and the ship turns the other way. Thrusters help.') },
    ];
    const QUIZ_AT = [1, 4, 6]; // tras la órbita y tras el 2.º y 4.º capítulo del crucero
    function makeQuiz() {
      const used = s.quizUsed || (s.quizUsed = []);
      const free = QUIZ.map((q, k) => k).filter((k) => !used.includes(k));
      const k = free[Math.floor(Math.random() * free.length)];
      used.push(k);
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      return { k, order, answer: null };
    }
    function quizScene() {
      const q = s.quiz;
      const ok = q.answer != null && q.order[q.answer] === 0;
      return svgWrap('quiz', q.answer == null ? 'idle' : 'out', q.answer == null ? '' : ok ? 'right' : 'wrong', `<rect x="150" y="40" width="340" height="170" rx="14" fill="#14301f" stroke="#7a5a2c" stroke-width="10"/>
        <text x="320" y="150" text-anchor="middle" class="qz-mark">${q.answer == null ? '?' : ok ? '✓' : '✗'}</text>
        <g transform="translate(520 150)">${s.crew[0] ? avatar(byId(CREW, s.crew[0]), 80).replace('<svg', '<svg x="0" y="0"') : ''}</g>
        ${ok ? `<text x="320" y="250" text-anchor="middle" class="sc-money">+ 20 M€</text>` : ''}`, L('Pregunta rápida', 'Quick question'));
    }
    function quizPanel() {
      const q = s.quiz, item = QUIZ[q.k];
      const head = `<p class="kicker">🧠 ${L('Pregunta rápida · si aciertas, +20 M€', 'Quick question · get it right for +€20M')}</p><h3 class="adv-title">${T(item.q)}</h3>`;
      const opts = q.order.map((oi, i) => {
        const cls = q.answer == null ? '' : oi === 0 ? ' right' : q.answer === i ? ' wrong' : '';
        return `<button type="button" class="adv-opt choice quiz${cls}" data-quiz="${i}" ${q.answer != null ? 'disabled' : ''}><span class="adv-opt-name"><span class="adv-key" aria-hidden="true">${'ABC'[i]}</span>${T(item.o[oi])}</span></button>`;
      }).join('');
      const after = q.answer == null ? '' : `<aside class="adv-fact"><span aria-hidden="true">${q.order[q.answer] === 0 ? '✅' : '💡'}</span><p>${T(item.x)}</p></aside>
        <a class="adv-more" href="${item.link}">📖 ${L('Saber más en la web', 'Learn more on the website')} →</a>
        <div class="controls adv-nav"><button type="button" class="btn small primary" data-act="continue">${L('Continuar ▶', 'Continue ▶')}</button></div>`;
      return head + `<div class="adv-opts choices">${opts}</div>` + after;
    }
    function answerQuiz(i) {
      const q = s.quiz; if (!q || q.answer != null) return;
      q.answer = i;
      const ok = q.order[i] === 0, item = QUIZ[q.k];
      if (ok) { s.prev = { budget: s.budget, fuel: s.fuel, food: s.food, health: s.health, hull: s.hull }; s.budget += 20; s.bonus = (s.bonus || 0) + 25; s.quizOk = (s.quizOk || 0) + 1; }
      s.log.push({ day: s.events[s.ev].day, icon: '🧠', place: B('Pregunta rápida', 'Quick question'), choice: item.q, text: ok ? B('¡Correcto! +20 M€ de la agencia.', 'Correct! +€20M from the agency.') : B(`Fallada. Era: ${item.o[0].es}`, `Missed. It was: ${item.o[0].en}`), d: ok ? { budget: 20 } : null, tone: ok ? 'ok' : 'mid' });
      sfx(ok ? 'win' : 'wrong');
      if (ok && s.quizOk === QUIZ_AT.length) unlock('quiz');
      render(false);
    }

    // ---------- Medallas (se guardan en el navegador) ----------
    const ACH = [
      { id: 'first', icon: '🏁', name: B('Primer viaje', 'First trip'), desc: B('Llega a Marte por primera vez.', 'Reach Mars for the first time.') },
      { id: 'pioneer', icon: '🚩', name: B('Pionero', 'Pioneer'), desc: B('Aterriza en el cráter Jezero o en el polo norte.', 'Land in Jezero Crater or at the north pole.') },
      { id: 'three', icon: '⭐', name: B('Misión de libro', 'Textbook mission'), desc: B('Consigue 3 estrellas.', 'Get 3 stars.') },
      { id: 'flawless', icon: '🛡️', name: B('Sin un rasguño', 'Not a scratch'), desc: B('Llega con la salud y la nave por encima del 85 %.', 'Arrive with health and ship above 85%.') },
      { id: 'saver', icon: '💰', name: B('Ahorrador', 'Saver'), desc: B('Termina con más de 300 M€.', 'Finish with more than €300M.') },
      { id: 'veteran', icon: '🎖️', name: B('Veterano', 'Veteran'), desc: B('Gana en difícil.', 'Win on hard.') },
      { id: 'wires', icon: '🔌', name: B('Maestro de los cables', 'Master of cables'), desc: B('Reconecta los cables sin un solo chispazo.', 'Reconnect the cables without a single spark.') },
      { id: 'sling', icon: '🌙', name: B('Tirachinas perfecto', 'Perfect slingshot'), desc: B('Encendido perfecto detrás de la Luna.', 'Perfect burn behind the Moon.') },
      { id: 'aero', icon: '🔥', name: B('Surfista de atmósferas', 'Atmosphere surfer'), desc: B('Aerofrenado de maestro (75 % o más).', 'Master aerobraking (75% or more).') },
      { id: 'antenna', icon: '📡', name: B('Buena señal', 'Strong signal'), desc: B('Recupera el contacto en 6 segundos o menos.', 'Restore contact in 6 seconds or less.') },
      { id: 'quiz', icon: '🧠', name: B('Sabelotodo', 'Know-it-all'), desc: B('Acierta las 3 preguntas de una partida.', 'Answer all 3 questions of a game correctly.') },
      { id: 'explorer', icon: '🧭', name: B('Explorador', 'Explorer'), desc: B('Vive las 12 situaciones posibles del crucero.', 'Live through all 12 possible cruise situations.') },
      { id: 'oops', icon: '🧯', name: B('Se aprende fallando', 'Learning by failing'), desc: B('Pierde una misión. ¡Le pasa a cualquiera!', 'Lose a mission. It happens to everyone!') },
    ];
    const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } } };
    const MINI_ACH = { 'sling-perfect': 'sling', 'aero-pro': 'aero', 'antenna-fast': 'antenna', 'wires-perfect': 'wires' };
    function unlock(id) {
      const have = store.get('advAch', []);
      if (have.includes(id)) return;
      have.push(id); store.set('advAch', have);
      (s.newAch || (s.newAch = [])).push(id);
      const a = byId(ACH, id);
      toast(`<span class="tt-ic">${a.icon}</span><span><small>${L('¡Medalla nueva!', 'New medal!')}</small><b>${T(a.name)}</b></span>`);
      sfx('medal');
    }
    function markSeen(id) {
      const seen = store.get('advSeen', []);
      if (!seen.includes(id)) { seen.push(id); store.set('advSeen', seen); }
      const all = EVENTS.concat(NEW_EVENTS).filter((e) => !FIXED_IDS.includes(e.id)).map((e) => e.id);
      if (all.every((x) => seen.includes(x))) unlock('explorer');
    }
    function awardEnd(end) {
      if (!end.win) return unlock('oops');
      unlock('first');
      if (s.landed === 'jezero' || s.landed === 'pole') unlock('pioneer');
      if (end.stars === 3) unlock('three');
      if (s.health >= 85 && s.hull >= 85) unlock('flawless');
      if (s.budget >= 300) unlock('saver');
      if (s.level === 'hard') unlock('veteran');
    }
    function achView() {
      const have = store.get('advAch', []);
      const items = ACH.map((a) => `<li class="ach${have.includes(a.id) ? ' got' : ''}"><span class="ach-ic">${a.icon}</span><b>${T(a.name)}</b><small>${T(a.desc)}</small></li>`).join('');
      return `<div class="adv-diary" role="dialog" aria-modal="true" aria-labelledby="ach-h"><div class="dia-back" data-act="ach-close"></div>
        <div class="dia-book ach-book"><header class="dia-head"><div><h3 id="ach-h">🏅 ${L('Medallas', 'Medals')}</h3><p>${L(`Tienes ${have.length} de ${ACH.length}`, `You have ${have.length} of ${ACH.length}`)}</p></div>
          <button type="button" class="dia-close" data-act="ach-close" aria-label="${L('Cerrar', 'Close')}">✕</button></header><ul class="ach-grid">${items}</ul></div></div>`;
    }
    function toast(html) {
      const t = document.createElement('div');
      t.className = 'adv-toast'; t.setAttribute('role', 'status'); t.innerHTML = html;
      document.body.appendChild(t);
      setTimeout(() => t.classList.add('out'), 3200);
      setTimeout(() => t.remove(), 3800);
    }

    // ---------- Sonidos (sintetizados con Web Audio, sin archivos) ----------
    const SND = { on: store.get('advSound', true), ctx: null };
    function audio() {
      if (!SND.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { SND.ctx = new C(); } catch (e) { return null; } }
      if (SND.ctx.state === 'suspended') SND.ctx.resume();
      return SND.ctx;
    }
    function tone(f, dur, { type = 'sine', vol = 0.12, when = 0, slide = 0 } = {}) {
      const c = audio(); if (!c) return;
      const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, { vol = 0.15, when = 0, freq = 1000, q = 0.8 } = {}) {
      const c = audio(); if (!c) return;
      const t = c.currentTime + when, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination); src.start(t);
    }
    function sfx(name) {
      if (!SND.on) return;
      try {
        if (name === 'click') tone(620, 0.05, { type: 'square', vol: 0.04 });
        if (name === 'win') [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', when: i * 0.09 }));
        if (name === 'mid') { tone(440, 0.16, { type: 'triangle' }); tone(392, 0.2, { type: 'triangle', when: 0.12 }); }
        if (name === 'bad') { [0, 0.22].forEach((w) => tone(880, 0.16, { type: 'square', vol: 0.06, when: w, slide: -300 })); noise(0.35, { vol: 0.12, freq: 300 }); }
        if (name === 'wrong') tone(220, 0.28, { type: 'sawtooth', vol: 0.07, slide: -90 });
        if (name === 'medal') [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.1, when: i * 0.08 }));
        if (name === 'coin') { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.2, { type: 'square', vol: 0.05, when: 0.08 }); }
        if (name === 'plink') tone(1200, 0.09, { type: 'triangle', vol: 0.09 });
        if (name === 'spark') noise(0.18, { vol: 0.25, freq: 3200, q: 0.5 });
        if (name === 'launch') { noise(3.2, { vol: 0.28, freq: 160, q: 0.4, when: 1.8 }); [0, 0.6, 1.2].forEach((w) => tone(880, 0.1, { type: 'square', vol: 0.05, when: w })); tone(1320, 0.3, { type: 'square', vol: 0.05, when: 1.8 }); }
        if (name === 'hum') tone(110, 0.3, { type: 'sawtooth', vol: 0.03 });
      } catch (e) { /* sin audio */ }
    }

    // ---------- Guardar la partida en el navegador ----------
    function saveGame() {
      if (s.phase === 'end') { store.set('advSave', null); return; }
      if (s.puzzle || s.mini || (s.phase === 'goal' && !s.goal)) return;
      store.set('advSave', { v: 1, phase: s.phase, level: s.level, goal: s.goal, instr: s.instr, rocket: s.rocket && s.rocket.id, crew: s.crew, supplies: s.supplies && s.supplies.id, tools: s.tools,
        ev: s.ev, budget: s.budget, fuel: s.fuel, food: s.food, health: s.health, hull: s.hull, lowPower: s.lowPower, log: s.log, outcome: s.outcome, end: s.end,
        events: s.events && s.events.map((e) => ({ id: e.id, day: e.day })), science: s.science, landed: s.landed, bonus: s.bonus, quizUsed: s.quizUsed, quizOk: s.quizOk, quizAsked: s.quizAsked, quiz: s.quiz });
    }
    function loadGame() {
      const g = store.get('advSave', null);
      if (!g || g.v !== 1) return false;
      try {
        reset();
        s.level = g.level in LEVELS ? g.level : 'normal'; LV = LEVELS[s.level]; BUDGET0 = LV.budget;
        Object.assign(s, { phase: g.phase, goal: g.goal || null, instr: g.instr || null, crew: g.crew || [], tools: g.tools || [], ev: g.ev || 0, budget: g.budget, fuel: g.fuel, food: g.food, health: g.health, hull: g.hull,
          lowPower: g.lowPower, log: g.log || [], outcome: g.outcome, end: g.end, science: g.science || 0, landed: g.landed, bonus: g.bonus || 0,
          quizUsed: g.quizUsed || [], quizOk: g.quizOk || 0, quizAsked: g.quizAsked || [], quiz: g.quiz });
        s.rocket = g.rocket ? byId(ROCKETS, g.rocket) : null;
        if (s.phase !== 'goal' && !s.goal) s.phase = 'goal'; // partidas guardadas antes de existir el objetivo
        s.supplies = g.supplies ? byId(SUPPLIES, g.supplies) : null;
        const month = (d) => Math.max(1, Math.ceil(d / 30));
        s.events = g.events ? g.events.map((x) => { const base = byId(EVENTS.concat(NEW_EVENTS), x.id);
          return FIXED_IDS.includes(x.id) ? base : Object.assign({}, base, { day: x.day, place: B(`Crucero · mes ${month(x.day)}`, `Cruise · month ${month(x.day)}`) }); }) : null;
        if (s.events && s.events.some((e) => !e)) throw new Error('evento desconocido');
        return s.phase !== 'goal' || !!s.goal;
      } catch (e) { reset(); store.set('advSave', null); return false; }
    }

    // ---------- Compartir el resultado como imagen ----------
    function shareResult(noPhoto) {
      const W = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
      const c = cv.getContext('2d');
      const g = c.createLinearGradient(0, 0, 0, W); g.addColorStop(0, '#05070f'); g.addColorStop(1, '#2a1630'); c.fillStyle = g; c.fillRect(0, 0, W, W);
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      c.fillStyle = '#fff'; for (let i = 0; i < 160; i++) { c.globalAlpha = 0.2 + rnd() * 0.7; c.beginPath(); c.arc(rnd() * W, rnd() * W, rnd() * 1.8 + 0.4, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
      if (!noPhoto && marsImg.complete && marsImg.naturalWidth) { c.save(); c.beginPath(); c.arc(860, 860, 300, 0, TAU); c.clip(); c.drawImage(marsImg, 520, 520, 690, 690); c.restore(); }
      const F = (w, sz) => `${w} ${sz}px "Space Grotesk", Inter, system-ui, sans-serif`;
      c.fillStyle = '#ff9a6b'; c.font = F(700, 34); c.fillText(L('MISIÓN THE LAST LAP', 'MISSION THE LAST LAP'), 70, 110);
      const e = s.end;
      const title = !e.win ? T(e.title) : s.landed ? L('¡Hemos aterrizado en Marte!', 'We landed on Mars!') : L('¡Estamos en órbita de Marte!', 'We are in orbit around Mars!');
      c.fillStyle = '#fff'; c.font = F(700, 64); wrap(c, title, 70, 200, 900, 72);
      if (e.win) {
        c.font = '90px serif'; c.fillText('⭐'.repeat(e.stars) + '☆'.repeat(3 - e.stars), 70, 400);
        c.fillStyle = '#ffc857'; c.font = F(700, 120); c.fillText(num(e.score), 70, 540);
        c.fillStyle = '#a3acc4'; c.font = F(500, 34); c.fillText(L('puntos', 'points'), 74, 590);
      }
      c.fillStyle = '#d6dcec'; c.font = F(500, 32);
      const lines = [`${LV.icon} ${L('Dificultad', 'Difficulty')}: ${T(LV.name)}`, `🚀 ${T(s.rocket.name)}`, `🧑‍🚀 ${s.crew.map((id) => T(byId(CREW, id).name).split(' · ')[0]).join(', ')}`];
      lines.forEach((t, i) => c.fillText(t, 70, 680 + i * 50));
      RES.forEach((r, i) => {
        const y = 860 + i * 34, v = s[r.k], f = clamp(v / r.max, 0, 1);
        c.fillStyle = '#a3acc4'; c.font = F(500, 24); c.fillText(`${r.icon} ${T(r.short)}`, 70, y + 18);
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(260, y, 260, 18);
        c.fillStyle = ['#ffc857', '#ff7a45', '#6be3b5', '#ff7b9c', '#4ea3ff'][i]; c.fillRect(260, y, 260 * f, 18);
        c.fillStyle = '#fff'; c.fillText(r.fmt(v), 540, y + 18);
      });
      if (/^https?:/.test(location.protocol)) { c.fillStyle = '#6f7a96'; c.font = F(500, 24); c.fillText(location.host + location.pathname.replace(/index\.html$/, ''), 70, W - 30); }
      try { cv.getContext('2d').getImageData(0, 0, 1, 1); } catch (err) { if (!noPhoto) return shareResult(true); return; }
      cv.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'the-last-lap.png', { type: 'image/png' });
        const text = e.win ? L(`¡He llegado a Marte con ${num(e.score)} puntos en The Last Lap!`, `I reached Mars with ${num(e.score)} points in The Last Lap!`) : L('Mi misión a Marte en The Last Lap', 'My mission to Mars in The Last Lap');
        if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'The Last Lap', text }).catch(() => {}); return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'the-last-lap.png';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast(`<span class="tt-ic">📥</span><span><b>${L('Imagen descargada', 'Image downloaded')}</b></span>`);
      }, 'image/png');
    }
    function wrap(c, text, x, y, maxW, lh) {
      let line = '';
      text.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); line = w; y += lh; } else line = t; });
      c.fillText(line, x, y);
    }

    // --- Lógica ---
    function startTrip() {
      s.budget = BUDGET0 - spentPrep();
      s.fuel = Math.min(100, s.rocket.fuel + (s.tools.includes('tank') ? 15 : 0));
      s.food = s.supplies.days;
      s.hull = s.rocket.hull;
      s.health = 100;
      s.phase = 'trip'; s.ev = 0; s.outcome = null; s.events = buildTrip();
      const names = (list, arr) => arr.map((id) => byId(list, id).name);
      const crewEs = names(CREW, s.crew).map((n) => n.es).join(', '), crewEn = names(CREW, s.crew).map((n) => n.en).join(', ');
      const toolsEs = names(TOOLS, s.tools).map((n) => n.es.toLowerCase()).join(', ') || 'ninguna', toolsEn = names(TOOLS, s.tools).map((n) => n.en.toLowerCase()).join(', ') || 'none';
      s.log.push({ day: 0, icon: '🧑‍🚀', place: B(`Preparación · ${LV.name.es.toLowerCase()}`, `Preparation · ${LV.name.en.toLowerCase()}`), tone: 'info',
        choice: B(`Misión lista: ${s.rocket.name.es.toLowerCase()} y ${s.supplies.days} días de provisiones`, `Mission ready: ${s.rocket.name.en.toLowerCase()} and ${s.supplies.days} days of supplies`),
        text: B(`Objetivo: ${goalOf().name.es.toLowerCase()}${s.instr ? ` (con ${byId(INSTR, s.instr).name.es.toLowerCase()})` : ''}. Tripulación: ${crewEs}. Herramientas: ${toolsEs}. Fondo de emergencia: ${s.budget} M€.`,
          `Goal: ${goalOf().name.en.toLowerCase()}${s.instr ? ` (with ${byId(INSTR, s.instr).name.en.toLowerCase()})` : ''}. Crew: ${crewEn}. Tools: ${toolsEn}. Emergency fund: €${s.budget}M.`) });
    }

    function choose(i) {
      const e = s.events[s.ev];
      const c = e.choices[i];
      if (check(c.req) || s.puzzle || s.mini) return;
      sfx('click');
      if (c.puzzle) return startPuzzle(i);
      if (c.mini) return startMini(c.mini, i);
      resolve(e, c, i, c.run(s));
    }
    function resolve(e, c, i, r) {
      s.prev = { budget: s.budget, fuel: s.fuel, food: s.food, health: s.health, hull: s.hull };
      const d = Object.assign({}, r.d);
      ['health', 'hull'].forEach((k) => { if (d[k] < 0) d[k] = Math.round(d[k] * LV.dmg); });
      // El dinero no baja de 0: lo que falta se paga con salud (más trabajo y más nervios)
      let broke = null;
      if (d.budget < 0 && s.budget + d.budget < 0) {
        const short = -(s.budget + d.budget);
        d.budget = -Math.max(0, s.budget);
        const hurt = Math.min(15, Math.ceil(short / 5));
        d.health = (d.health || 0) - hurt;
        broke = B(`💸 No había dinero suficiente: faltaban ${short} M€ y el equipo tuvo que apañárselas solo (−${hurt} % salud).`, `💸 There was not enough money: €${short}M short, so the crew had to manage on their own (−${hurt}% health).`);
      }
      const cd = Object.assign({}, d);
      if (r.science) {
        const g = goalOf(), match = g && g.site === c.fx, inst = g && s.instr === g.instr;
        s.sciMatch = match; s.sciInstr = inst;
        s.science = (s.science || 0) + Math.round(r.science * (match ? 2 : 1) * (inst ? 1.5 : 1));
      }
      if (r.landed) s.landed = e.id === 'land' ? c.fx : s.landed;
      // Provisiones gastadas hasta el siguiente capítulo (con racionamiento si faltan)
      const nextDay = s.ev + 1 < s.events.length ? s.events[s.ev + 1].day : TRIP;
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
      if (broke) extra = extra ? B(`${broke.es} ${extra.es}`, `${broke.en} ${extra.en}`) : broke;
      s.outcome = { choice: c.title, text: r.text, d, cd, extra, fx: c.fx || (FX[e.id] || [])[i] || '', bad: !!r.bad, mini: r.mini };
      s.log.push({ day: e.day, icon: e.icon, place: e.place, choice: c.title, text: r.text, d: Object.assign({}, d), tone: toneOf(s.outcome) });
      s.end = verdict(e);
      if (r.mini && MINI_ACH[r.mini]) unlock(MINI_ACH[r.mini]);
      if (s.end) awardEnd(s.end);
      const tn = toneOf(s.outcome);
      if (e.id === 'launch') sfx('launch');
      sfx(tn === 'ok' ? 'win' : tn === 'mid' ? 'mid' : 'bad');
      if ((d.budget || 0) > 0) setTimeout(() => sfx('coin'), 500);
      render(true);
    }

    function verdict(e) {
      if (s.hull <= 0) return { win: false, icon: '💥', title: B('La nave no ha aguantado', 'The ship did not survive'),
        text: B('Los daños acumulados eran demasiados. Por suerte, la cápsula de emergencia devuelve al equipo a casa, pero la misión se pierde.', 'The damage had piled up too much. Luckily, the escape capsule takes the crew home, but the mission is lost.') };
      if (s.health <= 0) return { win: false, icon: '🚑', title: B('La tripulación no puede seguir', 'The crew cannot go on'),
        text: B('El equipo está demasiado débil. Control de misión ordena dar la vuelta usando la gravedad de Marte.', 'The crew is too weak. Mission control orders a turnaround using the gravity of Mars.') };
      if (s.ev + 1 < s.events.length) {
        const ne = s.events[s.ev + 1];
        const can = ne.choices.some((c) => !check(c.req));
        if (!can) return { win: false, icon: '🌌', title: B('Sin combustible para frenar', 'No fuel left to brake'),
          text: B('Llegáis a Marte sin combustible para frenar y pasáis de largo. La nave queda girando alrededor del Sol.', 'You reach Mars with no fuel to brake and fly straight past. The ship ends up circling the Sun.') };
        return null;
      }
      const parts = [
        [B('Salud del equipo', 'Crew health'), s.health * 3],
        [B('Estado de la nave', 'Ship condition'), s.hull * 2],
        [B('Combustible sobrante', 'Fuel left over'), s.fuel * 2],
        [B('Provisiones sobrantes', 'Supplies left over'), s.food * 2],
        [B('Presupuesto sobrante', 'Budget left over'), Math.max(0, Math.round(s.budget / 2))],
      ];
      if (s.science) parts.push([B(`Ciencia en Marte${s.sciMatch ? ' · sitio ideal ×2' : ''}${s.sciInstr ? ' · instrumento ×1,5' : ''}`, `Science at Mars${s.sciMatch ? ' · ideal site ×2' : ''}${s.sciInstr ? ' · instrument ×1.5' : ''}`), s.science]);
      if (s.crew.includes('geo')) parts.push([B('Ciencia de Kenji en Marte', 'Kenji’s science at Mars'), 150]);
      if (s.bonus) parts.push([B('Preguntas acertadas', 'Questions answered right'), s.bonus]);
      let score = parts.reduce((a, p) => a + p[1], 0);
      if (LV.score !== 1) { const extra = Math.round(score * (LV.score - 1)); parts.push([B(`Dificultad ${T(LV.name).toLowerCase()} (×${num(LV.score, 1)})`, `${T(LV.name)} difficulty (×${num(LV.score, 1)})`), extra]); score += extra; }
      const stars = s.health >= 60 && s.hull >= 40 ? (score >= 650 ? 3 : 2) : 1;
      const text = stars === 3 ? B('¡Una misión de libro! Has gestionado el dinero, el equipo y los recursos con mucha cabeza.', 'A textbook mission! You managed money, crew and resources very wisely.')
        : stars === 2 ? B('Buena misión. Habéis llegado en forma, aunque con algunos sustos por el camino.', 'A good mission. You arrived in good shape, with a few scares along the way.')
          : B('¡Habéis llegado! Por los pelos: la nave o la tripulación están muy tocadas.', 'You made it! Only just: the ship or the crew are badly battered.');
      return { win: true, parts, score, stars, text };
    }

    const onClick = (ev) => {
      const b = ev.target.closest('button, g[data-rocket], g[data-goal], g[data-pl], g[data-pr], [data-act="diary-close"], [data-act="ach-close"]');
      if (!b || b.disabled || !(root.contains(b) || diaryHost.contains(b))) return;
      const d = b.dataset;
      if (suppressClick) { suppressClick = false; if (d.pl || d.pr) return; }
      if (d.act === 'diary') { s.diary = true; render(false); const x = diaryHost.querySelector('.dia-close'); if (x) x.focus(); return; }
      if (d.act === 'ach') { s.achOpen = true; render(false); const x = diaryHost.querySelector('.dia-close'); if (x) x.focus(); return; }
      if (d.act === 'ach-close') { s.achOpen = false; render(false); const x = root.querySelector('[data-act="ach"]'); if (x) x.focus(); return; }
      if (d.act === 'sound') { SND.on = !SND.on; store.set('advSound', SND.on); if (SND.on) sfx('plink'); render(false); return; }
      if (d.act === 'share') return shareResult();
      if (d.act === 'newgame') { if (s.phase === 'end' || window.confirm(L('¿Empezar una partida nueva? Se perderá la actual.', 'Start a new game? The current one will be lost.'))) { reset(); store.set('advSave', null); render(true); } return; }
      if (d.quiz) return answerQuiz(+d.quiz);
      if (d.act === 'diary-close') { s.diary = false; render(false); const x = root.querySelector('.adv-diary-btn'); if (x) x.focus(); return; }
      if (d.pl) { if (s.puzzle && !s.puzzle.links.includes(+d.pl)) { s.puzzle.sel = +d.pl; s.puzzle.wrong = null; render(false); } return; }
      if (d.pr) { if (s.puzzle && s.puzzle.sel != null) connect(s.puzzle.sel, +d.pr); return; }
      if (d.act === 'giveup') return finishPuzzle(false);
      if (d.goal && s.phase === 'goal') { s.goal = d.goal; if (s.instr && byId(INSTR, s.instr).id !== goalOf().instr) s.instr = null; }
      else if (d.instr && s.phase === 'tools') { s.instr = s.instr === d.instr ? null : d.instr; }
      else if (d.level && s.phase === 'goal') {
        s.level = d.level; LV = LEVELS[d.level]; BUDGET0 = LV.budget;
        if (BUDGET0 - spentPrep() < 0) { s.crew = []; s.supplies = null; s.tools = []; }
      }
      else if (d.rocket) { s.rocket = byId(ROCKETS, d.rocket); }
      else if (d.crew) {
        const i = s.crew.indexOf(d.crew);
        if (i >= 0) s.crew.splice(i, 1); else s.crew.push(d.crew);
        s.supplies = null; // el precio de las provisiones depende del equipo
      }
      else if (d.sup) s.supplies = byId(SUPPLIES, d.sup);
      else if (d.tool) { const i = s.tools.indexOf(d.tool); if (i >= 0) s.tools.splice(i, 1); else s.tools.push(d.tool); }
      else if (d.choice) return choose(+d.choice);
      else if (d.act === 'next') {
        const order = ['goal', 'rocket', 'crew', 'supplies', 'tools'];
        const i = order.indexOf(s.phase);
        if (s.phase === 'rocket' && BUDGET0 - spentPrep() < 0) return;
        if (i < 4) s.phase = order[i + 1]; else startTrip();
        // Si al cambiar de cohete o de equipo ya no alcanza el dinero, se deshacen las herramientas
        while (BUDGET0 - spentPrep() < 0 && s.tools.length) s.tools.pop();
        return render(true);
      } else if (d.act === 'back') {
        const order = ['goal', 'rocket', 'crew', 'supplies', 'tools'];
        s.phase = order[Math.max(0, order.indexOf(s.phase) - 1)];
        return render(true);
      } else if (d.act === 'continue') {
        if (s.quiz) { s.quiz = null; s.ev += 1; s.outcome = null; return render(true); }
        if (s.end) { s.phase = 'end'; return render(true); }
        s.quizAsked = s.quizAsked || [];
        if (QUIZ_AT.includes(s.ev) && !s.quizAsked.includes(s.ev)) { s.quizAsked.push(s.ev); s.quiz = makeQuiz(); return render(true); }
        s.ev += 1; s.outcome = null; return render(true);
      } else if (d.act === 'restart') { reset(); return render(true); }
      else return;
      // Volver a ajustar si el presupuesto queda negativo (p. ej., al cambiar de cohete)
      if (s.phase === 'rocket') { s.crew.length && BUDGET0 - spentPrep() < 0 && (s.crew = [], s.supplies = null, s.tools = []); }
      render(false);
    };
    root.addEventListener('click', onClick);
    diaryHost.addEventListener('click', onClick);

    // Atajos de teclado: A–D para elegir, Intro para continuar
    document.addEventListener('keydown', (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey || !root.offsetParent) return;
      if (s.diary || s.achOpen) { if (ev.key === 'Escape') { s.diary = false; s.achOpen = false; render(false); } return; }
      if (s.quiz && s.quiz.answer == null) { const qi = 'abc'.indexOf(ev.key.toLowerCase()); if (qi >= 0) { ev.preventDefault(); answerQuiz(qi); } return; }
      const plug = ev.target.closest && ev.target.closest('[data-pl], [data-pr]');
      if (plug && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        const sel = plug.dataset.pl ? `[data-pl="${plug.dataset.pl}"]` : `[data-pr="${plug.dataset.pr}"]`;
        plug.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const again = root.querySelector(sel); if (again) again.focus();
        return;
      }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target.tagName || '').toUpperCase())) return;
      const r = root.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const i = 'abcd'.indexOf(ev.key.toLowerCase());
      if (s.phase === 'trip' && !s.outcome && i >= 0) {
        const b = root.querySelector(`[data-choice="${i}"]:not([disabled])`);
        if (b) { ev.preventDefault(); b.click(); }
      } else if (ev.key === 'Enter' && s.phase === 'trip' && s.outcome && !(ev.target.closest && ev.target.closest('button'))) {
        const b = root.querySelector('[data-act="continue"]');
        if (b) { ev.preventDefault(); b.click(); }
      }
    });

    reset();
    if (loadGame()) setTimeout(() => toast(`<span class="tt-ic">💾</span><span><b>${L('Partida recuperada', 'Game restored')}</b><small>${L('Pulsa ↺ para empezar otra', 'Press ↺ to start another')}</small></span>`), 600);
    render(false);
    onLang.push(() => render(false));
  })();

  /* ---------- Visor 3D de la misión (inspirado en NASA Mission Viz) ---------- */
  (function viewer3d() {
    const canvas = $('#v3d');
    if (!canvas) return;
    const S = makeCanvas(canvas, () => draw());
    const out = { date: $('#v3d-date'), day: $('#v3d-day'), dist: $('#v3d-dist'), phase: $('#v3d-phase') };
    const slider = $('#v3d-slider'), btnPlay = $('#v3d-play');
    const LAUNCH = OPP_2027 - 88 * DAY;
    const RE = 1, RM = 1.524, TRANS = 259;          // UA y días del viaje (transferencia de Hohmann)
    const WE = TAU / P_EARTH, WM = TAU / P_MARS;
    const INC = 5 * Math.PI / 180;                  // inclinación de Marte (real: 1,85°), exagerada
    const TH0 = 3.6;                                // ángulo de la Tierra en el despegue (solo cambia el dibujo)
    const A = (RE + RM) / 2, ECC = (RM - RE) / (RM + RE);
    const VIEW0 = { yaw: -0.5, pitch: 0.7, dist: 3.7 };
    let view = { ...VIEW0 }, day = 0, playing = false, idle = 0;

    const marsY = (ang) => Math.sin(ang - TH0) * RM * Math.sin(INC);  // nodo en el punto de despegue
    const earth = (d) => { const a = TH0 + WE * d; return { x: RE * Math.cos(a), y: 0, z: RE * Math.sin(a) }; };
    const mars = (d) => { const a = TH0 + Math.PI - WM * (TRANS - d); return { x: RM * Math.cos(a) * Math.cos(INC), y: marsY(a), z: RM * Math.sin(a) }; };
    const moon = (d) => { const e = earth(d), a = TAU * d / P_MOON + 1.2; return { x: e.x + 0.13 * Math.cos(a), y: e.y + 0.02 * Math.sin(a), z: e.z + 0.13 * Math.sin(a) }; };
    function transfer(f) {
      let E = Math.PI * f;
      for (let k = 0; k < 8; k++) E -= (E - ECC * Math.sin(E) - Math.PI * f) / (1 - ECC * Math.cos(E));
      const nu = 2 * Math.atan2(Math.sqrt(1 + ECC) * Math.sin(E / 2), Math.sqrt(1 - ECC) * Math.cos(E / 2));
      const r = A * (1 - ECC * Math.cos(E)), a = TH0 + nu;
      return { x: r * Math.cos(a), y: marsY(TH0 + Math.PI) * (nu / Math.PI), z: r * Math.sin(a) };
    }
    function ship(d) {
      if (d <= TRANS) {
        const t = transfer(d / TRANS);
        if (d < 6) { // los primeros días: hacia la Luna y salida con el impulso
          const e = earth(d), m = moon(3), e3 = earth(3);
          const k = Math.min(1, d / 3) * 1.1;
          const near = { x: e.x + (m.x - e3.x) * k, y: e.y + (m.y - e3.y) * k, z: e.z + (m.z - e3.z) * k };
          const w = smooth((d - 2.5) / 3.5);
          return { x: lerp(near.x, t.x, w), y: lerp(near.y, t.y, w), z: lerp(near.z, t.z, w) };
        }
        return t;
      }
      const m = mars(d), a = (d - TRANS) * 0.45;
      return { x: m.x + 0.09 * Math.cos(a), y: m.y + 0.03 * Math.sin(a), z: m.z + 0.09 * Math.sin(a) };
    }
    // Proyección con perspectiva
    function proj(p) {
      const { w, h } = S;
      const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
      const x1 = p.x * cy - p.z * sy, z1 = p.x * sy + p.z * cy;
      const y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
      const zc = z2 + view.dist, f = Math.min(w, h) * 1.05;
      return { x: w / 2 + f * x1 / zc, y: h / 2 - f * y2 / zc, z: zc, s: f / zc };
    }
    function pathLine(ctx, pts, color, width, dash) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath(); pts.forEach((p, i) => { const q = proj(p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke(); ctx.restore();
    }
    const ring = (fn, n = 160) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
    const phaseOf = (d) => (d < 1 ? L('Despegue', 'Launch') : d < 6 ? L('Paso por la Luna', 'Lunar flyby') : d < TRANS - 2 ? L('Viaje hacia Marte', 'Cruise to Mars') : d < TRANS + 4 ? L('Llegada y frenado', 'Arrival and braking') : L('En órbita de Marte', 'In orbit around Mars'));

    function draw() {
      const { ctx, w, h } = S;
      ctx.clearRect(0, 0, w, h);
      // Plano de la eclíptica: rejilla suave
      ctx.save(); ctx.globalAlpha = 0.5;
      [0.5, 1, 1.5, 2].forEach((r) => pathLine(ctx, ring((t) => ({ x: r * Math.cos(t * TAU), y: 0, z: r * Math.sin(t * TAU) }), 96), 'rgba(140,160,210,0.10)', 1));
      ctx.restore();
      // Órbitas
      pathLine(ctx, ring((t) => { const a = t * TAU; return { x: RE * Math.cos(a), y: 0, z: RE * Math.sin(a) }; }), 'rgba(78,163,255,0.55)', 1.4);
      pathLine(ctx, ring((t) => { const a = t * TAU; return { x: RM * Math.cos(a) * Math.cos(INC), y: marsY(a), z: RM * Math.sin(a) }; }), 'rgba(255,122,69,0.55)', 1.4);
      // Trayectoria: recorrida (naranja) y prevista (discontinua)
      const done = [], left = [];
      for (let d = 0; d <= Math.min(day, TRANS + 60); d += 1) done.push(ship(d));
      done.push(ship(day));
      for (let d = Math.floor(day); d <= TRANS; d += 2) left.push(ship(d));
      if (left.length > 1) pathLine(ctx, left, 'rgba(255,255,255,0.35)', 1.2, [4, 6]);
      if (done.length > 1) pathLine(ctx, done, '#ff9a5a', 2.4);
      // Astros ordenados por profundidad
      const sunP = proj({ x: 0, y: 0, z: 0 });
      const items = [
        { p: { x: 0, y: 0, z: 0 }, draw: (q) => drawSun(ctx, q.x, q.y, Math.max(8, 0.09 * q.s)), label: L('Sol', 'Sun'), col: '#ffe2a0' },
        { p: earth(day), draw: (q) => drawEarth(ctx, q.x, q.y, Math.max(8, 0.06 * q.s), sunP), label: L('Tierra', 'Earth'), col: '#cfe5ff' },
        { p: moon(day), draw: (q) => drawMoon(ctx, q.x, q.y, Math.max(2.5, 0.02 * q.s), sunP), label: day < 8 ? L('Luna', 'Moon') : '', col: '#d9dde6' },
        { p: mars(day), draw: (q) => drawMarsPhoto(ctx, q.x, q.y, Math.max(7, 0.05 * q.s), sunP), label: L('Marte', 'Mars'), col: '#ffc2a6' },
        { p: ship(day), draw: (q) => { drawGlow(ctx, q.x, q.y, 16, '255,180,140', 0.55); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 3.6, 0, TAU); ctx.fill(); }, label: L('Nave', 'Ship'), col: '#ffb48f' },
      ].map((it) => ({ ...it, q: proj(it.p) })).sort((a, b) => b.q.z - a.q.z);
      items.forEach((it) => { if (it.q.z > 0.1) it.draw(it.q); });
      const fs = Math.min(w, h) < 380 ? 11 : 12;
      // Etiquetas sin pisarse: si dos quedan muy juntas, la segunda se coloca debajo o se omite
      const placed = [];
      items.slice().sort((a, b) => a.q.z - b.q.z).forEach((it) => {
        if (!it.label || it.q.z <= 0.1) return;
        let x = it.q.x + 12, y = it.q.y - 14;
        if (placed.some((pp) => Math.abs(pp.x - x) < 46 && Math.abs(pp.y - y) < 14)) { y = it.q.y + 18; if (placed.some((pp) => Math.abs(pp.x - x) < 46 && Math.abs(pp.y - y) < 14)) return; }
        placed.push({ x, y }); label(ctx, it.label, x, y, { size: fs, color: it.col });
      });
      // Datos
      const e = earth(day), sp = ship(day);
      const km = Math.hypot(sp.x - e.x, sp.y - e.y, sp.z - e.z) * 149.6;
      out.date.textContent = longDate(LAUNCH + day * DAY);
      out.day.textContent = num(Math.round(day));
      out.dist.textContent = km < 1 ? L(`${num(km * 1000)} mil km`, `${num(km * 1000)} thousand km`) : L(`${num(km, 1)} millones de km`, `${num(km, 1)} million km`);
      out.phase.textContent = phaseOf(day);
    }

    const setDay = (d) => { day = clamp(d, 0, 320); slider.value = String(Math.round(day)); draw(); };
    const setPlay = (on) => { playing = on; btnPlay.textContent = on ? L('⏸ Pausa', '⏸ Pause') : L('▶ Reproducir', '▶ Play'); btnPlay.setAttribute('aria-pressed', String(on)); };
    btnPlay.addEventListener('click', () => { if (!playing && day >= 320) setDay(0); setPlay(!playing); });
    slider.addEventListener('input', () => { setPlay(false); setDay(+slider.value); });
    $$('[data-v3d-day]').forEach((b) => b.addEventListener('click', () => { setPlay(false); setDay(+b.dataset.v3dDay); }));
    $('#v3d-reset').addEventListener('click', () => { view = { ...VIEW0 }; draw(); });

    // Girar arrastrando, acercar con la rueda o pellizcando, y con el teclado
    const pts = new Map();
    let pinch0 = 0;
    canvas.addEventListener('pointerdown', (ev) => { canvas.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); idle = 0; });
    canvas.addEventListener('pointermove', (ev) => {
      if (!pts.has(ev.pointerId)) return;
      const prev = pts.get(ev.pointerId); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 1) { view.yaw -= (ev.clientX - prev.x) * 0.008; view.pitch = clamp(view.pitch + (ev.clientY - prev.y) * 0.008, -1.45, 1.45); }
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) view.dist = clamp(view.dist * pinch0 / dd, 2, 9); pinch0 = dd; }
      idle = 0; draw();
    });
    const up = (ev) => { pts.delete(ev.pointerId); if (pts.size < 2) pinch0 = 0; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); view.dist = clamp(view.dist * (ev.deltaY > 0 ? 1.1 : 0.9), 2, 9); idle = 0; draw(); }, { passive: false });
    canvas.addEventListener('keydown', (ev) => {
      const k = ev.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') view.yaw += k === 'ArrowLeft' ? 0.1 : -0.1;
      else if (k === 'ArrowUp' || k === 'ArrowDown') view.pitch = clamp(view.pitch + (k === 'ArrowUp' ? 0.1 : -0.1), -1.45, 1.45);
      else if (k === '+' || k === '-') view.dist = clamp(view.dist * (k === '+' ? 0.9 : 1.1), 2, 9);
      else return;
      ev.preventDefault(); draw();
    });

    runWhenVisible(canvas, (dt) => {
      if (playing) { setDay(day + dt * 22); if (day >= 320) setPlay(false); }
      else if (!reduceMotion && pts.size === 0) { idle += dt; if (idle > 4) { view.yaw += dt * 0.05; draw(); } }
    });
    onLang.push(() => { setPlay(playing); draw(); });
    setPlay(false); setDay(0);
  })();

  /* ---------- Menú desplegable de secciones (pantallas estrechas) ---------- */
  (function menu() {
    const btn = $('#menu-btn'), head = $('.nav'), nav = $('#site-nav');
    if (!btn || !head || !nav) return;
    const set = (open) => { head.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(!head.classList.contains('open')); });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && head.classList.contains('open')) { set(false); btn.focus(); } });
    document.addEventListener('click', (e) => { if (!head.contains(e.target)) set(false); });
  })();

  /* ---------- Apartado del juego: con #juego solo se muestra el juego ---------- */
  (function gameRoute() {
    const btn = $('.game-btn');
    function route(scroll) {
      const on = location.hash === '#juego';
      document.body.classList.toggle('game-mode', on);
      if (btn) btn.classList.toggle('on', on);
      if (!scroll) return;
      if (on) window.scrollTo(0, 0);
      else if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }
    window.addEventListener('hashchange', () => route(true));
    route(true);
  })();

  /* ---------- Cambio de idioma (botón con bandera) ---------- */
  (function i18n() {
    const EN = window.I18N_EN || {};
    // Textos que pone el JavaScript: no se traducen desde el diccionario
    const SKIP = new Set(['solar-date', 'solar-next', 'solar-play', 'solar-status', 'sling-speed', 'm-day', 'm-date', 'm-photos',
      'm-status', 'm-play', 'fb-days', 'fb-dist', 'fb-moon', 'fb-escape', 'fb-play', 'fb-part-kicker', 'fb-part-title', 'fb-part-text',
      'dist-mars', 'dist-ratio', 'dist-meters', 'dist-light', 'dist-case-note', 'tl-launch', 'tl-arrival', 'lang-btn',
      'm-around', 'm-photos', 'm-delay', 'tl-aero', 'tl-photos', 'spin-caption', 'gs-mode', 'gs-speedup', 'gs-results', 'mg-result', 'adv-game', 'v3d-date', 'v3d-day', 'v3d-dist', 'v3d-phase', 'v3d-play']);
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
