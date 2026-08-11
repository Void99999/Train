// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/LastTrainCatalogRows.h"
#include "WeaponComponent.generated.h"

class UNiagaraSystem;
class USoundBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnAmmoChanged, int32, InMagazine, int32, InReserve);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWeaponFired, FName, WeaponId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnReloadStateChanged, bool, bReloading);

/**
 * Holding, firing and reloading a weapon.
 *
 * One component serves every weapon in the game: what a weapon *is* comes from
 * its catalogue row, so adding one is a row in a table rather than a class. The
 * same component drives the player, an enemy soldier and a wagon mount - the
 * difference is which row is equipped and who owns the reserve ammunition.
 *
 * Reserve rounds come from the train's cargo hold rather than from a private
 * pool, which is what makes ammunition compete with trade goods for space.
 * When there is no train - an enemy in the field - the component falls back to
 * an unlimited reserve, because an enemy running dry mid-ambush is a bug, not a
 * feature.
 */
UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UWeaponComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UWeaponComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

	/** Puts a catalogue weapon in the owner's hands. */
	UFUNCTION(BlueprintCallable, Category = "Weapon")
	bool Equip(FName WeaponId);

	UFUNCTION(BlueprintPure, Category = "Weapon") FName GetWeaponId() const { return WeaponId; }
	UFUNCTION(BlueprintPure, Category = "Weapon") int32 GetRoundsInMagazine() const { return RoundsInMagazine; }
	UFUNCTION(BlueprintPure, Category = "Weapon") int32 GetReserveRounds() const;
	UFUNCTION(BlueprintPure, Category = "Weapon") bool IsReloading() const { return ReloadSecondsRemaining > 0.f; }

	UFUNCTION(BlueprintCallable, Category = "Weapon") void StartFiring();
	UFUNCTION(BlueprintCallable, Category = "Weapon") void StopFiring();

	/** One shot, obeying the rate of fire. Returns whether a round left. */
	UFUNCTION(BlueprintCallable, Category = "Weapon")
	bool TryFireOnce();

	UFUNCTION(BlueprintCallable, Category = "Weapon")
	bool BeginReload();

	UPROPERTY(BlueprintAssignable, Category = "Weapon") FOnAmmoChanged OnAmmoChanged;
	UPROPERTY(BlueprintAssignable, Category = "Weapon") FOnWeaponFired OnWeaponFired;
	UPROPERTY(BlueprintAssignable, Category = "Weapon") FOnReloadStateChanged OnReloadStateChanged;

protected:
	/**
	 * Where shots come from. Left unset, the owner's camera is used for the
	 * player and the actor's forward vector for anything else.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon")
	FName MuzzleSocketName;

	/** True for anything that has no train behind it to draw ammunition from. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	bool bUnlimitedReserve = false;

private:
	const FWeaponRow* GetRow() const;

	/** Muzzle position and aim direction, in world space. */
	bool GetFiringLine(FVector& OutStart, FVector& OutDirection) const;

	void FireHitscan(const FWeaponRow& Row, const FVector& Start, const FVector& Direction);
	void FireProjectile(const FWeaponRow& Row, const FVector& Start, const FVector& Direction);

	/** Takes rounds from the reserve. Returns how many were actually taken. */
	int32 ConsumeFromReserve(const FWeaponRow& Row, int32 Wanted);

	void FinishReload();

	UPROPERTY(Transient) FName WeaponId;
	UPROPERTY(Transient) int32 RoundsInMagazine = 0;
	UPROPERTY(Transient) float SecondsUntilNextShot = 0.f;
	UPROPERTY(Transient) float ReloadSecondsRemaining = 0.f;
	UPROPERTY(Transient) bool bFiring = false;

	/** Cached so a shot does not go looking for the registry every round. */
	const FWeaponRow* CachedRow = nullptr;
};
