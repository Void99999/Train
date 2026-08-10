/**
 * LAST TRAIN - the sound catalogue.
 *
 * Each entry describes one sound in terms of the engine's primitives. Keeping
 * them here rather than scattered through gameplay code means a weapon asks
 * for "pistol" and never knows how a pistol is made - which is what will let
 * recorded audio replace these without touching a single system.
 *
 * The shapes are chosen for weight and readability rather than for realism:
 * a pistol is a short bright crack, a heavy cannon is a long low blast with a
 * body that arrives after the transient. A player should be able to tell what
 * fired without looking.
 */

/** Small pitch variation, so a repeated sound never sounds like a loop. */
function vary(rng, amount = 0.12) {
  return 1 + (rng() * 2 - 1) * amount;
}

/**
 * Builds the catalogue. Every entry is `(engine, options) => void`.
 * @param {() => number} random
 */
export function createSoundLibrary(random = Math.random) {
  const sounds = {};

  /* ------------------------------------------------------------- weapons */

  /**
   * A gunshot: a bright crack, a body underneath it, and a tail.
   * The three layers are what stop it sounding like a hiss.
   */
  const gunshot = ({ crack, body, tail, gain }) =>
    (engine, { position = null } = {}) => {
      const pitch = vary(random, 0.08);

      // The transient - what makes it read as a shot rather than a whoosh.
      engine.noiseBurst({
        duration: crack.duration,
        attack: 0.001,
        gain: gain * 0.9,
        filter: "bandpass",
        startFrequency: crack.from * pitch,
        endFrequency: crack.to * pitch,
        q: 0.8,
        bus: "weapons",
        position,
      });

      // The body: low energy that gives the weapon its size.
      engine.noiseBurst({
        duration: body.duration,
        attack: 0.004,
        gain: gain * 0.75,
        filter: "lowpass",
        startFrequency: body.from * pitch,
        endFrequency: body.to * pitch,
        bus: "weapons",
        position,
      });

      // The tail: the room, or the open country.
      if (tail) {
        engine.noiseBurst({
          duration: tail.duration,
          attack: 0.02,
          gain: gain * tail.gain,
          filter: "lowpass",
          startFrequency: tail.from,
          endFrequency: tail.to,
          bus: "weapons",
          position,
        });
      }
    };

  sounds.pistol = gunshot({
    gain: 0.5,
    crack: { duration: 0.07, from: 3200, to: 900 },
    body: { duration: 0.14, from: 900, to: 160 },
    tail: { duration: 0.3, from: 500, to: 120, gain: 0.18 },
  });

  sounds.assault_rifle = gunshot({
    gain: 0.6,
    crack: { duration: 0.06, from: 4200, to: 1100 },
    body: { duration: 0.18, from: 1200, to: 130 },
    tail: { duration: 0.42, from: 700, to: 100, gain: 0.24 },
  });

  sounds.minigun = gunshot({
    gain: 0.4,
    crack: { duration: 0.04, from: 3600, to: 1000 },
    body: { duration: 0.1, from: 1000, to: 150 },
    tail: null,
  });

  sounds.mounted_machine_gun = gunshot({
    gain: 0.7,
    crack: { duration: 0.075, from: 3000, to: 800 },
    body: { duration: 0.24, from: 850, to: 95 },
    tail: { duration: 0.5, from: 600, to: 80, gain: 0.3 },
  });

  /** The launch, not the impact. The warhead going off is `explosion`. */
  sounds.rpg = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.5,
      attack: 0.006,
      gain: 0.65,
      filter: "lowpass",
      startFrequency: 1800,
      endFrequency: 220,
      bus: "weapons",
      position,
    });
    // The rocket motor climbing away.
    engine.noiseBurst({
      duration: 1.1,
      attack: 0.05,
      gain: 0.3,
      filter: "bandpass",
      startFrequency: 900,
      endFrequency: 2600,
      q: 0.6,
      bus: "weapons",
      position,
    });
  };

  sounds.mounted_rocket_launcher = (engine, options) => {
    sounds.rpg(engine, options);
    engine.tone({
      frequency: 90,
      endFrequency: 40,
      duration: 0.6,
      gain: 0.35,
      type: "triangle",
      bus: "weapons",
      position: options?.position ?? null,
    });
  };

  /** The heavy turret. Long, low, and clearly a different class of weapon. */
  sounds.heavy_turret_cannon = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.16,
      attack: 0.001,
      gain: 0.9,
      filter: "bandpass",
      startFrequency: 2200,
      endFrequency: 300,
      q: 0.5,
      bus: "weapons",
      position,
    });
    engine.noiseBurst({
      duration: 1.4,
      attack: 0.01,
      gain: 0.85,
      filter: "lowpass",
      startFrequency: 420,
      endFrequency: 45,
      bus: "weapons",
      position,
    });
    engine.tone({
      frequency: 62,
      endFrequency: 28,
      duration: 1.6,
      gain: 0.5,
      type: "sine",
      bus: "weapons",
      position,
    });
  };

  sounds.enemy_rifle = gunshot({
    gain: 0.32,
    crack: { duration: 0.06, from: 3400, to: 950 },
    body: { duration: 0.16, from: 950, to: 140 },
    tail: { duration: 0.45, from: 600, to: 90, gain: 0.2 },
  });

  sounds.enemy_tank_cannon = sounds.heavy_turret_cannon;

  /* ---------------------------------------------------------- explosions */

  sounds.explosion = (engine, { position = null, scale = 1 } = {}) => {
    engine.noiseBurst({
      duration: 0.12 * scale,
      attack: 0.001,
      gain: 0.85,
      filter: "highpass",
      startFrequency: 1800,
      endFrequency: 700,
      bus: "weapons",
      position,
    });
    engine.noiseBurst({
      duration: 1.9 * scale,
      attack: 0.008,
      gain: 0.9,
      filter: "lowpass",
      startFrequency: 700,
      endFrequency: 35,
      bus: "weapons",
      position,
    });
    // The sub-bass thump you feel more than hear.
    engine.tone({
      frequency: 48 / scale,
      endFrequency: 20,
      duration: 1.6 * scale,
      gain: 0.6,
      type: "sine",
      bus: "weapons",
      position,
    });
  };

  /** A round striking metal. Bright, short, metallic. */
  sounds.impact_metal = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.09,
      attack: 0.001,
      gain: 0.35,
      filter: "bandpass",
      startFrequency: 4200 * vary(random, 0.2),
      endFrequency: 1400,
      q: 3,
      bus: "world",
      position,
    });
    engine.tone({
      frequency: 1800 * vary(random, 0.25),
      endFrequency: 900,
      duration: 0.14,
      gain: 0.12,
      type: "triangle",
      bus: "world",
      position,
    });
  };

  sounds.impact_dirt = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.16,
      attack: 0.002,
      gain: 0.28,
      filter: "lowpass",
      startFrequency: 1200,
      endFrequency: 180,
      bus: "world",
      position,
    });
  };

  /* ------------------------------------------------------------- player */

  /** Boot on a steel deck. Pitch varies so a walk cycle does not tick. */
  sounds.footstep = (engine, { position = null, running = false } = {}) => {
    engine.noiseBurst({
      duration: running ? 0.13 : 0.16,
      attack: 0.002,
      gain: running ? 0.24 : 0.15,
      filter: "bandpass",
      startFrequency: 900 * vary(random, 0.25),
      endFrequency: 200,
      q: 1.2,
      bus: "world",
      position,
    });
    engine.tone({
      frequency: 130 * vary(random, 0.2),
      endFrequency: 70,
      duration: 0.1,
      gain: running ? 0.1 : 0.06,
      type: "sine",
      bus: "world",
      position,
    });
  };

  sounds.hurt = (engine) => {
    engine.noiseBurst({
      duration: 0.35,
      attack: 0.004,
      gain: 0.4,
      filter: "lowpass",
      startFrequency: 700,
      endFrequency: 120,
      bus: "world",
    });
    engine.tone({ frequency: 180, endFrequency: 90, duration: 0.4, gain: 0.2, type: "sine" });
  };

  sounds.heal = (engine) => {
    engine.tone({ frequency: 420, endFrequency: 720, duration: 0.35, gain: 0.16, type: "sine", bus: "ui" });
  };

  /* -------------------------------------------------------------- world */

  /** A heavy steel door on worn hinges. */
  sounds.door = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.6,
      attack: 0.03,
      gain: 0.3,
      filter: "bandpass",
      startFrequency: 380,
      endFrequency: 1500,
      q: 6,
      bus: "world",
      position,
    });
    engine.tone({
      frequency: 150,
      endFrequency: 90,
      duration: 0.35,
      gain: 0.2,
      type: "square",
      bus: "world",
      position,
    });
  };

  /** A switch, a lever, a notch going in. */
  sounds.mechanical_clunk = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.09,
      attack: 0.001,
      gain: 0.3,
      filter: "bandpass",
      startFrequency: 1600 * vary(random, 0.15),
      endFrequency: 350,
      q: 2.5,
      bus: "world",
      position,
    });
    engine.tone({
      frequency: 220 * vary(random, 0.1),
      endFrequency: 120,
      duration: 0.12,
      gain: 0.18,
      type: "square",
      bus: "world",
      position,
    });
  };

  /** A rail joint passing under the wheels. The heartbeat of the journey. */
  sounds.rail_clack = (engine, { position = null, intensity = 1 } = {}) => {
    engine.noiseBurst({
      duration: 0.075,
      attack: 0.001,
      gain: 0.22 * intensity,
      filter: "bandpass",
      startFrequency: 1500 * vary(random, 0.3),
      endFrequency: 260,
      q: 1.6,
      bus: "train",
      position,
    });
    engine.tone({
      frequency: 95 * vary(random, 0.18),
      endFrequency: 55,
      duration: 0.11,
      gain: 0.14 * intensity,
      type: "sine",
      bus: "train",
      position,
    });
  };

  /** Structural groan from the couplings and the frame. */
  sounds.metal_stress = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 1.2,
      attack: 0.1,
      gain: 0.14,
      filter: "bandpass",
      startFrequency: 220 * vary(random, 0.3),
      endFrequency: 620,
      q: 8,
      bus: "train",
      position,
    });
  };

  sounds.coupling = (engine, { position = null } = {}) => {
    engine.noiseBurst({
      duration: 0.3,
      attack: 0.001,
      gain: 0.5,
      filter: "lowpass",
      startFrequency: 900,
      endFrequency: 70,
      bus: "train",
      position,
    });
  };

  /* ----------------------------------------------------------------- UI */

  sounds.ui_move = (engine) => {
    engine.tone({ frequency: 620, duration: 0.05, gain: 0.06, type: "sine", bus: "ui" });
  };

  sounds.ui_confirm = (engine) => {
    engine.tone({ frequency: 520, endFrequency: 780, duration: 0.12, gain: 0.09, type: "sine", bus: "ui" });
  };

  sounds.ui_deny = (engine) => {
    engine.tone({ frequency: 220, endFrequency: 140, duration: 0.18, gain: 0.09, type: "square", bus: "ui" });
  };

  /** Cockpit warning during the helicopter sequence. */
  sounds.alarm = (engine) => {
    engine.tone({ frequency: 880, duration: 0.22, gain: 0.14, type: "square", bus: "ui" });
  };

  return sounds;
}
