// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "InteractionComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnFocusChanged, UObject*, Focused, const FText&, Prompt);

/**
 * Finds the one thing the player is looking at and can use.
 *
 * Gaze, not proximity. Standing next to a console is not the same as looking at
 * it, and a prompt that appears because you are near something is worse than no
 * prompt at all - the browser prototype shipped that bug and it made a cab full
 * of controls unusable.
 *
 * The probe is a line trace on the Interaction channel, which only things that
 * advertise themselves as usable respond to. That is cheaper and far more
 * predictable than tracing against Visibility and filtering afterwards, because
 * a handrail cannot get in the way of the throttle behind it.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UInteractionComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UInteractionComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

	/** The focused object, or null. */
	UFUNCTION(BlueprintPure, Category = "Interaction")
	UObject* GetFocused() const { return Focused.Get(); }

	UFUNCTION(BlueprintPure, Category = "Interaction")
	FText GetPrompt() const { return Prompt; }

	/** Uses whatever is focused. Returns false when there is nothing to use. */
	UFUNCTION(BlueprintCallable, Category = "Interaction")
	bool Activate();

	/** Drops focus, for when a menu opens or a cutscene takes over. */
	UFUNCTION(BlueprintCallable, Category = "Interaction")
	void ClearFocus();

	UPROPERTY(BlueprintAssignable, Category = "Interaction")
	FOnFocusChanged OnFocusChanged;

protected:
	/** Left at zero to take the range from the balance settings. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Interaction", meta = (ClampMin = "0.0"))
	float RangeOverride = 0.f;

	/** How often the probe runs. Sixty times a second is wasted on a prompt. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Interaction", meta = (ClampMin = "0.0"))
	float ProbeIntervalSeconds = 0.05f;

private:
	/** The eye the probe starts from: the camera when there is one. */
	bool GetProbe(FVector& OutStart, FVector& OutDirection) const;

	void SetFocus(UObject* NewFocus, const FText& NewPrompt);

	UPROPERTY(Transient)
	TWeakObjectPtr<UObject> Focused;

	UPROPERTY(Transient)
	FText Prompt;

	float SecondsSinceProbe = 0.f;
};
