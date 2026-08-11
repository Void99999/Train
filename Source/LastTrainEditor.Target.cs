// Copyright LAST TRAIN. All rights reserved.

using UnrealBuildTool;

/** The editor target. This is what Generate Project Files builds against. */
public class LastTrainEditorTarget : TargetRules
{
	public LastTrainEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;

		ExtraModuleNames.Add("LastTrain");
	}
}
