#!/bin/bash
# Doble clic para cambiar la dieta del mes:
#  - metes los PDFs nuevos (arrastrándolos a la ventana)
#  - los escanea
#  - borra los antiguos (BORRADO IRREVERSIBLE, con confirmación)
#  - regenera el menú

cd "$(dirname "$0")" || exit 1
python3 actualizar.py
echo
read -r -p "Pulsa Enter para cerrar."
