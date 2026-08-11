// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "WalletComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnMoneyChanged, int32, Balance, int32, Delta);

/**
 * Money.
 *
 * One currency, earned by trading and by salvage, spent on everything. It keeps
 * a running total of what has been earned as well as what is held, because the
 * end-of-run summary wants "money earned" and that is not recoverable from a
 * balance that has been spent.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UWalletComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UWalletComponent();

	virtual void BeginPlay() override;

	UFUNCTION(BlueprintPure, Category = "Economy") int32 GetBalance() const { return Balance; }
	UFUNCTION(BlueprintPure, Category = "Economy") int32 GetTotalEarned() const { return TotalEarned; }
	UFUNCTION(BlueprintPure, Category = "Economy") bool CanAfford(int32 Amount) const { return Balance >= Amount; }

	UFUNCTION(BlueprintCallable, Category = "Economy")
	void Credit(int32 Amount);

	/** Refused outright rather than going negative. Returns whether it went through. */
	UFUNCTION(BlueprintCallable, Category = "Economy")
	bool Debit(int32 Amount);

	/** Loses a share of the balance. Used by the death rules. */
	UFUNCTION(BlueprintCallable, Category = "Economy")
	int32 LoseFraction(float Fraction);

	UPROPERTY(BlueprintAssignable, Category = "Economy") FOnMoneyChanged OnMoneyChanged;

private:
	UPROPERTY(Transient) int32 Balance = 0;
	UPROPERTY(Transient) int32 TotalEarned = 0;
};
