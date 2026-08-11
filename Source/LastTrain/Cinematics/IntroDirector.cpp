// Copyright LAST TRAIN. All rights reserved.

#include "Cinematics/IntroDirector.h"

#include "Core/LastTrainGameInstance.h"
#include "LastTrain.h"
#include "LevelSequence.h"
#include "LevelSequenceActor.h"
#include "LevelSequencePlayer.h"
#include "Train/Locomotive.h"
#include "Train/ThrottleComponent.h"
#include "Train/TrainActor.h"
#include "Train/TrainDoorComponent.h"

AIntroDirector::AIntroDirector()
{
	PrimaryActorTick.bCanEverTick = false;
}

void AIntroDirector::BeginPlay()
{
	Super::BeginPlay();

	if (bPlayOnBeginPlay)
	{
		PlayIntro();
	}
}

bool AIntroDirector::PlayIntro()
{
	if (bPlaying || bFinished)
	{
		return false;
	}

	ULastTrainGameInstance* GameInstance = ULastTrainGameInstance::Get(this);
	if (GameInstance && GameInstance->ShouldSkipIntro())
	{
		FinishIntro();
		return false;
	}

	ULevelSequence* Sequence = IntroSequence.LoadSynchronous();
	if (!Sequence)
	{
		UE_LOG(LogLastTrainCinematics, Log,
			TEXT("No intro sequence assigned, so the game starts in the cab. ")
			TEXT("Build one in Sequencer and set it on the IntroDirector - see Docs/UNREAL_SETUP.md."));
		FinishIntro();
		return false;
	}

	FMovieSceneSequencePlaybackSettings Settings;
	Settings.bAutoPlay = false;
	// The player has no business steering during a cutscene.
	Settings.bDisableMovementInput = true;
	Settings.bDisableLookAtInput = true;
	Settings.bHidePlayer = true;
	Settings.bHideHud = true;

	SequencePlayer = ULevelSequencePlayer::CreateLevelSequencePlayer(
		GetWorld(), Sequence, Settings, SequenceActor);

	if (!SequencePlayer)
	{
		FinishIntro();
		return false;
	}

	if (GameInstance)
	{
		GameInstance->RequestState(ELastTrainState::Intro);
	}

	SequencePlayer->OnFinished.AddDynamic(this, &AIntroDirector::HandleSequenceFinished);
	SequencePlayer->Play();
	bPlaying = true;

	return true;
}

void AIntroDirector::SkipIntro()
{
	if (!bPlaying)
	{
		return;
	}

	if (SequencePlayer)
	{
		SequencePlayer->Stop();
	}
	FinishIntro();
}

void AIntroDirector::HandleSequenceFinished()
{
	FinishIntro();
}

void AIntroDirector::FinishIntro()
{
	if (bFinished)
	{
		return;
	}
	bFinished = true;
	bPlaying = false;

	/*
	 * The end state, applied here rather than by the last shot.
	 *
	 * Watching the intro and skipping it have to leave the world identical. If
	 * the sequence is what shuts the cab door and opens the throttle, then a
	 * player who skips starts with the door open and the train stopped, and
	 * that difference will be found by a player long before it is found by a
	 * developer.
	 */
	if (ATrainActor* Train = ATrainActor::Find(this))
	{
		if (UThrottleComponent* Throttle = Train->GetThrottle())
		{
			// He opened it to full before pulling out, and the run starts moving.
			Throttle->SetNotch(Throttle->GetNotchCount() - 1);
		}

		if (ALocomotive* Locomotive = Train->GetLocomotive())
		{
			if (UTrainDoorComponent* Right = Locomotive->GetRightDoor())
			{
				Right->SetOpen(false);
			}
			if (UTrainDoorComponent* Left = Locomotive->GetLeftDoor())
			{
				Left->SetOpen(false);
			}
		}
	}

	if (ULastTrainGameInstance* GameInstance = ULastTrainGameInstance::Get(this))
	{
		GameInstance->RequestState(ELastTrainState::Playing);
	}

	UE_LOG(LogLastTrainCinematics, Log, TEXT("Intro finished; control returned to the player."));
}
