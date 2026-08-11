// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "Player/InteractableInterface.h"
#include "TrainDoorComponent.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDoorStateChanged, bool, bOpen);

/** What a door leads to, which decides when it may be used. */
UENUM(BlueprintType)
enum class EDoorRole : uint8
{
	/**
	 * A cab side door onto the exterior walkway. Always usable, at any speed -
	 * stepping out onto the running board of a moving train is the point.
	 */
	Side		UMETA(DisplayName = "Side Door"),

	/**
	 * The connection into the rest of the train. Only opens onto something:
	 * with nothing coupled behind, it reports that rather than opening onto a
	 * hundred kilometres of nothing.
	 */
	Rear		UMETA(DisplayName = "Rear Connection")
};

/**
 * A door on a vehicle.
 *
 * A component rather than an actor, because a locomotive is one thing with
 * several doors on it and each has to answer for itself when the player looks
 * at it. The interaction system finds the component, not the actor, which is
 * what lets the left door and the right door say different things.
 *
 * The leaf slides rather than swinging. A door hinged inward would sweep
 * through the driver's seat; one hinged outward would foul the walkway railing.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UTrainDoorComponent : public USceneComponent, public IInteractable
{
	GENERATED_BODY()

public:
	UTrainDoorComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

	/* --------------------------------------------------------- IInteractable */

	virtual bool CanInteract_Implementation(AActor* Interactor) override;
	virtual FText GetInteractionPrompt_Implementation(AActor* Interactor) override;
	virtual void Interact_Implementation(AActor* Interactor) override;
	virtual FVector GetInteractionPoint_Implementation() override;

	/* ----------------------------------------------------------------- door */

	UFUNCTION(BlueprintPure, Category = "Door") bool IsOpen() const { return Openness > 0.99f; }
	UFUNCTION(BlueprintPure, Category = "Door") bool IsMoving() const { return !FMath::IsNearlyEqual(Openness, Target); }
	UFUNCTION(BlueprintPure, Category = "Door") float GetOpenness() const { return Openness; }

	UFUNCTION(BlueprintCallable, Category = "Door")
	void SetOpen(bool bOpen);

	UFUNCTION(BlueprintCallable, Category = "Door")
	void Toggle() { SetOpen(Target < 0.5f); }

	UPROPERTY(BlueprintAssignable, Category = "Door") FOnDoorStateChanged OnDoorStateChanged;

protected:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door")
	EDoorRole Role = EDoorRole::Side;

	/** How far the leaf slides, in centimetres. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door", meta = (ClampMin = "1.0"))
	float TravelCm = 102.f;

	/** Seconds for a full open or close. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door", meta = (ClampMin = "0.05"))
	float SlideSeconds = 0.65f;

	/** The direction the leaf slides, in the component's local space. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Door")
	FVector SlideDirection = FVector(-1.f, 0.f, 0.f);

	/** The moving leaf. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<USceneComponent> Leaf;

	/** PLACEHOLDER blockout for the leaf, replaced by a real mesh later. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<UStaticMeshComponent> LeafMesh;

	/** What the interaction probe hits. Sized to the doorway, not the leaf. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<UBoxComponent> UseVolume;

	/** Blocks the doorway while shut. Disabled as soon as the leaf starts moving. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Door")
	TObjectPtr<UBoxComponent> Blocker;

private:
	/** Whether there is anything on the other side of a rear connection. */
	bool HasSomethingBehind() const;

	void ApplyOpenness();

	UPROPERTY(Transient) float Openness = 0.f;
	UPROPERTY(Transient) float Target = 0.f;
};
