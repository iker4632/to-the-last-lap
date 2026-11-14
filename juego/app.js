/* UI for Misión a lo Loco: start -> secret goals -> design -> simulation -> report. */

const app = document.getElementById("app");
const G = {
  screen: "start", scenario: "huracan", difficulty: "ingeniero",
  players: [{ name: "" }], design: null, tab: "dir", run: null, timer: null, history: [], outcome: null, revealed: -1
};

function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "style") n.style.cssText = v;
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}
const fmtN = v => Math.round(v).toLocaleString("es");
// fmt1 comes from model.js
const pctS = v => Math.round(v * 100) + "%";
const moneyS = v => v === Infinity ? "sin límite" : "$" + fmt1(v) + " M";

/* Optional lessons in The Last Lap (the site one folder up) for each part of the design. */
const LEARN = {
  dir: [["../#orbitas", "Cómo se mueven la Tierra, la Luna y Marte"], ["../#oposicion", "Por qué a Marte solo se viaja cada 26 meses"], ["../#honda", "El efecto honda: ganar velocidad gratis"]],
  ing: [["../#orientacion", "Cómo se orienta una nave: cámara, antena, paneles y motor"], ["../#magnetismo", "El escudo magnético y la radiación"]],
  sci: [["../#mision", "Una misión a Marte paso a paso"], ["../#zoom-luna", "Qué se observa al pasar junto a la Luna"]],
  com: [["../#distancias", "Cuánto tarda una señal en llegar desde Marte"], ["../#orientacion", "Por qué la antena tiene que apuntar a la Tierra"]]
};
function learnLinks(role) {
  return h("p", { class: "learn" }, "📚 Aprende más: ",
    ...LEARN[role].flatMap(([href, text], i) => [i ? " · " : "", h("a", { href }, text)]));
}

/* Which roles each player holds, for 1-4 players. */
function roleAssignment(n) {
  return [
    [ROLE_ORDER],
    [["dir", "sci"], ["ing", "com"]],
    [["dir", "com"], ["ing"], ["sci"]],
    [["dir"], ["ing"], ["sci"], ["com"]]
  ][n - 1];
}
function ownerOf(role) {
  const a = roleAssignment(G.players.length);
  const i = a.findIndex(rs => rs.includes(role));
  return G.players[i] ? (G.players[i].name || `Jugador ${i + 1}`) : "";
}
const team = () => G.players.length > 1;

function show(screen) {
  G.screen = screen;
  if (G.timer) { clearInterval(G.timer); G.timer = null; }
  document.getElementById("homeBtn").hidden = screen === "start";
  render();
  window.scrollTo(0, 0);
}
function render() {
  // Re-rendering replaces the DOM, so remember which control had focus and restore it.
  const a = document.activeElement;
  const key = a && a !== document.body ? (a.id ? "#" + CSS.escape(a.id) : a.getAttribute("aria-label") ? `[aria-label="${CSS.escape(a.getAttribute("aria-label"))}"]` : null) : null;
  app.replaceChildren(({ start: viewStart, secrets: viewSecrets, design: viewDesign, sim: viewSim, report: viewReport })[G.screen]());
  if (key) { const n = app.querySelector(key); if (n && !n.disabled) n.focus({ preventScroll: true }); }
}

/* ---------------- Start ---------------- */
function viewStart() {
  const scen = h("div", { class: "grid2" }, Object.entries(SCENARIOS).map(([id, s]) =>
    h("button", { type: "button", class: "choice", "aria-pressed": String(G.scenario === id), onclick: () => { G.scenario = id; render(); } },
      h("b", null, `${s.emoji} ${s.name}`), h("span", null, s.brief),
      h("div", { class: "small", style: "margin-top:6px" }, s.sandbox ? "Presupuesto: sin límite" : `Presupuesto base: ${moneyS(s.budget)} · Meta: ${s.goal} puntos de ciencia`))));

  const diff = h("div", { class: "row" }, Object.entries(DIFFICULTY).map(([id, d]) =>
    h("button", { type: "button", "aria-pressed": String(G.difficulty === id), title: d.desc, onclick: () => { G.difficulty = id; render(); } }, d.name)));

  const n = G.players.length;
  const playerCount = h("div", { class: "row" }, [1, 2, 3, 4].map(k =>
    h("button", { type: "button", "aria-pressed": String(n === k), onclick: () => {
      while (G.players.length < k) G.players.push({ name: "" });
      G.players.length = k; render();
    } }, k === 1 ? "1 jugador" : `${k} jugadores`)));

  const assign = roleAssignment(n);
  const names = h("div", { class: "grid2" }, G.players.map((p, i) =>
    h("div", null,
      h("label", { for: "pn" + i, class: "small muted" }, `Jugador ${i + 1}: ` + assign[i].map(r => ROLES[r].emoji + " " + ROLES[r].name).join(" + ")),
      h("input", { type: "text", id: "pn" + i, maxlength: 20, value: p.name, placeholder: `Nombre del jugador ${i + 1}`, oninput: e => { p.name = e.target.value; } }))));

  return h("div", { class: "stack" },
    h("section", { class: "card" },
      h("h2", null, "1. Elige la misión"), scen),
    h("section", { class: "card" },
      h("h2", null, "2. Dificultad"), diff,
      h("p", { class: "small muted" }, DIFFICULTY[G.difficulty].desc)),
    h("section", { class: "card" },
      h("h2", null, "3. ¿Quiénes juegan?"), playerCount,
      h("p", { class: "small muted" }, n === 1
        ? "Jugarás todos los roles: dirección, ingeniería, ciencia y comunicaciones."
        : "Cada jugador controla una parte de la nave y tiene un objetivo secreto. Tendrán que negociar en el mismo dispositivo."),
      names),
    h("div", { class: "row" },
      h("button", { type: "button", class: "primary big", onclick: startGame }, "Empezar misión 🚀")));
}

function startGame() {
  G.design = newDesign(G.scenario, G.difficulty);
  G.tab = "dir";
  G.revealed = -1;
  G.history = G.history.filter(x => x.scenario === G.scenario);
  show(team() ? "secrets" : "design");
}

/* ---------------- Secret goals (hot-seat) ---------------- */
function viewSecrets() {
  const assign = roleAssignment(G.players.length);
  return h("section", { class: "card stack" },
    h("h2", null, "Objetivos secretos"),
    h("p", null, "Pasen el dispositivo. Cada jugador toca su nombre, lee su rol y su objetivo secreto, y lo oculta antes de pasarlo. Los objetivos chocan entre sí: ¡negocien!"),
    ...G.players.map((p, i) => {
      const open = G.revealed === i;
      return h("div", null,
        h("button", { type: "button", "aria-expanded": String(open), onclick: () => { G.revealed = open ? -1 : i; render(); } },
          open ? "🙈 Ocultar" : `👀 Soy ${p.name || "Jugador " + (i + 1)}: ver mi objetivo`),
        open && h("div", { class: "secret" },
          ...assign[i].map(r => h("p", { style: "margin:0 0 8px" },
            h("b", null, `${ROLES[r].emoji} ${ROLES[r].name}: `), ROLES[r].owns + ".", h("br"),
            h("span", { class: "muted" }, "Objetivo secreto: "), ROLES[r].secret.text))));
    }),
    h("div", null, h("button", { type: "button", class: "primary big", onclick: () => show("design") }, "A diseñar la nave →")));
}

/* ---------------- Design ---------------- */
function viewDesign() {
  const d = G.design, r = evaluate(d), sc = SCENARIOS[d.scenario];
  const tabs = h("div", { class: "tabs", role: "tablist" }, ROLE_ORDER.map(role =>
    h("button", { type: "button", role: "tab", "aria-selected": String(G.tab === role), "aria-pressed": String(G.tab === role), onclick: () => { G.tab = role; render(); } },
      `${ROLES[role].emoji} ${ROLES[role].name}`, team() ? h("small", null, ownerOf(role)) : null)));

  const panel = G.tab === "dir" ? panelMission(d, r) : panelParts(d, G.tab);
  return h("div", { class: "stack" },
    h("section", { class: "card" },
      h("div", { class: "row", style: "justify-content:space-between" },
        h("div", null, h("b", { style: "font-size:18px" }, `${sc.emoji} ${sc.name}`), " ", h("span", { class: "pill" }, DIFFICULTY[d.difficulty].name)),
        h("span", { class: "muted small" }, `Presupuesto: ${moneyS(r.budget)} · Meta: ${sc.goal} puntos de ciencia`)),
      h("p", { style: "margin:8px 0 0" }, sc.brief, " ", h("span", { class: "muted" }, "💡 " + sc.hint))),
    h("div", { class: "design" },
      h("section", { class: "card" }, tabs,
        h("p", { class: "small muted", style: "margin-top:0" }, ROLES[G.tab].owns + (team() ? ` · decide ${ownerOf(G.tab)}` : "")),
        panel, learnLinks(G.tab)),
      h("aside", { class: "card sticky" }, dashboard(d, r))));
}

function panelMission(d, r) {
  const sc = SCENARIOS[d.scenario];
  const orbits = h("div", { class: "grid2" }, Object.entries(ORBITS).map(([id, o]) => {
    const fit = sc.fit[id] || 0;
    return h("button", { type: "button", class: "orbit", "aria-pressed": String(d.orbit === id), onclick: () => { d.orbit = id; render(); } },
      h("b", null, o.name), h("span", null, o.desc),
      h("div", { class: "fit", style: `color:${fit >= 1 ? "var(--good)" : fit > 0 ? "var(--accent)" : "var(--bad)"}` },
        fit >= 1 ? "✔ Ideal para esta misión" : fit > 0 ? `≈ Sirve a medias (${pctS(fit)})` : "✘ No sirve para este objetivo"));
  }));
  const launchers = h("div", { class: "grid2" }, Object.entries(LAUNCHERS).map(([id, l]) => {
    const cap = l.cap[ORBITS[d.orbit].launch];
    return h("button", { type: "button", class: "orbit", "aria-pressed": String(d.launcher === id), onclick: () => { d.launcher = id; render(); } },
      h("b", null, `${l.name} · ${moneyS(l.cost)}`),
      h("span", null, cap ? `Lleva hasta ${fmtN(cap)} kg a ${ORBITS[d.orbit].short}` : `No llega a ${ORBITS[d.orbit].short}`));
  }));
  return h("div", null,
    h("h3", null, "Órbita"), orbits,
    h("h3", null, "Cohete"), launchers,
    h("h3", null, "Duración planeada"),
    h("label", { for: "years", class: "small", id: "yearsLabel" }, yearsText(d.years)),
    h("input", { type: "range", id: "years", min: 1, max: 10, value: d.years,
      oninput: e => { d.years = +e.target.value; document.getElementById("yearsLabel").textContent = yearsText(d.years); },
      onchange: () => render() }));
}
function yearsText(y) {
  return `${y} ${y === 1 ? "año" : "años"} de operación (cada año cuesta dinero de operación y combustible)`;
}

function panelParts(d, role) {
  const adv = DIFFICULTY[d.difficulty].advanced;
  const ids = Object.keys(PARTS).filter(id => PARTS[id].role === role && (adv || !PARTS[id].advanced));
  const cats = [...new Set(ids.map(id => PARTS[id].cat))];
  const out = [];
  for (const c of cats) {
    out.push(h("h3", null, c));
    for (const id of ids.filter(i => PARTS[i].cat === c)) out.push(partRow(d, id));
  }
  if (role === "com") {
    out.push(h("h3", null, "Red de estaciones terrestres (segmento terrestre)"));
    out.push(h("div", { class: "grid2" }, Object.entries(NETWORKS).map(([id, n]) =>
      h("button", { type: "button", class: "orbit", "aria-pressed": String(d.network === id), onclick: () => { d.network = id; render(); } },
        h("b", null, `${n.name} · ${moneyS(n.costPerYear)}/año`), h("span", null, n.desc)))));
  }
  return h("div", null, out);
}

function partRow(d, id) {
  const p = PARTS[id], n = d.parts[id] || 0;
  const stats = [`${fmtN(p.mass)} kg`, moneyS(p.cost)];
  if (p.power) stats.push(`usa ${p.power} W`);
  if (p.solar) stats.push(`+${p.solar} W con Sol`);
  if (p.rtg) stats.push(`+${p.rtg} W siempre`);
  if (p.wh) stats.push(`${p.wh} Wh`);
  if (p.fuel) stats.push(`${p.fuel} kg de combustible`);
  if (p.rate) stats.push(`${p.rate} Mbps`);
  if (p.data) stats.push(`genera ${p.data} Mbps`);
  const set = v => { d.parts[id] = Math.max(0, Math.min(p.max, v)); if (!d.parts[id]) delete d.parts[id]; render(); };
  // Only one computer and one attitude system at a time: picking one swaps the other.
  const swap = v => {
    if (v > 0 && (p.brain || p.pointing)) for (const other of Object.keys(d.parts)) {
      const o = PARTS[other];
      if (other !== id && ((p.brain && o.brain) || (p.pointing && o.pointing))) delete d.parts[other];
    }
    set(v);
  };
  return h("div", { class: "part" },
    h("div", null, h("div", { class: "name" }, p.name, p.advanced ? h("span", { class: "pill", style: "margin-left:6px" }, "avanzado") : null),
      h("div", { class: "stats" }, stats.join(" · "))),
    h("div", { class: "counter" },
      h("button", { type: "button", "aria-label": "Quitar " + p.name, disabled: n === 0, onclick: () => swap(n - 1) }, "−"),
      h("output", { "aria-live": "polite" }, n),
      h("button", { type: "button", "aria-label": "Agregar " + p.name, disabled: n >= p.max, onclick: () => swap(n + 1) }, "+")),
    h("div", { class: "desc" }, p.desc));
}

function meter(label, value, frac, state, note) {
  return h("div", { class: "meter " + (state || "") },
    h("div", { class: "top" }, h("span", null, label), h("b", null, value)),
    frac == null ? null : h("div", { class: "bar" }, h("i", { style: `width:${Math.max(0, Math.min(1, frac)) * 100}%` })),
    note ? h("p", null, note) : null);
}

function dashboard(d, r) {
  const orb = ORBITS[d.orbit];
  const massState = r.wetMass > r.capacity ? "bad" : r.wetMass > 0.9 * r.capacity ? "warn" : "";
  const costState = !r.sandbox && r.cost > r.budget ? "bad" : !r.sandbox && r.cost > 0.9 * r.budget ? "warn" : "";
  const powerState = r.powerFactor < 0.8 ? "bad" : r.powerFactor < 1 ? "warn" : "";
  const dataState = r.dataPerDay === 0 ? "" : r.dataFactor < 0.6 ? "bad" : r.dataFactor < 0.95 ? "warn" : "";
  const fuelState = !r.arrives ? "bad" : r.fuel < r.fuelNeeded ? "warn" : "";
  const sciState = r.science >= r.goal ? "" : r.science >= 0.6 * r.goal ? "warn" : "bad";
  const canLaunch = r.blockers.length === 0;
  return h("div", null,
    craftSvg(d),
    h("div", { class: "seg" }, "Segmento de lanzamiento"),
    meter("Masa / capacidad del cohete", `${fmtN(r.wetMass)} / ${fmtN(r.capacity)} kg`, r.capacity ? r.wetMass / r.capacity : 1, massState,
      `Incluye ${fmtN(r.structure)} kg de estructura, que crece con todo lo que agregas.`),
    meter("Costo / presupuesto", `${moneyS(r.cost)} / ${moneyS(r.budget)}`, r.sandbox ? null : r.cost / r.budget, costState,
      `Piezas ${moneyS(r.costParts)} · cohete ${moneyS(r.costLaunch)} · desarrollo ${moneyS(r.costDev)} · operación ${moneyS(r.costOps)}`),
    h("div", { class: "seg" }, "Segmento espacial"),
    meter("Energía: genera / consume", `${fmtN(r.gen)} / ${fmtN(r.load)} W`, r.load ? r.gen / r.load : 1, powerState,
      orb.sun < 1 ? `En ${orb.short} los paneles reciben ${pctS(orb.sun)} de la luz.` : `A la sombra ${pctS(orb.eclipseFrac)} del tiempo.`),
    orb.eclipseFrac > 0 ? meter("Batería para la sombra", `${fmtN(r.battery)} / ${fmtN(r.batteryNeed)} Wh`, r.batteryNeed ? r.battery / r.batteryNeed : 1,
      r.battery < r.batteryNeed ? "warn" : "") : null,
    meter("Combustible", `${fmtN(r.fuel)} / ${fmtN(r.fuelNeeded)} kg`, r.fuelNeeded ? r.fuel / r.fuelNeeded : 1, fuelState,
      r.fuelArrive ? `${fmtN(r.fuelArrive)} kg para llegar y ${fmt1(r.fuelPerYear)} kg por año para mantener la órbita.` : `${fmt1(r.fuelPerYear)} kg por año para mantener la órbita.`),
    meter("Vida útil esperada", `${fmt1(r.lifetime)} de ${d.years} años`, r.lifetime / d.years, r.lifetime < d.years ? "warn" : "",
      r.lifeLimiter === "radiacion" ? "La radiación dañará la computadora comercial." : r.lifeLimiter === "combustible" ? "El combustible no alcanza para todos los años." : r.lifeLimiter === "arrastre" ? "Sin motor, la atmósfera la hará caer." : null),
    h("div", { class: "seg" }, "Segmento terrestre"),
    meter("Datos: genera / puede enviar", `${fmt1(r.dataPerDay)} / ${fmt1(r.downPerDay)} Gb/día`, r.dataPerDay ? r.dataFactor : null, dataState,
      `Contacto con estaciones: ${pctS(r.contact)} del día${r.recorder ? " · con grabadora" : " · sin grabadora"}`),
    h("div", { class: "seg" }, "Segmento de usuarios (ciencia)"),
    meter("Ciencia esperada / meta", `${fmtN(r.science)} / ${r.goal}`, r.science / r.goal, sciState, "Antes de las sorpresas del viaje."),
    (r.blockers.length || r.warnings.length) ? h("ul", { class: "alerts" },
      ...r.blockers.map(b => h("li", { class: "block" }, "⛔ " + b)), ...r.warnings.map(w => h("li", null, "⚠️ " + w))) : null,
    h("button", { type: "button", class: "primary big", style: "width:100%", disabled: !canLaunch, onclick: launch },
      canLaunch ? "🚀 ¡Lanzar!" : "Resuelve lo marcado con ⛔"),
    h("div", { class: "row", style: "margin-top:8px" },
      h("button", { type: "button", class: "small", onclick: shareDesign }, "🔗 Copiar diseño")));
}

/* Spacecraft drawing that grows with the parts you add. */
function craftSvg(d) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 360 190"); s.id = "craft"; s.setAttribute("role", "img");
  s.setAttribute("aria-label", "Dibujo de tu nave");
  const add = (tag, a) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); s.append(e); return e; };
  const c = id => d.parts[id] || 0;
  const cx = 180, cy = 100;
  const bodyW = 60 + Math.min(40, c("tanque") * 6), bodyH = 56;
  // solar wings
  const panels = c("solarS") + c("solarL") * 2.5;
  if (panels) {
    const len = Math.min(140, 30 + panels * 18);
    for (const dir of [-1, 1]) {
      const x0 = dir < 0 ? cx - bodyW / 2 - len : cx + bodyW / 2;
      add("rect", { x: x0, y: cy - 16, width: len, height: 32, fill: "#1f4fa8", stroke: "#7aa7ff", "stroke-width": 1.5, rx: 2 });
      for (let k = 1; k < Math.ceil(len / 18); k++) add("line", { x1: x0 + k * 18, y1: cy - 16, x2: x0 + k * 18, y2: cy + 16, stroke: "#7aa7ff", "stroke-width": .6 });
    }
  }
  // body
  add("rect", { x: cx - bodyW / 2, y: cy - bodyH / 2, width: bodyW, height: bodyH, rx: 6, fill: "#c9a24a", stroke: "#ffe2a0", "stroke-width": 1.5 });
  // tanks
  for (let k = 0; k < c("tanque"); k++) add("circle", { cx: cx - bodyW / 2 + 12 + (k % 3) * 14, cy: cy + bodyH / 2 + 8 + Math.floor(k / 3) * 12, r: 6, fill: "#9aa3b5" });
  // RTG fins
  for (let k = 0; k < c("rtg"); k++) add("rect", { x: cx + bodyW / 2 - 6 - k * 10, y: cy + bodyH / 2, width: 6, height: 24, fill: "#7a7f8c", stroke: "#ff6b6b" });
  // antennas
  if (c("antAlta")) add("path", { d: `M ${cx - 34} ${cy - bodyH / 2 - 4} Q ${cx} ${cy - bodyH / 2 - 52} ${cx + 34} ${cy - bodyH / 2 - 4} Z`, fill: "#e9edf7", stroke: "#a3acca" });
  if (c("antMedia")) add("ellipse", { cx: cx + bodyW / 2 - 10, cy: cy - bodyH / 2 - 10, rx: 12, ry: 6, fill: "#e9edf7" });
  if (c("antBaja")) add("line", { x1: cx - bodyW / 2 + 8, y1: cy - bodyH / 2, x2: cx - bodyW / 2 + 8, y2: cy - bodyH / 2 - 26, stroke: "#e9edf7", "stroke-width": 2 });
  // instruments
  const inst = Object.keys(d.parts).filter(id => PARTS[id].tags && d.parts[id]);
  const colors = ["#4fd1e6", "#ff6b6b", "#5fd38d", "#e66bd8", "#ffb238", "#b9a7ff", "#ffffff", "#7be0c8", "#f39c6b"];
  inst.forEach((id, k) => {
    if (id === "telescopio") { add("rect", { x: cx - 18, y: cy + bodyH / 2, width: 36, height: 40, fill: "#2c3763", stroke: "#4fd1e6" }); return; }
    add("rect", { x: cx - bodyW / 2 + 6 + (k % 4) * 13, y: cy - 8 + Math.floor(k / 4) * 13, width: 10, height: 10, rx: 2, fill: colors[k % colors.length] });
  });
  if (!Object.keys(d.parts).length) {
    const t = add("text", { x: cx, y: 180, fill: "#a3acca", "font-size": 12, "text-anchor": "middle" }); t.textContent = "Tu nave está vacía: agrega piezas en cada rol";
  }
  return s;
}

function shareDesign() {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(G.design))));
  const url = location.origin + location.pathname + "#d=" + code;
  navigator.clipboard.writeText(url).then(() => alert("Enlace del diseño copiado. Ábrelo en otro dispositivo para comparar."), () => prompt("Copia este enlace:", url));
}

/* ---------------- Simulation ---------------- */
function launch() {
  G.run = startRun(G.design, Math.floor(Math.random() * 1e9));
  show("sim");
  G.timer = setInterval(simTick, matchMedia("(prefers-reduced-motion: reduce)").matches ? 10 : 110);
}

function simTick() {
  const s = G.run;
  if (s.pending) return;
  stepRun(s);
  if (s.done && !s.pending) {
    clearInterval(G.timer); G.timer = null;
    G.outcome = finishRun(s, team() ? ROLE_ORDER : ROLE_ORDER);
    G.history.unshift({ scenario: G.design.scenario, orbit: G.design.orbit, cost: s.r.cost + s.extraCost, mass: s.r.wetMass, science: G.outcome.science, points: G.outcome.score.points, design: JSON.parse(JSON.stringify(G.design)) });
    setTimeout(() => show("report"), 700);
  }
  render();
}

function viewSim() {
  const s = G.run, r = s.r, d = G.design, orb = ORBITS[d.orbit];
  const sci = s.science + s.bonus;
  const node = h("div", { class: "sim" },
    h("div", null, spaceSvg(s)),
    h("aside", { class: "card" },
      h("h2", null, `Mes ${s.month} de ${Math.max(s.lifeMonths, s.month)}`),
      !s.arrived ? h("p", { class: "muted" }, "⚠️ No había combustible para frenar: la nave pasa de largo...") : null,
      meter("Ciencia lograda / meta", `${fmtN(sci)} / ${r.goal}`, sci / r.goal, sci >= r.goal ? "" : "warn"),
      meter("Datos recibidos en la Tierra", `${fmtN(s.dataSent)} Gb`, null),
      meter("Combustible restante", `${fmtN(s.fuel)} kg`, r.fuel ? s.fuel / r.fuel : 0, s.fuel < r.fuel * 0.15 ? "warn" : ""),
      meter("Gasto extra por imprevistos", moneyS(s.extraCost), null),
      h("h3", null, "Bitácora"),
      h("ul", { class: "why small" }, s.eventLog.length ? s.eventLog.map(e => h("li", { class: e.bad ? "bad" : "" }, `${e.title}: ${e.result}`)) : h("li", null, `Rumbo a ${orb.short}...`))));
  if (s.pending) node.append(eventModal(s));
  return node;
}

function eventModal(s) {
  const ev = s.pending, role = ROLES[ev.role];
  return h("div", { class: "modal-wrap", role: "dialog", "aria-modal": "true", "aria-labelledby": "evTitle" },
    h("div", { class: "modal" },
      h("h3", { id: "evTitle" }, ev.title),
      h("div", { class: "who" }, `Decide ${role.emoji} ${role.name}${team() ? " (" + ownerOf(ev.role) + ")" : ""}, consultando al equipo`),
      h("p", null, ev.text),
      ...ev.options.map((o, i) => {
        const ok = !o.enabled || o.enabled(s, s.d, s.r);
        return h("button", { type: "button", disabled: !ok, onclick: () => { chooseOption(s, i); render(); } }, o.label + (ok ? "" : " (no es posible)"));
      })));
}

function spaceSvg(s) {
  const ns = "http://www.w3.org/2000/svg", d = s.d;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 600 380"); svg.id = "space";
  svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Animación de la nave en órbita");
  const add = (tag, a, txt) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (txt) e.textContent = txt; svg.append(e); return e; };
  for (let i = 0; i < 90; i++) add("circle", { cx: (i * 137) % 600, cy: (i * 89) % 380, r: (i % 3) * .4 + .4, fill: "#5d6890" });
  const body = { leo: ["#3a7bd5", 60, "Tierra"], geo: ["#3a7bd5", 40, "Tierra"], luna: ["#c9ccd6", 50, "Luna"], l2: ["#3a7bd5", 26, "Tierra"], marte: ["#d1603d", 55, "Marte"] }[d.orbit];
  const cx = 300, cy = 190;
  if (d.orbit === "l2") add("circle", { cx: 70, cy, r: 30, fill: "#ffd166" });
  add("circle", { cx: d.orbit === "l2" ? 250 : cx, cy, r: body[1], fill: body[0] });
  add("text", { x: d.orbit === "l2" ? 250 : cx, y: cy + body[1] + 18, fill: "#a3acca", "font-size": 13, "text-anchor": "middle" }, body[2]);
  const radius = { leo: 80, geo: 160, luna: 75, l2: 0, marte: 80 }[d.orbit];
  const a = s.month * 0.9;
  let x, y;
  if (d.orbit === "l2") { x = 420 + 26 * Math.cos(a); y = cy + 40 * Math.sin(a); add("ellipse", { cx: 420, cy, rx: 26, ry: 40, fill: "none", stroke: "#2c3763", "stroke-dasharray": "4 6" }); }
  else { x = cx + radius * Math.cos(a); y = cy + radius * 0.45 * Math.sin(a); add("ellipse", { cx, cy, rx: radius, ry: radius * 0.45, fill: "none", stroke: "#2c3763", "stroke-dasharray": "4 6" }); }
  if (!s.arrived) { x = 300 + s.month * 40; y = 60; }
  add("rect", { x: x - 6, y: y - 4, width: 12, height: 8, fill: "#c9a24a" });
  add("rect", { x: x - 20, y: y - 2, width: 12, height: 4, fill: "#7aa7ff" });
  add("rect", { x: x + 8, y: y - 2, width: 12, height: 4, fill: "#7aa7ff" });
  if (s.done) add("text", { x: 300, y: 36, fill: "#ffb238", "font-size": 18, "text-anchor": "middle", "font-weight": 700 }, "Fin de la misión");
  return svg;
}

/* ---------------- Report ---------------- */
const BOARD_KEY = "mision-a-lo-loco-ranking";
function loadBoard() { try { return JSON.parse(localStorage.getItem(BOARD_KEY)) || []; } catch (e) { return []; } }
function saveBoard(b) { try { localStorage.setItem(BOARD_KEY, JSON.stringify(b.slice(0, 50))); } catch (e) {} }

function viewReport() {
  const o = G.outcome, d = G.design, r = evaluate(d), sc = SCENARIOS[d.scenario];
  const assign = roleAssignment(G.players.length);
  const secrets = team() ? h("div", null,
    h("h3", null, "Objetivos secretos del equipo"),
    h("ul", { class: "why" }, ...G.players.map((p, i) => assign[i].map(role => {
      const ok = o.secrets.find(x => x.role === role).ok;
      return h("li", { class: ok ? "" : "bad" }, `${ok ? "✔" : "✘"} ${p.name || "Jugador " + (i + 1)} (${ROLES[role].name}): ${ROLES[role].secret.text}`);
    })).flat())) :
    h("div", null, h("h3", null, "Logros"),
      h("ul", { class: "why" }, ...ROLE_ORDER.map(role => {
        const ok = o.secrets.find(x => x.role === role).ok;
        return h("li", { class: ok ? "" : "bad" }, `${ok ? "✔" : "✘"} ${ROLES[role].secret.text}`);
      })));

  const board = loadBoard().filter(b => b.scenario === d.scenario).sort((a, b) => b.points - a.points).slice(0, 8);
  const teamName = G.players.map((p, i) => p.name || "Jugador " + (i + 1)).join(", ");
  let saved = false;
  const saveBtn = h("button", { type: "button", onclick: () => {
    if (saved) return;
    saved = true;
    const b = loadBoard();
    b.push({ scenario: d.scenario, team: teamName, points: o.score.points, cost: o.spent, orbit: d.orbit, difficulty: d.difficulty, date: new Date().toISOString().slice(0, 10) });
    saveBoard(b); render();
  } }, "🏆 Guardar en el ranking");

  return h("div", { class: "stack" },
    h("section", { class: "card" },
      h("div", { class: "row", style: "justify-content:space-between;align-items:flex-end" },
        h("div", null,
          h("h2", null, `Informe de misión · ${sc.emoji} ${sc.name}`),
          h("div", { class: "score" }, fmtN(o.score.points)), h("div", { class: "muted small" }, "puntos de misión")),
        h("div", { class: "small", style: "text-align:right" },
          h("div", null, `Ciencia: ${o.science} de ${r.goal} (${pctS(Math.min(1.5, o.score.objective))})`),
          h("div", null, `Duró ${o.months} meses de ${d.years * 12} planeados`),
          h("div", null, `Costo final: ${moneyS(o.spent)}${r.sandbox ? "" : " de " + moneyS(r.budget)}`))),
      h("p", { class: "small muted" }, "Puntos: objetivo científico hasta 500 (+200 si lo superas) · presupuesto ahorrado hasta 200 · vida útil hasta 100 · 50 por cada objetivo secreto cumplido.")),
    h("div", { class: "grid2" },
      h("section", { class: "card" },
        h("h2", null, "¿Por qué salió así?"),
        h("ul", { class: "why" }, o.why.map(w => h("li", { class: w.bad ? "bad" : "" }, w.text))),
        secrets),
      h("section", { class: "card stack" },
        o.similar ? h("div", null, h("h2", null, "Tu misión se parece a…"),
          h("p", { style: "margin:0" }, h("b", null, o.similar.name), " — ", o.similar.text)) : null,
        h("div", null,
          h("h2", null, "Tus intentos"),
          h("table", null,
            h("thead", null, h("tr", null, h("th", null, "Órbita"), h("th", { class: "n" }, "Masa"), h("th", { class: "n" }, "Costo"), h("th", { class: "n" }, "Ciencia"), h("th", { class: "n" }, "Puntos"))),
            h("tbody", null, G.history.filter(x => x.scenario === d.scenario).slice(0, 8).map(x => h("tr", null,
              h("td", null, ORBITS[x.orbit].short), h("td", { class: "n" }, fmtN(x.mass) + " kg"), h("td", { class: "n" }, moneyS(x.cost)),
              h("td", { class: "n" }, x.science), h("td", { class: "n" }, fmtN(x.points))))))),
        h("div", null,
          h("h2", null, "Ranking de este dispositivo"),
          board.length ? h("table", null,
            h("thead", null, h("tr", null, h("th", null, "Equipo"), h("th", null, "Órbita"), h("th", { class: "n" }, "Puntos"))),
            h("tbody", null, board.map(b => h("tr", null, h("td", null, b.team), h("td", null, ORBITS[b.orbit].short), h("td", { class: "n" }, fmtN(b.points))))))
            : h("p", { class: "muted small" }, "Todavía no hay misiones guardadas."),
          h("div", { class: "row", style: "margin-top:8px" }, saveBtn)))),
    h("div", { class: "row" },
      h("button", { type: "button", class: "primary big", onclick: () => show("design") }, "🔧 Mejorar el diseño y relanzar"),
      h("button", { type: "button", class: "big", onclick: () => show("start") }, "Nueva misión")));
}

/* ---------------- Boot ---------------- */
document.getElementById("homeBtn").onclick = () => { if (confirm("¿Empezar una misión nueva? Se perderá el diseño actual.")) show("start"); };
(function boot() {
  const m = location.hash.match(/#d=([A-Za-z0-9+/=]+)/);
  if (m) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (SCENARIOS[d.scenario] && ORBITS[d.orbit] && LAUNCHERS[d.launcher] && NETWORKS[d.network] && DIFFICULTY[d.difficulty]) {
        d.parts = Object.fromEntries(Object.entries(d.parts || {}).filter(([id, n]) => PARTS[id] && Number.isInteger(n) && n > 0 && n <= PARTS[id].max));
        d.years = Math.max(1, Math.min(10, d.years | 0));
        G.scenario = d.scenario; G.difficulty = d.difficulty; G.design = d;
        history.replaceState(null, "", location.pathname);
        return show("design");
      }
    } catch (e) { /* ignore broken links */ }
  }
  show("start");
})();
