"use strict";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ENTRENOS_SEMANA = 2; // sesiones de Zona 2 por semana

let vistaFecha = null;      // "ver otro día" (null = hoy)
let forzarSelector = false; // mostrar el selector aunque ya estén hechas las 2

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
function diasDeLaSemana(d) {
  const l = lunesDe(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(l);
    x.setDate(l.getDate() + i);
    return clave(x);
  });
}

// ---- entreno Z2 en localStorage ----
function getZ2(fechaKey) {
  return localStorage.getItem("z2-" + fechaKey) || "no";
}
function setZ2(fechaKey, valor) {
  localStorage.setItem("z2-" + fechaKey, valor);
}
function getFechaInicio(datos) {
  return localStorage.getItem("fechaInicio") || datos.fechaInicio;
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
  const numSemana = idx + 1;
  const clavePlan = idx % 2 === 0 ? "1y3" : "2y4";
  document.getElementById("semana").textContent =
    `Semana ${numSemana} · plan «${clavePlan === "1y3" ? "1 y 3" : "2 y 4"}»`;

  const nombreDia = DIAS[hoy.getDay()];
  document.getElementById("titulo-dia").textContent = nombreDia;

  if (hoy.getDay() === 0) {
    cont.innerHTML = `
      <div class="libre">
        <span class="emoji">🎉</span>
        <h2>Día libre</h2>
        <p>Hoy toca «vida social»: come con consciencia y sin atracones,
        disfrutando eso que te ha apetecido durante la semana. Prioriza opciones de calidad.</p>
      </div>`;
    return;
  }

  cont.innerHTML = tarjetasDelDia(datos, hoy, clavePlan, nombreDia);
  enlazarSelector(datos);
}

function tarjetasDelDia(datos, hoy, clavePlan, nombreDia) {
  const dia = datos.semanas[clavePlan][nombreDia];
  const c = datos.comun;
  const hoyKey = clave(hoy);
  const z2 = getZ2(hoyKey);

  // ¿qué comidas van sin carbos, según la regla de entreno?
  // Entreno Z2 -> desayuno sin CHO siempre; mañana quita la cena, tarde la comida.
  const entrena = z2 === "manana" || z2 === "tarde";
  const desayunoSin = entrena;
  const almuerzoSin = z2 === "tarde";
  const cenaSin = z2 === "manana";

  const desayunoTexto = desayunoSin ? c.desayunoSinCHO : c.desayunoConCHO;
  const listaHTML = (arr) => "<ul>" + arr.map(x => `<li>${x}</li>`).join("") + "</ul>";

  const bloques = [
    selectorEntreno(hoy),
    c.alLevantarte ? tarjeta("🌅", "Al levantarte", `<p>${c.alLevantarte}</p>`, false) : "",
    tarjeta("☕", "Desayuno", `<p>${desayunoTexto}</p>`, desayunoSin),
    tarjeta("🍽️", "Almuerzo", opciones(dia.almuerzo, listaHTML), almuerzoSin),
    c.merienda ? tarjeta("🍎", "Merienda", `<p>${c.merienda}</p>`, false) : "",
    tarjeta("🌙", "Cena", opciones(dia.cena, listaHTML), cenaSin),
  ];
  const leyenda = (desayunoSin || almuerzoSin || cenaSin)
    ? `<p class="leyenda">🔶 <b>Sin carbos</b>: prescinde del hidrato (arroz, patata, pasta, quinoa, pan, legumbre) en ese plato.</p>`
    : "";
  return bloques.join("") + leyenda;
}

function selectorEntreno(hoy) {
  const hoyKey = clave(hoy);
  const semana = diasDeLaSemana(hoy);
  const hechos = semana.filter(k => getZ2(k) !== "no").length;
  const z2 = getZ2(hoyKey);
  const hoyEsEntreno = z2 !== "no";
  const completados = hechos >= ENTRENOS_SEMANA && !hoyEsEntreno && !forzarSelector;

  if (completados) {
    return `<div class="entreno hecho">
      <p>💪 Ya has registrado tus <b>${ENTRENOS_SEMANA} entrenos Z2</b> de esta semana. Descansa.</p>
      <button type="button" data-z2="__abrir">¿Entrenas hoy igualmente?</button>
    </div>`;
  }

  const restantes = Math.max(0, ENTRENOS_SEMANA - hechos + (hoyEsEntreno ? 1 : 0));
  const btn = (val, txt) =>
    `<button type="button" data-z2="${val}" class="${z2 === val ? "sel" : ""}">${txt}</button>`;
  return `<div class="entreno">
    <p class="preg">¿Entrenas hoy en Zona 2? <span class="cont">(${restantes} por hacer esta semana)</span></p>
    <div class="ops">
      ${btn("no", "No entreno")}
      ${btn("manana", "🌅 Por la mañana")}
      ${btn("tarde", "🌇 Por la tarde")}
    </div>
  </div>`;
}

function enlazarSelector(datos) {
  document.querySelectorAll(".entreno [data-z2]").forEach(b => {
    b.addEventListener("click", () => {
      const val = b.getAttribute("data-z2");
      if (val === "__abrir") { forzarSelector = true; render(datos); return; }
      const hoy = vistaFecha
        ? aMedianoche(parseFecha(vistaFecha))
        : aMedianoche(new Date());
      setZ2(clave(hoy), val);
      forzarSelector = false;
      render(datos);
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
    vistaFecha = null; forzarSelector = false;
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
    if (input.value) { vistaFecha = input.value; forzarSelector = false; render(datos); }
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
