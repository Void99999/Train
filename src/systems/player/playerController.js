/**
 * LAST TRAIN - first-person character controller.
 *
 * Owns where the player is, which way they are facing, and how fast they are
 * going. It takes an intent object rather than reading the keyboard itself,
 * which keeps the whole thing testable: a test can walk the player into a wall
 * and assert that they stopped, without a browser anywhere in sight.
 *
 * Positions are in the train's local space. The train never moves - the world
 * scrolls past it - so standing still in the cab means standing still here,
 * however far down the line the run has got.
 */

import { ColliderSet, moveBody, bodyBox, findClearSpot } from "../world/collision.js";
import { PLAYER } from "../../data/balance.js";

/** Gravity in metres per second squared. */
const GRAVITY = 18;
/** Upward speed of a jump. Enough to clear a low crate, not a wagon roof. */
const JUMP_SPEED = 5.2;

/** How quickly the player reaches full speed, and how quickly they stop. */
const GROUND_ACCELERATION = 55;
const GROUND_FRICTION = 12;
const AIR_CONTROL = 0.25;

const EYE_HEIGHT = 1.68;
const CROUCH_EYE_HEIGHT = 1.0;
const BODY_RADIUS = 0.32;
const BODY_HEIGHT = 1.8;
const CROUCH_BODY_HEIGHT = 1.15;

/** Metres between footfalls at a walk. */
const STRIDE_LENGTH = 0.82;

/** Pitch is clamped just short of straight up and straight down. */
const PITCH_LIMIT = Math.PI / 2 - 0.02;

export class PlayerController {
  position = { x: 0, y: 0, z: 0 };
  velocity = { x: 0, y: 0, z: 0 };

  yaw = 0;
  pitch = 0;

  #colliders;
  #stamina;
  #grounded = false;
  #crouching = false;
  #headBobPhase = 0;
  #enabled = true;
  /** Distance walked since the last footstep, for the footstep rhythm. */
  #stepDistance = 0;
  #pendingStep = false;

  /**
   * @param {object} deps
   * @param {ColliderSet} deps.colliders
   * @param {import("./stamina.js").Stamina} [deps.stamina] drives sprinting
   */
  constructor({ colliders = new ColliderSet(), stamina = null } = {}) {
    this.#colliders = colliders;
    this.#stamina = stamina;
  }

  setColliders(colliders) {
    this.#colliders = colliders;
  }

  /** Stamina belongs to the run, so it is attached when a run begins. */
  setStamina(stamina) {
    this.#stamina = stamina;
  }

  get colliders() {
    return this.#colliders;
  }

  /**
   * Movement is switched off during cutscenes and menus. Velocity is cleared
   * so the player does not resume a walk they started before the interruption.
   */
  setEnabled(enabled) {
    this.#enabled = enabled;
    if (!enabled) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  get isEnabled() {
    return this.#enabled;
  }

  get isGrounded() {
    return this.#grounded;
  }

  get isCrouching() {
    return this.#crouching;
  }

  get bodyHeight() {
    return this.#crouching ? CROUCH_BODY_HEIGHT : BODY_HEIGHT;
  }

  get bodyRadius() {
    return BODY_RADIUS;
  }

  /** Horizontal speed in metres per second. */
  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get isMoving() {
    return this.speed > 0.35;
  }

  /** Camera position: the player's eyes, with a little walking sway. */
  get eyePosition() {
    const base = this.#crouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
    // Head bob is deliberately small. It should be felt, not noticed.
    const bob = this.#grounded ? Math.sin(this.#headBobPhase) * 0.035 * this.#bobStrength() : 0;
    return {
      x: this.position.x,
      y: this.position.y + base + bob,
      z: this.position.z,
    };
  }

  #bobStrength() {
    return Math.min(1, this.speed / PLAYER.movement.walkSpeed);
  }

  /** Unit vector the player is looking along. */
  get forwardVector() {
    return {
      x: Math.sin(this.yaw) * Math.cos(this.pitch),
      y: Math.sin(this.pitch),
      z: Math.cos(this.yaw) * Math.cos(this.pitch),
    };
  }

  /**
   * Places the player on the floor at a spot that is definitely clear.
   * Used when a run begins and after a respawn - a player who starts inside a
   * wall or half a metre under the floor has no way to recover.
   */
  spawnAt(spot) {
    const body = { radius: BODY_RADIUS, height: BODY_HEIGHT };
    const clear = findClearSpot(spot, this.#colliders, body);
    this.position = { ...clear };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.#grounded = false;
    this.#crouching = false;
    return this.position;
  }

  /** True when the player is not intersecting anything. */
  get isClear() {
    return this.#colliders.overlapping(bodyBox(this.position, BODY_RADIUS, this.bodyHeight)).length === 0;
  }

  /** Applies mouse movement. Sensitivity is applied by the caller. */
  look(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + deltaPitch));
  }

  /**
   * Advances the player one step.
   *
   * @param {number} delta
   * @param {object} intent
   * @param {number} intent.forward  -1 back, 0 still, 1 forward
   * @param {number} intent.right    -1 left, 0 still, 1 right
   * @param {boolean} intent.sprint
   * @param {boolean} intent.crouch
   * @param {boolean} intent.jump    true on the frame the key went down
   */
  update(delta, intent = {}) {
    if (!this.#enabled) {
      // Still fall, so a disabled player cannot hang in mid-air.
      this.#applyGravity(delta);
      return;
    }

    const { forward = 0, right = 0, sprint = false, crouch = false, jump = false } = intent;

    this.#updateCrouch(crouch);

    const wantsToMove = forward !== 0 || right !== 0;
    const sprinting = this.#stamina
      ? this.#stamina.update(delta, {
          wantsToSprint: sprint && !this.#crouching,
          isMoving: wantsToMove && this.#grounded,
        })
      : sprint && !this.#crouching;

    const targetSpeed = this.#targetSpeed(sprinting);
    this.#applyMovement(delta, forward, right, targetSpeed);

    if (jump && this.#grounded && !this.#crouching) {
      this.velocity.y = JUMP_SPEED;
      this.#grounded = false;
    }

    this.#applyGravity(delta);
    this.#integrate(delta);

    if (this.#grounded && wantsToMove) {
      this.#headBobPhase += delta * (sprinting ? 13 : 8.5);
    }

    this.#trackFootsteps(delta, sprinting);
  }

  /**
   * Footsteps are paced by distance rather than by time, so they stay in step
   * with the legs whether the player is walking, sprinting or crouching.
   */
  #trackFootsteps(delta, sprinting) {
    if (!this.#grounded || this.speed < 0.4) {
      this.#stepDistance = STRIDE_LENGTH * 0.6;
      return;
    }

    this.#stepDistance += this.speed * delta;
    const stride = sprinting ? STRIDE_LENGTH * 1.25 : STRIDE_LENGTH;
    if (this.#stepDistance >= stride) {
      this.#stepDistance -= stride;
      this.#pendingStep = true;
    }
  }

  /**
   * True once per footstep. Consuming it clears the flag, so the caller plays
   * exactly one sound per step no matter how often it asks.
   */
  consumeFootstep() {
    if (!this.#pendingStep) return false;
    this.#pendingStep = false;
    return true;
  }

  #targetSpeed(sprinting) {
    if (this.#crouching) return PLAYER.movement.crouchSpeed;
    return sprinting ? PLAYER.movement.sprintSpeed : PLAYER.movement.walkSpeed;
  }

  #updateCrouch(wantsToCrouch) {
    if (wantsToCrouch === this.#crouching) return;

    if (!wantsToCrouch) {
      // Only stand up if there is headroom. Otherwise stay down.
      const standing = bodyBox(this.position, BODY_RADIUS, BODY_HEIGHT);
      if (this.#colliders.overlapping(standing).length > 0) return;
    }
    this.#crouching = wantsToCrouch;
  }

  #applyMovement(delta, forward, right, targetSpeed) {
    // Movement is relative to where the player is facing, ignoring pitch -
    // looking at the ceiling must not slow you down.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    // Forward is (sin yaw, cos yaw). The player's right is that turned a
    // quarter turn clockwise seen from above - forward at (yaw - 90 degrees) -
    // which is (-cos yaw, sin yaw).
    //
    // Getting this backwards is what made A and D swap: with the camera
    // looking along +Z in a right-handed space, +X is on the player's LEFT,
    // not their right.
    let wishX = sin * forward - cos * right;
    let wishZ = cos * forward + sin * right;

    const length = Math.hypot(wishX, wishZ);
    if (length > 0) {
      wishX /= length;
      wishZ /= length;
    }

    const control = this.#grounded ? 1 : AIR_CONTROL;
    const acceleration = GROUND_ACCELERATION * control * delta;

    this.velocity.x += wishX * acceleration;
    this.velocity.z += wishZ * acceleration;

    // Friction, applied only on the ground so a jump keeps its momentum.
    if (this.#grounded) {
      const friction = Math.max(0, 1 - GROUND_FRICTION * delta);
      if (length === 0) {
        this.velocity.x *= friction;
        this.velocity.z *= friction;
      }
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > targetSpeed) {
      const scale = targetSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }
    if (speed < 0.02) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  #applyGravity(delta) {
    this.velocity.y -= GRAVITY * delta;
    // Terminal velocity, so a long fall cannot tunnel through the floor.
    this.velocity.y = Math.max(this.velocity.y, -35);
  }

  #integrate(delta) {
    const displacement = {
      x: this.velocity.x * delta,
      y: this.velocity.y * delta,
      z: this.velocity.z * delta,
    };

    const contact = moveBody(this.position, displacement, this.#colliders, {
      radius: BODY_RADIUS,
      height: this.bodyHeight,
    });

    this.#grounded = contact.grounded;
    if (contact.grounded && this.velocity.y < 0) this.velocity.y = 0;
    if (contact.hitCeiling && this.velocity.y > 0) this.velocity.y = 0;
    if (contact.blockedX) this.velocity.x = 0;
    if (contact.blockedZ) this.velocity.z = 0;
  }

  serialize() {
    return { position: { ...this.position }, yaw: this.yaw, pitch: this.pitch };
  }

  restore(data) {
    if (!data) return;
    this.position = { ...data.position };
    this.yaw = data.yaw ?? 0;
    this.pitch = data.pitch ?? 0;
    this.velocity = { x: 0, y: 0, z: 0 };
  }
}
