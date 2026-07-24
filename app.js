"use strict";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_LAB = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

let vistaFecha = null;   // "ver otro día" (null = hoy)
let setupAbierto = false; // pantalla de configurar semana visible
let borrador = null;      // config en edición mientras el setup está abierto

// ---- utilidades de fecha ----
function aMedianoche(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseFecha(str) {
  const [a, m, d] = str.split("-").map(Number);
  return new Date(a, m - 1, d);
}
function clave(d) {
  const x = aMedianoche(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function lunesDe(d) {
  const x = aMedianoche(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  return x;
}
function getFechaInicio(datos) {
  return localStorage.getItem("fechaInicio") || datos.fechaInicio;
}

// ---- plan (1y3 / 2y4): se calcula solo a partir de la fecha de inicio ----
function calcularPlan(datos, hoy) {
  const inicio = lunesDe(parseFecha(getFechaInicio(datos)));
  const semanasPasadas = Math.floor((lunesDe(hoy) - inicio) / (7 * 86400000));
  const idx = ((semanasPasadas % 4) + 4) % 4;
  return { idx, plan: idx % 2 === 0 ? "1y3" : "2y4" };
}

// ---- configuración de cada semana (entrenos + qué menú va cada día) ----
// Guardada en localStorage bajo "semana-<lunes de esa semana>":
//   { entrenos: [{dia:1..6, momento:"manana"|"tarde"}, ...], orden: [6 nombres de día] }
function claveSemanaCfg(d) {
  return "semana-" + clave(lunesDe(d));
}
function getConfigSemana(d) {
  const raw = localStorage.getItem(claveSemanaCfg(d));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function setConfigSemana(d, cfg) {
  localStorage.setItem(claveSemanaCfg(d), JSON.stringify(cfg));
}

function etiquetaNaranja(datos, plan, nombreDia) {
  const d = datos.semanas[plan][nombreDia];
  if (!d || !d.naranja) return "";
  return d.naranja === "almuerzo" ? " 🔶 comida" : " 🔶 cena";
}

// ---- render ----
function render(datos) {
  const override = vistaFecha || new URLSearchParams(location.search).get("fecha");
  const esPreview = !!vistaFecha;
  const hoy = override ? aMedianoche(parseFecha(override)) : aMedianoche(new Date());
  const inicioStr = getFechaInicio(datos);
  const cont = document.getElementById("contenido");

  bannerPreview(datos, esPreview);

  document.getElementById("fecha").textContent =
    `${DIAS[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  if (!inicioStr) {
    document.getElementById("titulo-dia").textContent = "Falta la fecha";
    cont.innerHTML = `<div class="aviso">Abre <b>Ajustes</b> e indica el lunes en que empezaste la dieta.</div>`;
    return;
  }

  const inicio = lunesDe(parseFecha(inicioStr));
  if (hoy < inicio) {
    document.getElementById("titulo-dia").textContent = "Aún no empieza";
    document.getElementById("semana").textContent = "";
    const f = parseFecha(inicioStr);
    cont.innerHTML = `<div class="aviso">Esta dieta empieza el <b>${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}</b>. ¡Disfruta hasta entonces!</div>`;
    return;
  }

  const { idx, plan } = calcularPlan(datos, hoy);
  document.getElementById("semana").textContent =
    `Semana ${idx + 1} · plan «${plan === "1y3" ? "1 y 3" : "2 y 4"}»`;

  const cfg = getConfigSemana(hoy);
  if (!cfg || setupAbierto) {
    if (!borrador) abrirBorrador(datos, hoy, plan, cfg);
    document.getElementById("titulo-dia").textContent = "Configurar semana";
    cont.innerHTML = pantallaSetup(datos, hoy);
    enlazarSetup(datos, hoy);
    return;
  }

  const nombreDia = DIAS[hoy.getDay()];
  document.getElementById("titulo-dia").textContent = nombreDia;

  if (hoy.getDay() === 0) {
    cont.innerHTML = diaLibre(hoy);
    return;
  }

  cont.innerHTML = tarjetasDelDia(datos, hoy, plan, nombreDia, cfg);
  enlazarEditarSemana(datos, hoy, plan, cfg);
}

function diaLibre(hoy) {
  // aviso si mañana (lunes, semana siguiente) hay entreno matutino
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const cfgManana = getConfigSemana(manana);
  const avisoLunes = cfgManana && cfgManana.entrenos.some(e => e.dia === 1 && e.momento === "manana")
    ? `<div class="leyenda">🔶 Mañana entrenas por la mañana → la cena de hoy va <b>sin carbos</b>.</div>`
    : "";
  return `
    <div class="libre">
      <span class="emoji">🎉</span>
      <h2>Día libre</h2>
      <p>Hoy toca «vida social»: come con consciencia y sin atracones,
      disfrutando eso que te ha apetecido durante la semana. Prioriza opciones de calidad.</p>
    </div>${avisoLunes}`;
}

// Qué comidas deben ir sin carbos hoy, según los entrenos de esta semana.
function calcularComidas(diaOriginal, hoy, entrenos) {
  const dow = hoy.getDay(); // 1..6
  const sesionHoy = entrenos.find(e => e.dia === dow) || null;
  const dowManana = dow === 6 ? null : dow + 1; // sábado+1 = domingo, fuera del modelo
  const necesitaCena = dowManana != null && entrenos.some(e => e.dia === dowManana && e.momento === "manana");
  const necesitaAlmuerzo = !!(sesionHoy && sesionHoy.momento === "tarde");
  const desayunoSin = !!sesionHoy;

  return {
    almuerzo: diaOriginal.almuerzo,
    cena: diaOriginal.cena,
    necesitaAlmuerzo,
    necesitaCena,
    desayunoSin,
    disenadoAlmuerzo: necesitaAlmuerzo && diaOriginal.naranja === "almuerzo",
    disenadoCena: necesitaCena && diaOriginal.naranja === "cena",
    sesionHoy,
  };
}

function tarjetasDelDia(datos, hoy, plan, nombreDiaReal, cfg) {
  const nombreDiaFuente = cfg.orden[DIAS_LAB.indexOf(nombreDiaReal)] || nombreDiaReal;
  const diaOriginal = datos.semanas[plan][nombreDiaFuente];
  const c = datos.comun;
  const r = calcularComidas(diaOriginal, hoy, cfg.entrenos);

  const desayunoTexto = r.desayunoSin ? c.desayunoSinCHO : c.desayunoConCHO;
  const listaHTML = (arr) => "<ul>" + arr.map(x => `<li>${x}</li>`).join("") + "</ul>";

  const avisoMenu = nombreDiaFuente !== nombreDiaReal
    ? `<p class="aviso-menu">📋 Hoy comes el menú de <b>${nombreDiaFuente}</b>.</p>`
    : "";

  const bloques = [
    resumenSemana(cfg, r),
    avisoMenu,
    tarjeta("☕", "Desayuno", `<p>${desayunoTexto}</p>`, r.desayunoSin),
    tarjeta("🍽️", "Almuerzo", opciones(r.almuerzo, listaHTML), r.necesitaAlmuerzo),
    tarjeta("🌙", "Cena", opciones(r.cena, listaHTML), r.necesitaCena),
  ];

  let leyenda = "";
  if (r.necesitaAlmuerzo || r.necesitaCena) {
    const partes = [];
    if (r.necesitaAlmuerzo) {
      partes.push(r.disenadoAlmuerzo
        ? "el almuerzo ya está diseñado sin carbohidratos"
        : "quita el hidrato (arroz, patata, pasta, quinoa, pan, legumbre) del almuerzo");
    }
    if (r.necesitaCena) {
      partes.push(r.disenadoCena
        ? "la cena ya está diseñada sin carbohidratos"
        : "quita el hidrato (arroz, patata, pasta, quinoa, pan, legumbre) de la cena");
    }
    leyenda = `<p class="leyenda">🔶 <b>Hoy sin carbos</b>: ${partes.join("; ")}.`;
    if (r.necesitaCena && !r.sesionHoy) leyenda += ` La cena va sin carbos porque <b>mañana entrenas por la mañana</b>.`;
    leyenda += `</p>`;
  }
  return bloques.join("") + leyenda;
}

function resumenSemana(cfg, r) {
  const resumen = cfg.entrenos.length
    ? cfg.entrenos.map(e => `${DIAS_LAB[e.dia - 1]} ${e.momento === "manana" ? "🌅" : "🌇"}`).join(" · ")
    : "Sin entrenos definidos";
  let notaHoy;
  if (r.sesionHoy) {
    notaHoy = `Hoy entrenas Z2 ${r.sesionHoy.momento === "manana" ? "🌅 por la mañana" : "🌇 por la tarde"}.`;
  } else if (r.necesitaCena) {
    notaHoy = "Hoy no entrenas, pero mañana sí por la mañana.";
  } else {
    notaHoy = "Hoy no entrenas.";
  }
  return `<div class="entreno">
    <p class="preg">🏃 Esta semana</p>
    <p class="resumen">${resumen}</p>
    <p class="nota-hoy">${notaHoy}</p>
    <button type="button" data-editar-semana="1">✏️ Editar esta semana</button>
  </div>`;
}

// ---- pantalla de configuración de la semana ----
function abrirBorrador(datos, hoy, plan, cfgExistente) {
  if (cfgExistente) {
    borrador = { entrenos: cfgExistente.entrenos.map(e => ({ ...e })), orden: [...cfgExistente.orden] };
    return;
  }
  const entrenos = (datos.entrenosPorDefecto || []).map(e => ({ ...e }));
  const orden = datos.ordenPorDefecto ? [...datos.ordenPorDefecto] : [...DIAS_LAB];
  borrador = { entrenos, orden };
}

function fechaCorta(f) {
  return `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}`;
}

function pantallaSetup(datos, hoy) {
  const { plan } = calcularPlan(datos, hoy);
  const lunes = lunesDe(hoy);
  const fechasDia = DIAS_LAB.map((_, i) =>
    fechaCorta(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i)));

  const slots = [0, 1].map(i => slotEntreno(i, borrador.entrenos[i], fechasDia)).join("");

  const filasOrden = DIAS_LAB.map((diaReal, i) => {
    const opciones = DIAS_LAB.map((fuente, j) => {
      const sel = borrador.orden[i] === fuente ? "selected" : "";
      return `<option value="${fuente}" ${sel}>${fuente} (${fechasDia[j]})${etiquetaNaranja(datos, plan, fuente)}</option>`;
    }).join("");
    return `<div class="orden-fila">
      <label>${diaReal}<span class="fecha-corta">${fechasDia[i]}</span></label>
      <select class="orden-select" data-i="${i}">${opciones}</select>
    </div>`;
  }).join("");

  return `<div class="setup">
    <h2>1. Tus 2 entrenos Z2 esta semana</h2>
    ${slots}

    <h2>2. Qué menú comes cada día</h2>
    <p class="setup-ayuda">🔶 indica el plato ya diseñado sin carbohidratos: colócalo en el día que lo necesites según tus entrenos.</p>
    ${filasOrden}

    <div class="setup-acciones">
      <button type="button" data-setup="guardar">Guardar y ver el día</button>
    </div>
  </div>`;
}

function leerEntrenosDeDOM() {
  const arr = [];
  [0, 1].forEach(i => {
    const d = document.querySelector(`.ent-dia[data-i="${i}"]`);
    const m = document.querySelector(`.ent-mom[data-i="${i}"]`);
    if (d && d.value) arr.push({ dia: Number(d.value), momento: m.value });
  });
  return arr;
}

function enlazarSetup(datos, hoy) {
  document.querySelectorAll(".orden-select").forEach(s => {
    s.addEventListener("change", () => {
      borrador.orden[Number(s.dataset.i)] = s.value;
    });
  });
  const guardar = document.querySelector('[data-setup="guardar"]');
  if (guardar) guardar.addEventListener("click", () => {
    const cfg = { entrenos: leerEntrenosDeDOM(), orden: [...borrador.orden] };
    setConfigSemana(hoy, cfg);
    setupAbierto = false;
    borrador = null;
    render(datos);
  });
}

function slotEntreno(i, e, fechasDia) {
  const cur = e || {};
  const dias = ['<option value="">— sin entreno —</option>']
    .concat(DIAS_LAB.map((d, idx) =>
      `<option value="${idx + 1}" ${cur.dia === idx + 1 ? "selected" : ""}>${d}${fechasDia ? ` (${fechasDia[idx]})` : ""}</option>`))
    .join("");
  return `<div class="slot">
    <label>Entreno ${i + 1}</label>
    <select class="ent-dia" data-i="${i}">${dias}</select>
    <select class="ent-mom" data-i="${i}">
      <option value="manana" ${cur.momento === "manana" ? "selected" : ""}>🌅 Mañana</option>
      <option value="tarde" ${cur.momento === "tarde" ? "selected" : ""}>🌇 Tarde</option>
    </select>
  </div>`;
}

function enlazarEditarSemana(datos, hoy, plan, cfg) {
  const btn = document.querySelector('[data-editar-semana]');
  if (btn) btn.addEventListener("click", () => {
    abrirBorrador(datos, hoy, plan, cfg);
    setupAbierto = true;
    render(datos);
  });
}

function opciones(arr, listaHTML) {
  if (!arr || arr.length === 0) return "<p>—</p>";
  let html = listaHTML(arr);
  if (arr.length > 1) html += `<p class="opciones">Los platos del mismo bloque se acompañan entre sí.</p>`;
  return html;
}

function tarjeta(emoji, titulo, cuerpo, sinCarbos) {
  const badge = sinCarbos ? `<span class="badge">🔶 sin carbos</span>` : "";
  return `<div class="comida${sinCarbos ? " sin-carbos" : ""}">
    <h2><span class="emoji">${emoji}</span>${titulo}${badge}</h2>${cuerpo}</div>`;
}

function bannerPreview(datos, esPreview) {
  const bannerEl = document.getElementById("banner");
  bannerEl.innerHTML = esPreview
    ? `<div class="preview-bar">👀 Estás viendo otro día
         <button id="volver-hoy" type="button">Volver a hoy</button></div>`
    : "";
  const volver = document.getElementById("volver-hoy");
  if (volver) volver.addEventListener("click", () => {
    vistaFecha = null; setupAbierto = false; borrador = null;
    document.getElementById("ver-otro").hidden = true;
    render(datos);
  });
}

// ---- controles ----
function initVerOtro(datos) {
  const btn = document.getElementById("btn-ver");
  const panel = document.getElementById("ver-otro");
  const input = document.getElementById("ver-fecha");
  btn.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  input.addEventListener("change", () => {
    if (input.value) {
      vistaFecha = input.value; setupAbierto = false; borrador = null;
      render(datos);
    }
  });
}

function initAjustes(datos) {
  const btn = document.getElementById("btn-ajustes");
  const panel = document.getElementById("ajustes");
  const input = document.getElementById("inicio");
  input.value = getFechaInicio(datos) || "";
  btn.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  document.getElementById("guardar").addEventListener("click", () => {
    if (input.value) {
      localStorage.setItem("fechaInicio", input.value);
      panel.hidden = true;
      render(datos);
    }
  });
  document.getElementById("reset").addEventListener("click", () => {
    localStorage.removeItem("fechaInicio");
    input.value = datos.fechaInicio || "";
    panel.hidden = true;
    render(datos);
  });
}

fetch("menu.json")
  .then(r => r.json())
  .then(datos => { render(datos); initVerOtro(datos); initAjustes(datos); })
  .catch(() => {
    document.getElementById("titulo-dia").textContent = "Error";
    document.getElementById("contenido").innerHTML =
      `<div class="aviso">No pude cargar el menú (menu.json).</div>`;
  });
