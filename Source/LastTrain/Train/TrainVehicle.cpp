// Copyright LAST TRAIN. All rights reserved.

#include "Train/TrainVehicle.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Data/LastTrainBalance.h"
#include "Data/LastTrainDataRegistry.h"
#include "Engine/StaticMesh.h"
#include "LastTrain.h"
#include "Train/CargoHoldComponent.h"
#include "Train/RailSpline.h"
#include "Train/VehicleHealthComponent.h"

ATrainVehicle::ATrainVehicle()
{
	// Placed by the train, so it does not tick itself.
	PrimaryActorTick.bCanEverTick = false;

	Hull = CreateDefaultSubobject<UBoxComponent>(TEXT("Hull"));
	SetRootComponent(Hull);
	Hull->SetMobility(EComponentMobility::Movable);
	Hull->SetCollisionProfileName(TEXT("TrainVehicle"));
	Hull->SetGenerateOverlapEvents(true);
	// The player stands on this while it moves, which is only true if it is
	// allowed to be a movement base.
	Hull->SetCanEverAffectNavigation(false);

	BlockoutMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BlockoutMesh"));
	BlockoutMesh->SetupAttachment(Hull);
	BlockoutMesh->SetMobility(EComponentMobility::Movable);
	BlockoutMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	Health = CreateDefaultSubobject<UVehicleHealthComponent>(TEXT("VehicleHealth"));
	CargoHold = CreateDefaultSubobject<UCargoHoldComponent>(TEXT("CargoHold"));
}

void ATrainVehicle::BeginPlay()
{
	Super::BeginPlay();

	if (Health)
	{
		Health->OnDamageStateChanged.AddDynamic(this, &ATrainVehicle::HandleDamageStateChanged);
		Health->OnDestroyed.AddDynamic(this, &ATrainVehicle::HandleDestroyed);
	}

	if (!VehicleId.IsNone() && Row.MaxHealth <= 0.f)
	{
		ConfigureFromCatalogue(VehicleId);
	}
}

void ATrainVehicle::ConfigureFromCatalogue(FName InVehicleId)
{
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (!Registry)
	{
		return;
	}

	const FVehicleRow* Found = Registry->FindVehicle(InVehicleId);
	if (!Found)
	{
		UE_LOG(LogLastTrainTrain, Error, TEXT("Unknown vehicle '%s'. Leaving %s unconfigured."),
			*InVehicleId.ToString(), *GetName());
		return;
	}

	VehicleId = InVehicleId;
	Row = *Found;

	if (Health)
	{
		Health->ConfigureFromRow(Row.MaxHealth);
	}
	if (CargoHold)
	{
		CargoHold->ConfigureFromRow(Row.CargoSlots);
	}

	RebuildBlockout();
}

void ATrainVehicle::RebuildBlockout()
{
	const float LengthCm = ULastTrainBalance::MetresToCm(Row.LengthMetres);
	const float WidthCm = ULastTrainBalance::MetresToCm(Row.WidthMetres);
	const float HeightCm = ULastTrainBalance::MetresToCm(Row.HeightMetres);

	if (Hull)
	{
		// Box extents are half-dimensions. X runs along the rail.
		Hull->SetBoxExtent(FVector(LengthCm * 0.5f, WidthCm * 0.5f, HeightCm * 0.5f), /*bUpdateOverlaps*/ true);
	}

	if (!BlockoutMesh)
	{
		return;
	}

	// A Blueprint subclass with a real mesh assigned keeps it; only an empty
	// slot gets the placeholder cube.
	if (!BlockoutMesh->GetStaticMesh())
	{
		// PLACEHOLDER. The engine's unit cube, scaled. Replace with modelled
		// geometry - this is a blockout and looks like one.
		static const TCHAR* CubePath = TEXT("/Engine/BasicShapes/Cube.Cube");
		if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, CubePath))
		{
			BlockoutMesh->SetStaticMesh(Cube);
		}
		else
		{
			UE_LOG(LogLastTrainTrain, Warning,
				TEXT("Blockout cube '%s' not found; %s will be invisible until a mesh is assigned."),
				CubePath, *GetName());
			return;
		}
	}

	// The engine cube is 100 units on a side and centred on its origin.
	BlockoutMesh->SetRelativeScale3D(FVector(LengthCm, WidthCm, HeightCm) / 100.f);
	BlockoutMesh->SetRelativeLocation(FVector::ZeroVector);
}

void ATrainVehicle::PlaceOnRail(const ARailSpline& Rail, float HeadDistance)
{
	const float MyDistance = HeadDistance - DistanceBehindHead;
	const FTransform OnRail = Rail.GetTransformAtDistance(MyDistance);

	// Sat on the rail head rather than buried in it. Half the hull's height
	// plus the wheel radius the blockout stands in for.
	const float RideHeight = ULastTrainBalance::MetresToCm(Row.HeightMetres) * 0.5f;

	SetActorLocationAndRotation(
		OnRail.GetLocation() + FVector::UpVector * RideHeight,
		OnRail.GetRotation(),
		/*bSweep*/ false,
		/*OutSweepHitResult*/ nullptr,
		// Teleport would break the moving-base velocity the player is riding.
		ETeleportType::None);
}

bool ATrainVehicle::IsDestroyed() const
{
	return Health && Health->IsDestroyed();
}

float ATrainVehicle::TakeDamage(float Damage, const FDamageEvent& DamageEvent,
	AController* EventInstigator, AActor* DamageCauser)
{
	const float Handled = Super::TakeDamage(Damage, DamageEvent, EventInstigator, DamageCauser);
	if (!Health)
	{
		return Handled;
	}
	return Health->ApplyDamage(Damage);
}

void ATrainVehicle::HandleDamageStateChanged(EDamageState NewState)
{
	// PLACEHOLDER. Damage visuals are a material parameter and a mesh swap, and
	// both need authored assets. For now the state change is logged so the
	// simulation can be verified before the art exists.
	UE_LOG(LogLastTrainTrain, Verbose, TEXT("%s is now %s."),
		*GetName(), *UEnum::GetValueAsString(NewState));
}

void ATrainVehicle::HandleDestroyed()
{
	UE_LOG(LogLastTrainTrain, Log, TEXT("%s (%s) destroyed."), *GetName(), *VehicleId.ToString());
}
