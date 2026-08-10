/**
 * LAST TRAIN - the opening cinematic.
 *
 * Four acts, nineteen shots, and then gameplay:
 *
 *   1. The opening train pulls away and is destroyed.       (shots 1-5)
 *   2. The helicopter over the battlefield, hit, and down.  (shots 6-11)
 *   3. The crawl away from the fighting to the shelter.     (shots 12-15)
 *   4. The green locomotive, full power, and away.          (shots 16-19)
 *
 * The train destroyed in act one is not the player's locomotive. It is the
 * machine from the title screen, and blowing it up is how the title screen
 * hands over to the story.
 *
 * Every shot restores whatever it changed, because the cutscene director runs
 * the remaining `onExit` callbacks when the player skips. Watching the intro
 * and skipping it must leave the world in exactly the same state.
 */

import { Cutscene, ease, lerpPoint } from "./cutsceneDirector.js";
import { cabDimensions } from "../render/interiors.js";

/** Points the camera at a target from a position, in one call. */
function place(context, position, target) {
  context.camera.position.set(position.x, position.y, position.z);
  context.camera.lookAt(target.x, target.y, target.z);
}

/** Deterministic-enough shake for impacts and injury. */
function shake(amount, elapsed, frequency = 37) {
  return {
    x: Math.sin(elapsed * frequency) * amount,
    y: Math.sin(elapsed * frequency * 1.7 + 1.1) * amount,
    z: Math.sin(elapsed * frequency * 0.8 + 2.3) * amount,
  };
}

function offset(point, delta) {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}

/**
 * Builds the opening cutscene.
 *
 * @param {object} options
 * @param {Function} options.onFinished called once the intro is over, however
 *                                      it ended - watched or skipped
 */
export function createIntroSequence({ onFinished }) {
  const shots = [];

  /* =================================================== act one: the train */

  shots.push({
    name: "establish",
    duration: 3.2,
    onEnter(context) {
      context.world.setRailwayVisible(true);
      context.world.setTrainVisible(true);
      context.stage.hideAll();
      context.dayNight.setTimeOfDay(0.02);
      context.scrollSpeed = 0;
      context.overlay.setFade(0);
    },
    onUpdate(t, elapsed, context) {
      context.overlay.setLetterbox(ease(t * 2));
      const from = { x: 15, y: 4.6, z: 17 };
      const to = { x: 12, y: 4.0, z: 13 };
      place(context, lerpPoint(from, to, ease(t)), { x: -1, y: 2.6, z: 0 });
    },
  });

  shots.push({
    name: "train-departs",
    duration: 3.6,
    onUpdate(t, elapsed, context) {
      // The world scrolls rather than the train moving, so "pulling away" is
      // a rising scroll speed under a tracking camera.
      context.scrollSpeed = ease(t) * 16;
      const from = { x: 12, y: 4.0, z: 13 };
      const to = { x: 9, y: 3.4, z: -4 };
      place(context, lerpPoint(from, to, ease(t)), { x: 0, y: 2.4, z: 2 });
    },
  });

  shots.push({
    name: "train-explodes",
    duration: 2.6,
    onEnter(context) {
      context.stage.explodeAt({ x: 0, y: 2.6, z: 1 }, { scale: 1.6, duration: 7 });
      context.overlay.setFlash(1);
      // The locomotive is gone from this instant: what is left is the fireball
      // and the debris coming back down.
      context.world.setTrainVisible(false);
      context.scrollSpeed = 4;
    },
    onUpdate(t, elapsed, context) {
      context.overlay.setFlash(Math.max(0, 1 - t * 4));
      context.scrollSpeed = Math.max(0, 4 * (1 - t));

      const base = { x: 9, y: 3.4, z: -4 };
      const drift = lerpPoint(base, { x: 13, y: 5.2, z: -9 }, ease(t));
      place(context, offset(drift, shake(0.55 * (1 - t), elapsed)), { x: 0, y: 3, z: 1 });
    },
    onExit(context) {
      context.overlay.setFlash(0);
      context.scrollSpeed = 0;
    },
  });

  shots.push({
    name: "wreckage",
    duration: 2.2,
    onUpdate(t, elapsed, context) {
      const from = { x: 13, y: 5.2, z: -9 };
      const to = { x: 17, y: 6.4, z: -15 };
      place(context, lerpPoint(from, to, ease(t)), { x: 0, y: 2, z: 0 });
    },
  });

  shots.push({
    name: "fade-to-black-1",
    duration: 1.6,
    onUpdate(t, elapsed, context) {
      context.overlay.setFade(ease(t));
    },
    onExit(context) {
      context.overlay.setFade(1);
    },
  });

  /* ============================================ act two: the helicopter */

  shots.push({
    name: "battlefield-reveal",
    duration: 2.6,
    onEnter(context) {
      // The battlefield occupies the same space as the railway, so the two
      // are swapped rather than kept apart.
      context.world.setRailwayVisible(false);
      context.world.setTrainVisible(false);
      context.stage.setVisible("shelter", false);
      context.stage.setVisible("battlefield", true);
      context.stage.setVisible("helicopter", true);
      context.stage.setVisible("doorGun", true);
      context.stage.setRotorSpeed(1);
      context.stage.setHelicopterDamage(0);
      context.scrollSpeed = 0;

      context.stage.helicopter.position.set(0, 58, -40);
      context.stage.helicopter.rotation.set(0.06, 0, -0.12);
    },
    onUpdate(t, elapsed, context) {
      context.overlay.setFade(1 - ease(t));
      flyHelicopter(context, elapsed, { forward: 16, bank: -0.12 });
      rideInDoorway(context, elapsed, { lookDown: 0.5 });
    },
  });

  shots.push({
    name: "over-the-battlefield",
    duration: 4.2,
    onUpdate(t, elapsed, context) {
      flyHelicopter(context, elapsed, { forward: 16, bank: -0.12 - Math.sin(elapsed * 0.4) * 0.06 });
      rideInDoorway(context, elapsed, { lookDown: 0.5 - t * 0.12 });
    },
  });

  shots.push({
    name: "door-gun",
    duration: 3.6,
    onUpdate(t, elapsed, context) {
      flyHelicopter(context, elapsed, { forward: 16, bank: -0.15 });
      rideInDoorway(context, elapsed, { lookDown: 0.42, recoil: true });

      // The weapon fires in bursts rather than continuously.
      const inBurst = Math.sin(elapsed * 2.2) > -0.25;
      const pulse = inBurst ? 0.55 + Math.abs(Math.sin(elapsed * 46)) * 0.45 : 0;
      context.stage.setMuzzleFlash(pulse);
    },
    onExit(context) {
      context.stage.setMuzzleFlash(0);
    },
  });

  shots.push({
    name: "helicopter-hit",
    duration: 1.8,
    onEnter(context) {
      context.overlay.setFlash(0.9);
      context.stage.explodeAt(
        context.stage.helicopter.position.clone().add({ x: 0, y: 0.5, z: -5 }),
        { scale: 0.5, duration: 3 },
      );
    },
    onUpdate(t, elapsed, context) {
      context.overlay.setFlash(Math.max(0, 0.9 - t * 3));
      // The alarm comes up as the engine note falls away.
      context.overlay.setAlarm(ease(t) * 0.85);
      context.stage.setHelicopterDamage(ease(t) * 0.7);
      context.stage.setRotorSpeed(1 - ease(t) * 0.35);

      flyHelicopter(context, elapsed, { forward: 14, bank: -0.15 - ease(t) * 0.3 });
      rideInDoorway(context, elapsed, { lookDown: 0.42, shakeAmount: ease(t) * 0.2 });
    },
    onExit(context) {
      context.overlay.setFlash(0);
    },
  });

  shots.push({
    name: "losing-control",
    duration: 3.8,
    onUpdate(t, elapsed, context) {
      // Alarm pulses rather than sitting steady - a warning, not a filter.
      context.overlay.setAlarm(0.55 + Math.abs(Math.sin(elapsed * 6)) * 0.4);
      context.stage.setHelicopterDamage(0.7 + ease(t) * 0.3);
      context.stage.setRotorSpeed(0.65 - ease(t) * 0.4);

      const helicopter = context.stage.helicopter;
      helicopter.position.y = 58 - ease(t) * 44;
      helicopter.position.z += 14 * 0.016;
      helicopter.rotation.y += 0.02 + ease(t) * 0.08;
      helicopter.rotation.z = -0.45 - ease(t) * 0.35;
      helicopter.rotation.x = 0.12 + ease(t) * 0.25;

      rideInDoorway(context, elapsed, { lookDown: 0.55 + t * 0.3, shakeAmount: 0.18 + t * 0.35 });
    },
  });

  shots.push({
    name: "crash",
    duration: 2.2,
    onEnter(context) {
      const helicopter = context.stage.helicopter;
      context.stage.explodeAt(
        { x: helicopter.position.x, y: 1.5, z: helicopter.position.z },
        { scale: 2.2, duration: 8 },
      );
      context.overlay.setFlash(1);
      context.stage.setVisible("helicopter", false);
      context.stage.setVisible("doorGun", false);
    },
    onUpdate(t, elapsed, context) {
      context.overlay.setFlash(Math.max(0, 1 - t * 2.2));
      context.overlay.setAlarm(Math.max(0, 0.9 - t * 1.6));
      // Fade begins before the flash has finished, so the two overlap.
      context.overlay.setFade(Math.max(0, (t - 0.5) * 2));
    },
    onExit(context) {
      context.overlay.setFade(1);
      context.overlay.setFlash(0);
      context.overlay.setAlarm(0);
    },
  });

  /* ================================================ act three: the crawl */

  /*
   * The crawl runs up the line of the track, so the shelter and the locomotive
   * are ahead of him the whole way rather than appearing at the end. Nothing
   * is placed in this lane - see the corridor rule in cinematicStage.js.
   */
  const CRAWL_START = { x: 2.6, y: 0.42, z: -56 };
  const CRAWL_END = { x: 3.2, y: 0.42, z: -18 };
  /** Where he stands up, and where the walk to the cab begins. */
  const STAND_AT = { x: 3.2, z: -18 };
  /** The cab's side door, which is the thing he actually walks to. */
  const CAB_DOOR = { x: 2.6, z: -4.6 };

  shots.push({
    name: "wake-on-the-ground",
    duration: 2.2,
    onEnter(context) {
      // The shelter carries its own railway - track, ballast, sleepers,
      // platform and yard lamps - and it sits at the origin, so the world's
      // locomotive is standing on those rails from this moment on.
      context.stage.setVisible("shelter", true);
      context.stage.shelter.position.set(0, 0, 0);
      context.stage.shelter.rotation.y = 0;
      // The train is visible from here to the end of the intro: he can see
      // where he is crawling to.
      context.world.setTrainVisible(true);
    },
    onUpdate(t, elapsed, context) {
      context.overlay.setFade(1 - ease(t));
      const eye = offset(CRAWL_START, shake(0.05 * (1 - t * 0.5), elapsed, 9));
      place(context, eye, { x: 0, y: 2.4, z: 0 });
    },
  });

  shots.push({
    name: "crawling",
    duration: 6.5,
    onUpdate(t, elapsed, context) {
      const position = lerpPoint(CRAWL_START, lerpPoint(CRAWL_START, CRAWL_END, 0.6), t);

      // Each drag forward: the body rocks, and the head dips with the effort.
      const stroke = Math.sin(elapsed * 2.1);
      const eye = offset(position, {
        x: stroke * 0.14,
        y: Math.abs(Math.sin(elapsed * 2.1)) * 0.07 - 0.02,
        z: 0,
      });

      place(context, eye, {
        x: stroke * 0.9,
        y: 2.0 + Math.sin(elapsed * 1.3) * 0.4,
        z: 0,
      });
    },
  });

  shots.push({
    name: "reaching-the-shelter",
    duration: 4.5,
    onUpdate(t, elapsed, context) {
      const from = lerpPoint(CRAWL_START, CRAWL_END, 0.6);
      const position = lerpPoint(from, CRAWL_END, ease(t));

      const stroke = Math.sin(elapsed * 1.7);
      const eye = offset(position, {
        x: stroke * 0.1,
        y: Math.abs(Math.sin(elapsed * 1.7)) * 0.05,
        z: 0,
      });
      place(context, eye, { x: stroke * 0.4, y: 2.2, z: -2 });
    },
  });

  shots.push({
    name: "standing-up",
    duration: 3.2,
    onUpdate(t, elapsed, context) {
      // Rising is slow and unsteady, and the shake fades as he finds his feet.
      const rise = ease(Math.min(1, t * 1.15));
      const height = 0.42 + rise * 1.26;
      const unsteady = (1 - rise) * 0.09 + 0.02;

      const eye = offset({ x: STAND_AT.x, y: height, z: STAND_AT.z }, shake(unsteady, elapsed, 11));
      place(context, eye, { x: 0.4, y: 1.4 + rise * 1.2, z: -6 });
    },
  });

  /*
   * He walks to the locomotive and climbs in.
   *
   * These two shots exist because he used to stand up outside and then simply
   * be inside the cab. Nothing hid that cut, so it read as a teleport. He now
   * covers the ground on foot, on camera.
   */
  shots.push({
    name: "walking-to-the-train",
    duration: 5.0,
    onUpdate(t, elapsed, context) {
      const walk = ease(t);
      const position = {
        x: STAND_AT.x + (CAB_DOOR.x - STAND_AT.x) * walk,
        y: 1.68,
        z: STAND_AT.z + (CAB_DOOR.z - STAND_AT.z) * walk,
      };

      // An injured, heavy walk: a pronounced limp rather than a steady bob.
      const step = elapsed * 3.4;
      const limp = Math.abs(Math.sin(step)) * 0.05 + Math.max(0, Math.sin(step * 0.5)) * 0.03;
      const eye = offset(position, {
        x: Math.sin(step * 0.5) * 0.05,
        y: -limp,
        z: 0,
      });

      // He looks at the cab door he is heading for.
      place(context, eye, { x: 1.2, y: 2.4, z: -3.4 });
    },
  });

  shots.push({
    name: "climbing-into-the-cab",
    duration: 3.6,
    onUpdate(t, elapsed, context) {
      const climb = ease(t);
      const cab = context.cabDimensions;

      // Up the steps and in through the doorway: the eye rises as it crosses
      // the threshold, which is what climbing into a locomotive feels like.
      const from = { x: CAB_DOOR.x, y: 1.68, z: CAB_DOOR.z };
      const to = { x: 0.55, y: cab.floorY + 1.62, z: cab.centreZ - 0.5 };
      const eye = lerpPoint(from, to, climb);

      // The pull on the grab handle, and the step up.
      const effort = Math.sin(climb * Math.PI) * 0.05;
      place(
        context,
        offset(eye, { x: 0, y: effort, z: 0 }),
        { x: -0.4, y: cab.floorY + 1.3, z: cab.frontZ },
      );
    },
    onExit(context) {
      // He is inside now, and the walls hide the swap: the battlefield goes
      // away and the running railway comes back.
      context.stage.hideAll();
      context.world.setRailwayVisible(true);
      context.world.setTrainVisible(true);
    },
  });

  shots.push({
    name: "in-the-cab",
    duration: 3.2,
    onEnter(context) {
      // First light. He leaves at dawn.
      context.dayNight.setTimeOfDay(0.225);
      context.scrollSpeed = 0;
      context.stage.setVisible("hand", true);
      context.cab = context.cabDimensions;
    },
    onUpdate(t, elapsed, context) {
      const cab = context.cab;
      const eye = {
        x: 0.3,
        y: cab.floorY + 1.62,
        z: cab.centreZ - 0.35,
      };
      // Looking down and left at the driver's desk.
      const target = lerpPoint(
        { x: -0.2, y: cab.floorY + 1.5, z: cab.frontZ },
        { x: -0.45, y: cab.floorY + 1.05, z: cab.frontZ - 0.45 },
        ease(t),
      );
      place(context, offset(eye, shake(0.012, elapsed, 6)), target);

      // The hand waits out of shot until the next beat.
      context.stage.hand.position.set(-0.15, cab.floorY + 0.72, cab.centreZ - 0.55);
      context.stage.hand.rotation.set(-1.1, 0.15, 0);
    },
  });

  shots.push({
    name: "full-power",
    duration: 3.4,
    onEnter(context) {
      context.world.setThrottleIndicator(0);
    },
    onUpdate(t, elapsed, context) {
      const cab = context.cab;
      const consoleZ = cab.frontZ - 0.45;
      // Must match the quadrant built in interiors.js.
      const quadrantZ = consoleZ + 0.16;
      const notchX = -0.81 + 3 * 0.26;
      const notchY = cab.floorY + 1.0 + 0.15;

      /*
       * The reach.
       *
       * A straight line from the lap to the notch passes through the desk,
       * which is what made the arm clip through the console. The hand is moved
       * along an arc instead: out and up first, clearing the desk edge, then
       * forward and down onto the control - which is also how a person
       * actually reaches for something in front of them.
       */
      const reach = ease(Math.min(1, t * 1.9));
      const rest = { x: -0.15, y: cab.floorY + 0.72, z: cab.centreZ - 0.55 };
      const target = { x: notchX, y: notchY + 0.035, z: quadrantZ + 0.02 };

      const handPosition = lerpPoint(rest, target, reach);
      // The arc: lift clear of the desk in the middle of the move, and settle
      // onto the control at the end.
      handPosition.y += Math.sin(reach * Math.PI) * 0.16;

      context.stage.hand.position.set(handPosition.x, handPosition.y, handPosition.z);
      // The wrist rolls over as the hand comes down onto the notch.
      context.stage.hand.rotation.set(-1.1 + reach * 0.75, 0.15 - reach * 0.15, 0);

      // Contact at 55% through the shot: full power goes in, and the notches
      // light up. From the moment gameplay starts the simulation drives them.
      const pressed = t > 0.55;
      context.world.setThrottleIndicator(pressed ? 4 : 0);

      const eye = { x: 0.3, y: cab.floorY + 1.62, z: cab.centreZ - 0.35 };
      place(context, offset(eye, shake(0.01, elapsed, 6)), {
        x: -0.45,
        y: cab.floorY + 1.05,
        z: consoleZ,
      });

      // The engine takes up as the notch goes in.
      context.scrollSpeed = pressed ? ease((t - 0.55) / 0.45) * 9 : 0;
    },
    onExit(context) {
      context.stage.setVisible("hand", false);
      // The notches stay lit: the throttle really is at full when play begins.
      context.world.setThrottleIndicator(4);
    },
  });

  shots.push({
    name: "departure",
    duration: 4.8,
    onUpdate(t, elapsed, context) {
      context.scrollSpeed = 9 + ease(t) * 13;

      // Outside, beside the line. The camera falls behind as the train goes,
      // which is what makes it read as leaving rather than as standing still.
      const from = { x: 11, y: 3.6, z: -12 };
      const to = { x: 16, y: 5.4, z: -52 };
      place(context, lerpPoint(from, to, ease(t)), { x: 0, y: 2.6, z: -6 });
    },
  });

  shots.push({
    name: "fade-to-black-3",
    duration: 2.0,
    onUpdate(t, elapsed, context) {
      context.overlay.setFade(ease(t));
      context.overlay.setLetterbox(1 - ease(Math.max(0, (t - 0.4) / 0.6)));
      context.scrollSpeed = 22;
    },
    onExit(context) {
      context.overlay.setFade(1);
      context.overlay.setLetterbox(0);
    },
  });

  return new Cutscene(shots, { onFinished });
}

/**
 * Moves the helicopter along its flight path.
 * Kept in one place so every shot in act two agrees about where it is.
 */
function flyHelicopter(context, elapsed, { forward, bank }) {
  const helicopter = context.stage.helicopter;
  helicopter.position.z += forward * 0.016;
  helicopter.position.y = 58 + Math.sin(elapsed * 0.7) * 1.4;
  helicopter.rotation.z = bank;
  helicopter.rotation.x = 0.06;
}

/**
 * Puts the camera in the helicopter's open door, with the weapon in shot.
 * The protagonist is operating it, so the gun sits below and ahead of the eye.
 */
function rideInDoorway(context, elapsed, { lookDown = 0.5, shakeAmount = 0.05, recoil = false }) {
  const helicopter = context.stage.helicopter;
  const gun = context.stage.doorGun;

  const doorway = {
    x: helicopter.position.x - 1.5,
    y: helicopter.position.y - 0.2,
    z: helicopter.position.z + 0.4,
  };

  // Airframe vibration, plus the weapon's own recoil while it is firing.
  const vibration = shake(shakeAmount + 0.02, elapsed, 41);
  const kick = recoil ? Math.abs(Math.sin(elapsed * 46)) * 0.03 : 0;

  const eye = offset(doorway, vibration);
  place(context, eye, {
    x: eye.x - 6,
    y: eye.y - lookDown * 12,
    z: eye.z + 9,
  });

  gun.position.set(eye.x - 0.55, eye.y - 0.5 - kick, eye.z + 0.85);
  gun.rotation.set(-lookDown * 0.85, -0.55, 0);
}
