// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RailSpline.generated.h"

class USplineComponent;

/**
 * The railway.
 *
 * A spline the train follows, in world space. This is the piece that makes the
 * difference between a game and the browser prototype: there, the train stood
 * still and the scenery was slid past it, which works for a corridor and falls
 * apart the moment the line needs to curve, climb, or have an outpost beside a
 * particular stretch of it.
 *
 * The train asks this for a transform at a distance. Everything else - where a
 * wagon sits, where an outpost platform is, where an enemy vehicle should drive
 * to run alongside - is expressed as a distance along the same spline, so all
 * of them agree about where "eleven kilometres" is.
 *
 * A level may hold several of these end to end for streaming; the train follows
 * the one it was placed on and hands over at the join.
 */
UCLASS()
class LASTTRAIN_API ARailSpline : public AActor
{
	GENERATED_BODY()

public:
	ARailSpline();

	UFUNCTION(BlueprintPure, Category = "Rail")
	USplineComponent* GetSpline() const { return Spline; }

	/** Total length of this section, in Unreal units. */
	UFUNCTION(BlueprintPure, Category = "Rail")
	float GetLength() const;

	/**
	 * The transform at a distance along the line, in world space.
	 *
	 * Distances past either end are clamped rather than wrapped: a train that
	 * runs off the end of the track should stop, not teleport to the start.
	 */
	UFUNCTION(BlueprintPure, Category = "Rail")
	FTransform GetTransformAtDistance(float Distance) const;

	/** Convenience for placing things beside the line - a platform, a wreck. */
	UFUNCTION(BlueprintPure, Category = "Rail")
	FVector GetLocationBesideTrack(float Distance, float LateralOffset, float Height = 0.f) const;

	/** The first rail spline in the world, or null. */
	static ARailSpline* Find(const UObject* WorldContext);

protected:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Rail")
	TObjectPtr<USplineComponent> Spline;
};
