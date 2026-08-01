# RAIL BLAST — Startbildschirm 🚂💥

Startbildschirm für ein Spiel: eine Dampflok mit Tender und Personenwagen steht
nachts auf Schienen, die über die ganze Bildbreite laufen. Ein Klick auf **Start**
startet eine Cutscene: ein Kampfhubschrauber fliegt heran, ein Soldat feuert aus der
offenen Schiebetür, dann wird der Heli getroffen und stürzt brennend auf den Zug —
der Aufschlag reißt ihn mit. Danach steht auf dem Button nur noch **cool**.

## Starten

Zwei Wege — beide brauchen kein Internet und keine Installation:

**Schnell:** `rail-blast-einzeldatei.html` doppelklicken. In dieser Datei steckt
alles drin, sie funktioniert auch allein in einem beliebigen Ordner.

**Zum Weiterbauen:** `index.html` öffnen. Dabei müssen die Ordner `css` und `js`
daneben liegen bleiben, sonst erscheint die Seite ohne Gestaltung.

```
rail-blast-einzeldatei.html   alles in einer Datei (erzeugt, siehe unten)
index.html                    Struktur und die SVG-Illustration
css/style.css                 Szene, Beleuchtung, Titel, Menü
js/main.js                    Audio, Partikel, Parallaxe, Menülogik
build-einzeldatei.py          baut die Einzeldatei neu
```

Die Einzeldatei wird aus den drei Quelldateien erzeugt. Bearbeite sie nicht
direkt — ändere `index.html`, `css/style.css` oder `js/main.js` und baue sie
danach neu:

```
python3 build-einzeldatei.py
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
  (↑ ↓ wählen, Enter bestätigen, Esc schließen, R setzt die Szene zurück,
  Leertaste überspringt die Cutscene)
- Die Optionen wirken wirklich: Lautstärke, Bildschirmwackeln, Effektstärke.
  Sie werden im Browser gespeichert und beim nächsten Start wieder geladen.

**Cutscene beim Start**
1. Kinobalken fahren ein, das Menü tritt zurück, die Rotoren laufen an
2. Der Hubschrauber fliegt von rechts heran und geht über der Strecke in
   den Schwebeflug
3. Der Soldat in der offenen Schiebetür feuert — Mündungsfeuer,
   Leuchtspuren und Maschinengewehrsalve
4. Treffer: Cockpit-Alarm, Funken und Rauch am Heck, die Turbine stirbt ab
5. Der Heli trudelt brennend nach unten und schlägt auf dem Zug ein
6. Leertaste oder Esc überspringt die Cutscene

Der Aufschlag löst aus, sobald der Heli den Zug wirklich erreicht — nicht
nach einer festen Zeit. So sitzt der Treffer unabhängig von Bildrate und
Fenstergröße.

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
- **Ablauf und Timing**: die `later(...)`-Aufrufe in `runCutscene()` und `explode()`
- **Flugbahn des Helis**: `updateHeli()` — die Phasen `enter`, `hover`,
  `hit` und `fall`

Auf schmalen Bildschirmen rückt das Menü unter den Zug, das Gleis wandert nach
oben und Zug wie Explosion werden kleiner. Die Schienen laufen immer über die
volle Breite.
