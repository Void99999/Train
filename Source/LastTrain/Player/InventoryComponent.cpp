// Copyright LAST TRAIN. All rights reserved.

#include "Player/InventoryComponent.h"

#include "Data/LastTrainBalance.h"
#include "Data/LastTrainDataRegistry.h"
#include "LastTrain.h"
#include "Player/HealthComponent.h"

UInventoryComponent::UInventoryComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	StartingWeapons = { TEXT("pistol") };
}

void UInventoryComponent::BeginPlay()
{
	Super::BeginPlay();

	for (const FName& WeaponId : StartingWeapons)
	{
		AcquireWeapon(WeaponId);
	}
}

bool UInventoryComponent::AcquireWeapon(FName WeaponId)
{
	if (WeaponId.IsNone() || OwnedWeapons.Contains(WeaponId))
	{
		return false;
	}

	// Refuse anything that is not in the catalogue rather than carrying a name
	// that will fail to resolve later, somewhere less obvious.
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (Registry && !Registry->FindWeapon(WeaponId))
	{
		UE_LOG(LogLastTrainPlayer, Warning, TEXT("Refused unknown weapon '%s'."), *WeaponId.ToString());
		return false;
	}

	OwnedWeapons.Add(WeaponId);
	OnWeaponAcquired.Broadcast(WeaponId);

	if (EquippedWeapon.IsNone())
	{
		EquipWeapon(WeaponId);
	}
	return true;
}

bool UInventoryComponent::EquipWeapon(FName WeaponId)
{
	if (!OwnedWeapons.Contains(WeaponId) || EquippedWeapon == WeaponId)
	{
		return false;
	}

	EquippedWeapon = WeaponId;
	OnEquippedWeaponChanged.Broadcast(EquippedWeapon);
	return true;
}

bool UInventoryComponent::AddMedkit(int32 Count)
{
	const int32 MaxCarried = ULastTrainBalance::Get().MedkitMaxCarried;
	if (Count <= 0 || Medkits >= MaxCarried)
	{
		return false;
	}
	Medkits = FMath::Min(MaxCarried, Medkits + Count);
	return true;
}

bool UInventoryComponent::UseMedkit()
{
	if (Medkits <= 0)
	{
		return false;
	}

	UHealthComponent* Health = GetOwner() ? GetOwner()->FindComponentByClass<UHealthComponent>() : nullptr;
	if (!Health || Health->GetHealth() >= Health->GetMaxHealth())
	{
		// Not spent on a full bar. A wasted medkit is a hundred kilometres of
		// regret and the player did not ask for it.
		return false;
	}

	Health->Heal(ULastTrainBalance::Get().MedkitHealAmount);
	--Medkits;
	return true;
}
