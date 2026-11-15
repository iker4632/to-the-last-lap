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

  /* ---------- Juego: Fotógrafo de Marte ---------- */
  (function photoGame() {
    const canvas = $('#pgame');
    if (!canvas) return;
    const hud = $('#pg-hud'), result = $('#pg-result'), gallery = $('#pg-gallery');
    const startBtn = $('#pg-start'), resetBtn = $('#pg-reset');
    const goalEls = $$('.pg-goals li');

    const WORLD = 4200;         // longitud de una vuelta (unidades de mapa)
    const VH = 400;             // alto visible (unidades)
    const T_ORBIT = 50;         // segundos que dura la vuelta en el juego
    const SPEED = WORLD / T_ORBIT;
    const FW = 112, FH = 84;    // tamaño del visor (unidades)
    const SHOTS = 8;
    const RES = 1.5;            // píxeles del mapa pregenerado por unidad

    const NAMES = {
      cap: ['Casquete polar', 'Polar ice cap'], olympus: ['Monte Olimpo', 'Olympus Mons'], phobos: ['Fobos', 'Phobos'],
      valles: ['Valles Marineris', 'Valles Marineris'], rover: ['Un rover', 'A rover'], storm: ['Tormenta de polvo', 'Dust storm'],
    };
    const FACTS = {
      cap: ['Hielo de agua y de CO₂ congelado.', 'Frozen water and CO₂ ice.'],
      olympus: ['El volcán más alto del sistema solar: unos 22 km.', 'The tallest volcano in the solar system: about 22 km.'],
      phobos: ['La luna más grande de Marte, de unos 22 km.', 'Mars’ biggest moon, about 22 km across.'],
      valles: ['Un cañón de 4.000 km de largo.', 'A canyon 4,000 km long.'],
      rover: ['¡Desde 400 km se ven hasta sus huellas!', 'From 400 km you can even see its tracks!'],
      storm: ['Algunas tormentas cubren todo el planeta.', 'Some storms cover the whole planet.'],
    };
    // Objetivos: posición en el mapa (x, y), tolerancia r y puntos
    const TARGETS = [
      { id: 'cap', x: 230, y: 200, r: 150, pts: 1 },
      { id: 'olympus', x: 700, y: 205, r: 70, pts: 2 },
      { id: 'phobos', x: 0, y: 115, r: 18, pts: 3, sky: true },
      { id: 'valles', x: 1530, y: 238, r: 60, pts: 2 },
      { id: 'rover', x: 2000, y: 168, r: 6, pts: 3 },
      { id: 'storm', x: 2360, y: 285, r: 55, pts: 2 },
    ];
    const byId = Object.fromEntries(TARGETS.map((t) => [t.id, t]));

    // Luz según la posición en la vuelta: día, atardecer, noche y amanecer
    function light(x) {
      x = ((x % WORLD) + WORLD) % WORLD;
      if (x < 2700) return 1;
      if (x < 3050) return lerp(1, 0.04, smooth((x - 2700) / 350));
      if (x < 3850) return 0.04;
      return lerp(0.04, 1, smooth((x - 3850) / 350));
    }

    // Generador aleatorio con semilla (el mapa sale siempre igual)
    function rng(seed) {
      return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }

    let map = null;
    function buildMap() {
      const c = document.createElement('canvas');
      c.width = Math.round(WORLD * RES); c.height = Math.round(VH * RES);
      const g = c.getContext('2d');
      g.scale(RES, RES);
      const R = rng(7);
      // Dibuja una figura también desplazada una vuelta, para que el mapa empalme sin cortes
      const wrap = (fn) => { fn(0); fn(-WORLD); fn(WORLD); };
      const bg = g.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0, '#b0552d'); bg.addColorStop(0.5, '#bd6236'); bg.addColorStop(1, '#a94f29');
      g.fillStyle = bg; g.fillRect(0, 0, WORLD, VH);
      // Zonas más oscuras y más claras
      for (let i = 0; i < 240; i++) {
        const x = R() * WORLD, y = R() * VH, r = 30 + R() * 150, dark = R() < 0.55;
        wrap((o) => {
          const gr = g.createRadialGradient(x + o, y, 0, x + o, y, r);
          gr.addColorStop(0, dark ? 'rgba(70,24,10,0.2)' : 'rgba(235,160,110,0.13)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(x + o - r, y - r, 2 * r, 2 * r);
        });
      }
      // Granulado
      for (let i = 0; i < 14000; i++) {
        g.fillStyle = R() < 0.5 ? `rgba(60,20,8,${0.05 + R() * 0.12})` : `rgba(240,170,120,${0.04 + R() * 0.1})`;
        g.fillRect(R() * WORLD, R() * VH, 1 + R() * 2, 1 + R() * 2);
      }
      // Cráteres: sombra abajo a la derecha y borde iluminado arriba a la izquierda (el Sol viene de la izquierda)
      const crater = (x, y, r) => wrap((o) => {
        g.fillStyle = 'rgba(55,18,6,0.4)'; g.beginPath(); g.arc(x + o + r * 0.12, y + r * 0.12, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(232,150,100,0.32)'; g.beginPath(); g.arc(x + o - r * 0.1, y - r * 0.1, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(128,52,24,0.6)'; g.beginPath(); g.arc(x + o, y, r * 0.82, 0, TAU); g.fill();
        if (r > 14) { g.fillStyle = 'rgba(210,130,85,0.35)'; g.beginPath(); g.arc(x + o, y, r * 0.18, 0, TAU); g.fill(); }
      });
      for (let i = 0; i < 420; i++) crater(R() * WORLD, R() * VH, 2.5 + Math.pow(R(), 4) * 32);
      // Casquetes polares (norte al principio de la vuelta, sur hacia el final del día)
      const cap = (cx, cy, sx, sy) => {
        for (let i = 0; i < 70; i++) {
          const a = R() * TAU, d = Math.sqrt(R());
          const x = cx + Math.cos(a) * d * sx, y = cy + Math.sin(a) * d * sy, r = 30 + R() * 60;
          wrap((o) => {
            const gr = g.createRadialGradient(x + o, y, 0, x + o, y, r);
            gr.addColorStop(0, 'rgba(248,250,255,0.85)'); gr.addColorStop(0.6, 'rgba(236,240,250,0.5)'); gr.addColorStop(1, 'rgba(236,240,250,0)');
            g.fillStyle = gr; g.fillRect(x + o - r, y - r, 2 * r, 2 * r);
          });
        }
        g.strokeStyle = 'rgba(150,110,95,0.2)'; g.lineWidth = 3; g.lineCap = 'round';
        for (let k = 0; k < 5; k++) wrap((o) => {
          g.beginPath();
          for (let a = 0; a < 3.2; a += 0.15) {
            const rr = 25 + a * 32 + k * 9, x = cx + o + Math.cos(a + k * 1.25) * rr * sx / 140, y = cy + Math.sin(a + k * 1.25) * rr * sy / 140;
            a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
          g.stroke();
        });
      };
      cap(230, 200, 175, 215);
      cap(2880, 200, 150, 200);
      // Monte Olimpo: escudo enorme con un acantilado alrededor y calderas en la cima
      wrap((o) => {
        const x = 700 + o, y = 205;
        let gr = g.createRadialGradient(x, y, 60, x, y, 170);
        gr.addColorStop(0, 'rgba(225,140,90,0.25)'); gr.addColorStop(1, 'rgba(225,140,90,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 170, 0, TAU); g.fill();
        g.fillStyle = 'rgba(45,14,5,0.55)'; g.beginPath(); g.arc(x + 7, y + 7, 96, 0, TAU); g.fill();
        gr = g.createRadialGradient(x - 18, y - 18, 8, x, y, 96);
        gr.addColorStop(0, '#e59a68'); gr.addColorStop(0.7, '#c46d3d'); gr.addColorStop(1, '#a8532a');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 94, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(250,190,140,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 93, Math.PI * 0.85, Math.PI * 1.65); g.stroke();
        g.strokeStyle = 'rgba(150,70,35,0.35)'; g.lineWidth = 1.5;
        for (let k = 0; k < 26; k++) { const a = k / 26 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); g.lineTo(x + Math.cos(a) * 88, y + Math.sin(a) * 88); g.stroke(); }
        [[0, 0, 15], [9, -6, 10], [-8, 7, 9], [6, 9, 7]].forEach(([dx, dy, r]) => {
          g.fillStyle = 'rgba(70,24,10,0.75)'; g.beginPath(); g.arc(x + dx + 1.5, y + dy + 1.5, r, 0, TAU); g.fill();
          g.fillStyle = 'rgba(140,60,28,0.95)'; g.beginPath(); g.arc(x + dx, y + dy, r * 0.88, 0, TAU); g.fill();
        });
      });
      // Valles Marineris: un cañón larguísimo con ramales al oeste
      const canyon = (pts, w) => {
        [[w + 10, 'rgba(60,20,8,0.55)'], [w, '#5a200d'], [w * 0.45, '#3a1206']].forEach(([lw, col]) => {
          g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        });
        g.strokeStyle = 'rgba(245,175,125,0.55)'; g.lineWidth = 2;
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y - w / 2 - 2) : g.moveTo(x, y - w / 2 - 2))); g.stroke();
      };
      const valles = [[1320, 214], [1380, 222], [1440, 232], [1500, 236], [1560, 240], [1620, 246], [1690, 252], [1750, 262]];
      canyon(valles, 22);
      canyon([[1380, 222], [1420, 200], [1470, 192]], 9);
      canyon([[1500, 236], [1540, 262], [1600, 276]], 10);
      canyon([[1320, 214], [1290, 196], [1270, 204], [1250, 186]], 7);
      canyon([[1300, 215], [1275, 232], [1252, 228]], 6);
      // Huellas del rover
      g.strokeStyle = 'rgba(80,28,12,0.55)'; g.lineWidth = 0.9;
      [-1.6, 1.6].forEach((d) => { g.beginPath(); g.moveTo(1925, 205 + d); g.bezierCurveTo(1950, 196 + d, 1965, 168 + d, 1997, 168 + d); g.stroke(); });
      return c;
    }

    const S = makeCanvas(canvas, () => draw());
    const game = { state: 'ready', t: 0, shots: SHOTS, got: {}, photos: [], score: 0, flash: 0, aim: null, pending: null, msg: null };

    const scale = () => S.h / VH;                          // px por unidad
    const camX = (t) => -40 + t * SPEED;                   // borde izquierdo de la vista
    const phobosPos = (t) => {                              // Fobos cruza la vista por delante, más rápido que el suelo
      const vw = S.w / scale();
      const p = (t - 13) / 6;
      return p < 0 || p > 1 ? null : { x: vw + 50 - p * (vw + 100), y: 115 };
    };
    const stormPos = (t) => ({ x: 2360 + Math.sin(t * 0.35) * 14 + t * 0.6, y: 285 });

    // Posición de un objetivo en la vista (unidades de pantalla)
    function targetScreen(tg, t) {
      if (tg.id === 'phobos') return phobosPos(t);
      const vw = S.w / scale();
      const place = (pos) => {
        let dx = pos.x - camX(t);
        dx = ((dx % WORLD) + WORLD) % WORLD;
        if (dx > vw + 200) dx -= WORLD;
        return { x: dx, y: pos.y };
      };
      if (tg.id === 'cap') { // hay dos casquetes: el norte y el sur; vale cualquiera
        const a = place(tg), b = place({ x: 2880, y: 200 });
        return Math.abs(a.x - vw / 2) < Math.abs(b.x - vw / 2) ? a : b;
      }
      return place(tg.id === 'storm' ? stormPos(t) : tg);
    }

    function drawScene(ctx, t) {
      const k = scale(), vw = S.w / k, cx = camX(t);
      if (!map) map = buildMap();
      // Mapa (con empalme al dar la vuelta)
      let x0 = ((cx % WORLD) + WORLD) % WORLD, drawn = 0;
      while (drawn < vw) {
        const part = Math.min(WORLD - x0, vw - drawn);
        ctx.drawImage(map, x0 * RES, 0, part * RES, VH * RES, Math.floor(drawn * k), 0, Math.ceil(part * k) + 1, S.h);
        drawn += part; x0 = 0;
      }
      ctx.save(); ctx.scale(k, k);
      // Rover (con una luz que parpadea)
      const rv = targetScreen(byId.rover, t);
      if (rv.x > -20 && rv.x < vw + 20) {
        ctx.fillStyle = 'rgba(40,14,6,0.6)'; ctx.fillRect(rv.x - 2.5, rv.y - 1.3, 6.5, 4.4);
        ctx.fillStyle = '#e8ecf3'; ctx.fillRect(rv.x - 3.2, rv.y - 2, 6.4, 4);
        ctx.fillStyle = '#7d8597'; ctx.fillRect(rv.x - 3.6, rv.y - 2.6, 1.6, 5.2); ctx.fillRect(rv.x + 2, rv.y - 2.6, 1.6, 5.2);
        if (Math.sin(t * 6) > 0) { ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(rv.x + 1, rv.y - 0.4, 0.9, 0, TAU); ctx.fill(); }
      }
      // Tormenta de polvo que gira
      const st = targetScreen(byId.storm, t);
      if (st.x > -160 && st.x < vw + 160) {
        for (let i = 0; i < 9; i++) {
          const a = t * 0.8 + i * 0.7, rr = 12 + i * 7;
          const x = st.x + Math.cos(a) * rr * 0.9, y = st.y + Math.sin(a) * rr * 0.55, r = 42 - i * 2.5;
          const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(222,170,120,0.42)'); gr.addColorStop(1, 'rgba(222,170,120,0)');
          ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
        ctx.strokeStyle = 'rgba(240,200,160,0.35)'; ctx.lineWidth = 3;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          for (let a = 0; a < 4.5; a += 0.2) {
            const rr = 6 + a * 13, x = st.x + Math.cos(a + t * 1.1 + j * 2.1) * rr, y = st.y + Math.sin(a + t * 1.1 + j * 2.1) * rr * 0.6;
            a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      // Noche: se oscurece por columnas según la luz de cada zona
      for (let sx = 0; sx < vw; sx += 8) {
        const a = 1 - light(cx + sx + 4);
        if (a > 0.01) { ctx.fillStyle = `rgba(4,6,18,${(a * 0.94).toFixed(3)})`; ctx.fillRect(sx, 0, 8.5, VH); }
      }
      // Fobos pasando por delante (va en el cielo, por encima del suelo)
      const ph = phobosPos(t);
      if (ph) {
        ctx.fillStyle = 'rgba(20,8,4,0.35)'; ctx.beginPath(); ctx.ellipse(ph.x + 30, ph.y + 70, 15, 10, 0.3, 0, TAU); ctx.fill();
        const gr = ctx.createRadialGradient(ph.x - 6, ph.y - 5, 2, ph.x, ph.y, 20);
        gr.addColorStop(0, '#b3a69b'); gr.addColorStop(1, '#4e443d');
        ctx.fillStyle = gr; ctx.beginPath();
        for (let a = 0; a <= TAU + 0.01; a += TAU / 14) { const rr = 17 + Math.sin(a * 3) * 2.2 + Math.cos(a * 5) * 1.3; const px = ph.x + Math.cos(a) * rr * 1.25, py = ph.y + Math.sin(a) * rr * 0.9; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.fill();
        ctx.fillStyle = 'rgba(40,32,28,0.6)'; ctx.beginPath(); ctx.arc(ph.x + 8, ph.y + 1, 5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(ph.x - 9, ph.y + 6, 2.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    // ¿Qué objetivos hay dentro del visor centrado en (ax, ay)?
    function inFrame(ax, ay, t) {
      const out = [];
      TARGETS.forEach((tg) => {
        const p = targetScreen(tg, t);
        if (!p) return;
        const dx = p.x - ax, dy = p.y - ay, pad = tg.r * 0.35;
        if (Math.abs(dx) < FW / 2 + pad && Math.abs(dy) < FH / 2 + pad) {
          const q = 1 - clamp(Math.hypot(dx / (FW / 2), dy / (FH / 2)) / 1.15, 0, 1);
          out.push({ tg, q, stars: q > 0.62 ? 3 : q > 0.3 ? 2 : 1 });
        }
      });
      return out.sort((a, b) => b.q - a.q);
    }

    function takeShot(ax, ay) {
      const k = scale(), t = game.t;
      const lit = light(camX(t) + ax);
      const found = inFrame(ax, ay, t);
      // Recorte del canvas para la galería
      const dpr = canvas.width / S.w;
      const th = document.createElement('canvas'); th.width = 160; th.height = 120;
      const tctx = th.getContext('2d');
      tctx.drawImage(canvas, (ax - FW / 2) * k * dpr, (ay - FH / 2) * k * dpr, FW * k * dpr, FH * k * dpr, 0, 0, 160, 120);
      const photo = { th, lit: lit > 0.3, hits: [] };
      if (photo.lit) {
        found.forEach((f) => {
          const prev = game.got[f.tg.id] || 0;
          if (f.stars > prev) {
            game.score += (f.stars - prev) * f.tg.pts;
            game.got[f.tg.id] = f.stars;
            photo.hits.push({ id: f.tg.id, stars: f.stars, better: prev > 0 });
          }
        });
      }
      game.photos.push(photo);
      game.shots--;
      game.flash = 1;
      game.msg = !photo.lit ? 'dark' : photo.hits.length ? 'hit' : found.length ? 'same' : 'empty';
      game.lastHits = photo.hits;
      addThumb(photo);
      updateGoals();
      if (game.shots <= 0) finish('noshots');
      else setResult();
    }

    function caption(photo) {
      if (!photo.lit) return L('🌑 A oscuras: es de noche', '🌑 Too dark: it’s night');
      if (!photo.hits.length) return L('Nada nuevo en la foto', 'Nothing new in this shot');
      return photo.hits.map((h) => `${L(...NAMES[h.id])} ${'⭐'.repeat(h.stars)}`).join(' · ');
    }
    function addThumb(photo) {
      const fig = document.createElement('figure');
      fig.className = 'pg-shot ' + (photo.hits.length ? 'hit' : 'miss');
      fig.appendChild(photo.th);
      const cap = document.createElement('figcaption');
      cap.textContent = caption(photo);
      fig.appendChild(cap);
      photo.fig = cap;
      gallery.appendChild(fig);
    }

    function updateGoals() {
      goalEls.forEach((li) => {
        const s = game.got[li.dataset.t] || 0;
        li.classList.toggle('got', s > 0);
        if (s) li.dataset.q = '⭐'.repeat(s); else delete li.dataset.q;
      });
    }

    const maxScore = TARGETS.reduce((a, t) => a + t.pts * 3, 0);
    function setResult() {
      let html = '', cls = '';
      const st = game.state;
      if (st === 'ready') {
        html = L('Pulsa «Empezar la vuelta». Luego toca o haz clic sobre Marte para hacer cada foto.', 'Press “Start the orbit”. Then tap or click on Mars to take each photo.');
      } else if (st === 'run') {
        const m = game.msg;
        if (m === 'hit') {
          const h = game.lastHits[0];
          html = `📸 ${L('¡Foto de', 'Photo of')} ${L(...NAMES[h.id])}! ${'⭐'.repeat(h.stars)}<span class="sub">${L(...FACTS[h.id])}</span>`; cls = 'win';
        } else if (m === 'dark') {
          html = L('🌑 Foto negra: en esa zona es de noche y no hay luz del Sol.', '🌑 Black photo: it’s night down there, with no sunlight.') +
            `<span class="sub">${L('Las cámaras normales necesitan luz. Espera a que vuelva a amanecer.', 'Ordinary cameras need light. Wait for the sunrise.')}</span>`; cls = 'fail';
        } else if (m === 'same') {
          html = L('Esa ya la tenías igual de bien. ¡Busca otro objetivo!', 'You already had that one just as good. Find another target!');
        } else if (m === 'empty') {
          html = L('Foto sin ningún objetivo de la lista. ¡Apunta mejor!', 'No target from the list in that shot. Aim better!'); cls = 'fail';
        } else {
          html = L('El suelo pasa por debajo: apunta y dispara cuando un objetivo entre en el visor (se pone verde).', 'The ground slides below: aim and shoot when a target enters the viewfinder (it turns green).');
        }
      } else {
        const n = Object.keys(game.got).length;
        const stars = game.score >= maxScore * 0.75 ? '⭐⭐⭐' : game.score >= maxScore * 0.45 ? '⭐⭐' : game.score > 0 ? '⭐' : '';
        const why = game.endWhy === 'noshots' ? L('Te has quedado sin fotos. ', 'You ran out of photos. ') : L('¡Vuelta completada! ', 'Orbit complete! ');
        const sent = game.photos.filter((p) => p.hits.length).length;
        html = `${why}${n}/6 ${L('objetivos', 'targets')} · ${game.score}/${maxScore} ${L('puntos', 'points')} ${stars}` +
          `<span class="sub">${sent ? L(`Ahora la nave gira la antena hacia la Tierra y envía tus ${sent} fotos buenas por radio: tardan entre 3 y 22 minutos en llegar.`,
            `Now the spacecraft turns its antenna to Earth and radios your ${sent} good photos home: they take 3 to 22 minutes to arrive.`)
            : L('Ninguna foto buena esta vez. ¡Prueba otra vuelta!', 'No good photos this time. Try another orbit!')}</span>`;
        cls = n >= 4 ? 'win' : '';
      }
      result.className = 'game-result ' + cls;
      result.innerHTML = html;
    }

    let hudKey = '';
    function updateHud() {
      const lit = light(camX(game.t) + S.w / scale() / 2) > 0.3;
      const pct = Math.round(clamp(game.t / T_ORBIT, 0, 1) * 100);
      const key = `${game.shots}|${pct}|${lit}|${LANG}`;
      if (key === hudKey) return;
      hudKey = key;
      hud.innerHTML = `<span class="pg-chip${game.shots <= 2 ? ' low' : ''}">📷 ${L('Fotos', 'Photos')}: ${game.shots}/${SHOTS}</span>` +
        `<span class="pg-chip">🛰️ ${L('Vuelta', 'Orbit')}: ${pct} %</span>` +
        `<span class="pg-chip${lit ? '' : ' night'}">${lit ? L('☀️ Debajo es de día', '☀️ Daytime below') : L('🌙 Debajo es de noche', '🌙 Night-time below')}</span>`;
    }

    function finish(why) {
      game.state = 'done'; game.endWhy = why;
      startBtn.disabled = false;
      setResult();
    }

    function reset() {
      Object.assign(game, { state: 'ready', t: 0, shots: SHOTS, got: {}, photos: [], score: 0, flash: 0, msg: null, endWhy: null });
      gallery.innerHTML = '';
      startBtn.disabled = false;
      updateGoals(); setResult(); hudKey = ''; updateHud(); draw();
    }

    function draw() {
      if (!S.ready) return;
      const ctx = S.ctx, k = scale();
      ctx.clearRect(0, 0, S.w, S.h);
      drawScene(ctx, game.t);
      if (game.pending) { const p = game.pending; game.pending = null; takeShot(p.x, p.y); }
      const fs = S.w < 420 ? 11 : 12;
      // Visor
      const vw = S.w / k;
      const aim = game.aim || { x: vw / 2, y: VH / 2 };
      const ax = clamp(aim.x, FW / 2, vw - FW / 2), ay = clamp(aim.y, FH / 2, VH - FH / 2);
      const hasNew = game.state === 'run' && inFrame(ax, ay, game.t).some((f) => (game.got[f.tg.id] || 0) < f.stars) && light(camX(game.t) + ax) > 0.3;
      const fx = (ax - FW / 2) * k, fy = (ay - FH / 2) * k, fw = FW * k, fh = FH * k, c = Math.min(fw, fh) * 0.22;
      ctx.save();
      ctx.strokeStyle = hasNew ? '#8ff0c8' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.moveTo(x + sx * c, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * c);
      });
      ctx.stroke();
      ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(ax * k - 7, ay * k); ctx.lineTo(ax * k + 7, ay * k); ctx.moveTo(ax * k, ay * k - 7); ctx.lineTo(ax * k, ay * k + 7); ctx.stroke();
      ctx.restore();
      if (hasNew) label(ctx, L('¡Dispara!', 'Shoot!'), fx + fw / 2, fy - 12, { align: 'center', size: fs, color: '#8ff0c8', weight: 700 });
      // Flash de la foto
      if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.6})`; ctx.fillRect(0, 0, S.w, S.h); }
      // Mensajes sobre el canvas
      if (game.state !== 'run') {
        ctx.fillStyle = 'rgba(5,7,15,0.55)'; ctx.fillRect(0, 0, S.w, S.h);
        const big = S.w < 420 ? 16 : 20;
        if (game.state === 'ready') {
          label(ctx, L('Órbita de Marte · 400 km de altura', 'Mars orbit · 400 km up'), S.w / 2, S.h / 2 - 16, { align: 'center', size: big, color: '#fff', weight: 700 });
          label(ctx, L('Pulsa «Empezar la vuelta»', 'Press “Start the orbit”'), S.w / 2, S.h / 2 + 14, { align: 'center', size: fs + 1, color: '#ffd0b5' });
        } else {
          label(ctx, L('Fin de la vuelta', 'End of the orbit'), S.w / 2, S.h / 2 - 16, { align: 'center', size: big, color: '#fff', weight: 700 });
          label(ctx, `${game.score}/${maxScore} ${L('puntos', 'points')}`, S.w / 2, S.h / 2 + 14, { align: 'center', size: fs + 2, color: '#ffc857', weight: 700 });
        }
      } else {
        label(ctx, L('↓ Marte · la nave va hacia la derecha →', '↓ Mars · the spacecraft flies to the right →'), 10, 14, { size: fs - 1, color: 'rgba(255,255,255,0.75)', weight: 500 });
      }
    }

    function toUnits(e) {
      const r = canvas.getBoundingClientRect(), k = scale();
      return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    }
    function shootAt(p) {
      if (game.state !== 'run' || game.pending) return;
      const vw = S.w / scale();
      game.aim = p;
      game.pending = { x: clamp(p.x, FW / 2, vw - FW / 2), y: clamp(p.y, FH / 2, VH - FH / 2) };
    }
    canvas.addEventListener('pointermove', (e) => { game.aim = toUnits(e); if (game.state !== 'run') draw(); });
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); shootAt(toUnits(e)); });
    canvas.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (game.state !== 'run') return start();
        shootAt(game.aim || { x: S.w / scale() / 2, y: VH / 2 });
      }
    });
    function start() {
      if (game.state === 'done') reset();
      game.state = 'run'; game.msg = null;
      startBtn.disabled = true;
      setResult();
    }
    startBtn.addEventListener('click', start);
    resetBtn.addEventListener('click', reset);

    runWhenVisible(canvas, (dt) => {
      if (game.state === 'run') {
        game.t += dt;
        if (game.t >= T_ORBIT) { game.t = T_ORBIT; finish('time'); }
      }
      game.flash = Math.max(0, game.flash - dt * 3);
      draw();
      updateHud();
    });

    onLang.push(() => {
      hudKey = ''; updateHud(); setResult();
      game.photos.forEach((p) => { if (p.fig) p.fig.textContent = caption(p); });
      draw();
    });
    reset();
  })();

  /* ---------- Juego: Tú decides (historia con decisiones) ---------- */
  (function storyGame() {
    const root = $('#st-root');
    if (!root) return;

    const PEOPLE = {
      lucia: { icon: '👩🏽‍🔧', name: 'Lucía', role: ['propulsión', 'propulsion'], color: 'rgba(255,122,69,.28)' },
      mateo: { icon: '👨🏻‍🔬', name: 'Mateo', role: ['ciencia', 'science'], color: 'rgba(78,163,255,.28)' },
    };
    const SCENES = {
      launch: 'linear-gradient(160deg, #3a2a52 0%, #1b2440 55%, #0b1020 100%)',
      moon: 'radial-gradient(circle at 85% 30%, rgba(220,226,240,.35) 0 12%, transparent 13%), linear-gradient(160deg, #1c2236, #070a14)',
      sun: 'radial-gradient(circle at 15% 25%, rgba(255,200,90,.7) 0 9%, rgba(255,140,40,.25) 22%, transparent 45%), linear-gradient(160deg, #3a1d0c, #0b0d18)',
      mars: 'radial-gradient(circle at 82% 120%, #d1582c 0 32%, transparent 33%), linear-gradient(160deg, #2a1410, #0b0d18)',
      dust: 'radial-gradient(circle at 70% 90%, rgba(222,160,110,.55), transparent 60%), linear-gradient(160deg, #4a2614, #120b0a)',
      radio: 'radial-gradient(circle at 20% 80%, rgba(78,163,255,.35), transparent 50%), linear-gradient(160deg, #0f1d33, #070a14)',
    };
    const ENDINGS = {
      legend: { icon: '🏆', title: ['Misión legendaria', 'Legendary mission'] },
      success: { icon: '✅', title: ['Misión cumplida', 'Mission accomplished'] },
      half: { icon: '🌗', title: ['Misión a medias', 'Half a mission'] },
      flyby: { icon: '☄️', title: ['De paso por Marte', 'Just passing Mars'] },
      lost: { icon: '📡', title: ['Silencio en la radio', 'Radio silence'] },
    };

    // Cada capítulo: escena, textos, opiniones del equipo y opciones.
    // Cada opción cambia el estado (s) y devuelve lo que ha pasado.
    const NODES = {
      launch: {
        step: 1, scene: 'launch', icon: '🚀', kicker: ['Capítulo 1 · Cuenta atrás', 'Chapter 1 · Countdown'],
        title: ['Vientos en lo alto', 'High-altitude winds'],
        text: () => [['Faltan 10 minutos para el despegue. Los globos meteorológicos detectan <strong>vientos muy fuertes a 12 km de altura</strong>. Si esperamos un día, la Luna ya no estará en el punto exacto del encuentro.',
          'Ten minutes to lift-off. Weather balloons detect <strong>very strong winds 12 km up</strong>. If we wait a day, the Moon will no longer be at the exact meeting point.']],
        voices: [['lucia', 'Esos vientos sacuden mucho el cohete. Yo esperaría.', 'Those winds shake the rocket hard. I’d wait.'],
          ['mateo', 'Si esperamos, gastaremos combustible extra para alcanzar a la Luna.', 'If we wait, we’ll burn extra fuel to catch the Moon.']],
        choices: [
          { label: ['Despegar ahora', 'Launch now'], hint: ['Mantenemos el plan, con sacudidas', 'Keep the plan, with a bumpy ride'],
            go: (s) => { s.health -= 15; s.shaken = true; return { team: { lucia: -1, mateo: 1 }, next: 'moon',
              text: ['El cohete tiembla al atravesar los vientos, pero llega a órbita. Al revisar los datos, ves que <strong>la cámara ha quedado un poco desalineada</strong>.',
                'The rocket shudders through the winds but reaches orbit. Checking the data, you see <strong>the camera has been knocked slightly out of line</strong>.'] }; } },
          { label: ['Esperar un día', 'Wait one day'], hint: ['Más seguro, pero gasta combustible', 'Safer, but costs fuel'],
            go: (s) => { s.fuel -= 20; return { team: { lucia: 1, mateo: -1 }, next: 'moon',
              text: ['Despegue perfecto, sin sacudidas. Pero en un día la Luna avanza unos <strong>88.000 km</strong> en su órbita, así que hay que encender el motor más rato para alcanzarla.',
                'A perfect, smooth launch. But in one day the Moon moves about <strong>88,000 km</strong> along its orbit, so the engine must burn longer to catch it.'] }; } },
        ],
      },
      moon: {
        step: 2, scene: 'moon', icon: '🌙', kicker: ['Capítulo 2 · Efecto honda', 'Chapter 2 · Slingshot'],
        title: ['¿A qué distancia de la Luna?', 'How close to the Moon?'],
        text: () => [['Tres días después, la nave llega a la Luna. Cuanto más cerca pase, <strong>más la desvía su gravedad y más impulso gana</strong>. Pero al pasar por detrás, la Luna tapa la radio y nos quedamos <strong>sin contacto</strong> unos minutos.',
          'Three days later the spacecraft reaches the Moon. The closer it passes, <strong>the more the Moon’s gravity bends its path and the bigger the boost</strong>. But behind the Moon the radio is blocked and we lose <strong>contact</strong> for a few minutes.']],
        voices: [['lucia', 'Pasar a 100 km es apurar mucho. A 1.000 km vamos tranquilos.', 'Passing at 100 km is cutting it fine. At 1,000 km we’re relaxed.'],
          ['mateo', 'Un buen impulso ahora nos ahorra combustible para frenar en Marte.', 'A good boost now saves fuel for braking at Mars.']],
        choices: [
          { label: ['Rozarla: a 100 km', 'Skim it: 100 km'], hint: ['Más impulso, más riesgo', 'More boost, more risk'],
            go: (s) => { s.fuel = Math.min(100, s.fuel + 15);
              const extra = s.shaken ? (s.health -= 10, ['Como la cámara y los sensores vibraron en el despegue, la nave se desvía un poco y hay que corregir a última hora: <strong>algo de desgaste</strong>. ', 'Because the sensors were shaken at launch, the spacecraft drifts a little and needs a last-minute fix: <strong>some wear and tear</strong>. ']) : ['', ''];
              return { team: { lucia: -1, mateo: 1 }, next: 'storm',
                text: [extra[0] + '¡Impulso enorme! Tras unos minutos de silencio, la señal vuelve: la nave sale disparada hacia Marte <strong>ahorrando combustible</strong>.',
                  extra[1] + 'A huge boost! After a few silent minutes the signal returns: the spacecraft shoots off towards Mars, <strong>saving fuel</strong>.'] }; } },
          { label: ['Ir seguros: a 1.000 km', 'Play safe: 1,000 km'], hint: ['Menos impulso', 'Less boost'],
            go: (s) => { s.fuel -= 30; return { team: { lucia: 1, mateo: -1 }, next: 'storm',
              text: ['Paso tranquilo y sin sorpresas. Pero la Luna la desvía menos, así que hay que <strong>encender el motor</strong> para completar el impulso.',
                'A calm pass with no surprises. But the Moon bends the path less, so the <strong>engine has to fire</strong> to complete the boost.'] }; } },
        ],
      },
      storm: {
        step: 3, scene: 'sun', icon: '☀️', kicker: ['Capítulo 3 · Rumbo a Marte', 'Chapter 3 · Bound for Mars'],
        title: ['Tormenta solar', 'Solar storm'],
        text: () => [['Tres meses de viaje. De repente, el Sol lanza una enorme nube de partículas: una <strong>eyección de masa coronal</strong>. Llegará a la nave en 20 horas y puede estropear la electrónica.',
          'Three months into the journey, the Sun suddenly hurls a huge cloud of particles: a <strong>coronal mass ejection</strong>. It will hit the spacecraft in 20 hours and could damage the electronics.']],
        voices: [['lucia', 'Modo seguro: giramos la nave para que los paneles hagan de escudo y apagamos casi todo.', 'Safe mode: we turn the spacecraft so the panels act as a shield and switch almost everything off.'],
          ['mateo', '¡Es una ocasión única para medir una tormenta solar de cerca!', 'It’s a once-in-a-lifetime chance to measure a solar storm up close!']],
        choices: [
          { label: ['Modo seguro', 'Safe mode'], hint: ['Girar la nave gasta combustible', 'Turning the spacecraft uses fuel'],
            go: (s) => { s.fuel -= 20; return { team: { lucia: 1, mateo: -1 }, next: 'arrive',
              text: ['Los pequeños propulsores giran la nave y la tormenta pasa <strong>sin causar daños</strong>. Eso sí, hemos gastado combustible y perdido 3 días de datos.',
                'The small thrusters turn the spacecraft and the storm passes <strong>without any damage</strong>. But we’ve used fuel and lost 3 days of data.'] }; } },
          { label: ['Medirlo todo', 'Measure everything'], hint: ['Mucha ciencia, mucho riesgo', 'Lots of science, lots of risk'],
            go: (s) => { s.health -= 25; s.science += 25; return { team: { lucia: -1, mateo: 1 }, next: 'arrive',
              text: ['¡Datos increíbles de la tormenta! Pero las partículas <strong>dañan parte de la memoria y del transmisor</strong>. La nave sigue funcionando… por ahora.',
                'Amazing storm data! But the particles <strong>damage part of the memory and the transmitter</strong>. The spacecraft keeps working… for now.'] }; } },
          { label: ['Solo el detector de partículas', 'Only the particle detector'], hint: ['Un término medio', 'A middle way'],
            go: (s) => { s.health -= 10; s.science += 10; return { team: {}, next: 'arrive',
              text: ['Apagas casi todo y dejas encendido un único instrumento. Consigues <strong>algunos datos</strong> y la nave sufre <strong>pocos daños</strong>. Ni Lucía ni Mateo protestan.',
                'You switch almost everything off and leave a single instrument on. You get <strong>some data</strong> and the spacecraft takes <strong>little damage</strong>. Neither Lucía nor Mateo complains.'] }; } },
        ],
      },
      arrive: {
        step: 4, scene: 'mars', icon: '🔴', kicker: ['Capítulo 4 · Llegada', 'Chapter 4 · Arrival'],
        title: ['Frenar para quedarse', 'Brake to stay'],
        text: (s) => [['Siete meses después, Marte llena la pantalla. Llegamos demasiado rápido: si no frenamos, <strong>pasaremos de largo</strong>. Hay dos formas de frenar.',
          'Seven months later, Mars fills the screen. We’re arriving too fast: if we don’t brake, <strong>we’ll fly straight past</strong>. There are two ways to brake.'],
          [`Combustible que queda: <strong>${s.fuel} %</strong>.`, `Fuel left: <strong>${s.fuel}%</strong>.`]],
        voices: [['lucia', 'Con el motor es rápido y seguro, pero gasta muchísimo.', 'Using the engine is quick and safe, but it burns a lot.'],
          ['mateo', 'Con la atmósfera frenamos casi gratis, aunque tarda unos 75 días y la nave se calienta.', 'Using the atmosphere brakes us almost for free, though it takes about 75 days and the spacecraft heats up.']],
        choices: [
          { label: ['Frenar con el motor', 'Brake with the engine'], hint: ['Necesita 70 % de combustible', 'Needs 70% fuel'], need: (s) => s.fuel >= 70,
            go: (s) => { s.fuel -= 70; return { team: { lucia: 1 }, next: 'dust',
              text: ['Un encendido largo y potente. Marte atrapa la nave <strong>a la primera</strong> y en un día ya está en su órbita para hacer fotos.',
                'One long, powerful burn. Mars captures the spacecraft <strong>first time</strong>, and within a day it is in its imaging orbit.'] }; } },
          { label: ['Motor un poco + aerofrenado', 'A little engine + aerobraking'], hint: ['Necesita 35 % de combustible', 'Needs 35% fuel'], need: (s) => s.fuel >= 35,
            go: (s) => { s.fuel -= 35; s.health -= 10; return { team: { mateo: 1 }, next: 'dust',
              text: ['Un encendido corto para quedarse en una órbita alargada y, después, <strong>75 días rozando el aire de Marte</strong> para ir frenando. Ahorras combustible, aunque el calor desgasta un poco la nave.',
                'A short burn into a long, stretched orbit, then <strong>75 days skimming Mars’ air</strong> to slow down. You save fuel, though the heat wears the spacecraft a little.'] }; } },
          { label: ['No podemos frenar: aprovechar el sobrevuelo', 'We can’t brake: make the most of the flyby'], hint: ['Solo si no queda combustible suficiente', 'Only if there isn’t enough fuel'], need: (s) => s.fuel < 35,
            go: (s) => { s.science += 15; return { team: {}, next: 'END:flyby',
              text: ['No queda combustible para frenar. La nave cruza junto a Marte a toda velocidad y <strong>hace todas las fotos que puede en unas horas</strong>, como hicieron las primeras sondas en los años 60.',
                'There isn’t enough fuel to brake. The spacecraft races past Mars and <strong>takes every photo it can in a few hours</strong>, just like the first probes did in the 1960s.'] }; } },
        ],
      },
      dust: {
        step: 5, scene: 'dust', icon: '🌪️', kicker: ['Capítulo 5 · En órbita', 'Chapter 5 · In orbit'],
        title: ['Una tormenta de polvo', 'A dust storm'],
        text: (s) => [['¡Estamos en órbita! Pero una <strong>tormenta de polvo</strong> cubre medio planeta y las fotos saldrán marrones y sin detalle. Puede durar semanas.',
          'We’re in orbit! But a <strong>dust storm</strong> covers half the planet, so the photos would come out brown and blurry. It could last for weeks.'],
          ...(s.shaken ? [['Además, la cámara sigue un poco desalineada desde el despegue.', 'Also, the camera is still slightly out of line since launch.']] : [])],
        voices: [['lucia', 'Esperemos a que pase. La nave está en órbita, por encima del polvo: no corre peligro.', 'Let’s wait for it to pass. The spacecraft is in orbit, above the dust: it’s not in danger.'],
          ['mateo', '¡Fotografiemos la tormenta! Así aprenderemos cómo se forman.', 'Let’s photograph the storm! That’s how we learn how they form.']],
        choices: (s) => s.shaken ? [
          { label: ['Esperar y recalibrar la cámara', 'Wait and recalibrate the camera'], hint: ['Aprovechar el tiempo', 'Make good use of the time'],
            go: (s) => { s.shaken = false; s.science += 25; return { team: { lucia: 1 }, next: 'send',
              text: ['Mientras el polvo se asienta, el equipo hace fotos de estrellas para <strong>recalibrar la cámara</strong>. Cuando el cielo se despeja, las fotos salen <strong>nítidas</strong>.',
                'While the dust settles, the team photographs stars to <strong>recalibrate the camera</strong>. When the sky clears, the photos come out <strong>sharp</strong>.'] }; } },
          { label: ['Fotografiar la tormenta ya', 'Photograph the storm now'], hint: ['Con la cámara desalineada', 'With the camera out of line'],
            go: (s) => { s.science += 10; return { team: { mateo: 1, lucia: -1 }, next: 'send',
              text: ['Consigues fotos de la tormenta, pero <strong>algo borrosas</strong> por la cámara desalineada. Útiles, aunque no perfectas.',
                'You get photos of the storm, but they’re <strong>a bit blurry</strong> because of the misaligned camera. Useful, though not perfect.'] }; } },
        ] : [
          { label: ['Esperar a que se despeje', 'Wait for it to clear'], hint: ['Unas semanas de paciencia', 'A few weeks of patience'],
            go: (s) => { s.science += 30; return { team: { lucia: 1 }, next: 'send',
              text: ['Seis semanas después el aire se limpia y aparecen <strong>volcanes, cañones y cráteres con todo detalle</strong>. ¡Fotos espectaculares!',
                'Six weeks later the air clears and <strong>volcanoes, canyons and craters</strong> appear in full detail. Spectacular photos!'] }; } },
          { label: ['Fotografiar la tormenta', 'Photograph the storm'], hint: ['Ciencia sobre el tiempo marciano', 'Science about Martian weather'],
            go: (s) => { s.science += 20; return { team: { mateo: 1 }, next: 'send',
              text: ['Fotografías la tormenta día a día y descubres un <strong>remolino de polvo gigante</strong>. Los meteorólogos de la Tierra están encantados.',
                'You photograph the storm day after day and discover a <strong>giant dust devil</strong>. Weather scientists on Earth are delighted.'] }; } },
        ],
      },
      send: {
        step: 6, scene: 'radio', icon: '📡', kicker: ['Capítulo 6 · Último paso', 'Chapter 6 · Final step'],
        title: ['Fotos para la Tierra', 'Photos for Earth'],
        text: (s) => [['Marte está a cientos de millones de km y la antena solo puede enviar <strong>unas pocas fotos al día</strong>. Queda una última decisión.',
          'Mars is hundreds of millions of km away and the antenna can only send <strong>a few photos a day</strong>. One last decision remains.'],
          [`Estado de la nave: <strong>${s.health} %</strong> · Combustible: <strong>${s.fuel} %</strong>.`, `Spacecraft health: <strong>${s.health}%</strong> · Fuel: <strong>${s.fuel}%</strong>.`]],
        voices: [['lucia', 'Mandemos ya las mejores fotos. Lo seguro primero.', 'Let’s send the best photos now. Safety first.'],
          ['mateo', 'Si bajamos la órbita, las fotos tendrán el doble de detalle.', 'If we lower the orbit, the photos will have twice the detail.']],
        choices: [
          { label: ['Enviar ya las mejores fotos', 'Send the best photos now'], hint: ['Seguro', 'Safe'],
            go: (s) => { s.science += 15; return { team: { lucia: 1 }, next: 'END',
              text: ['La nave gira hasta apuntar la antena a la Tierra y empieza a enviar. Cada foto tarda <strong>entre 3 y 22 minutos</strong> en llegar, viajando a la velocidad de la luz.',
                'The spacecraft turns its antenna towards Earth and starts sending. Each photo takes <strong>3 to 22 minutes</strong> to arrive, travelling at the speed of light.'] }; } },
          { label: ['Bajar la órbita para fotos más detalladas', 'Lower the orbit for more detailed photos'], hint: ['Necesita 15 % de combustible', 'Needs 15% fuel'], need: (s) => s.fuel >= 15,
            go: (s) => { s.fuel -= 15;
              if (s.health < 60) return { team: { mateo: 1, lucia: -1 }, next: 'END:lost',
                text: ['El motor se enciende… y el transmisor, ya tocado, <strong>deja de responder</strong>. Llegan las primeras fotos de cerca y, después, silencio.',
                  'The engine fires… and the already damaged transmitter <strong>stops responding</strong>. The first close-up photos arrive, and then silence.'] };
              s.science += 30; return { team: { mateo: 1 }, next: 'END',
                text: ['Órbita más baja, fotos <strong>el doble de detalladas</strong>. Desde ahí se distinguen rocas del tamaño de un coche.',
                  'A lower orbit and <strong>twice the detail</strong>. From there you can make out rocks the size of a car.'] }; } },
        ],
      },
    };

    const endingText = (key, s) => ({
      legend: ['La nave da miles de vueltas a Marte enviando fotos espectaculares. Tus decisiones encajaron como piezas de un reloj: la misión pasa a los libros de texto.',
        'The spacecraft circles Mars thousands of times, sending back spectacular photos. Your decisions fitted together like clockwork: the mission makes it into the textbooks.'],
      success: ['La nave está en órbita y las fotos llegan a la Tierra. No todo salió perfecto, pero el objetivo está cumplido. ¡Buen trabajo!',
        'The spacecraft is in orbit and the photos are reaching Earth. Not everything went perfectly, but the goal is achieved. Good job!'],
      half: ['La nave llegó a Marte, pero las fotos son pocas o no muy buenas. Has aprendido mucho para la próxima misión.',
        'The spacecraft reached Mars, but there are few photos, or they aren’t very good. You’ve learned a lot for the next mission.'],
      flyby: ['La nave no pudo quedarse, pero las fotos del sobrevuelo llegaron a la Tierra. Ahora sigue su viaje alrededor del Sol, para siempre.',
        'The spacecraft couldn’t stay, but the flyby photos reached Earth. Now it carries on around the Sun, forever.'],
      lost: ['La tormenta solar había dejado el transmisor muy dañado. Algunas fotos llegaron, pero ya no sabremos nada más de la nave. Pista: cuida el estado de la nave.',
        'The solar storm had left the transmitter badly damaged. Some photos arrived, but we’ll never hear from the spacecraft again. Hint: look after the spacecraft’s health.'],
    }[key]);

    let found = new Set();
    try { found = new Set(JSON.parse(localStorage.getItem('stEndings') || '[]')); } catch (e) { /* sin almacenamiento */ }
    const saveFound = () => { try { localStorage.setItem('stEndings', JSON.stringify([...found])); } catch (e) { /* sin almacenamiento */ } };

    let s, view;
    function newGame() {
      s = { fuel: 100, health: 100, science: 0, shaken: false, team: { lucia: 0, mateo: 0 }, path: [] };
      view = { node: 'launch', phase: 'choose', res: null };
    }

    const pair = (p) => L(p[0], p[1]);
    function meters() {
      const m = (icon, name, v, max, color, unit) => `<span class="st-meter">${icon} ${name}<span class="st-bar"><i style="width:${clamp(v / max, 0, 1) * 100}%;--c:${color}"></i></span><b>${v}${unit}</b></span>`;
      const step = view.node.startsWith('END') ? 7 : NODES[view.node].step;
      const steps = [1, 2, 3, 4, 5, 6].map((i) => `<span class="${i < step || (i === step && view.phase === 'result') ? 'done' : i === step ? 'now' : ''}"></span>`).join('');
      return `<div class="st-meters">${m('⛽', L('Combustible', 'Fuel'), s.fuel, 100, '#ffc857', ' %')}${m('🛡️', L('Nave', 'Spacecraft'), s.health, 100, '#6be3b5', ' %')}${m('🔬', L('Ciencia', 'Science'), s.science, 100, '#7fbfff', '')}<span class="st-steps" aria-hidden="true">${steps}</span></div>`;
    }

    const choicesOf = (n) => (typeof n.choices === 'function' ? n.choices(s) : n.choices);

    function render() {
      if (view.node.startsWith('END')) return renderEnd();
      const n = NODES[view.node];
      let body = n.text(s).map((p) => `<p>${pair(p)}</p>`).join('');
      if (view.phase === 'choose') {
        body += '<div class="st-voices">' + n.voices.map(([who, es, en]) => {
          const P = PEOPLE[who];
          return `<div class="st-voice"><span class="st-av" style="--av:${P.color}">${P.icon}</span><span><b>${P.name}</b> · ${L(...P.role)}<br>«${L(es, en)}»</span></div>`;
        }).join('') + '</div>';
        body += '<div class="st-choices">' + choicesOf(n).map((c, i) => {
          const ok = !c.need || c.need(s);
          return `<button class="st-choice" type="button" data-i="${i}"${ok ? '' : ' disabled'}>${pair(c.label)}<small>${pair(c.hint)}${ok ? '' : ' · ' + L('no es posible', 'not possible')}</small></button>`;
        }).join('') + '</div>';
      } else {
        const r = view.res;
        const chips = r.deltas.map(([icon, d, unit]) => `<span class="st-chip ${d > 0 ? 'up' : 'down'}">${icon} ${d > 0 ? '+' : '−'}${Math.abs(d)}${unit}</span>`)
          .concat(Object.entries(r.team).filter(([, v]) => v).map(([who, v]) => `<span class="st-chip team">${PEOPLE[who].icon} ${v > 0
            ? L(`${PEOPLE[who].name} está de acuerdo contigo`, `${PEOPLE[who].name} agrees with you`)
            : L(`A ${PEOPLE[who].name} no le ha convencido`, `${PEOPLE[who].name} isn’t convinced`)}</span>`)).join('');
        body += `<div class="st-result"><p><strong>${L('Has elegido', 'You chose')}: ${pair(r.label)}.</strong></p><p>${pair(r.text)}</p>${chips ? `<div class="st-chips">${chips}</div>` : ''}</div>`;
        body += `<div class="st-actions"><button class="btn small primary" type="button" data-act="next">${L('Continuar →', 'Continue →')}</button></div>`;
      }
      root.innerHTML = meters() + `<div class="st-scene" style="--scene:${SCENES[n.scene]}"><span class="st-icon" aria-hidden="true">${n.icon}</span><div><p class="st-kicker">${pair(n.kicker)}</p><h4>${pair(n.title)}</h4></div></div>` +
        `<div class="st-body">${body}</div>`;
    }

    function endingKey() {
      const forced = view.node.split(':')[1];
      if (forced) return forced;
      return s.science >= 70 ? 'legend' : s.science >= 40 ? 'success' : 'half';
    }

    function renderEnd() {
      const key = endingKey();
      const E = ENDINGS[key];
      const teamLine = (who) => {
        const v = s.team[who], P = PEOPLE[who];
        return v > 0 ? L(`${P.name} confía mucho en ti.`, `${P.name} trusts you a lot.`) : v < 0 ? L(`${P.name} habría hecho las cosas de otra forma.`, `${P.name} would have done things differently.`) : L(`${P.name} piensa que has escuchado a todo el equipo.`, `${P.name} thinks you listened to the whole team.`);
      };
      const path = s.path.map((p) => `<li>${pair(p)}</li>`).join('');
      const ends = Object.keys(ENDINGS).map((k) => `<span class="${found.has(k) ? 'found' : ''}">${found.has(k) ? ENDINGS[k].icon + ' ' + pair(ENDINGS[k].title) : '❔ ' + L('Final oculto', 'Hidden ending')}</span>`).join('');
      root.innerHTML = meters() + `<div class="st-scene" style="--scene:${SCENES[key === 'flyby' || key === 'lost' ? 'radio' : 'mars']}"><span class="st-icon" aria-hidden="true">${E.icon}</span><div><p class="st-kicker">${L('Final', 'Ending')} · ${found.size}/5 ${L('descubiertos', 'found')}</p><h4>${pair(E.title)}</h4></div></div>` +
        `<div class="st-body"><p>${pair(endingText(key, s))}</p>` +
        `<p class="fine">${teamLine('lucia')} ${teamLine('mateo')}</p>` +
        `<p><strong>${L('Tu camino', 'Your path')}:</strong></p><ul class="st-path">${path}</ul>` +
        `<p><strong>${L('Finales', 'Endings')}:</strong></p><div class="st-endings">${ends}</div>` +
        `<div class="st-actions"><button class="btn small primary" type="button" data-act="again">↺ ${L('Jugar otra vez y decidir distinto', 'Play again and choose differently')}</button></div></div>`;
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.i !== undefined) {
        const c = choicesOf(NODES[view.node])[+b.dataset.i];
        const before = { fuel: s.fuel, health: s.health, science: s.science };
        const out = c.go(s);
        s.fuel = Math.max(0, s.fuel); s.health = Math.max(0, s.health);
        Object.entries(out.team).forEach(([who, v]) => { s.team[who] += v; });
        s.path.push(c.label);
        const deltas = [['⛽', s.fuel - before.fuel, ' %'], ['🛡️', s.health - before.health, ' %'], ['🔬', s.science - before.science, '']].filter(([, d]) => d);
        view = { node: view.node, phase: 'result', res: { label: c.label, text: out.text, team: out.team, deltas, next: out.next } };
        render();
      } else if (b.dataset.act === 'next') {
        view = { node: view.res.next, phase: 'choose', res: null };
        if (view.node.startsWith('END')) { found.add(endingKey()); saveFound(); }
        render();
        root.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      } else if (b.dataset.act === 'again') {
        newGame(); render();
        root.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });

    newGame();
    render();
    onLang.push(render);
  })();

  /* ---------- Cambio de idioma (botón con bandera) ---------- */
  (function i18n() {
    const EN = window.I18N_EN || {};
    // Textos que pone el JavaScript: no se traducen desde el diccionario
    const SKIP = new Set(['solar-date', 'solar-next', 'solar-play', 'solar-status', 'sling-speed', 'm-day', 'm-date', 'm-photos',
      'm-status', 'm-play', 'fb-days', 'fb-dist', 'fb-moon', 'fb-escape', 'fb-play', 'fb-part-kicker', 'fb-part-title', 'fb-part-text',
      'dist-mars', 'dist-ratio', 'dist-meters', 'dist-light', 'dist-case-note', 'tl-launch', 'tl-arrival', 'lang-btn',
      'm-around', 'm-photos', 'm-delay', 'tl-aero', 'tl-photos', 'spin-caption', 'gs-mode', 'gs-speedup', 'gs-results', 'mg-result', 'pg-hud', 'pg-result', 'pg-gallery', 'st-root']);
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
    const attrs = $$('[aria-label]').filter((el) => el.id !== 'lang-btn').map((el) => ({ el, es: el.getAttribute('aria-label') }));
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
