// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "IntroDirector.generated.h"

class ULevelSequence;
class ULevelSequencePlayer;
class ALevelSequenceActor;

/**
 * Plays the opening and hands over to gameplay.
 *
 * The intro is eleven beats:
 *
 *   the title train pulls away and is destroyed
 *   the helicopter over the battlefield
 *   the door gun
 *   the helicopter is hit
 *   losing control
 *   the crash
 *   waking on the ground
 *   the crawl
 *   the railway shelter
 *   climbing into the green locomotive
 *   full power, and away
 *
 * WHAT THIS CLASS IS: the handover. It starts a Level Sequence, keeps the
 * player out of the way while it runs, allows a skip, and guarantees that
 * whether the intro is watched or skipped the world ends up in exactly the same
 * state - aboard, door shut, throttle at full, control returned. That last
 * guarantee is the part that is easy to get wrong and expensive to debug, so it
 * lives in code rather than in a sequence.
 *
 * WHAT THIS CLASS IS NOT: the intro itself. The shots are a ULevelSequence,
 * which is an editor asset. Until one is assigned, this skips straight to
 * gameplay and says so in the log. See Docs/UNREAL_SETUP.md for building it in
 * Sequencer.
 */
UCLASS()
class LASTTRAIN_API AIntroDirector : public AActor
{
	GENERATED_BODY()

public:
	AIntroDirector();

	virtual void BeginPlay() override;

	/** Starts the intro. Returns false when there is nothing to play. */
	UFUNCTION(BlueprintCallable, Category = "Cinematics")
	bool PlayIntro();

	/**
	 * Ends it early.
	 *
	 * Skipping must leave the world exactly as watching it would. Anything a
	 * shot was going to set - the door, the throttle, the time of day - is
	 * applied here as well, which is why FinishIntro is the only place that
	 * hands control back.
	 */
	UFUNCTION(BlueprintCallable, Category = "Cinematics")
	void SkipIntro();

	UFUNCTION(BlueprintPure, Category = "Cinematics")
	bool IsPlaying() const { return bPlaying; }

protected:
	UFUNCTION()
	void HandleSequenceFinished();

	/** Applies the end state and returns control. Called on finish and on skip. */
	void FinishIntro();

	/** The shots. Unset until one is authored in Sequencer. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cinematics")
	TSoftObjectPtr<ULevelSequence> IntroSequence;

	/** Whether to run the intro at all. Off for a resumed run. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Cinematics")
	bool bPlayOnBeginPlay = true;

private:
	UPROPERTY(Transient) TObjectPtr<ALevelSequenceActor> SequenceActor;
	UPROPERTY(Transient) TObjectPtr<ULevelSequencePlayer> SequencePlayer;
	UPROPERTY(Transient) bool bPlaying = false;
	UPROPERTY(Transient) bool bFinished = false;
};
