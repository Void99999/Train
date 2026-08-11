// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "Player/InteractableInterface.h"
#include "ThrottleControlComponent.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

/**
 * The quadrant in the cab: the thing the driver's hand actually moves.
 *
 * Separate from UThrottleComponent, which is the setting itself. One is a
 * control the player looks at and presses E on; the other is a number the train
 * reads. Keeping them apart means the throttle can be driven by a cutscene, by
 * a key rebind or by an AI without any of them having to find a mesh.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UThrottleControlComponent : public USceneComponent, public IInteractable
{
	GENERATED_BODY()

public:
	UThrottleControlComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

	virtual bool CanInteract_Implementation(AActor* Interactor) override;
	virtual FText GetInteractionPrompt_Implementation(AActor* Interactor) override;
	virtual void Interact_Implementation(AActor* Interactor) override;
	virtual FVector GetInteractionPoint_Implementation() override;

protected:
	/** Where the lever sits along the quadrant for each notch, in centimetres. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Throttle")
	float NotchSpacingCm = 26.f;

	/** Local X of the idle position; notches run forward from there. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Throttle")
	float IdleOffsetCm = -102.f;

	/** How fast the lever visually follows the selected notch. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Throttle", meta = (ClampMin = "0.01"))
	float LeverSlideSeconds = 0.25f;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Throttle")
	TObjectPtr<UBoxComponent> UseVolume;

	/** PLACEHOLDER blockout for the quadrant and the lever. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Throttle")
	TObjectPtr<UStaticMeshComponent> QuadrantMesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Throttle")
	TObjectPtr<USceneComponent> Lever;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Throttle")
	TObjectPtr<UStaticMeshComponent> LeverMesh;

private:
	float TargetLeverX() const;

	UPROPERTY(Transient)
	float LeverX = 0.f;
};
