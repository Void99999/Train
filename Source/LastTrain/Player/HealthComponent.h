// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealthChanged, float, NewHealth, float, MaxHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDied);

/**
 * Hit points for anything that can be killed: the player, enemies, the Loader.
 *
 * Vehicles use UVehicleHealthComponent instead - they have armour integrity and
 * a damage state on top of this, and folding both into one component would mean
 * every soldier carrying fields about armour plating.
 *
 * There is no passive regeneration anywhere in LAST TRAIN. Healing is a
 * resource you buy or carry, which is what makes a medkit worth a cargo slot.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UHealthComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UHealthComponent();

	virtual void BeginPlay() override;

	UFUNCTION(BlueprintPure, Category = "Health") float GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "Health") float GetMaxHealth() const { return MaxHealth; }
	UFUNCTION(BlueprintPure, Category = "Health") float GetFraction() const;
	UFUNCTION(BlueprintPure, Category = "Health") bool IsAlive() const { return Health > 0.f; }

	/** Sets the ceiling, and optionally refills to it. */
	UFUNCTION(BlueprintCallable, Category = "Health")
	void SetMaxHealth(float NewMax, bool bRefill = true);

	/** Returns how much damage was actually taken. */
	UFUNCTION(BlueprintCallable, Category = "Health")
	float ApplyDamage(float Amount);

	/** Returns how much was actually restored. */
	UFUNCTION(BlueprintCallable, Category = "Health")
	float Heal(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Health")
	void Kill();

	UPROPERTY(BlueprintAssignable, Category = "Health") FOnHealthChanged OnHealthChanged;
	UPROPERTY(BlueprintAssignable, Category = "Health") FOnDied OnDied;

protected:
	/** Left at zero to take the value from the balance settings on BeginPlay. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Health", meta = (ClampMin = "0.0"))
	float MaxHealth = 0.f;

private:
	void Broadcast();

	UPROPERTY(Transient)
	float Health = 0.f;

	bool bDeathBroadcast = false;
};
