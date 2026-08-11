// Copyright LAST TRAIN. All rights reserved.

#include "Core/LastTrainGameInstance.h"

#include "LastTrain.h"

namespace
{
	/** Every transition the game is allowed to make, and nothing else. */
	struct FStateTransition
	{
		ELastTrainState From;
		ELastTrainState To;
	};

	const FStateTransition AllowedTransitions[] =
	{
		{ ELastTrainState::Boot,		ELastTrainState::MainMenu },

		{ ELastTrainState::MainMenu,	ELastTrainState::Intro },
		{ ELastTrainState::MainMenu,	ELastTrainState::Playing },

		{ ELastTrainState::Intro,		ELastTrainState::Playing },
		{ ELastTrainState::Intro,		ELastTrainState::MainMenu },

		{ ELastTrainState::Playing,		ELastTrainState::AtOutpost },
		{ ELastTrainState::Playing,		ELastTrainState::Paused },
		{ ELastTrainState::Playing,		ELastTrainState::RunFailed },
		{ ELastTrainState::Playing,		ELastTrainState::Ending },

		{ ELastTrainState::AtOutpost,	ELastTrainState::Playing },
		{ ELastTrainState::AtOutpost,	ELastTrainState::Paused },
		{ ELastTrainState::AtOutpost,	ELastTrainState::RunFailed },

		{ ELastTrainState::Paused,		ELastTrainState::Playing },
		{ ELastTrainState::Paused,		ELastTrainState::AtOutpost },
		{ ELastTrainState::Paused,		ELastTrainState::MainMenu },

		{ ELastTrainState::RunFailed,	ELastTrainState::Playing },
		{ ELastTrainState::RunFailed,	ELastTrainState::MainMenu },

		{ ELastTrainState::Ending,		ELastTrainState::MainMenu },
	};
}

void ULastTrainGameInstance::Init()
{
	Super::Init();

	UE_LOG(LogLastTrain, Log, TEXT("LAST TRAIN game instance starting."));
	State = ELastTrainState::Boot;
}

void ULastTrainGameInstance::Shutdown()
{
	OnStateChanged.Clear();
	Super::Shutdown();
}

ULastTrainGameInstance* ULastTrainGameInstance::Get(const UObject* WorldContext)
{
	if (!WorldContext)
	{
		return nullptr;
	}
	const UWorld* World = WorldContext->GetWorld();
	return World ? Cast<ULastTrainGameInstance>(World->GetGameInstance()) : nullptr;
}

bool ULastTrainGameInstance::IsTransitionAllowed(ELastTrainState From, ELastTrainState To) const
{
	for (const FStateTransition& Transition : AllowedTransitions)
	{
		if (Transition.From == From && Transition.To == To)
		{
			return true;
		}
	}
	return false;
}

bool ULastTrainGameInstance::RequestState(ELastTrainState NewState)
{
	if (NewState == State)
	{
		return true;
	}

	if (!IsTransitionAllowed(State, NewState))
	{
		UE_LOG(LogLastTrain, Warning, TEXT("Refused state change %s -> %s: not a declared transition."),
			*UEnum::GetValueAsString(State), *UEnum::GetValueAsString(NewState));
		return false;
	}

	const ELastTrainState OldState = State;
	State = NewState;

	UE_LOG(LogLastTrain, Verbose, TEXT("State %s -> %s"),
		*UEnum::GetValueAsString(OldState), *UEnum::GetValueAsString(NewState));

	OnStateChanged.Broadcast(OldState, NewState);
	return true;
}
