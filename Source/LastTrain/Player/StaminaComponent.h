// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "StaminaComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnStaminaChanged, float, Stamina, float, Max);

/**
 * The sprint budget.
 *
 * About eight seconds of running and six to refill, with a delay before the
 * refill starts, so sprinting is a decision rather than a default.
 *
 * The minimum-to-start threshold exists for feel, not for balance: without it a
 * player who taps sprint while empty gets one frame of speed per press, which
 * reads as the control being broken.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UStaminaComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UStaminaComponent();

	virtual void BeginPlay() override;

	/**
	 * Advances the budget and answers whether the actor is sprinting.
	 *
	 * Call once per frame with what the player is asking for. The component
	 * decides whether they get it, so no caller has to remember the rules.
	 */
	UFUNCTION(BlueprintCallable, Category = "Stamina")
	bool Update(float DeltaSeconds, bool bWantsToSprint, bool bIsMoving);

	UFUNCTION(BlueprintPure, Category = "Stamina") float GetStamina() const { return Stamina; }
	UFUNCTION(BlueprintPure, Category = "Stamina") float GetMax() const { return Max; }
	UFUNCTION(BlueprintPure, Category = "Stamina") float GetFraction() const;
	UFUNCTION(BlueprintPure, Category = "Stamina") bool IsSprinting() const { return bSprinting; }

	UFUNCTION(BlueprintCallable, Category = "Stamina")
	void Refill();

	UPROPERTY(BlueprintAssignable, Category = "Stamina") FOnStaminaChanged OnStaminaChanged;

private:
	UPROPERTY(Transient) float Stamina = 0.f;
	UPROPERTY(Transient) float Max = 0.f;
	UPROPERTY(Transient) float SecondsSinceSprint = 0.f;
	UPROPERTY(Transient) bool bSprinting = false;
};
