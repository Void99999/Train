#!/usr/bin/env python3
"""
Baut aus index.html + css/style.css + js/main.js eine einzige, in sich
geschlossene HTML-Datei: rail-blast-einzeldatei.html

Die kann man irgendwohin kopieren und doppelklicken - sie braucht keine
Nachbardateien mehr. Nach Aenderungen an den Quelldateien einfach neu
ausfuehren:

    python3 build-einzeldatei.py
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC_HTML = ROOT / "index.html"
SRC_CSS = ROOT / "css" / "style.css"
SRC_JS = ROOT / "js" / "main.js"
OUT = ROOT / "rail-blast-einzeldatei.html"

LINK_TAG = '<link rel="stylesheet" href="css/style.css">'
SCRIPT_TAG = '<script src="js/main.js"></script>'


def main() -> int:
    for path in (SRC_HTML, SRC_CSS, SRC_JS):
        if not path.exists():
            print(f"Fehlt: {path}", file=sys.stderr)
            return 1

    html = SRC_HTML.read_text(encoding="utf-8")
    css = SRC_CSS.read_text(encoding="utf-8")
    js = SRC_JS.read_text(encoding="utf-8")

    for tag in (LINK_TAG, SCRIPT_TAG):
        if tag not in html:
            print(f"In index.html nicht gefunden: {tag}", file=sys.stderr)
            return 1

    # Wuerde im eingebetteten Code ein schliessendes Tag stehen, bricht der
    # Parser die Datei an dieser Stelle ab. Lieber laut scheitern als still
    # eine kaputte Datei schreiben.
    if "</style" in css.lower():
        print("css/style.css enthaelt '</style' - kann nicht eingebettet werden.", file=sys.stderr)
        return 1
    if "</script" in js.lower():
        print("js/main.js enthaelt '</script' - kann nicht eingebettet werden.", file=sys.stderr)
        return 1

    note = ("<!-- Erzeugt von build-einzeldatei.py. Nicht direkt bearbeiten -\n"
            "     Aenderungen gehoeren in index.html, css/style.css und js/main.js. -->")

    html = html.replace(LINK_TAG, note + "\n<style>\n" + css + "\n</style>", 1)
    html = html.replace(SCRIPT_TAG, "<script>\n" + js + "\n</script>", 1)

    OUT.write_text(html, encoding="utf-8")
    print(f"{OUT.name} geschrieben ({len(html) / 1024:.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
