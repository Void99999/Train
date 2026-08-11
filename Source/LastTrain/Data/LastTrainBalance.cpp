// Copyright LAST TRAIN. All rights reserved.

#include "Data/LastTrainBalance.h"

ULastTrainBalance::ULastTrainBalance()
{
	// Notch 0 is a stand; 1 to 4 are the settings stencilled on the quadrant.
	ThrottleSteps = { 0.f, 0.25f, 0.5f, 0.75f, 1.f };

	StartingCargo = { FCargoStack(TEXT("pistol_ammo"), 4) };

	Normal.bRespawnAtLastReachedOutpost = true;
	Normal.MoneyLossOnDeath = 0.2f;
	Normal.CargoLossOnDeath = 0.25f;
	Normal.RespawnHealthFraction = 1.f;
	Normal.RespawnVehicleHealthFraction = 0.6f;

	// One life. Everything is lost because there is nothing to come back to.
	Hardcore.bRespawnAtLastReachedOutpost = false;
	Hardcore.MoneyLossOnDeath = 1.f;
	Hardcore.CargoLossOnDeath = 1.f;
	Hardcore.RespawnHealthFraction = 0.f;
	Hardcore.RespawnVehicleHealthFraction = 0.f;
}

const ULastTrainBalance& ULastTrainBalance::Get()
{
	const ULastTrainBalance* Settings = GetDefault<ULastTrainBalance>();
	check(Settings);
	return *Settings;
}

FName ULastTrainBalance::GetCategoryName() const
{
	return TEXT("Game");
}

const FGameModeBalance& ULastTrainBalance::RulesFor(ELastTrainGameMode Mode) const
{
	return Mode == ELastTrainGameMode::Hardcore ? Hardcore : Normal;
}

EDamageState ULastTrainBalance::DamageStateFor(float HealthFraction) const
{
	if (HealthFraction <= 0.f)
	{
		return EDamageState::Destroyed;
	}
	if (HealthFraction < DamageStateCritical)
	{
		return EDamageState::Critical;
	}
	if (HealthFraction < DamageStateHeavy)
	{
		return EDamageState::Heavy;
	}
	if (HealthFraction < DamageStateMedium)
	{
		return EDamageState::Medium;
	}
	if (HealthFraction < DamageStateLight)
	{
		return EDamageState::Light;
	}
	return EDamageState::Pristine;
}
