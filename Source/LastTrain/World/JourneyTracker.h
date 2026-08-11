// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Data/LastTrainCatalogRows.h"
#include "JourneyTracker.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOutpostReached, int32, OutpostIndex);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnUnlockGranted, FName, UnlockId);

/**
 * How far along the line the run is, and what that has opened up.
 *
 * A world subsystem rather than an actor, because the answer to "how far are
 * we" must not depend on some actor existing in the level.
 *
 * Two things about this class are design constraints rather than
 * implementation details:
 *
 *  - Nothing here may be shown to the player as distance remaining. There is a
 *    GetDistanceTravelledKm and deliberately no GetDistanceToGo. The player is
 *    never told the line ends, because the ending is the game's one surprise.
 *
 *  - After leaving an outpost there is a quiet period before anything may be
 *    spawned. Being ambushed while the platform is still in sight makes the
 *    safe outposts feel like a lie.
 */
UCLASS()
class LASTTRAIN_API UJourneyTracker : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	static UJourneyTracker* Get(const UObject* WorldContext);

	/** Called by the train as it moves. */
	void UpdateDistance(float DistanceKm);

	UFUNCTION(BlueprintPure, Category = "Journey") float GetDistanceTravelledKm() const { return DistanceKm; }
	UFUNCTION(BlueprintPure, Category = "Journey") int32 GetLastOutpostReached() const { return LastOutpostReached; }

	/** True while the post-outpost quiet period is running. */
	UFUNCTION(BlueprintPure, Category = "Journey") bool IsInPeacePeriod() const { return PeaceSecondsRemaining > 0.f; }

	UFUNCTION(BlueprintCallable, Category = "Journey")
	void TickPeacePeriod(float DeltaSeconds);

	/** Whether the encounter director may spawn anything right now. */
	UFUNCTION(BlueprintPure, Category = "Journey")
	bool MaySpawnEncounters() const;

	UFUNCTION(BlueprintPure, Category = "Journey")
	bool HasUnlock(FName UnlockId) const { return GrantedUnlocks.Contains(UnlockId); }

	UFUNCTION(BlueprintPure, Category = "Journey")
	const TSet<FName>& GetUnlocks() const { return GrantedUnlocks; }

	/** True once the whole line has been run. Drives the ending, nothing else. */
	UFUNCTION(BlueprintPure, Category = "Journey")
	bool HasReachedTheEnd() const;

	UPROPERTY(BlueprintAssignable, Category = "Journey") FOnOutpostReached OnOutpostReached;
	UPROPERTY(BlueprintAssignable, Category = "Journey") FOnUnlockGranted OnUnlockGranted;

private:
	void ReachOutpost(const FOutpostRow& Outpost);

	UPROPERTY(Transient) float DistanceKm = 0.f;
	UPROPERTY(Transient) int32 LastOutpostReached = 0;
	UPROPERTY(Transient) float PeaceSecondsRemaining = 0.f;
	UPROPERTY(Transient) TSet<FName> GrantedUnlocks;
};
