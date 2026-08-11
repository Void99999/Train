// Copyright LAST TRAIN. All rights reserved.

#include "Player/InteractionComponent.h"

#include "Camera/CameraComponent.h"
#include "Data/LastTrainBalance.h"
#include "GameFramework/Actor.h"
#include "LastTrain.h"
#include "Player/InteractableInterface.h"

/** Matches the "Interaction" entry in DefaultEngine.ini's collision channels. */
static constexpr ECollisionChannel InteractionChannel = ECC_GameTraceChannel1;

UInteractionComponent::UInteractionComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
}

bool UInteractionComponent::GetProbe(FVector& OutStart, FVector& OutDirection) const
{
	const AActor* Owner = GetOwner();
	if (!Owner)
	{
		return false;
	}

	// Prefer the camera: what the player is looking at is a property of the
	// view, not of where the pawn's feet are pointing.
	if (const UCameraComponent* Camera = Owner->FindComponentByClass<UCameraComponent>())
	{
		OutStart = Camera->GetComponentLocation();
		OutDirection = Camera->GetForwardVector();
		return true;
	}

	OutStart = Owner->GetActorLocation();
	OutDirection = Owner->GetActorForwardVector();
	return true;
}

void UInteractionComponent::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	SecondsSinceProbe += DeltaTime;
	if (SecondsSinceProbe < ProbeIntervalSeconds)
	{
		return;
	}
	SecondsSinceProbe = 0.f;

	FVector Start;
	FVector Direction;
	if (!GetProbe(Start, Direction))
	{
		SetFocus(nullptr, FText::GetEmpty());
		return;
	}

	const float Range = RangeOverride > 0.f
		? RangeOverride
		: ULastTrainBalance::Get().Movement.InteractionRange;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(LastTrainInteraction), /*bTraceComplex*/ false, GetOwner());
	Params.bReturnPhysicalMaterial = false;

	FHitResult Hit;
	const bool bHit = GetWorld()->LineTraceSingleByChannel(
		Hit, Start, Start + Direction * Range, InteractionChannel, Params);

	if (!bHit)
	{
		SetFocus(nullptr, FText::GetEmpty());
		return;
	}

	// The interface may sit on the component that was hit or on its actor. A
	// locomotive is one actor with several usable fittings, so the component is
	// checked first.
	UObject* Candidate = nullptr;
	if (Hit.GetComponent() && Hit.GetComponent()->Implements<UInteractable>())
	{
		Candidate = Hit.GetComponent();
	}
	else if (Hit.GetActor() && Hit.GetActor()->Implements<UInteractable>())
	{
		Candidate = Hit.GetActor();
	}

	if (!Candidate)
	{
		SetFocus(nullptr, FText::GetEmpty());
		return;
	}

	AActor* Interactor = GetOwner();
	if (!IInteractable::Execute_CanInteract(Candidate, Interactor))
	{
		// Still focused: a door that cannot be opened has something to say
		// about why, and saying it is better than silence.
		SetFocus(Candidate, IInteractable::Execute_GetInteractionPrompt(Candidate, Interactor));
		return;
	}

	SetFocus(Candidate, IInteractable::Execute_GetInteractionPrompt(Candidate, Interactor));
}

void UInteractionComponent::SetFocus(UObject* NewFocus, const FText& NewPrompt)
{
	const bool bSameObject = Focused.Get() == NewFocus;
	const bool bSamePrompt = Prompt.EqualTo(NewPrompt);
	if (bSameObject && bSamePrompt)
	{
		return;
	}

	Focused = NewFocus;
	Prompt = NewPrompt;
	OnFocusChanged.Broadcast(NewFocus, NewPrompt);
}

void UInteractionComponent::ClearFocus()
{
	SetFocus(nullptr, FText::GetEmpty());
}

bool UInteractionComponent::Activate()
{
	UObject* Target = Focused.Get();
	if (!Target)
	{
		return false;
	}

	AActor* Interactor = GetOwner();
	if (!IInteractable::Execute_CanInteract(Target, Interactor))
	{
		// Refused rather than ignored: the prompt already explains why, and the
		// caller can play a deny sound.
		return false;
	}

	IInteractable::Execute_Interact(Target, Interactor);
	return true;
}
