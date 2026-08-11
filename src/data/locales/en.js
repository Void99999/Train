/**
 * LAST TRAIN - English strings.
 *
 * This file is the reference locale: every other language is checked against
 * its key list by tools/check-locales.js. Add a key here first.
 *
 * Placeholders use {name} and are filled in by Localization.t().
 */

export default {
  nameKey: "English",

  strings: {
    /* ---------------------------------------------------------------- title */
    // The title is a proper name. It is not translated in any language.
    GAME_TITLE: "LAST TRAIN",
    GAME_SUBTITLE: "Keep moving. Survive. Get home.",

    /* ----------------------------------------------------------------- menu */
    MENU_START: "Start",
    MENU_OPTIONS: "Options",
    MENU_LANGUAGE: "Language",
    MENU_EXIT: "Exit Game",
    MENU_CONTINUE: "Continue",
    MENU_BACK: "Back",
    MENU_NEW_RUN: "New Run",
    MENU_RESUME_RUN: "Resume Run",

    /* -------------------------------------------------------------- options */
    OPTIONS_TITLE: "Options",
    OPTIONS_VOLUME: "Volume",
    OPTIONS_BLOOD: "Blood",
    OPTIONS_ON: "On",
    OPTIONS_OFF: "Off",
    OPTIONS_BLOOD_HINT: "Restrained hit effects. Gameplay is unchanged either way.",

    /* ------------------------------------------------------------- language */
    LANGUAGE_TITLE: "Language",
    LANGUAGE_EN: "English",
    LANGUAGE_DE: "German",

    /* ---------------------------------------------------------------- pause */
    PAUSE_TITLE: "Paused",

    /* ---------------------------------------------------------------- modes */
    MODE_TITLE: "Game Mode",
    MODE_NORMAL: "Normal",
    MODE_NORMAL_HINT: "Death sends you back to the last outpost you reached.",
    MODE_HARDCORE: "Hardcore",
    MODE_HARDCORE_HINT: "One life. If the run ends, it ends.",

    /* ------------------------------------------------------------------ HUD */
    HUD_HEALTH: "Health",
    HUD_STAMINA: "Stamina",
    HUD_MONEY: "Money",
    HUD_SPEED: "Speed",
    HUD_THROTTLE: "Throttle",
    HUD_AMMUNITION: "Ammunition",
    HUD_DISTANCE_TRAVELLED: "Travelled",
    HUD_LAST_OUTPOST: "Last outpost",
    HUD_NO_OUTPOST_YET: "None",

    /* ------------------------------------------------------------- prompts */
    PROMPT_INTERACT: "Press {key}",
    PROMPT_DRIVE: "Take the controls",
    PROMPT_LEAVE_CONTROLS: "Step back",
    PROMPT_OPEN_DOOR: "Open door",
    PROMPT_CLOSE_DOOR: "Close door",
    PROMPT_MOUNT_WEAPON: "Man the weapon",
    PROMPT_LEAVE_WEAPON: "Leave the weapon",
    PROMPT_BLUEPRINT: "Read the blueprint",
    PROMPT_WORKSHOP: "Use the workbench",
    PROMPT_TRADE: "Trade",
    PROMPT_BOARD_TRAIN: "Board the train",
    PROMPT_LEAVE_TRAIN: "Step off",
    PROMPT_STEP_OUTSIDE: "Step outside",
    PROMPT_STEP_INSIDE: "Step back inside",
    PROMPT_PICK_UP: "Pick up",

    /* --------------------------------------------------------------- shops */
    SHOP_CARGO_TRADER: "Cargo Trader",
    SHOP_WEAPONS: "Weapon Supply",
    SHOP_AMMUNITION: "Ammunition Store",
    SHOP_MEDICAL: "Medical Post",
    SHOP_REPAIR: "Repair Bay",
    SHOP_WORKSHOP: "Train Workshop",

    TRADE_BUY: "Buy",
    TRADE_SELL: "Sell",
    TRADE_SELL_ALL: "Sell All",
    TRADE_SELL_HALF: "Sell Half",
    TRADE_BUY_MAX: "Fill Up",
    TRADE_QUANTITY: "Quantity",
    TRADE_OWNED: "Owned",
    TRADE_IN_STOCK: "Available",
    TRADE_UNIT_PRICE: "Per unit",
    TRADE_TOTAL: "Total",
    TRADE_CONFIRM: "Confirm",
    TRADE_CANCEL: "Cancel",
    TRADE_SLOTS_USED: "{used} / {total} slots",
    TRADE_ERROR_NO_MONEY: "Not enough money.",
    TRADE_ERROR_NO_SPACE: "No room left in the train.",
    TRADE_ERROR_NOTHING_TO_SELL: "You are not carrying any.",
    TRADE_ERROR_NOT_SOLD_HERE: "They do not deal in that here.",
    TRADE_ERROR_LOCKED: "Not available yet.",
    TRADE_ERROR_ALREADY_OWNED: "You already have one.",

    /* --------------------------------------------------------------- cargo */
    CARGO_COAL: "Coal",
    CARGO_FUEL_CAN: "Fuel Can",
    CARGO_OIL_BARREL: "Oil Barrel",
    CARGO_PISTOL_AMMO: "Pistol Ammunition",
    CARGO_RIFLE_AMMO: "Rifle Ammunition",
    CARGO_ROCKET: "Rocket",
    CARGO_HEAVY_SHELL: "Heavy Shell",
    CARGO_SLOT_COST: "{slots} slots",
    CARGO_SLOT_COST_ONE: "1 slot",
    CARGO_ROUNDS_PER_PACK: "{rounds} rounds",

    /* -------------------------------------------------------------- weapons */
    WEAPON_PISTOL: "Pistol",
    WEAPON_ASSAULT_RIFLE: "Assault Rifle",
    WEAPON_RPG: "RPG",
    WEAPON_MINIGUN: "Minigun",
    WEAPON_MOUNTED_MACHINE_GUN: "Machine Gun",
    WEAPON_MOUNTED_ROCKET_LAUNCHER: "Rocket Launcher",
    WEAPON_HEAVY_TURRET_CANNON: "Heavy Cannon",
    WEAPON_WHEEL_HINT: "Hold {key}",
    WEAPON_NO_AMMUNITION: "Out of ammunition",
    WEAPON_RELOADING: "Reloading",

    /* ------------------------------------------------------------- vehicles */
    VEHICLE_LOCOMOTIVE: "Locomotive",
    VEHICLE_TRANSPORT: "Transport Wagon",
    VEHICLE_COMBAT: "Combat Wagon",
    VEHICLE_LEVEL: "Level {level}",
    VEHICLE_DETACHED: "Uncoupled",
    VEHICLE_NO_WAGON: "No wagon connected.",
    VEHICLE_DESTROYED: "Destroyed",

    /* ------------------------------------------------------------ blueprint */
    BLUEPRINT_TITLE: "Train Blueprint",
    BLUEPRINT_CONDITION: "Condition",
    BLUEPRINT_ARMOURED: "Armoured",
    BLUEPRINT_UNARMOURED: "No armour",
    BLUEPRINT_LOADER: "Loader",
    BLUEPRINT_LOADER_NONE: "No loader aboard",
    BLUEPRINT_LOADER_ASSIGNMENT: "Loader assignment",
    BLUEPRINT_LOADER_AUTOMATIC: "Automatic",
    BLUEPRINT_LOADER_TURRET: "Turret {number}",
    BLUEPRINT_LOADER_IDLE: "Waiting",
    BLUEPRINT_LOADER_FETCHING: "Fetching a shell",
    BLUEPRINT_LOADER_CARRYING: "Carrying a shell",
    BLUEPRINT_LOADER_LOADING: "Loading",
    BLUEPRINT_LOADER_NO_ACCESS: "Cannot reach the ammunition",

    /* ------------------------------------------------------------- workshop */
    WORKSHOP_TITLE: "Train Workshop",
    WORKSHOP_BUY: "Buy",
    WORKSHOP_BUY_TRANSPORT: "Buy Transport Wagon",
    WORKSHOP_BUY_COMBAT: "Buy Combat Wagon",
    WORKSHOP_UPGRADE: "Upgrade",
    WORKSHOP_UPGRADE_TO: "Upgrade to level {level}",
    WORKSHOP_ARMOUR: "Fit Armour",
    WORKSHOP_ARMOUR_DONE: "Armour fitted",
    WORKSHOP_REPAIR: "Repair",
    WORKSHOP_REPAIR_AMOUNT: "Repair {percent}%",
    WORKSHOP_REPAIR_FULL: "Repair Fully",
    WORKSHOP_HIRE_LOADER: "Hire Loader",
    WORKSHOP_LOADER_ABOARD: "Loader aboard",
    WORKSHOP_PREVIEW: "Preview",
    WORKSHOP_MAX_LEVEL: "Fully upgraded",
    WORKSHOP_UNDAMAGED: "No damage",

    STAT_TOTAL_HEALTH: "Total condition",
    STAT_WEIGHT: "Weight",
    STAT_TOP_SPEED: "Top speed",
    STAT_PERFORMANCE: "Performance",
    STAT_CARGO_CAPACITY: "Cargo capacity",
    STAT_WAGON_COUNT: "Wagons",
    STAT_ARMOURED_COUNT: "Armoured",
    STAT_TONNES: "{value} t",
    STAT_PERCENT: "{value}%",

    /* -------------------------------------------------------------- medical */
    MEDICAL_FULL_TREATMENT: "Full treatment",
    MEDICAL_MEDKIT: "Medkit",
    MEDICAL_MEDKIT_HINT: "Restores {amount} health. Carry up to {max}.",
    MEDICAL_ALREADY_HEALTHY: "You are not hurt.",
    MEDICAL_MEDKITS_FULL: "You cannot carry any more.",

    /* ------------------------------------------------------------- outposts */
    OUTPOST_ARRIVED: "{name}",
    OUTPOST_SAFE: "No attacks here.",
    OUTPOST_DEPART: "Pull out",
    OUTPOST_1_NAME: "Post Kolna",
    OUTPOST_2_NAME: "Post Vesnik",
    OUTPOST_3_NAME: "Post Zarov",
    OUTPOST_4_NAME: "Post Mielno",
    OUTPOST_5_NAME: "Post Drazen",
    OUTPOST_6_NAME: "Post Hrabec",
    OUTPOST_7_NAME: "Post Sokol",
    OUTPOST_8_NAME: "Post Varnik",
    OUTPOST_9_NAME: "Post Lezno",
    OUTPOST_10_NAME: "Post Ostrel",

    /* ------------------------------------------------------------- unlocks */
    UNLOCK_AVAILABLE: "Now available: {name}",

    /* ------------------------------------------------------- run and ending */
    RUN_FAILED_TITLE: "The run is over",
    RUN_FAILED_PLAYER: "You did not make it.",
    RUN_FAILED_LOCOMOTIVE: "The locomotive is gone.",
    RUN_RETURN_TO_OUTPOST: "Back to {name}",
    RUN_RESTART: "Start again",
    // Kept as a single loud word on screen. German uses SIEG.
    VICTORY: "VICTORY",

    STATS_TITLE: "Run Summary",
    STATS_DISTANCE: "Distance travelled",
    STATS_OUTPOSTS: "Outposts reached",
    STATS_ENEMIES_KILLED: "Enemies killed",
    STATS_VEHICLES_DESTROYED: "Vehicles destroyed",
    STATS_MONEY_EARNED: "Money earned",
    STATS_LARGEST_TRAIN: "Largest train",
    STATS_RUN_TIME: "Run time",
    STATS_PERSONAL_BEST: "Personal best",
    STATS_NEW_RECORD: "New record",
    STATS_WAGONS_VALUE: "{count} wagons",

    /* -------------------------------------------------------------- system */
    SYSTEM_SAVING: "Saving",
    SYSTEM_SAVE_FAILED: "Progress could not be saved.",
    SYSTEM_LOADING: "Loading",
    SYSTEM_CONFIRM_EXIT: "Leave the game?",
    SYSTEM_YES: "Yes",
    SYSTEM_NO: "No",
  },
};
