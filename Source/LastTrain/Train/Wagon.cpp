// Copyright LAST TRAIN. All rights reserved.

#include "Train/Wagon.h"

#include "Data/LastTrainDataRegistry.h"
#include "LastTrain.h"
#include "Train/VehicleHealthComponent.h"

AWagon::AWagon()
{
	VehicleId = TEXT("transport_1");
}

bool AWagon::UpgradeToNextLevel()
{
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (!Registry)
	{
		return false;
	}

	const FName NextId = ULastTrainDataRegistry::MakeVehicleId(Row.Kind, Row.Level + 1);
	if (!Registry->FindVehicle(NextId))
	{
		return false;
	}

	// Condition carries across the upgrade rather than being reset. A wagon
	// that was half-wrecked before the workshop touched it is still half-wrecked
	// after - upgrading is not a repair, and the two are bought separately.
	const float Fraction = Health ? Health->GetFraction() : 1.f;
	const bool bWasArmoured = Health && Health->IsArmoured();

	ConfigureFromCatalogue(NextId);

	if (Health)
	{
		Health->SetHealthFraction(Fraction);
		if (bWasArmoured)
		{
			Health->FitArmour();
		}
	}

	UE_LOG(LogLastTrainTrain, Log, TEXT("%s upgraded to %s."), *GetName(), *NextId.ToString());
	return true;
}
