// Copyright LAST TRAIN. All rights reserved.

#include "Audio/TrainAudioComponent.h"

#include "Components/AudioComponent.h"
#include "Data/LastTrainBalance.h"
#include "Kismet/GameplayStatics.h"
#include "LastTrain.h"
#include "Train/ThrottleComponent.h"
#include "Train/TrainActor.h"

UTrainAudioComponent::UTrainAudioComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
}

void UTrainAudioComponent::BeginPlay()
{
	Super::BeginPlay();

	// One voice per layer, started silent and kept running. Starting and
	// stopping loops as the train speeds up and slows down is audible.
	LayerVoices.Reserve(Layers.Num());
	for (const FTrainAudioLayer& Layer : Layers)
	{
		if (!Layer.Sound)
		{
			LayerVoices.Add(nullptr);
			continue;
		}

		UAudioComponent* Voice = UGameplayStatics::SpawnSoundAttached(
			Layer.Sound, GetOwner()->GetRootComponent(), NAME_None,
			FVector::ZeroVector, EAttachLocation::KeepRelativeOffset,
			/*bStopWhenAttachedToDestroyed*/ true,
			/*VolumeMultiplier*/ 0.f);

		LayerVoices.Add(Voice);
	}

	if (Layers.Num() == 0)
	{
		UE_LOG(LogLastTrain, Log,
			TEXT("Train audio has no layers assigned, so the train is silent. ")
			TEXT("Assign sounds on the train's TrainAudioComponent - see Docs/UNREAL_SETUP.md."));
	}
}

void UTrainAudioComponent::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	const ATrainActor* Train = Cast<ATrainActor>(GetOwner());
	if (!Train)
	{
		return;
	}

	const float MaxSpeed = FMath::Max(1.f, Train->GetMaxSpeedKmh());
	const float SpeedFraction = FMath::Clamp(Train->GetSpeedKmh() / MaxSpeed, 0.f, 1.f);
	const float ThrottleFraction = Train->GetThrottle() ? Train->GetThrottle()->GetFraction() : 0.f;

	UpdateLayers(SpeedFraction, ThrottleFraction);
	UpdateRailJoints(DeltaTime, Train->GetSpeedMetresPerSecond());
	UpdateRattles(DeltaTime, SpeedFraction);
}

void UTrainAudioComponent::UpdateLayers(float SpeedFraction, float ThrottleFraction)
{
	for (int32 Index = 0; Index < Layers.Num(); ++Index)
	{
		UAudioComponent* Voice = LayerVoices.IsValidIndex(Index) ? LayerVoices[Index] : nullptr;
		if (!Voice)
		{
			continue;
		}

		const FTrainAudioLayer& Layer = Layers[Index];

		// Rolling stock and wind follow speed; the engine follows the throttle.
		// That gap - the engine taking up load seconds before the speed arrives
		// - is most of what makes a heavy train sound heavy.
		const float Input = Layer.bDrivenByThrottle ? ThrottleFraction : SpeedFraction;

		const float Volume = Layer.Volume.GetRichCurveConst()->Eval(Input, 0.f);
		const float Pitch = Layer.Pitch.GetRichCurveConst()->Eval(Input, 1.f);

		Voice->SetVolumeMultiplier(FMath::Max(0.f, Volume));
		Voice->SetPitchMultiplier(FMath::Max(0.01f, Pitch));
	}
}

void UTrainAudioComponent::UpdateRailJoints(float DeltaTime, float SpeedMetresPerSecond)
{
	if (!RailJointSound || SpeedMetresPerSecond <= 0.4f)
	{
		MetresSinceJoint = 0.f;
		return;
	}

	MetresSinceJoint += SpeedMetresPerSecond * DeltaTime;
	while (MetresSinceJoint >= JointSpacingMetres)
	{
		MetresSinceJoint -= JointSpacingMetres;
		UGameplayStatics::SpawnSoundAttached(RailJointSound, GetOwner()->GetRootComponent());
	}
}

void UTrainAudioComponent::UpdateRattles(float DeltaTime, float SpeedFraction)
{
	if (!RattleSound || SpeedFraction <= 0.02f)
	{
		return;
	}

	SecondsUntilRattle -= DeltaTime * (0.5f + SpeedFraction * 3.2f);
	if (SecondsUntilRattle > 0.f)
	{
		return;
	}

	// Reset to somewhere between a third and one and a half intervals, so the
	// rattles never settle into a beat - a rattle on a fixed rhythm is exactly
	// the mechanical loop this whole design exists to avoid.
	SecondsUntilRattle = FMath::FRandRange(0.35f, 1.5f);
	UGameplayStatics::SpawnSoundAttached(RattleSound, GetOwner()->GetRootComponent());
}
