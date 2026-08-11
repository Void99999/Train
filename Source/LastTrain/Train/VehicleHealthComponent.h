// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/LastTrainTypes.h"
#include "VehicleHealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnVehicleHealthChanged, float, Health, float, MaxHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDamageStateChanged, EDamageState, NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnVehicleDestroyed);

/**
 * A vehicle's condition: hull, armour, and how bad it looks.
 *
 * Separate from UHealthComponent because a wagon is not a person. It can be
 * armoured, the armour itself wears out and shows it, and its condition drives
 * a visual state that swaps meshes and materials.
 *
 * Armour is a one-off purchase, not a levelled stat. Fitted plates take a share
 * of every hit instead of the hull, wear down as they do it, and keep helping a
 * little even once they are hanging off - which is both physically sensible and
 * the reason armour is worth buying early rather than hoarding for.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UVehicleHealthComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UVehicleHealthComponent();

	/** Called by the vehicle once it knows which catalogue row it is. */
	void ConfigureFromRow(float InMaxHealth);

	UFUNCTION(BlueprintPure, Category = "Vehicle") float GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") float GetMaxHealth() const { return MaxHealth; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") float GetFraction() const;
	UFUNCTION(BlueprintPure, Category = "Vehicle") bool IsDestroyed() const { return Health <= 0.f; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") EDamageState GetDamageState() const { return DamageState; }

	UFUNCTION(BlueprintPure, Category = "Vehicle") bool IsArmoured() const { return bArmoured; }
	UFUNCTION(BlueprintPure, Category = "Vehicle") float GetArmourIntegrity() const { return ArmourIntegrity; }

	/** Fits plates. Refused if they are already on. */
	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	bool FitArmour();

	/** Returns damage actually dealt to the hull, after armour. */
	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	float ApplyDamage(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	float Repair(float Amount);

	/** Restores a fraction of the maximum. Used by respawn rules and shops. */
	UFUNCTION(BlueprintCallable, Category = "Vehicle")
	void SetHealthFraction(float Fraction);

	/** What a full repair would cost at the current condition. */
	UFUNCTION(BlueprintPure, Category = "Vehicle")
	int32 GetFullRepairPrice() const;

	UPROPERTY(BlueprintAssignable, Category = "Vehicle") FOnVehicleHealthChanged OnHealthChanged;
	UPROPERTY(BlueprintAssignable, Category = "Vehicle") FOnDamageStateChanged OnDamageStateChanged;
	UPROPERTY(BlueprintAssignable, Category = "Vehicle") FOnVehicleDestroyed OnDestroyed;

private:
	void RefreshDamageState();

	UPROPERTY(Transient) float Health = 0.f;
	UPROPERTY(Transient) float MaxHealth = 0.f;
	UPROPERTY(Transient) bool bArmoured = false;

	/** Remaining plate hit points. */
	UPROPERTY(Transient) float ArmourIntegrity = 0.f;
	UPROPERTY(Transient) float ArmourCapacity = 0.f;

	UPROPERTY(Transient) EDamageState DamageState = EDamageState::Pristine;
	bool bDestroyedBroadcast = false;
};
