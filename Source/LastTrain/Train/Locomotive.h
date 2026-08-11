// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Train/TrainVehicle.h"
#include "Locomotive.generated.h"

class UTrainDoorComponent;
class UBoxComponent;
class UThrottleControlComponent;

/**
 * The green locomotive.
 *
 * He finds it abandoned beside a railway shelter and it carries him the whole
 * hundred kilometres. It is not bought, not upgraded and not replaced, which is
 * why it has a single catalogue row and a class of its own rather than being a
 * wagon with a flag set.
 *
 * What makes it a locomotive rather than a box on rails is what is bolted to
 * it: a cab the player walks around in, a throttle quadrant, two side doors
 * onto exterior walkways, and a rear connection into the rest of the train.
 * The cab interior is a blockout until the modelled one exists.
 */
UCLASS()
class LASTTRAIN_API ALocomotive : public ATrainVehicle
{
	GENERATED_BODY()

public:
	ALocomotive();

	virtual void BeginPlay() override;

	UFUNCTION(BlueprintPure, Category = "Locomotive") UTrainDoorComponent* GetLeftDoor() const { return LeftDoor; }
	UFUNCTION(BlueprintPure, Category = "Locomotive") UTrainDoorComponent* GetRightDoor() const { return RightDoor; }
	UFUNCTION(BlueprintPure, Category = "Locomotive") UTrainDoorComponent* GetRearDoor() const { return RearDoor; }

protected:
	/**
	 * Builds the walkable cab: floor, walls with openings, ceiling, walkways.
	 *
	 * PLACEHOLDER geometry. It is built from boxes at runtime so the cab is
	 * walkable and its doors work before any art exists, and so the collision
	 * and the visible geometry are created together and cannot drift apart.
	 * Replace with a modelled interior; see Docs/UNREAL_SETUP.md.
	 */
	void BuildCabBlockout();

	/** One box of blockout: visible geometry and matching collision. */
	UStaticMeshComponent* AddBlockoutBox(const FName Name, const FVector& Centre, const FVector& Size,
		bool bCollides = true);

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotive")
	TObjectPtr<UTrainDoorComponent> LeftDoor;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotive")
	TObjectPtr<UTrainDoorComponent> RightDoor;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotive")
	TObjectPtr<UTrainDoorComponent> RearDoor;

	/** The throttle quadrant the player presses E on. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Locomotive")
	TObjectPtr<UThrottleControlComponent> ThrottleControl;

	/** Cab dimensions, in centimetres, derived from the vehicle row. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Locomotive")
	float CabLengthCm = 480.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Locomotive")
	float WallThicknessCm = 12.f;

	/** How far the walkway deck reaches out from the hull. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Locomotive")
	float WalkwayWidthCm = 90.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Locomotive")
	float RailingHeightCm = 106.f;

private:
	UPROPERTY(Transient)
	TArray<TObjectPtr<UStaticMeshComponent>> BlockoutPieces;
};
