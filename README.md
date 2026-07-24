# ¿Qué como hoy? 🥗

Mini-web que te dice qué comer hoy según tu dieta de Nutrición Bosquet.
Calcula sola en qué semana del ciclo estás y alterna entre los dos PDFs
(Semana 1 y 3 / Semana 2 y 4).

## Cómo se usa cada día
Abres la web (o el acceso directo del móvil). Si es la primera vez que entras
esa semana, te pide **configurarla** (una sola vez por semana):

1. **Tus 2 entrenos Z2** de esa semana: qué día y si por la mañana o por la
   tarde (prerrellenado con Martes tarde + Viernes mañana, pero lo puedes
   cambiar libremente).
2. **Qué menú comes cada día**: un desplegable por cada día (Lunes…Sábado)
   donde eliges cuál de los 6 menús del PDF quieres comer ese día —por
   defecto viene ya colocado para que el plato **🔶 ya diseñado sin
   carbohidratos** caiga justo el día que lo necesitas según tus entrenos,
   pero puedes reordenarlo a mano como quieras—. Cada opción muestra su fecha
   y, si tiene, la etiqueta 🔶 comida / 🔶 cena.

Guardas y ya te muestra el día de hoy: desayuno, almuerzo y cena, con **🔶 sin
carbos** en las comidas que toquen (calculado a partir de tus entrenos: por
la mañana pide sin carbos la cena de la víspera; por la tarde, la comida de
ese mismo día). Los domingos marca "día libre".

Para cambiar algo de una semana ya configurada, usa el botón
**«✏️ Editar esta semana»** que aparece en el día a día.

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
