/**
 * LAST TRAIN - audio engine.
 *
 * Every sound in the game is synthesised at runtime through the Web Audio API.
 * Nothing is loaded from a file.
 *
 * That is a deliberate trade. It keeps the project downloadable as a single
 * folder with no assets and no licensing to track, and it means a gunshot can
 * take its pitch and body from the weapon's data rather than from a recording
 * that has to be re-cut every time the balance changes. The cost is that these
 * are *synthesised* sounds: they are convincing placeholders with the right
 * weight and timing, not recorded firearms. They are meant to be replaced with
 * recorded audio before release, and the shape of this file is what makes that
 * swap cheap - callers ask for "pistol", never for an oscillator.
 *
 * A browser will not let audio start before the player interacts with the page,
 * so nothing is created until `resume()` is called from a real gesture.
 */

/** Distance model for positional sounds, in metres. */
const REFERENCE_DISTANCE = 6;
const MAX_DISTANCE = 320;
const ROLLOFF = 1.4;

export class AudioEngine {
  #context = null;
  #master = null;
  #buses = {};
  #noiseBuffer = null;
  #volume = 1;
  #muted = false;
  #listener = { x: 0, y: 0, z: 0 };

  get isReady() {
    return this.#context !== null && this.#context.state === "running";
  }

  get context() {
    return this.#context;
  }

  /**
   * Starts the audio context. Must be called from a user gesture - a click or
   * a key press - or the browser will refuse and everything stays silent.
   */
  resume() {
    if (!this.#context) {
      const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Context) return false;

      this.#context = new Context();
      this.#master = this.#context.createGain();
      this.#master.gain.value = this.#muted ? 0 : this.#volume;
      this.#master.connect(this.#context.destination);

      // Separate buses so a mix change is one line rather than a hunt.
      for (const name of ["train", "weapons", "world", "ui"]) {
        const bus = this.#context.createGain();
        bus.gain.value = 1;
        bus.connect(this.#master);
        this.#buses[name] = bus;
      }
      // Weapons are loud; give the rest room to breathe underneath them.
      this.#buses.weapons.gain.value = 0.85;
      this.#buses.ui.gain.value = 0.5;
    }

    if (this.#context.state === "suspended") this.#context.resume();
    return true;
  }

  bus(name) {
    return this.#buses[name] ?? this.#master;
  }

  /** 0-1. Driven by the volume slider in the options menu. */
  setVolume(value) {
    this.#volume = Math.max(0, Math.min(1, value));
    if (this.#master) {
      this.#master.gain.setTargetAtTime(
        this.#muted ? 0 : this.#volume,
        this.#context.currentTime,
        0.02,
      );
    }
  }

  /** Silences everything without tearing it down - used while paused. */
  setMuted(muted) {
    this.#muted = muted;
    if (this.#master) {
      this.#master.gain.setTargetAtTime(
        muted ? 0 : this.#volume,
        this.#context.currentTime,
        0.05,
      );
    }
  }

  get now() {
    return this.#context?.currentTime ?? 0;
  }

  /** One second of white noise, reused by everything that needs a noise source. */
  noiseBuffer() {
    if (!this.#noiseBuffer && this.#context) {
      const length = this.#context.sampleRate;
      const buffer = this.#context.createBuffer(1, length, this.#context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.#noiseBuffer = buffer;
    }
    return this.#noiseBuffer;
  }

  /**
   * Moves the listener. Positional sounds are placed relative to this.
   * @param {{x,y,z}} position
   * @param {{x,y,z}} forward
   */
  setListener(position, forward) {
    this.#listener = position;
    if (!this.#context) return;

    const listener = this.#context.listener;
    const time = this.#context.currentTime;

    if (listener.positionX) {
      listener.positionX.setTargetAtTime(position.x, time, 0.02);
      listener.positionY.setTargetAtTime(position.y, time, 0.02);
      listener.positionZ.setTargetAtTime(position.z, time, 0.02);
      listener.forwardX.setTargetAtTime(forward.x, time, 0.02);
      listener.forwardY.setTargetAtTime(forward.y, time, 0.02);
      listener.forwardZ.setTargetAtTime(forward.z, time, 0.02);
      listener.upX.setTargetAtTime(0, time, 0.02);
      listener.upY.setTargetAtTime(1, time, 0.02);
      listener.upZ.setTargetAtTime(0, time, 0.02);
    } else if (listener.setPosition) {
      // Older Safari.
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  /**
   * Builds a panner for a sound at a world position, or returns null for a
   * sound that should play flat (the player's own weapon, UI clicks).
   */
  panner(position) {
    if (!position || !this.#context) return null;
    const panner = this.#context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = REFERENCE_DISTANCE;
    panner.maxDistance = MAX_DISTANCE;
    panner.rolloffFactor = ROLLOFF;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    return panner;
  }

  /** Wires `node` to a bus, through a panner when the sound has a position. */
  route(node, { bus = "world", position = null } = {}) {
    const target = this.bus(bus);
    const panner = this.panner(position);
    if (panner) {
      node.connect(panner);
      panner.connect(target);
    } else {
      node.connect(target);
    }
    return node;
  }

  /* ------------------------------------------------------------ primitives */

  /**
   * A burst of filtered noise. The backbone of gunfire, impacts, footsteps and
   * explosions - what separates them is the filter sweep and the envelope.
   */
  noiseBurst({
    duration = 0.2,
    attack = 0.002,
    gain = 0.5,
    filter = "lowpass",
    startFrequency = 2000,
    endFrequency = 400,
    q = 1,
    bus = "world",
    position = null,
    playbackRate = 1,
  } = {}) {
    if (!this.isReady) return null;
    const time = this.#context.currentTime;

    const source = this.#context.createBufferSource();
    source.buffer = this.noiseBuffer();
    source.loop = true;
    source.playbackRate.value = playbackRate;

    const band = this.#context.createBiquadFilter();
    band.type = filter;
    band.Q.value = q;
    band.frequency.setValueAtTime(startFrequency, time);
    band.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), time + duration);

    const envelope = this.#context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(band);
    band.connect(envelope);
    this.route(envelope, { bus, position });

    source.start(time);
    source.stop(time + duration + 0.05);
    return source;
  }

  /** A pitched tone with an envelope. Used for mechanical clanks and alarms. */
  tone({
    frequency = 220,
    endFrequency = null,
    duration = 0.3,
    attack = 0.005,
    gain = 0.3,
    type = "sine",
    bus = "world",
    position = null,
  } = {}) {
    if (!this.isReady) return null;
    const time = this.#context.currentTime;

    const oscillator = this.#context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        time + duration,
      );
    }

    const envelope = this.#context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(envelope);
    this.route(envelope, { bus, position });

    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
    return oscillator;
  }

  /**
   * A continuously running voice the caller keeps and adjusts: engines, wind,
   * rolling stock. Returns handles to the parts worth changing over time.
   */
  createLoop({ type = "noise", frequency = 100, filterType = "lowpass", cutoff = 800, q = 1, bus = "train" }) {
    if (!this.isReady) return null;

    let source;
    if (type === "noise") {
      source = this.#context.createBufferSource();
      source.buffer = this.noiseBuffer();
      source.loop = true;
    } else {
      source = this.#context.createOscillator();
      source.type = type;
      source.frequency.value = frequency;
    }

    const filter = this.#context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = cutoff;
    filter.Q.value = q;

    const gain = this.#context.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus(bus));
    source.start();

    return {
      source,
      filter,
      gain,
      /** Smooth changes; a step change on a running loop is audible as a click. */
      set(target, value, smoothing = 0.08) {
        target.setTargetAtTime(value, this.context.currentTime, smoothing);
      },
      context: this.#context,
      stop: () => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        gain.disconnect();
      },
    };
  }

  dispose() {
    this.#context?.close();
    this.#context = null;
  }
}
