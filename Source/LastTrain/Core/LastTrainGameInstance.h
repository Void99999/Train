// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "Data/LastTrainTypes.h"
#include "LastTrainGameInstance.generated.h"

class ULastTrainSaveGame;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnLastTrainStateChanged, ELastTrainState, OldState, ELastTrainState, NewState);

/**
 * What survives a level change.
 *
 * The chosen difficulty, the settings, and the save slot. Anything that belongs
 * to a single run lives on the run itself (see ULastTrainRunState) rather than
 * here, so starting a new run cannot inherit half of the last one.
 *
 * The state machine lives here too. It is deliberately explicit: transitions
 * are declared, and an illegal one is a warning rather than a silent no-op, so
 * "the menu never handed over to the intro" shows up in the log instead of as a
 * black screen.
 */
UCLASS()
class LASTTRAIN_API ULastTrainGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	virtual void Init() override;
	virtual void Shutdown() override;

	UFUNCTION(BlueprintPure, Category = "Last Train")
	ELastTrainState GetState() const { return State; }

	/** Returns false and logs if the transition is not one of the declared ones. */
	UFUNCTION(BlueprintCallable, Category = "Last Train")
	bool RequestState(ELastTrainState NewState);

	UPROPERTY(BlueprintAssignable, Category = "Last Train")
	FOnLastTrainStateChanged OnStateChanged;

	UFUNCTION(BlueprintPure, Category = "Last Train")
	ELastTrainGameMode GetSelectedMode() const { return SelectedMode; }

	UFUNCTION(BlueprintCallable, Category = "Last Train")
	void SetSelectedMode(ELastTrainGameMode Mode) { SelectedMode = Mode; }

	/** True when the intro should be skipped - a resumed run, or a debug boot. */
	UFUNCTION(BlueprintPure, Category = "Last Train")
	bool ShouldSkipIntro() const { return bSkipIntro; }

	UFUNCTION(BlueprintCallable, Category = "Last Train")
	void SetSkipIntro(bool bSkip) { bSkipIntro = bSkip; }

	static ULastTrainGameInstance* Get(const UObject* WorldContext);

private:
	bool IsTransitionAllowed(ELastTrainState From, ELastTrainState To) const;

	UPROPERTY(Transient)
	ELastTrainState State = ELastTrainState::Boot;

	UPROPERTY(Transient)
	ELastTrainGameMode SelectedMode = ELastTrainGameMode::Normal;

	UPROPERTY(Transient)
	bool bSkipIntro = false;
};
