// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/LastTrainTypes.h"
#include "TrainActor.generated.h"

class ARailSpline;
class ATrainVehicle;
class ALocomotive;
class AWagon;
class UThrottleComponent;
class UTrainAudioComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTrainSpeedChanged, float, SpeedKmh);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnConsistChanged, int32, VehicleCount);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDistanceTravelled, float, DistanceKm);

/**
 * The train: one locomotive and whatever is coupled behind it.
 *
 * This actor owns the single number that matters - how far down the rail the
 * head of the train is - and places every vehicle from it each frame. One
 * integrator, many bodies. Letting each carriage move itself is how consists
 * drift apart, couplings stretch, and a wagon ends up on a different curve
 * from the one in front of it.
 *
 * Speed is not the throttle. The throttle asks for a fraction of top speed; the
 * train accelerates towards it at a rate scaled by how much it is dragging.
 * A loaded, armoured, four-wagon train takes a long time to answer, and that
 * lag is the weight the player can feel rather than read.
 */
UCLASS()
class LASTTRAIN_API ATrainActor : public AActor
{
	GENERATED_BODY()

public:
	ATrainActor();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** The train in this world, or null. */
	static ATrainActor* Find(const UObject* WorldContext);

	/* ---------------------------------------------------------- consist */

	UFUNCTION(BlueprintPure, Category = "Train") ALocomotive* GetLocomotive() const { return Locomotive; }
	UFUNCTION(BlueprintPure, Category = "Train") const TArray<TObjectPtr<ATrainVehicle>>& GetVehicles() const { return Vehicles; }
	UFUNCTION(BlueprintPure, Category = "Train") int32 GetWagonCount() const;

	/** Couples a new wagon on the back. Returns it, or null if it could not be built. */
	UFUNCTION(BlueprintCallable, Category = "Train")
	ATrainVehicle* AttachWagon(FName VehicleId);

	/**
	 * Uncouples a wagon and everything behind it.
	 *
	 * Everything behind, because a coupling that fails in the middle of a train
	 * does not politely reattach the tail to the front. Losing a wagon at speed
	 * costs the player whatever was in the ones after it.
	 */
	UFUNCTION(BlueprintCallable, Category = "Train")
	bool DetachFrom(ATrainVehicle* Vehicle);

	/* ------------------------------------------------------------ motion */

	UFUNCTION(BlueprintPure, Category = "Train") UThrottleComponent* GetThrottle() const { return Throttle; }

	/** Current speed in km/h, which is what the cab dial and the HUD read. */
	UFUNCTION(BlueprintPure, Category = "Train") float GetSpeedKmh() const;

	UFUNCTION(BlueprintPure, Category = "Train") float GetSpeedMetresPerSecond() const { return SpeedMetresPerSecond; }

	/** How far the head has come, in kilometres. */
	UFUNCTION(BlueprintPure, Category = "Train") float GetDistanceTravelledKm() const;

	/**
	 * How much of a bare locomotive's performance this train still has, 0 to 1.
	 * Weight, armour and cargo all take a bite; the result is floored so a
	 * maxed-out train is slow rather than stuck.
	 */
	UFUNCTION(BlueprintPure, Category = "Train") float GetPerformanceMultiplier() const;

	/** Top speed this train can currently reach, in km/h. */
	UFUNCTION(BlueprintPure, Category = "Train") float GetMaxSpeedKmh() const;

	/* ------------------------------------------------------------- cargo */

	/** Rounds of an ammunition type available across the whole train. */
	UFUNCTION(BlueprintPure, Category = "Train")
	int32 CountRoundsAvailable(FName CargoId) const;

	/**
	 * Takes rounds from wherever they are aboard. Returns how many were found.
	 *
	 * Rounds, not units: one unit of pistol ammunition is thirty rounds, and a
	 * reload that needs eight of them should not consume a whole box.
	 */
	UFUNCTION(BlueprintCallable, Category = "Train")
	int32 TakeRounds(FName CargoId, int32 Rounds);

	/** Loads cargo into the first vehicle with room. Returns how many fitted. */
	UFUNCTION(BlueprintCallable, Category = "Train")
	int32 LoadCargo(FName CargoId, int32 Quantity);

	UFUNCTION(BlueprintPure, Category = "Train") int32 GetTotalCargoSlots() const;
	UFUNCTION(BlueprintPure, Category = "Train") int32 GetUsedCargoSlots() const;

	UPROPERTY(BlueprintAssignable, Category = "Train") FOnTrainSpeedChanged OnSpeedChanged;
	UPROPERTY(BlueprintAssignable, Category = "Train") FOnConsistChanged OnConsistChanged;
	UPROPERTY(BlueprintAssignable, Category = "Train") FOnDistanceTravelled OnDistanceTravelled;

protected:
	/** Spawns the locomotive and any starting wagons, then lays them out. */
	void BuildConsist();

	/** Recomputes where each vehicle sits behind the head. */
	void RelayoutConsist();

	void PlaceVehicles();

	/** The rail this train runs on. Found automatically when left unset. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Train")
	TObjectPtr<ARailSpline> Rail;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Train")
	TSubclassOf<ALocomotive> LocomotiveClass;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Train")
	TSubclassOf<AWagon> WagonClass;

	/** Wagons coupled up before the run starts. Empty in a normal run. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Train")
	TArray<FName> StartingWagons;

	/** Where the head of the train starts, in centimetres along the rail. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Train")
	float StartDistance = 0.f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Train")
	TObjectPtr<UThrottleComponent> Throttle;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Train")
	TObjectPtr<UTrainAudioComponent> Audio;

private:
	UPROPERTY(Transient) TObjectPtr<ALocomotive> Locomotive;
	UPROPERTY(Transient) TArray<TObjectPtr<ATrainVehicle>> Vehicles;

	/** Distance of the head along the rail, in centimetres. */
	UPROPERTY(Transient) float HeadDistance = 0.f;
	UPROPERTY(Transient) float SpeedMetresPerSecond = 0.f;

	/** Only broadcast when it actually changes, to a tenth of a km/h. */
	float LastBroadcastSpeedKmh = -1.f;
	float LastBroadcastDistanceKm = -1.f;
};
