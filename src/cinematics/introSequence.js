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
import { cabDimensions, sideDoorLayout, throttleQuadrant } from "../render/interiors.js";

/**
 * The driver's hand opening the throttle, as a pose for a given point in the
 * shot.
 *
 * Exported and pure so a test can walk the whole movement frame by frame and
 * check the arm against the actual console geometry. The previous two attempts
 * at this were reasoned about on paper and both left the forearm inside the
 * desk; this one is measured.
 *
 * @param {number} t 0-1 through the shot
 * @param {ReturnType<typeof cabDimensions>} cab
 * @returns {{position: {x,y,z}, rotation: {x,y,z}, notch: number, gripped: boolean}}
 */
export function throttleReachPose(t, cab) {
  const quadrant = throttleQuadrant(cab);

  /** Where the knob is when the lever sits at a given notch. */
  const knobAt = (notch) => ({
    x: quadrant.notchX(notch),
    y: quadrant.slotY + quadrant.knobOffset.y,
    z: quadrant.z + quadrant.knobOffset.z,
  });

  /*
   * Hand hanging at his side, just below and behind the eye - which is where
   * a first-person arm has to start if it is to read as *his* arm rather than
   * as an object across the room. It used to rest two and a half metres back,
   * and at that distance a forearm pointing towards the camera is a stub with
   * an end cap on it.
   */
  const rest = { x: 0.16, y: quadrant.consoleTop, z: quadrant.z - 1.05 };

  /*
   * Two beats. He reaches for the lever where it stands at idle, closes his
   * hand on it, then pushes it the length of the quadrant to full power.
   */
  const REACH_ENDS = 0.44;
  const PUSH_ENDS = 0.82;

  if (t < REACH_ENDS) {
    const reach = ease(t / REACH_ENDS);
    const grip = knobAt(0);
    const position = lerpPoint(rest, grip, reach);

    // Up over the edge of the desk on the way in, rather than through it.
    position.y += Math.sin(reach * Math.PI) * 0.36;

    return {
      position,
      /*
       * From hanging at his side to level, gripping the knob.
       *
       * The wrist barely pitches. It is tempting to let it tip right back at
       * the start, and it looks better in isolation - but the arm behind the
       * wrist is one and a half metres long, so ten degrees at the wrist is
       * a quarter of a metre at the elbow, and the elbow is what ends up
       * inside the desk.
       */
      rotation: { x: -0.1 + reach * 0.14, y: 0.2 - reach * 0.2, z: 0 },
      notch: 0,
      gripped: reach > 0.98,
    };
  }

  const push = ease(Math.min(1, (t - REACH_ENDS) / (PUSH_ENDS - REACH_ENDS)));
  const from = knobAt(0);
  const to = knobAt(4);

  return {
    position: lerpPoint(from, to, push),
    // Wrist nearly level, rolling forward a little as he drives it home. Any
    // more pitch than this and the forearm rears up out of the console.
    rotation: { x: 0.04 + push * 0.1, y: 0, z: 0 },
    // The lever travels with the hand, so the notch is wherever it has got to.
    notch: push * 4,
    gripped: true,
  };
}

/**
 * Points the camera at a target from a position, in one call.
 *
 * Always restores a level horizon first. Only the helicopter shots roll the
 * camera, and the player can skip out of them at any frame; a shot that
 * forgot to put `up` back would leave every later shot tilted. Resetting it
 * here means no shot can be left holding that.
 */
function place(context, position, target) {
  context.camera.up.set(0, 1, 0);
  context.camera.position.set(position.x, position.y, position.z);
  context.camera.lookAt(target.x, target.y, target.z);
}

/** As `place`, but with the horizon tilted - used when riding the aircraft. */
function placeRolled(context, position, target, up) {
  context.camera.up.set(up.x, up.y, up.z);
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
 * The path the protagonist takes climbing aboard, as an eye position and a
 * point to look at.
 *
 * Three legs, and no leg ever changes two axes while crossing a surface. That
 * is the whole point of the shape.
 *
 * The old version was a single straight line from the ground outside to the
 * driving position, which meant the camera moved inward and forward at the
 * same time and cut the corner - straight through the jamb beside the doorway,
 * and now through the walkway railing as well. So: climb first, entirely
 * outside the train; cross into the cab at a height above the railing and in
 * the middle of the door opening; only then turn and walk to the controls.
 *
 * Exported so a test can check the whole path against the cab's real geometry.
 *
 * @param {number} progress 0-1
 * @param {ReturnType<typeof cabDimensions>} cab
 */
export function boardingPath(progress, cab) {
  const doorway = sideDoorLayout(cab);
  const deck = doorway.walkway;

  /*
   * He boards on the right, which is the side he walked up to.
   *
   * Standing back from the deck rather than right against it: at eighteen
   * centimetres the railing was so close that its two rails cut diagonally
   * across the whole frame and the doorway behind them could not be read.
   */
  const outsideX = deck.outerX + 0.62;
  const deckEyeY = deck.topY + 1.68;
  const doorZ = doorway.centreZ;

  const CLIMB_ENDS = 0.36;
  const CROSS_ENDS = 0.74;

  const at = (x, y, z) => ({ x, y, z });
  const look = (x, y, z) => ({ x, y, z });

  if (progress < CLIMB_ENDS) {
    // Up the steps. Nothing but height changes, and it happens clear of the
    // train, so there is no surface to cut through.
    const climb = progress / CLIMB_ENDS;
    return {
      eye: at(outsideX, 1.68 + (deckEyeY - 1.68) * climb, doorZ),
      // Looking at the doorway he is climbing towards.
      look: look(0, deck.topY + 1.4, doorZ),
    };
  }

  if (progress < CROSS_ENDS) {
    // In through the door. Height and z are fixed: the eye is above the
    // railing and squarely in the middle of the opening for the whole move.
    const cross = (progress - CLIMB_ENDS) / (CROSS_ENDS - CLIMB_ENDS);
    return {
      eye: at(outsideX + (0.55 - outsideX) * cross, deckEyeY, doorZ),
      look: look(-0.3, deck.topY + 1.3, doorZ + (cab.frontZ - doorZ) * cross),
    };
  }

  // Inside now: turn forward and walk up to the controls.
  const walk = (progress - CROSS_ENDS) / (1 - CROSS_ENDS);
  return {
    eye: at(0.55, cab.floorY + 1.68, doorZ + (cab.centreZ - 0.5 - doorZ) * walk),
    look: look(-0.4, cab.floorY + 1.3, cab.frontZ),
  };
}

/** Puts the hand prop where a pose says it goes. */
function applyHandPose(context, pose) {
  context.stage.hand.position.set(pose.position.x, pose.position.y, pose.position.z);
  context.stage.hand.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
}

/**
 * Builds the opening cutscene.
 *
 * @param {object} options
 * @param {Function} options.onFinished called once the intro is over, however
 *                                      it ended - watched or skipped
 */
/**
 * What time of day each act happens at.
 *
 * The whole intro used to run between 0.02 and 0.225, and the day/night cycle
 * puts the sun below the horizon for all of that: sun intensity is zero until
 * 0.25, so "he leaves at dawn" was staged in the middle of the night. Every
 * shot after the title was near-black, which is most of why the battlefield
 * and the departure could not be read.
 *
 * The times below tell the story instead of fighting it. He is shot down at
 * dusk, spends the night on the ground, and gets the locomotive moving as the
 * sun comes up - which is also the only arrangement in which the windows can
 * show him anything.
 */
/**
 * The helicopter's cruising height and where it starts.
 *
 * Both were wrong for the ground underneath. At fifty-eight metres, a weapon
 * depressed twenty-two degrees points at ground a hundred and forty metres
 * ahead - past the far end of the built battlefield and off the edge of the
 * ground plane, which is why the shot was sky and a diagonal seam. Lower and
 * further back, the gun looks at the part of the battlefield that has ruins
 * and fires on it.
 */
const FLIGHT = { height: 26, startZ: -110, speed: 11 };

const TIME = {
  /** The title train, at night. */
  opening: 0.02,
  /** The helicopter, hit in the late afternoon. */
  lateAfternoon: 0.66,
  /** Face down in the dirt, hours later. */
  deepNight: 0.05,
  /** Getting to his feet as the sky goes grey. */
  firstLight: 0.2,
  /** Climbing aboard as the sun clears the horizon. */
  sunrise: 0.3,
  /**
   * Pulling out into the morning.
   *
   * Not 0.225, which is what "dawn" looked like on paper: the cycle puts sun
   * intensity at zero until 0.25, so the whole departure - and every window in
   * the cab - was staged in the dark.
   */
  morning: 0.4,
};

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
      context.dayNight.setTimeOfDay(TIME.opening);
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
      // Last of the light. The battlefield is the widest shot in the game and
      // it has to be readable; at night it is a black rectangle.
      context.dayNight.setTimeOfDay(TIME.lateAfternoon);
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

      context.stage.helicopter.position.set(0, FLIGHT.height, FLIGHT.startZ);
      context.stage.helicopter.rotation.set(0.06, 0, -0.12);
    },
    onUpdate(t, elapsed, context, delta) {
      context.overlay.setFade(1 - ease(t));
      flyHelicopter(context, elapsed, { forward: FLIGHT.speed, bank: -0.12, delta });
      rideInDoorway(context, elapsed, { lookDown: 0.5 });
    },
  });

  shots.push({
    name: "over-the-battlefield",
    duration: 4.2,
    onUpdate(t, elapsed, context, delta) {
      flyHelicopter(context, elapsed, {
        forward: FLIGHT.speed,
        bank: -0.12 - Math.sin(elapsed * 0.4) * 0.06,
        delta,
      });
      rideInDoorway(context, elapsed, { lookDown: 0.5 - t * 0.12 });
    },
  });

  shots.push({
    name: "door-gun",
    duration: 3.6,
    onUpdate(t, elapsed, context, delta) {
      flyHelicopter(context, elapsed, { forward: FLIGHT.speed, bank: -0.15, delta });

      // The weapon fires in bursts rather than continuously.
      const firing = Math.sin(elapsed * 2.2) > -0.25;
      rideInDoorway(context, elapsed, { lookDown: 0.42, firing });

      // The flash is on the same nine-a-second cycle as the recoil, so the
      // muzzle lights up on the stroke that throws the gun back.
      const pulse = firing ? 0.55 + (1 - ((elapsed * 9) % 1)) * 0.45 : 0;
      context.stage.setMuzzleFlash(pulse);
    },
    onExit(context) {
      context.stage.setMuzzleFlash(0);
      context.stage.setDoorGunRecoil(0);
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
    onUpdate(t, elapsed, context, delta) {
      context.overlay.setFlash(Math.max(0, 0.9 - t * 3));
      // The alarm comes up as the engine note falls away.
      context.overlay.setAlarm(ease(t) * 0.85);
      context.stage.setHelicopterDamage(ease(t) * 0.7);
      context.stage.setRotorSpeed(1 - ease(t) * 0.35);

      flyHelicopter(context, elapsed, { forward: FLIGHT.speed, bank: -0.15 - ease(t) * 0.3, delta });
      rideInDoorway(context, elapsed, { lookDown: 0.42, shakeAmount: ease(t) * 0.2 });
    },
    onExit(context) {
      context.overlay.setFlash(0);
    },
  });

  shots.push({
    name: "losing-control",
    duration: 3.8,
    onUpdate(t, elapsed, context, delta) {
      // Alarm pulses rather than sitting steady - a warning, not a filter.
      context.overlay.setAlarm(0.55 + Math.abs(Math.sin(elapsed * 6)) * 0.4);
      context.stage.setHelicopterDamage(0.7 + ease(t) * 0.3);
      context.stage.setRotorSpeed(0.65 - ease(t) * 0.4);

      const helicopter = context.stage.helicopter;
      helicopter.position.y = FLIGHT.height - ease(t) * (FLIGHT.height - 12);
      helicopter.position.z += FLIGHT.speed * delta;
      helicopter.rotation.y += (1.2 + ease(t) * 5) * delta;
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

  shots.push({
    name: "wake-on-the-ground",
    duration: 2.2,
    onEnter(context) {
      // Hours have passed. It is the middle of the night.
      context.dayNight.setTimeOfDay(TIME.deepNight);
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
      // The sky goes grey behind him as he gets up.
      context.dayNight.setTimeOfDay(TIME.deepNight + (TIME.firstLight - TIME.deepNight) * ease(t));

      // Rising is slow and unsteady, and the shake fades as he finds his feet.
      const rise = ease(Math.min(1, t * 1.15));
      const height = 0.42 + rise * 1.26;
      const unsteady = (1 - rise) * 0.09 + 0.02;

      const eye = offset({ x: STAND_AT.x, y: height, z: STAND_AT.z }, shake(unsteady, elapsed, 11));
      place(context, eye, { x: 0.4, y: 1.4 + rise * 1.2, z: -6 });
    },
    onExit(context) {
      context.dayNight.setTimeOfDay(TIME.firstLight);
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
    onEnter(context) {
      // He hauls the cab door open as he comes up to it, so it is standing
      // open by the time he reaches the steps. Opening a door he then walks
      // through is a second of screen time; walking through a shut one is a bug.
      context.world.setSideDoorOpen("right", true);
    },
    onUpdate(t, elapsed, context) {
      // The sun comes up over the walk.
      context.dayNight.setTimeOfDay(TIME.firstLight + (TIME.sunrise - TIME.firstLight) * t);

      const cab = context.cabDimensions;
      // He walks to the foot of the boarding steps, which is where the next
      // shot picks him up. Both shots ask the same function where that is.
      const boarding = boardingPath(0, cab).eye;

      const walk = ease(t);
      const position = {
        x: STAND_AT.x + (boarding.x - STAND_AT.x) * walk,
        y: 1.68,
        z: STAND_AT.z + (boarding.z - STAND_AT.z) * walk,
      };

      // An injured, heavy walk: a pronounced limp rather than a steady bob.
      const step = elapsed * 3.4;
      const limp = Math.abs(Math.sin(step)) * 0.05 + Math.max(0, Math.sin(step * 0.5)) * 0.03;
      const eye = offset(position, {
        x: Math.sin(step * 0.5) * 0.05,
        y: -limp,
        z: 0,
      });

      // He looks at the open doorway he is heading for.
      place(context, eye, { x: 0.6, y: 2.6, z: boarding.z });
    },
    onExit(context) {
      // Whatever happened above, the door is open before he climbs.
      context.world.setSideDoorOpen("right", true);
      context.dayNight.setTimeOfDay(TIME.sunrise);
    },
  });

  shots.push({
    name: "climbing-into-the-cab",
    duration: 3.6,
    onUpdate(t, elapsed, context) {
      context.dayNight.setTimeOfDay(TIME.sunrise + (TIME.morning - TIME.sunrise) * t);

      const cab = context.cabDimensions;
      const pose = boardingPath(ease(t), cab);

      // The pull on the grab iron, and the step up.
      const effort = Math.sin(ease(t) * Math.PI) * 0.05;
      place(
        context,
        offset(pose.eye, { x: 0, y: effort, z: 0 }),
        pose.look,
      );
    },
    onExit(context) {
      context.dayNight.setTimeOfDay(TIME.morning);
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
      // The sun is up. He leaves in the morning.
      context.dayNight.setTimeOfDay(TIME.morning);
      context.scrollSpeed = 0;
      context.stage.setVisible("hand", true);
      context.cab = context.cabDimensions;
      // He pulls the door shut behind him before he touches anything.
      context.world.setSideDoorOpen("right", false);
    },
    onExit(context) {
      // Skipping the intro must leave the cab in the same state as watching
      // it: aboard, door shut, ready to drive.
      context.world.setSideDoorOpen("right", false);
    },
    onUpdate(t, elapsed, context) {
      const cab = context.cab;
      /*
       * Standing at the controls, not across the room from them - but not
       * with his nose on the quadrant either. A metre and a third back and
       * twenty degrees down is where a driver's eye actually is: the desk
       * fills the lower half of the frame and the track is visible over it.
       */
      const eye = {
        x: 0.32,
        y: cab.floorY + 1.68,
        z: throttleQuadrant(cab).z - 1.35,
      };
      // Looking down and left at the driver's desk.
      const target = lerpPoint(
        { x: -0.2, y: cab.floorY + 1.5, z: cab.frontZ },
        { x: -0.45, y: cab.floorY + 1.05, z: cab.frontZ - 0.45 },
        ease(t),
      );
      place(context, offset(eye, shake(0.012, elapsed, 6)), target);

      // The hand waits on his knee, out of shot, until the next beat.
      applyHandPose(context, throttleReachPose(0, cab));
    },
  });

  shots.push({
    name: "full-power",
    duration: 3.4,
    onEnter(context) {
      context.world.setThrottleIndicator(0);
      context.world.setThrottleLever(0, context.cab);
    },
    onUpdate(t, elapsed, context) {
      const cab = context.cab;
      const quadrant = throttleQuadrant(cab);

      /*
       * He takes hold of the lever where it stands at idle and drives it the
       * length of the quadrant. The lever moves with the hand rather than
       * snapping to full at a magic moment, so the notches light one at a time
       * as it passes them - which is the shot doing the work of explaining
       * what the throttle is before the player ever touches it.
       */
      const pose = throttleReachPose(t, cab);
      applyHandPose(context, pose);

      context.world.setThrottleLever(pose.notch, cab);
      context.world.setThrottleIndicator(Math.floor(pose.notch + 0.001));

      const eye = { x: 0.32, y: cab.floorY + 1.68, z: quadrant.z - 1.35 };
      place(context, offset(eye, shake(0.01, elapsed, 6)), {
        x: -0.35,
        y: quadrant.slotY + 0.02,
        z: quadrant.consoleZ + 0.05,
      });

      // The engine takes up as the lever comes forward, not before.
      context.scrollSpeed = (pose.notch / 4) * 9;
    },
    onExit(context) {
      context.stage.setVisible("hand", false);
      // The lever stays where he left it: the throttle really is at full when
      // play begins, and the cab has to agree.
      context.world.setThrottleLever(4, context.cab);
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
 *
 * Kept in one place so every shot in act two agrees about where it is, and
 * driven by real elapsed time rather than an assumed sixty frames a second.
 * With a hard-coded step the aircraft crossed four times as much ground on a
 * fast machine as on a slow one, and the shot framing went with it.
 *
 * @param {number} delta seconds this call covers
 * @param {number} forward metres per second along the track
 */
function flyHelicopter(context, elapsed, { forward, bank, delta = 0 }) {
  const helicopter = context.stage.helicopter;
  helicopter.position.z += forward * delta;
  helicopter.position.y = FLIGHT.height + Math.sin(elapsed * 0.7) * 1.4;
  helicopter.rotation.z = bank;
  helicopter.rotation.x = 0.06;
}

/**
 * Puts the camera behind the door gun.
 *
 * The gun is bolted into the helicopter and the gunner's head hangs off the
 * gun, so there is nothing to position here: the stage is asked where the
 * gunner's eye ended up after the aircraft moved, and the camera goes there.
 * That is why the weapon cannot drift away from the doorway any more - the
 * camera follows the gun, rather than the gun chasing the camera.
 *
 * @param {number} lookDown  how far the weapon is depressed, 0-1
 * @param {number} shakeAmount airframe vibration, in metres
 * @param {boolean} firing   whether the gun is being fired this frame
 */
function rideInDoorway(context, elapsed, { lookDown = 0.5, shakeAmount = 0.05, firing = false }) {
  const stage = context.stage;

  // Depressed onto the ground: from sixty metres up, anything shallower and
  // the shot is all sky.
  stage.setDoorGunElevation(lookDown);

  /*
   * Recoil is a sawtooth, not a sine: the gun slams back in about four
   * milliseconds and the buffer pushes it out over the rest of the cycle.
   * A sine would read as the gun swaying.
   */
  const cyclesPerSecond = 9;
  const phase = firing ? (elapsed * cyclesPerSecond) % 1 : 0;
  stage.setDoorGunRecoil(firing ? Math.max(0, 1 - phase * 1.8) : 0);

  // Vibration is the airframe, and the gunner's head with it. Firing adds a
  // barely-there tremor - the weapon kicks, the eight-tonne aircraft does not.
  const tremor = firing ? 0.006 : 0;
  const vibration = shake(shakeAmount + 0.015 + tremor, elapsed, 41);

  const view = stage.gunnerView();
  placeRolled(context, offset(view.eye, vibration), view.aim, view.up);
}
