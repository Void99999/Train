// Copyright LAST TRAIN. All rights reserved.

#include "Weapons/WeaponComponent.h"

#include "Camera/CameraComponent.h"
#include "Data/LastTrainBalance.h"
#include "Data/LastTrainDataRegistry.h"
#include "Engine/DamageEvents.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "LastTrain.h"
#include "Train/CargoHoldComponent.h"
#include "Train/TrainActor.h"

/** The "Weapon" trace channel from DefaultEngine.ini. */
static constexpr ECollisionChannel WeaponChannel = ECC_GameTraceChannel3;

UWeaponComponent::UWeaponComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UWeaponComponent::BeginPlay()
{
	Super::BeginPlay();
}

const FWeaponRow* UWeaponComponent::GetRow() const
{
	return CachedRow;
}

bool UWeaponComponent::Equip(FName InWeaponId)
{
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (!Registry)
	{
		return false;
	}

	const FWeaponRow* Row = Registry->FindWeapon(InWeaponId);
	if (!Row)
	{
		UE_LOG(LogLastTrainPlayer, Warning, TEXT("Cannot equip unknown weapon '%s'."), *InWeaponId.ToString());
		return false;
	}

	WeaponId = InWeaponId;
	CachedRow = Row;
	ReloadSecondsRemaining = 0.f;
	SecondsUntilNextShot = 0.f;

	// A weapon comes to hand loaded if there is anything to load it with.
	RoundsInMagazine = ConsumeFromReserve(*Row, Row->MagazineSize);

	OnAmmoChanged.Broadcast(RoundsInMagazine, GetReserveRounds());
	return true;
}

int32 UWeaponComponent::GetReserveRounds() const
{
	const FWeaponRow* Row = GetRow();
	if (!Row || Row->AmmoCargoId.IsNone())
	{
		return bUnlimitedReserve ? TNumericLimits<int32>::Max() : 0;
	}
	if (bUnlimitedReserve)
	{
		return TNumericLimits<int32>::Max();
	}

	const ATrainActor* Train = ATrainActor::Find(this);
	return Train ? Train->CountRoundsAvailable(Row->AmmoCargoId) : 0;
}

int32 UWeaponComponent::ConsumeFromReserve(const FWeaponRow& Row, int32 Wanted)
{
	if (Wanted <= 0)
	{
		return 0;
	}
	if (bUnlimitedReserve || Row.AmmoCargoId.IsNone())
	{
		return Wanted;
	}

	ATrainActor* Train = ATrainActor::Find(this);
	return Train ? Train->TakeRounds(Row.AmmoCargoId, Wanted) : 0;
}

void UWeaponComponent::StartFiring()
{
	bFiring = true;
}

void UWeaponComponent::StopFiring()
{
	bFiring = false;
}

void UWeaponComponent::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (SecondsUntilNextShot > 0.f)
	{
		SecondsUntilNextShot = FMath::Max(0.f, SecondsUntilNextShot - DeltaTime);
	}

	if (ReloadSecondsRemaining > 0.f)
	{
		ReloadSecondsRemaining = FMath::Max(0.f, ReloadSecondsRemaining - DeltaTime);
		if (ReloadSecondsRemaining <= 0.f)
		{
			FinishReload();
		}
		return;
	}

	if (bFiring)
	{
		TryFireOnce();
	}
}

bool UWeaponComponent::TryFireOnce()
{
	const FWeaponRow* Row = GetRow();
	if (!Row || IsReloading() || SecondsUntilNextShot > 0.f)
	{
		return false;
	}

	if (RoundsInMagazine <= 0)
	{
		// Empty. Reload if there is anything to reload with; otherwise the
		// caller gets a false and the HUD says so.
		BeginReload();
		return false;
	}

	FVector Start;
	FVector Direction;
	if (!GetFiringLine(Start, Direction))
	{
		return false;
	}

	--RoundsInMagazine;
	SecondsUntilNextShot = Row->ShotIntervalSeconds();

	if (Row->Delivery == EWeaponDelivery::Projectile)
	{
		FireProjectile(*Row, Start, Direction);
	}
	else
	{
		FireHitscan(*Row, Start, Direction);
	}

	OnWeaponFired.Broadcast(WeaponId);
	OnAmmoChanged.Broadcast(RoundsInMagazine, GetReserveRounds());
	return true;
}

bool UWeaponComponent::GetFiringLine(FVector& OutStart, FVector& OutDirection) const
{
	const AActor* Owner = GetOwner();
	if (!Owner)
	{
		return false;
	}

	// A shot has to go where the crosshair is, which is the camera's line and
	// not the muzzle's - the muzzle is off to one side and slightly low.
	if (const UCameraComponent* Camera = Owner->FindComponentByClass<UCameraComponent>())
	{
		OutStart = Camera->GetComponentLocation();
		OutDirection = Camera->GetForwardVector();
		return true;
	}

	if (const APawn* Pawn = Cast<APawn>(Owner))
	{
		OutStart = Pawn->GetPawnViewLocation();
		OutDirection = Pawn->GetViewRotation().Vector();
		return true;
	}

	OutStart = Owner->GetActorLocation();
	OutDirection = Owner->GetActorForwardVector();
	return true;
}

void UWeaponComponent::FireHitscan(const FWeaponRow& Row, const FVector& Start, const FVector& Direction)
{
	const float Range = ULastTrainBalance::MetresToCm(Row.RangeMetres);

	FCollisionQueryParams Params(SCENE_QUERY_STAT(LastTrainWeaponTrace), /*bTraceComplex*/ true, GetOwner());
	FHitResult Hit;

	if (GetWorld()->LineTraceSingleByChannel(Hit, Start, Start + Direction * Range, WeaponChannel, Params))
	{
		if (AActor* HitActor = Hit.GetActor())
		{
			FPointDamageEvent DamageEvent(Row.Damage, Hit, Direction, nullptr);
			HitActor->TakeDamage(Row.Damage, DamageEvent,
				GetOwner() ? GetOwner()->GetInstigatorController() : nullptr, GetOwner());
		}
	}
}

void UWeaponComponent::FireProjectile(const FWeaponRow& Row, const FVector& Start, const FVector& Direction)
{
	// PLACEHOLDER. Rockets and shells are hitscan for now so the vertical slice
	// has working weapons end to end. A travelling projectile needs an actor
	// with a movement component and a Niagara trail, which needs assets that
	// only the editor can author - see Docs/UNREAL_SETUP.md.
	//
	// The splash radius is applied at the point of impact so the damage model
	// is already the real one; only the flight is missing.
	const float Range = ULastTrainBalance::MetresToCm(Row.RangeMetres);

	FCollisionQueryParams Params(SCENE_QUERY_STAT(LastTrainProjectileTrace), /*bTraceComplex*/ true, GetOwner());
	FHitResult Hit;

	const FVector End = Start + Direction * Range;
	const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, WeaponChannel, Params);
	const FVector Impact = bHit ? Hit.ImpactPoint : End;

	if (Row.Splash.IsExplosive())
	{
		const ULastTrainBalance& Balance = ULastTrainBalance::Get();
		UGameplayStatics::ApplyRadialDamageWithFalloff(
			this,
			Row.Damage,
			Row.Damage * Balance.SplashMinimumFraction,
			Impact,
			/*DamageInnerRadius*/ 0.f,
			ULastTrainBalance::MetresToCm(Row.Splash.RadiusMetres),
			Balance.SplashFalloffExponent,
			/*DamageTypeClass*/ nullptr,
			/*IgnoreActors*/ TArray<AActor*>{ GetOwner() },
			GetOwner(),
			GetOwner() ? GetOwner()->GetInstigatorController() : nullptr);
	}
	else if (bHit && Hit.GetActor())
	{
		FPointDamageEvent DamageEvent(Row.Damage, Hit, Direction, nullptr);
		Hit.GetActor()->TakeDamage(Row.Damage, DamageEvent,
			GetOwner() ? GetOwner()->GetInstigatorController() : nullptr, GetOwner());
	}
}

bool UWeaponComponent::BeginReload()
{
	const FWeaponRow* Row = GetRow();
	if (!Row || IsReloading() || RoundsInMagazine >= Row->MagazineSize)
	{
		return false;
	}

	if (GetReserveRounds() <= 0)
	{
		return false;
	}

	ReloadSecondsRemaining = Row->ReloadSeconds;
	OnReloadStateChanged.Broadcast(true);
	return true;
}

void UWeaponComponent::FinishReload()
{
	const FWeaponRow* Row = GetRow();
	if (!Row)
	{
		return;
	}

	const int32 Wanted = Row->MagazineSize - RoundsInMagazine;
	RoundsInMagazine += ConsumeFromReserve(*Row, Wanted);

	OnReloadStateChanged.Broadcast(false);
	OnAmmoChanged.Broadcast(RoundsInMagazine, GetReserveRounds());
}
