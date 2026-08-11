// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "DayNightCycle.generated.h"

class UDirectionalLightComponent;
class USkyLightComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTimeOfDayChanged, float, TimeOfDay);

/**
 * Dawn to dawn over forty minutes.
 *
 * Drives a directional light and the sky. A hundred kilometres takes long
 * enough that the light has to change, and the game is better for it: an
 * ambush at dusk is a different problem from the same ambush at noon.
 *
 * Time of day runs 0 to 1, with 0 at midnight and 0.25 at sunrise. That is the
 * same convention the browser prototype used, so the balancing carries across -
 * including the hard lesson that "he leaves at dawn" meant 0.225 there, where
 * the sun is still below the horizon, and every shot came out black.
 */
UCLASS()
class LASTTRAIN_API ADayNightCycle : public AActor
{
	GENERATED_BODY()

public:
	ADayNightCycle();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UFUNCTION(BlueprintPure, Category = "World") float GetTimeOfDay() const { return TimeOfDay; }

	UFUNCTION(BlueprintCallable, Category = "World")
	void SetTimeOfDay(float NewTimeOfDay);

	/** Stops the clock, so a cutscene can hold a time of day. */
	UFUNCTION(BlueprintCallable, Category = "World")
	void SetPaused(bool bPaused) { bClockPaused = bPaused; }

	/** Sun elevation in degrees. Negative means below the horizon. */
	UFUNCTION(BlueprintPure, Category = "World")
	float GetSunElevationDegrees() const;

	UPROPERTY(BlueprintAssignable, Category = "World") FOnTimeOfDayChanged OnTimeOfDayChanged;

protected:
	/** The sun. Found in the level when left unset. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "World")
	TObjectPtr<AActor> SunActor;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "World")
	bool bClockPaused = false;

private:
	void ApplyToSun();

	UPROPERTY(Transient) float TimeOfDay = 0.27f;
};
