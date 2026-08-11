import test from "node:test";
import assert from "node:assert/strict";

import { EventBus, GAME_EVENT } from "../src/core/events.js";
import { Rng } from "../src/core/rng.js";
import { SaveSystem, MemoryStorage, SAVE_SLOT, SCHEMA_VERSIONS } from "../src/core/saveSystem.js";
import { Settings } from "../src/core/settings.js";
import { GameStateManager, STATE } from "../src/core/gameState.js";
import { Localization, formatMoney, formatDuration, interpolate } from "../src/core/localization.js";
import { InputManager, ACTION, DEFAULT_BINDINGS, labelForBinding } from "../src/core/input.js";
import en from "../src/data/locales/en.js";
import de from "../src/data/locales/de.js";
import { SETTINGS_DEFAULTS, MODES } from "../src/data/balance.js";

/* -------------------------------------------------------------- event bus */

test("listeners receive events and can unsubscribe", () => {
  const bus = new EventBus();
  const seen = [];
  const off = bus.on("test", (payload) => seen.push(payload));

  bus.emit("test", 1);
  off();
  bus.emit("test", 2);

  assert.deepEqual(seen, [1]);
  assert.equal(bus.listenerCount("test"), 0);
});

test("once fires exactly once", () => {
  const bus = new EventBus();
  let count = 0;
  bus.once("test", () => (count += 1));
  bus.emit("test");
  bus.emit("test");
  assert.equal(count, 1);
});

test("one broken listener does not stop the others", () => {
  const bus = new EventBus();
  const seen = [];
  const originalError = console.error;
  console.error = () => {};

  bus.on("test", () => {
    throw new Error("a broken HUD widget");
  });
  bus.on("test", () => seen.push("still ran"));
  bus.emit("test");

  console.error = originalError;
  assert.deepEqual(seen, ["still ran"]);
});

test("a listener may unsubscribe itself while the event is being delivered", () => {
  const bus = new EventBus();
  const seen = [];
  const off = bus.on("test", () => {
    seen.push("first");
    off();
  });
  bus.on("test", () => seen.push("second"));

  bus.emit("test");
  bus.emit("test");
  assert.deepEqual(seen, ["first", "second", "second"]);
});

test("every event name is unique", () => {
  const names = Object.values(GAME_EVENT);
  assert.equal(new Set(names).size, names.length);
});

/* -------------------------------------------------------------------- rng */

test("the same seed produces the same run", () => {
  const a = new Rng(42);
  const b = new Rng(42);
  const drawsA = Array.from({ length: 20 }, () => a.next());
  const drawsB = Array.from({ length: 20 }, () => b.next());
  assert.deepEqual(drawsA, drawsB);
});

test("different seeds produce different runs", () => {
  const a = Array.from({ length: 20 }, (_, i) => new Rng(1).next());
  const b = new Rng(2).next();
  assert.notEqual(a[0], b);
});

test("integers stay inside their bounds", () => {
  const rng = new Rng(9);
  for (let i = 0; i < 500; i += 1) {
    const value = rng.integer(3, 7);
    assert.ok(value >= 3 && value <= 7 && Number.isInteger(value));
  }
});

test("weighted picks follow their weights", () => {
  const rng = new Rng(5);
  const counts = { common: 0, rare: 0 };
  for (let i = 0; i < 4000; i += 1) counts[rng.weighted({ common: 9, rare: 1 })] += 1;

  const rareShare = counts.rare / 4000;
  assert.ok(rareShare > 0.06 && rareShare < 0.14, `rare came up ${rareShare}`);
});

test("a zero weight is never picked", () => {
  const rng = new Rng(3);
  for (let i = 0; i < 200; i += 1) {
    assert.equal(rng.weighted({ yes: 1, never: 0 }), "yes");
  }
});

test("rng state survives a save round trip", () => {
  const rng = new Rng(77);
  for (let i = 0; i < 10; i += 1) rng.next();

  const restored = Rng.deserialize(rng.serialize());
  assert.equal(restored.next(), rng.next());
});

/* ------------------------------------------------------------ save system */

test("a save round trips", () => {
  const save = new SaveSystem(new MemoryStorage());
  save.save(SAVE_SLOT.settings, { volume: 60, blood: false });

  assert.deepEqual(save.load(SAVE_SLOT.settings), { volume: 60, blood: false });
  assert.ok(save.has(SAVE_SLOT.settings));
});

test("an empty slot returns the fallback", () => {
  const save = new SaveSystem(new MemoryStorage());
  assert.equal(save.load(SAVE_SLOT.run, null), null);
  assert.deepEqual(save.load(SAVE_SLOT.run, { fresh: true }), { fresh: true });
});

test("a corrupt save is ignored rather than crashing the game", () => {
  const storage = new MemoryStorage();
  storage.setItem("lasttrain.run", "{ this is not json");
  const save = new SaveSystem(storage);

  const originalWarn = console.warn;
  console.warn = () => {};
  const loaded = save.load(SAVE_SLOT.run, { fresh: true });
  console.warn = originalWarn;

  assert.deepEqual(loaded, { fresh: true });
});

test("a save from a newer build is refused instead of misread", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    "lasttrain.run",
    JSON.stringify({ version: SCHEMA_VERSIONS[SAVE_SLOT.run] + 5, data: { money: 1 } }),
  );
  const save = new SaveSystem(storage);

  const originalWarn = console.warn;
  console.warn = () => {};
  assert.equal(save.load(SAVE_SLOT.run, null), null);
  console.warn = originalWarn;
});

test("an unserialisable payload leaves the previous save intact", () => {
  const save = new SaveSystem(new MemoryStorage());
  save.save(SAVE_SLOT.run, { good: true });

  const circular = {};
  circular.self = circular;

  const originalWarn = console.warn;
  console.warn = () => {};
  assert.equal(save.save(SAVE_SLOT.run, circular), false);
  console.warn = originalWarn;

  assert.deepEqual(save.load(SAVE_SLOT.run), { good: true }, "the old save survived");
});

test("clearing a slot empties it", () => {
  const save = new SaveSystem(new MemoryStorage());
  save.save(SAVE_SLOT.run, { a: 1 });
  save.clear(SAVE_SLOT.run);
  assert.equal(save.has(SAVE_SLOT.run), false);
});

test("saving to an unknown slot is a programming error, not a silent no-op", () => {
  const save = new SaveSystem(new MemoryStorage());
  assert.throws(() => save.save("not_a_slot", {}), /Unknown save slot/);
});

/* --------------------------------------------------------------- settings */

test("settings start at their defaults and persist immediately", () => {
  const storage = new MemoryStorage();
  const save = new SaveSystem(storage);
  const settings = new Settings({ saveSystem: save, events: new EventBus() });

  assert.equal(settings.volume, 100, "full volume by default");
  assert.equal(settings.blood, true);
  assert.equal(settings.mode, MODES.normal.id);

  settings.set("volume", 40);
  const reloaded = new Settings({ saveSystem: new SaveSystem(storage), events: new EventBus() });
  assert.equal(reloaded.volume, 40, "it was written straight away");
});

test("volume is clamped and rounded, however it is set", () => {
  const settings = new Settings({ saveSystem: new SaveSystem(new MemoryStorage()) });
  assert.equal(settings.set("volume", 4000), 100);
  assert.equal(settings.set("volume", -20), 0);
  assert.equal(settings.set("volume", 33.6), 34);
  assert.equal(settings.set("volume", "not a number"), SETTINGS_DEFAULTS.volume);
});

test("volume converts to a gain the mixer can use", () => {
  const settings = new Settings({ saveSystem: new SaveSystem(new MemoryStorage()) });
  settings.set("volume", 50);
  assert.equal(settings.volumeGain, 0.5);
});

test("the blood option is a plain toggle", () => {
  const settings = new Settings({ saveSystem: new SaveSystem(new MemoryStorage()) });
  assert.equal(settings.toggle("blood"), false);
  assert.equal(settings.toggle("blood"), true);
});

test("changing a setting announces it", () => {
  const events = new EventBus();
  const seen = [];
  events.on(GAME_EVENT.settingsChanged, (payload) => seen.push(payload));

  const settings = new Settings({ saveSystem: new SaveSystem(new MemoryStorage()), events });
  settings.set("volume", 10);
  settings.set("volume", 10);

  assert.equal(seen.length, 1, "setting the same value again is not a change");
});

test("a stored language this build no longer ships falls back", () => {
  const storage = new MemoryStorage();
  new SaveSystem(storage).save(SAVE_SLOT.settings, { language: "kl" });

  const localization = new Localization().register("en", en).register("de", de);
  const settings = new Settings({ saveSystem: new SaveSystem(storage), localization });

  assert.equal(settings.language, "en");
});

/* ----------------------------------------------------------- game state */

test("declared transitions are allowed and others are refused", () => {
  const state = new GameStateManager({ events: new EventBus() });
  assert.equal(state.current, STATE.boot);

  assert.ok(state.transitionTo(STATE.mainMenu));
  assert.ok(state.transitionTo(STATE.intro));
  assert.ok(state.transitionTo(STATE.playing));

  const originalError = console.error;
  console.error = () => {};
  assert.equal(state.transitionTo(STATE.victory), false, "you cannot win from the middle of a run");
  console.error = originalError;

  assert.equal(state.current, STATE.playing);
});

test("the simulation only runs in the states that should run it", () => {
  const state = new GameStateManager();
  state.transitionTo(STATE.mainMenu);
  assert.equal(state.isSimulating, false);

  state.transitionTo(STATE.playing);
  assert.ok(state.isSimulating);
  assert.ok(state.allowsCombat);

  state.transitionTo(STATE.paused);
  assert.equal(state.isSimulating, false, "ESC really stops the world");
  assert.equal(state.allowsCombat, false);
});

test("an outpost simulates but is never hostile", () => {
  const state = new GameStateManager();
  state.transitionTo(STATE.mainMenu);
  state.transitionTo(STATE.playing);
  state.transitionTo(STATE.outpost);

  assert.ok(state.isSimulating, "the world keeps moving around the player");
  assert.equal(state.allowsCombat, false, "but nothing attacks");
});

test("an open interface freezes combat without leaving the world", () => {
  const state = new GameStateManager();
  state.transitionTo(STATE.mainMenu);
  state.transitionTo(STATE.playing);
  state.transitionTo(STATE.interface);
  assert.equal(state.allowsCombat, false);
});

test("options can be reached from the menu and from the pause screen alike", () => {
  const state = new GameStateManager();
  state.transitionTo(STATE.mainMenu);
  state.transitionTo(STATE.options);
  assert.ok(state.returnToPrevious());
  assert.equal(state.current, STATE.mainMenu);

  state.transitionTo(STATE.playing);
  state.transitionTo(STATE.paused);
  state.transitionTo(STATE.options);
  assert.ok(state.returnToPrevious());
  assert.equal(state.current, STATE.paused);
});

/* ----------------------------------------------------------- localization */

test("both languages are complete and interchangeable", () => {
  const localization = new Localization().register("en", en).register("de", de);
  assert.deepEqual(localization.missingKeys("de"), []);
  assert.deepEqual(localization.availableLanguages, ["en", "de"]);
});

test("the title is a proper name and is never translated", () => {
  assert.equal(en.strings.GAME_TITLE, "LAST TRAIN");
  assert.equal(de.strings.GAME_TITLE, "LAST TRAIN");
});

test("victory reads VICTORY in English and SIEG in German", () => {
  const localization = new Localization().register("en", en).register("de", de);
  assert.equal(localization.t("VICTORY"), "VICTORY");
  localization.setLanguage("de");
  assert.equal(localization.t("VICTORY"), "SIEG");
});

test("switching language announces it and takes effect at once", () => {
  const events = new EventBus();
  const seen = [];
  events.on(GAME_EVENT.languageChanged, (payload) => seen.push(payload.language));

  const localization = new Localization({ events }).register("en", en).register("de", de);
  assert.equal(localization.t("MENU_CONTINUE"), "Continue");

  localization.setLanguage("de");
  assert.equal(localization.t("MENU_CONTINUE"), "Fortfahren");
  assert.deepEqual(seen, ["de"]);
});

test("an unknown language is refused rather than blanking the menus", () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const localization = new Localization().register("en", en);
  assert.equal(localization.setLanguage("kl"), false);
  console.warn = originalWarn;
  assert.equal(localization.language, "en");
});

test("a missing key is loud, not blank", () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const localization = new Localization().register("en", en);
  const result = localization.t("NOT_A_REAL_KEY");
  console.warn = originalWarn;

  assert.ok(result.includes("NOT_A_REAL_KEY"));
});

test("placeholders are filled in, and unknown ones are left visible", () => {
  assert.equal(interpolate("Press {key}", { key: "E" }), "Press E");
  assert.equal(interpolate("Press {key}", {}), "Press {key}");
});

test("a key missing from one language falls back to English", () => {
  const partial = { nameKey: "Teil", strings: { MENU_START: "Anfangen" } };
  const localization = new Localization().register("en", en).register("de", partial);
  localization.setLanguage("de");

  assert.equal(localization.t("MENU_START"), "Anfangen");
  assert.equal(localization.t("MENU_OPTIONS"), "Options", "falls back rather than breaking");
});

test("money is a bare number with no currency marker", () => {
  for (const amount of [10, 350, 1250]) {
    assert.equal(formatMoney(amount), String(amount));
  }
  assert.equal(formatMoney(1250.6), "1251");
  assert.ok(!/[€$C]/.test(formatMoney(1250)));
});

test("durations read as a run time", () => {
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3725), "1:02:05");
  assert.equal(formatDuration(0), "0:00");
});

/* -------------------------------------------------------------- input */

test("actions are held, pressed and released as separate facts", () => {
  const input = new InputManager();
  const bindings = input.snapshotBindings();
  assert.deepEqual(bindings[ACTION.weaponWheel], ["Tab"]);
  assert.deepEqual(bindings[ACTION.pause], ["Escape"]);
  assert.deepEqual(bindings[ACTION.moveForward], ["KeyW"]);
});

test("prompts show the key that is actually bound", () => {
  const input = new InputManager();
  assert.equal(input.primaryLabel(ACTION.interact), "E");
  assert.equal(input.primaryLabel(ACTION.weaponWheel), "Tab");
  assert.equal(input.primaryLabel(ACTION.fire), "LMB");

  input.rebind(ACTION.interact, ["KeyF"]);
  assert.equal(input.primaryLabel(ACTION.interact), "F", "and follow a rebind");
});

test("rebinding an action that does not exist is a programming error", () => {
  const input = new InputManager();
  assert.throws(() => input.rebind("fly", ["KeyQ"]), /Unknown action/);
});

test("key labels are readable", () => {
  assert.equal(labelForBinding("KeyE"), "E");
  assert.equal(labelForBinding("ShiftLeft"), "Shift");
  assert.equal(labelForBinding("Mouse0"), "LMB");
  assert.equal(labelForBinding("Escape"), "Esc");
});

test("every action has at least one default binding", () => {
  for (const action of Object.values(ACTION)) {
    assert.ok(DEFAULT_BINDINGS[action]?.length > 0, `${action} is unbound`);
  }
});
