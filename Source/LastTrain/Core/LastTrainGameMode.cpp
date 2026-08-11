// Copyright LAST TRAIN. All rights reserved.

#include "Core/LastTrainGameMode.h"

#include "Core/LastTrainGameInstance.h"
#include "Core/LastTrainPlayerController.h"
#include "EngineUtils.h"
#include "LastTrain.h"
#include "Player/LastTrainCharacter.h"
#include "Train/RailSpline.h"
#include "World/BlockoutBuilder.h"

ALastTrainGameMode::ALastTrainGameMode()
{
	DefaultPawnClass = ALastTrainCharacter::StaticClass();
	PlayerControllerClass = ALastTrainPlayerController::StaticClass();
	BlockoutBuilderClass = ABlockoutBuilder::StaticClass();
}

void ALastTrainGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);

	if (!bBuildBlockoutIfLevelIsEmpty || !BlockoutBuilderClass)
	{
		return;
	}

	// A level that already has a railway in it was authored, so leave it alone.
	if (ARailSpline::Find(this))
	{
		UE_LOG(LogLastTrain, Log, TEXT("Level already has a railway; not building the blockout."));
		return;
	}

	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	World->SpawnActor<ABlockoutBuilder>(BlockoutBuilderClass, FTransform::Identity, Params);

	UE_LOG(LogLastTrain, Warning,
		TEXT("No railway in this level, so the placeholder blockout was built from code. ")
		TEXT("This is a blockout: boxes and a directional light, not final art. ")
		TEXT("See Docs/UNREAL_SETUP.md for building the real level."));
}

void ALastTrainGameMode::StartPlay()
{
	Super::StartPlay();

	if (ULastTrainGameInstance* GameInstance = ULastTrainGameInstance::Get(this))
	{
		// Straight into play for now. The intro director takes this over once
		// there is a Level Sequence to run.
		GameInstance->RequestState(ELastTrainState::MainMenu);
		GameInstance->RequestState(ELastTrainState::Playing);
	}
}
