// Copyright LAST TRAIN. All rights reserved.

#include "Core/LastTrainPlayerController.h"

#include "Blueprint/UserWidget.h"
#include "LastTrain.h"
#include "UI/LastTrainHudWidget.h"

ALastTrainPlayerController::ALastTrainPlayerController()
{
	// A first-person game with a locked cursor. The pause menu releases it.
	bShowMouseCursor = false;
	DefaultMouseCursor = EMouseCursor::Default;
}

void ALastTrainPlayerController::BeginPlay()
{
	Super::BeginPlay();

	SetInputMode(FInputModeGameOnly());

	if (!HudWidgetClass)
	{
		UE_LOG(LogLastTrain, Log,
			TEXT("No HUD widget class assigned, so the game runs without an interface. ")
			TEXT("Create a UMG widget deriving from LastTrainHudWidget and set it on the ")
			TEXT("player controller - see Docs/UNREAL_SETUP.md."));
		return;
	}

	HudWidget = CreateWidget<ULastTrainHudWidget>(this, HudWidgetClass);
	if (HudWidget)
	{
		HudWidget->AddToViewport();
	}
}
