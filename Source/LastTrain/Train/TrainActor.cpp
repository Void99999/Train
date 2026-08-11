// Copyright LAST TRAIN. All rights reserved.

#include "Train/TrainActor.h"

#include "Audio/TrainAudioComponent.h"
#include "Data/LastTrainBalance.h"
#include "Data/LastTrainDataRegistry.h"
#include "EngineUtils.h"
#include "LastTrain.h"
#include "Train/CargoHoldComponent.h"
#include "Train/Locomotive.h"
#include "Train/RailSpline.h"
#include "Train/ThrottleComponent.h"
#include "Train/TrainVehicle.h"
#include "Train/VehicleHealthComponent.h"
#include "Train/Wagon.h"
#include "World/JourneyTracker.h"

ATrainActor::ATrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	// Before physics, so the vehicles are where they belong when the character
	// movement component asks what it is standing on.
	PrimaryActorTick.TickGroup = TG_PrePhysics;

	Throttle = CreateDefaultSubobject<UThrottleComponent>(TEXT("Throttle"));
	Audio = CreateDefaultSubobject<UTrainAudioComponent>(TEXT("Audio"));

	LocomotiveClass = ALocomotive::StaticClass();
	WagonClass = AWagon::StaticClass();
}

void ATrainActor::BeginPlay()
{
	Super::BeginPlay();

	if (!Rail)
	{
		Rail = ARailSpline::Find(this);
	}
	if (!Rail)
	{
		UE_LOG(LogLastTrainTrain, Error,
			TEXT("No ARailSpline in the level. The train has nothing to run on and will stand still. ")
			TEXT("Place one, or let ABlockoutBuilder create it."));
		return;
	}

	HeadDistance = StartDistance;
	BuildConsist();
}

ATrainActor* ATrainActor::Find(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World)
	{
		return nullptr;
	}

	for (TActorIterator<ATrainActor> It(const_cast<UWorld*>(World)); It; ++It)
	{
		return *It;
	}
	return nullptr;
}

/* ------------------------------------------------------------- consist */

void ATrainActor::BuildConsist()
{
	UWorld* World = GetWorld();
	if (!World || !LocomotiveClass)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.Owner = this;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	Locomotive = World->SpawnActor<ALocomotive>(LocomotiveClass, GetActorTransform(), Params);
	if (!Locomotive)
	{
		UE_LOG(LogLastTrainTrain, Error, TEXT("Could not spawn the locomotive."));
		return;
	}

	Locomotive->ConfigureFromCatalogue(TEXT("locomotive"));
	Vehicles.Add(Locomotive);

	for (const FName& WagonId : StartingWagons)
	{
		AttachWagon(WagonId);
	}

	RelayoutConsist();
	PlaceVehicles();

	OnConsistChanged.Broadcast(Vehicles.Num());
}

ATrainVehicle* ATrainActor::AttachWagon(FName VehicleId)
{
	UWorld* World = GetWorld();
	if (!World || !WagonClass)
	{
		return nullptr;
	}

	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (!Registry || !Registry->FindVehicle(VehicleId))
	{
		UE_LOG(LogLastTrainTrain, Warning, TEXT("Cannot couple unknown vehicle '%s'."), *VehicleId.ToString());
		return nullptr;
	}

	FActorSpawnParameters Params;
	Params.Owner = this;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	AWagon* NewWagon = World->SpawnActor<AWagon>(WagonClass, GetActorTransform(), Params);
	if (!NewWagon)
	{
		return nullptr;
	}

	NewWagon->ConfigureFromCatalogue(VehicleId);
	Vehicles.Add(NewWagon);

	RelayoutConsist();
	PlaceVehicles();
	OnConsistChanged.Broadcast(Vehicles.Num());

	return NewWagon;
}

bool ATrainActor::DetachFrom(ATrainVehicle* Vehicle)
{
	const int32 Index = Vehicles.IndexOfByKey(Vehicle);
	if (Index <= 0)
	{
		// Index 0 is the locomotive. Uncoupling that is not a detach, it is the
		// end of the run, and the run manager handles it.
		return false;
	}

	// Everything from here back goes with it.
	for (int32 Behind = Vehicles.Num() - 1; Behind >= Index; --Behind)
	{
		if (ATrainVehicle* Lost = Vehicles[Behind])
		{
			// PLACEHOLDER. A detached wagon should roll to a stop on the rail
			// behind the train and be lootable. For now it is removed, which
			// keeps the consist correct while that is built.
			Lost->Destroy();
		}
		Vehicles.RemoveAt(Behind);
	}

	RelayoutConsist();
	OnConsistChanged.Broadcast(Vehicles.Num());
	return true;
}

int32 ATrainActor::GetWagonCount() const
{
	return FMath::Max(0, Vehicles.Num() - 1);
}

void ATrainActor::RelayoutConsist()
{
	const float CouplingCm = ULastTrainBalance::MetresToCm(ULastTrainBalance::Get().CouplingLengthMetres);

	float Offset = 0.f;
	for (int32 Index = 0; Index < Vehicles.Num(); ++Index)
	{
		ATrainVehicle* Vehicle = Vehicles[Index];
		if (!Vehicle)
		{
			continue;
		}

		const float HalfLength = ULastTrainBalance::MetresToCm(Vehicle->GetLengthMetres()) * 0.5f;

		// Offsets are measured centre to centre: half of this vehicle, plus the
		// coupling, plus half of the one in front.
		if (Index == 0)
		{
			Offset = HalfLength;
		}
		else
		{
			const ATrainVehicle* Ahead = Vehicles[Index - 1];
			const float AheadHalf = Ahead
				? ULastTrainBalance::MetresToCm(Ahead->GetLengthMetres()) * 0.5f
				: 0.f;
			Offset += AheadHalf + CouplingCm + HalfLength;
		}

		Vehicle->SetDistanceBehindHead(Offset);
	}
}

void ATrainActor::PlaceVehicles()
{
	if (!Rail)
	{
		return;
	}
	for (ATrainVehicle* Vehicle : Vehicles)
	{
		if (Vehicle)
		{
			Vehicle->PlaceOnRail(*Rail, HeadDistance);
		}
	}
}

/* -------------------------------------------------------------- motion */

float ATrainActor::GetPerformanceMultiplier() const
{
	const ULastTrainBalance& Balance = ULastTrainBalance::Get();
	const FTrainPerformanceBalance& Rules = Balance.Performance;

	float Multiplier = 1.f;
	Multiplier -= Rules.PenaltyPerWagon * GetWagonCount();

	for (const ATrainVehicle* Vehicle : Vehicles)
	{
		if (Vehicle && Vehicle->GetHealth() && Vehicle->GetHealth()->IsArmoured())
		{
			Multiplier -= Rules.PenaltyPerArmouredVehicle;
		}
	}

	Multiplier -= Rules.PenaltyPerOccupiedCargoSlot * GetUsedCargoSlots();

	// Floored, so a fully loaded armoured train is slow rather than unplayable.
	return FMath::Max(Rules.MinimumMultiplier, Multiplier);
}

float ATrainActor::GetMaxSpeedKmh() const
{
	return ULastTrainBalance::Get().BaseMaxSpeedKmh * GetPerformanceMultiplier();
}

float ATrainActor::GetSpeedKmh() const
{
	return SpeedMetresPerSecond / ULastTrainBalance::KmhToMetresPerSecond;
}

float ATrainActor::GetDistanceTravelledKm() const
{
	return ULastTrainBalance::CmToMetres(HeadDistance - StartDistance) / 1000.f;
}

void ATrainActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!Rail || !Throttle)
	{
		return;
	}

	const ULastTrainBalance& Balance = ULastTrainBalance::Get();
	const float Performance = GetPerformanceMultiplier();

	const float TargetMetresPerSecond =
		Balance.BaseMaxSpeedKmh * Balance.KmhToMetresPerSecond
		* Performance * Throttle->GetFraction();

	// Accelerating is what the engine has to work for, so it scales with
	// performance. Slowing down is brakes and friction, which do not care how
	// heavy the train is - if anything a heavy train stops harder once it
	// commits, so this is deliberately not scaled.
	const float Rate = TargetMetresPerSecond > SpeedMetresPerSecond
		? Balance.AccelerationMetresPerSecondSquared * Performance
		: Balance.DecelerationMetresPerSecondSquared;

	SpeedMetresPerSecond = FMath::FInterpConstantTo(
		SpeedMetresPerSecond, TargetMetresPerSecond, DeltaSeconds, Rate);

	if (SpeedMetresPerSecond > KINDA_SMALL_NUMBER)
	{
		HeadDistance += ULastTrainBalance::MetresToCm(SpeedMetresPerSecond * DeltaSeconds);

		// The end of the line. Something else decides what happens there; the
		// train's job is to stop rather than to run off the spline.
		const float RailLength = Rail->GetLength();
		if (HeadDistance >= RailLength)
		{
			HeadDistance = RailLength;
			SpeedMetresPerSecond = 0.f;
		}
	}

	PlaceVehicles();

	const float SpeedKmh = GetSpeedKmh();
	if (!FMath::IsNearlyEqual(SpeedKmh, LastBroadcastSpeedKmh, 0.1f))
	{
		LastBroadcastSpeedKmh = SpeedKmh;
		OnSpeedChanged.Broadcast(SpeedKmh);
	}

	const float DistanceKm = GetDistanceTravelledKm();
	if (!FMath::IsNearlyEqual(DistanceKm, LastBroadcastDistanceKm, 0.01f))
	{
		LastBroadcastDistanceKm = DistanceKm;
		OnDistanceTravelled.Broadcast(DistanceKm);

		// The journey is a property of how far the train has come, so the train
		// is what tells it. Nothing else should be updating this.
		if (UJourneyTracker* Journey = UJourneyTracker::Get(this))
		{
			Journey->UpdateDistance(DistanceKm);
		}
	}

	if (UJourneyTracker* Journey = UJourneyTracker::Get(this))
	{
		Journey->TickPeacePeriod(DeltaSeconds);
	}
}

/* --------------------------------------------------------------- cargo */

int32 ATrainActor::CountRoundsAvailable(FName CargoId) const
{
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	const FCargoRow* Row = Registry ? Registry->FindCargo(CargoId) : nullptr;
	const int32 RoundsPerUnit = Row ? FMath::Max(1, Row->RoundsPerUnit) : 1;

	int32 Units = 0;
	for (const ATrainVehicle* Vehicle : Vehicles)
	{
		if (Vehicle && Vehicle->GetCargoHold())
		{
			Units += Vehicle->GetCargoHold()->GetQuantity(CargoId);
		}
	}
	return Units * RoundsPerUnit;
}

int32 ATrainActor::TakeRounds(FName CargoId, int32 Rounds)
{
	if (Rounds <= 0)
	{
		return 0;
	}

	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	const FCargoRow* Row = Registry ? Registry->FindCargo(CargoId) : nullptr;
	const int32 RoundsPerUnit = Row ? FMath::Max(1, Row->RoundsPerUnit) : 1;

	// Whole units come out of the hold, so a magazine's worth of rounds costs
	// a box even if a few rounds are left over. The remainder is not thrown
	// away - it stays in the magazine.
	const int32 UnitsWanted = FMath::DivideAndRoundUp(Rounds, RoundsPerUnit);

	int32 UnitsTaken = 0;
	for (ATrainVehicle* Vehicle : Vehicles)
	{
		if (UnitsTaken >= UnitsWanted)
		{
			break;
		}
		if (Vehicle && Vehicle->GetCargoHold())
		{
			UnitsTaken += Vehicle->GetCargoHold()->Remove(CargoId, UnitsWanted - UnitsTaken);
		}
	}

	return FMath::Min(Rounds, UnitsTaken * RoundsPerUnit);
}

int32 ATrainActor::LoadCargo(FName CargoId, int32 Quantity)
{
	int32 Loaded = 0;
	for (ATrainVehicle* Vehicle : Vehicles)
	{
		if (Loaded >= Quantity)
		{
			break;
		}
		if (Vehicle && Vehicle->GetCargoHold())
		{
			Loaded += Vehicle->GetCargoHold()->Add(CargoId, Quantity - Loaded);
		}
	}
	return Loaded;
}

int32 ATrainActor::GetTotalCargoSlots() const
{
	int32 Total = 0;
	for (const ATrainVehicle* Vehicle : Vehicles)
	{
		if (Vehicle && Vehicle->GetCargoHold())
		{
			Total += Vehicle->GetCargoHold()->GetTotalSlots();
		}
	}
	return Total;
}

int32 ATrainActor::GetUsedCargoSlots() const
{
	int32 Used = 0;
	for (const ATrainVehicle* Vehicle : Vehicles)
	{
		if (Vehicle && Vehicle->GetCargoHold())
		{
			Used += Vehicle->GetCargoHold()->GetUsedSlots();
		}
	}
	return Used;
}
