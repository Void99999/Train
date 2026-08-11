// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Data/LastTrainTypes.h"
#include "LastTrainSaveGame.generated.h"

/** One vehicle as it is written to disk. */
USTRUCT()
struct LASTTRAIN_API FSavedVehicle
{
	GENERATED_BODY()

	UPROPERTY() FName VehicleId;
	UPROPERTY() float Health = 0.f;
	UPROPERTY() bool bArmoured = false;
	UPROPERTY() float ArmourIntegrity = 0.f;
	UPROPERTY() TArray<FCargoStack> Cargo;
};

/**
 * A saved run.
 *
 * Versioned from the start. Migration is cheaper to add before there are saves
 * in the wild than after, and a save that silently loads garbage into a
 * hundred-kilometre run is a worse bug than one that refuses to load.
 */
UCLASS()
class LASTTRAIN_API ULastTrainSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	/** Bump when the layout changes, and add a migration step for the old one. */
	static constexpr int32 CurrentVersion = 1;

	UPROPERTY() int32 Version = CurrentVersion;
	UPROPERTY() FDateTime SavedAtUtc;

	UPROPERTY() ELastTrainGameMode Mode = ELastTrainGameMode::Normal;

	/* ------------------------------------------------------------- run */

	UPROPERTY() float DistanceTravelledKm = 0.f;
	UPROPERTY() int32 LastOutpostReached = 0;
	UPROPERTY() float TimeOfDay = 0.27f;
	UPROPERTY() float RunTimeSeconds = 0.f;

	UPROPERTY() int32 Money = 0;
	UPROPERTY() float PlayerHealth = 100.f;
	UPROPERTY() int32 Medkits = 0;

	UPROPERTY() TArray<FSavedVehicle> Consist;
	UPROPERTY() TArray<FName> OwnedWeapons;
	UPROPERTY() FName EquippedWeapon;
	UPROPERTY() TArray<FName> GrantedUnlocks;
	UPROPERTY() bool bHasLoader = false;

	/* --------------------------------------------------------- records */

	UPROPERTY() int32 EnemiesKilled = 0;
	UPROPERTY() int32 VehiclesDestroyed = 0;
	UPROPERTY() int32 MoneyEarned = 0;
	UPROPERTY() int32 LargestTrain = 1;

	/**
	 * Brings an older save up to the current layout.
	 * Returns false when the save is too old or too new to be used.
	 */
	bool Migrate();
};
