/* ===================================================================
   RAIL BLAST - Startbildschirm
   Kein Build, keine Abhängigkeiten. Einfach index.html öffnen.

   Aufbau dieser Datei:
     1. Hilfsfunktionen und Einstellungen
     2. Audio (alles zur Laufzeit synthetisiert, keine Sounddateien)
     3. Szenendeko: Sterne, Bäume, Gras, Masten
     4. Parallaxe und Screenshake
     5. Partikelsystem
     6. Explosionssequenz
     7. Menü und Tastatursteuerung
   =================================================================== */
(function () {
  "use strict";

  /* ============ 1. Hilfsfunktionen und Einstellungen ============ */

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const rand  = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const app       = $("#app");
  const camera    = $("#camera");
  const world     = $("#world");
  const trainWrap = $("#trainWrap");
  const trainLayer = $("#trainLayer");
  const train     = $("#train");
  const beam      = $("#beam");
  const fx        = $("#fx");
  const skyfx     = $("#skyfx");
  const flash     = $("#flash");
  const firelight = $("#firelight");
  const startBtn  = $("#startBtn");
  const hint      = $("#hint");

  const ctx   = fx.getContext("2d");
  const sctx  = skyfx.getContext("2d");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Einstellungen werden im Browser gespeichert */
  const DEFAULTS = { volume: 80, shake: true, quality: 1 };
  let settings = Object.assign({}, DEFAULTS);

  try {
    const saved = JSON.parse(localStorage.getItem("railblast.settings") || "null");
    if (saved) settings = Object.assign(settings, saved);
  } catch (e) { /* kaputter oder gesperrter Speicher: Standardwerte behalten */ }

  function saveSettings() {
    try { localStorage.setItem("railblast.settings", JSON.stringify(settings)); }
    catch (e) { /* Speichern ist optional */ }
  }

  /* Alles skaliert mit der Fensterbreite, damit die Explosion auf dem
     Handy nicht das halbe Display ausfüllt. */
  function sceneScale() {
    return clamp(app.clientWidth / 1100, 0.45, 1) * settings.quality;
  }

  /* Boden vor dem Gleis. Bewusst die Gleisunterkante und nicht die
     Oberkante: sonst kommen Truemmer und Glut mitten im Schotter zu
     liegen und stecken sichtbar in der Schiene. */
  function groundY() {
    const t = $(".track").getBoundingClientRect();
    const a = app.getBoundingClientRect();
    return t.bottom - a.top + 12;
  }


  /* ========================== 2. Audio ========================== */

  let ac = null, master = null, reverb = null;

  function audio() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();

    master = ac.createGain();
    master.gain.value = settings.volume / 100;
    master.connect(ac.destination);

    /* Synthetischer Nachhall: exponentiell abfallendes Rauschen als
       Impulsantwort. Gibt dem Knall Raum, ohne externe Datei. */
    const len = Math.floor(ac.sampleRate * 2.6);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    reverb = ac.createConvolver();
    reverb.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet).connect(master);

    return ac;
  }

  function resume() {
    const a = audio();
    if (a && a.state === "suspended") a.resume();
    return a;
  }

  function setVolume(v) {
    settings.volume = v;
    if (master) master.gain.setTargetAtTime(v / 100, ac.currentTime, 0.02);
  }

  /* Rauschpuffer mit einstellbarer Abklingkurve */
  function noiseBuffer(dur, curve) {
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, curve);
    }
    return buf;
  }

  function uiTick() {
    const a = resume(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(1250, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.1);
  }

  function uiConfirm() {
    const a = resume(); if (!a) return;
    const t = a.currentTime;
    [660, 990].forEach(function (f, i) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, t + i * 0.07);
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.07 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.16);
      o.connect(g).connect(master);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.18);
    });
  }

  /* Dampfpfeife: zwei leicht verstimmte Töne mit Vibrato */
  function playWhistle(dur) {
    const a = resume(); if (!a) return;
    const t = a.currentTime;
    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
    out.gain.setValueAtTime(0.16, t + dur - 0.14);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(master);
    out.connect(reverb);

    const vib = a.createOscillator();
    const vibGain = a.createGain();
    vib.frequency.value = 5.5;
    vibGain.gain.value = 7;
    vib.connect(vibGain);
    vib.start(t); vib.stop(t + dur);

    [523, 785, 1046].forEach(function (f, i) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.3);
      vibGain.connect(o.frequency);
      g.gain.value = [0.5, 0.32, 0.14][i];
      o.connect(g).connect(out);
      o.start(t); o.stop(t + dur);
    });

    /* Zischen der Dampfpfeife */
    const hiss = a.createBufferSource();
    hiss.buffer = noiseBuffer(dur, 0.4);
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2600;
    const hg = a.createGain();
    hg.gain.value = 0.05;
    hiss.connect(hp).connect(hg).connect(out);
    hiss.start(t); hiss.stop(t + dur);
  }

  /* Dumpfer Vorknall */
  function playThud() {
    const a = resume(); if (!a) return;
    const t = a.currentTime;

    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(master);
    o.connect(g).connect(reverb);
    o.start(t); o.stop(t + 0.52);

    const n = a.createBufferSource();
    n.buffer = noiseBuffer(0.4, 2.5);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const ng = a.createGain();
    ng.gain.value = 0.3;
    n.connect(lp).connect(ng).connect(master);
    n.start(t); n.stop(t + 0.4);
  }

  /* Der Hauptknall: Druckwelle, Sub-Bass, berstendes Metall, Nachhall */
  function playBlast() {
    const a = resume(); if (!a) return;
    const t = a.currentTime;

    /* Schicht 1: heller Knall */
    const crackN = a.createBufferSource();
    crackN.buffer = noiseBuffer(1.2, 3.2);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.5);
    bp.Q.value = 0.7;
    const cg = a.createGain();
    cg.gain.value = 0.75;
    crackN.connect(bp).connect(cg);
    cg.connect(master); cg.connect(reverb);
    crackN.start(t); crackN.stop(t + 1.2);

    /* Schicht 2: dunkles Grollen mit langem Ausklang */
    const rumbleN = a.createBufferSource();
    rumbleN.buffer = noiseBuffer(3.4, 1.8);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 2.6);
    const rg = a.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    rumbleN.connect(lp).connect(rg);
    rg.connect(master); rg.connect(reverb);
    rumbleN.start(t); rumbleN.stop(t + 3.4);

    /* Schicht 3: Sub-Bass-Wumms */
    const sub = a.createOscillator();
    const sg = a.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(165, t);
    sub.frequency.exponentialRampToValueAtTime(21, t + 1.1);
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    sub.connect(sg).connect(master);
    sub.start(t); sub.stop(t + 1.7);

    /* Schicht 4: berstendes Metall */
    const metal = a.createOscillator();
    const mg = a.createGain();
    metal.type = "square";
    metal.frequency.setValueAtTime(1100, t);
    metal.frequency.exponentialRampToValueAtTime(64, t + 0.26);
    mg.gain.setValueAtTime(0.0001, t);
    mg.gain.exponentialRampToValueAtTime(0.3, t + 0.006);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    metal.connect(mg); mg.connect(master); mg.connect(reverb);
    metal.start(t); metal.stop(t + 0.36);
  }

  /* Trümmerregen: viele kurze Einschläge über zwei Sekunden verteilt */
  function playDebrisRain() {
    const a = resume(); if (!a) return;
    const t0 = a.currentTime;
    for (let i = 0; i < 26; i++) {
      const t = t0 + 0.25 + Math.random() * 2.1;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "triangle";
      const f = rand(150, 900);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(rand(0.02, 0.07), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g); g.connect(master); g.connect(reverb);
      o.start(t); o.stop(t + 0.12);
    }
  }

  /* Leises Knistern des brennenden Wracks */
  let fireNode = null;
  function startFireLoop() {
    const a = resume(); if (!a || fireNode) return;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(3, 0);
    src.loop = true;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, a.currentTime + 0.6);
    src.connect(bp).connect(g).connect(master);
    src.start();
    fireNode = { src: src, gain: g };
  }
  function stopFireLoop() {
    if (!fireNode) return;
    const g = fireNode.gain, src = fireNode.src;
    g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
    setTimeout(function () { try { src.stop(); } catch (e) {} }, 1200);
    fireNode = null;
  }


  /* ==================== 3. Szenendeko erzeugen =================== */

  /* Deterministischer Zufall, damit Bäume und Gras bei jedem Laden gleich
     aussehen (sonst "springt" die Silhouette beim Neuladen). */
  function seeded(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* Nadelbaum-Silhouette als ein einziger Pfad */
  function buildTrees() {
    const r = seeded(20240719);
    let d = "M0 200 L0 150 ";
    let x = 0;
    while (x < 1200) {
      const w = rand(14, 30) * (0.6 + r() * 0.8);
      const h = 40 + r() * 78;
      const base = 150 + r() * 14;
      /* Zackige Tanne: drei Stufen nach oben */
      d += `L${(x).toFixed(1)} ${base.toFixed(1)} `
        +  `L${(x + w * 0.30).toFixed(1)} ${(base - h * 0.38).toFixed(1)} `
        +  `L${(x + w * 0.16).toFixed(1)} ${(base - h * 0.40).toFixed(1)} `
        +  `L${(x + w * 0.44).toFixed(1)} ${(base - h * 0.74).toFixed(1)} `
        +  `L${(x + w * 0.32).toFixed(1)} ${(base - h * 0.76).toFixed(1)} `
        +  `L${(x + w * 0.50).toFixed(1)} ${(base - h).toFixed(1)} `
        +  `L${(x + w * 0.68).toFixed(1)} ${(base - h * 0.76).toFixed(1)} `
        +  `L${(x + w * 0.56).toFixed(1)} ${(base - h * 0.74).toFixed(1)} `
        +  `L${(x + w * 0.84).toFixed(1)} ${(base - h * 0.40).toFixed(1)} `
        +  `L${(x + w * 0.70).toFixed(1)} ${(base - h * 0.38).toFixed(1)} `
        +  `L${(x + w).toFixed(1)} ${base.toFixed(1)} `;
      x += w * (0.72 + r() * 0.5);
    }
    d += "L1200 150 L1200 200 Z";
    $("#treePath").setAttribute("d", d);
  }

  /* Grasbüschel im Vordergrund */
  function buildGrass() {
    const r = seeded(773311);
    let d = "M0 120 L0 74 ";
    let x = 0;
    while (x < 1200) {
      const w = 5 + r() * 13;
      const h = 16 + r() * 44;
      d += `L${x.toFixed(1)} 78 Q${(x + w * 0.5).toFixed(1)} ${(78 - h).toFixed(1)} `
        +  `${(x + w).toFixed(1)} 78 `;
      x += w * (0.5 + r() * 0.7);
    }
    d += "L1200 74 L1200 120 Z";
    $("#grassPath").setAttribute("d", d);
  }

  /* Telegrafenmasten in unregelmäßigem Abstand */
  function buildPoles() {
    const host = $("#poles");
    const r = seeded(90210);
    let x = 3;
    let html = "";
    while (x < 100) {
      const h = 52 + r() * 26;
      html += `<i style="left:${x.toFixed(1)}%;height:${h.toFixed(0)}%"></i>`;
      x += 9 + r() * 9;
    }
    host.innerHTML = html;
  }

  /* --- Sternenhimmel mit Funkeln und gelegentlichen Sternschnuppen --- */
  const stars = [];
  const shooters = [];

  function buildStars() {
    stars.length = 0;
    const n = Math.round((skyfx.clientWidth * skyfx.clientHeight) / 7000);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() < 0.14 ? rand(1.3, 2.1) : rand(0.5, 1.15),
        base: rand(0.25, 0.9),
        sp: rand(0.4, 2.0),
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.2
      });
    }
  }

  function drawSky(time) {
    const w = skyfx.clientWidth, h = skyfx.clientHeight;
    sctx.clearRect(0, 0, w, h);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      /* Sterne verblassen zum Horizont hin */
      const fade = clamp(1 - s.y * 1.15, 0, 1);
      const tw = 0.65 + 0.35 * Math.sin(time * 0.001 * s.sp + s.ph);
      const alpha = s.base * tw * fade;
      if (alpha <= 0.01) continue;
      sctx.globalAlpha = alpha;
      sctx.fillStyle = s.warm ? "#ffe6bd" : "#eaf2ff";
      sctx.beginPath();
      sctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      sctx.fill();
    }
    sctx.globalAlpha = 1;

    /* Sternschnuppen */
    if (!reduceMotion && Math.random() < 0.0016 && shooters.length < 2) {
      shooters.push({
        x: rand(0.1, 0.9) * w, y: rand(0.05, 0.4) * h,
        vx: rand(3.5, 7), vy: rand(1.2, 2.6), life: 1
      });
    }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.vx; s.y += s.vy; s.life -= 0.012;
      if (s.life <= 0) { shooters.splice(i, 1); continue; }
      const g = sctx.createLinearGradient(s.x, s.y, s.x - s.vx * 14, s.y - s.vy * 14);
      g.addColorStop(0, `rgba(255,255,255,${(s.life * 0.9).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      sctx.strokeStyle = g;
      sctx.lineWidth = 2;
      sctx.lineCap = "round";
      sctx.beginPath();
      sctx.moveTo(s.x, s.y);
      sctx.lineTo(s.x - s.vx * 14, s.y - s.vy * 14);
      sctx.stroke();
    }
  }


  /* ================= 4. Parallaxe und Screenshake ================ */

  const layers = $$("[data-depth]");
  let pointerX = 0;   /* Ziel, -1..1 */
  let camX = 0;       /* geglättet */

  if (!reduceMotion) {
    window.addEventListener("pointermove", function (e) {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    }, { passive: true });
  }

  function updateParallax(time) {
    /* Sanfte Eigenbewegung, damit das Bild auch ohne Maus lebt */
    const driftX = Math.sin(time * 0.00013) * 0.35;
    camX += ((pointerX + driftX) - camX) * 0.045;

    /* Bewusst nur waagerecht: ein senkrechter Versatz laesst Gleis und
       Boden unter dem Zug wandern, was aussieht, als wuerde er schweben. */
    for (let i = 0; i < layers.length; i++) {
      const el = layers[i];
      const d = parseFloat(el.dataset.depth) || 0;
      el.style.transform = `translate3d(${(-camX * d * 0.9).toFixed(2)}px, 0, 0)`;
    }
  }

  let shakeAmt = 0, shakeDecay = 0;

  function addShake(amount) {
    if (!settings.shake) return;
    shakeAmt = Math.max(shakeAmt, amount);
    shakeDecay = amount / 55;
  }

  function updateShake() {
    if (shakeAmt <= 0.01) {
      camera.style.transform = "";
      shakeAmt = 0;
      return;
    }
    const a = shakeAmt;
    camera.style.transform =
      `translate3d(${rand(-a, a).toFixed(2)}px, ${rand(-a, a).toFixed(2)}px, 0)` +
      ` rotate(${rand(-a, a) * 0.035}deg)`;
    shakeAmt -= shakeDecay;
  }


  /* ==================== 5. Partikelsystem ======================= */

  const FIRE   = ["#fff6cc", "#ffd166", "#ff9f1c", "#f4501e", "#c1200f"];
  const SMOKE  = ["#3c3a37", "#4a4641", "#2e2c2a", "#565049"];
  /* Bewusst gedeckt und dunkel: helle Farben lesen sich sonst als Konfetti */
  /* Bewusst dunkel und entsaettigt: unter dem Feuerschein werden helle
     Toene stark aufgehellt und lesen sich sonst als Konfetti. */
  const DEBRIS = ["#10151a", "#1d232a", "#3a1512", "#2b3138", "#241a10", "#432c14"];

  const parts = [];
  const waves = [];
  const flies = [];   /* Glühwürmchen, immer aktiv */

  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    [fx, skyfx].forEach(function (c) {
      const w = c.clientWidth, h = c.clientHeight;
      c.width  = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    buildStars();
    buildFlies();
  }

  function buildFlies() {
    flies.length = 0;
    const n = Math.round(app.clientWidth / 90);
    const gy = groundY();
    for (let i = 0; i < n; i++) {
      flies.push({
        x: Math.random() * app.clientWidth,
        y: gy - rand(-30, 150),
        r: rand(1.2, 2.4),
        ph: Math.random() * Math.PI * 2,
        sp: rand(0.15, 0.5),
        amp: rand(8, 26),
        blink: rand(0.6, 1.8)
      });
    }
  }

  function push(p) { parts.push(p); }

  /* ---- Hauptexplosion ---- */
  function spawnBlast(cx, cy) {
    const S = sceneScale();

    /* Rauch (zuerst, wird durch die Ebenenreihenfolge hinten gezeichnet) */
    for (let i = 0; i < Math.round(150 * settings.quality); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(0.5, 6) * S;
      push({ type: "smoke",
        x: cx + rand(-0.5, 0.5) * 240 * S, y: cy + rand(-0.5, 0.5) * 80 * S,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.8,
        r: rand(28, 90) * S, life: 1, decay: rand(0.004, 0.010),
        grav: -0.055, drag: 0.982,
        color: SMOKE[(Math.random() * SMOKE.length) | 0] });
    }

    /* Feuerball in drei zeitversetzten Wellen */
    for (let wave = 0; wave < 3; wave++) {
      const delay = wave * 60;
      setTimeout(function () {
        const n = Math.round([150, 90, 60][wave] * settings.quality);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = Math.sqrt(Math.random()) * (14 - wave * 3) * S;
          push({ type: "fire",
            x: cx + rand(-0.5, 0.5) * 130 * S, y: cy + rand(-0.5, 0.5) * 55 * S,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.2,
            r: rand(16, 54) * S, life: 1, decay: rand(0.016, 0.03),
            grav: -0.025, drag: 0.955,
            color: FIRE[(Math.random() * FIRE.length) | 0] });
        }
      }, delay);
    }

    /* Funken */
    for (let i = 0; i < Math.round(125 * settings.quality); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(9, 30) * S;
      push({ type: "spark",
        x: cx + rand(-20, 20) * S, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        r: rand(1.4, 3.2), life: 1, decay: rand(0.008, 0.02),
        grav: 0.32, drag: 0.99,
        color: Math.random() < 0.3 ? "#fff6d8" : "#ffc857" });
    }

    /* Bodenstaub: läuft flach nach beiden Seiten weg */
    for (let i = 0; i < Math.round(70 * settings.quality); i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      push({ type: "smoke",
        x: cx + rand(-40, 40) * S, y: groundY() - rand(0, 18),
        vx: dir * rand(4, 15) * S, vy: rand(-1.2, 0.4),
        r: rand(20, 60) * S, life: 1, decay: rand(0.008, 0.016),
        grav: -0.012, drag: 0.955,
        color: "#4b4535" });
    }

    /* Trümmer, teils mit Feuerschweif */
    const gy = groundY();
    for (let i = 0; i < Math.round(48 * settings.quality); i++) {
      const a = -Math.PI / 2 + rand(-0.5, 0.5) * Math.PI * 1.7;
      const sp = rand(7, 22) * S;
      push({ type: "debris",
        x: cx + rand(-0.5, 0.5) * 260 * S, y: cy + rand(-0.5, 0.5) * 60 * S,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        w: rand(5, 20) * S, h: rand(4, 15) * S,
        rot: Math.random() * Math.PI, vr: rand(-0.3, 0.3),
        life: 1, decay: 0.0035, grav: 0.42, drag: 0.995,
        burning: Math.random() < 0.45, rest: gy + rand(0, 26), landed: false,
        color: DEBRIS[(Math.random() * DEBRIS.length) | 0] });
    }

    waves.push({ x: cx, y: cy, r: 12 * S, life: 1, s: S });
  }

  /* ---- Kleiner Vorknall am Kessel ---- */
  function spawnPrePop(cx, cy) {
    const S = sceneScale();
    for (let i = 0; i < Math.round(40 * settings.quality); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(1, 7) * S;
      push({ type: "fire",
        x: cx + rand(-25, 25) * S, y: cy + rand(-15, 15) * S,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5,
        r: rand(8, 26) * S, life: 1, decay: rand(0.03, 0.05),
        grav: -0.02, drag: 0.94,
        color: FIRE[(Math.random() * FIRE.length) | 0] });
    }
    waves.push({ x: cx, y: cy, r: 6 * S, life: 0.55, s: S * 0.5 });
  }

  /* ---- Nachbrenner am Wrack ---- */
  function spawnEmbers(cx, cy) {
    const S = sceneScale();
    const gy = groundY();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + rand(-0.6, 0.6);
      const sp = rand(1, 3.2);
      push({ type: "fire",
        x: cx + rand(-0.5, 0.5) * 340 * S, y: gy + rand(0, 14),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: rand(9, 24) * S, life: 1, decay: rand(0.018, 0.035),
        grav: -0.05, drag: 0.97,
        color: FIRE[1 + ((Math.random() * 4) | 0)] });
    }
    /* aufsteigende Rauchsäule */
    for (let i = 0; i < 2; i++) {
      push({ type: "smoke",
        x: cx + rand(-0.5, 0.5) * 200 * S, y: gy + rand(-4, 12),
        vx: rand(-0.6, 0.6), vy: rand(-1.6, -0.7),
        r: rand(24, 54) * S, life: 1, decay: rand(0.0035, 0.007),
        grav: -0.03, drag: 0.99,
        color: SMOKE[(Math.random() * SMOKE.length) | 0] });
    }
    /* einzelne Glutfunken */
    for (let i = 0; i < 3; i++) {
      push({ type: "spark",
        x: cx + rand(-0.5, 0.5) * 320 * S, y: gy + rand(0, 10),
        vx: rand(-1, 1), vy: rand(-3.5, -1.5),
        r: rand(1, 2), life: 1, decay: rand(0.008, 0.016),
        grav: -0.02, drag: 0.985,
        color: "#ff9f1c" });
    }
  }

  /* ---- Zeichnen ---- */
  function hexRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`;
  }

  const LAYER_ORDER = ["smoke", "debris", "fire", "spark"];

  function drawParticle(p) {
    if (p.type === "debris") {
      if (p.burning && !p.landed) {
        /* kurzer Feuerschweif hinter dem Trümmerstück */
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w * 1.9);
        g.addColorStop(0, `rgba(255,190,80,${(0.5 * p.life).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,120,20,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.w * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    if (p.type === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, p.life * 1.4);
      ctx.strokeStyle = p.color;
      ctx.lineCap = "round";
      ctx.lineWidth = p.r;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 1.9, p.y - p.vy * 1.9);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      return;
    }

    const rr = p.type === "smoke"
      ? Math.max(1, p.r * (2.3 - p.life))
      : Math.max(1, p.r * (0.45 + p.life * 0.55));

    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
    if (p.type === "fire") {
      ctx.globalCompositeOperation = "lighter";
      g.addColorStop(0,    hexRgba(p.color, 0.85 * p.life));
      g.addColorStop(0.45, hexRgba(p.color, 0.34 * p.life));
      g.addColorStop(1,    hexRgba(p.color, 0));
    } else {
      const a = Math.min(0.3, p.life * 0.38);
      g.addColorStop(0,   hexRgba(p.color, a));
      g.addColorStop(0.6, hexRgba(p.color, a * 0.6));
      g.addColorStop(1,   hexRgba(p.color, 0));
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawFlies(time) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const t = time * 0.001;
      const x = f.x + Math.sin(t * f.sp + f.ph) * f.amp;
      const y = f.y + Math.cos(t * f.sp * 0.7 + f.ph) * f.amp * 0.6;
      const a = 0.28 + 0.32 * Math.sin(t * f.blink + f.ph * 2);
      if (a <= 0.02) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r * 5);
      g.addColorStop(0, `rgba(255,226,140,${a.toFixed(3)})`);
      g.addColorStop(1, "rgba(255,200,90,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, f.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* ---- Hauptschleife ---- */
  let fireGlow = 0;

  function frame(time) {
    updateParallax(time);
    updateShake();
    drawSky(time);

    ctx.clearRect(0, 0, fx.clientWidth, fx.clientHeight);

    if (!exploded) drawFlies(time);

    /* Druckwellen */
    for (let i = waves.length - 1; i >= 0; i--) {
      const s = waves[i];
      s.r += 26 * s.s;
      s.life -= 0.075;
      if (s.life <= 0) { waves.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,228,175,${(s.life * s.life * 0.8).toFixed(3)})`;
      ctx.lineWidth = 18 * s.life * s.s;
      ctx.stroke();
    }

    /* Physik, dabei tote Partikel aussortieren */
    let w = 0, heat = 0;
    const gy = groundY();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];

      if (p.type === "debris" && p.landed) {
        p.life -= 0.0022;
      } else {
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.grav;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.type === "debris") {
          p.rot += p.vr;
          /* auf dem Boden liegen bleiben statt durchzufallen */
          if (p.vy > 0 && p.y >= p.rest) {
            p.y = p.rest;
            p.landed = true;
            p.burning = false;
            p.vx = p.vy = p.vr = 0;
          }
        }
      }

      if (p.type === "fire") heat += p.life;
      if (p.life > 0) parts[w++] = p;
    }
    parts.length = w;

    /* Feuerschein über der ganzen Szene */
    const target = clamp(heat / 260, 0, 0.85);
    fireGlow += (target - fireGlow) * (target > fireGlow ? 0.55 : 0.06);
    firelight.style.opacity = fireGlow.toFixed(3);

    for (let l = 0; l < LAYER_ORDER.length; l++) {
      const layer = LAYER_ORDER[l];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].type === layer) drawParticle(parts[i]);
      }
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  }


  /* ================== 6. Explosionssequenz ====================== */

  let exploded = false;
  let emberTimer = null;
  const timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function trainCenter() {
    const t = train.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    return { x: t.left + t.width / 2 - a.left, y: t.top + t.height / 2 - a.top };
  }

  function doFlash(strength, ms) {
    flash.style.transition = "none";
    flash.style.opacity = String(strength);
    requestAnimationFrame(function () {
      flash.style.transition = `opacity ${ms}ms ease-out`;
      flash.style.opacity = "0";
    });
  }

  function blastParts(cx) {
    const S = sceneScale();
    const a = app.getBoundingClientRect();
    $$("#train .part").forEach(function (part) {
      const r = part.getBoundingClientRect();
      const pcx = r.left + r.width / 2 - a.left;
      const dir = pcx < cx ? -1 : 1;
      const dist = Math.abs(pcx - cx) / 100 + 0.6;

      const dx  = dir * rand(160, 400) * dist * S;
      const dy  = -rand(140, 340) * S;
      const rot = dir * rand(120, 460);

      part.style.transition =
        "transform 1s cubic-bezier(.14,.62,.44,1), opacity .95s ease-in";
      part.style.transform =
        `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) rotate(${rot.toFixed(0)}deg) scale(.82)`;
      part.style.opacity = "0";
    });
  }

  function explode() {
    if (exploded) return;
    exploded = true;
    startBtn.disabled = true;
    hint.textContent = "";

    resume();
    playWhistle(0.95);
    train.classList.add("rumbling");
    addShake(3);

    /* Vorknall */
    later(function () {
      const c = trainCenter();
      firelight.style.setProperty("--fx-x", (c.x / app.clientWidth  * 100).toFixed(1) + "%");
      firelight.style.setProperty("--fx-y", (c.y / app.clientHeight * 100).toFixed(1) + "%");
      playThud();
      spawnPrePop(c.x - 40, c.y - 10);
      doFlash(0.35, 260);
      addShake(9);
    }, 850);

    /* Hauptknall */
    later(function () {
      train.classList.remove("rumbling");
      /* Erst die Flacker-Animation abschalten: Keyframes ueberschreiben
         sonst die inline gesetzte Deckkraft und der Kegel bleibt stehen. */
      beam.style.animation = "none";
      beam.style.transition = "opacity .25s";
      beam.style.opacity = "0";

      /* Zugteile vor die vordere Schiene heben, sonst fliegen sie dahinter
         und sehen aus, als steckten sie im Gleis. */
      trainLayer.style.zIndex = "7";

      const c = trainCenter();
      firelight.style.setProperty("--fx-x", (c.x / app.clientWidth  * 100).toFixed(1) + "%");
      firelight.style.setProperty("--fx-y", (c.y / app.clientHeight * 100).toFixed(1) + "%");
      playBlast();
      playDebrisRain();
      spawnBlast(c.x, c.y);
      blastParts(c.x);
      doFlash(0.95, 480);
      addShake(38 * clamp(sceneScale(), 0.5, 1.3));

      later(startFireLoop, 350);

      /* Das Wrack brennt noch eine Weile nach */
      let n = 0;
      emberTimer = setInterval(function () {
        spawnEmbers(c.x, c.y);
        if (++n > 46) { clearInterval(emberTimer); emberTimer = null; stopFireLoop(); }
      }, 110);
    }, 1150);

    /* Der Button quittiert */
    later(function () {
      startBtn.querySelector(".lbl").textContent = "cool";
      startBtn.classList.add("done");
      startBtn.disabled = false;
      hint.textContent = "Taste R setzt die Szene zurück.";
    }, 1900);
  }

  /* Szene in den Ausgangszustand bringen */
  function reset() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (emberTimer) { clearInterval(emberTimer); emberTimer = null; }
    stopFireLoop();

    parts.length = 0;
    waves.length = 0;
    fireGlow = 0;
    firelight.style.opacity = "0";
    shakeAmt = 0;
    camera.style.transform = "";

    $$("#train .part").forEach(function (p) {
      p.style.transition = "none";
      p.style.transform = "";
      p.style.opacity = "";
    });
    /* Reflow erzwingen, damit die entfernte Transition nicht nachwirkt */
    void train.offsetWidth;
    $$("#train .part").forEach(function (p) { p.style.transition = ""; });

    train.classList.remove("rumbling");
    beam.style.animation = "";
    beam.style.transition = "opacity .4s";
    beam.style.opacity = "";
    trainLayer.style.zIndex = "";

    startBtn.querySelector(".lbl").textContent = "Start";
    startBtn.classList.remove("done");
    startBtn.disabled = false;
    hint.textContent = "Pfeiltasten zum Wählen, Enter zum Bestätigen.";

    exploded = false;
  }


  /* ============ 7. Menü, Panels und Tastatursteuerung =========== */

  const menu = $("#menu");
  const menuBtns = $$(".btn", menu);
  const scrim = $("#scrim");
  let sel = 0;
  let openPanel = null;

  function select(i) {
    sel = (i + menuBtns.length) % menuBtns.length;
    menuBtns.forEach(function (b, n) { b.classList.toggle("sel", n === sel); });
    menuBtns[sel].focus({ preventScroll: true });
    uiTick();
  }

  function showPanel(name) {
    openPanel = name;
    scrim.hidden = false;
    $$(".panel", scrim).forEach(function (p) { p.hidden = p.id !== "panel-" + name; });
    const first = $(".panel:not([hidden]) input, .panel:not([hidden]) button", scrim);
    if (first) first.focus({ preventScroll: true });
    uiConfirm();
  }

  function closePanel() {
    if (!openPanel) return;
    openPanel = null;
    scrim.hidden = true;
    $$(".panel", scrim).forEach(function (p) { p.hidden = true; });
    menuBtns[sel].focus({ preventScroll: true });
    uiTick();
  }

  menuBtns.forEach(function (btn, i) {
    btn.addEventListener("mouseenter", function () {
      if (sel !== i) { sel = i; menuBtns.forEach(function (b, n) { b.classList.toggle("sel", n === sel); }); uiTick(); }
    });
    btn.addEventListener("click", function () {
      const action = btn.dataset.action;
      if (action === "start") {
        if (exploded) { uiTick(); return; }
        uiConfirm();
        explode();
      } else if (action === "panel") {
        showPanel(btn.dataset.panel);
      }
    });
  });

  $$("[data-close]", scrim).forEach(function (b) {
    b.addEventListener("click", closePanel);
  });
  scrim.addEventListener("click", function (e) {
    if (e.target === scrim) closePanel();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closePanel(); return; }
    if (openPanel) return;

    if (e.key === "ArrowDown") { e.preventDefault(); select(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); select(sel - 1); }
    else if (e.key === "Enter" || e.key === " ") {
      /* Enter auf einem fokussierten Button löst ohnehin click aus */
      if (document.activeElement !== menuBtns[sel]) {
        e.preventDefault();
        menuBtns[sel].click();
      }
    }
    else if (e.key === "r" || e.key === "R") { reset(); uiTick(); }
  });

  /* --- Optionen --- */
  const optVolume  = $("#optVolume");
  const outVolume  = $("#outVolume");
  const optShake   = $("#optShake");
  const optQuality = $("#optQuality");

  optVolume.value  = settings.volume;
  outVolume.value  = settings.volume;
  optShake.checked = settings.shake;
  optQuality.value = String(settings.quality);

  optVolume.addEventListener("input", function () {
    const v = Number(optVolume.value);
    outVolume.value = v;
    setVolume(v);
  });
  optVolume.addEventListener("change", function () { saveSettings(); uiTick(); });

  optShake.addEventListener("change", function () {
    settings.shake = optShake.checked;
    saveSettings();
    uiTick();
  });

  optQuality.addEventListener("change", function () {
    settings.quality = Number(optQuality.value);
    saveSettings();
    uiTick();
  });


  /* ========================== Start ============================= */

  buildTrees();
  buildGrass();
  buildPoles();
  resize();

  window.addEventListener("resize", resize);
  menuBtns[0].classList.add("sel");

  requestAnimationFrame(frame);
})();
