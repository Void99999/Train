// Copyright LAST TRAIN. All rights reserved.

#include "Core/LastTrainSaveGame.h"

#include "LastTrain.h"

bool ULastTrainSaveGame::Migrate()
{
	if (Version > CurrentVersion)
	{
		UE_LOG(LogLastTrain, Warning,
			TEXT("Save is version %d but this build understands %d. Refusing to load it rather than guessing."),
			Version, CurrentVersion);
		return false;
	}

	// Version 1 is the first layout, so there is nothing to migrate yet. When
	// the layout changes, add a step here for each version in turn - never a
	// single jump from "old" to "current", or the steps cannot be tested.
	//
	//   if (Version < 2) { ...fill in whatever version 2 added...; Version = 2; }

	Version = CurrentVersion;
	return true;
}
