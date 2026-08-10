/**
 * LAST TRAIN - everything that can sit inside a transport wagon.
 *
 * Trade goods and ammunition share one storage space on purpose. Space is the
 * currency of the whole mid-game: a wagon full of oil barrels earns well and
 * leaves nowhere to put artillery shells, and the player has to decide which
 * of the two gets them through the next 10 km.
 */

export const CARGO_CATEGORY = {
  tradeGood: "trade_good",
  ammunition: "ammunition",
};

/**
 * Cargo definitions.
 *
 * - `slots`      space consumed per unit inside a transport wagon
 * - `buyPrice`   price per unit at a shop, or null if it cannot be bought
 * - `sellPrice`  price per unit when sold, or null if it cannot be sold
 * - `roundsPerUnit` for ammunition packs, how many rounds one unit contains
 *
 * Trade goods sell for exactly double their purchase price. That is a
 * deliberately simple, learnable economy: the player can plan a run around it
 * instead of gambling on fluctuating prices.
 */
export const CARGO_CATALOG = {
  coal: {
    id: "coal",
    category: CARGO_CATEGORY.tradeGood,
    slots: 1,
    buyPrice: 10,
    sellPrice: 20,
  },
  fuel_can: {
    id: "fuel_can",
    category: CARGO_CATEGORY.tradeGood,
    slots: 2,
    buyPrice: 35,
    sellPrice: 70,
  },
  oil_barrel: {
    id: "oil_barrel",
    category: CARGO_CATEGORY.tradeGood,
    slots: 4,
    buyPrice: 100,
    sellPrice: 200,
  },

  pistol_ammo: {
    id: "pistol_ammo",
    category: CARGO_CATEGORY.ammunition,
    slots: 1,
    buyPrice: 20,
    sellPrice: null,
    roundsPerUnit: 30,
  },
  rifle_ammo: {
    id: "rifle_ammo",
    category: CARGO_CATEGORY.ammunition,
    slots: 1,
    buyPrice: 50,
    sellPrice: null,
    roundsPerUnit: 30,
  },
  rocket: {
    id: "rocket",
    category: CARGO_CATEGORY.ammunition,
    slots: 3,
    buyPrice: 100,
    sellPrice: null,
    roundsPerUnit: 1,
  },
  heavy_shell: {
    id: "heavy_shell",
    category: CARGO_CATEGORY.ammunition,
    slots: 5,
    buyPrice: 150,
    sellPrice: null,
    roundsPerUnit: 1,
  },
};

/** The three goods a cargo trader deals in. Always in stock, by design. */
export const TRADE_GOOD_IDS = Object.values(CARGO_CATALOG)
  .filter((item) => item.category === CARGO_CATEGORY.tradeGood)
  .map((item) => item.id);

export const AMMUNITION_IDS = Object.values(CARGO_CATALOG)
  .filter((item) => item.category === CARGO_CATEGORY.ammunition)
  .map((item) => item.id);

export function cargoSpec(id) {
  const spec = CARGO_CATALOG[id];
  if (!spec) throw new Error(`Unknown cargo item: ${id}`);
  return spec;
}

/** Storage space a quantity of one item occupies. */
export function slotsFor(id, quantity) {
  return cargoSpec(id).slots * quantity;
}

export function isTradeGood(id) {
  return cargoSpec(id).category === CARGO_CATEGORY.tradeGood;
}

export function isAmmunition(id) {
  return cargoSpec(id).category === CARGO_CATEGORY.ammunition;
}
