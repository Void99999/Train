// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "LastTrainInputConfig.generated.h"

class UInputAction;
class UInputMappingContext;

/**
 * The game's input actions in one asset.
 *
 * Enhanced Input is the right system for a rebindable PC game, but its actions
 * and mapping contexts are assets, and assets cannot be created outside the
 * editor. That would mean a freshly compiled project with no input at all.
 *
 * So this asset is optional. Assign one and it is used. Leave it unassigned and
 * BuildRuntimeFallback() constructs an equivalent set in memory from the layout
 * in the specification - W/A/S/D, mouse, Shift, E, TAB, ESC - so the project is
 * playable from the first successful build. Creating the real assets later is
 * then a pure improvement rather than a prerequisite.
 */
UCLASS(BlueprintType)
class LASTTRAIN_API ULastTrainInputConfig : public UDataAsset
{
	GENERATED_BODY()

public:
	/** Axis2D. W/S on Y, A/D on X. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement")
	TObjectPtr<UInputAction> Move;

	/** Axis2D. Mouse delta. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement")
	TObjectPtr<UInputAction> Look;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement")
	TObjectPtr<UInputAction> Jump;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement")
	TObjectPtr<UInputAction> Sprint;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Movement")
	TObjectPtr<UInputAction> Crouch;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Interaction")
	TObjectPtr<UInputAction> Interact;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat")
	TObjectPtr<UInputAction> Fire;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat")
	TObjectPtr<UInputAction> Reload;

	/** Held, not toggled: the wheel is up for as long as TAB is down. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat")
	TObjectPtr<UInputAction> WeaponWheel;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "System")
	TObjectPtr<UInputAction> Pause;

	/** The context these actions are bound in. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputMappingContext> MappingContext;

	/** True when every action and the context are present. */
	bool IsComplete() const;

	/**
	 * Fills in anything missing with runtime-built equivalents.
	 *
	 * `Outer` owns the created objects, so they live as long as whatever asked
	 * for them. Safe to call on a fully authored asset: it does nothing.
	 */
	void BuildRuntimeFallback(UObject* Outer);
};
