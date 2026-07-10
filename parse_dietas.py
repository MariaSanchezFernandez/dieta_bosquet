#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrae el menú semanal de los PDFs de dieta (plantilla Nutrición Bosquet)
y genera menu.json para la app web.

Uso:
    python3 parse_dietas.py [carpeta_dietas] [fecha_inicio AAAA-MM-DD]

Requiere `pdftotext` (brew install poppler).
"""
import sys, os, re, json, subprocess, glob

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
DIAS_RE = re.compile(r"^\s*(" + "|".join(DIAS) + r")\b")


def pdftotext(path):
    out = subprocess.run(
        ["pdftotext", "-layout", path, "-"],
        capture_output=True, text=True, check=True
    )
    return out.stdout


def es_basura(linea):
    s = linea.strip()
    if not s:
        return True
    if s.startswith("*") or "http" in s:
        return True
    # fragmento de URL partido (una sola palabra con guiones, p.ej. "suave-de-sandia")
    if " " not in s and "-" in s:
        return True
    return False


def limpiar(s):
    return re.sub(r"\*\s*$", "", s).strip()


def fusionar(items):
    """Une las continuaciones (líneas que empiezan en minúscula) con el plato
    anterior; las que empiezan en mayúscula son platos distintos."""
    out = []
    for it in items:
        if out and it[:1].islower():
            out[-1] = (out[-1] + " " + it).strip()
        else:
            out.append(it)
    return out


def detectar_split(lineas):
    """Columna donde empieza la columna 'Cenas': el pasillo de espacios
    que está en blanco en TODAS las líneas de la sección."""
    lines = [l for l in lineas if l.strip()]
    if not lines:
        return 97
    maxlen = max(len(l) for l in lines)

    def es_esp(l, c):
        return c >= len(l) or l[c] == " "

    full = [c for c in range(maxlen) if all(es_esp(l, c) for l in lines)]
    # runs contiguos de columnas todas-en-blanco
    runs, ini = [], None
    prev = None
    for c in full:
        if ini is None:
            ini = prev = c
        elif c == prev + 1:
            prev = c
        else:
            runs.append((ini, prev)); ini = prev = c
    if ini is not None:
        runs.append((ini, prev))
    # el pasillo entre columnas: el run más ancho en la zona central
    cand = [(e - s, s, e) for (s, e) in runs if 45 <= s <= 120]
    if not cand:
        return 97
    cand.sort(reverse=True)
    _, _, e = cand[0]
    return e + 1  # las cenas empiezan justo después del pasillo


def _secciones(texto):
    """Trozos de texto entre cada cabecera 'Almuerzos…Cenas' y el siguiente
    'Vida social' / 'Menú semanal'."""
    lineas = texto.splitlines()
    secs, actual, dentro = [], [], False
    for ln in lineas:
        if "Almuerzos" in ln and "Cenas" in ln:
            if actual:
                secs.append(actual)
            actual, dentro = [], True
            continue
        if "Vida social" in ln:
            if actual:
                secs.append(actual); actual = []
            dentro = False
            continue
        if dentro:
            if ("Menú semanal" in ln or "Nutrición basada" in ln
                    or "Intervención" in ln or "Días" in ln):
                continue
            actual.append(ln)
    if actual:
        secs.append(actual)
    return secs


def parsear_menu(texto):
    """Devuelve {Lunes: {almuerzo:[...], cena:[...]}, ...}"""
    menu = {d: {"almuerzo": [], "cena": []} for d in DIAS}
    for sec in _secciones(texto):
        split = detectar_split(sec)
        # partir la sección en bloques (un bloque = un día) por líneas vacías
        bloques, actual = [], []
        for ln in sec:
            if ln.strip() == "":
                if actual:
                    bloques.append(actual); actual = []
            else:
                actual.append(ln)
        if actual:
            bloques.append(actual)

        for bloque in bloques:
            dia = next((DIAS_RE.match(l).group(1)
                        for l in bloque if DIAS_RE.match(l)), None)
            if not dia:
                continue
            for ln in bloque:
                izq = DIAS_RE.sub("", ln[:split])
                der = ln[split:]
                if not es_basura(izq):
                    menu[dia]["almuerzo"].append(limpiar(izq))
                if not es_basura(der):
                    menu[dia]["cena"].append(limpiar(der))
    for d in menu:
        menu[d]["almuerzo"] = fusionar(menu[d]["almuerzo"])
        menu[d]["cena"] = fusionar(menu[d]["cena"])
    return menu


def _juntar(txt):
    return " ".join(p.strip() for p in txt.splitlines() if p.strip())


def parsear_comun(texto):
    comun = {}
    m = re.search(r"Al levantarte\s+(.+)", texto)
    if m:
        comun["alLevantarte"] = m.group(1).strip()

    # Desayuno con dos opciones (Opción con CHO / Opción sin CHO)
    con = re.search(r"Opci[oó]n con CHO\s*[→>-]*\s*(.+?)(?=Opci[oó]n sin CHO)",
                    texto, re.S | re.I)
    sin = re.search(r"Opci[oó]n sin CHO\s*[→>-]*\s*(.+?)(?=\*|Merienda)",
                    texto, re.S | re.I)
    if con and sin:
        comun["desayunoConCHO"] = _juntar(con.group(1))
        comun["desayunoSinCHO"] = _juntar(sin.group(1))
    else:
        # formato antiguo: un único desayuno
        m = re.search(r"Desayuno\s+(.+?)\n\s*\n?\s*Merienda", texto, re.S)
        if m:
            comun["desayuno"] = _juntar(m.group(1))

    m = re.search(r"Merienda\s+(.+)", texto)
    if m:
        comun["merienda"] = m.group(1).strip()
    return comun


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    carpeta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base, "Dietas")
    fecha_inicio = sys.argv[2] if len(sys.argv) > 2 else None

    def buscar(patron):
        hits = glob.glob(os.path.join(carpeta, f"*{patron}*.pdf"))
        if not hits:
            raise SystemExit(f"No encuentro PDF con '{patron}' en {carpeta}")
        return hits[0]

    t13 = pdftotext(buscar("1 y 3"))
    t24 = pdftotext(buscar("2 y 4"))

    datos = {
        "fechaInicio": fecha_inicio,
        "comun": parsear_comun(t13),
        "semanas": {"1y3": parsear_menu(t13), "2y4": parsear_menu(t24)},
    }

    salida = os.path.join(base, "menu.json")
    if fecha_inicio is None and os.path.exists(salida):
        try:
            with open(salida, encoding="utf-8") as f:
                datos["fechaInicio"] = json.load(f).get("fechaInicio")
        except Exception:
            pass

    with open(salida, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    print(f"OK menu.json -> {salida}")
    for sem, dias in datos["semanas"].items():
        print(f"\n=== Semana {sem} ===")
        for d, m in dias.items():
            print(f"  {d}: ALM[{' / '.join(m['almuerzo']) or '—'}] "
                  f"CEN[{' / '.join(m['cena']) or '—'}]")


if __name__ == "__main__":
    main()
