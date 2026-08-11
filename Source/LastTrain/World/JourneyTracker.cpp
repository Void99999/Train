// Copyright LAST TRAIN. All rights reserved.

#include "World/JourneyTracker.h"

#include "Data/LastTrainBalance.h"
#include "Data/LastTrainDataRegistry.h"
#include "Engine/World.h"
#include "LastTrain.h"

void UJourneyTracker::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	DistanceKm = 0.f;
	LastOutpostReached = 0;
	PeaceSecondsRemaining = 0.f;
	GrantedUnlocks.Reset();
}

UJourneyTracker* UJourneyTracker::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UJourneyTracker>() : nullptr;
}

void UJourneyTracker::UpdateDistance(float NewDistanceKm)
{
	if (NewDistanceKm <= DistanceKm)
	{
		return;
	}
	DistanceKm = NewDistanceKm;

	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (!Registry)
	{
		return;
	}

	// Every outpost passed since the last check, not just the next one. A long
	// frame or a debug teleport must not leave outposts permanently unreached -
	// that bug cost the browser prototype every shop after the first.
	for (const FOutpostRow& Outpost : Registry->GetOutpostsInOrder())
	{
		if (Outpost.Index > LastOutpostReached && DistanceKm >= Outpost.DistanceKm)
		{
			ReachOutpost(Outpost);
		}
	}
}

void UJourneyTracker::ReachOutpost(const FOutpostRow& Outpost)
{
	LastOutpostReached = Outpost.Index;
	PeaceSecondsRemaining = ULastTrainBalance::Get().PostOutpostPeaceSeconds;

	for (const FName& UnlockId : Outpost.Unlocks)
	{
		bool bAlreadyThere = false;
		GrantedUnlocks.Add(UnlockId, &bAlreadyThere);
		if (!bAlreadyThere)
		{
			OnUnlockGranted.Broadcast(UnlockId);
		}
	}

	UE_LOG(LogLastTrain, Log, TEXT("Reached outpost %d at %.1f km."), Outpost.Index, Outpost.DistanceKm);
	OnOutpostReached.Broadcast(Outpost.Index);
}

void UJourneyTracker::TickPeacePeriod(float DeltaSeconds)
{
	if (PeaceSecondsRemaining > 0.f)
	{
		PeaceSecondsRemaining = FMath::Max(0.f, PeaceSecondsRemaining - DeltaSeconds);
	}
}

bool UJourneyTracker::MaySpawnEncounters() const
{
	return PeaceSecondsRemaining <= 0.f;
}

bool UJourneyTracker::HasReachedTheEnd() const
{
	return DistanceKm >= ULastTrainBalance::Get().TotalDistanceKm;
}
