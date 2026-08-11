// Copyright LAST TRAIN. All rights reserved.

#include "World/BlockoutBuilder.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SplineComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Data/LastTrainBalance.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "LastTrain.h"
#include "Train/RailSpline.h"
#include "Train/TrainActor.h"

ABlockoutBuilder::ABlockoutBuilder()
{
	PrimaryActorTick.bCanEverTick = false;
}

void ABlockoutBuilder::BeginPlay()
{
	Super::BeginPlay();

	if (bSpawnLighting)
	{
		BuildLighting();
	}
	if (bSpawnGround)
	{
		BuildGround();
	}

	ARailSpline* Rail = BuildRailway();
	if (!Rail)
	{
		return;
	}

	BuildMarkerPosts(*Rail);

	if (bSpawnTrain)
	{
		BuildTrain(*Rail);
	}

	UE_LOG(LogLastTrain, Warning,
		TEXT("PLACEHOLDER BLOCKOUT BUILT. Boxes, a ground plane and a directional light. ")
		TEXT("This is scaffolding for the vertical slice, not the game's environment."));
}

AActor* ABlockoutBuilder::SpawnBox(const FName Name, const FVector& Location, const FRotator& Rotation,
	const FVector& SizeCm, bool bCollides)
{
	UWorld* World = GetWorld();
	UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (!World || !Cube)
	{
		return nullptr;
	}

	FActorSpawnParameters Params;
	Params.Name = Name;
	Params.NameMode = FActorSpawnParameters::ESpawnActorNameMode::Requested;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Params.Owner = this;

	AStaticMeshActor* Box = World->SpawnActor<AStaticMeshActor>(
		AStaticMeshActor::StaticClass(), Location, Rotation, Params);
	if (!Box)
	{
		return nullptr;
	}

	UStaticMeshComponent* Mesh = Box->GetStaticMeshComponent();
	Mesh->SetMobility(EComponentMobility::Movable);
	Mesh->SetStaticMesh(Cube);
	// The engine cube is 100 units on a side, so a scale is a size.
	Mesh->SetRelativeScale3D(SizeCm / 100.f);
	Mesh->SetCollisionEnabled(bCollides ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);

	return Box;
}

ARailSpline* ABlockoutBuilder::BuildRailway()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return nullptr;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Params.Owner = this;

	ARailSpline* Rail = World->SpawnActor<ARailSpline>(ARailSpline::StaticClass(), FTransform::Identity, Params);
	if (!Rail || !Rail->GetSpline())
	{
		UE_LOG(LogLastTrain, Error, TEXT("Could not spawn the placeholder railway."));
		return nullptr;
	}

	USplineComponent* Spline = Rail->GetSpline();
	Spline->ClearSplinePoints(false);

	// A long shallow curve rather than a straight line, so curve bugs surface
	// during ordinary testing instead of on the first real level.
	constexpr int32 PointCount = 12;
	const float LengthCm = ULastTrainBalance::MetresToCm(TrackLengthMetres);
	const float CurveCm = ULastTrainBalance::MetresToCm(TrackCurveMetres);

	for (int32 Index = 0; Index < PointCount; ++Index)
	{
		const float Alpha = static_cast<float>(Index) / (PointCount - 1);
		const FVector Point(
			Alpha * LengthCm,
			FMath::Sin(Alpha * PI) * CurveCm,
			0.f);
		Spline->AddSplinePoint(Point, ESplineCoordinateSpace::World, false);
	}
	Spline->UpdateSpline();

	// Ballast: a strip of boxes along the line so the track reads as track.
	const float Length = Spline->GetSplineLength();
	constexpr float BallastSpacing = 1200.f;
	const int32 Segments = FMath::Max(1, FMath::FloorToInt(Length / BallastSpacing));

	for (int32 Index = 0; Index <= Segments; ++Index)
	{
		const float Distance = FMath::Min(Length, Index * BallastSpacing);
		const FTransform OnRail = Rail->GetTransformAtDistance(Distance);

		SpawnBox(
			FName(*FString::Printf(TEXT("Blockout_Ballast_%d"), Index)),
			OnRail.GetLocation() - FVector::UpVector * 30.f,
			OnRail.GetRotation().Rotator(),
			FVector(BallastSpacing + 20.f, 500.f, 60.f),
			/*bCollides*/ true);
	}

	return Rail;
}

void ABlockoutBuilder::BuildGround()
{
	// One very large slab. A landscape is an editor-authored asset; this is
	// something to stand on so the player does not fall out of the world.
	SpawnBox(TEXT("Blockout_Ground"),
		FVector(ULastTrainBalance::MetresToCm(TrackLengthMetres) * 0.5f, 0.f, -80.f),
		FRotator::ZeroRotator,
		FVector(ULastTrainBalance::MetresToCm(TrackLengthMetres) * 1.5f,
				ULastTrainBalance::MetresToCm(TrackLengthMetres) * 0.6f,
				100.f),
		/*bCollides*/ true);
}

void ABlockoutBuilder::BuildLighting()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Params.Owner = this;

	// A sun low enough to throw long shadows down the line, which is both what
	// the game looks like and what makes the geometry readable.
	if (ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(
		ADirectionalLight::StaticClass(), FVector(0.f, 0.f, 20000.f), FRotator(-38.f, 145.f, 0.f), Params))
	{
		Sun->SetMobility(EComponentMobility::Movable);
		if (UDirectionalLightComponent* Light = Cast<UDirectionalLightComponent>(Sun->GetLightComponent()))
		{
			Light->SetIntensity(6.f);
			Light->SetAtmosphereSunLight(true);
		}
	}

	// Sky light, so shadowed sides are lit by the sky rather than being black.
	if (ASkyLight* SkyLight = World->SpawnActor<ASkyLight>(
		ASkyLight::StaticClass(), FVector(0.f, 0.f, 20000.f), FRotator::ZeroRotator, Params))
	{
		SkyLight->SetMobility(EComponentMobility::Movable);
		if (USkyLightComponent* Component = SkyLight->GetLightComponent())
		{
			Component->SetIntensity(1.f);
			Component->bRealTimeCapture = true;
			Component->MarkRenderStateDirty();
		}
	}

	// Atmosphere and fog. Cheap, and without them the horizon is a hard seam
	// between a grey plane and black nothing.
	World->SpawnActor<AActor>(ASkyAtmosphere::StaticClass(), FTransform::Identity, Params);
	World->SpawnActor<AExponentialHeightFog>(
		AExponentialHeightFog::StaticClass(), FVector(0.f, 0.f, 500.f), FRotator::ZeroRotator, Params);
}

void ABlockoutBuilder::BuildMarkerPosts(const ARailSpline& Rail)
{
	if (MarkerPostCount <= 0)
	{
		return;
	}

	// Something to pass. Speed is unreadable across an empty plane, and the
	// first thing anyone checks when a train "does not feel like it is moving"
	// is whether there is anything to measure it against.
	const float Length = Rail.GetLength();
	const float Spacing = Length / MarkerPostCount;

	for (int32 Index = 0; Index < MarkerPostCount; ++Index)
	{
		const float Distance = Index * Spacing;
		const float Side = (Index % 2 == 0) ? 1.f : -1.f;

		SpawnBox(
			FName(*FString::Printf(TEXT("Blockout_Post_%d"), Index)),
			Rail.GetLocationBesideTrack(Distance, Side * 600.f, 300.f),
			FRotator::ZeroRotator,
			FVector(40.f, 40.f, 600.f),
			/*bCollides*/ false);
	}
}

ATrainActor* ABlockoutBuilder::BuildTrain(ARailSpline& Rail)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return nullptr;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Params.Owner = this;

	const FTransform Start = Rail.GetTransformAtDistance(0.f);
	return World->SpawnActor<ATrainActor>(ATrainActor::StaticClass(), Start, Params);
}
