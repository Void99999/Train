// Copyright LAST TRAIN. All rights reserved.

#include "Player/StaminaComponent.h"

#include "Data/LastTrainBalance.h"

UStaminaComponent::UStaminaComponent()
{
	// Driven from the character's tick, so the order against movement is known.
	PrimaryComponentTick.bCanEverTick = false;
}

void UStaminaComponent::BeginPlay()
{
	Super::BeginPlay();

	Max = ULastTrainBalance::Get().Stamina.Max;
	Stamina = Max;
	SecondsSinceSprint = ULastTrainBalance::Get().Stamina.RegenDelaySeconds;
	OnStaminaChanged.Broadcast(Stamina, Max);
}

float UStaminaComponent::GetFraction() const
{
	return Max > 0.f ? FMath::Clamp(Stamina / Max, 0.f, 1.f) : 0.f;
}

void UStaminaComponent::Refill()
{
	Stamina = Max;
	OnStaminaChanged.Broadcast(Stamina, Max);
}

bool UStaminaComponent::Update(float DeltaSeconds, bool bWantsToSprint, bool bIsMoving)
{
	const FStaminaBalance& Rules = ULastTrainBalance::Get().Stamina;
	const float Before = Stamina;

	// Sprinting has to be earned to start but only maintained to continue: a
	// runner who dips below the threshold mid-stride keeps going until empty.
	const bool bMayStart = Stamina >= Rules.MinimumToStartSprinting;
	const bool bMayContinue = Stamina > 0.f;
	const bool bSprintingNow = bWantsToSprint && bIsMoving && (bSprinting ? bMayContinue : bMayStart);

	if (bSprintingNow)
	{
		Stamina = FMath::Max(0.f, Stamina - Rules.DrainPerSecond * DeltaSeconds);
		SecondsSinceSprint = 0.f;
	}
	else
	{
		SecondsSinceSprint += DeltaSeconds;
		if (SecondsSinceSprint >= Rules.RegenDelaySeconds)
		{
			Stamina = FMath::Min(Max, Stamina + Rules.RegenPerSecond * DeltaSeconds);
		}
	}

	bSprinting = bSprintingNow;

	if (!FMath::IsNearlyEqual(Before, Stamina))
	{
		OnStaminaChanged.Broadcast(Stamina, Max);
	}
	return bSprinting;
}
