/* Mission model: parts, orbits, launchers, scenarios and the math that ties them together.
   Numbers are simplified for a game but keep the real trade-offs:
   more instruments -> more mass, power, data and cost; farther orbits -> weaker links and more fuel.

   Language: shares the "lang" setting with The Last Lap (localStorage), so both open in the same language.
   Texts are written as L("español", "English") and chosen when the page loads. */

var LANG = (function () {
  try { return localStorage.getItem("lang") === "en" ? "en" : "es"; } catch (e) { return "es"; }
})();
function L(es, en) { return LANG === "en" ? en : es; }
const LOCALE = L("es", "en");

const ORBITS = {
  leo: { name: L("Órbita baja (LEO, 500 km)", "Low Earth orbit (LEO, 500 km)"), short: "LEO", sun: 1, eclipseFrac: 0.36, eclipseMin: 35,
    link: 1, contactPerStation: 0.07, arriveDv: 0, keepDvPerYear: 0.03, radiation: 0.2, dragYears: 4, launch: "leo",
    desc: L("Muy cerca de la Tierra: fotos nítidas y señal fuerte. Pero cada estación terrestre la ve solo unos minutos por vuelta, pasa un tercio del tiempo a la sombra y el roce con la atmósfera la frena.",
      "Very close to Earth: sharp images and a strong signal. But each ground station sees it for only a few minutes per orbit, it spends a third of the time in shadow, and air drag slows it down.") },
  geo: { name: L("Órbita geoestacionaria (36 000 km)", "Geostationary orbit (36,000 km)"), short: "GEO", sun: 1, eclipseFrac: 0.01, eclipseMin: 72,
    link: 0.5, contactPerStation: 1, arriveDv: 1.5, keepDvPerYear: 0.05, radiation: 0.6, launch: "gto",
    desc: L("Gira al mismo ritmo que la Tierra: mira siempre el mismo lado del planeta y una sola estación la escucha todo el tiempo. Llegar ahí exige combustible propio.",
      "It turns at the same pace as Earth: it always watches the same side of the planet and a single station hears it all the time. Getting there takes your own fuel.") },
  luna: { name: L("Órbita lunar (100 km)", "Lunar orbit (100 km)"), short: L("Luna", "Moon"), sun: 1, eclipseFrac: 0.4, eclipseMin: 48,
    link: 0.3, contactPerStation: 0.33, arriveDv: 0.9, keepDvPerYear: 0.1, radiation: 0.7, launch: "tli",
    desc: L("A 384 000 km. Para quedarte en órbita hay que frenar con tus motores. Cada estación terrestre la ve unas 8 horas al día.",
      "384,000 km away. To stay in orbit you must brake with your engines. Each ground station sees it about 8 hours a day.") },
  l2: { name: L("Punto L2 (1,5 millones de km)", "L2 point (1.5 million km)"), short: "L2", sun: 1, eclipseFrac: 0, eclipseMin: 0,
    link: 0.15, contactPerStation: 0.33, arriveDv: 0.15, keepDvPerYear: 0.01, radiation: 0.5, launch: "l2",
    desc: L("Detrás de la Tierra, lejos de su calor y su luz: ideal para telescopios. Nunca hay sombra, pero la señal llega débil.",
      "Behind Earth, far from its heat and light: ideal for telescopes. There is never any shadow, but the signal arrives weak.") },
  marte: { name: L("Órbita de Marte", "Mars orbit"), short: L("Marte", "Mars"), sun: 0.43, eclipseFrac: 0.3, eclipseMin: 40,
    link: 0.04, contactPerStation: 0.33, arriveDv: 1.0, keepDvPerYear: 0.02, radiation: 0.8, launch: "mars",
    desc: L("Llega menos de la mitad de la luz solar y la señal tarda minutos en llegar, muy débil. Hay que frenar para quedarse.",
      "Less than half the sunlight reaches it, and the signal takes minutes to arrive, very weak. You must brake to stay.") }
};

const LAUNCHERS = {
  chico:  { name: L("Cohete pequeño", "Small rocket"),  cost: 8,   cap: { leo: 300,   gto: 0,     tli: 0,     l2: 0,     mars: 0 } },
  medio:  { name: L("Cohete mediano", "Medium rocket"), cost: 40,  cap: { leo: 3000,  gto: 1000,  tli: 600,   l2: 600,   mars: 400 } },
  grande: { name: L("Cohete grande", "Large rocket"),   cost: 70,  cap: { leo: 17000, gto: 5500,  tli: 4000,  l2: 4000,  mars: 3500 } },
  pesado: { name: L("Cohete pesado", "Heavy rocket"),   cost: 150, cap: { leo: 60000, gto: 22000, tli: 15000, l2: 15000, mars: 14000 } }
};

const NETWORKS = {
  basica:   { name: L("1 estación terrestre", "1 ground station"), stations: 1, costPerYear: 2, desc: L("Barata, pero te escucha poco tiempo.", "Cheap, but it hears you only a little.") },
  regional: { name: L("2 estaciones", "2 stations"), stations: 2, costPerYear: 5, desc: L("El doble de tiempo de contacto.", "Twice the contact time.") },
  global:   { name: L("Red global (3 estaciones)", "Global network (3 stations)"), stations: 3, costPerYear: 12, desc: L("Como la Red de Espacio Profundo: siempre hay una antena mirando.", "Like the Deep Space Network: there is always an antenna listening.") }
};

/* role: who decides it in team mode. max: how many can be added. */
const PARTS = {
  // Engineering: power, attitude, computer, propulsion
  solarS: { role: "ing", cat: L("Energía", "Power"), name: L("Paneles solares chicos", "Small solar panels"), mass: 15, cost: 2, solar: 300, max: 3,
    desc: L("300 W a la distancia de la Tierra. Solo funcionan con Sol.", "300 W at Earth's distance from the Sun. They only work in sunlight.") },
  solarL: { role: "ing", cat: L("Energía", "Power"), name: L("Paneles solares grandes", "Large solar panels"), mass: 70, cost: 10, solar: 2500, max: 3,
    desc: L("2500 W con Sol directo. Lejos del Sol rinden menos.", "2,500 W in direct sunlight. Far from the Sun they produce less.") },
  rtg: { role: "ing", cat: L("Energía", "Power"), name: L("Generador nuclear (RTG)", "Nuclear generator (RTG)"), mass: 45, cost: 60, rtg: 110, max: 3, advanced: true,
    desc: L("110 W constantes, de día y de noche, cerca o lejos del Sol. Caro.", "A steady 110 W, day and night, near or far from the Sun. Expensive.") },
  bateria: { role: "ing", cat: L("Energía", "Power"), name: L("Batería (800 Wh)", "Battery (800 Wh)"), mass: 8, cost: 1, wh: 800, max: 4,
    desc: L("Guarda energía para cuando la nave pasa por la sombra.", "Stores energy for when the spacecraft passes through shadow.") },
  magneto: { role: "ing", cat: L("Orientación", "Attitude control"), name: L("Magnetorquers", "Magnetorquers"), mass: 3, cost: 0.5, power: 5, pointing: 0.5, onlyLeo: true, max: 1,
    desc: L("Se orientan empujando contra el campo magnético de la Tierra. Baratos, poco precisos, y lejos de la Tierra casi no sirven.",
      "They turn the spacecraft by pushing against Earth's magnetic field. Cheap, not very precise, and almost useless far from Earth.") },
  ruedas: { role: "ing", cat: L("Orientación", "Attitude control"), name: L("Ruedas de reacción", "Reaction wheels"), mass: 25, cost: 6, power: 40, pointing: 1, max: 1,
    desc: L("Giran para apuntar la nave con precisión. Necesarias para cámaras finas y antenas grandes.", "They spin to point the spacecraft precisely. Needed for sharp cameras and big antennas.") },
  cpuStd: { role: "ing", cat: L("Computadora", "Computer"), name: L("Computadora comercial", "Commercial computer"), mass: 2, cost: 1, power: 10, brain: true, max: 1,
    desc: L("Barata y rápida, pero la radiación la daña con el tiempo.", "Cheap and fast, but radiation damages it over time.") },
  cpuRad: { role: "ing", cat: L("Computadora", "Computer"), name: L("Computadora resistente a radiación", "Radiation-hardened computer"), mass: 6, cost: 8, power: 20, brain: true, radHard: true, max: 1,
    desc: L("Más cara y lenta, pero aguanta años de radiación.", "More expensive and slower, but it survives years of radiation.") },
  tanque: { role: "ing", cat: L("Propulsión", "Propulsion"), name: L("Tanque y motor químico (150 kg de combustible)", "Tank and chemical engine (150 kg of fuel)"), mass: 190, cost: 6, fuel: 150, max: 6,
    desc: L("Para frenar al llegar y corregir la órbita durante años.", "To brake on arrival and correct the orbit for years.") },
  ionico: { role: "ing", cat: L("Propulsión", "Propulsion"), name: L("Motor iónico", "Ion engine"), mass: 40, cost: 20, power: 300, ion: true, max: 1, advanced: true,
    desc: L("Gasta cinco veces menos combustible, pero necesita mucha electricidad.", "Uses five times less fuel, but needs a lot of electricity.") },

  // Communications
  antBaja: { role: "com", cat: L("Antenas", "Antennas"), name: L("Antena omnidireccional", "Omnidirectional antenna"), mass: 2, cost: 0.5, power: 10, rate: 2, max: 2,
    desc: L("No necesita apuntar. 2 Mbps cerca de la Tierra.", "No pointing needed. 2 Mbps near Earth.") },
  antMedia: { role: "com", cat: L("Antenas", "Antennas"), name: L("Antena de media ganancia", "Medium-gain antenna"), mass: 8, cost: 3, power: 40, rate: 40, max: 2,
    desc: L("40 Mbps cerca de la Tierra.", "40 Mbps near Earth.") },
  antAlta: { role: "com", cat: L("Antenas", "Antennas"), name: L("Antena parabólica de alta ganancia", "High-gain dish antenna"), mass: 30, cost: 12, power: 120, rate: 300, needsPointing: true, max: 1,
    desc: L("300 Mbps cerca de la Tierra, pero hay que apuntarla con precisión.", "300 Mbps near Earth, but it must be pointed precisely.") },
  grabadora: { role: "com", cat: L("Datos", "Data"), name: L("Grabadora de datos", "Data recorder"), mass: 3, cost: 1, power: 5, recorder: true, max: 1,
    desc: L("Guarda los datos mientras no hay estación a la vista, para enviarlos después.", "Stores data while no station is in view, to send it later.") },

  // Science
  camNubes: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Cámara de nubes (gran angular)", "Cloud camera (wide angle)"), mass: 20, cost: 15, power: 25, data: 3,
    tags: { clima: 3, atmosfera: 1, superficie: 1 }, max: 1, desc: L("Ve medio planeta a la vez. Ideal para tormentas.", "Sees half the planet at once. Ideal for storms.") },
  camAlta: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Cámara de alta resolución", "High-resolution camera"), mass: 60, cost: 45, power: 80, data: 40, needsPointing: true,
    tags: { superficie: 3, clima: 1, agua: 1 }, max: 1, desc: L("Detalles finos del terreno. Genera muchísimos datos.", "Fine detail of the ground. Generates a huge amount of data.") },
  espectro: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Espectrómetro infrarrojo", "Infrared spectrometer"), mass: 35, cost: 35, power: 45, data: 12,
    tags: { agua: 3, atmosfera: 2, superficie: 1, astro: 1 }, max: 1, desc: L("Descompone la luz para saber de qué están hechas las cosas: agua, hielo, minerales.", "Splits light to find out what things are made of: water, ice, minerals.") },
  microondas: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Sonda de microondas", "Microwave sounder"), mass: 50, cost: 30, power: 60, data: 1,
    tags: { clima: 3, atmosfera: 2, agua: 1 }, max: 1, desc: L("Ve a través de las nubes: lluvia, humedad y temperatura.", "Sees through clouds: rain, humidity and temperature.") },
  radar: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Radar", "Radar"), mass: 120, cost: 70, power: 400, data: 60,
    tags: { superficie: 3, agua: 2, clima: 1 }, max: 1, desc: L("Funciona de día y de noche y atraviesa nubes y polvo. Gasta mucha energía.", "Works day and night and sees through clouds and dust. Uses a lot of power.") },
  laser: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Altímetro láser", "Laser altimeter"), mass: 25, cost: 20, power: 50, data: 1,
    tags: { superficie: 2, agua: 1 }, max: 1, desc: L("Mide la altura del terreno con un rayo láser.", "Measures the height of the ground with a laser beam.") },
  telescopio: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Telescopio infrarrojo", "Infrared telescope"), mass: 400, cost: 250, power: 300, data: 20, needsPointing: true, wantsCold: true,
    tags: { astro: 5 }, max: 1, desc: L("Ve galaxias lejanas. Necesita frío y oscuridad, lejos del calor de la Tierra.", "Sees distant galaxies. Needs cold and darkness, far from Earth's heat.") },
  magnetometro: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Magnetómetro", "Magnetometer"), mass: 3, cost: 5, power: 4, data: 0.1,
    tags: { campo: 3 }, max: 1, desc: L("Mide campos magnéticos. Ligero y barato.", "Measures magnetic fields. Light and cheap.") },
  particulas: { role: "sci", cat: L("Instrumentos", "Instruments"), name: L("Detector de partículas", "Particle detector"), mass: 8, cost: 8, power: 10, data: 0.5,
    tags: { campo: 2, astro: 1 }, max: 1, desc: L("Cuenta las partículas del viento solar y los rayos cósmicos.", "Counts particles from the solar wind and cosmic rays.") }
};

const SCENARIOS = {
  huracan: { name: L("Ojo del huracán", "Eye of the hurricane"), emoji: "🌀", goal: 100, budget: 350, target: L("Tierra", "Earth"),
    weights: { clima: 3, atmosfera: 2, superficie: 0.5 }, fit: { geo: 1, leo: 0.7 },
    brief: L("Vigila los huracanes para avisar a tiempo a la gente de la costa.", "Watch hurricanes to warn people on the coast in time."),
    hint: L("Necesitas ver las nubes seguido. ¿Desde muy cerca un rato o desde lejos todo el tiempo?", "You need to see the clouds often. From very close for a while, or from far away all the time?") },
  hielo: { name: L("Hielo en la Luna", "Ice on the Moon"), emoji: "🌕", goal: 80, budget: 450, target: L("Luna", "Moon"),
    weights: { agua: 3, superficie: 2 }, fit: { luna: 1 },
    brief: L("Encuentra hielo de agua en los cráteres oscuros de los polos de la Luna.", "Find water ice in the dark craters at the Moon's poles."),
    hint: L("Esos cráteres nunca reciben luz del Sol. ¿Qué instrumento no necesita luz?", "Those craters never get sunlight. Which instrument doesn't need light?") },
  marte: { name: L("Agua en Marte", "Water on Mars"), emoji: "🔴", goal: 80, budget: 700, target: L("Marte", "Mars"),
    weights: { agua: 3, superficie: 2, atmosfera: 1 }, fit: { marte: 1 },
    brief: L("Busca dónde hubo agua en Marte y dónde podría quedar hielo bajo el suelo.", "Find where Mars once had water and where ice might remain underground."),
    hint: L("Desde Marte la señal llega débil. Piensa cuántos datos podrás enviar.", "The signal from Mars is weak. Think about how much data you can send.") },
  galaxias: { name: L("Galaxias lejanas", "Distant galaxies"), emoji: "🌌", goal: 60, budget: 1200, target: L("Universo", "Universe"),
    weights: { astro: 3 }, fit: { l2: 1, geo: 0.5, leo: 0.4 },
    brief: L("Observa las primeras galaxias del universo con luz infrarroja.", "Observe the first galaxies of the universe in infrared light."),
    hint: L("El calor de la Tierra y del Sol ciega a un telescopio infrarrojo.", "Heat from Earth and the Sun blinds an infrared telescope.") },
  libre: { name: L("Modo libre", "Sandbox"), emoji: "🧪", goal: 100, budget: Infinity, target: L("Lo que quieras", "Anything you like"),
    weights: { clima: 1, atmosfera: 1, superficie: 1, agua: 1, astro: 1, campo: 1 },
    fit: { leo: 1, geo: 1, luna: 1, l2: 1, marte: 1 }, sandbox: true,
    brief: L("Sin presupuesto ni objetivo fijo: experimenta y mira qué pasa.", "No budget and no fixed goal: experiment and see what happens."),
    hint: L("Prueba la misma nave en órbitas distintas.", "Try the same spacecraft in different orbits.") }
};

const DIFFICULTY = {
  cadete:   { name: L("Cadete", "Cadet"), budgetMult: 1.4, events: 1, advanced: false,
    desc: L("Más presupuesto, pocas sorpresas, piezas básicas.", "More budget, few surprises, basic parts.") },
  ingeniero:{ name: L("Especialista", "Specialist"), budgetMult: 1, events: 2, advanced: true,
    desc: L("El presupuesto real y algunas sorpresas.", "The real budget and a few surprises.") },
  director: { name: L("Dirección de vuelo", "Flight director"), budgetMult: 0.8, events: 3, advanced: true,
    desc: L("Poco dinero y muchas sorpresas.", "Little money and lots of surprises.") }
};

const ROLES = {
  dir: { name: L("Dirección de misión", "Mission director"), emoji: "🧭", owns: L("Objetivo, órbita, cohete, años de misión y presupuesto", "Goal, orbit, rocket, mission length and budget"),
    secret: { text: L("Terminar con al menos 10% del presupuesto sin gastar.", "Finish with at least 10% of the budget unspent."), check: r => r.sandbox || r.budgetLeft >= 0.1 * r.budget } },
  ing: { name: L("Ingeniería", "Engineering"), emoji: "🔧", owns: L("Energía, orientación, computadora y propulsión", "Power, attitude control, computer and propulsion"),
    secret: { text: L("Que la nave tenga al menos 20% de energía de sobra.", "Keep at least 20% spare power on the spacecraft."), check: r => r.powerMargin >= 0.2 } },
  sci: { name: L("Ciencia", "Science"), emoji: "🔬", owns: L("Instrumentos científicos", "Science instruments"),
    secret: { text: L("Llevar al menos 3 instrumentos científicos.", "Fly at least 3 science instruments."), check: r => r.instruments >= 3 } },
  com: { name: L("Comunicaciones", "Communications"), emoji: "📡", owns: L("Antenas, grabadora y red de estaciones terrestres", "Antennas, recorder and ground station network"),
    secret: { text: L("Que llegue a la Tierra al menos el 95% de los datos.", "Get at least 95% of the data back to Earth."), check: r => r.dataFactor >= 0.95 } }
};
const ROLE_ORDER = ["dir", "ing", "sci", "com"];

const REAL_MISSIONS = [
  { scenario: "huracan", orbit: "geo", name: L("GOES (satélites meteorológicos)", "GOES (weather satellites)"),
    text: L("Vigilan las Américas desde la órbita geoestacionaria sin perder de vista las tormentas.", "They watch the Americas from geostationary orbit, never losing sight of storms.") },
  { scenario: "huracan", orbit: "leo", name: L("Aqua y Terra", "Aqua and Terra"),
    text: L("Recorren la Tierra en órbita baja y miden nubes, lluvia y temperatura del planeta entero.", "They circle Earth in low orbit and measure clouds, rain and temperature across the whole planet.") },
  { scenario: "hielo", orbit: "luna", name: "Lunar Reconnaissance Orbiter (LRO)",
    text: L("Orbita la Luna desde 2009, mide su relieve con un láser y busca hielo en los polos.", "It has orbited the Moon since 2009, mapping its surface with a laser and searching for ice at the poles.") },
  { scenario: "marte", orbit: "marte", name: "Mars Reconnaissance Orbiter (MRO)",
    text: L("Lleva una cámara de alta resolución y un radar que encontró hielo bajo el suelo de Marte.", "It carries a high-resolution camera and a radar that found ice beneath the surface of Mars.") },
  { scenario: "galaxias", orbit: "l2", name: L("Telescopio espacial James Webb", "James Webb Space Telescope"),
    text: L("Observa en infrarrojo desde L2, protegido del Sol por un parasol gigante.", "It observes in infrared from L2, shielded from the Sun by a giant sunshield.") },
  { scenario: "galaxias", orbit: "leo", name: L("Telescopio espacial Hubble", "Hubble Space Telescope"),
    text: L("Funciona en órbita baja desde 1990, sobre todo con luz visible y ultravioleta.", "It has worked in low orbit since 1990, mostly with visible and ultraviolet light.") }
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
    ? L(`El ${lv.name.toLowerCase()} no puede llegar a ${orb.short}. Elige un cohete más potente.`, `The ${lv.name.toLowerCase()} can't reach ${orb.short}. Choose a more powerful rocket.`)
    : L(`La nave pesa ${fmt(r.wetMass)} kg y el ${lv.name.toLowerCase()} solo lleva ${fmt(r.capacity)} kg a ${orb.short}.`, `The spacecraft weighs ${fmt(r.wetMass)} kg and the ${lv.name.toLowerCase()} can only carry ${fmt(r.capacity)} kg to ${orb.short}.`));
  if (!r.sandbox && r.cost > r.budget) r.blockers.push(L(`Cuesta ${money(r.cost)} y el presupuesto es ${money(r.budget)}.`, `It costs ${money(r.cost)} and the budget is ${money(r.budget)}.`));
  if (!hasBrain) r.blockers.push(L("Falta una computadora: sin ella nadie a bordo obedece órdenes.", "There is no computer: without one, nothing on board follows commands."));
  if (!sc.fit[d.orbit]) r.blockers.push(L(`Desde ${orb.short} no se puede cumplir este objetivo (${sc.target}).`, `This goal (${sc.target}) can't be reached from ${orb.short}.`));

  // Soft warnings: you can launch, but it will hurt.
  if (!r.arrives) r.warnings.push(L(`Falta combustible para entrar en órbita: necesitas ${fmt(r.fuelArrive)} kg y llevas ${fmt(fuel)} kg.`, `Not enough fuel to enter orbit: you need ${fmt(r.fuelArrive)} kg and carry ${fmt(fuel)} kg.`));
  if (r.powerFactor < 1) r.warnings.push(L(`La energía no alcanza: los equipos funcionarán solo ${pct(r.powerFactor)} del tiempo.`, `Not enough power: equipment will only run ${pct(r.powerFactor)} of the time.`));
  if (r.dataFactor < 0.95 && r.dataPerDay > 0) r.warnings.push(L(`Solo llegará ${pct(r.dataFactor)} de los datos a la Tierra.`, `Only ${pct(r.dataFactor)} of the data will reach Earth.`));
  if (instruments === 0) r.warnings.push(L("No hay instrumentos científicos: la misión no aprenderá nada.", "There are no science instruments: the mission won't learn anything."));
  if (r.lifetime < d.years && r.lifetime > 0) r.warnings.push(L(`La nave durará ${r.lifetime} años de los ${d.years} planeados.`, `The spacecraft will last ${r.lifetime} of the ${d.years} planned years.`));
  return r;
}

/* Plain-language reasons for the post-mission report. */
function explain(d, r, outcome) {
  const orb = ORBITS[d.orbit], sc = SCENARIOS[d.scenario], out = [];
  if (!outcome.arrived) out.push({ bad: true, text: L(
    `No hubo combustible para frenar y entrar en órbita. Para ${fmt(r.dryMass)} kg de nave hacían falta ${fmt(r.fuelArrive)} kg. Cada kilo extra de nave pide más combustible, que también pesa.`,
    `There was not enough fuel to brake into orbit. A ${fmt(r.dryMass)} kg spacecraft needed ${fmt(r.fuelArrive)} kg. Every extra kilo of spacecraft needs more fuel, and that fuel weighs too.`) });
  if (r.fit < 1 && r.fit > 0) out.push({ bad: true, text: L(
    `${orb.short} no es la órbita ideal para «${sc.name}»: solo se aprovecha el ${pct(r.fit)} de lo que observan los instrumentos.`,
    `${orb.short} is not the ideal orbit for "${sc.name}": only ${pct(r.fit)} of what the instruments observe is useful.`) });
  if (r.gen === 0) out.push({ bad: true, text: L(
    "No había ninguna fuente de energía a bordo: ni paneles solares ni generador. Nada pudo encenderse.",
    "There was no power source on board: no solar panels and no generator. Nothing could turn on.") });
  else if (r.powerFactor < 1) {
    const night = r.gen >= r.load && orb.eclipseFrac > 0 && r.battery < r.batteryNeed;
    out.push({ bad: true, text: night
      ? L(`Pasabas ${pct(orb.eclipseFrac)} del tiempo a la sombra y las baterías (${fmt(r.battery)} Wh) no cubrían los ${fmt(r.batteryNeed)} Wh necesarios. Más batería o menos consumo.`,
          `You spent ${pct(orb.eclipseFrac)} of the time in shadow and the batteries (${fmt(r.battery)} Wh) didn't cover the ${fmt(r.batteryNeed)} Wh needed. More battery or less power use.`)
      : L(`Generabas ${fmt(r.gen)} W de promedio y consumías ${fmt(r.load)} W. ${orb.sun < 1 ? `En ${orb.short} el Sol da solo ${pct(orb.sun)} de energía. ` : ""}Más paneles, un RTG o menos instrumentos.`,
          `You generated ${fmt(r.gen)} W on average and used ${fmt(r.load)} W. ${orb.sun < 1 ? `At ${orb.short} the Sun gives only ${pct(orb.sun)} of the power. ` : ""}More panels, an RTG or fewer instruments.`) });
  }
  if (r.dataFactor < 0.95 && r.dataPerDay > 0) out.push({ bad: true, text: L(
    `Generabas ${fmt1(r.dataPerDay)} Gb al día y podías enviar ${fmt1(r.downPerDay)} Gb. ${!r.recorder ? "Sin grabadora, todo lo que se mide sin estación a la vista se pierde. " : ""}${orb.link < 0.2 ? `Desde ${orb.short} la señal llega muy débil. ` : ""}Ciencia que no llega a la Tierra es ciencia perdida.`,
    `You generated ${fmt1(r.dataPerDay)} Gb a day and could send ${fmt1(r.downPerDay)} Gb. ${!r.recorder ? "Without a recorder, everything measured while no station is in view is lost. " : ""}${orb.link < 0.2 ? `From ${orb.short} the signal is very weak. ` : ""}Science that doesn't reach Earth is lost science.`) });
  const pointed = r.contributions.filter(c => PARTS[c.id].needsPointing);
  if (r.pointing < 1 && (pointed.length || count(d, "antAlta"))) out.push({ bad: true, text: L(
    "Sin ruedas de reacción, la nave no apuntaba con precisión: las cámaras finas y la antena parabólica rindieron mucho menos.",
    "Without reaction wheels, the spacecraft couldn't point precisely: sharp cameras and the dish antenna performed much worse.") });
  if (count(d, "telescopio") && d.orbit !== "l2") out.push({ bad: true, text: L(
    "El telescopio infrarrojo veía el calor de la Tierra: en L2 habría estado frío y a oscuras.",
    "The infrared telescope saw Earth's heat: at L2 it would have been cold and dark.") });
  if (r.lifeLimiter === "radiacion") out.push({ bad: true, text: L(
    `La radiación en ${orb.short} daña una computadora comercial en unos ${r.lifetime} años. Una resistente a radiación habría durado más.`,
    `Radiation at ${orb.short} damages a commercial computer in about ${r.lifetime} years. A radiation-hardened one would have lasted longer.`) });
  if (r.lifeLimiter === "combustible") out.push({ bad: true, text: L(
    `El combustible solo alcanzó para ${r.lifetime} años de correcciones de órbita.`,
    `The fuel only lasted for ${r.lifetime} years of orbit corrections.`) });
  if (r.lifeLimiter === "arrastre") out.push({ bad: true, text: L(
    "Sin motor, el roce con la atmósfera hizo caer la nave en pocos años.",
    "Without an engine, air drag brought the spacecraft down within a few years.") });
  for (const e of outcome.eventLog) out.push({ bad: e.bad, text: `${e.title}: ${e.result}` });
  if (outcome.score.objective >= 1) out.push({ bad: false, text: L(
    `¡Objetivo cumplido! ${outcome.science} puntos de ciencia, la meta era ${r.goal}.`,
    `Goal reached! ${outcome.science} science points; the goal was ${r.goal}.`) });
  else if (outcome.arrived) out.push({ bad: false, text: L(
    `Lograste ${pct(outcome.score.objective)} del objetivo científico.`,
    `You reached ${pct(outcome.score.objective)} of the science goal.`) });
  if (!r.sandbox && r.budgetLeft > 0) out.push({ bad: false, text: L(
    `Sobraron ${money(r.budgetLeft - outcome.extraCost)} del presupuesto.`,
    `${money(r.budgetLeft - outcome.extraCost)} of the budget was left over.`) });
  if (out.filter(x => x.bad).length === 0) {
    if (outcome.score.objective >= 1) out.push({ bad: false, text: L(
      "No hubo puntos débiles graves. ¿Puedes lograr lo mismo más barato o con otra órbita? Casi nunca hay una sola solución.",
      "No serious weak points. Can you do the same for less, or from another orbit? There is rarely a single solution.") });
    else {
      const best = [...r.contributions].sort((a, b) => b.value - a.value)[0];
      out.push({ bad: true, text: L(
        `La nave funcionó bien, pero no llevaba suficiente ciencia para la meta. Agrega instrumentos útiles para «${sc.name}» o alarga la misión.${best ? ` Tu instrumento más útil fue: ${best.name}.` : ""}`,
        `The spacecraft worked well, but it didn't carry enough science for the goal. Add instruments that suit "${sc.name}" or make the mission longer.${best ? ` Your most useful instrument was: ${best.name}.` : ""}`) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Mission events: each has a responsible role and two options. */

const EVENTS = [
  { id: "tormenta", role: "ing", title: L("☀️ Tormenta solar", "☀️ Solar storm"),
    text: L("Una erupción del Sol lanza partículas hacia la nave.", "An eruption on the Sun hurls particles toward the spacecraft."),
    options: [
      { label: L("Modo seguro: apagar los instrumentos un mes", "Safe mode: switch off the instruments for a month"),
        apply: s => { s.pauseMonths += 1; return { bad: false, result: L("La nave se protegió y perdió un mes de ciencia.", "The spacecraft stayed safe and lost a month of science.") }; } },
      { label: L("Seguir trabajando y arriesgarse", "Keep working and take the risk"), apply: (s, d, rnd) => {
          if (count(d, "cpuRad")) return { bad: false, result: L("La computadora resistente a radiación aguantó sin problemas.", "The radiation-hardened computer held up fine.") };
          if (rnd() < 0.5) { s.lifeMonths = Math.round(s.month + (s.lifeMonths - s.month) * 0.6); return { bad: true, result: L("La computadora comercial sufrió daños y la misión se acortó.", "The commercial computer was damaged and the mission was cut short.") }; }
          return { bad: false, result: L("Hubo suerte: la computadora resistió.", "Lucky: the computer survived.") };
        } }
    ] },
  { id: "rueda", role: "ing", when: d => count(d, "ruedas") > 0, title: L("⚙️ Falla una rueda de reacción", "⚙️ A reaction wheel fails"),
    text: L("Una de las ruedas que orientan la nave se atascó.", "One of the wheels that point the spacecraft got stuck."),
    options: [
      { label: L("Orientar con los propulsores (gasta combustible)", "Point with the thrusters (uses fuel)"), enabled: s => s.fuel > 0,
        apply: s => { s.fuel *= 0.7; s.lifeMonths = Math.round(s.month + (s.lifeMonths - s.month) * 0.85); return { bad: false, result: L("Se mantuvo la puntería a costa de combustible y algo de vida útil.", "Pointing was kept at the cost of fuel and some lifetime.") }; } },
      { label: L("Aceptar apuntar con menos precisión", "Accept less precise pointing"),
        apply: s => { s.sciMult *= 0.75; return { bad: true, result: L("La nave apunta peor y los instrumentos rinden menos.", "The spacecraft points worse and the instruments return less.") }; } }
    ] },
  { id: "sorpresa", role: "sci", title: L("🔭 ¡Sorpresa científica!", "🔭 Science surprise!"),
    text: L("Aparece algo inesperado que los científicos quieren observar ya.", "Something unexpected appears and the scientists want to observe it right now."),
    options: [
      { label: L("Cambiar el plan y observarlo", "Change the plan and observe it"), apply: (s, d, rnd, r) => {
          const bonus = Math.round(r.goal * (r.dataFactor >= 0.9 ? 0.12 : 0.04)); s.bonus += bonus;
          return { bad: false, result: r.dataFactor >= 0.9
            ? L(`Gran descubrimiento: +${bonus} puntos de ciencia.`, `Big discovery: +${bonus} science points.`)
            : L(`Se observó, pero no había capacidad para enviar tantos datos: solo +${bonus} puntos.`, `It was observed, but there wasn't capacity to send that much data: only +${bonus} points.`) };
        } },
      { label: L("Seguir el plan original", "Stick to the original plan"), apply: () => ({ bad: false, result: L("La misión siguió su plan.", "The mission stuck to its plan.") }) }
    ] },
  { id: "recorte", role: "dir", when: d => !SCENARIOS[d.scenario].sandbox, title: L("💸 Recorte de presupuesto", "💸 Budget cut"),
    text: L("La agencia necesita ahorrar dinero este año.", "The agency needs to save money this year."),
    options: [
      { label: L("Pagar con el margen que sobra ($25 M)", "Pay from the spare margin ($25 M)"), enabled: (s, d, r) => r.budgetLeft - s.extraCost >= 25,
        apply: s => { s.extraCost += 25; return { bad: false, result: L("Se pagó con el margen guardado: tener reserva salvó la misión.", "It was paid from the saved margin: having a reserve saved the mission.") }; } },
      { label: L("Acortar la misión un año", "Cut the mission short by a year"),
        apply: s => { s.lifeMonths = Math.max(s.month + 1, s.lifeMonths - 12); return { bad: true, result: L("La misión terminó un año antes.", "The mission ended a year early.") }; } }
    ] },
  { id: "red", role: "com", title: L("📡 Antenas saturadas", "📡 Antennas overbooked"),
    text: L("Otras misiones necesitan las estaciones terrestres y te quedas con menos tiempo de contacto.", "Other missions need the ground stations and you get less contact time."),
    options: [
      { label: L("Pagar tiempo extra de antena ($6 M)", "Pay for extra antenna time ($6 M)"),
        apply: s => { s.extraCost += 6; return { bad: false, result: L("Se compró tiempo de antena y no se perdieron datos.", "Antenna time was bought and no data was lost.") }; } },
      { label: L("Aceptar enviar menos datos por un año", "Accept sending less data for a year"),
        apply: s => { s.dataPenaltyUntil = s.month + 12; return { bad: true, result: L("Durante un año llegó menos ciencia a la Tierra.", "For a year, less science reached Earth.") }; } }
    ] },
  { id: "meteorito", role: "ing", title: L("☄️ Micrometeorito", "☄️ Micrometeoroid"),
    text: L("Una partícula diminuta y rapidísima golpea la nave.", "A tiny, extremely fast particle hits the spacecraft."),
    options: [
      { label: L("Revisar y reducir el consumo de energía", "Check systems and reduce power use"),
        apply: s => { s.sciMult *= 0.9; return { bad: false, result: L("Con menos consumo, la nave siguió a salvo pero un poco más lenta.", "Using less power, the spacecraft stayed safe but a little slower.") }; } },
      { label: L("Seguir igual", "Carry on as before"), apply: (s, d, rnd, r) => {
          if (r.powerMargin >= 0.15) return { bad: false, result: L("Había energía de sobra: el golpe no afectó.", "There was spare power: the hit made no difference.") };
          s.lifeMonths = Math.round(s.month + (s.lifeMonths - s.month) * 0.7);
          return { bad: true, result: L("Sin margen de energía, el daño acortó la vida de la nave.", "With no power margin, the damage shortened the spacecraft's life.") };
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
function fmt(v) { return Math.round(v).toLocaleString(LOCALE); }
function fmt1(v) { return (Math.round(v * 10) / 10).toLocaleString(LOCALE); }
function pct(v) { return Math.round(v * 100) + "%"; }
function money(v) { return v === Infinity ? L("sin límite", "unlimited") : "$" + fmt1(v) + " M"; }

if (typeof module !== "undefined") module.exports = { ORBITS, LAUNCHERS, NETWORKS, PARTS, SCENARIOS, DIFFICULTY, ROLES, ROLE_ORDER, EVENTS, REAL_MISSIONS, newDesign, evaluate, startRun, stepRun, chooseOption, finishRun, budgetOf };
