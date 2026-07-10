"use strict";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_LAB = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

let vistaFecha = null;      // "ver otro día" (null = hoy)
let editorAbierto = false;  // panel de configurar entrenos abierto
let entrenosDefecto = [];   // config por defecto (de menu.json)

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

// ---- entrenos de la semana en localStorage ----
// Cada entreno: {dia: 1..6 (Lun..Sáb), momento: "manana"|"tarde"}
function claveSemana(d) {
  return "entrenos-" + clave(lunesDe(d));
}
function getEntrenos(d) {
  const raw = localStorage.getItem(claveSemana(d));
  if (raw === null) return entrenosDefecto;   // semana sin configurar -> por defecto
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}
function setEntrenos(d, arr) {
  localStorage.setItem(claveSemana(d), JSON.stringify(arr));
}
function getFechaInicio(datos) {
  return localStorage.getItem("fechaInicio") || datos.fechaInicio;
}

// El PDF diseña un plato ya bajo en carbohidratos en días concretos
// (campo "naranja" de cada día). En vez de romper la pareja comida+cena de
// un mismo día, se reordena qué día completo (desayuno+comida+cena, tal
// cual lo diseñó la nutricionista) se sirve cada día real de la semana, para
// que ese plato caiga solo donde se necesita. Ver "ordenDias" en menu.json.
function diaFuente(datos, nombreDiaReal) {
  const orden = datos.ordenDias || DIAS_LAB;
  const i = DIAS_LAB.indexOf(nombreDiaReal);
  return orden[i] || nombreDiaReal;
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

  const semanasPasadas = Math.floor((hoy - inicio) / (7 * 86400000));
  const idx = semanasPasadas % 4;
  const clavePlan = idx % 2 === 0 ? "1y3" : "2y4";
  document.getElementById("semana").textContent =
    `Semana ${idx + 1} · plan «${clavePlan === "1y3" ? "1 y 3" : "2 y 4"}»`;

  const nombreDia = DIAS[hoy.getDay()];
  document.getElementById("titulo-dia").textContent = nombreDia;

  if (hoy.getDay() === 0) {
    cont.innerHTML = diaLibre(hoy);
    enlazarEntrenos(datos, hoy);
    return;
  }

  cont.innerHTML = tarjetasDelDia(datos, hoy, clavePlan, nombreDia);
  enlazarEntrenos(datos, hoy);
}

function diaLibre(hoy) {
  // aviso si mañana (lunes) hay entreno matutino
  const ent = getEntrenos(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1));
  const avisoLunes = ent.some(e => e.dia === 1 && e.momento === "manana")
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

// Qué comidas deben ir sin carbos hoy, según el entreno Z2 configurado.
function calcularComidas(diaOriginal, hoy) {
  const dow = hoy.getDay();
  const ent = getEntrenos(hoy);
  const sesionHoy = ent.find(e => e.dia === dow) || null;
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const entManana = getEntrenos(manana);
  const necesitaCena = entManana.some(e => e.dia === manana.getDay() && e.momento === "manana");
  const necesitaAlmuerzo = !!(sesionHoy && sesionHoy.momento === "tarde");
  const desayunoSin = !!sesionHoy;

  return {
    almuerzo: diaOriginal.almuerzo,
    cena: diaOriginal.cena,
    necesitaAlmuerzo,
    necesitaCena,
    desayunoSin,
    // gracias al reordenamiento de días (ordenDias), lo normal es que el
    // plato ya diseñado sin carbos ("naranja") coincida directamente;
    // si algún día no coincide (p.ej. tras editar los entrenos), se avisa
    // con la instrucción genérica en vez de romper la pareja comida+cena.
    disenadoAlmuerzo: necesitaAlmuerzo && diaOriginal.naranja === "almuerzo",
    disenadoCena: necesitaCena && diaOriginal.naranja === "cena",
    sesionHoy,
  };
}

function tarjetasDelDia(datos, hoy, clavePlan, nombreDiaReal) {
  const nombreDiaFuente = diaFuente(datos, nombreDiaReal);
  const diaOriginal = datos.semanas[clavePlan][nombreDiaFuente];
  const c = datos.comun;
  const r = calcularComidas(diaOriginal, hoy);

  const desayunoTexto = r.desayunoSin ? c.desayunoSinCHO : c.desayunoConCHO;
  const listaHTML = (arr) => "<ul>" + arr.map(x => `<li>${x}</li>`).join("") + "</ul>";

  const avisoMenu = nombreDiaFuente !== nombreDiaReal
    ? `<p class="aviso-menu">📋 Hoy comes el menú de <b>${nombreDiaFuente}</b> (reordenado para que el plato sin carbos caiga en su sitio).</p>`
    : "";

  const bloques = [
    panelEntrenos(hoy, r),
    avisoMenu,
    c.alLevantarte ? tarjeta("🌅", "Al levantarte", `<p>${c.alLevantarte}</p>`, false) : "",
    tarjeta("☕", "Desayuno", `<p>${desayunoTexto}</p>`, r.desayunoSin),
    tarjeta("🍽️", "Almuerzo", opciones(r.almuerzo, listaHTML), r.necesitaAlmuerzo),
    c.merienda ? tarjeta("🍎", "Merienda", `<p>${c.merienda}</p>`, false) : "",
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

// ---- panel de entrenos de la semana ----
function panelEntrenos(hoy, r) {
  const ent = getEntrenos(hoy);
  let notaHoy;
  if (r.sesionHoy) {
    notaHoy = `Hoy entrenas Z2 ${r.sesionHoy.momento === "manana" ? "🌅 por la mañana" : "🌇 por la tarde"}.`;
  } else if (r.necesitaCena) {
    notaHoy = "Hoy no entrenas, pero mañana sí por la mañana.";
  } else {
    notaHoy = "Hoy no entrenas.";
  }

  if (!editorAbierto) {
    const resumen = ent.length
      ? ent.map(e => `${DIAS_LAB[e.dia - 1]} ${e.momento === "manana" ? "🌅" : "🌇"}`).join(" · ")
      : "Sin definir todavía";
    return `<div class="entreno">
      <p class="preg">🏃 Entrenos Z2 de esta semana</p>
      <p class="resumen">${resumen}</p>
      <p class="nota-hoy">${notaHoy}</p>
      <button type="button" data-ent="toggle">${ent.length ? "Editar" : "Configurar"}</button>
    </div>`;
  }
  return `<div class="entreno">
    <p class="preg">🏃 Tus 2 entrenos Z2 de esta semana</p>
    ${slotEntreno(0, ent[0])}
    ${slotEntreno(1, ent[1])}
    <div class="ent-acciones">
      <button type="button" data-ent="guardar">Guardar</button>
      <button type="button" data-ent="toggle" class="secundario">Cancelar</button>
    </div>
  </div>`;
}

function slotEntreno(i, e) {
  const cur = e || {};
  const dias = ['<option value="">— sin entreno —</option>']
    .concat(DIAS_LAB.map((d, idx) =>
      `<option value="${idx + 1}" ${cur.dia === idx + 1 ? "selected" : ""}>${d}</option>`))
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

function enlazarEntrenos(datos, hoy) {
  document.querySelectorAll("[data-ent]").forEach(b => {
    b.addEventListener("click", () => {
      const accion = b.dataset.ent;
      if (accion === "toggle") {
        editorAbierto = !editorAbierto;
        render(datos);
      } else if (accion === "guardar") {
        const arr = [];
        [0, 1].forEach(i => {
          const dia = Number(document.querySelector(`.ent-dia[data-i="${i}"]`).value);
          const momento = document.querySelector(`.ent-mom[data-i="${i}"]`).value;
          if (dia) arr.push({ dia, momento });
        });
        setEntrenos(hoy, arr);
        editorAbierto = false;
        render(datos);
      }
    });
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
    vistaFecha = null; editorAbierto = false;
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
    if (input.value) { vistaFecha = input.value; editorAbierto = false; render(datos); }
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
  .then(datos => {
    entrenosDefecto = datos.entrenosPorDefecto || [];
    render(datos); initVerOtro(datos); initAjustes(datos);
  })
  .catch(() => {
    document.getElementById("titulo-dia").textContent = "Error";
    document.getElementById("contenido").innerHTML =
      `<div class="aviso">No pude cargar el menú (menu.json).</div>`;
  });
