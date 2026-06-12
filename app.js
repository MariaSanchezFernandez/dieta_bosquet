"use strict";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// fecha local a medianoche (evita líos de zona horaria)
function aMedianoche(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseFecha(str) {
  const [a, m, d] = str.split("-").map(Number);
  return new Date(a, m - 1, d);
}
// lunes de la semana que contiene la fecha
function lunesDe(d) {
  const x = aMedianoche(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  return x;
}

function getFechaInicio(datos) {
  return localStorage.getItem("fechaInicio") || datos.fechaInicio;
}

let vistaFecha = null; // fecha en modo "ver otro día" (null = hoy)

function render(datos) {
  const override = vistaFecha || new URLSearchParams(location.search).get("fecha");
  const esPreview = !!vistaFecha;
  const hoy = override ? aMedianoche(parseFecha(override)) : aMedianoche(new Date());
  const inicioStr = getFechaInicio(datos);
  const cont = document.getElementById("contenido");

  const bannerEl = document.getElementById("banner");
  bannerEl.innerHTML = esPreview
    ? `<div class="preview-bar">👀 Estás viendo otro día
         <button id="volver-hoy" type="button">Volver a hoy</button></div>`
    : "";
  const volver = document.getElementById("volver-hoy");
  if (volver) volver.addEventListener("click", () => {
    vistaFecha = null;
    document.getElementById("ver-otro").hidden = true;
    render(datos);
  });

  document.getElementById("fecha").textContent =
    `${DIAS[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  if (!inicioStr) {
    document.getElementById("titulo-dia").textContent = "Falta la fecha";
    cont.innerHTML = `<div class="aviso">Abre <b>Ajustes</b> e indica el lunes en que empezaste la dieta.</div>`;
    return;
  }

  const inicio = lunesDe(parseFecha(inicioStr));

  // ¿aún no ha empezado?
  if (hoy < inicio) {
    document.getElementById("titulo-dia").textContent = "Aún no empieza";
    document.getElementById("semana").textContent = "";
    const f = parseFecha(inicioStr);
    cont.innerHTML = `<div class="aviso">Esta dieta empieza el <b>${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}</b>. ¡Disfruta hasta entonces!</div>`;
    return;
  }

  const semanasPasadas = Math.floor((hoy - inicio) / (7 * 86400000));
  const idx = semanasPasadas % 4;            // 0..3
  const numSemana = idx + 1;                 // 1..4
  const clave = idx % 2 === 0 ? "1y3" : "2y4";

  document.getElementById("semana").textContent =
    `Semana ${numSemana} · plan «${clave === "1y3" ? "1 y 3" : "2 y 4"}»`;

  const nombreDia = DIAS[hoy.getDay()];
  document.getElementById("titulo-dia").textContent = nombreDia;

  // Domingo = día libre
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

  const dia = datos.semanas[clave][nombreDia];
  const c = datos.comun;
  const lista = (arr) => "<ul>" + arr.map(x => `<li>${x}</li>`).join("") + "</ul>";

  cont.innerHTML = `
    ${c.alLevantarte ? tarjeta("🌅", "Al levantarte", `<p>${c.alLevantarte}</p>`) : ""}
    ${c.desayuno ? tarjeta("☕", "Desayuno", `<p>${c.desayuno}</p>`) : ""}
    ${tarjeta("🍽️", "Almuerzo", listaOpciones(dia.almuerzo, lista))}
    ${c.merienda ? tarjeta("🍎", "Merienda", `<p>${c.merienda}</p>`) : ""}
    ${tarjeta("🌙", "Cena", listaOpciones(dia.cena, lista))}
  `;
}

function listaOpciones(arr, lista) {
  if (!arr || arr.length === 0) return "<p>—</p>";
  let html = lista(arr);
  if (arr.length > 1) html += `<p class="opciones">Los platos del mismo bloque se acompañan entre sí.</p>`;
  return html;
}

function tarjeta(emoji, titulo, cuerpo) {
  return `<div class="comida"><h2><span class="emoji">${emoji}</span>${titulo}</h2>${cuerpo}</div>`;
}

function initVerOtro(datos) {
  const btn = document.getElementById("btn-ver");
  const panel = document.getElementById("ver-otro");
  const input = document.getElementById("ver-fecha");
  btn.addEventListener("click", () => { panel.hidden = !panel.hidden; });
  input.addEventListener("change", () => {
    if (input.value) { vistaFecha = input.value; render(datos); }
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
