// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * Log categories.
 *
 * One per subsystem rather than one for the whole game, so a train problem can
 * be traced without wading through combat spam. Use them: LogLastTrain is for
 * module lifetime and nothing else.
 */
DECLARE_LOG_CATEGORY_EXTERN(LogLastTrain, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogLastTrainTrain, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogLastTrainPlayer, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogLastTrainEconomy, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogLastTrainAI, Log, All);
DECLARE_LOG_CATEGORY_EXTERN(LogLastTrainCinematics, Log, All);
