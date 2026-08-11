// Copyright LAST TRAIN. All rights reserved.

#include "UI/LastTrainHudWidget.h"

#include "Data/LastTrainDataRegistry.h"
#include "Economy/WalletComponent.h"
#include "GameFramework/PlayerController.h"
#include "Player/HealthComponent.h"
#include "Player/InteractionComponent.h"
#include "Player/InventoryComponent.h"
#include "Player/LastTrainCharacter.h"
#include "Player/StaminaComponent.h"
#include "Train/ThrottleComponent.h"
#include "Train/TrainActor.h"
#include "Weapons/WeaponComponent.h"

void ULastTrainHudWidget::NativeConstruct()
{
	Super::NativeConstruct();

	if (const ALastTrainCharacter* Character = GetCharacter())
	{
		if (UInteractionComponent* Interaction = Character->GetInteractionComponent())
		{
			Interaction->OnFocusChanged.AddDynamic(this, &ULastTrainHudWidget::HandleFocusChanged);
		}
	}
}

void ULastTrainHudWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);
}

ALastTrainCharacter* ULastTrainHudWidget::GetCharacter() const
{
	const APlayerController* PC = GetOwningPlayer();
	return PC ? Cast<ALastTrainCharacter>(PC->GetPawn()) : nullptr;
}

ATrainActor* ULastTrainHudWidget::GetTrain() const
{
	return ATrainActor::Find(this);
}

void ULastTrainHudWidget::HandleFocusChanged(UObject* Focused, const FText& NewPrompt)
{
	OnInteractionPromptChanged(NewPrompt);
}

/* ------------------------------------------------------------- readouts */

float ULastTrainHudWidget::GetHealthFraction() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UHealthComponent* Health = Character ? Character->GetHealthComponent() : nullptr;
	return Health ? Health->GetFraction() : 0.f;
}

float ULastTrainHudWidget::GetStaminaFraction() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UStaminaComponent* Stamina = Character ? Character->GetStaminaComponent() : nullptr;
	return Stamina ? Stamina->GetFraction() : 0.f;
}

int32 ULastTrainHudWidget::GetMoney() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UWalletComponent* Wallet = Character ? Character->FindComponentByClass<UWalletComponent>() : nullptr;
	return Wallet ? Wallet->GetBalance() : 0;
}

float ULastTrainHudWidget::GetSpeedKmh() const
{
	const ATrainActor* Train = GetTrain();
	return Train ? Train->GetSpeedKmh() : 0.f;
}

int32 ULastTrainHudWidget::GetThrottleNotch() const
{
	const ATrainActor* Train = GetTrain();
	const UThrottleComponent* Throttle = Train ? Train->GetThrottle() : nullptr;
	return Throttle ? Throttle->GetNotch() : 0;
}

int32 ULastTrainHudWidget::GetThrottleNotchCount() const
{
	const ATrainActor* Train = GetTrain();
	const UThrottleComponent* Throttle = Train ? Train->GetThrottle() : nullptr;
	return Throttle ? Throttle->GetNotchCount() : 0;
}

float ULastTrainHudWidget::GetDistanceTravelledKm() const
{
	const ATrainActor* Train = GetTrain();
	return Train ? Train->GetDistanceTravelledKm() : 0.f;
}

int32 ULastTrainHudWidget::GetRoundsInMagazine() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UWeaponComponent* Weapon = Character ? Character->GetWeaponComponent() : nullptr;
	return Weapon ? Weapon->GetRoundsInMagazine() : 0;
}

int32 ULastTrainHudWidget::GetReserveRounds() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UWeaponComponent* Weapon = Character ? Character->GetWeaponComponent() : nullptr;
	return Weapon ? Weapon->GetReserveRounds() : 0;
}

FText ULastTrainHudWidget::GetEquippedWeaponName() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UInventoryComponent* Inventory = Character ? Character->GetInventoryComponent() : nullptr;
	if (!Inventory)
	{
		return FText::GetEmpty();
	}

	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	const FWeaponRow* Row = Registry ? Registry->FindWeapon(Inventory->GetEquippedWeapon()) : nullptr;
	if (!Row)
	{
		return FText::GetEmpty();
	}

	// The row carries a localization key rather than a display string, so a
	// weapon's name is translated in one place.
	return FText::FromStringTable(TEXT("/Game/LastTrain/Localization/ST_Game.ST_Game"), Row->NameKey);
}

FText ULastTrainHudWidget::GetInteractionPrompt() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	const UInteractionComponent* Interaction = Character ? Character->GetInteractionComponent() : nullptr;
	return Interaction ? Interaction->GetPrompt() : FText::GetEmpty();
}

bool ULastTrainHudWidget::IsWeaponWheelOpen() const
{
	const ALastTrainCharacter* Character = GetCharacter();
	return Character && Character->IsWeaponWheelOpen();
}
