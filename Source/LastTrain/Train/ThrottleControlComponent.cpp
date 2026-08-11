// Copyright LAST TRAIN. All rights reserved.

#include "Train/ThrottleControlComponent.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Train/ThrottleComponent.h"
#include "Train/TrainActor.h"

#define LOCTEXT_NAMESPACE "LastTrainThrottle"

UThrottleControlComponent::UThrottleControlComponent()
{
	PrimaryComponentTick.bCanEverTick = true;

	UseVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("UseVolume"));
	UseVolume->SetupAttachment(this);
	UseVolume->SetCollisionProfileName(TEXT("Interactable"));
	// Sized to the quadrant, not to the room. A volume the size of the cab is
	// how a prompt ends up appearing when the player is looking at the floor.
	UseVolume->SetBoxExtent(FVector(70.f, 20.f, 22.f));

	QuadrantMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("QuadrantMesh"));
	QuadrantMesh->SetupAttachment(this);
	QuadrantMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	QuadrantMesh->SetMobility(EComponentMobility::Movable);

	Lever = CreateDefaultSubobject<USceneComponent>(TEXT("Lever"));
	Lever->SetupAttachment(this);

	LeverMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("LeverMesh"));
	LeverMesh->SetupAttachment(Lever);
	LeverMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	LeverMesh->SetMobility(EComponentMobility::Movable);
}

void UThrottleControlComponent::BeginPlay()
{
	Super::BeginPlay();

	// PLACEHOLDER geometry: a plate and a stick. The modelled quadrant has
	// machined detents and stencilled 25/50/75/100 markings.
	if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")))
	{
		if (QuadrantMesh && !QuadrantMesh->GetStaticMesh())
		{
			QuadrantMesh->SetStaticMesh(Cube);
			QuadrantMesh->SetRelativeScale3D(FVector(1.5f, 0.34f, 0.1f));
		}
		if (LeverMesh && !LeverMesh->GetStaticMesh())
		{
			LeverMesh->SetStaticMesh(Cube);
			LeverMesh->SetRelativeScale3D(FVector(0.06f, 0.06f, 0.3f));
			LeverMesh->SetRelativeLocation(FVector(0.f, 0.f, 15.f));
		}
	}

	LeverX = TargetLeverX();
	if (Lever)
	{
		Lever->SetRelativeLocation(FVector(LeverX, 0.f, 0.f));
	}
}

float UThrottleControlComponent::TargetLeverX() const
{
	const ATrainActor* Train = ATrainActor::Find(this);
	const UThrottleComponent* Throttle = Train ? Train->GetThrottle() : nullptr;
	const int32 Notch = Throttle ? Throttle->GetNotch() : 0;

	// Notch 0 sits behind the first setting, so the quadrant reads as a control
	// with a stand rather than a switch with four positions.
	return IdleOffsetCm + static_cast<float>(Notch) * NotchSpacingCm;
}

void UThrottleControlComponent::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	const float Target = TargetLeverX();
	if (FMath::IsNearlyEqual(LeverX, Target, 0.1f))
	{
		return;
	}

	const float Speed = NotchSpacingCm / FMath::Max(0.01f, LeverSlideSeconds);
	LeverX = FMath::FInterpConstantTo(LeverX, Target, DeltaTime, Speed);

	if (Lever)
	{
		Lever->SetRelativeLocation(FVector(LeverX, 0.f, 0.f));
	}
}

bool UThrottleControlComponent::CanInteract_Implementation(AActor* Interactor)
{
	return ATrainActor::Find(this) != nullptr;
}

FText UThrottleControlComponent::GetInteractionPrompt_Implementation(AActor* Interactor)
{
	return LOCTEXT("TakeTheControls", "Take the controls");
}

void UThrottleControlComponent::Interact_Implementation(AActor* Interactor)
{
	ATrainActor* Train = ATrainActor::Find(this);
	if (UThrottleComponent* Throttle = Train ? Train->GetThrottle() : nullptr)
	{
		// One key, the whole range: up through the notches and back to a stand.
		Throttle->Cycle();
	}
}

FVector UThrottleControlComponent::GetInteractionPoint_Implementation()
{
	return UseVolume ? UseVolume->GetComponentLocation() : GetComponentLocation();
}

#undef LOCTEXT_NAMESPACE
