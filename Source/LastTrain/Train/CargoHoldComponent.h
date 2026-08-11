// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/LastTrainTypes.h"
#include "CargoHoldComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnCargoChanged, int32, UsedSlots, int32, TotalSlots);

/**
 * The space inside one vehicle.
 *
 * Slots, not weight. A slot is a decision: coal is one, a rocket is three, a
 * heavy shell is five, and the player is constantly choosing between carrying
 * ammunition and carrying something they can sell. Weight is modelled
 * separately, as a performance penalty on the train.
 *
 * Ammunition lives here rather than on the player for the same reason. Reloading
 * draws from the train, so running out means going back for more.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UCargoHoldComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UCargoHoldComponent();

	void ConfigureFromRow(int32 InTotalSlots);

	UFUNCTION(BlueprintPure, Category = "Cargo") int32 GetTotalSlots() const { return TotalSlots; }
	UFUNCTION(BlueprintPure, Category = "Cargo") int32 GetUsedSlots() const;
	UFUNCTION(BlueprintPure, Category = "Cargo") int32 GetFreeSlots() const { return FMath::Max(0, TotalSlots - GetUsedSlots()); }

	UFUNCTION(BlueprintPure, Category = "Cargo")
	int32 GetQuantity(FName CargoId) const;

	/** How many units of this would fit right now. */
	UFUNCTION(BlueprintPure, Category = "Cargo")
	int32 GetSpaceFor(FName CargoId) const;

	/** Returns how many were actually loaded, which may be fewer than asked. */
	UFUNCTION(BlueprintCallable, Category = "Cargo")
	int32 Add(FName CargoId, int32 Quantity);

	/** Returns how many were actually removed. */
	UFUNCTION(BlueprintCallable, Category = "Cargo")
	int32 Remove(FName CargoId, int32 Quantity);

	UFUNCTION(BlueprintCallable, Category = "Cargo")
	void RemoveFraction(float Fraction);

	UFUNCTION(BlueprintPure, Category = "Cargo")
	const TArray<FCargoStack>& GetContents() const { return Contents; }

	UPROPERTY(BlueprintAssignable, Category = "Cargo") FOnCargoChanged OnCargoChanged;

private:
	int32 SlotCostOf(FName CargoId) const;

	UPROPERTY(Transient) int32 TotalSlots = 0;
	UPROPERTY(Transient) TArray<FCargoStack> Contents;
};
