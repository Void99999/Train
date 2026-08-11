// Copyright LAST TRAIN. All rights reserved.

#include "Data/LastTrainDataRegistry.h"

/**
 * The compiled-in catalogue.
 *
 * These are the balancing values carried over verbatim from the browser
 * prototype, which is where they were tuned. They exist so that a freshly
 * cloned project runs the moment it compiles, before anyone has opened the
 * editor to import a DataTable.
 *
 * This file is a fallback, not the source of truth. The moment the CSVs in
 * Content/LastTrain/Data/Source are imported and assigned under Project
 * Settings, the registry uses those instead and this is never read. Keep the
 * two in step: Tools/validate_project.mjs checks that they agree.
 */

namespace
{
	FWeaponRow MakeWeapon(
		const TCHAR* NameKey, float Damage, int32 Magazine, float Rpm, float ReloadSeconds,
		float RangeMetres, EWeaponDelivery Delivery, float ProjectileSpeed, float SplashRadius,
		float Penetration, const TCHAR* AmmoId, int32 Price, bool bPersonal)
	{
		FWeaponRow Row;
		Row.NameKey = NameKey;
		Row.Damage = Damage;
		Row.MagazineSize = Magazine;
		Row.RoundsPerMinute = Rpm;
		Row.ReloadSeconds = ReloadSeconds;
		Row.RangeMetres = RangeMetres;
		Row.Delivery = Delivery;
		Row.ProjectileSpeed = ProjectileSpeed;
		Row.Splash.RadiusMetres = SplashRadius;
		Row.Penetration = Penetration;
		Row.AmmoCargoId = AmmoId ? FName(AmmoId) : NAME_None;
		Row.Price = Price;
		Row.bPersonal = bPersonal;
		return Row;
	}

	FVehicleRow MakeVehicle(
		const TCHAR* NameKey, EVehicleKind Kind, int32 Level, float MaxHealth,
		float Length, float Width, float Height, int32 CargoSlots,
		int32 MountCount, EMountType MountType,
		int32 PurchasePrice, int32 UpgradePrice, int32 ArmourPrice)
	{
		FVehicleRow Row;
		Row.NameKey = NameKey;
		Row.Kind = Kind;
		Row.Level = Level;
		Row.MaxHealth = MaxHealth;
		Row.LengthMetres = Length;
		Row.WidthMetres = Width;
		Row.HeightMetres = Height;
		Row.CargoSlots = CargoSlots;
		Row.MountCount = MountCount;
		Row.MountType = MountType;
		Row.PurchasePrice = PurchasePrice;
		Row.UpgradePrice = UpgradePrice;
		Row.ArmourPrice = ArmourPrice;
		return Row;
	}

	FCargoRow MakeCargo(const TCHAR* NameKey, int32 SlotCost, int32 BasePrice, float Volatility, int32 RoundsPerUnit)
	{
		FCargoRow Row;
		Row.NameKey = NameKey;
		Row.SlotCost = SlotCost;
		Row.BasePrice = BasePrice;
		Row.Volatility = Volatility;
		Row.RoundsPerUnit = RoundsPerUnit;
		return Row;
	}

	FEnemyRow MakeEnemy(
		const TCHAR* NameKey, float MaxHealth, const TCHAR* WeaponId, float MoveSpeed,
		int32 Bounty, bool bIsVehicle, float Length, float Width, float Height)
	{
		FEnemyRow Row;
		Row.NameKey = NameKey;
		Row.MaxHealth = MaxHealth;
		Row.WeaponId = FName(WeaponId);
		Row.MoveSpeedMetresPerSecond = MoveSpeed;
		Row.Bounty = Bounty;
		Row.bIsVehicle = bIsVehicle;
		Row.LengthMetres = Length;
		Row.WidthMetres = Width;
		Row.HeightMetres = Height;
		return Row;
	}
}

void ULastTrainDataRegistry::ApplyDefaultCatalogue()
{
	/* --------------------------------------------------------- weapons */

	// The starting weapon. Never for sale: he already has it.
	Weapons.Add(TEXT("pistol"), MakeWeapon(
		TEXT("WEAPON_PISTOL"), 25.f, 12, 260.f, 1.4f, 60.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.05f, TEXT("pistol_ammo"), 0, true));

	Weapons.Add(TEXT("assault_rifle"), MakeWeapon(
		TEXT("WEAPON_ASSAULT_RIFLE"), 30.f, 30, 600.f, 2.3f, 180.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.2f, TEXT("rifle_ammo"), 450, true));

	Weapons.Add(TEXT("rpg"), MakeWeapon(
		TEXT("WEAPON_RPG"), 500.f, 1, 25.f, 3.4f, 300.f,
		EWeaponDelivery::Projectile, 55.f, 6.f, 1.f, TEXT("rocket"), 1200, true));

	Weapons.Add(TEXT("minigun"), MakeWeapon(
		TEXT("WEAPON_MINIGUN"), 20.f, 150, 1800.f, 5.5f, 160.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.35f, TEXT("rifle_ammo"), 3000, true));

	// Wagon mounts. Bought with the wagon level, not from a shop.
	Weapons.Add(TEXT("mounted_machine_gun"), MakeWeapon(
		TEXT("WEAPON_MOUNTED_MACHINE_GUN"), 35.f, 100, 550.f, 4.f, 260.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.4f, TEXT("rifle_ammo"), 0, false));

	Weapons.Add(TEXT("mounted_rocket_launcher"), MakeWeapon(
		TEXT("WEAPON_MOUNTED_ROCKET_LAUNCHER"), 650.f, 2, 30.f, 4.5f, 420.f,
		EWeaponDelivery::Projectile, 70.f, 9.f, 1.f, TEXT("rocket"), 0, false));

	Weapons.Add(TEXT("heavy_turret_cannon"), MakeWeapon(
		TEXT("WEAPON_HEAVY_TURRET_CANNON"), 1500.f, 1, 12.f, 7.f, 600.f,
		EWeaponDelivery::Projectile, 240.f, 12.f, 1.f, TEXT("heavy_shell"), 0, false));

	// Enemy weapons. Never appear in a shop or on the wheel.
	Weapons.Add(TEXT("enemy_rifle"), MakeWeapon(
		TEXT("WEAPON_ASSAULT_RIFLE"), 12.f, 30, 450.f, 2.6f, 150.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.15f, nullptr, 0, false));

	Weapons.Add(TEXT("enemy_heavy_weapon"), MakeWeapon(
		TEXT("WEAPON_MOUNTED_MACHINE_GUN"), 22.f, 50, 400.f, 4.2f, 170.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.5f, nullptr, 0, false));

	Weapons.Add(TEXT("enemy_autocannon"), MakeWeapon(
		TEXT("WEAPON_MOUNTED_MACHINE_GUN"), 45.f, 40, 300.f, 5.f, 260.f,
		EWeaponDelivery::Hitscan, 0.f, 0.f, 0.7f, nullptr, 0, false));

	Weapons.Add(TEXT("enemy_tank_cannon"), MakeWeapon(
		TEXT("WEAPON_HEAVY_TURRET_CANNON"), 320.f, 1, 10.f, 6.f, 500.f,
		EWeaponDelivery::Projectile, 220.f, 8.f, 1.f, nullptr, 0, false));

	/* -------------------------------------------------------- vehicles */

	// Found abandoned at the start of the run and kept until the end. It has no
	// levels and cannot be bought, which is why it is a single row.
	Vehicles.Add(TEXT("locomotive"), MakeVehicle(
		TEXT("VEHICLE_LOCOMOTIVE"), EVehicleKind::Locomotive, 1, 1500.f,
		12.5f, 3.1f, 4.2f, /*CargoSlots*/ 12, 0, EMountType::None,
		/*Purchase*/ 0, /*Upgrade*/ 0, /*Armour*/ 1000));

	Vehicles.Add(TEXT("transport_1"), MakeVehicle(TEXT("VEHICLE_TRANSPORT"), EVehicleKind::Transport, 1, 600.f, 9.0f, 2.9f, 3.4f, 20, 0, EMountType::None, 300, 0, 500));
	Vehicles.Add(TEXT("transport_2"), MakeVehicle(TEXT("VEHICLE_TRANSPORT"), EVehicleKind::Transport, 2, 700.f, 10.0f, 3.0f, 3.6f, 35, 0, EMountType::None, 0, 250, 500));
	Vehicles.Add(TEXT("transport_3"), MakeVehicle(TEXT("VEHICLE_TRANSPORT"), EVehicleKind::Transport, 3, 800.f, 11.2f, 3.1f, 3.9f, 55, 0, EMountType::None, 0, 500, 500));
	Vehicles.Add(TEXT("transport_4"), MakeVehicle(TEXT("VEHICLE_TRANSPORT"), EVehicleKind::Transport, 4, 900.f, 12.4f, 3.2f, 4.2f, 80, 0, EMountType::None, 0, 900, 500));

	// Level 1 is bare - a hardened wagon, not a weapon. Each level after opens
	// a real firing position the player operates by hand.
	Vehicles.Add(TEXT("combat_1"), MakeVehicle(TEXT("VEHICLE_COMBAT"), EVehicleKind::Combat, 1, 750.f, 9.4f, 3.0f, 3.5f, 0, 0, EMountType::None, 500, 0, 700));
	Vehicles.Add(TEXT("combat_2"), MakeVehicle(TEXT("VEHICLE_COMBAT"), EVehicleKind::Combat, 2, 850.f, 9.8f, 3.1f, 3.6f, 0, 1, EMountType::MachineGun, 0, 450, 700));
	Vehicles.Add(TEXT("combat_3"), MakeVehicle(TEXT("VEHICLE_COMBAT"), EVehicleKind::Combat, 3, 950.f, 10.4f, 3.2f, 3.8f, 0, 1, EMountType::RocketLauncher, 0, 900, 700));
	Vehicles.Add(TEXT("combat_4"), MakeVehicle(TEXT("VEHICLE_COMBAT"), EVehicleKind::Combat, 4, 1100.f, 11.0f, 3.3f, 4.6f, 0, 1, EMountType::HeavyCannon, 0, 1800, 700));

	/* ----------------------------------------------------------- cargo */

	// Trade goods. Volatility is what the profit comes from.
	Cargo.Add(TEXT("coal"), MakeCargo(TEXT("CARGO_COAL"), 1, 10, 0.35f, 0));
	Cargo.Add(TEXT("fuel_can"), MakeCargo(TEXT("CARGO_FUEL_CAN"), 2, 35, 0.4f, 0));
	Cargo.Add(TEXT("oil_barrel"), MakeCargo(TEXT("CARGO_OIL_BARREL"), 4, 100, 0.45f, 0));

	// Ammunition. Bought at a steady price and never sold back, so it is a
	// running cost rather than something to speculate on.
	Cargo.Add(TEXT("pistol_ammo"), MakeCargo(TEXT("CARGO_PISTOL_AMMO"), 1, 20, 0.f, 30));
	Cargo.Add(TEXT("rifle_ammo"), MakeCargo(TEXT("CARGO_RIFLE_AMMO"), 1, 50, 0.f, 30));
	Cargo.Add(TEXT("rocket"), MakeCargo(TEXT("CARGO_ROCKET"), 3, 100, 0.f, 1));
	Cargo.Add(TEXT("heavy_shell"), MakeCargo(TEXT("CARGO_HEAVY_SHELL"), 5, 150, 0.f, 1));

	/* --------------------------------------------------------- enemies */

	Enemies.Add(TEXT("soldier"), MakeEnemy(TEXT("ENEMY_SOLDIER"), 80.f, TEXT("enemy_rifle"), 4.6f, 15, false, 0.6f, 0.7f, 1.8f));
	Enemies.Add(TEXT("heavy_soldier"), MakeEnemy(TEXT("ENEMY_HEAVY_SOLDIER"), 200.f, TEXT("enemy_heavy_weapon"), 2.9f, 35, false, 0.75f, 0.9f, 1.9f));
	// Faster than the train at full throttle, so it can run alongside.
	Enemies.Add(TEXT("combat_vehicle"), MakeEnemy(TEXT("ENEMY_COMBAT_VEHICLE"), 600.f, TEXT("enemy_autocannon"), 30.f, 120, true, 5.4f, 2.3f, 2.2f));
	// Slower than a train at speed. It has to be met, or outrun.
	Enemies.Add(TEXT("tank"), MakeEnemy(TEXT("ENEMY_TANK"), 2500.f, TEXT("enemy_tank_cannon"), 16.f, 400, true, 7.6f, 3.4f, 2.6f));

	/* -------------------------------------------------------- outposts */

	// Ten posts at ten kilometre intervals. The player is never told how many
	// there are or how far the line runs - see the note on TotalDistanceKm.
	static const TCHAR* OutpostNameKeys[] = {
		TEXT("OUTPOST_1_NAME"), TEXT("OUTPOST_2_NAME"), TEXT("OUTPOST_3_NAME"),
		TEXT("OUTPOST_4_NAME"), TEXT("OUTPOST_5_NAME"), TEXT("OUTPOST_6_NAME"),
		TEXT("OUTPOST_7_NAME"), TEXT("OUTPOST_8_NAME"), TEXT("OUTPOST_9_NAME"),
		TEXT("OUTPOST_10_NAME")
	};

	for (int32 Index = 0; Index < UE_ARRAY_COUNT(OutpostNameKeys); ++Index)
	{
		const int32 Number = Index + 1;

		FOutpostRow Row;
		Row.NameKey = OutpostNameKeys[Index];
		Row.Index = Number;
		Row.DistanceKm = static_cast<float>(Number) * 10.f;
		Row.bHasCargoTrader = true;
		Row.bHasRepairBay = true;
		Row.bHasWorkshop = true;
		Row.bHasAmmunitionStore = true;
		Row.bHasWeaponSupply = true;
		Row.bHasMedicalPost = true;

		// What each post opens up. Spread so the minigun lands two thirds of
		// the way along, leaving four legs to use it on.
		switch (Number)
		{
		case 1:
			Row.Unlocks = { TEXT("assault_rifle"), TEXT("transport_1"), TEXT("combat_1"), TEXT("combat_2") };
			break;
		case 2:
			Row.Unlocks = { TEXT("upgrade.armour") };
			break;
		case 3:
			Row.Unlocks = { TEXT("rpg"), TEXT("combat_3") };
			break;
		case 4:
			Row.Unlocks = { TEXT("combat_4"), TEXT("crew.loader") };
			break;
		case 6:
			Row.Unlocks = { TEXT("minigun") };
			break;
		default:
			break;
		}

		Outposts.Add(FName(*FString::Printf(TEXT("outpost_%d"), Number)), Row);
	}
}
