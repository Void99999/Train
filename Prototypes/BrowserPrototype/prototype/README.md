# RAIL BLAST — Startbildschirm 🚂💥

> **Hinweis:** Dieser Ordner ist der ursprüngliche Prototyp, aus dem LAST TRAIN
> hervorgegangen ist. Er läuft weiterhin eigenständig und ist nicht Teil des
> Spiels — die Akte hier sind eine Skizze für die Eröffnungssequenz, die im
> Projektplan erst spät an der Reihe ist. Das eigentliche Spiel liegt eine
> Ebene höher; siehe die README im Hauptverzeichnis.
>
> Aufrufen über den Entwicklungsserver: `npm start`, dann
> `http://localhost:8080/prototype/`.

Startbildschirm für ein Spiel: eine Dampflok mit Tender und Personenwagen steht
nachts auf Schienen, die über die ganze Bildbreite laufen. Ein Klick auf **Start**
lässt den Zug mit Explosionssound in die Luft fliegen. Danach wird das Bild langsam
schwarz, und aus der Blende heraus läuft eine Cutscene: ein Kampfhubschrauber fliegt
heran, ein Soldat feuert aus der offenen Schiebetür, dann wird der Heli getroffen und
stürzt brennend ab. Nach der nächsten Schwarzblende sieht man den Soldaten aus der
Egoperspektive: er kriecht über das brennende Schlachtfeld, während Geschosse über ihn
hinwegfliegen. Das Gefecht ebbt langsam ab, er kriecht auf ein Haus zu, an dem eine
kleine Lok wartet, richtet sich zitternd auf, steigt ein und drückt am Pult auf 100 %.
Die Lok fährt an — und dann steht wieder der Startbildschirm da.

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

**Ablauf beim Start** — vier Akte, zusammen etwa dreiviertel Minute.
Leertaste oder Esc springt jederzeit zurück zum Startbildschirm.

*1. Akt — der Zug* (`startSequence()`)
Kinobalken fahren ein, das Menü tritt zurück, der Zug explodiert. Danach
blendet das Bild langsam auf Schwarz; dahinter wird die Szene geräumt.

*2. Akt — der Hubschrauber* (`runHeliScene()`)
1. Der Heli fliegt von rechts heran und geht in den Schwebeflug
2. Der Soldat in der offenen Schiebetür feuert — Mündungsfeuer,
   Leuchtspuren und Maschinengewehrsalve
3. Treffer: Cockpit-Alarm, Funken und Rauch am Heck, die Turbine stirbt ab
4. Der Heli trudelt brennend nach unten und schlägt mit lautem Knall auf

Der Aufschlag löst aus, sobald der Heli den Boden wirklich erreicht — nicht
nach einer festen Zeit. So sitzt der Treffer unabhängig von Bildrate und
Fenstergröße.

*3. Akt — das Schlachtfeld* (`runFieldScene()`)
1. Nach der Schwarzblende die Egoperspektive des Soldaten: brennendes
   Feld, zerschossene Baumstümpfe, Krater
2. Seine Hände kriechen abwechselnd nach vorn, die Sicht nickt im Takt mit
3. Geschosse zischen über ihn hinweg, in der Ferne fallen Schüsse
4. Das Gefecht ebbt ab: Feuer, Schüsse und Kopfnicken werden weniger —
   und mit ihnen die Lautstärke der Einschläge
5. Vor ihm wächst sein Ziel heran: ein Haus, davor eine wartende Lok
6. Er richtet sich zitternd auf, dabei kommen seine Beine ins Bild

Wie stark das Gefecht tobt, steuert `fpsState.calm` von 1 (voll) auf 0
(ruhig); daran hängen Feuermenge, Schussfrequenz, Lautstärke und die
Stärke des Kopfnickens. `fpsState.goal` (0 → 1) zieht das Haus heran,
`fpsState.stand` (0 → 1) richtet die Kamera auf und blendet die Beine ein;
das Zittern beim Aufstehen hängt ebenfalls an `stand`.

*4. Akt — die Lok* (`runCabScene()`)
1. Im Führerstand: Fenster, Manometer, Rohre und das Pult
2. Statt Fahrhebeln stehen dort vier Leistungsstufen: 25 %, 50 %, 75 %, 100 %
3. Die Hand des Soldaten fährt hoch und drückt auf **100 %** — die Stufe
   leuchtet auf, es klackt
4. Die Lok fährt an: die Landschaft im Fenster zieht immer schneller vorbei
   (`--speed` geht von 2,6 s über 1,1 s auf 0,6 s je Durchlauf)
5. Blende auf Schwarz — und der Startbildschirm steht wieder da

Die Hand ist aufrecht gezeichnet, mit der Zeigefingerspitze im Ursprung.
`transform-origin: 0 0` sorgt dafür, dass der Punkt hinter `translate()`
genau die Stelle ist, an der der Finger auftrifft; die Drehung legt den
Handrücken nach links unten, damit die Beschriftung frei bleibt.

**Zugexplosion**
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
- **Ablauf und Timing**: die `later(...)`-Aufrufe in `startSequence()` und `explode()`
- **Flugbahn des Helis**: `updateHeli()` — die Phasen `enter`, `hover`,
  `hit` und `fall`
- **Länge der Akte**: die `later(...)`-Aufrufe in `startSequence()`,
  `heliImpact()`, `runFieldScene()` und `runCabScene()`
- **Leistungsstufen im Führerstand**: die `.step`-Gruppen in `index.html`,
  die Position der Hand in `css/style.css` unter `.cab-hand`

Auf schmalen Bildschirmen rückt das Menü unter den Zug, das Gleis wandert nach
oben und Zug wie Explosion werden kleiner. Die Schienen laufen immer über die
volle Breite.
