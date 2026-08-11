// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ThrottleComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnThrottleChanged, int32, NotchIndex, float, Fraction);

/**
 * The driver's throttle: a stand and four notches.
 *
 * Deliberately a discrete control rather than an analogue one. Four settings a
 * player can name - a quarter, half, three quarters, full - make speed a
 * decision that can be discussed and remembered, and they give the cab a
 * quadrant with markings instead of a slider.
 *
 * The notch is what the driver asked for. What the train actually does about it
 * is ATrainActor's business, and the gap between the two - the seconds a heavy
 * consist takes to answer - is most of what makes the train feel heavy.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UThrottleComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UThrottleComponent();

	virtual void BeginPlay() override;

	/** 0 is a stand; 1 to 4 are the settings on the quadrant. */
	UFUNCTION(BlueprintPure, Category = "Throttle")
	int32 GetNotch() const { return Notch; }

	/** 0 to 1. What fraction of top speed the notch is asking for. */
	UFUNCTION(BlueprintPure, Category = "Throttle")
	float GetFraction() const;

	/** How many notches there are, including the stand. */
	UFUNCTION(BlueprintPure, Category = "Throttle")
	int32 GetNotchCount() const;

	UFUNCTION(BlueprintCallable, Category = "Throttle")
	bool SetNotch(int32 NewNotch);

	/** Up one. Refused at the top rather than wrapping. */
	UFUNCTION(BlueprintCallable, Category = "Throttle")
	bool NotchUp();

	UFUNCTION(BlueprintCallable, Category = "Throttle")
	bool NotchDown();

	/**
	 * Steps up, and wraps back to a stand past the last notch.
	 *
	 * This is what the E key on the quadrant does: one control, the whole
	 * range, no modifier keys. Notching up and down separately is available to
	 * a rebind and to a gamepad.
	 */
	UFUNCTION(BlueprintCallable, Category = "Throttle")
	int32 Cycle();

	UPROPERTY(BlueprintAssignable, Category = "Throttle")
	FOnThrottleChanged OnThrottleChanged;

private:
	UPROPERTY(Transient)
	int32 Notch = 0;
};
