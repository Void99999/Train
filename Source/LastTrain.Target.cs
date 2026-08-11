// Copyright LAST TRAIN. All rights reserved.

using UnrealBuildTool;

/** The shipping/standalone game target. Windows PC first, as the design calls for. */
public class LastTrainTarget : TargetRules
{
	public LastTrainTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;

		ExtraModuleNames.Add("LastTrain");
	}
}
