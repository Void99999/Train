# RAIL BLAST — Startbildschirm 🚂💥

Startbildschirm für ein Spiel: eine Dampflok mit Tender und Personenwagen steht
nachts auf Schienen, die über die ganze Bildbreite laufen. Ein Klick auf **Start**
lässt den Zug mit Explosionssound in die Luft fliegen — danach steht auf dem Button
nur noch **cool**.

## Starten

`index.html` im Browser öffnen. Kein Build, keine Abhängigkeiten, keine externen
Dateien — Bild und Ton entstehen komplett im Browser.

```
index.html      Struktur und die SVG-Illustration
css/style.css   Szene, Beleuchtung, Titel, Menü
js/main.js      Audio, Partikel, Parallaxe, Menülogik
```

## Was drin ist

**Szene**
- Neun Ebenen mit Parallaxe: Sternenhimmel, Mond, zwei Bergketten mit Dunst,
  Baumsilhouetten, Telegrafenmasten, Boden, Gleis, Zug, Gras im Vordergrund
- Die Ebenen folgen dem Mauszeiger und driften auch ohne Maus langsam weiter
- Funkelnde Sterne, gelegentliche Sternschnuppen, Glühwürmchen über dem Boden
- Lichtkegel des Spitzenlichts, wandernder Glanz auf der Schiene, Dampf aus
  dem Schornstein, flackerndes Führerhausfenster
- Baumreihe, Gras und Mastenabstände werden beim Laden erzeugt — mit festem
  Startwert, damit die Silhouette bei jedem Aufruf gleich aussieht

**Menü**
- Start, Optionen, Steuerung — mit Maus **und** Tastatur bedienbar
  (↑ ↓ wählen, Enter bestätigen, Esc schließen, R setzt die Szene zurück)
- Die Optionen wirken wirklich: Lautstärke, Bildschirmwackeln, Effektstärke.
  Sie werden im Browser gespeichert und beim nächsten Start wieder geladen.

**Explosion**
1. Dampfpfeife, die Lok fängt an zu beben
2. Vorknall am Kessel mit kleinem Lichtblitz
3. Hauptknall: Blitz, Druckwelle, Screenshake, Feuerball in drei Wellen,
   Rauchpilz, Funken, Bodenstaub und Trümmer mit Feuerschweif
4. Der Feuerschein beleuchtet die ganze Landschaft
5. Lok, Tender und Wagen werden auseinandergeschleudert, Trümmer bleiben
   am Boden liegen
6. Das Wrack brennt und raucht mehrere Sekunden nach
7. Der Button wechselt auf „cool"

## Ton

Alles wird zur Laufzeit per Web Audio API erzeugt, es gibt keine Audiodateien:
Rauschschichten mit wanderndem Filter, Sub-Bass, berstendes Metall, Trümmerregen,
Dampfpfeife mit Vibrato und ein synthetischer Nachhall. Browser starten Audio erst
nach einer Nutzerinteraktion — da der Ton am Klick hängt, passt das. Fehlt die
Web Audio API, läuft die Animation trotzdem.

## Anpassen

- **Spieltitel**: in `index.html` im `<header class="brand">`
- **Farben**: oben in `css/style.css` unter `:root`, dazu die Paletten `FIRE`,
  `SMOKE` und `DEBRIS` in `js/main.js`
- **Höhe von Horizont und Gleis**: `--horizon` und `--track-y` in `:root` —
  alle Ebenen richten sich danach aus
- **Wucht der Explosion**: Partikelzahlen und Geschwindigkeiten in `spawnBlast()`
- **Ablauf und Timing**: die `later(...)`-Aufrufe in `explode()`

Auf schmalen Bildschirmen rückt das Menü unter den Zug, das Gleis wandert nach
oben und Zug wie Explosion werden kleiner. Die Schienen laufen immer über die
volle Breite.
