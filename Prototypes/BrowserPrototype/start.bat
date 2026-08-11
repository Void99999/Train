@echo off
REM Startet den lokalen Entwicklungsserver und oeffnet das Spiel im Browser.
REM Zum reinen Spielen nicht noetig - dafuer reicht last-train-standalone.html.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wurde nicht gefunden.
  echo Zum Spielen brauchst du es auch gar nicht:
  echo einfach last-train-standalone.html doppelklicken.
  pause
  exit /b 1
)

start "" http://localhost:8080
node tools\serve.js
