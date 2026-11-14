/* Mission model: parts, orbits, launchers, scenarios and the math that ties them together.
   Numbers are simplified for a game but keep the real trade-offs:
   more instruments -> more mass, power, data and cost; farther orbits -> weaker links and more fuel. */

const ORBITS = {
  leo: { name: "Órbita baja (LEO, 500 km)", short: "LEO", sun: 1, eclipseFrac: 0.36, eclipseMin: 35,
    link: 1, contactPerStation: 0.07, arriveDv: 0, keepDvPerYear: 0.03, radiation: 0.2, dragYears: 4, launch: "leo",
    desc: "Muy cerca de la Tierra: fotos nítidas y señal fuerte. Pero cada estación terrestre la ve solo unos minutos por vuelta, pasa un tercio del tiempo a la sombra y el roce con la atmósfera la frena." },
  geo: { name: "Órbita geoestacionaria (36 000 km)", short: "GEO", sun: 1, eclipseFrac: 0.01, eclipseMin: 72,
    link: 0.5, contactPerStation: 1, arriveDv: 1.5, keepDvPerYear: 0.05, radiation: 0.6, launch: "gto",
    desc: "Gira al mismo ritmo que la Tierra: mira siempre el mismo lado del planeta y una sola estación la escucha todo el tiempo. Llegar ahí exige combustible propio." },
  luna: { name: "Órbita lunar (100 km)", short: "Luna", sun: 1, eclipseFrac: 0.4, eclipseMin: 48,
    link: 0.3, contactPerStation: 0.33, arriveDv: 0.9, keepDvPerYear: 0.1, radiation: 0.7, launch: "tli",
    desc: "A 384 000 km. Para quedarte en órbita hay que frenar con tus motores. Cada estación terrestre la ve unas 8 horas al día." },
  l2: { name: "Punto L2 (1,5 millones de km)", short: "L2", sun: 1, eclipseFrac: 0, eclipseMin: 0,
    link: 0.15, contactPerStation: 0.33, arriveDv: 0.15, keepDvPerYear: 0.01, radiation: 0.5, launch: "l2",
    desc: "Detrás de la Tierra, lejos de su calor y su luz: ideal para telescopios. Nunca hay sombra, pero la señal llega débil." },
  marte: { name: "Órbita de Marte", short: "Marte", sun: 0.43, eclipseFrac: 0.3, eclipseMin: 40,
    link: 0.04, contactPerStation: 0.33, arriveDv: 1.0, keepDvPerYear: 0.02, radiation: 0.8, launch: "mars",
    desc: "Llega menos de la mitad de la luz solar y la señal tarda minutos en llegar, muy débil. Hay que frenar para quedarse." }
};

const LAUNCHERS = {
  chico:  { name: "Cohete pequeño", cost: 8,   cap: { leo: 300,   gto: 0,     tli: 0,     l2: 0,     mars: 0 } },
  medio:  { name: "Cohete mediano", cost: 40,  cap: { leo: 3000,  gto: 1000,  tli: 600,   l2: 600,   mars: 400 } },
  grande: { name: "Cohete grande",  cost: 70,  cap: { leo: 17000, gto: 5500,  tli: 4000,  l2: 4000,  mars: 3500 } },
  pesado: { name: "Cohete pesado",  cost: 150, cap: { leo: 60000, gto: 22000, tli: 15000, l2: 15000, mars: 14000 } }
};

const NETWORKS = {
  basica:   { name: "1 estación terrestre", stations: 1, costPerYear: 2, desc: "Barata, pero te escucha poco tiempo." },
  regional: { name: "2 estaciones",         stations: 2, costPerYear: 5, desc: "El doble de tiempo de contacto." },
  global:   { name: "Red global (3 estaciones)", stations: 3, costPerYear: 12, desc: "Como la Red de Espacio Profundo: siempre hay una antena mirando." }
};

/* role: who decides it in team mode. max: how many can be added. */
const PARTS = {
  // Ingeniería: energía, orientación, computadora, propulsión
  solarS: { role: "ing", cat: "Energía", name: "Paneles solares chicos", mass: 15, cost: 2, solar: 300, max: 3,
    desc: "300 W a la distancia de la Tierra. Solo funcionan con Sol." },
  solarL: { role: "ing", cat: "Energía", name: "Paneles solares grandes", mass: 70, cost: 10, solar: 2500, max: 3,
    desc: "2500 W con Sol directo. Lejos del Sol rinden menos." },
  rtg: { role: "ing", cat: "Energía", name: "Generador nuclear (RTG)", mass: 45, cost: 60, rtg: 110, max: 3, advanced: true,
    desc: "110 W constantes, de día y de noche, cerca o lejos del Sol. Caro." },
  bateria: { role: "ing", cat: "Energía", name: "Batería (800 Wh)", mass: 8, cost: 1, wh: 800, max: 4,
    desc: "Guarda energía para cuando la nave pasa por la sombra." },
  magneto: { role: "ing", cat: "Orientación", name: "Magnetorquers", mass: 3, cost: 0.5, power: 5, pointing: 0.5, onlyLeo: true, max: 1,
    desc: "Se orientan empujando contra el campo magnético de la Tierra. Baratos, poco precisos, y lejos de la Tierra casi no sirven." },
  ruedas: { role: "ing", cat: "Orientación", name: "Ruedas de reacción", mass: 25, cost: 6, power: 40, pointing: 1, max: 1,
    desc: "Giran para apuntar la nave con precisión. Necesarias para cámaras finas y antenas grandes." },
  cpuStd: { role: "ing", cat: "Computadora", name: "Computadora comercial", mass: 2, cost: 1, power: 10, brain: true, max: 1,
    desc: "Barata y rápida, pero la radiación la daña con el tiempo." },
  cpuRad: { role: "ing", cat: "Computadora", name: "Computadora resistente a radiación", mass: 6, cost: 8, power: 20, brain: true, radHard: true, max: 1,
    desc: "Más cara y lenta, pero aguanta años de radiación." },
  tanque: { role: "ing", cat: "Propulsión", name: "Tanque y motor químico (150 kg de combustible)", mass: 190, cost: 6, fuel: 150, max: 6,
    desc: "Para frenar al llegar y corregir la órbita durante años." },
  ionico: { role: "ing", cat: "Propulsión", name: "Motor iónico", mass: 40, cost: 20, power: 300, ion: true, max: 1, advanced: true,
    desc: "Gasta cinco veces menos combustible, pero necesita mucha electricidad." },

  // Comunicaciones
  antBaja: { role: "com", cat: "Antenas", name: "Antena omnidireccional", mass: 2, cost: 0.5, power: 10, rate: 2, max: 2,
    desc: "No necesita apuntar. 2 Mbps cerca de la Tierra." },
  antMedia: { role: "com", cat: "Antenas", name: "Antena de media ganancia", mass: 8, cost: 3, power: 40, rate: 40, max: 2,
    desc: "40 Mbps cerca de la Tierra." },
  antAlta: { role: "com", cat: "Antenas", name: "Antena parabólica de alta ganancia", mass: 30, cost: 12, power: 120, rate: 300, needsPointing: true, max: 1,
    desc: "300 Mbps cerca de la Tierra, pero hay que apuntarla con precisión." },
  grabadora: { role: "com", cat: "Datos", name: "Grabadora de datos", mass: 3, cost: 1, power: 5, recorder: true, max: 1,
    desc: "Guarda los datos mientras no hay estación a la vista, para enviarlos después." },

  // Ciencia
  camNubes: { role: "sci", cat: "Instrumentos", name: "Cámara de nubes (gran angular)", mass: 20, cost: 15, power: 25, data: 3,
    tags: { clima: 3, atmosfera: 1, superficie: 1 }, max: 1, desc: "Ve medio planeta a la vez. Ideal para tormentas." },
  camAlta: { role: "sci", cat: "Instrumentos", name: "Cámara de alta resolución", mass: 60, cost: 45, power: 80, data: 40, needsPointing: true,
    tags: { superficie: 3, clima: 1, agua: 1 }, max: 1, desc: "Detalles finos del terreno. Genera muchísimos datos." },
  espectro: { role: "sci", cat: "Instrumentos", name: "Espectrómetro infrarrojo", mass: 35, cost: 35, power: 45, data: 12,
    tags: { agua: 3, atmosfera: 2, superficie: 1, astro: 1 }, max: 1, desc: "Descompone la luz para saber de qué están hechas las cosas: agua, hielo, minerales." },
  microondas: { role: "sci", cat: "Instrumentos", name: "Sonda de microondas", mass: 50, cost: 30, power: 60, data: 1,
    tags: { clima: 3, atmosfera: 2, agua: 1 }, max: 1, desc: "Ve a través de las nubes: lluvia, humedad y temperatura." },
  radar: { role: "sci", cat: "Instrumentos", name: "Radar", mass: 120, cost: 70, power: 400, data: 60,
    tags: { superficie: 3, agua: 2, clima: 1 }, max: 1, desc: "Funciona de día y de noche y atraviesa nubes y polvo. Gasta mucha energía." },
  laser: { role: "sci", cat: "Instrumentos", name: "Altímetro láser", mass: 25, cost: 20, power: 50, data: 1,
    tags: { superficie: 2, agua: 1 }, max: 1, desc: "Mide la altura del terreno con un rayo láser." },
  telescopio: { role: "sci", cat: "Instrumentos", name: "Telescopio infrarrojo", mass: 400, cost: 250, power: 300, data: 20, needsPointing: true, wantsCold: true,
    tags: { astro: 5 }, max: 1, desc: "Ve galaxias lejanas. Necesita frío y oscuridad, lejos del calor de la Tierra." },
  magnetometro: { role: "sci", cat: "Instrumentos", name: "Magnetómetro", mass: 3, cost: 5, power: 4, data: 0.1,
    tags: { campo: 3 }, max: 1, desc: "Mide campos magnéticos. Ligero y barato." },
  particulas: { role: "sci", cat: "Instrumentos", name: "Detector de partículas", mass: 8, cost: 8, power: 10, data: 0.5,
    tags: { campo: 2, astro: 1 }, max: 1, desc: "Cuenta las partículas del viento solar y los rayos cósmicos." }
};

const SCENARIOS = {
  huracan: { name: "Ojo del huracán", emoji: "🌀", goal: 100, budget: 350, target: "Tierra",
    weights: { clima: 3, atmosfera: 2, superficie: 0.5 }, fit: { geo: 1, leo: 0.7 },
    brief: "Vigila los huracanes para avisar a tiempo a la gente de la costa.",
    hint: "Necesitas ver las nubes seguido. ¿Desde muy cerca un rato o desde lejos todo el tiempo?" },
  hielo: { name: "Hielo en la Luna", emoji: "🌕", goal: 80, budget: 450, target: "Luna",
    weights: { agua: 3, superficie: 2 }, fit: { luna: 1 },
    brief: "Encuentra hielo de agua en los cráteres oscuros de los polos de la Luna.",
    hint: "Esos cráteres nunca reciben luz del Sol. ¿Qué instrumento no necesita luz?" },
  marte: { name: "Agua en Marte", emoji: "🔴", goal: 80, budget: 700, target: "Marte",
    weights: { agua: 3, superficie: 2, atmosfera: 1 }, fit: { marte: 1 },
    brief: "Busca dónde hubo agua en Marte y dónde podría quedar hielo bajo el suelo.",
    hint: "Desde Marte la señal llega débil. Piensa cuántos datos podrás enviar." },
  galaxias: { name: "Galaxias lejanas", emoji: "🌌", goal: 60, budget: 1200, target: "Universo",
    weights: { astro: 3 }, fit: { l2: 1, geo: 0.5, leo: 0.4 },
    brief: "Observa las primeras galaxias del universo con luz infrarroja.",
    hint: "El calor de la Tierra y del Sol ciega a un telescopio infrarrojo." },
  libre: { name: "Modo libre", emoji: "🧪", goal: 100, budget: Infinity, target: "Lo que quieras",
    weights: { clima: 1, atmosfera: 1, superficie: 1, agua: 1, astro: 1, campo: 1 },
    fit: { leo: 1, geo: 1, luna: 1, l2: 1, marte: 1 }, sandbox: true,
    brief: "Sin presupuesto ni objetivo fijo: experimenta y mira qué pasa.",
    hint: "Prueba la misma nave en órbitas distintas." }
};

const DIFFICULTY = {
  cadete:   { name: "Cadete", budgetMult: 1.4, events: 1, advanced: false, desc: "Más presupuesto, pocas sorpresas, piezas básicas." },
  ingeniero:{ name: "Especialista", budgetMult: 1, events: 2, advanced: true, desc: "El presupuesto real y algunas sorpresas." },
  director: { name: "Dirección de vuelo", budgetMult: 0.8, events: 3, advanced: true, desc: "Poco dinero y muchas sorpresas." }
};

const ROLES = {
  dir: { name: "Dirección de misión", emoji: "🧭", owns: "Objetivo, órbita, cohete, años de misión y presupuesto",
    secret: { text: "Terminar con al menos 10% del presupuesto sin gastar.", check: r => r.sandbox || r.budgetLeft >= 0.1 * r.budget } },
  ing: { name: "Ingeniería", emoji: "🔧", owns: "Energía, orientación, computadora y propulsión",
    secret: { text: "Que la nave tenga al menos 20% de energía de sobra.", check: r => r.powerMargin >= 0.2 } },
  sci: { name: "Ciencia", emoji: "🔬", owns: "Instrumentos científicos",
    secret: { text: "Llevar al menos 3 instrumentos científicos.", check: r => r.instruments >= 3 } },
  com: { name: "Comunicaciones", emoji: "📡", owns: "Antenas, grabadora y red de estaciones terrestres",
    secret: { text: "Que llegue a la Tierra al menos el 95% de los datos.", check: r => r.dataFactor >= 0.95 } }
};
const ROLE_ORDER = ["dir", "ing", "sci", "com"];

const REAL_MISSIONS = [
  { scenario: "huracan", orbit: "geo", name: "GOES (satélites meteorológicos)", text: "Vigilan las Américas desde la órbita geoestacionaria sin perder de vista las tormentas." },
  { scenario: "huracan", orbit: "leo", name: "Aqua y Terra", text: "Recorren la Tierra en órbita baja y miden nubes, lluvia y temperatura del planeta entero." },
  { scenario: "hielo", orbit: "luna", name: "Lunar Reconnaissance Orbiter (LRO)", text: "Orbita la Luna desde 2009, mide su relieve con un láser y busca hielo en los polos." },
  { scenario: "marte", orbit: "marte", name: "Mars Reconnaissance Orbiter (MRO)", text: "Lleva una cámara de alta resolución y un radar que encontró hielo bajo el suelo de Marte." },
  { scenario: "galaxias", orbit: "l2", name: "Telescopio espacial James Webb", text: "Observa en infrarrojo desde L2, protegido del Sol por un parasol gigante." },
  { scenario: "galaxias", orbit: "leo", name: "Telescopio espacial Hubble", text: "Funciona en órbita baja desde 1990, sobre todo con luz visible y ultravioleta." }
];

/* ------------------------------------------------------------------ */

const G0 = 9.81;
const VE_CHEM = 300 * G0 / 1000;  // km/s, chemical engine
const VE_ION = 1600 * G0 / 1000;  // km/s, ion engine

function newDesign(scenario = "huracan", difficulty = "ingeniero") {
  const sc = SCENARIOS[scenario];
  const orbit = Object.keys(sc.fit)[0];
  return { scenario, difficulty, orbit, launcher: "grande", network: "basica", years: 3, parts: {} };
}

function count(d, id) { return d.parts[id] || 0; }
function each(d, fn) { for (const [id, n] of Object.entries(d.parts)) if (n > 0) fn(PARTS[id], n, id); }
function budgetOf(d) {
  const sc = SCENARIOS[d.scenario];
  return sc.sandbox ? Infinity : Math.round(sc.budget * DIFFICULTY[d.difficulty].budgetMult);
}

/* Evaluate a design: every number the dashboard shows and every reason the report gives. */
function evaluate(d) {
  const sc = SCENARIOS[d.scenario], orb = ORBITS[d.orbit], lv = LAUNCHERS[d.launcher], net = NETWORKS[d.network];
  const r = { sandbox: !!sc.sandbox, budget: budgetOf(d), why: [], blockers: [], warnings: [] };

  // Mass
  let partsMass = 0, fuel = 0, ion = false;
  each(d, (p, n) => { partsMass += p.mass * n; fuel += (p.fuel || 0) * n; if (p.ion) ion = true; });
  const structure = Math.round(40 + 0.2 * partsMass);
  r.structure = structure;
  r.wetMass = Math.round(partsMass + structure);
  r.dryMass = r.wetMass - fuel;
  r.capacity = lv.cap[orb.launch];
  r.fuel = fuel;

  // Propellant: arrival first, then station-keeping for every year of the mission.
  const ve = ion ? VE_ION : VE_CHEM;
  const need = dv => r.dryMass * (Math.exp(dv / ve) - 1);
  r.fuelArrive = Math.ceil(need(orb.arriveDv));
  r.fuelPerYear = need(orb.arriveDv + orb.keepDvPerYear) - need(orb.arriveDv);
  r.fuelNeeded = Math.ceil(r.fuelArrive + r.fuelPerYear * d.years);
  r.arrives = fuel >= r.fuelArrive;

  // Power
  const ionOn = ion && orb.arriveDv > 0;
  let load = 30, solar = 0, rtg = 0, wh = 0;
  each(d, (p, n) => {
    if (p.ion && !ionOn) return; // the ion engine only runs while maneuvering far from Earth
    load += (p.power || 0) * n; solar += (p.solar || 0) * n; rtg += (p.rtg || 0) * n; wh += (p.wh || 0) * n;
  });
  const solarAvg = solar * orb.sun * (1 - orb.eclipseFrac);
  r.load = load; r.gen = Math.round(solarAvg + rtg);
  r.batteryNeed = Math.ceil(Math.max(0, load - rtg) * orb.eclipseMin / 60 / 0.6);
  r.battery = wh;
  const nightCover = orb.eclipseFrac === 0 || solar === 0 || r.batteryNeed === 0 ? 1 : Math.min(1, wh / r.batteryNeed);
  r.powerMargin = load ? (r.gen - load) / load : 1;
  r.powerFactor = r.gen === 0 ? 0 : Math.min(1, r.gen / load) * (1 - orb.eclipseFrac * (1 - nightCover));

  // Pointing
  let pointing = 0.2;
  if (count(d, "ruedas")) pointing = 1;
  else if (count(d, "magneto")) pointing = d.orbit === "leo" ? 0.5 : 0.2;
  r.pointing = pointing;

  // Science
  let rawPerYear = 0, data = 0, instruments = 0;
  const contributions = [];
  each(d, (p, n, id) => {
    if (!p.tags) return;
    instruments += n;
    data += p.data * n;
    let v = 0;
    for (const [tag, w] of Object.entries(sc.weights)) v += (p.tags[tag] || 0) * w;
    let f = 1;
    if (p.needsPointing) f *= pointing;
    if (p.wantsCold) f *= d.orbit === "l2" ? 1 : 0.5;
    contributions.push({ id, name: p.name, value: v * n * f, fullValue: v * n });
    rawPerYear += v * n * f;
  });
  r.instruments = instruments;
  r.contributions = contributions;

  // Data
  let downRate = 0;
  each(d, p => { if (p.rate) downRate = Math.max(downRate, p.rate * (p.needsPointing ? pointing : 1)); });
  const contact = Math.min(1, orb.contactPerStation * net.stations);
  r.contact = contact;
  r.dataPerDay = data * 86400 / 1000 * r.powerFactor;                // Gb/day generated
  r.downPerDay = downRate * orb.link * contact * 86400 / 1000;        // Gb/day the link can send
  const recorder = count(d, "grabadora") > 0;
  const deliverable = recorder ? r.dataPerDay : r.dataPerDay * contact;
  r.delivered = Math.min(deliverable, r.downPerDay);
  r.dataFactor = r.dataPerDay > 0 ? r.delivered / r.dataPerDay : 1;
  r.recorder = recorder;

  // Lifetime
  const hasBrain = Object.keys(d.parts).some(id => d.parts[id] > 0 && PARTS[id].brain);
  const radHard = count(d, "cpuRad") > 0;
  let life = d.years, limiter = null;
  if (hasBrain && r.arrives) {
    if (!radHard) {
      const radCap = Math.round((1.5 / orb.radiation) * 10) / 10;
      if (radCap < life) { life = radCap; limiter = "radiacion"; }
    }
    if (d.orbit === "leo" && fuel === 0) {
      // No engine in low orbit: atmospheric drag brings the spacecraft down.
      if (orb.dragYears < life) { life = orb.dragYears; limiter = "arrastre"; }
    } else {
      const fuelYears = r.fuelPerYear > 0 ? (fuel - r.fuelArrive) / r.fuelPerYear : Infinity;
      if (fuelYears < life) { life = Math.max(0, Math.round(fuelYears * 10) / 10); limiter = "combustible"; }
    }
  } else life = 0;
  r.lifetime = life;
  r.lifeLimiter = limiter;

  // Cost
  let partsCost = 0;
  each(d, (p, n) => { partsCost += p.cost * n; });
  r.costParts = Math.round(partsCost * 10) / 10;
  r.costLaunch = lv.cost;
  r.costDev = Math.round(30 + r.dryMass * 0.05);
  r.costOps = Math.round(d.years * (5 + net.costPerYear));
  r.cost = Math.round((r.costParts + r.costLaunch + r.costDev + r.costOps) * 10) / 10;
  r.budgetLeft = r.budget - r.cost;

  // Expected science (before events)
  const fit = sc.fit[d.orbit] || 0;
  r.fit = fit;
  r.sciencePerYear = rawPerYear * fit * r.powerFactor * r.dataFactor * 0.8;
  r.science = Math.round(r.sciencePerYear * r.lifetime);
  r.goal = sc.goal;

  // Hard blockers: things the agency would never let you launch.
  if (r.wetMass > r.capacity) r.blockers.push(r.capacity === 0
    ? `El ${lv.name.toLowerCase()} no puede llegar a ${orb.short}. Elige un cohete más potente.`
    : `La nave pesa ${fmt(r.wetMass)} kg y el ${lv.name.toLowerCase()} solo lleva ${fmt(r.capacity)} kg a ${orb.short}.`);
  if (!r.sandbox && r.cost > r.budget) r.blockers.push(`Cuesta ${money(r.cost)} y el presupuesto es ${money(r.budget)}.`);
  if (!hasBrain) r.blockers.push("Falta una computadora: sin ella nadie a bordo obedece órdenes.");
  if (!sc.fit[d.orbit]) r.blockers.push(`Desde ${orb.short} no se puede cumplir este objetivo (${sc.target}).`);

  // Soft warnings: you can launch, but it will hurt.
  if (!r.arrives) r.warnings.push(`Falta combustible para entrar en órbita: necesitas ${fmt(r.fuelArrive)} kg y llevas ${fmt(fuel)} kg.`);
  if (r.powerFactor < 1) r.warnings.push(`La energía no alcanza: los equipos funcionarán solo ${pct(r.powerFactor)} del tiempo.`);
  if (r.dataFactor < 0.95 && r.dataPerDay > 0) r.warnings.push(`Solo llegará ${pct(r.dataFactor)} de los datos a la Tierra.`);
  if (instruments === 0) r.warnings.push("No hay instrumentos científicos: la misión no aprenderá nada.");
  if (r.lifetime < d.years && r.lifetime > 0) r.warnings.push(`La nave durará ${r.lifetime} años de los ${d.years} planeados.`);
  return r;
}

/* Plain-language reasons for the post-mission report. */
function explain(d, r, outcome) {
  const orb = ORBITS[d.orbit], sc = SCENARIOS[d.scenario], out = [];
  if (!outcome.arrived) out.push({ bad: true, text: `No hubo combustible para frenar y entrar en órbita. Para ${fmt(r.dryMass)} kg de nave hacían falta ${fmt(r.fuelArrive)} kg. Cada kilo extra de nave pide más combustible, que también pesa.` });
  if (r.fit < 1 && r.fit > 0) out.push({ bad: true, text: `${orb.short} no es la órbita ideal para «${sc.name}»: solo se aprovecha el ${pct(r.fit)} de lo que observan los instrumentos.` });
  if (r.gen === 0) out.push({ bad: true, text: "No había ninguna fuente de energía a bordo: ni paneles solares ni generador. Nada pudo encenderse." });
  else if (r.powerFactor < 1) {
    const night = r.gen >= r.load && orb.eclipseFrac > 0 && r.battery < r.batteryNeed;
    out.push({ bad: true, text: night
      ? `Pasabas ${pct(orb.eclipseFrac)} del tiempo a la sombra y las baterías (${fmt(r.battery)} Wh) no cubrían los ${fmt(r.batteryNeed)} Wh necesarios. Más batería o menos consumo.`
      : `Generabas ${fmt(r.gen)} W de promedio y consumías ${fmt(r.load)} W. ${orb.sun < 1 ? `En ${orb.short} el Sol da solo ${pct(orb.sun)} de energía. ` : ""}Más paneles, un RTG o menos instrumentos.` });
  }
  if (r.dataFactor < 0.95 && r.dataPerDay > 0) out.push({ bad: true, text: `Generabas ${fmt1(r.dataPerDay)} Gb al día y podías enviar ${fmt1(r.downPerDay)} Gb. ${!r.recorder ? "Sin grabadora, todo lo que se mide sin estación a la vista se pierde. " : ""}${orb.link < 0.2 ? `Desde ${orb.short} la señal llega muy débil. ` : ""}Ciencia que no llega a la Tierra es ciencia perdida.` });
  const pointed = r.contributions.filter(c => PARTS[c.id].needsPointing);
  if (r.pointing < 1 && (pointed.length || count(d, "antAlta"))) out.push({ bad: true, text: "Sin ruedas de reacción, la nave no apuntaba con precisión: las cámaras finas y la antena parabólica rindieron mucho menos." });
  if (count(d, "telescopio") && d.orbit !== "l2") out.push({ bad: true, text: "El telescopio infrarrojo veía el calor de la Tierra: en L2 habría estado frío y a oscuras." });
  if (r.lifeLimiter === "radiacion") out.push({ bad: true, text: `La radiación en ${orb.short} daña una computadora comercial en unos ${r.lifetime} años. Una resistente a radiación habría durado más.` });
  if (r.lifeLimiter === "combustible") out.push({ bad: true, text: `El combustible solo alcanzó para ${r.lifetime} años de correcciones de órbita.` });
  if (r.lifeLimiter === "arrastre") out.push({ bad: true, text: "Sin motor, el roce con la atmósfera hizo caer la nave en pocos años." });
  for (const e of outcome.eventLog) out.push({ bad: e.bad, text: `${e.title}: ${e.result}` });
  if (outcome.score.objective >= 1) out.push({ bad: false, text: `¡Objetivo cumplido! ${outcome.science} puntos de ciencia, la meta era ${r.goal}.` });
  else if (outcome.arrived) out.push({ bad: false, text: `Lograste ${pct(outcome.score.objective)} del objetivo científico.` });
  if (!r.sandbox && r.budgetLeft > 0) out.push({ bad: false, text: `Sobraron ${money(r.budgetLeft - outcome.extraCost)} del presupuesto.` });
  if (out.filter(x => x.bad).length === 0) {
    if (outcome.score.objective >= 1) out.push({ bad: false, text: "No hubo puntos débiles graves. ¿Puedes lograr lo mismo más barato o con otra órbita? Casi nunca hay una sola solución." });
    else {
      const best = [...r.contributions].sort((a, b) => b.value - a.value)[0];
      out.push({ bad: true, text: `La nave funcionó bien, pero no llevaba suficiente ciencia para la meta. Agrega instrumentos útiles para «${sc.name}» o alarga la misión.${best ? ` Tu instrumento más útil fue: ${best.name}.` : ""}` });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Mission events: each has a responsible role and two options. */

const EVENTS = [
  { id: "tormenta", role: "ing", title: "☀️ Tormenta solar",
    text: "Una erupción del Sol lanza partículas hacia la nave.",
    options: [
      { label: "Modo seguro: apagar los instrumentos un mes", apply: s => { s.pauseMonths += 1; return { bad: false, result: "La nave se protegió y perdió un mes de ciencia." }; } },
      { label: "Seguir trabajando y arriesgarse", apply: (s, d, rnd) => {
          if (count(d, "cpuRad")) return { bad: false, result: "La computadora resistente a radiación aguantó sin problemas." };
          if (rnd() < 0.5) { s.lifeMonths = Math.round(s.month + (s.lifeMonths - s.month) * 0.6); return { bad: true, result: "La computadora comercial sufrió daños y la misión se acortó." }; }
          return { bad: false, result: "Hubo suerte: la computadora resistió." };
        } }
    ] },
  { id: "rueda", role: "ing", when: d => count(d, "ruedas") > 0, title: "⚙️ Falla una rueda de reacción",
    text: "Una de las ruedas que orientan la nave se atascó.",
    options: [
      { label: "Orientar con los propulsores (gasta combustible)", enabled: s => s.fuel > 0, apply: s => { s.fuel *= 0.7; s.lifeMonths = Math.round(s.month + (s.lifeMonths - s.month) * 0.85); return { bad: false, result: "Se mantuvo la puntería a costa de combustible y algo de vida útil." }; } },
      { label: "Aceptar apuntar con menos precisión", apply: s => { s.sciMult *= 0.75; return { bad: true, result: "La nave apunta peor y los instrumentos rinden menos." }; } }
    ] },
  { id: "sorpresa", role: "sci", title: "🔭 ¡Sorpresa científica!",
    text: "Aparece algo inesperado que los científicos quieren observar ya.",
    options: [
      { label: "Cambiar el plan y observarlo", apply: (s, d, rnd, r) => { const bonus = Math.round(r.goal * (r.dataFactor >= 0.9 ? 0.12 : 0.04)); s.bonus += bonus; return { bad: false, result: r.dataFactor >= 0.9 ? `Gran descubrimiento: +${bonus} puntos de ciencia.` : `Se observó, pero no había capacidad para enviar tantos datos: solo +${bonus} puntos.` }; } },
      { label: "Seguir el plan original", apply: () => ({ bad: false, result: "La misión siguió su plan." }) }
    ] },
  { id: "recorte", role: "dir", when: d => !SCENARIOS[d.scenario].sandbox, title: "💸 Recorte de presupuesto",
    text: "La agencia necesita ahorrar dinero este año.",
    options: [
      { label: "Pagar con el margen que sobra ($25 M)", enabled: (s, d, r) => r.budgetLeft - s.extraCost >= 25, apply: s => { s.extraCost += 25; return { bad: false, result: "Se pagó con el margen guardado: tener reserva salvó la misión." }; } },
      { label: "Acortar la misión un año", apply: s => { s.lifeMonths = Math.max(s.month + 1, s.lifeMonths - 12); return { bad: true, result: "La misión terminó un año antes." }; } }
    ] },
  { id: "red", role: "com", title: "📡 Antenas saturadas",
    text: "Otras misiones necesitan las estaciones terrestres y te quedas con menos tiempo de contacto.",
    options: [
      { label: "Pagar tiempo extra de antena ($6 M)", apply: s => { s.extraCost += 6; return { bad: false, result: "Se compró tiempo de antena y no se perdieron datos." }; } },
      { label: "Aceptar enviar menos datos por un año", apply: s => { s.dataPenaltyUntil = s.month + 12; return { bad: true, result: "Durante un año llegó menos ciencia a la Tierra." }; } }
    ] },
  { id: "meteorito", role: "ing", title: "☄️ Micrometeorito",
    text: "Una partícula diminuta y rapidísima golpea la nave.",
    options: [
      { label: "Revisar y reducir el consumo de energía", apply: s => { s.sciMult *= 0.9; return { bad: false, result: "Con menos consumo, la nave siguió a salvo pero un poco más lenta." }; } },
      { label: "Seguir igual", apply: (s, d, rnd, r) => {
          if (r.powerMargin >= 0.15) return { bad: false, result: "Había energía de sobra: el golpe no afectó." };
          s.lifeMonths = Math.round(s.month + (s.lifeMonths - s.month) * 0.7); return { bad: true, result: "Sin margen de energía, el daño acortó la vida de la nave." };
        } }
    ] }
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* A mission run: a monthly state machine that pauses on events for the team to decide. */
function startRun(d, seed = Date.now()) {
  const r = evaluate(d), rnd = mulberry32(seed);
  const lifeMonths = Math.max(0, Math.round(r.lifetime * 12));
  const pool = EVENTS.filter(e => !e.when || e.when(d));
  const n = Math.min(DIFFICULTY[d.difficulty].events, pool.length, Math.max(0, lifeMonths - 1));
  const picked = [];
  while (picked.length < n) { const e = pool[Math.floor(rnd() * pool.length)]; if (!picked.includes(e)) picked.push(e); }
  const months = picked.map((_, i) => Math.max(1, Math.round(lifeMonths * (i + 1) / (n + 1))));
  return {
    d, r, rnd, month: 0, lifeMonths, plannedMonths: d.years * 12, science: 0, bonus: 0, sciMult: 1,
    pauseMonths: 0, dataPenaltyUntil: -1, extraCost: 0, fuel: r.fuel, dataSent: 0,
    events: picked.map((e, i) => ({ e, month: months[i] })), pending: null, eventLog: [], done: !r.arrives || lifeMonths === 0,
    arrived: r.arrives
  };
}

function stepRun(s) {
  if (s.done || s.pending) return s;
  const next = s.events.find(e => e.month === s.month + 1 && !e.used);
  if (next) { next.used = true; s.pending = next.e; return s; }
  s.month += 1;
  let rate = s.r.sciencePerYear / 12 * s.sciMult;
  let data = s.r.delivered * 30;
  if (s.month <= s.dataPenaltyUntil) { rate *= 0.85; data *= 0.7; }
  if (s.pauseMonths > 0) { s.pauseMonths -= 1; rate = 0; data = 0; }
  s.science += rate;
  s.dataSent += data;
  s.fuel = Math.max(0, s.fuel - s.r.fuelPerYear / 12);
  if (s.month >= s.lifeMonths) s.done = true;
  return s;
}

function chooseOption(s, i) {
  const ev = s.pending, opt = ev.options[i];
  const res = opt.apply(s, s.d, s.rnd, s.r);
  s.eventLog.push({ title: ev.title, choice: opt.label, ...res });
  s.pending = null;
  if (s.month >= s.lifeMonths) s.done = true;
  return res;
}

function finishRun(s, teamRoles) {
  const r = s.r;
  const science = Math.round(s.science + s.bonus);
  const objective = s.arrived ? Math.min(1.5, science / r.goal) : 0;
  const lifeRatio = s.plannedMonths ? Math.min(1, s.month / s.plannedMonths) : 0;
  const spent = r.cost + s.extraCost;
  const effic = r.sandbox ? 1 : Math.max(0, (r.budget - spent) / r.budget);
  const secrets = (teamRoles || ROLE_ORDER).map(role => ({ role, ok: !!ROLES[role].secret.check({ ...r, budgetLeft: r.budget - spent }) }));
  const score = {
    objective,
    points: Math.round(Math.min(1, objective) * 500 + Math.max(0, objective - 1) * 200 + effic * 200 + lifeRatio * 100 + secrets.filter(x => x.ok).length * 50)
  };
  const outcome = { science, score, secrets, arrived: s.arrived, months: s.month, extraCost: s.extraCost, eventLog: s.eventLog, spent };
  outcome.why = explain(s.d, r, outcome);
  outcome.similar = REAL_MISSIONS.find(m => m.scenario === s.d.scenario && m.orbit === s.d.orbit) || null;
  return outcome;
}

/* ------------------------------------------------------------------ */
function fmt(v) { return Math.round(v).toLocaleString("es"); }
function fmt1(v) { return (Math.round(v * 10) / 10).toLocaleString("es"); }
function pct(v) { return Math.round(v * 100) + "%"; }
function money(v) { return v === Infinity ? "sin límite" : "$" + fmt1(v) + " M"; }

if (typeof module !== "undefined") module.exports = { ORBITS, LAUNCHERS, NETWORKS, PARTS, SCENARIOS, DIFFICULTY, ROLES, ROLE_ORDER, EVENTS, REAL_MISSIONS, newDesign, evaluate, startRun, stepRun, chooseOption, finishRun, budgetOf };
