// Copyright LAST TRAIN. All rights reserved.

#include "Train/RailSpline.h"

#include "Components/SplineComponent.h"
#include "EngineUtils.h"

ARailSpline::ARailSpline()
{
	PrimaryActorTick.bCanEverTick = false;

	Spline = CreateDefaultSubobject<USplineComponent>(TEXT("Spline"));
	SetRootComponent(Spline);

	// A railway is not a racetrack: it has long straights and gentle curves,
	// so the default two-point spline starts as a straight kilometre and the
	// designer bends it rather than building it from nothing.
	Spline->ClearSplinePoints(false);
	Spline->AddSplinePoint(FVector::ZeroVector, ESplineCoordinateSpace::Local, false);
	Spline->AddSplinePoint(FVector(100000.f, 0.f, 0.f), ESplineCoordinateSpace::Local, false);
	Spline->SetSplinePointType(0, ESplinePointType::Linear, false);
	Spline->SetSplinePointType(1, ESplinePointType::Linear, true);
}

float ARailSpline::GetLength() const
{
	return Spline ? Spline->GetSplineLength() : 0.f;
}

FTransform ARailSpline::GetTransformAtDistance(float Distance) const
{
	if (!Spline)
	{
		return GetActorTransform();
	}

	const float Clamped = FMath::Clamp(Distance, 0.f, Spline->GetSplineLength());
	return Spline->GetTransformAtDistanceAlongSpline(Clamped, ESplineCoordinateSpace::World, /*bUseScale*/ false);
}

FVector ARailSpline::GetLocationBesideTrack(float Distance, float LateralOffset, float Height) const
{
	const FTransform OnTrack = GetTransformAtDistance(Distance);
	return OnTrack.GetLocation()
		+ OnTrack.GetRotation().GetRightVector() * LateralOffset
		+ FVector::UpVector * Height;
}

ARailSpline* ARailSpline::Find(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	if (!World)
	{
		return nullptr;
	}

	for (TActorIterator<ARailSpline> It(const_cast<UWorld*>(World)); It; ++It)
	{
		return *It;
	}
	return nullptr;
}
