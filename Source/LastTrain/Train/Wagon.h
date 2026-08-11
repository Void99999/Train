// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Train/TrainVehicle.h"
#include "Wagon.generated.h"

class UTrainDoorComponent;

/**
 * A wagon: transport or combat, at one of four levels.
 *
 * Both kinds are this class, because from the train's point of view they differ
 * only in what their catalogue row says - how much they hold, what they mount,
 * how much they weigh. Splitting them into two classes would duplicate the
 * coupling, the health and the walkable interior for the sake of one flag.
 *
 * What is missing here and is not pretended otherwise: walkable interiors for
 * wagons, connections between them, and the mounted weapon positions on combat
 * wagons. Those are the next things after the vertical slice.
 */
UCLASS()
class LASTTRAIN_API AWagon : public ATrainVehicle
{
	GENERATED_BODY()

public:
	AWagon();

	UFUNCTION(BlueprintPure, Category = "Wagon")
	bool IsCombatWagon() const { return Row.Kind == EVehicleKind::Combat; }

	UFUNCTION(BlueprintPure, Category = "Wagon")
	EMountType GetMountType() const { return Row.MountType; }

	/**
	 * Upgrades to the next level in the same kind.
	 * Returns false at level 4 or when the next level is not in the catalogue.
	 */
	UFUNCTION(BlueprintCallable, Category = "Wagon")
	bool UpgradeToNextLevel();
};
