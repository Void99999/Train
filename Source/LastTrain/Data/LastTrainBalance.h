// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "Data/LastTrainTypes.h"
#include "LastTrainBalance.generated.h"

class UDataTable;

/**
 * Weight penalties. Each is subtracted from the train's performance
 * multiplier, which then scales top speed and acceleration.
 */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FTrainPerformanceBalance
{
	GENERATED_BODY()

	/** Every wagon behind the locomotive costs this much top performance. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Performance", meta = (ClampMin = "0.0"))
	float PenaltyPerWagon = 0.03f;

	/** Every armoured vehicle - locomotive included - costs this much more. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Performance", meta = (ClampMin = "0.0"))
	float PenaltyPerArmouredVehicle = 0.02f;

	/**
	 * Loaded cargo also weighs something. Kept small next to the structural
	 * penalties: a fully loaded level 4 transport wagon (80 slots) costs 1.6%.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Performance", meta = (ClampMin = "0.0"))
	float PenaltyPerOccupiedCargoSlot = 0.0002f;

	/**
	 * However heavy the train gets, it must never become unplayable. The
	 * multiplier is clamped here, so a maxed-out train still runs at 55%.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Performance", meta = (ClampMin = "0.1", ClampMax = "1.0"))
	float MinimumMultiplier = 0.55f;
};

/** Sprint budget. */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FStaminaBalance
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Stamina")
	float Max = 100.f;

	/** 100 stamina / 12.5 per second = 8 seconds of continuous sprint. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Stamina")
	float DrainPerSecond = 12.5f;

	/** 100 stamina / 16.67 per second = about 6 seconds to refill from empty. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Stamina")
	float RegenPerSecond = 100.f / 6.f;

	/** Regeneration only starts this long after the player stops sprinting. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Stamina")
	float RegenDelaySeconds = 1.f;

	/** Sprinting is refused below this value, to avoid one-step stutter sprints. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Stamina")
	float MinimumToStartSprinting = 10.f;
};

/**
 * Movement speeds, in centimetres per second.
 *
 * The design document is in metres per second; Unreal works in centimetres, so
 * these are the design values times a hundred and the comment carries the
 * original. Converting in one place beats converting at every call site.
 */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FPlayerMovementBalance
{
	GENERATED_BODY()

	/** 3.2 m/s. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Movement")
	float WalkSpeed = 320.f;

	/** 6.0 m/s. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Movement")
	float SprintSpeed = 600.f;

	/** 1.6 m/s. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Movement")
	float CrouchSpeed = 160.f;

	/** 0.9 m/s, used during the opening crawl. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Movement")
	float CrawlSpeed = 90.f;

	/** Interaction probe length: 2.6 m. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Movement")
	float InteractionRange = 260.f;
};

/** How a mode punishes death. */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FGameModeBalance
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Mode")
	bool bRespawnAtLastReachedOutpost = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Mode", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float MoneyLossOnDeath = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Mode", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float CargoLossOnDeath = 0.25f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Mode", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float RespawnHealthFraction = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Mode", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float RespawnVehicleHealthFraction = 0.6f;
};

/**
 * Every cross-cutting number in LAST TRAIN, in one place.
 *
 * A UDeveloperSettings, so it appears under Project Settings -> Game -> Last
 * Train Balance and is saved to DefaultGame.ini as readable text. That gives
 * the data-driven balancing the design asks for without needing an asset to
 * exist before the game will run, and it means a designer can retune the train
 * without a programmer and without a recompile.
 *
 * Numbers that belong to a catalogue of things - wagons, weapons, cargo,
 * enemies - live in that catalogue's data table instead, so every value has
 * exactly one home.
 */
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "Last Train Balance"))
class LASTTRAIN_API ULastTrainBalance : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	ULastTrainBalance();

	/** Convenience accessor. Never null: developer settings are always resident. */
	static const ULastTrainBalance& Get();

	virtual FName GetCategoryName() const override;

	/* ------------------------------------------------------------- train */

	/**
	 * Top speed of a bare locomotive at 100% throttle, in km/h.
	 * 80 km/h means 10 km of track takes about seven and a half minutes, which
	 * is the intended pacing for one leg of the journey.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train", meta = (ClampMin = "1.0"))
	float BaseMaxSpeedKmh = 80.f;

	/** The four notches in the driver's cabin, as fractions of top speed. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train")
	TArray<float> ThrottleSteps;

	/** Notch a fresh run starts on, as an index into ThrottleSteps. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train", meta = (ClampMin = "0"))
	int32 DefaultThrottleIndex = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train")
	FTrainPerformanceBalance Performance;

	/** Acceleration of a bare locomotive, m/s^2. Heavier trains scale down. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train", meta = (ClampMin = "0.01"))
	float AccelerationMetresPerSecondSquared = 0.45f;

	/** Deceleration when the throttle is lowered, m/s^2. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train", meta = (ClampMin = "0.01"))
	float DecelerationMetresPerSecondSquared = 0.7f;

	/** Rolling deceleration of a wagon that lost its locomotive, m/s^2. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train", meta = (ClampMin = "0.01"))
	float DetachedRollingDeceleration = 0.22f;

	/** Gap between vehicle centres, in metres. Layout and Loader pathing use it. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Train", meta = (ClampMin = "0.0"))
	float CouplingLengthMetres = 2.2f;

	/* ----------------------------------------------------------- journey */

	/**
	 * Total length of the railway.
	 *
	 * The player is never shown this number, and no UI may display distance
	 * remaining. It exists so the world streamer and the ending trigger agree.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Journey", meta = (ClampMin = "1.0"))
	float TotalDistanceKm = 100.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Journey", meta = (ClampMin = "1"))
	int32 OutpostCount = 10;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Journey", meta = (ClampMin = "0.1"))
	float OutpostSpacingKm = 10.f;

	/**
	 * Quiet time after leaving an outpost before anything may be spawned, so
	 * nothing attacks while the player can still see the platform.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Journey", meta = (ClampMin = "0.0"))
	float PostOutpostPeaceSeconds = 45.f;

	/** How close the train must be to dock, in metres. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Journey", meta = (ClampMin = "1.0"))
	float OutpostDockRadiusMetres = 120.f;

	/* ------------------------------------------------------------ player */

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Player", meta = (ClampMin = "1.0"))
	float PlayerMaxHealth = 100.f;

	/** No passive regeneration anywhere in the game - healing is a resource. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Player", meta = (ClampMin = "0.0"))
	float PlayerHealthRegenPerSecond = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Player")
	FStaminaBalance Stamina;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Player")
	FPlayerMovementBalance Movement;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Player", meta = (ClampMin = "0.0"))
	float MedkitHealAmount = 50.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Player", meta = (ClampMin = "0"))
	int32 MedkitMaxCarried = 3;

	/* ----------------------------------------------------------- economy */

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Economy", meta = (ClampMin = "0"))
	int32 StartingMoney = 120;

	/**
	 * Ammunition already aboard when the run begins.
	 *
	 * Without this the protagonist starts with one magazine and no reserve, and
	 * the starting weapon becomes unusable the moment it runs dry.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Economy")
	TArray<FCargoStack> StartingCargo;

	/** One unit of currency restores this many hit points at a repair bay. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Economy", meta = (ClampMin = "0.01"))
	float HealthPointsPerCurrencyUnit = 5.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Economy", meta = (ClampMin = "0"))
	int32 FullHealPrice = 50;

	/* ------------------------------------------------------------ armour */

	/** A vehicle may be armoured exactly once. There are no armour levels. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Armour", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float ArmourDamageReduction = 0.3f;

	/** Share of incoming damage written off against the plates rather than the hull. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Armour", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float ArmourWearFactor = 0.5f;

	/** Armour hit points as a fraction of the vehicle's own maximum health. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Armour", meta = (ClampMin = "0.0"))
	float ArmourCapacityFactor = 0.4f;

	/** Stripped plates still help a little. Reduction is scaled by this at zero integrity. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Armour", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float ArmourStrippedEffectiveness = 0.25f;

	/* ------------------------------------------------------------ combat */

	/** Explosive falloff exponent. 1 is linear; higher concentrates damage at the centre. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Combat", meta = (ClampMin = "0.1"))
	float SplashFalloffExponent = 1.4f;

	/** Minimum share of full damage anything inside the blast radius takes. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Combat", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float SplashMinimumFraction = 0.15f;

	/** How much of a shot an intact wagon wall stops. Weapons carry a penetration value. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Combat", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float WallProtection = 0.85f;

	/* ------------------------------------------------------------- world */

	/** A full dawn-to-dawn cycle, in real seconds. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "World", meta = (ClampMin = "1.0"))
	float DayLengthSeconds = 40.f * 60.f;

	/** Time of day a fresh run starts at, 0 being midnight. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "World", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float StartTimeOfDay = 0.27f;

	/* ------------------------------------------------------------- modes */

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Modes")
	FGameModeBalance Normal;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Modes")
	FGameModeBalance Hardcore;

	/** The rules for a mode. */
	const FGameModeBalance& RulesFor(ELastTrainGameMode Mode) const;

	/* ------------------------------------------------------- damage bands */

	/** Health fraction at or above which a vehicle looks untouched. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Damage", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float DamageStateLight = 0.8f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Damage", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float DamageStateMedium = 0.55f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Damage", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float DamageStateHeavy = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Damage", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float DamageStateCritical = 0.12f;

	/** The visual band a health fraction falls into. */
	EDamageState DamageStateFor(float HealthFraction) const;

	/* ------------------------------------------------------- data tables */

	/**
	 * Optional catalogue overrides.
	 *
	 * Leave them empty and the registry uses the compiled-in defaults, so the
	 * project runs the moment it builds. Assign imported DataTables (the CSVs
	 * in Content/LastTrain/Data/Source) to move balancing out of code.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Data Tables", meta = (AllowedClasses = "/Script/Engine.DataTable"))
	FSoftObjectPath WeaponTable;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Data Tables", meta = (AllowedClasses = "/Script/Engine.DataTable"))
	FSoftObjectPath VehicleTable;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Data Tables", meta = (AllowedClasses = "/Script/Engine.DataTable"))
	FSoftObjectPath CargoTable;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Data Tables", meta = (AllowedClasses = "/Script/Engine.DataTable"))
	FSoftObjectPath EnemyTable;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Config, Category = "Data Tables", meta = (AllowedClasses = "/Script/Engine.DataTable"))
	FSoftObjectPath OutpostTable;

	/* ------------------------------------------------------------- units */

	/** Unreal works in centimetres; the design document is in metres. */
	static constexpr float MetresToUnreal = 100.f;
	static constexpr float KmhToMetresPerSecond = 1000.f / 3600.f;

	static FORCEINLINE float MetresToCm(float Metres) { return Metres * MetresToUnreal; }
	static FORCEINLINE float CmToMetres(float Centimetres) { return Centimetres / MetresToUnreal; }
};
