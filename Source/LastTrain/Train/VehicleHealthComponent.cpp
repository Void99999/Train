// Copyright LAST TRAIN. All rights reserved.

#include "Train/VehicleHealthComponent.h"

#include "Data/LastTrainBalance.h"

UVehicleHealthComponent::UVehicleHealthComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UVehicleHealthComponent::ConfigureFromRow(float InMaxHealth)
{
	MaxHealth = FMath::Max(1.f, InMaxHealth);
	Health = MaxHealth;
	ArmourCapacity = MaxHealth * ULastTrainBalance::Get().ArmourCapacityFactor;
	bDestroyedBroadcast = false;

	RefreshDamageState();
	OnHealthChanged.Broadcast(Health, MaxHealth);
}

float UVehicleHealthComponent::GetFraction() const
{
	return MaxHealth > 0.f ? FMath::Clamp(Health / MaxHealth, 0.f, 1.f) : 0.f;
}

bool UVehicleHealthComponent::FitArmour()
{
	if (bArmoured)
	{
		return false;
	}
	bArmoured = true;
	ArmourIntegrity = ArmourCapacity;
	return true;
}

float UVehicleHealthComponent::ApplyDamage(float Amount)
{
	if (Amount <= 0.f || IsDestroyed())
	{
		return 0.f;
	}

	const ULastTrainBalance& Balance = ULastTrainBalance::Get();
	float ToHull = Amount;

	if (bArmoured)
	{
		// Plates wear before they stop protecting. How much they still help is
		// scaled by what is left of them, down to a floor - bare, buckled
		// plating is not nothing.
		const float Wholeness = ArmourCapacity > 0.f
			? FMath::Clamp(ArmourIntegrity / ArmourCapacity, 0.f, 1.f)
			: 0.f;

		const float Effectiveness = FMath::Lerp(Balance.ArmourStrippedEffectiveness, 1.f, Wholeness);
		const float Reduction = Balance.ArmourDamageReduction * Effectiveness;

		ToHull = Amount * (1.f - Reduction);

		// A share of the incoming damage is written off against the plates.
		const float ToArmour = Amount * Balance.ArmourWearFactor;
		ArmourIntegrity = FMath::Max(0.f, ArmourIntegrity - ToArmour);
	}

	const float Before = Health;
	Health = FMath::Max(0.f, Health - ToHull);

	RefreshDamageState();
	OnHealthChanged.Broadcast(Health, MaxHealth);

	if (Health <= 0.f && !bDestroyedBroadcast)
	{
		bDestroyedBroadcast = true;
		OnDestroyed.Broadcast();
	}

	return Before - Health;
}

float UVehicleHealthComponent::Repair(float Amount)
{
	if (Amount <= 0.f)
	{
		return 0.f;
	}

	const float Before = Health;
	Health = FMath::Clamp(Health + Amount, 0.f, MaxHealth);

	if (Health > 0.f)
	{
		bDestroyedBroadcast = false;
	}

	RefreshDamageState();
	OnHealthChanged.Broadcast(Health, MaxHealth);
	return Health - Before;
}

void UVehicleHealthComponent::SetHealthFraction(float Fraction)
{
	Health = FMath::Clamp(Fraction, 0.f, 1.f) * MaxHealth;
	bDestroyedBroadcast = Health <= 0.f && bDestroyedBroadcast;
	RefreshDamageState();
	OnHealthChanged.Broadcast(Health, MaxHealth);
}

int32 UVehicleHealthComponent::GetFullRepairPrice() const
{
	const float Missing = MaxHealth - Health;
	if (Missing <= 0.f)
	{
		return 0;
	}
	return FMath::CeilToInt(Missing / ULastTrainBalance::Get().HealthPointsPerCurrencyUnit);
}

void UVehicleHealthComponent::RefreshDamageState()
{
	const EDamageState NewState = ULastTrainBalance::Get().DamageStateFor(GetFraction());
	if (NewState != DamageState)
	{
		DamageState = NewState;
		OnDamageStateChanged.Broadcast(DamageState);
	}
}
