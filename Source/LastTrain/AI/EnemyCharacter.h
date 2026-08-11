// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Data/LastTrainCatalogRows.h"
#include "EnemyCharacter.generated.h"

class UHealthComponent;
class UWeaponComponent;

/**
 * An enemy on foot: rifleman or heavy.
 *
 * Configured from a catalogue row, like everything else, so adding an enemy
 * type is a row rather than a class.
 *
 * SCOPE, stated plainly: this class exists and works - it takes damage, dies,
 * pays a bounty and can fire a weapon - but it has no behaviour tree and no
 * perception yet. It stands where it is spawned and shoots at the train when it
 * is in range. That is enough for the vertical slice's one test encounter and
 * it is not enough for the game. Real behaviour needs an AIController with a
 * Behavior Tree and a Blackboard, which are editor assets; see
 * Docs/UNREAL_SETUP.md and Docs/PORTING_STATUS.md.
 */
UCLASS()
class LASTTRAIN_API AEnemyCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AEnemyCharacter();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float Damage, const FDamageEvent& DamageEvent,
		AController* EventInstigator, AActor* DamageCauser) override;

	UFUNCTION(BlueprintCallable, Category = "Enemy")
	void ConfigureFromCatalogue(FName EnemyId);

	UFUNCTION(BlueprintPure, Category = "Enemy") FName GetEnemyId() const { return EnemyId; }
	UFUNCTION(BlueprintPure, Category = "Enemy") const FEnemyRow& GetRow() const { return Row; }

protected:
	UFUNCTION()
	void HandleDied();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Enemy")
	TObjectPtr<UHealthComponent> Health;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Enemy")
	TObjectPtr<UWeaponComponent> Weapon;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	FName EnemyId = TEXT("soldier");

	UPROPERTY(Transient, BlueprintReadOnly, Category = "Enemy")
	FEnemyRow Row;

	/** Seconds between deciding to shoot and the first round leaving. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy", meta = (ClampMin = "0.0"))
	float AimTimeSeconds = 0.5f;

private:
	UPROPERTY(Transient) float AimSecondsRemaining = 0.f;
	UPROPERTY(Transient) bool bDead = false;
};
