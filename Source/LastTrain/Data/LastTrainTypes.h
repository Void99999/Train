// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "LastTrainTypes.generated.h"

/**
 * Shared vocabulary.
 *
 * Enums and small structs that more than one system needs. Nothing in here may
 * include a system header - if a type is only used by one system, it belongs in
 * that system's own header instead.
 */

/** What a vehicle in the consist is. */
UENUM(BlueprintType)
enum class EVehicleKind : uint8
{
	Locomotive		UMETA(DisplayName = "Locomotive"),
	Transport		UMETA(DisplayName = "Transport Wagon"),
	Combat			UMETA(DisplayName = "Combat Wagon")
};

/**
 * How badly a vehicle is beaten up.
 *
 * Purely a presentation band derived from health - the simulation never asks
 * for a damage state, it asks for a health fraction. Meshes and materials swap
 * on this so damage is visible on the machine rather than only on a bar.
 */
UENUM(BlueprintType)
enum class EDamageState : uint8
{
	Pristine	UMETA(DisplayName = "Pristine"),
	Light		UMETA(DisplayName = "Light"),
	Medium		UMETA(DisplayName = "Medium"),
	Heavy		UMETA(DisplayName = "Heavy"),
	Critical	UMETA(DisplayName = "Critical"),
	Destroyed	UMETA(DisplayName = "Destroyed")
};

/** What a mount on a combat wagon can carry. */
UENUM(BlueprintType)
enum class EMountType : uint8
{
	None			UMETA(DisplayName = "None"),
	MachineGun		UMETA(DisplayName = "Machine Gun"),
	RocketLauncher	UMETA(DisplayName = "Rocket Launcher"),
	HeavyCannon		UMETA(DisplayName = "Heavy Cannon")
};

/** How a weapon delivers its damage. */
UENUM(BlueprintType)
enum class EWeaponDelivery : uint8
{
	/** Instant line trace. Pistols, rifles, machine guns. */
	Hitscan			UMETA(DisplayName = "Hitscan"),
	/** A travelling projectile that can be led and can miss. Rockets, shells. */
	Projectile		UMETA(DisplayName = "Projectile")
};

/** The two difficulties from the specification. */
UENUM(BlueprintType)
enum class ELastTrainGameMode : uint8
{
	/** Death sends the player back to the last outpost they reached. */
	Normal		UMETA(DisplayName = "Normal"),
	/** One life. If the run ends, it ends. */
	Hardcore	UMETA(DisplayName = "Hardcore")
};

/** Top-level state. Drives what ticks, what accepts input and what is on screen. */
UENUM(BlueprintType)
enum class ELastTrainState : uint8
{
	Boot		UMETA(DisplayName = "Boot"),
	MainMenu	UMETA(DisplayName = "Main Menu"),
	Intro		UMETA(DisplayName = "Intro"),
	Playing		UMETA(DisplayName = "Playing"),
	AtOutpost	UMETA(DisplayName = "At Outpost"),
	Paused		UMETA(DisplayName = "Paused"),
	RunFailed	UMETA(DisplayName = "Run Failed"),
	Ending		UMETA(DisplayName = "Ending")
};

/** Why a run ended badly. */
UENUM(BlueprintType)
enum class ERunFailure : uint8
{
	None				UMETA(DisplayName = "None"),
	PlayerKilled		UMETA(DisplayName = "Player Killed"),
	LocomotiveDestroyed	UMETA(DisplayName = "Locomotive Destroyed")
};

/**
 * A quantity of one kind of cargo.
 *
 * Used for shop stock, for what a wagon is carrying, and for the ammunition
 * the run starts with, so all three speak the same language.
 */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FCargoStack
{
	GENERATED_BODY()

	/** Row name in the cargo table. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cargo")
	FName CargoId = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cargo", meta = (ClampMin = "0"))
	int32 Quantity = 0;

	FCargoStack() = default;
	FCargoStack(FName InCargoId, int32 InQuantity)
		: CargoId(InCargoId), Quantity(InQuantity) {}

	bool IsEmpty() const { return CargoId.IsNone() || Quantity <= 0; }
};

/** Splash damage description, on the weapons that have one. */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FSplashDamage
{
	GENERATED_BODY()

	/** Zero means the weapon does no splash at all. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Damage", meta = (ClampMin = "0.0"))
	float RadiusMetres = 0.f;

	bool IsExplosive() const { return RadiusMetres > 0.f; }
};
