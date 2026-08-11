// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Data/LastTrainCatalogRows.h"
#include "TrainVehicle.generated.h"

class UBoxComponent;
class UStaticMeshComponent;
class UVehicleHealthComponent;
class UCargoHoldComponent;
class ARailSpline;

/**
 * One vehicle in the consist: the locomotive, or a wagon.
 *
 * It does not move itself. ATrainActor owns the distance along the rail and
 * places every vehicle each frame, because a train is one object that happens
 * to be made of several bodies - letting each carriage integrate its own
 * position is how consists drift apart and couplings stretch.
 *
 * The hull is a movable primitive on the TrainVehicle collision profile. That
 * matters: it is what lets UCharacterMovementComponent treat the floor as a
 * moving base, so the player rides the train instead of being left standing
 * where it used to be.
 *
 * Meshes are placeholders until real art exists. Blockout geometry is built
 * from the engine's basic shapes and is clearly labelled as such - it is not
 * final quality and must not be presented as such.
 */
UCLASS(Abstract)
class LASTTRAIN_API ATrainVehicle : public AActor
{
	GENERATED_BODY()

public:
	ATrainVehicle();

	virtual void BeginPlay() override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent,
		AController* EventInstigator, AActor* DamageCauser) override;

	/**
	 * Adopts a catalogue row: health, cargo capacity, dimensions, blockout size.
	 * Called by the train when the consist is built or a wagon is upgraded.
	 */
	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	void ConfigureFromCatalogue(FName InVehicleId);

	UFUNCTION(BlueprintPure, Category = "Vehicle") FName GetVehicleId() const { return VehicleId; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") const FVehicleRow& GetRow() const { return Row; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") float GetLengthMetres() const { return Row.LengthMetres; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") UVehicleHealthComponent* GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") UCargoHoldComponent* GetCargoHold() const { return CargoHold; }

	/** Where this vehicle sits behind the locomotive, in centimetres. */
	UFUNCTION(BlueprintPure, Category = "Vehicle")
	float GetDistanceBehindHead() const { return DistanceBehindHead; }

	void SetDistanceBehindHead(float Centimetres) { DistanceBehindHead = Centimetres; }

	/** Placed by the train. Never call this from the vehicle's own tick. */
	void PlaceOnRail(const ARailSpline& Rail, float HeadDistance);

	/** True once the hull has run out of health. */
	UFUNCTION(BlueprintPure, Category = "Vehicle")
	bool IsDestroyed() const;

protected:
	/** Rebuilds the blockout hull to the row's dimensions. */
	void RebuildBlockout();

	UFUNCTION()
	void HandleDamageStateChanged(EDamageState NewState);

	UFUNCTION()
	void HandleDestroyed();

	/** The collision hull. Root, movable, and what the player stands on. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UBoxComponent> Hull;

	/**
	 * PLACEHOLDER blockout mesh.
	 *
	 * Assign a real static mesh in a Blueprint subclass and the blockout is
	 * skipped. Until then this is an engine cube scaled to the vehicle's
	 * dimensions - a stand-in for a modelled locomotive, not a finished one.
	 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UStaticMeshComponent> BlockoutMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UVehicleHealthComponent> Health;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Vehicle")
	TObjectPtr<UCargoHoldComponent> CargoHold;

	/** Catalogue row name. Set in a subclass or by the train. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Vehicle")
	FName VehicleId;

	UPROPERTY(Transient, BlueprintReadOnly, Category = "Vehicle")
	FVehicleRow Row;

	UPROPERTY(Transient)
	float DistanceBehindHead = 0.f;
};
