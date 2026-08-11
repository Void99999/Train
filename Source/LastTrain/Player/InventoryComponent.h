// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/LastTrainTypes.h"
#include "InventoryComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnEquippedWeaponChanged, FName, WeaponId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWeaponAcquired, FName, WeaponId);

/**
 * What the protagonist personally carries: weapons and medkits.
 *
 * Ammunition is deliberately not here. It lives in the train's cargo hold,
 * because a magazine is a thing you loaded aboard and a reload is a trip to
 * the stores - that is the whole reason cargo space competes with trade goods.
 * The weapon component asks the train for rounds; this component only knows
 * which weapons exist and which one is in his hands.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UInventoryComponent();

	virtual void BeginPlay() override;

	/* --------------------------------------------------------- weapons */

	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool AcquireWeapon(FName WeaponId);

	UFUNCTION(BlueprintPure, Category = "Inventory")
	bool OwnsWeapon(FName WeaponId) const { return OwnedWeapons.Contains(WeaponId); }

	/** The wheel's contents, in catalogue order. */
	UFUNCTION(BlueprintPure, Category = "Inventory")
	const TArray<FName>& GetOwnedWeapons() const { return OwnedWeapons; }

	UFUNCTION(BlueprintPure, Category = "Inventory")
	FName GetEquippedWeapon() const { return EquippedWeapon; }

	/** Refused for a weapon that is not owned, so the wheel cannot cheat. */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool EquipWeapon(FName WeaponId);

	/* --------------------------------------------------------- medkits */

	UFUNCTION(BlueprintPure, Category = "Inventory")
	int32 GetMedkitCount() const { return Medkits; }

	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool AddMedkit(int32 Count = 1);

	/** Uses one on the owner's health component. False if none or unhurt. */
	UFUNCTION(BlueprintCallable, Category = "Inventory")
	bool UseMedkit();

	UPROPERTY(BlueprintAssignable, Category = "Inventory") FOnEquippedWeaponChanged OnEquippedWeaponChanged;
	UPROPERTY(BlueprintAssignable, Category = "Inventory") FOnWeaponAcquired OnWeaponAcquired;

protected:
	/** What he has on him when the run begins. The pistol, and nothing else. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory")
	TArray<FName> StartingWeapons;

private:
	UPROPERTY(Transient) TArray<FName> OwnedWeapons;
	UPROPERTY(Transient) FName EquippedWeapon;
	UPROPERTY(Transient) int32 Medkits = 0;
};
