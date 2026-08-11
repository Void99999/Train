// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "LastTrainPlayerController.generated.h"

/**
 * The player's controller.
 *
 * Owns the view and the interface, and nothing about the character. A pawn can
 * be swapped - during a cutscene, or when the player mans a wagon mount - and
 * the HUD has to survive that, which it only does if it never belonged to the
 * pawn in the first place.
 */
UCLASS()
class LASTTRAIN_API ALastTrainPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ALastTrainPlayerController();

	virtual void BeginPlay() override;

protected:
	/**
	 * The HUD widget class.
	 *
	 * Left unset until there is a UMG asset to point it at, because a widget is
	 * an asset and assets need the editor. The C++ base class it should derive
	 * from is ULastTrainHudWidget, which already exposes everything the HUD
	 * needs to bind to.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Last Train")
	TSubclassOf<class ULastTrainHudWidget> HudWidgetClass;

	UPROPERTY(Transient, BlueprintReadOnly, Category = "Last Train")
	TObjectPtr<class ULastTrainHudWidget> HudWidget;
};
