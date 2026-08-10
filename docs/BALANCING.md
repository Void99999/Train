# LAST TRAIN — balancing

Every number that shapes play lives in `src/data/`. Nothing is duplicated: each
value has exactly one home, and changing it there changes it everywhere.

## Where each value lives

| What | File |
| --- | --- |
| Train speed, throttle, weight penalties, acceleration | `data/balance.js` → `TRAIN` |
| Journey length, outpost count, post-outpost peace period | `data/balance.js` → `JOURNEY` |
| Player health, stamina, movement speeds, medkits | `data/balance.js` → `PLAYER` |
| Starting money, repair ratio, heal price | `data/balance.js` → `ECONOMY` |
| Armour reduction and plate wear | `data/balance.js` → `ARMOUR` |
| Damage-state thresholds | `data/balance.js` → `DAMAGE_STATES` |
| Day length | `data/balance.js` → `WORLD` |
| Normal and Hardcore rules, death penalties | `data/balance.js` → `MODES` |
| Splash falloff, wall protection | `data/balance.js` → `COMBAT` |
| Wagon health, prices, capacity, size, mounts | `data/wagons.js` |
| Cargo slot costs and prices | `data/cargo.js` |
| Weapon damage, rate of fire, ammunition, penetration | `data/weapons.js` |
| Weapon-versus-armour effectiveness | `data/damage.js` |
| Enemy health, speed, salvage | `data/enemies.js` |
| Unlock schedule, Loader | `data/progression.js` |
| Outpost positions, difficulty bands | `data/journey.js` |
| Shop stock | `data/shops.js` |

## The approved baseline

These are the design's stated values, and the test suite asserts most of them.

**Train** — top speed 80 km/h; throttle 25 / 50 / 75 / 100%; each wagon −3%
performance; each armoured vehicle a further −2%; performance floored at 55%.
At full throttle a light train covers 10 km in a little under eight minutes;
quarter throttle takes roughly four times as long.

**Health** — locomotive 1500. Transport 600 / 700 / 800 / 900. Combat
750 / 850 / 950 / 1100. Player 100, with no regeneration anywhere.

**Prices** — transport wagon 300, upgrades 250 / 500 / 900. Combat wagon 500,
upgrades 450 / 900 / 1800. Armour: locomotive 1000, transport 500, combat 700.
Assault rifle 450, RPG 1200, minigun 3000. Loader 1500. Medkit 75, full heal 50.
Repair: 1 money restores 5 condition.

**Cargo** — coal buy 10 / sell 20 / 1 slot. Fuel can 35 / 70 / 2 slots. Oil
barrel 100 / 200 / 4 slots. Pistol ammo 20 / 1 slot, rifle ammo 50 / 1 slot,
rocket 100 / 3 slots, heavy shell 150 / 5 slots.

**Armour** — 30% damage reduction, fitted once, no levels.

**Timing** — 40-minute day cycle; 45 seconds of peace after leaving an outpost;
8 seconds of sprint, ~6 seconds to recover, 1 second before recovery starts.

## Decisions taken where the design was silent

Three gaps had to be filled to make the stated numbers work. All three are
configurable and can be set back to zero.

**The locomotive holds 12 cargo slots.** The design starts the player with only
a locomotive and 120 money, and gives transport wagons no starting capacity. A
player would then have no way to trade their way to the first 300-money wagon.
A small bunker in the cab solves it without touching any listed price.
`data/wagons.js`, locomotive `cargoSlots`.

**Enemies drop salvage.** Trading margins alone do not reach a 3000 minigun, an
1800 turret upgrade and a 1500 Loader within ten outposts. Salvage is the second
income stream that puts the published price list where it was meant to sit.
Set every `salvageValue` to 0 in `data/enemies.js` for a pure-trading economy.

**Cargo weighs something.** The design lists cargo as a weight source but gives
no figure. It is charged at 0.02% performance per occupied slot, so a full
level 4 wagon costs 1.6% — felt, but far below the 3% a wagon itself costs.
`TRAIN.performance.penaltyPerOccupiedCargoSlot`.

## Weapon effectiveness

`data/damage.js` holds a multiplier per weapon class per armour class. This is
the file to edit when a weapon feels wrong against a target — not the weapon's
damage. Damage says how strong a weapon is; the table says what it is *for*.

The intended shape, all asserted in `tests/combat.test.js`:

- A pistol needs over a thousand rounds to kill a tank. It is not an option.
- An assault rifle does under 2 damage a round to heavy armour.
- A mounted machine gun handles light vehicles and cannot touch a tank.
- One RPG takes over three quarters of a combat vehicle; two finish it.
- The heavy train cannon kills a tank in two shots, never one.

## Difficulty

`DIFFICULTY_BANDS` in `data/journey.js`, keyed by distance. Each band sets
enemy weights, group size and the interval between encounters. Tanks first
appear in the 50–70 km band; the bands past 70 km combine everything and
tighten the interval.

Outpost spacing is deliberately irregular. Even 10 km gaps would let an
attentive player count platforms and work out where the line ends.
