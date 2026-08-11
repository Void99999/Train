// Copyright LAST TRAIN. All rights reserved.

#include "Player/HealthComponent.h"

#include "Data/LastTrainBalance.h"

UHealthComponent::UHealthComponent()
{
	// Nothing to tick: health only changes when something changes it.
	PrimaryComponentTick.bCanEverTick = false;
}

void UHealthComponent::BeginPlay()
{
	Super::BeginPlay();

	if (MaxHealth <= 0.f)
	{
		MaxHealth = ULastTrainBalance::Get().PlayerMaxHealth;
	}
	Health = MaxHealth;
	bDeathBroadcast = false;
	Broadcast();
}

float UHealthComponent::GetFraction() const
{
	return MaxHealth > 0.f ? FMath::Clamp(Health / MaxHealth, 0.f, 1.f) : 0.f;
}

void UHealthComponent::SetMaxHealth(float NewMax, bool bRefill)
{
	MaxHealth = FMath::Max(1.f, NewMax);
	Health = bRefill ? MaxHealth : FMath::Min(Health, MaxHealth);
	bDeathBroadcast = Health <= 0.f && bDeathBroadcast;
	Broadcast();
}

float UHealthComponent::ApplyDamage(float Amount)
{
	if (Amount <= 0.f || !IsAlive())
	{
		return 0.f;
	}

	const float Before = Health;
	Health = FMath::Max(0.f, Health - Amount);
	Broadcast();

	// Guarded, because several things can land on the same frame and death
	// must be announced exactly once.
	if (Health <= 0.f && !bDeathBroadcast)
	{
		bDeathBroadcast = true;
		OnDied.Broadcast();
	}

	return Before - Health;
}

float UHealthComponent::Heal(float Amount)
{
	if (Amount <= 0.f || !IsAlive())
	{
		return 0.f;
	}

	const float Before = Health;
	Health = FMath::Min(MaxHealth, Health + Amount);
	Broadcast();
	return Health - Before;
}

void UHealthComponent::Kill()
{
	ApplyDamage(Health);
}

void UHealthComponent::Broadcast()
{
	OnHealthChanged.Broadcast(Health, MaxHealth);
}
