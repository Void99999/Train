// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "TrainAudioComponent.generated.h"

class UAudioComponent;
class USoundBase;

/**
 * The sound of the train.
 *
 * A locomotive is not a car engine. A car engine is a periodic waveform and the
 * ear hears it as a pitch, which is where a repetitive drone comes from. A
 * hundred-tonne machine heard from the cab is almost entirely noise: a
 * broadband rumble from the block, exhaust and cooling air that brightens under
 * load, the roll of steel wheels, the frame working, and - the only genuinely
 * periodic thing in the whole mix - rail joints passing underneath.
 *
 * That is a mix, not a sound file, so this component drives layers rather than
 * playing a loop. Each layer has a volume and a pitch curve against speed and
 * throttle, and the four notches are told apart by *timbre* far more than by
 * level: full power must be unmistakable without being punishing.
 *
 * WHAT IS MISSING: the sounds themselves. USoundBase assets - ideally
 * MetaSounds, which can do the filtering this design wants at runtime - can
 * only be authored in the editor. The layer structure, the curves and the
 * mixing are here and work; assign sounds and it plays. See
 * Docs/UNREAL_SETUP.md.
 */
USTRUCT(BlueprintType)
struct LASTTRAIN_API FTrainAudioLayer
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio")
	TObjectPtr<USoundBase> Sound;

	/** Volume against the driving input, 0 to 1 on the X axis. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio")
	FRuntimeFloatCurve Volume;

	/** Pitch against the same input. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio")
	FRuntimeFloatCurve Pitch;

	/** True when this layer follows the throttle rather than the speed. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Audio")
	bool bDrivenByThrottle = false;
};

UCLASS(ClassGroup = (LastTrain), meta = (BlueprintSpawnableComponent))
class LASTTRAIN_API UTrainAudioComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UTrainAudioComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

protected:
	/**
	 * The continuous bed. Rumble, exhaust, rolling stock, wind, frame.
	 *
	 * Ordering does not matter; each is mixed independently.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Audio")
	TArray<FTrainAudioLayer> Layers;

	/** Fired as each rail joint passes. The clearest speed cue there is. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Audio")
	TObjectPtr<USoundBase> RailJointSound;

	/** Metres between joints. Real track is longer; this reads better. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Audio", meta = (ClampMin = "1.0"))
	float JointSpacingMetres = 11.f;

	/** Irregular, so the bed never settles into a mechanical loop. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Audio")
	TObjectPtr<USoundBase> RattleSound;

private:
	void UpdateLayers(float SpeedFraction, float ThrottleFraction);
	void UpdateRailJoints(float DeltaTime, float SpeedMetresPerSecond);
	void UpdateRattles(float DeltaTime, float SpeedFraction);

	UPROPERTY(Transient)
	TArray<TObjectPtr<UAudioComponent>> LayerVoices;

	UPROPERTY(Transient) float MetresSinceJoint = 0.f;
	UPROPERTY(Transient) float SecondsUntilRattle = 1.f;
};
