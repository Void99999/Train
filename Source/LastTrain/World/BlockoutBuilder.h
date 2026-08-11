// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BlockoutBuilder.generated.h"

class ARailSpline;
class ATrainActor;

/**
 * Builds a playable placeholder world from code.
 *
 * PLACEHOLDER. Everything this makes is boxes, a ground plane and a light. It
 * is a blockout so the vertical slice can be walked, driven and shot in before
 * any art exists - it is not the game's environment and must not be mistaken
 * for one.
 *
 * It exists because a level is a .umap, which is binary and editor-only. A
 * project handed over as source therefore contains no level at all, and without
 * this the first thing anyone sees on pressing Play is an empty void. With it,
 * an empty map gives a lit landscape, a kilometre of railway, and a train
 * standing on it.
 *
 * Once there is an authored level with a railway in it, the game mode leaves
 * this alone.
 */
UCLASS()
class LASTTRAIN_API ABlockoutBuilder : public AActor
{
	GENERATED_BODY()

public:
	ABlockoutBuilder();

	virtual void BeginPlay() override;

protected:
	/** Length of the placeholder railway, in metres. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Blockout", meta = (ClampMin = "100.0"))
	float TrackLengthMetres = 4000.f;

	/**
	 * How far the line bends over its length, in metres of lateral offset.
	 *
	 * Not zero. A dead straight test track hides every bug that only shows up
	 * on a curve - wagons cutting the corner, a camera that does not bank, a
	 * platform placed with a straight-line assumption.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Blockout")
	float TrackCurveMetres = 260.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Blockout")
	bool bSpawnGround = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Blockout")
	bool bSpawnLighting = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Blockout")
	bool bSpawnTrain = true;

	/** Sleeper-and-marker posts, so speed is readable while driving. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Blockout", meta = (ClampMin = "0"))
	int32 MarkerPostCount = 80;

private:
	ARailSpline* BuildRailway();
	void BuildGround();
	void BuildLighting();
	void BuildMarkerPosts(const ARailSpline& Rail);
	ATrainActor* BuildTrain(ARailSpline& Rail);

	/** One placeholder box in the world. */
	AActor* SpawnBox(const FName Name, const FVector& Location, const FRotator& Rotation,
		const FVector& SizeCm, bool bCollides);
};
