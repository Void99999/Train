// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "Data/LastTrainTypes.h"
#include "LastTrainCatalogRows.generated.h"

/**
 * The catalogues: weapons, vehicles, cargo, enemies, outposts.
 *
 * Every one is an FTableRowBase, so the same struct serves a DataTable asset
 * built from the CSVs in Content/LastTrain/Data/Source and the compiled-in
 * default set the registry falls back to. That is what lets the project run
 * the moment it builds while still being fully data-driven afterwards.
 *
 * Row names are the ids the rest of the game refers to things by, and they
 * match the browser prototype's ids exactly, so the balancing carries over.
 */

/**
 * A weapon.
 *
 * `Price` of zero means it cannot be bought - either the player starts with it
 * (the pistol), it belongs to a wagon mount, or it belongs to an enemy.
 */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FWeaponRow : public FTableRowBase
{
	GENERATED_BODY()

	/** Localization key for the display name, e.g. WEAPON_PISTOL. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	FString NameKey;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "0.0"))
	float Damage = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "1"))
	int32 MagazineSize = 1;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "1.0"))
	float RoundsPerMinute = 60.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "0.0"))
	float ReloadSeconds = 1.f;

	/** Effective range, in metres. Converted to Unreal units at the call site. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "0.0"))
	float RangeMetres = 50.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	EWeaponDelivery Delivery = EWeaponDelivery::Hitscan;

	/** Metres per second. Ignored for hitscan weapons. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "0.0"))
	float ProjectileSpeed = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	FSplashDamage Splash;

	/**
	 * How much of a wall's protection this weapon defeats, 0 to 1. Checked
	 * against the global WallProtection when a shot hits a vehicle the player
	 * is standing inside.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Penetration = 0.f;

	/** Cargo row that feeds this weapon. None means it never needs reloading from stores. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	FName AmmoCargoId;

	/** Zero means not for sale. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "0"))
	int32 Price = 0;

	/** True for the weapons that appear on the player's TAB wheel. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	bool bPersonal = false;

	/** Seconds between shots, derived rather than stored twice. */
	float ShotIntervalSeconds() const { return 60.f / FMath::Max(1.f, RoundsPerMinute); }
};

/**
 * A vehicle at one upgrade level.
 *
 * Row name is "<kind>_<level>", for example "transport_3", so a level is a row
 * rather than a multiplier applied to a base - which is what lets a level 4
 * transport wagon be genuinely longer and taller than a level 1 rather than
 * the same mesh scaled up.
 */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FVehicleRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FString NameKey;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	EVehicleKind Kind = EVehicleKind::Transport;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "1"))
	int32 Level = 1;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "1.0"))
	float MaxHealth = 600.f;

	/** Metres. The train lays vehicles out along the rail spline using this. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0.1"))
	float LengthMetres = 10.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0.1"))
	float WidthMetres = 3.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0.1"))
	float HeightMetres = 3.6f;

	/** Transport wagons only. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0"))
	int32 CargoSlots = 0;

	/** Combat wagons only. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0"))
	int32 MountCount = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	EMountType MountType = EMountType::None;

	/** Zero means this level cannot be bought outright, only upgraded into. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0"))
	int32 PurchasePrice = 0;

	/** Cost to reach this level from the one below. Zero on level 1. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0"))
	int32 UpgradePrice = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle", meta = (ClampMin = "0"))
	int32 ArmourPrice = 0;
};

/** A tradeable good. */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FCargoRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cargo")
	FString NameKey;

	/** How many of a wagon's slots one unit occupies. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cargo", meta = (ClampMin = "1"))
	int32 SlotCost = 1;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cargo", meta = (ClampMin = "0"))
	int32 BasePrice = 10;

	/**
	 * How far an outpost's price may drift from the base, either way. Trading
	 * profit comes from this spread, so a good with no volatility is a
	 * consumable rather than a trade good.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cargo", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Volatility = 0.f;

	/** Rounds delivered per unit, for ammunition. Zero for everything else. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cargo", meta = (ClampMin = "0"))
	int32 RoundsPerUnit = 0;
};

/** An enemy archetype. */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FEnemyRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	FString NameKey;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "1.0"))
	float MaxHealth = 60.f;

	/** Which weapon row this enemy fires. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	FName WeaponId;

	/** Metres per second. Vehicles chase the train with this. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "0.0"))
	float MoveSpeedMetresPerSecond = 3.f;

	/** Money awarded for killing it. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "0"))
	int32 Bounty = 10;

	/** True for anything that is a vehicle rather than a person. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	bool bIsVehicle = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "0.1"))
	float LengthMetres = 0.7f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "0.1"))
	float WidthMetres = 0.7f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "0.1"))
	float HeightMetres = 1.8f;
};

/** A safe outpost along the line. */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FOutpostRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	FString NameKey;

	/** Where it sits on the hundred kilometres. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost", meta = (ClampMin = "0.0"))
	float DistanceKm = 10.f;

	/** Its position in the sequence, 1-based. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost", meta = (ClampMin = "1"))
	int32 Index = 1;

	/** Which services it offers. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	bool bHasCargoTrader = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	bool bHasWeaponSupply = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	bool bHasAmmunitionStore = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	bool bHasMedicalPost = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	bool bHasRepairBay = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	bool bHasWorkshop = false;

	/**
	 * What becomes available on arrival, as a weapon or vehicle row name.
	 *
	 * Progression is a property of the place rather than a separate schedule,
	 * so moving an outpost moves what it unlocks with it.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Outpost")
	TArray<FName> Unlocks;
};
