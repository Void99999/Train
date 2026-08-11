// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "InteractableInterface.generated.h"

UINTERFACE(BlueprintType, MinimalAPI)
class UInteractable : public UInterface
{
	GENERATED_BODY()
};

/**
 * Anything the player can press E on.
 *
 * Implemented by actors and by components alike - a locomotive is one actor
 * with a throttle, a blueprint board and two doors on it, and each of those
 * answers for itself.
 *
 * The two questions are deliberately separate. CanInteract decides whether the
 * prompt appears at all; GetInteractionPrompt decides what it says. That is
 * what lets the rear door show "No wagon connected." rather than either
 * offering an action that does nothing or vanishing with no explanation.
 */
class LASTTRAIN_API IInteractable
{
	GENERATED_BODY()

public:
	/*
	 * These are deliberately not const.
	 *
	 * Unreal Header Tool is fussy about const BlueprintNativeEvents, and none
	 * of these three needs to be const to be correct - a door being asked what
	 * its prompt says is entitled to notice it was asked.
	 */

	/** Whether this can be used right now, by this actor. */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Interaction")
	bool CanInteract(AActor* Interactor);
	virtual bool CanInteract_Implementation(AActor* Interactor) { return true; }

	/** What the prompt reads. Already localized. */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Interaction")
	FText GetInteractionPrompt(AActor* Interactor);
	virtual FText GetInteractionPrompt_Implementation(AActor* Interactor) { return FText::GetEmpty(); }

	/** Do the thing. Only called when CanInteract returned true. */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Interaction")
	void Interact(AActor* Interactor);
	virtual void Interact_Implementation(AActor* Interactor) {}

	/**
	 * Where the prompt and the aim check are measured from, in world space.
	 *
	 * Defaults to the component's own location. A door overrides it to the
	 * handle rather than the centre of the leaf, so looking at the handle is
	 * what offers the door.
	 */
	UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Interaction")
	FVector GetInteractionPoint();
	virtual FVector GetInteractionPoint_Implementation() { return FVector::ZeroVector; }
};
