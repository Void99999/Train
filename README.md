# Zug auf Schienen 🚂💥

Eine einzelne HTML-Datei: Eine gezeichnete Dampflok mit Tender und Personenwagen steht auf Schienen, die über die ganze Bildbreite laufen.
Ein Klick auf **Start** lässt ihn mit Explosionssound in die Luft fliegen — danach steht auf dem Button nur noch **cool**.

## Starten

`index.html` im Browser öffnen. Kein Build, keine Abhängigkeiten, keine externen Dateien.

## Was passiert beim Klick

1. Der Zug fängt an zu zittern (600 ms)
2. Knall: Lichtblitz, Druckwelle, Screenshake
3. Feuerball, Rauch, Funken und Trümmer über ein Canvas-Partikelsystem
4. Lok und Waggons werden auseinandergeschleudert
5. Am Unglücksort brennt es noch ein paar Sekunden nach
6. Der Button wechselt auf „cool"

## Sound

Der Explosionssound wird per Web Audio API zur Laufzeit erzeugt (Rauschen mit
abfallendem Tiefpass + Sub-Bass-Wumms + metallisches Bersten) — es wird also keine
Audiodatei benötigt. Browser starten Audio erst nach einer Nutzerinteraktion; da der
Sound am Klick hängt, passt das. Wenn die Web Audio API nicht verfügbar ist, läuft die
Animation trotzdem.

## Anpassen

Alles steckt in `index.html`:

- Lok, Tender und Wagen sind inline gezeichnetes SVG; Farbverläufe und die
  wiederverwendeten Räder liegen im `<svg id="artdefs">` am Anfang des Body
- Farben oben in `:root` sowie in den Paletten `FIRE`, `SMOKE` und `DEBRIS`
- Wucht der Explosion über die Partikelanzahl und die Geschwindigkeiten in `spawnExplosion()`
- Verzögerung bis zum Knall im Click-Handler (`600`), Umschalten des Buttons (`700`)

Auf schmalen Bildschirmen werden Zug und Explosion automatisch verkleinert, die Schienen
laufen aber immer über die volle Breite.
