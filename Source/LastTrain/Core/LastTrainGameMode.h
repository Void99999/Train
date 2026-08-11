// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "LastTrainGameMode.generated.h"

class ABlockoutBuilder;

/**
 * The rules of a run.
 *
 * Thin on purpose. It wires the default pawn and controller, and it makes sure
 * the world has the things a run needs - a railway, a train, a light - even in
 * an empty level.
 *
 * That last part is not a convenience. Levels are .umap files, which are binary
 * and can only be authored in the editor, so a project delivered as source has
 * no level in it. Building the blockout from code means the game is playable in
 * a blank map from the first compile, and it means the blockout is described in
 * readable text that can be reviewed rather than in a binary nobody can diff.
 */
UCLASS()
class LASTTRAIN_API ALastTrainGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ALastTrainGameMode();

	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	virtual void StartPlay() override;

protected:
	/**
	 * Whether to build the blockout when the level does not already contain a
	 * railway. Turn it off once there is an authored level.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Last Train")
	bool bBuildBlockoutIfLevelIsEmpty = true;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Last Train")
	TSubclassOf<ABlockoutBuilder> BlockoutBuilderClass;
};
