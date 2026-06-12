#!/bin/bash
# Doble clic para regenerar el menú a partir de los PDFs de la carpeta "Dietas".
# Te pedirá la fecha (lunes) en que empiezas la nueva dieta.

cd "$(dirname "$0")" || exit 1

echo "================================================"
echo "   Actualizar dieta — Nutrición Bosquet"
echo "================================================"
echo
echo "PDFs encontrados en la carpeta Dietas:"
ls -1 Dietas/*.pdf 2>/dev/null | sed 's#Dietas/#  - #'
echo

read -r -p "¿Lunes en que empieza esta dieta? (AAAA-MM-DD, Enter = mantener la actual): " FECHA

if [ -n "$FECHA" ]; then
  python3 parse_dietas.py Dietas "$FECHA"
else
  python3 parse_dietas.py Dietas
fi

echo
echo "Listo. Si usas GitHub, ahora sube los cambios:"
echo "   git add -A && git commit -m \"Actualizar dieta\" && git push"
echo
read -r -p "Pulsa Enter para cerrar."
