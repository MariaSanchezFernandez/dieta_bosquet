# ¿Qué como hoy? 🥗

Mini-web que te dice qué comer hoy según tu dieta de Nutrición Bosquet.
Calcula sola en qué semana del ciclo estás y alterna entre los dos PDFs
(Semana 1 y 3 / Semana 2 y 4).

## Cómo se usa cada día
Abres la web (o el acceso directo del móvil). Si es la primera vez que entras
esa semana, te pide **tus 2 entrenos Z2**: qué día y si por la mañana o por
la tarde (botones grandes, prerrellenado con Martes tarde + Viernes mañana,
cámbialo si hace falta). Pulsas **«Guardar y ver hoy»** y ya está: la app
coloca sola qué menú va cada día para que el plato **🔶 ya diseñado sin
carbohidratos** caiga donde lo necesitas, sin que tengas que tocar nada más.

Ya en el día a día ves desayuno, almuerzo y cena, con **🔶 sin carbos** en las
comidas que toquen. Los domingos marca "día libre".

Si algún día vas a comer otra cosa (has quedado fuera, te apetece cambiar),
usa **«✏️ Editar esta semana»**: ahí puedes tocar los entrenos y, en «🍽️ Qué
menú comes cada día», cada fila muestra ya el **plato real** de la comida y
la cena de ese día (no solo el nombre del día). Pulsa **Cambiar** para ver
las 6 opciones con su plato y fecha, elige una o dale a **Cancelar** para
dejarlo como estaba. Hay también un botón **«🔄 Recalcular según mis
entrenos»** para volver a la sugerencia automática si lo lías.

- **Ver otro día**: botón abajo para mirar qué toca cualquier fecha (si esa
  semana no está configurada, te la pide igual que la de hoy).
- **Ajustes**: ahí cambias la fecha de inicio cuando empieza una dieta nueva.
  (Todo se guarda en tu navegador/móvil, no hace falta tocar nada más.)

## Cuando te dan una dieta nueva (cada mes)
1. Doble clic en **`Actualizar dieta.command`**. Te guía paso a paso:
   - Te pide el PDF nuevo de "Semana 1 y 3": **arrástralo desde el Finder a la
     ventana** y pulsa Enter (déjalo vacío si quieres mantener el actual).
   - Lo mismo con el de "Semana 2 y 4".
   - Te avisa de qué PDFs antiguos va a **BORRAR** (es **IRREVERSIBLE**, no van
     a la papelera): tienes que escribir `BORRAR` para confirmar.
   - **Escanea** los PDFs nuevos y te pide el lunes en que empiezas.
   - Si un PDF está escaneado como imagen (sin texto), te avisa y no toca nada.
   - **Ojo**: el escáner automático (`pdftotext`) lee los platos y los dos
     desayunos, pero **no puede ver el color naranja** del PDF (es una imagen,
     no texto). Ese dato —qué comida de cada día es la diseñada sin
     carbohidratos— hay que pasármelo a mano (mándame capturas de la tabla del
     menú semanal, como hicimos la primera vez) para que lo añada al
     `menu.json` (campo `naranja` de cada día).
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

## Nota técnica: caché
GitHub Pages guarda `app.js`/`styles.css` en caché hasta 10 minutos, y el
móvil puede tardar en refrescarlos aunque el cambio ya esté publicado. Por
eso `index.html` los referencia con `?v=AAAAMMDDx` (p.ej. `?v=20260724a`):
**cada vez que se cambie `app.js` o `styles.css`, hay que subir también ese
número en `index.html`** para forzar que el móvil los recargue. Si algo se
ve raro tras una actualización, primero cierra del todo la app en el móvil
(quitarla del multitarea) y vuelve a abrirla.
