// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "LastTrainHudWidget.generated.h"

/**
 * The C++ side of the HUD.
 *
 * A UMG widget is an asset, so the visual design belongs in the editor. What
 * belongs here is everything the design must not decide for itself: where the
 * numbers come from, and which numbers exist at all.
 *
 * One number is deliberately absent and must stay absent: distance remaining.
 * The player is never told how long the line is or that it ends. Travelled
 * distance is fine - it reads as an odometer. A countdown would give away the
 * ending, and there is no way to add one without breaking the game's one
 * surprise.
 *
 * Derive a Blueprint from this, bind the events, and set it on the player
 * controller. See Docs/UNREAL_SETUP.md.
 */
UCLASS(Abstract, BlueprintType)
class LASTTRAIN_API ULastTrainHudWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

	/* ------------------------------------------------- what the HUD shows */

	UFUNCTION(BlueprintPure, Category = "HUD") float GetHealthFraction() const;
	UFUNCTION(BlueprintPure, Category = "HUD") float GetStaminaFraction() const;
	UFUNCTION(BlueprintPure, Category = "HUD") int32 GetMoney() const;

	UFUNCTION(BlueprintPure, Category = "HUD") float GetSpeedKmh() const;
	UFUNCTION(BlueprintPure, Category = "HUD") int32 GetThrottleNotch() const;
	UFUNCTION(BlueprintPure, Category = "HUD") int32 GetThrottleNotchCount() const;

	/** An odometer, not a countdown. */
	UFUNCTION(BlueprintPure, Category = "HUD") float GetDistanceTravelledKm() const;

	UFUNCTION(BlueprintPure, Category = "HUD") int32 GetRoundsInMagazine() const;
	UFUNCTION(BlueprintPure, Category = "HUD") int32 GetReserveRounds() const;
	UFUNCTION(BlueprintPure, Category = "HUD") FText GetEquippedWeaponName() const;

	/** Empty when there is nothing to interact with. */
	UFUNCTION(BlueprintPure, Category = "HUD") FText GetInteractionPrompt() const;

	UFUNCTION(BlueprintPure, Category = "HUD") bool IsWeaponWheelOpen() const;

	/**
	 * Called when the prompt changes, so the Blueprint can animate it rather
	 * than polling. Bound automatically in NativeConstruct.
	 */
	UFUNCTION(BlueprintImplementableEvent, Category = "HUD")
	void OnInteractionPromptChanged(const FText& NewPrompt);

protected:
	UFUNCTION()
	void HandleFocusChanged(UObject* Focused, const FText& NewPrompt);

	/** The character this HUD is reading, or null before possession. */
	class ALastTrainCharacter* GetCharacter() const;
	class ATrainActor* GetTrain() const;
};
