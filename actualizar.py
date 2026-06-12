#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cambio de dieta del mes: importa los PDFs nuevos, los escanea y borra los
antiguos (BORRADO IRREVERSIBLE), regenerando menu.json.

Se ejecuta con doble clic en «Actualizar dieta.command».
"""
import os
import re
import sys
import glob
import json
import shutil

BASE = os.path.dirname(os.path.abspath(__file__))
DIETAS = os.path.join(BASE, "Dietas")
sys.path.insert(0, BASE)
from parse_dietas import pdftotext, parsear_menu, parsear_comun  # noqa: E402

CANON = {"1 y 3": "Semana 1 y 3.pdf", "2 y 4": "Semana 2 y 4.pdf"}


def limpiar_ruta(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        s = s[1:-1]
    s = s.replace("\\ ", " ").replace("\\", "")
    return s.strip()


def buscar_existente(patron):
    hits = glob.glob(os.path.join(DIETAS, f"*{patron}*.pdf"))
    return hits[0] if hits else None


def pedir_pdf(etiqueta, patron):
    actual = buscar_existente(patron)
    print(f"\n— PDF de {etiqueta} —")
    if actual:
        print(f"  Actual: {os.path.basename(actual)}")
    ruta = limpiar_ruta(input(
        f"  Arrastra aquí el PDF nuevo de {etiqueta} y pulsa Enter "
        f"(vacío = mantener el actual): "))
    if not ruta:
        if not actual:
            print(f"  ⚠️  No hay PDF de {etiqueta} ni has dado uno nuevo.")
            return None
        return ("mantener", actual)
    if not os.path.isfile(ruta):
        print(f"  ⚠️  No encuentro el archivo: {ruta}")
        sys.exit(1)
    if not ruta.lower().endswith(".pdf"):
        print("  ⚠️  Eso no es un PDF.")
        sys.exit(1)
    if patron.replace(" ", "") not in os.path.basename(ruta).replace(" ", ""):
        print(f"  ⚠️  Aviso: el nombre no contiene «{patron}». "
              f"Asegúrate de que es el PDF correcto.")
    return ("nuevo", ruta)


def menu_vacio(menu):
    return all(not d["almuerzo"] and not d["cena"] for d in menu.values())


def main():
    os.makedirs(DIETAS, exist_ok=True)
    print("=" * 50)
    print("   CAMBIO DE DIETA DEL MES — Nutrición Bosquet")
    print("=" * 50)
    actuales = sorted(glob.glob(os.path.join(DIETAS, "*.pdf")))
    print("\nPDFs actuales en la carpeta Dietas:")
    print("\n".join(f"  - {os.path.basename(p)}" for p in actuales) or "  (ninguno)")

    s13 = pedir_pdf("SEMANA 1 y 3", "1 y 3")
    s24 = pedir_pdf("SEMANA 2 y 4", "2 y 4")
    if not s13 or not s24:
        print("\nFalta algún PDF. No se ha cambiado nada.")
        sys.exit(1)

    fuentes = {"1 y 3": s13, "2 y 4": s24}
    finales = {}        # patron -> ruta absoluta que se quedará
    copiar = []         # (origen, destino) para los PDFs nuevos
    a_borrar = []

    for patron in ("1 y 3", "2 y 4"):
        tipo, ruta = fuentes[patron]
        old = buscar_existente(patron)
        if tipo == "mantener":
            finales[patron] = os.path.abspath(ruta)  # se queda tal cual
        else:
            nombre = os.path.basename(ruta)
            if patron.replace(" ", "") not in nombre.replace(" ", ""):
                nombre = CANON[patron]               # nombre reconocible
            destino = os.path.join(DIETAS, nombre)
            finales[patron] = os.path.abspath(destino)
            copiar.append((ruta, destino))
            if old and os.path.abspath(old) != os.path.abspath(destino):
                a_borrar.append(old)                 # el antiguo de este slot

    # cualquier otro PDF que no se vaya a quedar (basura/sobrante)
    final_abs = set(finales.values())
    for p in actuales:
        if os.path.abspath(p) not in final_abs and p not in a_borrar:
            a_borrar.append(p)

    destinos = {p: finales[p] for p in finales}  # rutas finales por slot

    if a_borrar:
        print("\n" + "!" * 50)
        print("  Se van a BORRAR estos PDFs (IRREVERSIBLE,")
        print("  NO van a la papelera, no se pueden recuperar):")
        for p in a_borrar:
            print(f"    🗑️  {os.path.basename(p)}")
        print("!" * 50)
        if input('\n  Escribe BORRAR (en mayúsculas) para confirmar: ').strip() != "BORRAR":
            print("\nCancelado. No se ha borrado ni cambiado nada.")
            sys.exit(0)

    # 1) colocar los PDFs nuevos (copia segura mediante temporal)
    for origen, destino in copiar:
        tmp = destino + ".tmp"
        shutil.copy2(origen, tmp)
        os.replace(tmp, destino)

    # 2) borrar los antiguos / sobrantes
    for p in a_borrar:
        if os.path.exists(p):
            os.remove(p)

    # 3) escanear
    print("\nEscaneando los PDFs…")
    t13, t24 = pdftotext(destinos["1 y 3"]), pdftotext(destinos["2 y 4"])
    m13, m24 = parsear_menu(t13), parsear_menu(t24)

    if menu_vacio(m13) or menu_vacio(m24):
        print("\n⚠️  No he podido leer el menú de algún PDF.")
        print("   Puede que sea un PDF escaneado (imagen) sin texto.")
        print("   El menu.json NO se ha tocado. Pide la versión en texto.")
        sys.exit(1)

    # 4) fecha de inicio
    fecha = input("\n¿Lunes en que empiezas esta dieta? (AAAA-MM-DD): ").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", fecha):
        print("Fecha no válida. Usa el formato AAAA-MM-DD (p.ej. 2026-07-13).")
        sys.exit(1)

    datos = {"fechaInicio": fecha,
             "comun": parsear_comun(t13),
             "semanas": {"1y3": m13, "2y4": m24}}
    with open(os.path.join(BASE, "menu.json"), "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

    print("\n✅ Dieta actualizada y escaneada. Resumen:")
    for sem, dias in datos["semanas"].items():
        print(f"\n  Semana {sem}:")
        for d, mm in dias.items():
            print(f"    {d}: {' / '.join(mm['almuerzo']) or '—'}  ||  "
                  f"{' / '.join(mm['cena']) or '—'}")
    print("\nAhora sube los cambios a GitHub:")
    print('   git add -A && git commit -m "Actualizar dieta" && git push')


if __name__ == "__main__":
    main()
