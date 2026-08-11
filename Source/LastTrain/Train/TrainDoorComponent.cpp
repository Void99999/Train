// Copyright LAST TRAIN. All rights reserved.

#include "Train/TrainDoorComponent.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "LastTrain.h"
#include "Train/TrainActor.h"
#include "Train/TrainVehicle.h"

#define LOCTEXT_NAMESPACE "LastTrainDoor"

UTrainDoorComponent::UTrainDoorComponent()
{
	PrimaryComponentTick.bCanEverTick = true;

	Leaf = CreateDefaultSubobject<USceneComponent>(TEXT("Leaf"));
	Leaf->SetupAttachment(this);

	LeafMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("LeafMesh"));
	LeafMesh->SetupAttachment(Leaf);
	LeafMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	LeafMesh->SetMobility(EComponentMobility::Movable);

	// What the interaction probe hits. It stays put while the leaf slides, so
	// the player can shut a door they have just walked out through.
	UseVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("UseVolume"));
	UseVolume->SetupAttachment(this);
	UseVolume->SetCollisionProfileName(TEXT("Interactable"));
	UseVolume->SetBoxExtent(FVector(12.f, 46.f, 100.f));

	Blocker = CreateDefaultSubobject<UBoxComponent>(TEXT("Blocker"));
	Blocker->SetupAttachment(this);
	Blocker->SetCollisionProfileName(TEXT("TrainVehicle"));
	Blocker->SetBoxExtent(FVector(8.f, 46.f, 100.f));
	Blocker->SetMobility(EComponentMobility::Movable);
}

void UTrainDoorComponent::BeginPlay()
{
	Super::BeginPlay();

	if (LeafMesh && !LeafMesh->GetStaticMesh())
	{
		// PLACEHOLDER. An engine cube standing in for a steel sliding door.
		if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")))
		{
			LeafMesh->SetStaticMesh(Cube);
			LeafMesh->SetRelativeScale3D(FVector(0.07f, 0.92f, 2.0f));
		}
	}

	ApplyOpenness();
}

void UTrainDoorComponent::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (FMath::IsNearlyEqual(Openness, Target))
	{
		return;
	}

	const float Step = DeltaTime / FMath::Max(0.05f, SlideSeconds);
	Openness = FMath::FInterpConstantTo(Openness, Target, 1.f, Step);
	ApplyOpenness();
}

void UTrainDoorComponent::ApplyOpenness()
{
	if (Leaf)
	{
		Leaf->SetRelativeLocation(SlideDirection.GetSafeNormal() * (TravelCm * Openness));
	}

	if (Blocker)
	{
		// Solid only while very nearly shut. Anything looser and the player can
		// be caught between a moving leaf and the frame.
		Blocker->SetCollisionEnabled(Openness < 0.1f
			? ECollisionEnabled::QueryAndPhysics
			: ECollisionEnabled::NoCollision);
	}
}

void UTrainDoorComponent::SetOpen(bool bOpen)
{
	const float NewTarget = bOpen ? 1.f : 0.f;
	if (FMath::IsNearlyEqual(Target, NewTarget))
	{
		return;
	}
	Target = NewTarget;
	OnDoorStateChanged.Broadcast(bOpen);
}

bool UTrainDoorComponent::HasSomethingBehind() const
{
	const ATrainActor* Train = ATrainActor::Find(this);
	return Train && Train->GetWagonCount() > 0;
}

/* ------------------------------------------------------------ interaction */

bool UTrainDoorComponent::CanInteract_Implementation(AActor* Interactor)
{
	if (Role == EDoorRole::Rear && !HasSomethingBehind())
	{
		return false;
	}
	// Side doors work at any speed. That is deliberate: the walkway is meant to
	// be used while the train is running.
	return true;
}

FText UTrainDoorComponent::GetInteractionPrompt_Implementation(AActor* Interactor)
{
	if (Role == EDoorRole::Rear && !HasSomethingBehind())
	{
		return LOCTEXT("NoWagonConnected", "No wagon connected.");
	}

	return Target > 0.5f
		? LOCTEXT("CloseDoor", "Close door")
		: LOCTEXT("OpenDoor", "Open door");
}

void UTrainDoorComponent::Interact_Implementation(AActor* Interactor)
{
	Toggle();
}

FVector UTrainDoorComponent::GetInteractionPoint_Implementation()
{
	return UseVolume ? UseVolume->GetComponentLocation() : GetComponentLocation();
}

#undef LOCTEXT_NAMESPACE
