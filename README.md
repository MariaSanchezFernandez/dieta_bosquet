# ¿Qué como hoy? 🥗

Mini-web que te dice qué comer hoy según tu dieta de Nutrición Bosquet.
Calcula sola en qué semana del ciclo estás y alterna entre los dos PDFs
(Semana 1 y 3 / Semana 2 y 4).

## Cómo se usa cada día
Abres la web (o el acceso directo del móvil) y te muestra desayuno, almuerzo,
merienda y cena de hoy. Los domingos marca "día libre".

- **Entreno Zona 2**: cada día te pregunta si entrenas en Z2 y cuándo
  (No / Por la mañana / Por la tarde). Según tu respuesta marca qué comidas van
  **🔶 sin carbos** y qué desayuno usar:
  - **Z2 por la mañana** → desayuno sin CHO (yogur) + cena sin carbos.
  - **Z2 por la tarde** → desayuno sin CHO (yogur) + comida sin carbos.
  - **Sin entreno** → todo normal (con CHO).

  Esto reproduce el naranja del PDF: cena naranja = día de entreno por la
  mañana; comida naranja = día de entreno por la tarde.
  Cuando registras tus **2 entrenos Z2** de la semana, deja de preguntar hasta
  el lunes siguiente.
- **Ver otro día**: botón abajo para mirar qué toca cualquier fecha.
- **Ajustes**: ahí cambias la fecha de inicio cuando empieza una dieta nueva.
  (Se guarda en tu navegador/móvil, no hace falta tocar nada más.)

## Cuando te dan una dieta nueva (cada mes)
1. Doble clic en **`Actualizar dieta.command`**. Te guía paso a paso:
   - Te pide el PDF nuevo de "Semana 1 y 3": **arrástralo desde el Finder a la
     ventana** y pulsa Enter (déjalo vacío si quieres mantener el actual).
   - Lo mismo con el de "Semana 2 y 4".
   - Te avisa de qué PDFs antiguos va a **BORRAR** (es **IRREVERSIBLE**, no van
     a la papelera): tienes que escribir `BORRAR` para confirmar.
   - **Escanea** los PDFs nuevos y te pide el lunes en que empiezas.
   - Si un PDF está escaneado como imagen (sin texto), te avisa y no toca nada.
   - **Ojo**: el escáner lee los platos y los dos desayunos, pero **no ve el
     color naranja** del PDF. La app no lo necesita (usa tu entreno Z2 para
     decidir qué va sin carbos). Si en el futuro cambia la lógica de la dieta,
     avísame para adaptarla.
2. Sube los cambios a GitHub:
   ```
   git add -A && git commit -m "Actualizar dieta" && git push
   ```
3. (Opcional) En el móvil también puedes cambiar solo la fecha desde *Ajustes*.

## Publicar en GitHub Pages (una sola vez)
1. Crea un repositorio en https://github.com/new (puede ser **privado** si no
   quieres que tu menú sea público; Pages en repos privados necesita cuenta Pro).
2. Conéctalo y sube:
   ```
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
3. En el repo → **Settings → Pages → Source: `main` / root** → Save.
4. A los pocos minutos tendrás una URL `https://TU_USUARIO.github.io/TU_REPO/`.

## Acceso directo en el móvil
- **iPhone (Safari)**: abre la URL → botón Compartir → "Añadir a pantalla de inicio".
- **Android (Chrome)**: abre la URL → menú ⋮ → "Añadir a pantalla de inicio".

## Privacidad
Los PDFs **no se suben** (están en `.gitignore`, contienen tus datos personales).
Sí se sube `menu.json`, que tiene solo los nombres de los platos.

## Requisitos para actualizar (solo en tu Mac)
- `poppler` (`brew install poppler`) — ya instalado.
- Python 3 — ya disponible.
