// Copyright LAST TRAIN. All rights reserved.

#include "Economy/WalletComponent.h"

#include "Data/LastTrainBalance.h"

UWalletComponent::UWalletComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UWalletComponent::BeginPlay()
{
	Super::BeginPlay();

	Balance = ULastTrainBalance::Get().StartingMoney;
	// Starting money is not earnings. Counting it would flatter every run
	// summary by the same amount.
	TotalEarned = 0;
	OnMoneyChanged.Broadcast(Balance, Balance);
}

void UWalletComponent::Credit(int32 Amount)
{
	if (Amount <= 0)
	{
		return;
	}
	Balance += Amount;
	TotalEarned += Amount;
	OnMoneyChanged.Broadcast(Balance, Amount);
}

bool UWalletComponent::Debit(int32 Amount)
{
	if (Amount <= 0 || Balance < Amount)
	{
		return false;
	}
	Balance -= Amount;
	OnMoneyChanged.Broadcast(Balance, -Amount);
	return true;
}

int32 UWalletComponent::LoseFraction(float Fraction)
{
	if (Fraction <= 0.f || Balance <= 0)
	{
		return 0;
	}

	const int32 Lost = FMath::Min(Balance, FMath::CeilToInt(Balance * FMath::Min(1.f, Fraction)));
	Balance -= Lost;
	OnMoneyChanged.Broadcast(Balance, -Lost);
	return Lost;
}
