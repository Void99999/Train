/**
 * LAST TRAIN - what each service at an outpost actually deals in.
 *
 * Stock is fixed and never randomised. The player is meant to be able to plan
 * a run around the economy - "two more legs of oil and I can afford the
 * turret" - and random shortages would turn that planning into a coin flip.
 */

import { SERVICE } from "./journey.js";
import { TRADE_GOOD_IDS, AMMUNITION_IDS } from "./cargo.js";
import { PERSONAL_WEAPON_IDS } from "./weapons.js";
import { PLAYER, ECONOMY } from "./balance.js";

export const SHOP_DEFINITIONS = {
  [SERVICE.cargoTrader]: {
    id: SERVICE.cargoTrader,
    titleKey: "SHOP_CARGO_TRADER",
    /** Cargo the trader will sell to the player. */
    sells: TRADE_GOOD_IDS,
    /** Cargo the trader will buy from the player. */
    buys: TRADE_GOOD_IDS,
  },

  [SERVICE.weaponShop]: {
    id: SERVICE.weaponShop,
    titleKey: "SHOP_WEAPONS",
    /** The pistol is never for sale - the player already has it. */
    sells: PERSONAL_WEAPON_IDS.filter((id) => id !== "pistol"),
    buys: [],
  },

  [SERVICE.ammunitionShop]: {
    id: SERVICE.ammunitionShop,
    titleKey: "SHOP_AMMUNITION",
    sells: AMMUNITION_IDS,
    buys: [],
  },

  [SERVICE.medicalService]: {
    id: SERVICE.medicalService,
    titleKey: "SHOP_MEDICAL",
    sells: ["medkit"],
    buys: [],
    /** Patching the player up completely, in one flat payment. */
    fullHealPrice: ECONOMY.fullHealPrice,
    medkitPrice: 75,
    medkitHealAmount: PLAYER.medkit.healAmount,
    maxMedkits: PLAYER.medkit.maxCarried,
  },

  [SERVICE.repairArea]: {
    id: SERVICE.repairArea,
    titleKey: "SHOP_REPAIR",
    sells: [],
    buys: [],
    healthPointsPerCurrencyUnit: ECONOMY.healthPointsPerCurrencyUnit,
    presets: ECONOMY.repairPresets,
  },

  [SERVICE.trainWorkshop]: {
    id: SERVICE.trainWorkshop,
    titleKey: "SHOP_WORKSHOP",
    sells: [],
    buys: [],
    /**
     * The workshop is where wagons are bought, upgraded and armoured, and
     * where the Loader is hired. It never opens on its own - the player has to
     * walk to the workbench and interact with the blueprint.
     */
    opensAutomatically: false,
  },
};

export function shopDefinition(serviceId) {
  const definition = SHOP_DEFINITIONS[serviceId];
  if (!definition) throw new Error(`Unknown service: ${serviceId}`);
  return definition;
}
