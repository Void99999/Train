// Copyright LAST TRAIN. All rights reserved.

#include "AI/EnemyCharacter.h"

#include "Data/LastTrainBalance.h"
#include "Data/LastTrainDataRegistry.h"
#include "Economy/WalletComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "LastTrain.h"
#include "Player/HealthComponent.h"
#include "Player/LastTrainCharacter.h"
#include "Train/Locomotive.h"
#include "Train/TrainActor.h"
#include "Weapons/WeaponComponent.h"

AEnemyCharacter::AEnemyCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	Health = CreateDefaultSubobject<UHealthComponent>(TEXT("Health"));
	Weapon = CreateDefaultSubobject<UWeaponComponent>(TEXT("Weapon"));
}

void AEnemyCharacter::BeginPlay()
{
	Super::BeginPlay();

	ConfigureFromCatalogue(EnemyId);

	if (Health)
	{
		Health->OnDied.AddDynamic(this, &AEnemyCharacter::HandleDied);
	}
}

void AEnemyCharacter::ConfigureFromCatalogue(FName InEnemyId)
{
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	if (!Registry)
	{
		return;
	}

	const FEnemyRow* Found = Registry->FindEnemy(InEnemyId);
	if (!Found)
	{
		UE_LOG(LogLastTrainAI, Error, TEXT("Unknown enemy '%s'."), *InEnemyId.ToString());
		return;
	}

	EnemyId = InEnemyId;
	Row = *Found;

	if (Health)
	{
		Health->SetMaxHealth(Row.MaxHealth, /*bRefill*/ true);
	}
	if (Weapon)
	{
		Weapon->Equip(Row.WeaponId);
	}

	GetCharacterMovement()->MaxWalkSpeed =
		ULastTrainBalance::MetresToCm(Row.MoveSpeedMetresPerSecond);
}

void AEnemyCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bDead || !Weapon)
	{
		return;
	}

	/*
	 * PLACEHOLDER BEHAVIOUR.
	 *
	 * Turn towards the train and shoot when it is in range. No perception, no
	 * cover, no movement, no leading a moving target. It is enough to prove the
	 * damage path end to end and no more; a Behavior Tree replaces all of it.
	 */
	const ATrainActor* Train = ATrainActor::Find(this);
	const ALocomotive* Target = Train ? Train->GetLocomotive() : nullptr;
	if (!Target)
	{
		return;
	}

	// Range is the weapon's, not the enemy's. A rifleman and a heavy carry the
	// same reach as anyone else holding those weapons.
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	const FWeaponRow* WeaponRow = Registry ? Registry->FindWeapon(Row.WeaponId) : nullptr;
	if (!WeaponRow)
	{
		return;
	}

	const FVector ToTarget = Target->GetActorLocation() - GetActorLocation();
	const float RangeCm = ULastTrainBalance::MetresToCm(WeaponRow->RangeMetres);

	if (ToTarget.SizeSquared() > FMath::Square(RangeCm))
	{
		AimSecondsRemaining = AimTimeSeconds;
		return;
	}

	SetActorRotation(FRotator(0.f, ToTarget.Rotation().Yaw, 0.f));

	if (AimSecondsRemaining > 0.f)
	{
		AimSecondsRemaining = FMath::Max(0.f, AimSecondsRemaining - DeltaSeconds);
		return;
	}

	Weapon->TryFireOnce();
}

float AEnemyCharacter::TakeDamage(float Damage, const FDamageEvent& DamageEvent,
	AController* EventInstigator, AActor* DamageCauser)
{
	const float Handled = Super::TakeDamage(Damage, DamageEvent, EventInstigator, DamageCauser);
	return Health ? Health->ApplyDamage(Damage) : Handled;
}

void AEnemyCharacter::HandleDied()
{
	if (bDead)
	{
		return;
	}
	bDead = true;

	// The bounty goes to the player who is running the train, which for a
	// single-player game is the only one there is.
	if (APawn* PlayerPawn = UGameplayStatics::GetPlayerPawn(this, 0))
	{
		if (UWalletComponent* Wallet = PlayerPawn->FindComponentByClass<UWalletComponent>())
		{
			Wallet->Credit(Row.Bounty);
		}
	}

	// PLACEHOLDER. A death animation and a ragdoll need an animation Blueprint
	// and a physics asset. Until those exist the body is removed after a beat.
	SetActorEnableCollision(false);
	SetLifeSpan(3.f);
}
