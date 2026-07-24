"use strict";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_LAB = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

let vistaFecha = null;    // "ver otro día" (null = hoy)
let setupAbierto = false; // pantalla de configurar/editar semana visible
let borrador = null;      // config en edición mientras esa pantalla está abierta
let filaExpandida = null; // índice (0..5) de la fila "qué como cada día" abierta para cambiarla

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
function fechaCorta(f) {
  return `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}`;
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
    if (!borrador) abrirBorrador(datos, cfg);
    document.getElementById("titulo-dia").textContent = cfg ? "Editar semana" : "Configurar semana";
    cont.innerHTML = pantallaSetup(datos, hoy, plan, !cfg);
    enlazarSetup(datos, hoy, plan, !cfg);
    return;
  }

  const nombreDia = DIAS[hoy.getDay()];
  document.getElementById("titulo-dia").textContent = nombreDia;

  if (hoy.getDay() === 0) {
    cont.innerHTML = diaLibre(hoy);
    return;
  }

  cont.innerHTML = tarjetasDelDia(datos, hoy, plan, nombreDia, cfg);
  enlazarEditarSemana(datos, hoy, cfg);
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

// ================= configurar / editar semana =================

function abrirBorrador(datos, cfgExistente) {
  const base = cfgExistente
    ? cfgExistente.entrenos.map(e => ({ ...e }))
    : (datos.entrenosPorDefecto || []).map(e => ({ ...e }));
  while (base.length < 2) base.push({});
  const orden = cfgExistente ? [...cfgExistente.orden] : [...DIAS_LAB];
  borrador = { entrenos: base.slice(0, 2), orden };
  filaExpandida = null;
}

// Ajusta "orden" para que, según los entrenos, el plato ya diseñado sin
// carbohidratos (campo "naranja") caiga en el día que se necesita —
// intercambiando esa posición con otro día que sí lo tenga (nunca copiando,
// para no repetir el mismo menú dos veces en la semana). Es solo una
// sugerencia automática; se puede corregir a mano después.
function autoOrdenar(datos, plan, entrenos, ordenBase) {
  const orden = [...ordenBase];
  const dias = datos.semanas[plan];
  const needsAlmuerzo = new Array(6).fill(false);
  const needsCena = new Array(6).fill(false);
  entrenos.forEach(e => {
    if (!e || !e.dia || !e.momento) return;
    const i = e.dia - 1;
    if (e.momento === "tarde") needsAlmuerzo[i] = true;
    else if (e.momento === "manana" && i > 0) needsCena[i - 1] = true;
  });

  const indiceParaIntercambiar = (meal, excluir) => {
    // preferir una posición que no tenga a su vez otra necesidad propia
    for (let j = 0; j < 6; j++) {
      if (j === excluir || needsAlmuerzo[j] || needsCena[j]) continue;
      if (dias[orden[j]].naranja === meal) return j;
    }
    for (let j = 0; j < 6; j++) {
      if (j === excluir) continue;
      if (dias[orden[j]].naranja === meal) return j;
    }
    return -1;
  };

  for (let i = 0; i < 6; i++) {
    if (needsAlmuerzo[i] && dias[orden[i]].naranja !== "almuerzo") {
      const j = indiceParaIntercambiar("almuerzo", i);
      if (j !== -1) [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    if (needsCena[i] && dias[orden[i]].naranja !== "cena") {
      const j = indiceParaIntercambiar("cena", i);
      if (j !== -1) [orden[i], orden[j]] = [orden[j], orden[i]];
    }
  }
  return orden;
}

function fechasDeLaSemana(hoy) {
  const lunes = lunesDe(hoy);
  return DIAS_LAB.map((_, i) =>
    fechaCorta(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i)));
}

function pantallaSetup(datos, hoy, plan, esNueva) {
  const fechasDia = fechasDeLaSemana(hoy);
  const slots = [0, 1].map(i => slotEntreno(i, borrador.entrenos[i], fechasDia)).join("");

  if (esNueva) {
    return `<div class="setup">
      <h2>🏃 Tus 2 entrenos Z2 esta semana</h2>
      <p class="setup-ayuda">Colocamos solos el plato sin carbos donde toque. Si algún día quieres cambiar qué menú comes, podrás hacerlo luego en «Editar esta semana».</p>
      ${slots}
      <div class="setup-acciones">
        <button type="button" data-setup="guardar-nueva">Guardar y ver hoy</button>
      </div>
    </div>`;
  }

  const filas = DIAS_LAB.map((diaReal, i) => filaMenuDia(datos, plan, i, fechasDia)).join("");
  return `<div class="setup">
    <h2>🏃 Tus 2 entrenos Z2 esta semana</h2>
    ${slots}

    <h2>🍽️ Qué menú comes cada día</h2>
    <p class="setup-ayuda">Ya está colocado el plato sin carbos donde toca. Cambia cualquier día si vas a comer otra cosa.</p>
    ${filas}

    <div class="setup-acciones">
      <button type="button" data-setup="recalcular" class="secundario">🔄 Recalcular según mis entrenos</button>
      <button type="button" data-setup="guardar">Guardar cambios</button>
    </div>
  </div>`;
}

function filaMenuDia(datos, plan, i, fechasDia) {
  const dias = datos.semanas[plan];
  const diaReal = DIAS_LAB[i];
  const actual = borrador.orden[i];
  const tagActual = etiquetaTag(dias[actual]);

  if (filaExpandida !== i) {
    return `<div class="menu-fila">
      <div class="menu-fila-info">
        <span class="menu-fila-dia">${diaReal}<span class="pill-fecha">${fechasDia[i]}</span></span>
        <span class="menu-fila-actual">Come: <b>${actual}</b>${tagActual}</span>
      </div>
      <button type="button" class="cambiar" data-expandir="${i}">Cambiar</button>
    </div>`;
  }

  const opciones = DIAS_LAB.map((fuente, j) => {
    const sel = actual === fuente ? " sel" : "";
    return `<button type="button" class="pill pill-menu${sel}" data-menu-fila="${i}" data-menu-dia="${fuente}">
      ${fuente} <span class="pill-fecha">${fechasDia[j]}</span>${etiquetaTag(dias[fuente])}</button>`;
  }).join("");
  return `<div class="menu-fila menu-fila-abierta">
    <span class="menu-fila-dia">${diaReal}<span class="pill-fecha">${fechasDia[i]}</span></span>
    <div class="pills pills-menu">${opciones}</div>
  </div>`;
}

function etiquetaTag(dia) {
  if (!dia || !dia.naranja) return "";
  return dia.naranja === "almuerzo" ? ` <span class="tag">🔶 comida</span>` : ` <span class="tag">🔶 cena</span>`;
}

function slotEntreno(i, e, fechasDia) {
  const cur = e || {};
  const diaBtns = DIAS_LAB.map((d, idx) => {
    const n = idx + 1;
    const sel = cur.dia === n ? " sel" : "";
    return `<button type="button" class="pill${sel}" data-slot="${i}" data-campo="dia" data-valor="${n}">
      ${d}<span class="pill-fecha">${fechasDia[idx]}</span></button>`;
  }).join("");
  const momBtns = [["manana", "🌅 Mañana"], ["tarde", "🌇 Tarde"]].map(([val, label]) => {
    const sel = cur.momento === val ? " sel" : "";
    return `<button type="button" class="pill pill-momento${sel}" data-slot="${i}" data-campo="momento" data-valor="${val}">${label}</button>`;
  }).join("");
  const quitar = cur.dia
    ? `<button type="button" class="quitar" data-slot="${i}" data-campo="quitar">Quitar este entreno</button>`
    : "";
  return `<div class="entreno-slot">
    <p class="slot-titulo">Entreno ${i + 1}</p>
    <div class="pills">${diaBtns}</div>
    ${cur.dia ? `<div class="pills pills-momento">${momBtns}</div>` : ""}
    ${quitar}
  </div>`;
}

function guardarConfig(datos, hoy, orden) {
  const cfg = {
    entrenos: borrador.entrenos.filter(e => e && e.dia && e.momento),
    orden,
  };
  setConfigSemana(hoy, cfg);
  setupAbierto = false;
  borrador = null;
  filaExpandida = null;
  render(datos);
}

function enlazarSetup(datos, hoy, plan, esNueva) {
  document.querySelectorAll(".pill[data-slot]").forEach(b => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.slot);
      const campo = b.dataset.campo;
      const actual = borrador.entrenos[i] || {};
      if (campo === "dia") {
        borrador.entrenos[i] = { dia: Number(b.dataset.valor), momento: actual.momento || "manana" };
      } else if (campo === "momento") {
        borrador.entrenos[i] = { dia: actual.dia, momento: b.dataset.valor };
      }
      render(datos);
    });
  });
  document.querySelectorAll(".quitar[data-slot]").forEach(b => {
    b.addEventListener("click", () => {
      borrador.entrenos[Number(b.dataset.slot)] = {};
      render(datos);
    });
  });

  const guardarNueva = document.querySelector('[data-setup="guardar-nueva"]');
  if (guardarNueva) guardarNueva.addEventListener("click", () => {
    const orden = autoOrdenar(datos, plan, borrador.entrenos, [...DIAS_LAB]);
    guardarConfig(datos, hoy, orden);
  });

  document.querySelectorAll("[data-expandir]").forEach(b => {
    b.addEventListener("click", () => {
      filaExpandida = Number(b.dataset.expandir);
      render(datos);
    });
  });
  document.querySelectorAll(".pill-menu[data-menu-fila]").forEach(b => {
    b.addEventListener("click", () => {
      borrador.orden[Number(b.dataset.menuFila)] = b.dataset.menuDia;
      filaExpandida = null;
      render(datos);
    });
  });

  const recalcular = document.querySelector('[data-setup="recalcular"]');
  if (recalcular) recalcular.addEventListener("click", () => {
    borrador.orden = autoOrdenar(datos, plan, borrador.entrenos, [...DIAS_LAB]);
    render(datos);
  });

  const guardar = document.querySelector('[data-setup="guardar"]');
  if (guardar) guardar.addEventListener("click", () => {
    guardarConfig(datos, hoy, [...borrador.orden]);
  });
}

function enlazarEditarSemana(datos, hoy, cfg) {
  const btn = document.querySelector("[data-editar-semana]");
  if (btn) btn.addEventListener("click", () => {
    abrirBorrador(datos, cfg);
    setupAbierto = true;
    render(datos);
  });
}

// ================= tarjetas de comida =================

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
    vistaFecha = null; setupAbierto = false; borrador = null; filaExpandida = null;
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
      vistaFecha = input.value; setupAbierto = false; borrador = null; filaExpandida = null;
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
