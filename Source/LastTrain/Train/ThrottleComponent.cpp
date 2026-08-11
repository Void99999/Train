// Copyright LAST TRAIN. All rights reserved.

#include "Train/ThrottleComponent.h"

#include "Data/LastTrainBalance.h"

UThrottleComponent::UThrottleComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UThrottleComponent::BeginPlay()
{
	Super::BeginPlay();

	Notch = FMath::Clamp(ULastTrainBalance::Get().DefaultThrottleIndex, 0, GetNotchCount() - 1);
	OnThrottleChanged.Broadcast(Notch, GetFraction());
}

int32 UThrottleComponent::GetNotchCount() const
{
	return FMath::Max(1, ULastTrainBalance::Get().ThrottleSteps.Num());
}

float UThrottleComponent::GetFraction() const
{
	const TArray<float>& Steps = ULastTrainBalance::Get().ThrottleSteps;
	return Steps.IsValidIndex(Notch) ? Steps[Notch] : 0.f;
}

bool UThrottleComponent::SetNotch(int32 NewNotch)
{
	const int32 Clamped = FMath::Clamp(NewNotch, 0, GetNotchCount() - 1);
	if (Clamped == Notch)
	{
		return false;
	}

	Notch = Clamped;
	OnThrottleChanged.Broadcast(Notch, GetFraction());
	return true;
}

bool UThrottleComponent::NotchUp()
{
	return SetNotch(Notch + 1);
}

bool UThrottleComponent::NotchDown()
{
	return SetNotch(Notch - 1);
}

int32 UThrottleComponent::Cycle()
{
	const int32 Next = Notch >= GetNotchCount() - 1 ? 0 : Notch + 1;
	SetNotch(Next);
	return Notch;
}
