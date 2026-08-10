#!/bin/sh
# Startet den lokalen Entwicklungsserver und öffnet das Spiel im Browser.
# Zum reinen Spielen nicht nötig - dafür reicht last-train-standalone.html.
cd "$(dirname "$0")" || exit 1

if command -v node >/dev/null 2>&1; then
  (sleep 1.5 && (xdg-open http://localhost:8080 || open http://localhost:8080) >/dev/null 2>&1) &
  exec node tools/serve.js
fi

echo "Node.js wurde nicht gefunden."
echo "Zum Spielen brauchst du es auch gar nicht: einfach"
echo "last-train-standalone.html doppelklicken."
