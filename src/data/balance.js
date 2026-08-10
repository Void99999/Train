/**
 * LAST TRAIN - global balancing baseline.
 *
 * This file holds the cross-cutting numbers: train speed, weight penalties,
 * player vitals, economy ratios, world timing. Numbers that belong to a single
 * catalog of things (wagons, weapons, cargo, enemies) live in that catalog's
 * own data module instead, so every value has exactly one home.
 *
 * Everything here is a plain value. Nothing in this file may import a system,
 * so balancing can never be blocked by a circular dependency.
 *
 * See docs/BALANCING.md for where each value from the design baseline lives.
 */

/** Distance and speed are metric. Internally metres and seconds; km/h only for display. */
export const UNITS = {
  metresPerKilometre: 1000,
  /** 1 km/h expressed in metres per second. */
  kmhToMetresPerSecond: 1000 / 3600,
};

export const TRAIN = {
  /**
   * Top speed of a bare locomotive at 100% throttle, in km/h.
   * 80 km/h means 10 km of track takes ~7 min 30 s, which is the intended
   * pacing for one leg of the journey.
   */
  baseMaxSpeedKmh: 80,

  /** The four throttle notches in the driver's cabin, as fractions of top speed. */
  throttleSteps: [0, 0.25, 0.5, 0.75, 1],

  /** Throttle notch a fresh run starts on (index into throttleSteps). */
  defaultThrottleIndex: 0,

  /**
   * Weight penalties. Each is subtracted from the train's performance
   * multiplier, which then scales top speed and acceleration.
   */
  performance: {
    /** Every wagon behind the locomotive costs this much top performance. */
    penaltyPerWagon: 0.03,
    /** Every armoured vehicle - locomotive included - costs this much more. */
    penaltyPerArmouredVehicle: 0.02,
    /**
     * Loaded cargo also weighs something. Kept small next to the structural
     * penalties: a fully loaded level 4 transport wagon (80 slots) costs 1.6%.
     */
    penaltyPerOccupiedCargoSlot: 0.0002,
    /**
     * However heavy the train gets, it must never become unplayable. The
     * multiplier is clamped here, so a maxed-out train still runs at 55%.
     */
    minimumMultiplier: 0.55,
  },

  /**
   * Acceleration in m/s^2 for a bare locomotive. Heavier trains accelerate
   * proportionally slower, which is what makes weight felt rather than just
   * displayed.
   */
  acceleration: 0.45,
  /** Braking / coasting deceleration when the throttle is lowered, m/s^2. */
  deceleration: 0.7,
  /** Rolling deceleration of a wagon that lost its locomotive, m/s^2. */
  detachedRollingDeceleration: 0.22,

  /** Distance in metres between wagon centres, used for layout and Loader walking. */
  couplingLengthMetres: 2.2,
};

export const JOURNEY = {
  /**
   * Total length of the railway. The player is never told this number - it
   * exists so the world generator and the ending trigger agree on a distance.
   */
  totalDistanceKm: 100,
  /** Number of supply outposts along the way. */
  outpostCount: 10,
  /** Nominal spacing between outposts in km. */
  outpostSpacingKm: 10,
  /**
   * Seconds of quiet after leaving an outpost before the encounter director is
   * allowed to spawn anything. Stops enemies attacking while the player can
   * still see the platform.
   */
  postOutpostPeaceSeconds: 45,
  /** How close to an outpost the train must be, in metres, to dock. */
  outpostDockRadiusMetres: 120,
};

export const PLAYER = {
  maxHealth: 100,
  /** No passive regeneration anywhere in the game - healing is a resource. */
  healthRegenPerSecond: 0,

  stamina: {
    max: 100,
    /** 100 stamina / 12.5 per second = 8 seconds of continuous sprint. */
    drainPerSecond: 12.5,
    /** 100 stamina / 16.67 per second = ~6 seconds to refill from empty. */
    regenPerSecond: 100 / 6,
    /** Regeneration only starts this long after the player stops sprinting. */
    regenDelaySeconds: 1,
    /** Sprinting is refused below this value, to avoid one-step stutter sprints. */
    minimumToStartSprinting: 10,
  },

  movement: {
    walkSpeed: 3.2,
    sprintSpeed: 6.0,
    crouchSpeed: 1.6,
    /** Speed while crawling during the opening sequence. */
    crawlSpeed: 0.9,
    /** Interaction ray length in metres. */
    interactionRangeMetres: 2.6,
  },

  medkit: {
    healAmount: 50,
    maxCarried: 3,
  },
};

export const ECONOMY = {
  /** Money the player starts a fresh run with. */
  startingMoney: 120,
  /** Repair conversion: one unit of currency restores this many hit points. */
  healthPointsPerCurrencyUnit: 5,
  /** Flat price of a full heal at an outpost medical service. */
  fullHealPrice: 50,
  /** Repair quick-pick buttons offered in the workshop, as fractions. */
  repairPresets: [0.25, 0.5, 0.75, 1],
};

export const ARMOUR = {
  /** A vehicle may be armoured exactly once. There are no armour levels. */
  damageReduction: 0.3,
  /** Armour itself takes damage and looks worse before the hull does. */
  integrity: {
    /** Share of incoming damage that is written off against the armour plates. */
    wearFactor: 0.5,
    /** Armour hit points as a fraction of the vehicle's own maximum health. */
    capacityFactor: 0.4,
    /**
     * Stripped armour still helps a little - bare plates hanging off the hull.
     * Reduction is scaled by this floor once integrity reaches zero.
     */
    strippedEffectiveness: 0.25,
  },
};

export const DAMAGE_STATES = {
  /**
   * Health fraction thresholds at which a vehicle's visual condition changes.
   * The renderer reads these; nothing else may hard-code the boundaries.
   */
  pristine: 1,
  light: 0.8,
  medium: 0.55,
  heavy: 0.3,
  critical: 0.12,
};

export const WORLD = {
  /** A full dawn-to-dawn cycle in real seconds. */
  dayLengthSeconds: 40 * 60,
  /** Time of day a fresh run starts at, as a fraction of the cycle (0 = midnight). */
  startTimeOfDay: 0.27,
};

export const MODES = {
  normal: {
    id: "normal",
    /** Death returns the player to the last outpost actually reached. */
    respawnAtLastReachedOutpost: true,
    /** Fraction of carried money lost on death. */
    moneyLossOnDeath: 0.2,
    /** Fraction of carried trade goods lost on death. */
    cargoLossOnDeath: 0.25,
    /** Health the player respawns with, as a fraction of maximum. */
    respawnHealthFraction: 1,
    /** Wagon health restored on respawn, as a fraction of maximum. */
    respawnVehicleHealthFraction: 0.6,
  },
  hardcore: {
    id: "hardcore",
    respawnAtLastReachedOutpost: false,
    moneyLossOnDeath: 1,
    cargoLossOnDeath: 1,
    respawnHealthFraction: 0,
    respawnVehicleHealthFraction: 0,
  },
};

export const COMBAT = {
  /**
   * Explosive falloff exponent. 1 is linear from centre to edge of the blast,
   * higher values concentrate the damage near the impact point.
   */
  splashFalloffExponent: 1.4,
  /** Minimum share of full damage anything inside the blast radius takes. */
  splashMinimumFraction: 0.15,
  /**
   * How much of a shot is stopped by an intact wagon wall when an enemy hits a
   * vehicle the player is standing in. The remainder can reach the player.
   * Weapons carry their own penetration value which is checked against this.
   */
  wallProtection: 0.85,
};

export const AUDIO = {
  defaultMasterVolume: 1,
  /** Distance in metres at which a 3D sound has fallen to half its volume. */
  referenceDistanceMetres: 8,
  maxAudibleDistanceMetres: 400,
};

export const SETTINGS_DEFAULTS = {
  /** Volume is a percentage in the options menu, 0-100. */
  volume: 100,
  /** Restrained, realistic blood effects. Purely cosmetic - no mechanical effect. */
  blood: true,
  language: "en",
  mode: MODES.normal.id,
};
