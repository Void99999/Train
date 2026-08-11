// Copyright LAST TRAIN. All rights reserved.

#include "World/DayNightCycle.h"

#include "Components/DirectionalLightComponent.h"
#include "Data/LastTrainBalance.h"
#include "Engine/DirectionalLight.h"
#include "EngineUtils.h"

ADayNightCycle::ADayNightCycle()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ADayNightCycle::BeginPlay()
{
	Super::BeginPlay();

	TimeOfDay = ULastTrainBalance::Get().StartTimeOfDay;

	if (!SunActor)
	{
		for (TActorIterator<ADirectionalLight> It(GetWorld()); It; ++It)
		{
			SunActor = *It;
			break;
		}
	}

	ApplyToSun();
	OnTimeOfDayChanged.Broadcast(TimeOfDay);
}

void ADayNightCycle::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bClockPaused)
	{
		return;
	}

	const float DayLength = FMath::Max(1.f, ULastTrainBalance::Get().DayLengthSeconds);
	SetTimeOfDay(FMath::Fmod(TimeOfDay + DeltaSeconds / DayLength, 1.f));
}

void ADayNightCycle::SetTimeOfDay(float NewTimeOfDay)
{
	TimeOfDay = FMath::Fmod(FMath::Max(0.f, NewTimeOfDay), 1.f);
	ApplyToSun();
	OnTimeOfDayChanged.Broadcast(TimeOfDay);
}

float ADayNightCycle::GetSunElevationDegrees() const
{
	// Sunrise at 0.25, noon at 0.5, sunset at 0.75. A sine through those gives
	// a plausible arc without pretending to be an ephemeris.
	return FMath::RadiansToDegrees(FMath::Sin((TimeOfDay - 0.25f) * 2.f * PI) * (PI / 2.f));
}

void ADayNightCycle::ApplyToSun()
{
	if (!SunActor)
	{
		return;
	}

	// Pitch is negative when the sun is up, because a directional light points
	// the way the light travels.
	const float Elevation = GetSunElevationDegrees();
	const float Azimuth = TimeOfDay * 360.f;

	SunActor->SetActorRotation(FRotator(-Elevation, Azimuth, 0.f));

	if (UDirectionalLightComponent* Light = SunActor->FindComponentByClass<UDirectionalLightComponent>())
	{
		// Fades out below the horizon rather than snapping off, so dusk is a
		// period rather than an event.
		const float Daylight = FMath::Clamp((Elevation + 6.f) / 12.f, 0.f, 1.f);
		Light->SetIntensity(FMath::Lerp(0.02f, 6.f, Daylight));
	}
}
